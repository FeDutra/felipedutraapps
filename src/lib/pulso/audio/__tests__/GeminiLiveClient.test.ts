import assert from 'node:assert/strict';
import test from 'node:test';
// @ts-expect-error Node's strip-types runner executes the TypeScript source directly.
import { GeminiLiveClient } from '../GeminiLiveClient.ts';

const originalWebSocket = globalThis.WebSocket;

function createHarness() {
  const sent: string[] = [];
  const states: string[] = [];
  const client = new GeminiLiveClient({
    relayUrl: 'ws://canary.invalid',
    getAccessToken: async () => 'firebase-canary',
    systemInstruction: 'Canária',
    onStateChange: (state) => states.push(state),
    onError: () => undefined,
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
