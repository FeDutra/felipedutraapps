function asIso(value, fallback) {
  if (value?.toDate) return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" && !Number.isNaN(Date.parse(value))) return new Date(value).toISOString();
  return fallback;
}

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function requestText(data) {
  return text(data.message) || text(data.text) || text(data.rawInput) || text(data.input?.text) || text(data.input);
}

function responseText(data) {
  return text(data.openclawResult?.responseText) || text(data.openclawResult?.rawResponse);
}

function isOperationalContext(id) {
  return !id || /(^public_site_|canary|smoke|selector_validation|terminal_canary)/i.test(id);
}

function titleFromContext(id) {
  const tail = id.includes("_") ? id.slice(id.indexOf("_") + 1) : id;
  return tail.replace(/[-_]+/g, " ").trim() || id;
}

function inferAreaId(data, contextId, areaIds) {
  const explicit = text(data.areaId);
  if (areaIds.has(explicit)) return explicit;
  const aliases = [
    ["area_projetos_autorais", "area_criacao"]
  ];
  for (const [prefix, areaId] of aliases) {
    if ((contextId === prefix || contextId.startsWith(prefix + "_")) && areaIds.has(areaId)) return areaId;
  }
  for (const areaId of [...areaIds].sort((a, b) => b.length - a.length)) {
    const prefix = areaId.replace(/^area_/, "");
    if (contextId === prefix || contextId.startsWith(prefix + "_")) return areaId;
  }
  return explicit;
}

export function buildLegacySnapshot({ projectId, workspaceId, exportedAt, areaDocs, sessionDocs, customContextDocs = [], requestDocs }) {
  const areaRecords = [];
  const areaIds = new Set();
  for (const doc of areaDocs) {
    const data = doc.data;
    const id = text(data.id) || doc.id;
    if (!id || !text(data.name)) continue;
    areaIds.add(id);
    areaRecords.push({
      id,
      name: data.name,
      glyph: text(data.emoji) || text(data.icon) || "○",
      order: Number.isFinite(data.order) ? data.order : areaRecords.length,
      archived: data.archived === true,
      createdAt: asIso(data.createdAt, exportedAt),
      updatedAt: asIso(data.updatedAt, exportedAt)
    });
  }

  const sessionRecords = [];
  const sessionIds = new Set();
  const skippedSessions = [];
  for (const doc of [...sessionDocs, ...customContextDocs]) {
    const data = doc.data;
    const id = text(data.id) || text(data.contextId) || doc.id;
    const areaId = inferAreaId(data, id, areaIds);
    const title = text(data.label) || text(data.displayName) || text(data.title);
    if (data.internalCanary === true || text(data.documentKind)) {
      skippedSessions.push({ id, reason: "non_conversation_document" });
      continue;
    }
    if (sessionIds.has(id)) {
      skippedSessions.push({ id, areaId, reason: "duplicate_legacy_session" });
      continue;
    }
    if (!id || !areaIds.has(areaId) || !title) {
      skippedSessions.push({ id: id || doc.id, areaId, reason: "invalid_or_missing_area" });
      continue;
    }
    sessionIds.add(id);
    sessionRecords.push({
      id,
      areaId,
      title,
      archived: data.archived === true || data.status === "archived",
      createdAt: asIso(data.createdAt, exportedAt),
      updatedAt: asIso(data.updatedAt, exportedAt)
    });
  }

  for (const doc of requestDocs) {
    const data = doc.data;
    const id = text(data.contextId) || text(data.chatId);
    const areaId = inferAreaId(data, id, areaIds);
    if (sessionIds.has(id) || isOperationalContext(id) || !areaIds.has(areaId) || data.testOnly === true) continue;
    sessionIds.add(id);
    sessionRecords.push({
      id,
      sourceId: id,
      areaId,
      title: text(data.meta?.sessionLabel) || text(data.sessionLabel) || titleFromContext(id),
      archived: false,
      createdAt: asIso(data.createdAt, asIso(data.requestedAt, exportedAt)),
      updatedAt: asIso(data.updatedAt, exportedAt),
      recoveredFromRequests: true
    });
  }

  const messages = [];
  const skippedRequests = [];
  for (const doc of requestDocs) {
    const data = doc.data;
    if (data.testOnly === true) {
      skippedRequests.push({ id: doc.id, reason: "test_only" });
      continue;
    }
    const sessionId = text(data.contextId) || text(data.chatId);
    if (!sessionIds.has(sessionId)) {
      skippedRequests.push({ id: doc.id, sessionId, reason: "session_not_migrated" });
      continue;
    }
    const human = requestText(data);
    if (!human) {
      skippedRequests.push({ id: doc.id, sessionId, requestType: text(data.requestType) || text(data.type), reason: "empty_human_message" });
      continue;
    }
    const humanAt = asIso(data.createdAt, asIso(data.requestedAt, exportedAt));
    messages.push({ id: `${doc.id}:human`, sourceId: doc.id, sessionId, role: "user", text: human, createdAt: humanAt });
    const assistant = responseText(data);
    if (assistant) {
      messages.push({
        id: `${doc.id}:assistant`,
        sourceId: doc.id,
        sessionId,
        role: "assistant",
        text: assistant,
        createdAt: asIso(data.openclawProcessedAt, asIso(data.updatedAt, humanAt))
      });
    }
  }

  return {
    snapshot: {
      schemaVersion: 1,
      source: { system: "firebase", projectId, workspaceId, exportedAt },
      areas: areaRecords,
      sessions: sessionRecords,
      messages
    },
    report: {
      sourceCounts: { areas: areaDocs.length, sessions: sessionDocs.length, customContexts: customContextDocs.length, requests: requestDocs.length },
      migratedCounts: { areas: areaRecords.length, sessions: sessionRecords.length, messages: messages.length },
      skippedSessions,
      skippedRequests
    }
  };
}
