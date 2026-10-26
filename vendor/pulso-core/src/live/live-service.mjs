import { invariant, pulsoId, now, eventDraft } from "../domain/contracts.mjs";
import {
  LIVE_DEFAULT_IDENTITY,
  LIVE_DEFAULT_SEED,
  validateArea,
  validateSession,
  validateMessage,
  validateSelection
} from "./live-contracts.mjs";
import { emptyLiveState, projectLive, applyLiveEvent } from "./live-projector.mjs";

export class LiveService {
  constructor(options = {}) {
    invariant(options.store, "store_required_for_live_service");
    this.store = options.store;
    this.state = emptyLiveState();
    this.restored = false;
  }

  async restore() {
    const events = this.store.all();
    this.state = emptyLiveState();
    projectLive(events, this.state);
    this.restored = true;
    return this.state;
  }

  async ensureRestored() {
    if (!this.restored) {
      await this.restore();
    }
  }

  getArea(areaId) {
    return this.state.areas.get(areaId) ?? null;
  }

  getSession(sessionId) {
    return this.state.sessions.get(sessionId) ?? null;
  }

  listAreas() {
    return Array.from(this.state.areas.values()).sort((a, b) => {
      if (a.ordem !== b.ordem) return a.ordem - b.ordem;
      return a.createdAt.localeCompare(b.createdAt);
    });
  }

  listSessions(areaId = null) {
    const all = Array.from(this.state.sessions.values());
    const filtered = areaId ? all.filter(s => s.areaId === areaId) : all;
    return filtered.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  listMessages(sessionId) {
    invariant(typeof sessionId === "string" && sessionId.trim().length > 0, "session_id_required");
    invariant(this.state.sessions.has(sessionId), "session_not_found:" + sessionId);
    return Array.from(this.state.messagesBySession.get(sessionId) || []);
  }

  async bootstrap() {
    await this.ensureRestored();

    // If completely empty, apply minimal reversible seed via domain events
    if (this.state.areas.size === 0) {
      const seedAreaId = LIVE_DEFAULT_SEED.area.id;
      const seedSessionId = LIVE_DEFAULT_SEED.session.id;

      await this.createArea({
        id: seedAreaId,
        nome: LIVE_DEFAULT_SEED.area.nome,
        glifo: LIVE_DEFAULT_SEED.area.glifo,
        ordem: LIVE_DEFAULT_SEED.area.ordem,
        estado: LIVE_DEFAULT_SEED.area.estado
      });

      await this.createSession({
        id: seedSessionId,
        areaId: seedAreaId,
        titulo: LIVE_DEFAULT_SEED.session.titulo,
        identityId: LIVE_DEFAULT_IDENTITY,
        estado: LIVE_DEFAULT_SEED.session.estado
      });

      await this.selectSession({
        areaId: seedAreaId,
        sessionId: seedSessionId
      });
    }

    const areas = this.listAreas();
    let activeAreaId = this.state.selection.areaId;
    let activeSessionId = this.state.selection.sessionId;

    // Validate that current selection actually exists; if not, fallback to first available
    if (!activeAreaId || !this.state.areas.has(activeAreaId)) {
      activeAreaId = areas.length > 0 ? areas[0].id : null;
    }

    const sessionsForArea = activeAreaId ? this.listSessions(activeAreaId) : [];
    if (!activeSessionId || !this.state.sessions.has(activeSessionId)) {
      activeSessionId = sessionsForArea.length > 0 ? sessionsForArea[0].id : null;
      if (activeAreaId && activeSessionId) {
        await this.selectSession({ areaId: activeAreaId, sessionId: activeSessionId });
      }
    }

    const messages = activeSessionId ? this.listMessages(activeSessionId) : [];

    return {
      areas,
      sessions: sessionsForArea,
      activeAreaId,
      activeSessionId,
      messages,
      selection: {
        areaId: activeAreaId,
        sessionId: activeSessionId,
        selectedAt: this.state.selection.selectedAt
      }
    };
  }

  async createArea(params = {}, options = {}) {
    await this.ensureRestored();
    const id = params.id || pulsoId("area");
    const validated = validateArea({ ...params, id });

    if (options.idempotencyKey) {
      const existingEntityId = this.store.findIdempotency("live.area", options.idempotencyKey);
      if (existingEntityId) {
        if (params.id && params.id !== existingEntityId) {
          invariant(false, "idempotency_conflict:key_bound_to_different_id:" + existingEntityId);
        }
        const existingArea = this.state.areas.get(existingEntityId);
        invariant(existingArea, "idempotent_area_not_found:" + existingEntityId);
        invariant(existingArea.nome === validated.nome, "idempotency_payload_mismatch:nome");
        invariant(existingArea.glifo === validated.glifo, "idempotency_payload_mismatch:glifo");
        invariant(existingArea.ordem === validated.ordem, "idempotency_payload_mismatch:ordem");
        return existingArea;
      }
    }

    if (this.state.areas.has(validated.id)) {
      invariant(false, "area_already_exists:" + validated.id);
    }

    const draft = eventDraft({
      type: "live.area.created",
      aggregateType: "area",
      aggregateId: validated.id,
      correlationId: options.correlationId || pulsoId("cor"),
      causationId: options.causationId || null,
      actor: { kind: "core", id: "pulso-live" },
      occurredAt: validated.createdAt,
      payload: {
        nome: validated.nome,
        glifo: validated.glifo,
        ordem: validated.ordem,
        estado: validated.estado,
        createdAt: validated.createdAt,
        updatedAt: validated.updatedAt
        ,provenance: validated.provenance
      }
    });

    const appendOpts = {};
    if (options.idempotencyKey) {
      appendOpts.idempotency = {
        scope: "live.area",
        key: options.idempotencyKey,
        entityId: validated.id
      };
    }

    const result = this.store.append([draft], appendOpts);
    if (result.duplicate) {
      const existingArea = this.state.areas.get(result.entityId);
      invariant(existingArea, "idempotent_area_not_found:" + result.entityId);
      invariant(existingArea.nome === validated.nome, "idempotency_payload_mismatch:nome");
      invariant(existingArea.glifo === validated.glifo, "idempotency_payload_mismatch:glifo");
      invariant(existingArea.ordem === validated.ordem, "idempotency_payload_mismatch:ordem");
      return existingArea;
    }

    applyLiveEvent(this.state, draft);
    return this.state.areas.get(validated.id);
  }

  async updateArea(params = {}, options = {}) {
    await this.ensureRestored();
    invariant(typeof params.id === "string" && params.id.trim().length > 0, "area_id_required");
    const id = params.id.trim();
    const existingArea = this.state.areas.get(id);
    invariant(existingArea, "area_not_found:" + id);

    const validated = validateArea({
      ...existingArea,
      ...params,
      id,
      createdAt: existingArea.createdAt,
      updatedAt: params.updatedAt || now(),
      provenance: params.provenance === undefined ? existingArea.provenance : params.provenance,
    });

    const unchanged =
      existingArea.nome === validated.nome &&
      existingArea.glifo === validated.glifo &&
      existingArea.ordem === validated.ordem &&
      existingArea.estado === validated.estado &&
      JSON.stringify(existingArea.provenance ?? null) === JSON.stringify(validated.provenance ?? null);
    if (unchanged && !options.force) return existingArea;

    const draft = eventDraft({
      type: "live.area.updated",
      aggregateType: "area",
      aggregateId: id,
      correlationId: options.correlationId || pulsoId("cor"),
      causationId: options.causationId || null,
      actor: { kind: "core", id: "pulso-live" },
      occurredAt: validated.updatedAt,
      payload: {
        nome: validated.nome,
        glifo: validated.glifo,
        ordem: validated.ordem,
        estado: validated.estado,
        createdAt: existingArea.createdAt,
        updatedAt: validated.updatedAt,
        provenance: validated.provenance,
      },
    });

    const appendOpts = {};
    if (options.idempotencyKey) {
      appendOpts.idempotency = {
        scope: "live.area.update",
        key: options.idempotencyKey,
        entityId: id,
      };
    }

    const result = this.store.append([draft], appendOpts);
    if (!result.duplicate) applyLiveEvent(this.state, draft);
    return this.state.areas.get(id);
  }

  async createSession(params = {}, options = {}) {
    await this.ensureRestored();
    const existingAreaIds = new Set(this.state.areas.keys());
    const id = params.id || pulsoId("session");
    const validated = validateSession({ ...params, id }, existingAreaIds);

    if (options.idempotencyKey) {
      const existingEntityId = this.store.findIdempotency("live.session", options.idempotencyKey);
      if (existingEntityId) {
        if (params.id && params.id !== existingEntityId) {
          invariant(false, "idempotency_conflict:key_bound_to_different_id:" + existingEntityId);
        }
        const existingSession = this.state.sessions.get(existingEntityId);
        invariant(existingSession, "idempotent_session_not_found:" + existingEntityId);
        invariant(existingSession.areaId === validated.areaId, "idempotency_payload_mismatch:areaId");
        invariant(existingSession.titulo === validated.titulo, "idempotency_payload_mismatch:titulo");
        invariant((existingSession.agentId || null) === (validated.agentId || null), "idempotency_payload_mismatch:agentId");
        return existingSession;
      }
    }

    if (this.state.sessions.has(validated.id)) {
      invariant(false, "session_already_exists:" + validated.id);
    }

    const draft = eventDraft({
      type: "live.session.created",
      aggregateType: "session",
      aggregateId: validated.id,
      correlationId: options.correlationId || pulsoId("cor"),
      causationId: options.causationId || null,
      actor: { kind: "core", id: "pulso-live" },
      occurredAt: validated.createdAt,
      payload: {
        areaId: validated.areaId,
        titulo: validated.titulo,
        identityId: validated.identityId,
        agentId: validated.agentId,
        estado: validated.estado,
        createdAt: validated.createdAt,
        updatedAt: validated.updatedAt
        ,provenance: validated.provenance
      }
    });

    const appendOpts = {};
    if (options.idempotencyKey) {
      appendOpts.idempotency = {
        scope: "live.session",
        key: options.idempotencyKey,
        entityId: validated.id
      };
    }

    const result = this.store.append([draft], appendOpts);
    if (result.duplicate) {
      const existingSession = this.state.sessions.get(result.entityId);
      invariant(existingSession, "idempotent_session_not_found:" + result.entityId);
      invariant(existingSession.areaId === validated.areaId, "idempotency_payload_mismatch:areaId");
      invariant(existingSession.titulo === validated.titulo, "idempotency_payload_mismatch:titulo");
      invariant((existingSession.agentId || null) === (validated.agentId || null), "idempotency_payload_mismatch:agentId");
      return existingSession;
    }

    applyLiveEvent(this.state, draft);
    return this.state.sessions.get(validated.id);
  }

  async selectSession(params = {}, options = {}) {
    await this.ensureRestored();
    const existingAreaIds = new Set(this.state.areas.keys());
    const existingSessionIds = new Set(this.state.sessions.keys());

    let areaId = params.areaId || null;
    const sessionId = params.sessionId || null;

    if (sessionId) {
      invariant(existingSessionIds.has(sessionId), "selection_session_not_found:" + sessionId);
      const session = this.state.sessions.get(sessionId);
      if (areaId) {
        invariant(session.areaId === areaId, "session_area_mismatch:" + sessionId + " not in " + areaId);
      } else {
        areaId = session.areaId;
      }
    }

    if (areaId) {
      invariant(existingAreaIds.has(areaId), "selection_area_not_found:" + areaId);
    }

    const validated = validateSelection({ areaId, sessionId }, existingAreaIds, existingSessionIds);

    const draft = eventDraft({
      type: "live.session.selected",
      aggregateType: "selection",
      aggregateId: "active_selection",
      correlationId: options.correlationId || pulsoId("cor"),
      causationId: options.causationId || null,
      actor: { kind: "core", id: "pulso-live" },
      occurredAt: validated.selectedAt,
      payload: {
        areaId: validated.areaId,
        sessionId: validated.sessionId
      }
    });

    this.store.append([draft]);
    applyLiveEvent(this.state, draft);

    const messages = validated.sessionId ? this.listMessages(validated.sessionId) : [];
    return {
      areaId: validated.areaId,
      sessionId: validated.sessionId,
      messages
    };
  }

  async appendMessage(params = {}, options = {}) {
    await this.ensureRestored();
    const existingSessionIds = new Set(this.state.sessions.keys());
    const id = params.id || pulsoId("msg");
    const validated = validateMessage({ ...params, id }, existingSessionIds);

    if (options.idempotencyKey) {
      const existingEntityId = this.store.findIdempotency("live.message", options.idempotencyKey);
      if (existingEntityId) {
        if (params.id && params.id !== existingEntityId) {
          invariant(false, "idempotency_conflict:key_bound_to_different_id:" + existingEntityId);
        }
        const existingMsg = this.state.messages.get(existingEntityId);
        invariant(existingMsg, "idempotent_message_not_found:" + existingEntityId);
        invariant(existingMsg.sessionId === validated.sessionId, "idempotency_payload_mismatch:sessionId");
        invariant(existingMsg.role === validated.role, "idempotency_payload_mismatch:role");
        invariant(existingMsg.texto === validated.texto, "idempotency_payload_mismatch:texto");
        return {
          message: existingMsg,
          receipt: {
            status: existingMsg.estado,
            messageId: existingMsg.id,
            sessionId: existingMsg.sessionId
          }
        };
      }
    }

    if (this.state.messages.has(validated.id)) {
      invariant(false, "message_already_exists:" + validated.id);
    }

    let actor;
    if (validated.role === "human") {
      actor = { kind: "human", id: "fe" };
    } else if (validated.role === "assistant") {
      actor = { kind: "identity", id: "lotus" };
    } else {
      actor = { kind: "core", id: "pulso-live" };
    }

    const draft = eventDraft({
      type: "live.message.appended",
      aggregateType: "message",
      aggregateId: validated.id,
      correlationId: options.correlationId || pulsoId("cor"),
      causationId: options.causationId || null,
      actor,
      occurredAt: validated.createdAt,
      payload: {
        sessionId: validated.sessionId,
        role: validated.role,
        texto: validated.texto,
        estado: validated.estado,
        agentId: validated.agentId,
        createdAt: validated.createdAt
        ,provenance: validated.provenance
      }
    });

    const appendOpts = {};
    if (options.idempotencyKey) {
      appendOpts.idempotency = {
        scope: "live.message",
        key: options.idempotencyKey,
        entityId: validated.id
      };
    }

    const result = this.store.append([draft], appendOpts);
    if (result.duplicate) {
      const existingMsg = this.state.messages.get(result.entityId);
      invariant(existingMsg, "idempotent_message_not_found:" + result.entityId);
      invariant(existingMsg.sessionId === validated.sessionId, "idempotency_payload_mismatch:sessionId");
      invariant(existingMsg.role === validated.role, "idempotency_payload_mismatch:role");
      invariant(existingMsg.texto === validated.texto, "idempotency_payload_mismatch:texto");
      return {
        message: existingMsg,
        receipt: {
          status: existingMsg.estado,
          messageId: existingMsg.id,
          sessionId: existingMsg.sessionId
        }
      };
    }

    applyLiveEvent(this.state, draft);
    const savedMsg = this.state.messages.get(validated.id);

    return {
      message: savedMsg,
      receipt: {
        status: savedMsg.estado,
        messageId: savedMsg.id,
        sessionId: savedMsg.sessionId
      }
    };
  }
}
