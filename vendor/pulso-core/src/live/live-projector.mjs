export function emptyLiveState() {
  return {
    areas: new Map(),
    sessions: new Map(),
    messages: new Map(),
    messagesBySession: new Map(),
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
        updatedAt: p.updatedAt || event.occurredAt
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
        estado: p.estado || "active",
        createdAt: p.createdAt || event.occurredAt,
        updatedAt: p.updatedAt || event.occurredAt
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
        createdAt: p.createdAt || event.occurredAt
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
