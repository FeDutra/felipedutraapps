export function emptyLiveState() {
  return {
    areas: new Map(),
    sessions: new Map(),
    messages: new Map(),
    messagesBySession: new Map(),
    conversationRuns: new Map(),
    conversationRunsBySession: new Map(),
    selection: {
      areaId: null,
      sessionId: null,
      selectedAt: null
    }
  };
}

export function applyLiveEvent(state, event) {
  const p = event.payload || {};
  switch (event.type) {
    case "live.area.created": {
      const area = {
        id: event.aggregate.id,
        nome: p.nome,
        glifo: p.glifo,
        ordem: p.ordem ?? 0,
        estado: p.estado || "active",
        createdAt: p.createdAt || event.occurredAt,
        updatedAt: p.updatedAt || event.occurredAt,
        provenance: p.provenance ?? null
      };
      state.areas.set(area.id, area);
      break;
    }
    case "live.session.created": {
      const session = {
        id: event.aggregate.id,
        areaId: p.areaId,
        titulo: p.titulo ?? p.title,
        identityId: p.identityId || "lotus",
        agentId: p.agentId || null,
        estado: p.estado || "active",
        createdAt: p.createdAt || event.occurredAt,
        updatedAt: p.updatedAt || event.occurredAt,
        provenance: p.provenance ?? null
      };
      state.sessions.set(session.id, session);
      if (!state.messagesBySession.has(session.id)) {
        state.messagesBySession.set(session.id, []);
      }
      break;
    }
    case "live.session.selected": {
      state.selection = {
        areaId: p.areaId ?? state.selection.areaId,
        sessionId: p.sessionId ?? null,
        selectedAt: event.occurredAt
      };
      break;
    }
    case "live.message.appended": {
      const message = {
        id: event.aggregate.id,
        sessionId: p.sessionId,
        role: p.role,
        texto: p.texto ?? p.text,
        estado: p.estado || (p.role === "human" ? "awaiting_provider" : "persisted"),
        createdAt: p.createdAt || event.occurredAt,
        agentId: p.agentId || null,
        provenance: p.provenance ?? null
      };
      state.messages.set(message.id, message);
      if (!state.messagesBySession.has(message.sessionId)) {
        state.messagesBySession.set(message.sessionId, []);
      }
      const list = state.messagesBySession.get(message.sessionId);
      if (!list.some(m => m.id === message.id)) {
        list.push(message);
      }
      break;
    }
    case "live.message.state_changed": {
      const existing = state.messages.get(event.aggregate.id);
      if (existing) {
        const updated = { ...existing, estado: p.estado, updatedAt: event.occurredAt };
        state.messages.set(updated.id, updated);
        const list = state.messagesBySession.get(updated.sessionId) || [];
        const index = list.findIndex(item => item.id === updated.id);
        if (index >= 0) list[index] = updated;
      }
      break;
    }
    case "live.conversation_run.created": {
      const run = {
        id: event.aggregate.id,
        sessionId: p.sessionId,
        humanMessageId: p.humanMessageId,
        assistantMessageId: null,
        identityId: p.identityId || "lotus",
        status: p.status || "awaiting_provider",
        accumulatedText: "",
        deltasCount: 0,
        resumedFromRunId: p.resumedFromRunId || null,
        providerId: null,
        model: null,
        receipt: null,
        failure: null,
        createdAt: p.createdAt || event.occurredAt,
        updatedAt: p.createdAt || event.occurredAt,
        startedAt: null,
        completedAt: null
      };
      state.conversationRuns.set(run.id, run);
      if (!state.conversationRunsBySession.has(run.sessionId)) state.conversationRunsBySession.set(run.sessionId, []);
      const list = state.conversationRunsBySession.get(run.sessionId);
      if (!list.includes(run.id)) list.push(run.id);
      break;
    }
    case "live.conversation_run.transitioned": {
      const existing = state.conversationRuns.get(event.aggregate.id);
      if (existing) {
        state.conversationRuns.set(existing.id, {
          ...existing,
          status: p.toStatus,
          providerId: p.providerId ?? existing.providerId,
          model: p.model ?? existing.model,
          failure: p.failure ?? existing.failure,
          startedAt: p.startedAt ?? existing.startedAt,
          completedAt: p.completedAt ?? existing.completedAt,
          updatedAt: event.occurredAt
        });
      }
      break;
    }
    case "live.conversation_run.delta_appended": {
      const existing = state.conversationRuns.get(event.aggregate.id);
      if (existing) {
        state.conversationRuns.set(existing.id, {
          ...existing,
          accumulatedText: existing.accumulatedText + String(p.text || ""),
          deltasCount: existing.deltasCount + 1,
          updatedAt: event.occurredAt
        });
      }
      break;
    }
    case "live.conversation_run.receipt_recorded": {
      const existing = state.conversationRuns.get(event.aggregate.id);
      if (existing) {
        state.conversationRuns.set(existing.id, {
          ...existing,
          assistantMessageId: p.assistantMessageId ?? existing.assistantMessageId,
          providerId: p.providerId ?? existing.providerId,
          model: p.model ?? existing.model,
          receipt: p.receipt ?? existing.receipt,
          updatedAt: event.occurredAt
        });
      }
      break;
    }
  }
  return state;
}

export function projectLive(events, state = emptyLiveState()) {
  for (const event of events) {
    if (event.type.startsWith("live.")) {
      applyLiveEvent(state, event);
    }
  }
  return state;
}
