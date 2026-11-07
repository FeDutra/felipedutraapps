import assert from 'node:assert/strict';
import test from 'node:test';
// @ts-expect-error Node's strip-types runner executes TypeScript directly.
import {
  commitSpeechSentences,
  PlaybackEpoch,
  SovereignVoiceTrace,
} from '../SovereignVoiceContract.ts';

test('compromete frases determinísticas sem permitir mutação', () => {
  const sentences = commitSpeechSentences('answer-1', 'Primeira frase. Segunda frase!');
  assert.deepEqual(sentences.map(item => item.sentenceId), [
    'answer-1:sentence:1',
    'answer-1:sentence:2',
  ]);
  assert.equal(sentences[0].text, 'Primeira frase.');
  assert.equal(Object.isFrozen(sentences), true);
  assert.equal(Object.isFrozen(sentences[0]), true);
});

test('barge-in invalida toda reprodução da época anterior', () => {
  const epoch = new PlaybackEpoch();
  const first = epoch.current();
  assert.equal(epoch.accepts(first), true);
  assert.equal(epoch.advance(), 1);
  assert.equal(epoch.accepts(first), false);
  assert.equal(epoch.accepts(1), true);
});

test('trace mede fases por turno sem aceitar conteúdo livre', () => {
  let now = 1_000;
  const trace = new SovereignVoiceTrace(() => now);
  trace.beginTurn('turn-1');
  now = 1_180;
  const point = trace.mark('turn-1', 'transcript_final', 0, { requestBound: false });
  assert.equal(point.turnElapsedMs, 180);
  assert.equal(point.requestBound, false);
  assert.deepEqual(Object.keys(point).sort(), [
    'occurredAt',
    'phase',
    'playbackEpoch',
    'requestBound',
    'traceId',
    'turnElapsedMs',
    'turnId',
  ]);
});
