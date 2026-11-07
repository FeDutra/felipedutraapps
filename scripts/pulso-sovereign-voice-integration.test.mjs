import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const geminiSourceUrl = new URL(
  "../src/lib/pulso/audio/GeminiLiveClient.ts",
  import.meta.url
);
const controllerSourceUrl = new URL(
  "../src/lib/pulso/audio/VoiceSessionController.ts",
  import.meta.url
);

test("transcrição final produz um único recibo e deixa o trace centralizado", async () => {
  const source = await readFile(geminiSourceUrl, "utf8");
  const receiptCount = source.match(/receipt\('transcript_final'/g)?.length ?? 0;
  assert.equal(receiptCount, 1);
  assert.doesNotMatch(
    source,
    /voiceTrace\.mark\([\s\S]{0,160}['"]transcript_final['"]/
  );
  assert.match(source, /phase === 'transcript_final'/);
});

test("timeout e cancelamento sem áudio avançam época sem falso barge-in", async () => {
  const source = await readFile(geminiSourceUrl, "utf8");
  assert.match(source, /this\.flushPlayback\(reason === 'interrupted_before_audio' \? 'barge_in' : 'timeout'\)/);
  assert.match(source, /this\.flushPlayback\('cancel'\)/);
  assert.match(source, /const hadActiveAudio = this\.narrationAudioStarted \|\| this\.playbackSources\.size > 0/);
  assert.match(source, /\(reason === 'barge_in' \|\| reason === 'cancel'\)[\s\S]{0,120}&& hadActiveAudio/);
});

test("barge-in real invalida a época anterior nas duas rotas de voz", async () => {
  const [gemini, controller] = await Promise.all([
    readFile(geminiSourceUrl, "utf8"),
    readFile(controllerSourceUrl, "utf8"),
  ]);
  assert.match(gemini, /this\.flushPlayback\('barge_in'\)/);
  assert.match(gemini, /const playbackEpoch = this\.playbackEpoch\.advance\(\)/);
  assert.match(gemini, /!this\.playbackEpoch\.accepts\(epoch\)/);
  assert.match(controller, /this\.playbackEpoch\.advance\(\)/);
  assert.match(controller, /!this\.playbackEpoch\.accepts\(next\.playbackEpoch\)/);
});
