#!/usr/bin/env node

import { createServer } from "node:http";
import { timingSafeEqual } from "node:crypto";
import { execFile } from "node:child_process";
import { realpathSync } from "node:fs";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";

import { callGatewayFromCli } from "/usr/lib/node_modules/openclaw/dist/plugin-sdk/gateway-runtime.js";

const execFileAsync = promisify(execFile);
const WACLI_BIN = process.env.PULSO_WACLI_BIN || "/root/go/bin/wacli";
const OPENCLAW_BIN = process.env.PULSO_OPENCLAW_BIN || "/usr/bin/openclaw";
const BIND_HOST = process.env.PULSO_OPERATOR_BIND || "127.0.0.1";
const PORT = Number(process.env.PULSO_OPERATOR_PORT || 8767);
const TOKEN = String(process.env.PULSO_OPERATOR_TOKEN || "");
const MAX_BODY_BYTES = 64 * 1024;
const JID_PATTERN = /^\d{6,18}@(s\.whatsapp\.net|g\.us)$/;
const DEVICE_IDENTITIES = Object.freeze({
  imac: "2ebf570d0a71ff10bf5c6b5491929be05c8c8786168108993a5efe3c986074db",
  macbook: "cd9a9e9a737df7280bb62480369e143c61ee9316c80408199754f813c222bba3",
});

function text(value, limit = 4_000) {
  const normalized = String(value ?? "").replace(/\u0000/g, "");
  return normalized.length <= limit ? normalized : `${normalized.slice(0, limit)}…`;
}

function safeToken(value) {
  const supplied = Buffer.from(String(value || ""));
  const expected = Buffer.from(TOKEN);
  return supplied.length === expected.length && expected.length >= 24 && timingSafeEqual(supplied, expected);
}

async function jsonBody(request) {
  const chunks = [];
  let total = 0;
  for await (const chunk of request) {
    total += chunk.length;
    if (total > MAX_BODY_BYTES) throw Object.assign(new Error("operator_body_too_large"), { code: "operator_body_too_large" });
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

async function runWacli(args) {
  const { stdout } = await execFileAsync(WACLI_BIN, [...args, "--json", "--read-only"], {
    timeout: 20_000,
    maxBuffer: 8 * 1024 * 1024,
    env: { ...process.env, WACLI_READONLY: "1" },
  });
  const parsed = JSON.parse(stdout);
  if (parsed?.success !== true) throw Object.assign(new Error(parsed?.error?.message || "wacli_failed"), { code: "wacli_failed" });
  return parsed.data;
}

async function resolveWhatsAppJid(args) {
  const explicit = text(args.jid, 96).trim();
  if (explicit) {
    if (!JID_PATTERN.test(explicit)) throw Object.assign(new Error("invalid_whatsapp_jid"), { code: "invalid_whatsapp_jid" });
    return explicit;
  }
  const contact = text(args.contact, 240).trim();
  if (!contact) throw Object.assign(new Error("whatsapp_contact_required"), { code: "whatsapp_contact_required" });
  const candidates = await runWacli(["contacts", "search", contact, "--limit", "8"]);
  const canonical = (Array.isArray(candidates) ? candidates : [])
    .filter(item => JID_PATTERN.test(String(item?.jid || "")))
    .map(item => ({ jid: item.jid, name: text(item.name || item.alias || "", 160) }));
  if (canonical.length !== 1) {
    const error = new Error("whatsapp_contact_ambiguous");
    error.code = "whatsapp_contact_ambiguous";
    error.publicCandidates = canonical.slice(0, 8);
    throw error;
  }
  return canonical[0].jid;
}

async function readWhatsApp(args) {
  const jid = await resolveWhatsAppJid(args);
  const limit = Math.max(1, Math.min(20, Number(args.limit) || 8));
  const data = await runWacli(["messages", "list", "--chat", jid, "--limit", String(limit)]);
  return {
    jid,
    messages: (Array.isArray(data?.messages) ? data.messages : []).map(message => ({
      id: text(message.MsgID, 180),
      chatName: text(message.ChatName, 180),
      senderName: text(message.SenderName, 180),
      senderJid: text(message.SenderJID, 96),
      timestamp: text(message.Timestamp, 80),
      fromMe: message.FromMe === true,
      text: text(message.Text || message.DisplayText, 4_000),
      media: message.MediaType ? {
        type: text(message.MediaType, 80),
        filename: text(message.Filename, 240),
        mimeType: text(message.MimeType, 160),
        caption: text(message.MediaCaption, 1_000),
      } : null,
    })),
    source: "wacli_local_read_only",
  };
}

async function readDevices() {
  const response = await callGatewayFromCli("node.list", { timeout: "5000" }, {});
  const nodes = Array.isArray(response?.nodes) ? response.nodes : [];
  return {
    observedAt: new Date().toISOString(),
    devices: Object.entries(DEVICE_IDENTITIES).map(([key, nodeId]) => {
      const node = nodes.find(candidate => candidate?.nodeId === nodeId);
      const caps = Array.isArray(node?.caps) ? node.caps : [];
      const commands = Array.isArray(node?.commands) ? node.commands : [];
      return {
        key,
        connected: node?.connected === true,
        operable: node?.connected === true && caps.includes("system") && commands.includes("system.run"),
        lastSeenAtMs: Number(node?.lastSeenAtMs || node?.lastDisconnectedAtMs || 0) || null,
      };
    }),
    source: "openclaw_gateway_read_only",
  };
}

function sanitizeJob(job) {
  const state = job?.state && typeof job.state === "object" ? job.state : {};
  return {
    id: text(job?.id || job?.jobId, 180),
    name: text(job?.name || job?.displayName, 240),
    description: text(job?.description, 500),
    enabled: job?.enabled === true,
    schedule: job?.schedule || null,
    ownerAgentId: text(job?.owner?.agentId || job?.agentId, 120) || null,
    payloadKind: text(job?.payload?.kind, 120) || null,
    model: text(job?.payload?.model, 180) || null,
    lastRunAtMs: Number(state.lastRunAtMs || job?.lastRunAtMs || 0) || null,
    nextRunAtMs: Number(state.nextRunAtMs || job?.nextRunAtMs || 0) || null,
    lastStatus: text(state.lastStatus || state.lastRunStatus || job?.lastStatus, 120) || null,
    lastError: text(typeof state.lastError === "string" ? state.lastError : state.lastError?.message, 500) || null,
  };
}

async function listJobs(args) {
  const limit = Math.max(1, Math.min(200, Number(args.limit) || 100));
  const includeDisabled = args.includeDisabled !== false;
  const response = await callGatewayFromCli("cron.list", { timeout: "10000" }, { includeDisabled, limit, offset: 0 });
  const jobs = Array.isArray(response?.jobs) ? response.jobs : Array.isArray(response) ? response : [];
  return { jobs: jobs.map(sanitizeJob), source: "openclaw_gateway" };
}

async function createJob(args) {
  if (!args.job || typeof args.job !== "object" || Array.isArray(args.job)) {
    throw Object.assign(new Error("operator_job_required"), { code: "operator_job_required" });
  }
  const response = await callGatewayFromCli("cron.add", { timeout: "15000" }, args.job);
  return { job: sanitizeJob(response?.job || response), source: "openclaw_gateway" };
}

async function updateJob(args) {
  const jobId = text(args.jobId, 180).trim();
  if (!jobId || !args.patch || typeof args.patch !== "object" || Array.isArray(args.patch)) {
    throw Object.assign(new Error("operator_job_update_invalid"), { code: "operator_job_update_invalid" });
  }
  const response = await callGatewayFromCli("cron.update", { timeout: "15000" }, { id: jobId, patch: args.patch });
  return { job: sanitizeJob(response?.job || response), source: "openclaw_gateway" };
}

async function runJob(args) {
  const jobId = text(args.jobId, 180).trim();
  if (!jobId) throw Object.assign(new Error("operator_job_id_required"), { code: "operator_job_id_required" });
  const response = await callGatewayFromCli("cron.run", { timeout: "30000" }, { id: jobId, mode: "force" });
  return { jobId, accepted: true, result: response ?? null, source: "openclaw_gateway" };
}

async function sendWhatsApp(args) {
  const jid = text(args.jid, 96).trim();
  const message = text(args.message, 8_000).trim();
  if (!JID_PATTERN.test(jid)) throw Object.assign(new Error("invalid_whatsapp_jid"), { code: "invalid_whatsapp_jid" });
  if (!message) throw Object.assign(new Error("whatsapp_message_required"), { code: "whatsapp_message_required" });
  const target = jid.endsWith("@s.whatsapp.net") ? `+${jid.split("@")[0]}` : jid;
  const command = ["message", "send", "--channel", "whatsapp", "--target", target, "--message", message, "--json"];
  if (args.replyToMessageId) command.push("--reply-to", text(args.replyToMessageId, 180));
  const { stdout } = await execFileAsync(OPENCLAW_BIN, command, { timeout: 30_000, maxBuffer: 4 * 1024 * 1024 });
  const result = JSON.parse(stdout || "{}");
  return {
    sent: result?.sent === true || result?.ok === true || Boolean(result?.messageId || result?.id),
    messageId: text(result?.messageId || result?.id, 180) || null,
    channel: "whatsapp",
    target: jid,
    source: "openclaw_channel",
  };
}

async function executeTool(tool, args) {
  if (tool === "pulso_operator_whatsapp_read") return readWhatsApp(args);
  if (tool === "pulso_operator_devices_status") return readDevices();
  if (tool === "pulso_operator_jobs_list") return listJobs(args);
  if (tool === "pulso_operator_job_create") return createJob(args);
  if (tool === "pulso_operator_job_update") return updateJob(args);
  if (tool === "pulso_operator_job_run") return runJob(args);
  if (tool === "pulso_operator_whatsapp_send") return sendWhatsApp(args);
  throw Object.assign(new Error(`operator_tool_unsupported:${tool}`), { code: "operator_tool_unsupported" });
}

function respond(response, status, body) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  response.end(JSON.stringify(body));
}

export function createIntegralOperatorServer() {
  if (TOKEN.length < 24) throw new Error("PULSO_OPERATOR_TOKEN must contain at least 24 characters");
  return createServer(async (request, response) => {
    try {
      if (request.url === "/health" && request.method === "GET") {
        respond(response, 200, { success: true, service: "pulso-integral-operator", mode: "governed", capabilities: ["whatsapp.read", "whatsapp.send", "devices.read", "jobs.read", "jobs.write", "jobs.run"] });
        return;
      }
      if (request.url !== "/v1/tools/execute" || request.method !== "POST") {
        respond(response, 404, { success: false, error: { code: "not_found" } });
        return;
      }
      if (!safeToken(String(request.headers.authorization || "").replace(/^Bearer\s+/i, ""))) {
        respond(response, 401, { success: false, error: { code: "unauthorized" } });
        return;
      }
      const body = await jsonBody(request);
      const result = await executeTool(String(body.tool || ""), body.arguments || {});
      respond(response, 200, { success: true, result });
    } catch (error) {
      respond(response, 400, {
        success: false,
        error: {
          code: text(error?.code || error?.message || "operator_failed", 160),
          candidates: Array.isArray(error?.publicCandidates) ? error.publicCandidates : undefined,
        },
      });
    }
  });
}

const invokedPath = process.argv[1] ? pathToFileURL(realpathSync(process.argv[1])).href : "";
if (import.meta.url === invokedPath) {
  const server = createIntegralOperatorServer();
  server.listen(PORT, BIND_HOST, () => {
    process.stdout.write(`${JSON.stringify({ event: "operator.ready", host: BIND_HOST, port: PORT, mode: "governed" })}\n`);
  });
  const stop = () => server.close(() => process.exit(0));
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
}
