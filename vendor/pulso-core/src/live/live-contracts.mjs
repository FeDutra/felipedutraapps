import { invariant, pulsoId, now } from "../domain/contracts.mjs";

export const LIVE_DEFAULT_IDENTITY = "lotus";

export const LIVE_MESSAGE_ROLES = Object.freeze(["human", "assistant", "system"]);
export const LIVE_MESSAGE_ROLE_SET = new Set(LIVE_MESSAGE_ROLES);

export const LIVE_ENTITY_STATES = Object.freeze(["active", "archived"]);
export const LIVE_ENTITY_STATE_SET = new Set(LIVE_ENTITY_STATES);

export const LIVE_MESSAGE_STATES = Object.freeze(["persisted", "awaiting_provider"]);
export const LIVE_MESSAGE_STATE_SET = new Set(LIVE_MESSAGE_STATES);

export const LIVE_DEFAULT_SEED = Object.freeze({
  area: Object.freeze({
    id: "area_pulso",
    nome: "PULSO",
    glifo: "○",
    ordem: 0,
    estado: "active"
  }),
  session: Object.freeze({
    id: "session_geral",
    areaId: "area_pulso",
    titulo: "geral",
    identityId: LIVE_DEFAULT_IDENTITY,
    estado: "active"
  })
});

export function validateArea(area) {
  invariant(area && typeof area === "object", "area_object_required");
  invariant(typeof area.id === "string" && area.id.trim().length > 0, "area_id_required");
  invariant(typeof area.nome === "string" && area.nome.trim().length > 0, "area_nome_required");
  invariant(typeof area.glifo === "string" && area.glifo.trim().length > 0, "area_glifo_required");
  invariant(typeof area.ordem === "number" && Number.isFinite(area.ordem), "area_ordem_numeric");
  const estado = area.estado || "active";
  invariant(LIVE_ENTITY_STATE_SET.has(estado), "invalid_area_estado:" + estado);
  const timestamp = area.createdAt || now();
  return {
    id: area.id.trim(),
    nome: area.nome.trim(),
    glifo: area.glifo.trim(),
    ordem: area.ordem,
    estado,
    createdAt: timestamp,
    updatedAt: area.updatedAt || timestamp
  };
}

export function validateSession(session, existingAreaIds = null) {
  invariant(session && typeof session === "object", "session_object_required");
  invariant(typeof session.id === "string" && session.id.trim().length > 0, "session_id_required");
  invariant(typeof session.areaId === "string" && session.areaId.trim().length > 0, "session_area_id_required");
  if (existingAreaIds) {
    invariant(existingAreaIds.has(session.areaId.trim()), "session_area_not_found:" + session.areaId);
  }
  const titulo = session.titulo ?? session.title;
  invariant(typeof titulo === "string" && titulo.trim().length > 0, "session_titulo_required");
  const identityId = session.identityId || LIVE_DEFAULT_IDENTITY;
  invariant(identityId === LIVE_DEFAULT_IDENTITY, "sovereign_identity_must_be_lotus");
  const estado = session.estado || "active";
  invariant(LIVE_ENTITY_STATE_SET.has(estado), "invalid_session_estado:" + estado);
  const timestamp = session.createdAt || now();
  return {
    id: session.id.trim(),
    areaId: session.areaId.trim(),
    titulo: titulo.trim(),
    identityId: LIVE_DEFAULT_IDENTITY,
    estado,
    createdAt: timestamp,
    updatedAt: session.updatedAt || timestamp
  };
}

export function validateMessage(message, existingSessionIds = null) {
  invariant(message && typeof message === "object", "message_object_required");
  invariant(typeof message.id === "string" && message.id.trim().length > 0, "message_id_required");
  invariant(typeof message.sessionId === "string" && message.sessionId.trim().length > 0, "message_session_id_required");
  if (existingSessionIds) {
    invariant(existingSessionIds.has(message.sessionId.trim()), "message_session_not_found:" + message.sessionId);
  }
  invariant(LIVE_MESSAGE_ROLE_SET.has(message.role), "invalid_message_role:" + message.role);
  const texto = message.texto ?? message.text;
  invariant(typeof texto === "string" && texto.trim().length > 0, "message_texto_required");
  const estado = message.estado || (message.role === "human" ? "awaiting_provider" : "persisted");
  invariant(LIVE_MESSAGE_STATE_SET.has(estado), "invalid_message_estado:" + estado);
  const timestamp = message.createdAt || now();
  return {
    id: message.id.trim(),
    sessionId: message.sessionId.trim(),
    role: message.role,
    texto: texto.trim(),
    estado,
    createdAt: timestamp
  };
}

export function validateSelection(selection, existingAreaIds = null, existingSessionIds = null) {
  invariant(selection && typeof selection === "object", "selection_object_required");
  if (selection.areaId !== null && selection.areaId !== undefined) {
    invariant(typeof selection.areaId === "string" && selection.areaId.trim().length > 0, "invalid_selection_area_id");
    if (existingAreaIds) {
      invariant(existingAreaIds.has(selection.areaId.trim()), "selection_area_not_found:" + selection.areaId);
    }
  }
  if (selection.sessionId !== null && selection.sessionId !== undefined) {
    invariant(typeof selection.sessionId === "string" && selection.sessionId.trim().length > 0, "invalid_selection_session_id");
    if (existingSessionIds) {
      invariant(existingSessionIds.has(selection.sessionId.trim()), "selection_session_not_found:" + selection.sessionId);
    }
  }
  const timestamp = selection.selectedAt || now();
  return {
    areaId: selection.areaId ? selection.areaId.trim() : null,
    sessionId: selection.sessionId ? selection.sessionId.trim() : null,
    selectedAt: timestamp
  };
}
