const fs = require('fs');
const { WebSocket } = require('ws');

const FRAME_BYTES = 320 * 2;
const FRAME_INTERVAL_MS = 20;
const SILENCE_FRAMES = 40;
const TIMEOUT_MS = 20_000;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function realtimeAudioFrame(buffer) {
  return JSON.stringify({
    realtimeInput: {
      audio: {
        data: buffer.toString('base64'),
        mimeType: 'audio/pcm;rate=16000',
      },
    },
  });
}

async function main() {
  const pcmPath = process.env.PCM_FILE;
  const relayUrl = process.env.RELAY_URL;
  if (!pcmPath || !relayUrl) throw new Error('PCM_FILE e RELAY_URL são obrigatórias.');

  const pcm = fs.readFileSync(pcmPath);
  const startedAt = Date.now();
  const evidence = {
    connectedMs: null,
    setupMs: null,
    inputTranscriptMs: null,
    inputTranscriptChars: 0,
    firstAudioMs: null,
    audioChunks: 0,
    turnCompleteMs: null,
  };

  await new Promise((resolve, reject) => {
    const ws = new WebSocket(relayUrl);
    const timeout = setTimeout(() => finish(new Error('pcm canary timeout')), TIMEOUT_MS);
    let finished = false;

    const finish = (error) => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      if (ws.readyState < WebSocket.CLOSING) ws.close(1000, 'pcm canary complete');
      if (error) reject(error);
      else resolve();
    };

    const streamPcm = async () => {
      for (let offset = 0; offset < pcm.length; offset += FRAME_BYTES) {
        const frame = pcm.subarray(offset, Math.min(offset + FRAME_BYTES, pcm.length));
        if (frame.length === FRAME_BYTES) ws.send(realtimeAudioFrame(frame));
        await delay(FRAME_INTERVAL_MS);
      }
      const silence = Buffer.alloc(FRAME_BYTES);
      for (let index = 0; index < SILENCE_FRAMES; index += 1) {
        ws.send(realtimeAudioFrame(silence));
        await delay(FRAME_INTERVAL_MS);
      }
    };

    ws.on('open', () => {
      evidence.connectedMs = Date.now() - startedAt;
      ws.send(JSON.stringify({
        setup: {
          model: 'models/gemini-3.8-live',
          systemInstruction: {
            parts: [{ text: 'Responda em português brasileiro com uma única confirmação curta.' }],
          },
          realtimeInputConfig: {
            automaticActivityDetection: {
              disabled: false,
              prefixPaddingMs: 40,
              silenceDurationMs: 600,
            },
          },
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
              languageCode: 'pt-BR',
            },
          },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
      }));
    });

    ws.on('message', (raw) => {
      const message = JSON.parse(raw.toString());
      if (message.setupComplete) {
        evidence.setupMs = Date.now() - startedAt;
        streamPcm().catch(finish);
        return;
      }

      const content = message.serverContent;
      if (!content) return;
      if (content.inputTranscription?.text) {
        evidence.inputTranscriptChars += content.inputTranscription.text.length;
        if (evidence.inputTranscriptMs === null) evidence.inputTranscriptMs = Date.now() - startedAt;
      }
      for (const part of content.modelTurn?.parts || []) {
        if (!part.inlineData?.data) continue;
        evidence.audioChunks += 1;
        if (evidence.firstAudioMs === null) evidence.firstAudioMs = Date.now() - startedAt;
      }
      if (content.turnComplete) {
        evidence.turnCompleteMs = Date.now() - startedAt;
        finish();
      }
    });

    ws.on('error', finish);
    ws.on('close', (code, reason) => {
      if (!finished && code !== 1000) finish(new Error(`relay closed ${code}: ${reason.toString()}`));
    });
  });

  if (!evidence.setupMs || !evidence.inputTranscriptChars || !evidence.audioChunks || !evidence.turnCompleteMs) {
    throw new Error(`pcm canary incomplete: ${JSON.stringify(evidence)}`);
  }
  console.log(JSON.stringify({ ok: true, ...evidence }));
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error.message }));
  process.exitCode = 1;
});
