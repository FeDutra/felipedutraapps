import { invariant, pulsoId, now } from "../domain/contracts.mjs";

export const LIVE_DEFAULT_IDENTITY = "lotus";

export const LIVE_MESSAGE_ROLES = Object.freeze(["human", "assistant", "system"]);
export const LIVE_MESSAGE_ROLE_SET = new Set(LIVE_MESSAGE_ROLES);

export const LIVE_ENTITY_STATES = Object.freeze(["active", "archived"]);
export const LIVE_ENTITY_STATE_SET = new Set(LIVE_ENTITY_STATES);

export const LIVE_MESSAGE_STATES = Object.freeze(["persisted", "awaiting_provider"]);
export const LIVE_MESSAGE_STATE_SET = new Set(LIVE_MESSAGE_STATES);

export const LIVE_CONVERSATION_RUN_STATES = Object.freeze([
  "awaiting_provider",
  "queued",
  "streaming",
  "completed",
  "failed",
  "cancelled",
  "interrupted"
]);
export const LIVE_CONVERSATION_RUN_STATE_SET = new Set(LIVE_CONVERSATION_RUN_STATES);
export const LIVE_CONVERSATION_RUN_TERMINAL = new Set([
  "completed",
  "failed",
  "cancelled",
  "interrupted"
]);
export const LIVE_CONVERSATION_RUN_TRANSITIONS = Object.freeze({
  awaiting_provider: Object.freeze(["queued", "failed", "cancelled"]),
  queued: Object.freeze(["streaming", "failed", "cancelled"]),
  streaming: Object.freeze(["completed", "failed", "cancelled", "interrupted"]),
  completed: Object.freeze([]),
  failed: Object.freeze([]),
  cancelled: Object.freeze([]),
  interrupted: Object.freeze([])
});

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

function requiredText(value, code) {
  invariant(typeof value === "string" && value.trim().length > 0, code);
  return value.trim();
}

function optionalText(value, code) {
  if (value === null || value === undefined) return null;
  return requiredText(value, code);
}

function freezeDeep(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const item of Object.values(value)) freezeDeep(item);
  return Object.freeze(value);
}

export function assertConversationRunTransition(fromStatus, toStatus) {
  invariant(LIVE_CONVERSATION_RUN_STATE_SET.has(fromStatus), "invalid_conversation_run_status:" + fromStatus);
  invariant(LIVE_CONVERSATION_RUN_STATE_SET.has(toStatus), "invalid_conversation_run_status:" + toStatus);
  invariant(
    LIVE_CONVERSATION_RUN_TRANSITIONS[fromStatus].includes(toStatus),
    `invalid_conversation_run_transition:${fromStatus}->${toStatus}`
  );
  return true;
}

export function validateConversationRun(run) {
  invariant(run && typeof run === "object", "conversation_run_object_required");
  const status = run.status || "awaiting_provider";
  invariant(LIVE_CONVERSATION_RUN_STATE_SET.has(status), "invalid_conversation_run_status:" + status);
  const identityId = run.identityId || LIVE_DEFAULT_IDENTITY;
  invariant(identityId === LIVE_DEFAULT_IDENTITY, "sovereign_identity_must_be_lotus");
  invariant(Number.isInteger(run.deltasCount ?? 0) && (run.deltasCount ?? 0) >= 0, "conversation_run_deltas_count_invalid");
  invariant(typeof run.accumulatedText === "string" || run.accumulatedText === undefined, "conversation_run_accumulated_text_invalid");

  const validated = {
    id: requiredText(run.id, "conversation_run_id_required"),
    sessionId: requiredText(run.sessionId, "conversation_run_session_id_required"),
    humanMessageId: requiredText(run.humanMessageId, "conversation_run_human_message_id_required"),
    assistantMessageId: optionalText(run.assistantMessageId, "conversation_run_assistant_message_id_invalid"),
    identityId: LIVE_DEFAULT_IDENTITY,
    status,
    accumulatedText: run.accumulatedText || "",
    deltasCount: run.deltasCount ?? 0,
    resumedFromRunId: optionalText(run.resumedFromRunId, "conversation_run_resumed_from_invalid"),
    providerId: optionalText(run.providerId, "conversation_run_provider_id_invalid"),
    model: optionalText(run.model, "conversation_run_model_invalid"),
    receipt: run.receipt ? structuredClone(run.receipt) : null,
    failure: run.failure ? structuredClone(run.failure) : null,
    createdAt: requiredText(run.createdAt, "conversation_run_created_at_required"),
    updatedAt: requiredText(run.updatedAt, "conversation_run_updated_at_required"),
    startedAt: optionalText(run.startedAt, "conversation_run_started_at_invalid"),
    completedAt: optionalText(run.completedAt, "conversation_run_completed_at_invalid")
  };
  if (status === "completed") {
    invariant(validated.assistantMessageId, "completed_conversation_run_requires_assistant_message");
    invariant(validated.receipt, "completed_conversation_run_requires_receipt");
    invariant(validated.completedAt, "terminal_conversation_run_requires_completed_at");
  }
  if (LIVE_CONVERSATION_RUN_TERMINAL.has(status)) {
    invariant(validated.completedAt, "terminal_conversation_run_requires_completed_at");
  }
  return freezeDeep(validated);
}
