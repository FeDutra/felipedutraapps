import assert from 'node:assert/strict';
import test from 'node:test';
import type { TTSAdapter } from '../../TTSAdapter';
import type { GeminiLiveConfig } from '../GeminiLiveClient';
import { PreferredVoiceNarrator } from '../PreferredVoiceNarrator';

function createHarness() {
  let config: GeminiLiveConfig | null = null;
  let localSpeakCount = 0;
  const lifecycle: string[] = [];
  const ttsAdapter = {
    normalizeTextForSpeech: (text: string) => text.trim(),
    cancel: () => undefined,
    speak: async (
      _text: string,
      onStart?: () => void,
      onEnd?: () => void,
    ) => {
      localSpeakCount += 1;
      onStart?.();
      onEnd?.();
    },
  } as unknown as TTSAdapter;
  const narrator = new PreferredVoiceNarrator({
    ttsAdapter,
    getAccessToken: async () => 'token',
    createClient: (nextConfig) => {
      config = nextConfig;
      return {
        start: () => nextConfig.onReady?.(),
        stop: () => undefined,
        sendReadingText: () => true,
      };
    },
  });
  const callbacks = {
    onStart: () => lifecycle.push('start'),
    onEnd: () => lifecycle.push('end'),
  };
  return {
    narrator,
    callbacks,
    getConfig: () => config as GeminiLiveConfig,
    getLocalSpeakCount: () => localSpeakCount,
    lifecycle,
  };
}

test('leitura usa Gemini e não prepara Kokoro depois que o áudio começa', () => {
  const harness = createHarness();
  assert.equal(harness.narrator.speak('Texto real.', 'reading-1', harness.callbacks), true);
  const config = harness.getConfig();
  const receipt = { id: 'reading-1', kind: 'reading' as const, text: 'Texto real.', turnId: 'reading-1' };

  config.onNarrationStarted?.(receipt);
  config.onNarrationUnavailable?.({ ...receipt, reason: 'late_error' });
  config.onNarrationFinished?.(receipt);

  assert.deepEqual(harness.lifecycle, ['start', 'end']);
  assert.equal(harness.getLocalSpeakCount(), 0);
});

test('Kokoro assume uma vez quando Gemini falha antes do primeiro áudio', () => {
  const harness = createHarness();
  assert.equal(harness.narrator.speak('Texto real.', 'reading-2', harness.callbacks), true);
  const config = harness.getConfig();
  const receipt = { id: 'reading-2', kind: 'reading' as const, text: 'Texto real.', turnId: 'reading-2' };

  config.onNarrationUnavailable?.({ ...receipt, reason: 'audio_start_timeout' });

  assert.deepEqual(harness.lifecycle, ['start', 'end']);
  assert.equal(harness.getLocalSpeakCount(), 1);
});
