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

test('fim tardio da confirmação libera checkpoint e resultado canônicos', async () => {
  const { client, sent, states } = createHarness();
  Object.assign(client, {
    narrationInFlight: null,
    pendingSources: 0,
    turnCompletePending: false,
    outputEchoGuardUntil: 0,
    lastNarrationCompletedAt: Date.now() - 7_000,
  });

  // Reproduz o iMac físico: o último buffer da confirmação já acabou e só
  // depois chega `turnComplete`. Antes da correção, a trava permanecia ativa
  // para sempre e o chat/MESA avançavam sem qualquer voz posterior.
  await handleMessage(client, { serverContent: { turnComplete: true } });

  const afterAck = client as unknown as { turnCompletePending: boolean };
  assert.equal(afterAck.turnCompletePending, false);
  assert.equal(states.at(-1), 'listening');
  Object.assign(client, { lastNarrationCompletedAt: Date.now() - 7_000 });

  assert.equal(client.sendCheckpointText('Localizei a conversa correta.', 'turn-current'), true);
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(sent.length, 1);
  assert.match(sent[0], /\[CHECKPOINT\] Localizei a conversa correta\./);

  await handleMessage(client, { serverContent: { turnComplete: true } });
  assert.equal(client.sendResultText('As últimas mensagens são estas.', 'turn-current'), true);
  assert.equal(sent.length, 2);
  assert.match(sent[1], /\[RESULTADO\] As últimas mensagens são estas\./);
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
  assert.deepEqual(setup.inputAudioTranscription.languageCodes, ['pt-BR']);
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
      inputTranscription: { text: 'Quais são meus compromissos de hoje?', finished: true },
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
      inputTranscription: { text: 'Oi, bom dia. Tudo bem? E você?', finished: true },
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

test('transcrição tardia final ainda fecha o turno e entra no fluxo canônico', async () => {
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
    serverContent: { inputTranscription: { text: 'Verifique minha agenda.', finished: true } },
  });
  await new Promise(resolve => setTimeout(resolve, 140));

  assert.equal(turns.length, 1);
  assert.equal(turns[0].userText, 'Verifique minha agenda.');
  assert.equal(turns[0].socialOnly, false);
});

test('turnComplete não publica fragmento provisório antes de finished', async () => {
  const turns: Array<{ turnId: string; userText: string; socialOnly: boolean }> = [];
  const { client } = createHarness({
    onUserTurnReady: (turn) => turns.push(turn),
  });
  Object.assign(client, {
    activeTurnId: null,
    awaitingResult: false,
  });

  await handleMessage(client, {
    serverContent: {
      inputTranscription: { text: 'De.', finished: false },
      turnComplete: true,
    },
  });
  await new Promise(resolve => setTimeout(resolve, 180));
  assert.equal(turns.length, 0, 'fragmento provisório não pode virar mensagem');

  await handleMessage(client, {
    serverContent: {
      inputTranscription: { text: ' Que horas são agora?', finished: true },
    },
  });
  await new Promise(resolve => setTimeout(resolve, 140));

  assert.equal(turns.length, 1);
  assert.equal(turns[0].userText, 'De. Que horas são agora?');
});

test('modelo antigo sem finished usa fallback lento sem perder o turno', async () => {
  const turns: Array<{ turnId: string; userText: string; socialOnly: boolean }> = [];
  const { client } = createHarness({
    onUserTurnReady: (turn) => turns.push(turn),
  });
  Object.assign(client, {
    activeTurnId: null,
    awaitingResult: false,
  });

  await handleMessage(client, {
    serverContent: {
      inputTranscription: { text: 'Abra o calendário.' },
      turnComplete: true,
    },
  });
  await new Promise(resolve => setTimeout(resolve, 180));
  assert.equal(turns.length, 0);
  await new Promise(resolve => setTimeout(resolve, 1_500));

  assert.equal(turns.length, 1);
  assert.equal(turns[0].userText, 'Abra o calendário.');
});

test('voz reproduzida fecha a captura e não pode criar um turno de eco', async () => {
  const turns: Array<{ turnId: string; userText: string; socialOnly: boolean }> = [];
  const played: string[] = [];
  const { client } = createHarness({
    onUserTurnReady: (turn) => turns.push(turn),
  });
  Object.assign(client, {
    activeTurnId: 'turn-finished',
    awaitingResult: true,
    inputTurnClosed: true,
    pendingUserTranscript: '',
    enqueuePlayback: (chunk: string) => played.push(chunk),
  });

  const internals = client as unknown as {
    armOutputEchoGuard: (playbackEndsAtMs: number) => void;
    outputEchoGuardUntil: number;
    captureFramesSuppressedUntil: number;
  };
  internals.armOutputEchoGuard(Date.now() + 300);
  assert.ok(internals.captureFramesSuppressedUntil >= internals.outputEchoGuardUntil);

  await handleMessage(client, {
    serverContent: {
      inputTranscription: { text: 'Iniciando.', finished: true },
      modelTurn: { parts: [{ inlineData: { data: 'AAE=' } }] },
      turnComplete: true,
    },
  });
  await new Promise(resolve => setTimeout(resolve, 140));

  assert.equal(turns.length, 0, 'a voz da própria PULSO não pode voltar como fala humana');
  assert.equal(played.length, 0, 'a resposta ao eco também precisa ser descartada');

  internals.outputEchoGuardUntil = Date.now() - 1;
  await handleMessage(client, {
    serverContent: {
      inputTranscription: { text: 'Agora sou eu.', finished: true },
      turnComplete: true,
    },
  });
  await new Promise(resolve => setTimeout(resolve, 140));

  assert.equal(turns.length, 1);
  assert.equal(turns[0].userText, 'Agora sou eu.');
});

test('barreira de captura é armada antes do primeiro frame tocar no alto-falante', () => {
  const { client } = createHarness();
  let guardedWhenPlaybackStarted = false;
  const source = {
    buffer: null as unknown,
    connect: () => undefined,
    start: () => {
      const snapshot = client as unknown as { captureFramesSuppressedUntil: number };
      guardedWhenPlaybackStarted = snapshot.captureFramesSuppressedUntil > Date.now();
    },
    stop: () => undefined,
    disconnect: () => undefined,
    onended: null as null | (() => void),
  };
  const fakeContext = {
    currentTime: 10,
    state: 'running',
    destination: {},
    createBuffer: (_channels: number, length: number, sampleRate: number) => ({
      duration: length / sampleRate,
      copyToChannel: () => undefined,
    }),
    createBufferSource: () => source,
  };
  Object.assign(client, {
    ensurePlaybackContext: () => fakeContext,
    playbackContext: fakeContext,
    nextPlaybackTime: 10,
  });

  (client as unknown as { enqueuePlayback: (base64: string) => void }).enqueuePlayback('AAE=');

  assert.equal(guardedWhenPlaybackStarted, true);
  (client as unknown as { flushPlayback: () => void }).flushPlayback();
});

test('barreira de eco deixa a transcrição humana já aberta terminar', async () => {
  const turns: Array<{ turnId: string; userText: string; socialOnly: boolean }> = [];
  const { client } = createHarness({
    onUserTurnReady: (turn) => turns.push(turn),
  });
  Object.assign(client, {
    activeTurnId: null,
    awaitingResult: false,
  });

  await handleMessage(client, {
    serverContent: {
      inputTranscription: { text: 'Que dia', finished: false },
    },
  });
  (client as unknown as { armOutputEchoGuard: (playbackEndsAtMs: number) => void })
    .armOutputEchoGuard(Date.now() + 300);
  await handleMessage(client, {
    serverContent: {
      inputTranscription: { text: ' é hoje?', finished: true },
      turnComplete: true,
    },
  });
  await new Promise(resolve => setTimeout(resolve, 140));

  assert.equal(turns.length, 1);
  assert.equal(turns[0].userText, 'Que dia é hoje?');
});
