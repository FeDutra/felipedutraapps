const { WebSocket } = require('ws');
const { createOwnerIdToken } = require('./firebaseAuthCanary');

const DEFAULT_TIMEOUT_MS = 25_000;

async function main() {
  const relayUrl = process.env.RELAY_URL;
  if (!relayUrl) throw new Error('RELAY_URL é obrigatória.');
  const { idToken } = await createOwnerIdToken();
  const startedAt = Date.now();
  const evidence = {
    connectedMs: null,
    authenticatedMs: null,
    setupMs: null,
    firstAudioMs: null,
    audioChunks: 0,
    outputTranscript: '',
    turnCompleteMs: null,
  };

  await new Promise((resolve, reject) => {
    const ws = new WebSocket(relayUrl);
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error('canary timeout'));
    }, Number(process.env.CANARY_TIMEOUT_MS || DEFAULT_TIMEOUT_MS));

    const finish = (error) => {
      clearTimeout(timeout);
      if (ws.readyState < WebSocket.CLOSING) ws.close(1000, 'canary complete');
      if (error) reject(error);
      else resolve();
    };

    ws.on('open', () => {
      evidence.connectedMs = Date.now() - startedAt;
    });

    ws.on('message', (raw) => {
      const message = JSON.parse(raw.toString());
      if (message.authRequired) {
        ws.send(JSON.stringify({ auth: { firebaseIdToken: idToken } }));
        return;
      }
      if (message.authError) {
        finish(new Error('relay rejected Firebase session'));
        return;
      }
      if (message.authComplete) {
        evidence.authenticatedMs = Date.now() - startedAt;
        ws.send(JSON.stringify({
          setup: {
            model: 'models/gemini-3.8-live',
            systemInstruction: {
              parts: [{ text: 'Responda em português brasileiro, de forma breve e sem cumprimentos.' }],
            },
            generationConfig: {
              responseModalities: ['AUDIO'],
              speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
                languageCode: 'pt-BR',
              },
            },
            outputAudioTranscription: {},
          },
        }));
        return;
      }
      if (message.setupComplete) {
        evidence.setupMs = Date.now() - startedAt;
        ws.send(JSON.stringify({
          clientContent: {
            turns: [{ role: 'user', parts: [{ text: 'Diga apenas: canária de voz pronta.' }] }],
            turnComplete: true,
          },
        }));
        return;
      }

      const content = message.serverContent;
      if (!content) return;
      if (content.outputTranscription?.text) {
        evidence.outputTranscript += content.outputTranscription.text;
      }
      for (const part of content.modelTurn?.parts || []) {
        if (part.inlineData?.data) {
          evidence.audioChunks += 1;
          if (evidence.firstAudioMs === null) evidence.firstAudioMs = Date.now() - startedAt;
        }
      }
      if (content.turnComplete) {
        evidence.turnCompleteMs = Date.now() - startedAt;
        finish();
      }
    });

    ws.on('error', (error) => finish(error));
    ws.on('close', (code, reason) => {
      if (evidence.turnCompleteMs === null && code !== 1000) {
        finish(new Error(`relay closed ${code}: ${reason.toString()}`));
      }
    });
  });

  if (!evidence.authenticatedMs || !evidence.setupMs || evidence.audioChunks < 1 || !evidence.turnCompleteMs) {
    throw new Error(`canary incomplete: ${JSON.stringify(evidence)}`);
  }
  console.log(JSON.stringify({ ok: true, ...evidence }));
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error.message }));
  process.exitCode = 1;
});
