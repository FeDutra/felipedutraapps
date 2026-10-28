#!/usr/bin/env node

import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { agentToolGrantMatrix } from "./agent-tool-grant-matrix.mjs";

const required = ["PULSO_NODE_BIN", "PULSO_BRIDGE_PATH", "PULSO_DATA_DIR", "PULSO_CODEX_BIN"];
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
  if (response.ok) entry.resolve(response.result);
  else entry.reject(Object.assign(new Error(response.error?.message || response.error?.code), { code: response.error?.code }));
});

function request(method, params = {}) {
  const requestId = `grant_matrix_${++sequence}`;
  child.stdin.write(`${JSON.stringify({ requestId, method, params })}\n`);
  return new Promise((resolve, reject) => pending.set(requestId, { resolve, reject }));
}

try {
  await request("bootstrap");
  const agents = await request("agent.list", { resource: "agents" });
  const known = new Set(agents.map(agent => agent.agentId));
  const applied = [];
  for (const [agentId, capabilities] of Object.entries(agentToolGrantMatrix)) {
    if (!known.has(agentId)) throw new Error(`grant_matrix_agent_missing:${agentId}`);
    for (const capability of capabilities) {
      const slug = capability.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 96);
      const result = await request("agent.capability.grant", {
        grantId: `grant_${agentId}_${slug}`,
        agentId,
        capability,
        effect: "allow",
        scope: { type: "global", scopeId: "*" },
        grantedBy: { kind: "human", id: "fe" },
        idempotencyKey: `integral:grant:${agentId}:${capability}`,
      });
      applied.push({ agentId, capability, duplicate: result.duplicate === true });
    }
  }
  const grants = await request("agent.capability.list", {});
  process.stdout.write(`${JSON.stringify({
    success: true,
    agents: Object.keys(agentToolGrantMatrix).length,
    applied: applied.length,
    totalGrants: grants.length,
    duplicates: applied.filter(item => item.duplicate).length,
  })}\n`);
  await request("shutdown", {});
} finally {
  child.kill("SIGTERM");
  reader.close();
}
