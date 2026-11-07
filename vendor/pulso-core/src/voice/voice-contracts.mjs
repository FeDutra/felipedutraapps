import { invariant } from "../domain/contracts.mjs";

export const VOICE_NARRATION_KINDS = Object.freeze([
  "approved_acknowledgement",
  "checkpoint",
  "canonical_result"
]);

export const VOICE_TRACE_PHASES = Object.freeze([
  "speech_closed",
  "transcript_final",
  "answer_prepared",
  "sentences_committed",
  "playback_started",
  "playback_interrupted",
  "action_outcome_recorded",
  "turn_completed"
]);

const VOICE_NARRATION_KIND_SET = new Set(VOICE_NARRATION_KINDS);
const VOICE_TRACE_PHASE_SET = new Set(VOICE_TRACE_PHASES);
const FORBIDDEN_TRACE_FIELDS = new Set([
  "audio",
  "audioBase64",
  "content",
  "prompt",
  "response",
  "text",
  "transcript"
]);

function requiredText(value, code) {
  invariant(typeof value === "string" && value.trim().length > 0, code);
  return value.trim();
}

function freezeDeep(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const nested of Object.values(value)) freezeDeep(nested);
  return Object.freeze(value);
}

function splitLongSentence(sentence, maxChars) {
  const parts = [];
  let remaining = sentence.trim();
  while (remaining.length > maxChars) {
    let cut = remaining.lastIndexOf(" ", maxChars);
    if (cut < Math.floor(maxChars * 0.55)) cut = maxChars;
    parts.push(remaining.slice(0, cut).trim());
    remaining = remaining.slice(cut).trim();
  }
  if (remaining) parts.push(remaining);
  return parts;
}

/**
 * Converte texto canônico em unidades de fala imutáveis. O renderer pode
 * sintetizar antecipadamente, mas não pode reescrever uma unidade comprometida.
 */
export function commitSpeechSentences(answerId, text, { maxChars = 240 } = {}) {
  const canonicalAnswerId = requiredText(answerId, "voice_answer_id_required");
  const canonicalText = requiredText(text, "voice_answer_text_required").replace(/\s+/g, " ");
  invariant(Number.isInteger(maxChars) && maxChars >= 80, "voice_sentence_max_chars_invalid");

  const raw = canonicalText.match(/[^.!?]+(?:[.!?]+|$)/g) || [canonicalText];
  const pieces = raw.flatMap(sentence => splitLongSentence(sentence, maxChars)).filter(Boolean);
  return freezeDeep(pieces.map((sentence, index) => ({
    sentenceId: `${canonicalAnswerId}:sentence:${index + 1}`,
    answerId: canonicalAnswerId,
    index,
    text: sentence,
    charCount: sentence.length
  })));
}

export function validatePreparedAnswer(answer) {
  invariant(answer && typeof answer === "object", "voice_prepared_answer_required");
  const narrationKind = requiredText(answer.narrationKind, "voice_narration_kind_required");
  invariant(VOICE_NARRATION_KIND_SET.has(narrationKind), "voice_narration_kind_invalid:" + narrationKind);
  const authorization = answer.authorization;
  invariant(authorization && typeof authorization === "object", "voice_authorization_required");
  const authorityId = requiredText(authorization.authorityId, "voice_authority_id_required");
  const prepared = {
    answerId: requiredText(answer.answerId, "voice_answer_id_required"),
    turnId: requiredText(answer.turnId, "voice_turn_id_required"),
    narrationKind,
    text: requiredText(answer.text, "voice_answer_text_required"),
    authorization: {
      authorityId,
      policy: requiredText(authorization.policy, "voice_authorization_policy_required")
    },
    preparedAt: requiredText(answer.preparedAt, "voice_prepared_at_required")
  };
  return freezeDeep(prepared);
}

/** Telemetria de voz nunca transporta áudio, transcrição ou conteúdo. */
export function validateVoiceTracePoint(point) {
  invariant(point && typeof point === "object", "voice_trace_point_required");
  for (const key of Object.keys(point)) {
    invariant(!FORBIDDEN_TRACE_FIELDS.has(key), "voice_trace_content_forbidden:" + key);
  }
  const phase = requiredText(point.phase, "voice_trace_phase_required");
  invariant(VOICE_TRACE_PHASE_SET.has(phase), "voice_trace_phase_invalid:" + phase);
  invariant(Number.isFinite(point.elapsedMs) && point.elapsedMs >= 0, "voice_trace_elapsed_ms_invalid");
  return freezeDeep({
    traceId: requiredText(point.traceId, "voice_trace_id_required"),
    turnId: requiredText(point.turnId, "voice_turn_id_required"),
    phase,
    elapsedMs: Math.round(point.elapsedMs),
    playbackEpoch: Number.isInteger(point.playbackEpoch) && point.playbackEpoch >= 0
      ? point.playbackEpoch
      : 0,
    sentenceIndex: Number.isInteger(point.sentenceIndex) && point.sentenceIndex >= 0
      ? point.sentenceIndex
      : null,
    occurredAt: requiredText(point.occurredAt, "voice_trace_occurred_at_required")
  });
}
