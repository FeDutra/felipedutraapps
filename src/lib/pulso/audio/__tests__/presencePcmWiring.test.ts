import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const controllerSource = readFileSync(
  new URL('../VoiceSessionController.ts', import.meta.url),
  'utf8',
);
const livePageSource = readFileSync(
  new URL('../../../../apps/pulso/pages/LivePage.tsx', import.meta.url),
  'utf8',
);

test('o PCM do desktop dirige o VAD diretamente', () => {
  assert.match(
    controllerSource,
    /onaudioprocess[\s\S]*processVadSamples\(input, 'pcm'\)/,
  );
});

test('o analyser assume se o WebKit não entregar quadros PCM', () => {
  assert.match(controllerSource, /presence_pcm_stalled_fallback/);
  assert.match(controllerSource, /startAnalyserVadLoop\(\)/);
});

test('os sinais sonoros são opt-in e nascem desligados', () => {
  assert.match(
    controllerSource,
    /!this\.audioContext \|\| !this\.config\.soundCuesEnabled/,
  );
  assert.match(
    livePageSource,
    /presenceSoundCuesEnabled, setPresenceSoundCuesEnabled\] = React\.useState\(false\)/,
  );
});

test('a Core persiste telemetria do caminho de voz', () => {
  for (const stage of [
    'presence_mic_opened',
    'presence_pcm_ready',
    'presence_audio_frame',
    'presence_vad_speech_start',
    'presence_vad_speech_end',
    'presence_stt_started',
    'presence_stt_finished',
  ]) {
    assert.ok(controllerSource.includes(stage), `telemetria ausente: ${stage}`);
  }
  assert.match(livePageSource, /stage, \.\.\.details/);
});
