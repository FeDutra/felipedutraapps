#!/usr/bin/env node

import { spawn } from "node:child_process";
import { createInterface } from "node:readline";

const binary = process.env.PULSO_CODEX_BIN;
const codexHome = process.env.CODEX_HOME;
const workspace = process.env.PULSO_CANARY_WORKSPACE || process.cwd();
if (!binary || !codexHome) throw new Error("PULSO_CODEX_BIN and CODEX_HOME are required");

const child = spawn(binary, ["app-server", "--listen", "stdio://"], {
  cwd: workspace,
  env: { ...process.env, CODEX_HOME: codexHome },
  stdio: ["pipe", "pipe", "inherit"],
});
const reader = createInterface({ input: child.stdout });
let sequence = 0;
const pending = new Map();
let toolCalls = 0;
let finalText = "";

function write(message) {
  child.stdin.write(`${JSON.stringify(message)}\n`);
}

function request(method, params) {
  const id = String(++sequence);
  write({ id, method, params });
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

reader.on("line", line => {
  const message = JSON.parse(line);
  if (message.id !== undefined && (message.result !== undefined || message.error !== undefined) && !message.method) {
    const entry = pending.get(String(message.id));
    if (!entry) return;
    pending.delete(String(message.id));
    if (message.error) entry.reject(new Error(message.error.message || "rpc_error"));
    else entry.resolve(message.result);
    return;
  }
  if (message.method === "item/tool/call" && message.id !== undefined) {
    toolCalls += 1;
    const ok = message.params?.tool === "pulso_canary_echo" && message.params?.arguments?.value === "ok";
    write({
      id: message.id,
      result: {
        success: ok,
        contentItems: [{ type: "inputText", text: ok ? "ECHO_OK" : "ECHO_INVALID" }],
      },
    });
    return;
  }
  if (message.method === "item/agentMessage/delta") finalText += String(message.params?.delta || "");
});

try {
  await request("initialize", {
    clientInfo: { name: "pulso_dynamic_tool_canary", title: "PULSO Dynamic Tool Canary", version: "1.0.0" },
    capabilities: { experimentalApi: true },
  });
  write({ method: "initialized", params: {} });
  const thread = await request("thread/start", {
    cwd: workspace,
    sandbox: "read-only",
    approvalPolicy: "never",
    ephemeral: true,
    dynamicTools: [{
      type: "function",
      name: "pulso_canary_echo",
      description: "Eco determinístico para provar o protocolo de ferramenta dinâmica.",
      inputSchema: {
        type: "object",
        properties: { value: { type: "string" } },
        required: ["value"],
        additionalProperties: false,
      },
    }],
  });
  const threadId = thread?.thread?.id;
  await request("turn/start", {
    threadId,
    input: [{ type: "text", text: "Use obrigatoriamente pulso_canary_echo uma vez com value igual a ok. Depois responda apenas CANARIA_OK." }],
    approvalPolicy: "never",
  });
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline && !/CANARIA_OK/.test(finalText)) await new Promise(resolve => setTimeout(resolve, 250));
  if (toolCalls !== 1 || !/CANARIA_OK/.test(finalText)) throw new Error(`dynamic_tool_canary_failed:${toolCalls}:${finalText.slice(0, 200)}`);
  process.stdout.write(`${JSON.stringify({ success: true, toolCalls, finalText: finalText.trim() })}\n`);
} finally {
  child.kill();
  reader.close();
}
