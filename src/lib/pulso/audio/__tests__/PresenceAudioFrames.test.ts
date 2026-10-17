import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
// Node's strip-types runner executes the TypeScript source directly.
// @ts-ignore `allowImportingTsExtensions` is intentionally limited to this test.
const audioFramesModule = await import('../PresenceAudioFrames.ts');
const {
  createPresenceAudioWorkletSource,
  createRealtimeAudioEnvelope,
  PRESENCE_PCM_FRAME_SAMPLES,
  StreamingPcm16Resampler,
} = audioFramesModule;

test('reamostra blocos irregulares sem perder continuidade entre callbacks', () => {
  const sourceRate = 48_000;
  const source = Float32Array.from(
    { length: sourceRate },
    (_, index) => Math.sin((2 * Math.PI * 440 * index) / sourceRate) * 0.5,
  );
  const resampler = new StreamingPcm16Resampler(sourceRate);
  const chunkSizes = [127, 521, 89, 2048, 333, 777];
  const output: number[] = [];
  let offset = 0;
  let chunkIndex = 0;

  while (offset < source.length) {
    const size = chunkSizes[chunkIndex % chunkSizes.length];
    output.push(...resampler.push(source.subarray(offset, Math.min(source.length, offset + size))));
    offset += size;
    chunkIndex += 1;
  }

  assert.ok(Math.abs(output.length - 16_000) <= 1, `amostras produzidas: ${output.length}`);
  assert.ok(Math.max(...output.map(Math.abs)) > 15_000);
  assert.ok(Math.max(...output.map(Math.abs)) < 17_000);
});

test('gera exatamente o envelope PCM aceito pelo relay Gemini', () => {
  const frame = Int16Array.from({ length: PRESENCE_PCM_FRAME_SAMPLES }, (_, index) => index - 160);
  const envelope = createRealtimeAudioEnvelope(frame);
  assert.equal(envelope.realtimeInput.audio.mimeType, 'audio/pcm;rate=16000');
  const bytes = Buffer.from(envelope.realtimeInput.audio.data, 'base64');
  assert.equal(bytes.byteLength, PRESENCE_PCM_FRAME_SAMPLES * Int16Array.BYTES_PER_ELEMENT);
  assert.deepEqual(bytes, Buffer.from(frame.buffer));
});

test('worklet publicado mantém frame de 20 ms e transferência sem cópia', () => {
  const source = createPresenceAudioWorkletSource();
  assert.match(source, /registerProcessor\('pulso-presence-capture'/);
  assert.match(source, /postMessage\(\{ type: 'pcm16', buffer: transferable \}, \[transferable\]\)/);
  assert.match(source, /this\.frameSamples = config\.frameSamples \|\| 320/);
});

test('código real do worklet produz 50 frames PCM por segundo a 48 kHz', () => {
  const frames: ArrayBuffer[] = [];
  let Processor: (new (options: { processorOptions: Record<string, number> }) => {
    process: (inputs: Float32Array[][]) => boolean;
  }) | undefined;
  class AudioWorkletProcessorStub {
    port = {
      postMessage: (message: { buffer: ArrayBuffer }) => frames.push(message.buffer),
    };
  }
  vm.runInNewContext(createPresenceAudioWorkletSource(), {
    AudioWorkletProcessor: AudioWorkletProcessorStub,
    Float32Array,
    Int16Array,
    Math,
    sampleRate: 48_000,
    registerProcessor: (_name: string, constructor: NonNullable<typeof Processor>) => {
      Processor = constructor;
    },
  });

  assert.ok(Processor);
  const processor = new Processor({
    processorOptions: { targetSampleRate: 16_000, frameSamples: 320 },
  });
  const source = Float32Array.from(
    { length: 48_000 },
    (_, index) => Math.sin((2 * Math.PI * 220 * index) / 48_000) * 0.25,
  );
  for (let offset = 0; offset < source.length; offset += 128) {
    processor.process([[source.subarray(offset, Math.min(source.length, offset + 128))]]);
  }

  assert.equal(frames.length, 50);
  assert.ok(frames.every(frame => frame.byteLength === 640));
});
