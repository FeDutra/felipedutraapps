import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const livePageUrl = new URL('../src/apps/pulso/pages/LivePage.tsx', import.meta.url);
const rustRecordingUrl = new URL('../src-tauri/src/agent/voice_recording.rs', import.meta.url);
const tauriLibUrl = new URL('../src-tauri/src/lib.rs', import.meta.url);
const ttsAdapterUrl = new URL('../src/lib/pulso/TTSAdapter.ts', import.meta.url);
const presenceTransportUrl = new URL('../src/lib/pulso/audio/PresenceTransport.ts', import.meta.url);

test('gravação comum envia o WAV durável para transcrição no desktop', async () => {
  const source = await readFile(livePageUrl, 'utf8');
  assert.match(source, /voice_recording_finalize/);
  assert.match(source, /voice_recording_read_wav/);
  assert.match(source, /wavArrayBuffer = wavBytes\.buffer\.slice/);
  assert.match(source, /audioBlob = new Blob\(\[wavArrayBuffer\], \{ type: 'audio\/wav' \}\)/);
  assert.match(source, /transcribeAudioBlob\(audioBlob, mode, recordingId\)/);
});

test('comando nativo só lê WAV validado pelo recordingId', async () => {
  const [recordingSource, tauriSource] = await Promise.all([
    readFile(rustRecordingUrl, 'utf8'),
    readFile(tauriLibUrl, 'utf8'),
  ]);
  assert.match(recordingSource, /pub fn voice_recording_read_wav/);
  assert.match(recordingSource, /validate_recording_id\(recording_id\)/);
  assert.match(recordingSource, /bytes\.get\(0\.\.4\) != Some\(b"RIFF"\)/);
  assert.match(recordingSource, /bytes\.get\(8\.\.12\) != Some\(b"WAVE"\)/);
  assert.match(tauriSource, /voice_recording_read_wav/);
});

test('Presença desktop nasce pela rota turn-based e preserva Gemini como escolha explícita', async () => {
  const source = await readFile(presenceTransportUrl, 'utf8');
  assert.match(source, /pulso_presence_transport_migration_v8_turn_based_restore/);
  assert.match(source, /setItem\(PRESENCE_TRANSPORT_STORAGE_KEY, 'turn_based'\)/);
  assert.match(source, /if \(preference === 'turn_based'\) return false/);
});

test('TTS desktop fixa pt-BR e não degrada para voz nativa', async () => {
  const source = await readFile(ttsAdapterUrl, 'utf8');
  assert.match(source, /pulso_tts_migration_v5_desktop_brazilian_voice/);
  assert.match(source, /lang: 'pt-br'/);
  assert.match(source, /requested \?\? !desktopRuntime/);
  assert.match(source, /const allowNativeFallback = resolveNativeTtsFallback/);
});
