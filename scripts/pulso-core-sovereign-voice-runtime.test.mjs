import test from "node:test";
import assert from "node:assert/strict";
import {
  SqliteEventStore,
  SovereignVoiceRuntime,
  commitSpeechSentences,
  validateVoiceTracePoint
} from "../vendor/pulso-core/src/index.mjs";

function fixture(store = new SqliteEventStore(":memory:")) {
  let tick = 0;
  let sequence = 0;
  const clock = () => new Date(Date.parse("2026-11-07T20:00:00.000Z") + tick++ * 10).toISOString();
  const runtime = new SovereignVoiceRuntime({
    store,
    clock,
    idGenerator: prefix => `${prefix}_test_${++sequence}`
  });
  runtime.openSession({ sessionId: "voice_session_1", deviceId: "imac" });
  runtime.openTurn({ voiceSessionId: "voice_session_1", turnId: "voice_turn_1" });
  return { store, runtime };
}

test("frases comprometidas são determinísticas e imutáveis", () => {
  const sentences = commitSpeechSentences(
    "answer_1",
    "Primeira frase. Segunda frase que também precisa permanecer canônica!"
  );
  assert.deepEqual(sentences.map(item => item.sentenceId), [
    "answer_1:sentence:1",
    "answer_1:sentence:2"
  ]);
  assert.equal(sentences[0].text, "Primeira frase.");
  assert.equal(Object.isFrozen(sentences), true);
  assert.equal(Object.isFrozen(sentences[0]), true);
});

test("resposta precisa de autoridade explícita antes do compromisso vocal", () => {
  const { runtime } = fixture();
  runtime.finalizeTranscript("voice_turn_1", { transcriptId: "transcript_1", charCount: 28 });
  assert.throws(() => runtime.prepareAnswer("voice_turn_1", {
    answerId: "answer_1",
    narrationKind: "canonical_result",
    text: "Resultado real.",
    authorization: { authorityId: "", policy: "canonical_result" }
  }), /voice_authority_id_required/);

  const prepared = runtime.prepareAnswer("voice_turn_1", {
    answerId: "answer_1",
    narrationKind: "canonical_result",
    text: "Resultado real.",
    authorization: { authorityId: "lotus", policy: "canonical_result" }
  });
  assert.equal(prepared.authorization.authorityId, "lotus");
  const committed = runtime.commitAnswer("voice_turn_1", "answer_1");
  assert.equal(committed.sentences.length, 1);
});

test("época de reprodução invalida áudio antigo após barge-in", () => {
  const { runtime } = fixture();
  runtime.finalizeTranscript("voice_turn_1", { transcriptId: "transcript_1" });
  runtime.prepareAnswer("voice_turn_1", {
    answerId: "answer_1",
    narrationKind: "canonical_result",
    text: "Uma frase.",
    authorization: { authorityId: "lotus", policy: "canonical_result" }
  });
  const committed = runtime.commitAnswer("voice_turn_1", "answer_1");
  runtime.startPlayback("voice_turn_1", {
    answerId: "answer_1",
    sentenceId: committed.sentences[0].sentenceId,
    playbackEpoch: 0
  });
  const interruption = runtime.interruptPlayback("voice_turn_1");
  assert.equal(interruption.playbackEpoch, 1);
  assert.throws(() => runtime.startPlayback("voice_turn_1", {
    answerId: "answer_1",
    sentenceId: committed.sentences[0].sentenceId,
    playbackEpoch: 0
  }), /voice_stale_playback_epoch/);
});

test("interrupção da fala não apaga o resultado durável da ação", () => {
  const { runtime } = fixture();
  runtime.interruptPlayback("voice_turn_1");
  const outcome = runtime.recordActionOutcome("voice_turn_1", {
    outcomeId: "outcome_1",
    status: "succeeded",
    receiptRef: "receipt_1"
  });
  assert.equal(outcome.status, "succeeded");
  assert.equal(runtime.getTurn("voice_turn_1").status, "interrupted");
  assert.equal(runtime.getTurn("voice_turn_1").actionOutcomes.get("outcome_1").receiptRef, "receipt_1");
});

test("telemetria bloqueia conteúdo e restaura estado apenas pelos eventos", () => {
  const { store, runtime } = fixture();
  assert.throws(() => validateVoiceTracePoint({
    traceId: "trace_bad",
    turnId: "voice_turn_1",
    phase: "transcript_final",
    elapsedMs: 12,
    occurredAt: "2026-11-07T20:00:00.000Z",
    transcript: "segredo"
  }), /voice_trace_content_forbidden:transcript/);

  runtime.trace("voice_turn_1", { phase: "speech_closed", elapsedMs: 120 });
  runtime.recordActionOutcome("voice_turn_1", {
    outcomeId: "outcome_restore",
    status: "succeeded"
  });
  const restored = new SovereignVoiceRuntime({ store });
  assert.equal(restored.getTurn("voice_turn_1").traces.length, 1);
  assert.equal(restored.getTurn("voice_turn_1").actionOutcomes.get("outcome_restore").status, "succeeded");
});
