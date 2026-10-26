import test from "node:test";
import assert from "node:assert/strict";
import { buildLegacySnapshot } from "./lib/pulso-legacy-snapshot.mjs";
import { LegacyImportService, LiveService, SqliteEventStore } from "../vendor/pulso-core/src/index.mjs";

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

test("importação incremental preserva registros existentes e acrescenta somente o que falta", async () => {
  const source = {
    system: "firebase",
    projectId: "project",
    workspaceId: "workspace",
    exportedAt: "2026-10-21T12:00:00.000Z"
  };
  const initial = {
    schemaVersion: 1,
    source,
    areas: [{ id: "area_pulso", nome: "PULSO", glifo: "○", ordem: 1 }],
    sessions: [{ id: "pulso_geral", areaId: "area_pulso", titulo: "Geral" }],
    messages: [{ id: "msg_1", sessionId: "pulso_geral", role: "human", texto: "texto original" }]
  };
  const current = {
    ...initial,
    source: { ...source, exportedAt: "2026-10-26T10:00:00.000Z" },
    sessions: [
      ...initial.sessions,
      { id: "pulso_tv", areaId: "area_pulso", titulo: "PULSO TV" }
    ],
    messages: [
      { ...initial.messages[0], texto: "texto alterado na fonte" },
      { id: "msg_2", sessionId: "pulso_tv", role: "human", texto: "nova conversa" }
    ]
  };
  const store = new SqliteEventStore();
  const live = new LiveService({ store });
  const importer = new LegacyImportService({ live, store });
  await importer.apply(initial);
  const before = store.all().length;
  const first = await importer.apply(current, { reconcileExisting: true });
  const afterFirst = store.all().length;
  const second = await importer.apply(current, { reconcileExisting: true });
  const afterSecond = store.all().length;

  assert.equal(live.listMessages("pulso_geral")[0].texto, "texto original");
  assert.equal(live.listSessions().some(session => session.id === "pulso_tv"), true);
  assert.equal(live.listMessages("pulso_tv")[0].texto, "nova conversa");
  assert.deepEqual(first.reconciliation.added, { areas: 0, sessions: 1, messages: 1 });
  assert.equal(afterFirst - before, 2);
  assert.equal(afterSecond, afterFirst);
  assert.deepEqual(second.reconciliation.added, { areas: 0, sessions: 0, messages: 0 });
  store.close();
});
