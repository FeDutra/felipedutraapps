import { invariant } from "../domain/contracts.mjs";
import {
  commitSpeechSentences,
  validatePreparedAnswer,
  validateVoiceTracePoint
} from "./voice-contracts.mjs";

const ACTOR = Object.freeze({ type: "system", id: "pulso_core_voice" });

export class SovereignVoiceRuntime {
  constructor({ store, clock = () => new Date().toISOString(), idGenerator = null } = {}) {
    invariant(store, "voice_event_store_required");
    this.store = store;
    this.clock = clock;
    this.sequence = 0;
    this.idGenerator = idGenerator || (prefix => `${prefix}_${Date.now()}_${++this.sequence}`);
    this.sessions = new Map();
    this.turns = new Map();
    this.restore();
  }

  restore() {
    this.sessions.clear();
    this.turns.clear();
    for (const event of this.store.all()) this.#apply(event);
    return this.snapshot();
  }

  openSession({ sessionId, deviceId = null } = {}) {
    invariant(typeof sessionId === "string" && sessionId.trim(), "voice_session_id_required");
    const canonicalId = sessionId.trim();
    if (this.sessions.has(canonicalId)) return this.sessions.get(canonicalId);
    this.#append("voice.session_opened", "voice_session", canonicalId, canonicalId, {
      sessionId: canonicalId,
      deviceId: deviceId || null,
      openedAt: this.clock()
    });
    return this.sessions.get(canonicalId);
  }

  openTurn({ voiceSessionId, turnId, source = "presence" } = {}) {
    invariant(this.sessions.has(voiceSessionId), "voice_session_not_found:" + voiceSessionId);
    invariant(typeof turnId === "string" && turnId.trim(), "voice_turn_id_required");
    const canonicalId = turnId.trim();
    if (this.turns.has(canonicalId)) return this.turns.get(canonicalId);
    this.#append("voice.turn_opened", "voice_turn", canonicalId, canonicalId, {
      voiceSessionId,
      turnId: canonicalId,
      source,
      openedAt: this.clock()
    });
    return this.turns.get(canonicalId);
  }

  finalizeTranscript(turnId, { transcriptId, charCount = 0 } = {}) {
    const turn = this.#requireTurn(turnId);
    invariant(typeof transcriptId === "string" && transcriptId.trim(), "voice_transcript_id_required");
    invariant(Number.isInteger(charCount) && charCount >= 0, "voice_transcript_char_count_invalid");
    this.#append("voice.transcript_finalized", "voice_turn", turnId, turnId, {
      transcriptId: transcriptId.trim(),
      charCount,
      finalizedAt: this.clock()
    });
    return this.turns.get(turnId);
  }

  prepareAnswer(turnId, input) {
    const turn = this.#requireTurn(turnId);
    invariant(turn.transcriptId || input.narrationKind === "approved_acknowledgement", "voice_transcript_not_final");
    const answer = validatePreparedAnswer({ ...input, turnId, preparedAt: input.preparedAt || this.clock() });
    this.#append("voice.answer_prepared", "voice_turn", turnId, turnId, answer);
    return this.turns.get(turnId).preparedAnswers.get(answer.answerId);
  }

  commitAnswer(turnId, answerId, options = {}) {
    const turn = this.#requireTurn(turnId);
    const answer = turn.preparedAnswers.get(answerId);
    invariant(answer, "voice_prepared_answer_not_found:" + answerId);
    const sentences = commitSpeechSentences(answerId, answer.text, options);
    this.#append("voice.sentences_committed", "voice_turn", turnId, turnId, {
      answerId,
      narrationKind: answer.narrationKind,
      sentences,
      committedAt: this.clock()
    });
    return this.turns.get(turnId).committedAnswers.get(answerId);
  }

  startPlayback(turnId, { answerId, sentenceId, playbackEpoch } = {}) {
    const turn = this.#requireTurn(turnId);
    invariant(playbackEpoch === turn.playbackEpoch, "voice_stale_playback_epoch");
    const committed = turn.committedAnswers.get(answerId);
    invariant(committed, "voice_committed_answer_not_found:" + answerId);
    const sentence = committed.sentences.find(item => item.sentenceId === sentenceId);
    invariant(sentence, "voice_committed_sentence_not_found:" + sentenceId);
    this.#append("voice.playback_started", "voice_turn", turnId, turnId, {
      answerId,
      sentenceId,
      sentenceIndex: sentence.index,
      playbackEpoch,
      startedAt: this.clock()
    });
    return this.turns.get(turnId);
  }

  interruptPlayback(turnId, reason = "barge_in") {
    const turn = this.#requireTurn(turnId);
    const nextEpoch = turn.playbackEpoch + 1;
    this.#append("voice.playback_interrupted", "voice_turn", turnId, turnId, {
      playbackEpoch: nextEpoch,
      reason,
      interruptedAt: this.clock()
    });
    return { turn: this.turns.get(turnId), playbackEpoch: nextEpoch };
  }

  recordActionOutcome(turnId, { outcomeId, status, receiptRef = null } = {}) {
    this.#requireTurn(turnId);
    invariant(typeof outcomeId === "string" && outcomeId.trim(), "voice_outcome_id_required");
    invariant(["succeeded", "failed", "cancelled"].includes(status), "voice_outcome_status_invalid");
    this.#append("voice.action_outcome_recorded", "voice_turn", turnId, turnId, {
      outcomeId: outcomeId.trim(),
      status,
      receiptRef,
      recordedAt: this.clock()
    });
    return this.turns.get(turnId).actionOutcomes.get(outcomeId.trim());
  }

  trace(turnId, point) {
    const turn = this.#requireTurn(turnId);
    const validated = validateVoiceTracePoint({
      ...point,
      turnId,
      traceId: point.traceId || this.idGenerator("voice_trace"),
      playbackEpoch: point.playbackEpoch ?? turn.playbackEpoch,
      occurredAt: point.occurredAt || this.clock()
    });
    this.#append("voice.trace_recorded", "voice_turn", turnId, turnId, validated);
    return validated;
  }

  completeTurn(turnId) {
    this.#requireTurn(turnId);
    this.#append("voice.turn_completed", "voice_turn", turnId, turnId, { completedAt: this.clock() });
    return this.turns.get(turnId);
  }

  getTurn(turnId) {
    return this.turns.get(turnId) || null;
  }

  snapshot() {
    return {
      sessions: Array.from(this.sessions.values()),
      turns: Array.from(this.turns.values()).map(turn => this.#publicTurn(turn))
    };
  }

  #requireTurn(turnId) {
    const turn = this.turns.get(turnId);
    invariant(turn, "voice_turn_not_found:" + turnId);
    invariant(turn.status !== "completed", "voice_turn_terminal:" + turnId);
    return turn;
  }

  #append(type, aggregateType, aggregateId, correlationId, payload) {
    const occurredAt = this.clock();
    const event = {
      eventId: this.idGenerator("event"),
      type,
      aggregate: { type: aggregateType, id: aggregateId },
      correlationId,
      causationId: null,
      actor: ACTOR,
      payload,
      occurredAt,
      recordedAt: occurredAt
    };
    const committed = this.store.append([event]).events[0];
    this.#apply(committed);
    return committed;
  }

  #apply(event) {
    const payload = event.payload;
    if (event.type === "voice.session_opened") {
      this.sessions.set(payload.sessionId, { ...payload });
      return;
    }
    if (event.type === "voice.turn_opened") {
      this.turns.set(payload.turnId, {
        turnId: payload.turnId,
        voiceSessionId: payload.voiceSessionId,
        source: payload.source,
        openedAt: payload.openedAt,
        status: "capturing",
        transcriptId: null,
        playbackEpoch: 0,
        preparedAnswers: new Map(),
        committedAnswers: new Map(),
        actionOutcomes: new Map(),
        traces: []
      });
      return;
    }
    const turn = this.turns.get(event.aggregate.id);
    if (!turn) return;
    if (event.type === "voice.transcript_finalized") {
      turn.status = "transcript_final";
      turn.transcriptId = payload.transcriptId;
      turn.transcriptCharCount = payload.charCount;
    } else if (event.type === "voice.answer_prepared") {
      turn.status = "prepared";
      turn.preparedAnswers.set(payload.answerId, payload);
    } else if (event.type === "voice.sentences_committed") {
      turn.status = "committed";
      turn.committedAnswers.set(payload.answerId, payload);
    } else if (event.type === "voice.playback_started") {
      turn.status = "playing";
      turn.activePlayback = payload;
    } else if (event.type === "voice.playback_interrupted") {
      turn.status = "interrupted";
      turn.playbackEpoch = payload.playbackEpoch;
      turn.activePlayback = null;
    } else if (event.type === "voice.action_outcome_recorded") {
      turn.actionOutcomes.set(payload.outcomeId, payload);
    } else if (event.type === "voice.trace_recorded") {
      turn.traces.push(payload);
    } else if (event.type === "voice.turn_completed") {
      turn.status = "completed";
      turn.completedAt = payload.completedAt;
      turn.activePlayback = null;
    }
  }

  #publicTurn(turn) {
    return {
      ...turn,
      preparedAnswers: Array.from(turn.preparedAnswers.values()),
      committedAnswers: Array.from(turn.committedAnswers.values()),
      actionOutcomes: Array.from(turn.actionOutcomes.values()),
      traces: [...turn.traces]
    };
  }
}
