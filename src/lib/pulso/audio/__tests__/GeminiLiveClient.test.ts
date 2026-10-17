import assert from 'node:assert/strict';
import test from 'node:test';
// @ts-expect-error Node's strip-types runner executes the TypeScript source directly.
import { GeminiLiveClient, type GeminiLiveConfig } from '../GeminiLiveClient.ts';

const originalWebSocket = globalThis.WebSocket;

type HarnessCallbacks = Pick<GeminiLiveConfig, 'onUserTurnReady' | 'onTranscript'>;

function createHarness(callbacks: Partial<HarnessCallbacks> = {}) {
  const sent: string[] = [];
  const states: string[] = [];
  const client = new GeminiLiveClient({
    relayUrl: 'ws://canary.invalid',
    getAccessToken: async () => 'firebase-canary',
    systemInstruction: 'Canária',
    onStateChange: (state) => states.push(state),
    onError: () => undefined,
    ...callbacks,
  });
  const fakeSocket = {
    readyState: 1,
    send: (message: string) => sent.push(message),
  };
  Object.assign(client, {
    ws: fakeSocket,
    activeTurnId: 'turn-current',
    awaitingResult: true,
  });
  return { client, sent, states };
}

const handleMessage = (client: GeminiLiveClient, payload: object) => (
  client as unknown as { handleMessage: (raw: string) => Promise<void> }
).handleMessage(JSON.stringify(payload));

test.before(() => {
  globalThis.WebSocket = Object.assign(function WebSocketCanary() {}, { OPEN: 1 }) as unknown as typeof WebSocket;
});

test.after(() => {
  globalThis.WebSocket = originalWebSocket;
});

test('resultado espera a confirmação terminar e só então entra na fila de voz', async () => {
  const { client, sent } = createHarness();
  Object.assign(client, {
    narrationInFlight: {
      kind: 'acknowledgement',
      text: 'Estou verificando.',
      turnId: 'turn-current',
    },
  });

  assert.equal(client.sendResultText('Resultado pronto.', 'turn-current'), true);
  assert.equal(sent.length, 0);

  await (client as unknown as { handleMessage: (raw: string) => Promise<void> }).handleMessage(
    JSON.stringify({ serverContent: { turnComplete: true } })
  );

  assert.equal(sent.length, 1);
  assert.match(sent[0], /\[RESULTADO\] Resultado pronto\./);
});

test('resultado de turno antigo é descartado sem falar', () => {
  const { client, sent } = createHarness();
  assert.equal(client.sendResultText('Não deve falar.', 'turn-old'), false);
  assert.equal(sent.length, 0);
});

test('interrupção limpa áudio e fila do turno sem reaproveitar fala antiga', async () => {
  const { client, sent, states } = createHarness();
  Object.assign(client, {
    narrationInFlight: {
      kind: 'result',
      text: 'Resposta anterior.',
      turnId: 'turn-current',
    },
    narrationQueue: [{
      kind: 'checkpoint',
      text: 'Continuação antiga.',
      turnId: 'turn-current',
    }],
  });

  await (client as unknown as { handleMessage: (raw: string) => Promise<void> }).handleMessage(
    JSON.stringify({ serverContent: { interrupted: true } })
  );

  const snapshot = client as unknown as {
    narrationInFlight: unknown;
    narrationQueue: unknown[];
    awaitingResult: boolean;
  };
  assert.equal(snapshot.narrationInFlight, null);
  assert.equal(snapshot.narrationQueue.length, 0);
  assert.equal(snapshot.awaitingResult, false);
  assert.equal(sent.length, 0);
  assert.equal(states.at(-1), 'listening');
});

test('setup reduz a espera de silêncio sem usar VAD agressivo', () => {
  const { client, sent } = createHarness();
  (client as unknown as { sendSetup: () => void }).sendSetup();

  const setup = JSON.parse(sent[0]).setup;
  assert.equal(setup.realtimeInputConfig.automaticActivityDetection.disabled, false);
  assert.equal(setup.realtimeInputConfig.automaticActivityDetection.prefixPaddingMs, 40);
  assert.equal(setup.realtimeInputConfig.automaticActivityDetection.silenceDurationMs, 600);
});

test('pedido operacional toca a confirmação autônoma e entra uma vez no fluxo canônico', async () => {
  const turns: Array<{ turnId: string; userText: string; socialOnly: boolean }> = [];
  const { client, sent } = createHarness({
    onUserTurnReady: (turn) => turns.push(turn),
  });
  const played: string[] = [];
  Object.assign(client, {
    enqueuePlayback: (chunk: string) => played.push(chunk),
    activeTurnId: null,
    awaitingResult: false,
  });

  await handleMessage(client, {
    serverContent: {
      inputTranscription: { text: 'Quais são meus compromissos de hoje?' },
      modelTurn: { parts: [{ inlineData: { data: 'AAE=' } }] },
      turnComplete: true,
    },
  });
  await new Promise(resolve => setTimeout(resolve, 140));

  assert.equal(played.length, 1);
  assert.equal(turns.length, 1);
  assert.equal(turns[0].userText, 'Quais são meus compromissos de hoje?');
  assert.equal(turns[0].socialOnly, false);
  assert.equal(sent.length, 0, 'não deve pedir uma segunda confirmação ao Gemini');
});

test('saudação também entra no fluxo canônico e não duplica a resposta falada', async () => {
  const turns: Array<{ turnId: string; userText: string; socialOnly: boolean }> = [];
  const { client } = createHarness({
    onUserTurnReady: (turn) => turns.push(turn),
  });
  const played: string[] = [];
  Object.assign(client, {
    enqueuePlayback: (chunk: string) => played.push(chunk),
    activeTurnId: null,
    awaitingResult: false,
  });

  await handleMessage(client, {
    serverContent: {
      inputTranscription: { text: 'Oi, bom dia. Tudo bem? E você?' },
      modelTurn: { parts: [{ inlineData: { data: 'AAE=' } }] },
      turnComplete: true,
    },
  });
  await new Promise(resolve => setTimeout(resolve, 140));

  assert.equal(played.length, 1);
  assert.equal(turns.length, 1);
  assert.equal(turns[0].socialOnly, true);
  assert.equal(client.completeResultSilently(turns[0].turnId), true);
  assert.equal(client.completeResultSilently(turns[0].turnId), false);
});

test('transcrição tardia ainda fecha o turno e entra no fluxo canônico', async () => {
  const turns: Array<{ turnId: string; userText: string; socialOnly: boolean }> = [];
  const { client } = createHarness({
    onUserTurnReady: (turn) => turns.push(turn),
  });
  Object.assign(client, {
    activeTurnId: null,
    awaitingResult: false,
  });

  await handleMessage(client, { serverContent: { turnComplete: true } });
  await new Promise(resolve => setTimeout(resolve, 140));
  await handleMessage(client, {
    serverContent: { inputTranscription: { text: 'Verifique minha agenda.' } },
  });
  await new Promise(resolve => setTimeout(resolve, 900));

  assert.equal(turns.length, 1);
  assert.equal(turns[0].userText, 'Verifique minha agenda.');
  assert.equal(turns[0].socialOnly, false);
});
