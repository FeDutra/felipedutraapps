import test from "node:test";
import assert from "node:assert/strict";
import { buildLegacySnapshot } from "./lib/pulso-legacy-snapshot.mjs";

test("tradutor Firebase gera snapshot canônico sem depender do Core", () => {
  const exportedAt = "2026-10-21T12:00:00.000Z";
  const result = buildLegacySnapshot({
    projectId: "project",
    workspaceId: "workspace",
    exportedAt,
    areaDocs: [{ id: "area_1", data: { name: "PULSO", emoji: "○", order: 1 } }],
    sessionDocs: [{ id: "session_1", data: { areaId: "area_1", label: "geral" } }],
    customContextDocs: [],
    requestDocs: [{ id: "req_1", data: { contextId: "session_1", message: "olá", openclawResult: { responseText: "oi" } } }]
  });
  assert.deepEqual(result.report.migratedCounts, { areas: 1, sessions: 1, messages: 2 });
  assert.deepEqual(result.snapshot.messages.map(message => message.id), ["req_1:human", "req_1:assistant"]);
  assert.equal(result.snapshot.messages[0].sourceId, "req_1");
});

test("tradutor recupera sessão conversacional ausente a partir de requests, mas ignora canárias", () => {
  const exportedAt = "2026-10-21T12:00:00.000Z";
  const result = buildLegacySnapshot({
    projectId: "project",
    workspaceId: "workspace",
    exportedAt,
    areaDocs: [{ id: "area_eu", data: { name: "eu" } }],
    sessionDocs: [],
    requestDocs: [
      { id: "req_real", data: { contextId: "eu_diario", areaId: "area_eu", message: "oi" } },
      { id: "req_canary", data: { contextId: "pulso_birth_canary_1", areaId: "area_eu", message: "teste" } }
    ]
  });
  assert.deepEqual(result.snapshot.sessions.map(session => session.id), ["eu_diario"]);
  assert.equal(result.snapshot.sessions[0].recoveredFromRequests, true);
  assert.deepEqual(result.snapshot.messages.map(message => message.id), ["req_real:human"]);
});
