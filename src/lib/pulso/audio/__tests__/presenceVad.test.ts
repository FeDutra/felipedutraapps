import assert from 'node:assert/strict';
import test from 'node:test';
// @ts-expect-error Node's strip-types runner executes the TypeScript source directly.
import { analyzePresenceAudio, createPresenceVadState } from '../presenceVad.ts';

const sine = (amplitude: number, length = 1024) => {
  const samples = new Float32Array(length);
  for (let index = 0; index < length; index += 1) {
    samples[index] = Math.sin((index / length) * Math.PI * 16) * amplitude;
  }
  return samples;
};

test('não abre turno com o ruído baixo do microfone interno', () => {
  let state = createPresenceVadState();
  for (let frame = 0; frame < 30; frame += 1) {
    const sample = analyzePresenceAudio(sine(0.0025), state, false);
    state = sample.state;
    assert.equal(sample.speech, false);
  }
});

test('abre turno com fala suave depois de dois quadros', () => {
  let state = createPresenceVadState();
  for (let frame = 0; frame < 20; frame += 1) {
    state = analyzePresenceAudio(sine(0.0025), state, false).state;
  }
  const first = analyzePresenceAudio(sine(0.008), state, false);
  const second = analyzePresenceAudio(sine(0.008), first.state, false);
  assert.equal(first.speech, false);
  assert.equal(second.speech, true);
  assert.ok(second.threshold < 0.006);
});

test('usa limiar de sustentação menor durante a frase', () => {
  const previous = { noiseFloor: 0.0024, speechFrames: 2 };
  const sample = analyzePresenceAudio(sine(0.004), previous, true);
  assert.equal(sample.speech, true);
});

test('não aprende fala clara como piso de ruído', () => {
  const previous = { noiseFloor: 0.002, speechFrames: 0 };
  const sample = analyzePresenceAudio(sine(0.03), previous, false);
  assert.equal(sample.noiseFloor, previous.noiseFloor);
});
