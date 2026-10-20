import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === './pulsoCoreClient') {
      return nextResolve('./pulsoCoreClient.ts', context);
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.endsWith('/pulsoCoreConversation.ts') || url.endsWith('/pulsoCoreClient.ts')) {
      return {
        format: 'module',
        source: stripTypeScriptTypes(readFileSync(fileURLToPath(url), 'utf8')),
        shortCircuit: true,
      };
    }
    return nextLoad(url, context);
  },
});

const { PulsoCoreConversation, PulsoCoreConversationError } = await import('./pulsoCoreConversation.ts');

const success = result => ({
  ok: true,
  status: 'ok',
  requestId: 'test',
  result,
  fallbackRequired: false,
});

const run = (status, accumulatedText = '') => ({
  id: 'run-1',
  sessionId: 'session-1',
  humanMessageId: 'human-1',
  assistantMessageId: status === 'completed' ? 'assistant-1' : null,
  identityId: 'lotus',
  status,
  accumulatedText,
  deltasCount: accumulatedText ? 2 : 0,
  resumedFromRunId: null,
  providerId: 'provider-openai',
  model: 'gpt-5-mini',
  createdAt: '2026-10-20T00:00:00.000Z',
  updatedAt: '2026-10-20T00:00:01.000Z',
  completedAt: status === 'completed' ? '2026-10-20T00:00:01.000Z' : null,
});

test('streamTurn entrega deltas temporais e retorna histórico canônico concluído', async () => {
  const calls = [];
  const client = {
    isAvailable: () => true,
    startTurn: async params => {
      calls.push(['start', params]);
      return success({ runId: 'run-1', run: run('queued') });
    },
    pollTurn: async () => {
      const polls = calls.filter(([name]) => name === 'poll').length;
      calls.push(['poll']);
      return polls === 0
        ? success({
            run: run('streaming', 'olá'),
            envelopes: [
              { type: 'conversation.delta', text: 'olá', accumulatedText: 'olá' },
            ],
            done: false,
          })
        : success({
            run: run('completed', 'olá, Fe'),
            envelopes: [
              { type: 'conversation.delta', text: ', Fe', accumulatedText: 'olá, Fe' },
            ],
            done: true,
          });
    },
    listMessages: async () => success([
      { id: 'human-1', sessionId: 'session-1', role: 'human', texto: 'oi', estado: 'persisted', createdAt: '2026-10-20T00:00:00.000Z' },
      { id: 'assistant-1', sessionId: 'session-1', role: 'assistant', texto: 'olá, Fe', estado: 'persisted', createdAt: '2026-10-20T00:00:01.000Z' },
    ]),
  };
  const deltas = [];
  const conversation = new PulsoCoreConversation(client);
  const result = await conversation.streamTurn({
    sessionId: 'session-1',
    text: 'oi',
    idempotencyKey: 'idem-1',
    pollIntervalMs: 16,
    onDelta: (delta, accumulated) => deltas.push([delta, accumulated]),
  });

  assert.deepEqual(deltas, [['olá', 'olá'], [', Fe', 'olá, Fe']]);
  assert.equal(result.run.status, 'completed');
  assert.equal(result.messages.at(-1).texto, 'olá, Fe');
  assert.equal(calls[0][0], 'start');
  assert.equal(calls[0][1].sessionId, 'session-1');
});

test('streamTurn falha explicitamente sem provider e nunca inventa resposta', async () => {
  const client = {
    isAvailable: () => true,
    startTurn: async () => success({ runId: 'run-1', run: run('awaiting_provider') }),
  };
  const conversation = new PulsoCoreConversation(client);
  await assert.rejects(
    conversation.streamTurn({ sessionId: 'session-1', text: 'oi', idempotencyKey: 'idem-2' }),
    error => error instanceof PulsoCoreConversationError && error.code === 'PROVIDER_NOT_CONFIGURED'
  );
});

test('streamTurn propaga cancelamento ao Core antes de encerrar', async () => {
  const controller = new AbortController();
  let cancelled = false;
  const client = {
    isAvailable: () => true,
    startTurn: async () => success({ runId: 'run-1', run: run('queued') }),
    cancelTurn: async ({ runId, reason }) => {
      assert.equal(runId, 'run-1');
      assert.equal(reason, 'interface_cancelled');
      cancelled = true;
      return success(run('cancelled'));
    },
    listMessages: async () => success([]),
  };
  const conversation = new PulsoCoreConversation(client);
  controller.abort();
  const result = await conversation.streamTurn({
    sessionId: 'session-1',
    text: 'pare',
    idempotencyKey: 'idem-3',
    signal: controller.signal,
  });
  assert.equal(cancelled, true);
  assert.equal(result.run.status, 'cancelled');
});
