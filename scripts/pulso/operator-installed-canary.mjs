#!/usr/bin/env node

import { spawn } from "node:child_process";
import { createInterface } from "node:readline";

const required = ["PULSO_NODE_BIN", "PULSO_BRIDGE_PATH", "PULSO_DATA_DIR", "PULSO_CODEX_BIN", "PULSO_OPERATOR_URL", "PULSO_OPERATOR_TOKEN"];
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
  if (!response.ok) {
    const error = new Error(response.error?.message || response.error?.code || "bridge_request_failed");
    error.code = response.error?.code || "bridge_request_failed";
    entry.reject(error);
  } else entry.resolve(response.result);
});

function request(method, params = {}, timeoutMs = 120_000) {
  const requestId = `operator_canary_${++sequence}`;
  child.stdin.write(`${JSON.stringify({ requestId, method, params })}\n`);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(requestId);
      reject(new Error(`bridge_request_timeout:${method}`));
    }, timeoutMs);
    pending.set(requestId, { resolve, reject, timer });
  });
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

try {
  await request("health");
  const areas = await request("live.areas.list");
  const area = areas.find(item => item.id === "area_pulso") || areas[0];
  if (!area) throw new Error("operator_canary_area_missing");

  const sessionId = "session_canary_operator_49a5f405";
  const sessions = await request("live.sessions.list", { areaId: area.id });
  if (!sessions.some(item => item.id === sessionId)) {
    await request("live.session.create", {
      id: sessionId,
      areaId: area.id,
      titulo: "canária · WhatsApp e bastidor · 49a5f405",
      identityId: "lotus",
      estado: "active",
      idempotencyKey: "canary:operator:49a5f405:session",
    });
  }

  const runId = "live_run_canary_operator_49a5f405";
  const start = await request("live.turn.start", {
    runId,
    sessionId,
    idempotencyKey: "canary:operator:49a5f405:turn",
    texto: [
      "Esta é uma canária auditável. Use obrigatoriamente as três ferramentas dinâmicas da PULSO exatamente uma vez cada.",
      "1) Leia exatamente 2 mensagens da conversa WhatsApp 5511999788580@s.whatsapp.net, sem reproduzir o conteúdo.",
      "2) Prepare, sem enviar, a minuta: CANÁRIA PULSO · NÃO ENVIAR.",
      "3) Consulte o estado dos Macs canônicos.",
      "Responda somente com a contagem lida, os timestamps, sent=false e o estado conectado/operável dos Macs. Nunca envie mensagem.",
    ].join("\n"),
  }, 180_000);

  let state = start;
  const observedEnvelopes = [];
  const deadline = Date.now() + 300_000;
  while (Date.now() < deadline) {
    const polled = await request("live.turn.poll", { runId, maxItems: 500 });
    observedEnvelopes.push(...polled.envelopes);
    state = polled.run;
    if (polled.done) break;
    await sleep(1_000);
  }
  if (state?.status !== "completed") throw new Error(`operator_canary_run_not_completed:${state?.status || "missing"}`);

  const tools = [...new Set((state.toolReceipts || []).map(receipt => receipt.tool).filter(Boolean))].sort();
  const expected = [
    "pulso_operator_devices_status",
    "pulso_operator_whatsapp_prepare",
    "pulso_operator_whatsapp_read",
  ];
  for (const tool of expected) {
    if (!tools.includes(tool)) throw new Error(`operator_canary_tool_missing:${tool}`);
  }
  const failed = (state.toolReceipts || []).filter(receipt => receipt.success === false);
  if (failed.length) throw new Error(`operator_canary_tool_failed:${failed.map(item => item.tool).join(",")}`);
  const finalText = String(state.accumulatedText || "");
  if (!/(?:sent\s*=\s*false|não\s+enviad[ao])/iu.test(finalText)) throw new Error("operator_canary_unsent_receipt_missing");

  process.stdout.write(`${JSON.stringify({
    success: true,
    runId,
    sessionId,
    status: state.status,
    tools,
    toolReceipts: state.toolReceipts.length,
    progressEvents: observedEnvelopes.filter(item => item.type === "conversation.progress").length,
    unsentConfirmed: true,
    assistantMessageId: state.assistantMessageId,
  })}\n`);
  await request("shutdown", {});
} finally {
  child.kill("SIGTERM");
  reader.close();
}
