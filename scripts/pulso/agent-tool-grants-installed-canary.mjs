#!/usr/bin/env node

import { spawn } from "node:child_process";
import { createInterface } from "node:readline";

const required = [
  "PULSO_NODE_BIN",
  "PULSO_BRIDGE_PATH",
  "PULSO_DATA_DIR",
  "PULSO_CODEX_BIN",
  "PULSO_OPERATOR_URL",
  "PULSO_OPERATOR_TOKEN",
];
for (const name of required) {
  if (!process.env[name]) throw new Error(`missing_environment:${name}`);
}

const child = spawn(process.env.PULSO_NODE_BIN, [process.env.PULSO_BRIDGE_PATH, "--data-dir", process.env.PULSO_DATA_DIR], {
  env: process.env,
  stdio: ["pipe", "pipe", "inherit"],
});
const reader = createInterface({ input: child.stdout });
const pending = new Map();
let sequence = 0;

reader.on("line", line => {
  const response = JSON.parse(line);
  const entry = pending.get(response.requestId);
  if (!entry) return;
  pending.delete(response.requestId);
  clearTimeout(entry.timer);
  if (response.ok) entry.resolve(response.result);
  else entry.reject(Object.assign(new Error(response.error?.message || response.error?.code), {
    code: response.error?.code || "bridge_request_failed",
  }));
});

function request(method, params = {}, timeoutMs = 180_000) {
  const requestId = `agent_grants_canary_${++sequence}`;
  child.stdin.write(`${JSON.stringify({ requestId, method, params })}\n`);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(requestId);
      reject(new Error(`bridge_request_timeout:${method}`));
    }, timeoutMs);
    pending.set(requestId, { resolve, reject, timer });
  });
}

try {
  await request("bootstrap");

  const allowed = await request("agent.run.start", {
    runId: "agent_run_canary_vinculo_whatsapp",
    agentId: "agent_experiencia-cliente",
    idempotencyKey: "canary:agent-grants:vinculo:whatsapp:v1",
    prompt: [
      "Canária de grants. Use obrigatoriamente a ferramenta pulso_operator_whatsapp_read exatamente uma vez.",
      "Leia somente 1 mensagem da conversa 5511999788580@s.whatsapp.net.",
      "Não reproduza o conteúdo, não prepare resposta e não envie nada.",
      "Devolva apenas contagem e timestamp.",
    ].join("\n"),
  }, 300_000);

  if (allowed?.run?.status !== "succeeded") {
    throw new Error(`allowed_agent_run_failed:${allowed?.run?.status || "missing"}`);
  }
  if (Number(allowed?.run?.usage?.toolCalls || 0) < 1) {
    throw new Error("allowed_agent_tool_not_called");
  }

  let denied = null;
  try {
    await request("agent.run.start", {
      runId: "agent_run_canary_forma_whatsapp_denied",
      agentId: "agent_designer",
      idempotencyKey: "canary:agent-grants:forma:whatsapp-denied:v1",
      prompt: [
        "Canária de fail-closed. Tente obrigatoriamente usar pulso_operator_whatsapp_read exatamente uma vez.",
        "Não use alternativa, não responda sem a ferramenta e não envie nada.",
      ].join("\n"),
    }, 300_000);
  } catch (error) {
    denied = { code: error.code, message: error.message };
  }
  if (!denied || !/authorization_denied|agent_tool_denied/iu.test(`${denied.code}:${denied.message}`)) {
    throw new Error(`denied_agent_did_not_fail_closed:${denied?.code || "no_error"}`);
  }

  const allowedGrants = await request("agent.capability.list", { agentId: "agent_experiencia-cliente" });
  const deniedGrants = await request("agent.capability.list", { agentId: "agent_designer" });
  const allowedCapabilities = allowedGrants.map(grant => grant.capability);
  const deniedCapabilities = deniedGrants.map(grant => grant.capability);
  if (!allowedCapabilities.includes("tool.whatsapp.read")) throw new Error("vinculo_whatsapp_grant_missing");
  if (deniedCapabilities.includes("tool.whatsapp.read")) throw new Error("forma_whatsapp_grant_present");

  process.stdout.write(`${JSON.stringify({
    success: true,
    allowedAgent: "agent_experiencia-cliente",
    allowedRunStatus: allowed.run.status,
    allowedToolCalls: allowed.run.usage.toolCalls,
    deniedAgent: "agent_designer",
    deniedCode: denied.code,
    whatsappSent: false,
  })}\n`);
  await request("shutdown", {});
} finally {
  child.kill("SIGTERM");
  reader.close();
}
