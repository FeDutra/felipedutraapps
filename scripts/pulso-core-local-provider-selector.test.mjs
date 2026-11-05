import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { createDesktopBridge } from '../vendor/pulso-core/desktop/bridge.mjs';
import {
  AnthropicModelAdapter,
  OpenAIModelAdapter,
  defaultNdjsonTransport,
} from '../vendor/pulso-core/src/providers/model-adapters.mjs';
import { CodexSubscriptionAdapter } from '../vendor/pulso-core/src/providers/codex-app-server-adapter.mjs';
import { compactMessagesForContext, estimateMessageTokens } from '../vendor/pulso-core/src/live/model-context-budget.mjs';
import { SecretRefResolver } from '../vendor/pulso-core/src/runtime/secret-ref-resolver.mjs';

const request = (requestId, method, params = {}) => ({ requestId, method, params });

test('catálogo local, seleção por sessão e turno real usam o modelo escolhido sem fallback', async () => {
  const dataDir = mkdtempSync(path.join(tmpdir(), 'pulso-local-selector-'));
  let lastStreamInput = null;
  const bridge = createDesktopBridge({
    dataDir,
    adapterFactory(params) {
      return {
        id: params.providerId,
        label: params.displayName,
        local: params.adapterKind === 'ollama',
        async listModels() {
          return params.adapterKind === 'ollama'
            ? [
                { id: 'gemma4:26b', name: 'gemma4:26b', local: true },
                { id: 'SparkLLM/Spark-X2.6-4B:latest', name: 'SparkLLM/Spark-X2.6-4B:latest', local: true },
              ]
            : [];
        },
        async health() {
          return { status: 'healthy', providerId: params.providerId, checkedAt: '2026-11-04T00:00:00.000Z', detail: 'test' };
        },
        async complete(input) {
          return { text: 'GEMMA_CANARY', outputText: 'GEMMA_CANARY', providerId: params.providerId, model: input.model };
        },
        async *stream(input) {
          lastStreamInput = input;
          yield { type: 'model.delta', text: 'GEMMA_CANARY' };
          yield {
            type: 'model.completed',
            text: 'GEMMA_CANARY',
            outputText: 'GEMMA_CANARY',
            providerId: params.providerId,
            model: input.model,
          };
        },
      };
    },
  });

  const codex = await bridge.handleRequest(request('configure-codex', 'provider.configure', {
    providerId: 'codex-fe', adapterKind: 'codex_subscription', displayName: 'Fe · ChatGPT', model: 'gpt-test',
  }));
  assert.equal(codex.ok, true);
  const local = await bridge.handleRequest(request('configure-local', 'provider.configure', {
    providerId: 'ollama-local', adapterKind: 'ollama', displayName: 'iMac · modelos locais', model: 'gemma4:26b', bind: false,
  }));
  assert.equal(local.ok, true);

  const catalog = await bridge.handleRequest(request('catalog', 'provider.catalog'));
  assert.equal(catalog.ok, true);
  assert.deepEqual(catalog.result.models.filter(model => model.providerId === 'ollama-local').map(model => model.id), [
    'gemma4:26b',
    'SparkLLM/Spark-X2.6-4B:latest',
  ]);
  assert.equal(catalog.result.bindings.some(binding => binding.primary?.providerId === 'ollama-local'), false);

  const topology = await bridge.handleRequest(request('topology', 'live.topology.ensure', {
    areas: [{ id: 'area-local', nome: 'LOCAL', glifo: '○', ordem: 1 }],
    sessions: [{ id: 'session-local', areaId: 'area-local', titulo: 'LOCAL' }],
  }));
  assert.equal(topology.ok, true);

  const selected = await bridge.handleRequest(request('select-gemma', 'provider.select', {
    providerId: 'ollama-local',
    model: 'gemma4:26b',
    thinkingLevel: 'off',
    scope: { type: 'session', scopeId: 'session-local' },
    idempotencyKey: 'select:session-local:gemma4:26b:off',
  }));
  assert.equal(selected.ok, true);
  assert.equal(selected.result.binding.scopeKey, 'session:session-local');
  assert.deepEqual(selected.result.binding.fallbackChain, []);
  assert.equal(selected.result.fallbackEnabled, false);
  assert.equal(selected.result.binding.metadata.thinkingLevel, 'off');

  const started = await bridge.handleRequest(request('turn', 'live.turn.start', {
    sessionId: 'session-local', text: 'responda a canária', idempotencyKey: 'turn-local-gemma',
  }));
  assert.equal(started.ok, true);
  let polled;
  for (let index = 0; index < 20; index += 1) {
    polled = await bridge.handleRequest(request(`poll-${index}`, 'live.turn.poll', { runId: started.result.runId }));
    if (polled.result.done) break;
    await new Promise(resolve => setTimeout(resolve, 5));
  }
  assert.equal(polled.ok, true);
  assert.equal(polled.result.done, true);
  assert.equal(polled.result.run.providerId, 'ollama-local');
  assert.equal(polled.result.run.model, 'gemma4:26b');
  assert.equal(polled.result.run.status, 'completed');
  assert.equal(lastStreamInput.think, false);

  await bridge.close();
  rmSync(dataDir, { recursive: true, force: true });
});

test('seletor desktop chama o Core antes da rota legada da OpenClaw', () => {
  const source = readFileSync(new URL('../src/apps/pulso/pages/LivePage.tsx', import.meta.url), 'utf8');
  const handler = source.slice(source.indexOf('const handleApplySessionModel'), source.indexOf('const dynamicAreas'));
  assert.match(handler, /if \(coreDesktopEnabled\)[\s\S]*pulsoCoreProvider\.selectForSession/);
  assert.match(handler, /pulsoCoreProvider\.selectForSession[\s\S]*lotusOpenClawClient\.switchSessionModel/);
  assert.match(handler, /binding\.fallbackChain/);
  assert.match(handler, /setSessions[\s\S]*setActiveContextNode/);
});

test('adapter Ollama mantém contexto estável e não mata uma resposta fria em 120 segundos', () => {
  const adapterSource = readFileSync(new URL('../vendor/pulso-core/src/providers/model-adapters.mjs', import.meta.url), 'utf8');
  const bridgeSource = readFileSync(new URL('../vendor/pulso-core/desktop/bridge.mjs', import.meta.url), 'utf8');
  assert.match(adapterSource, /timeoutMs: options\.timeoutMs \?\? 600000/);
  assert.match(adapterSource, /num_ctx: request\?\.contextWindow \?\? 8192/);
  assert.match(bridgeSource, /localAdapter \? 600_000 : 15_000/);
});

test('modelo local nasce rápido, usa seletor sem texto grande no cabeçalho e propaga cancelamento ao Ollama', () => {
  const providerSource = readFileSync(new URL('../src/apps/pulso/services/pulsoCoreProvider.ts', import.meta.url), 'utf8');
  const liveSource = readFileSync(new URL('../src/apps/pulso/pages/LivePage.tsx', import.meta.url), 'utf8');
  const adapterSource = readFileSync(new URL('../vendor/pulso-core/src/providers/model-adapters.mjs', import.meta.url), 'utf8');
  assert.match(providerSource, /\{ id: 'off', label: 'rápido' \}/);
  assert.match(providerSource, /model\.thinkingDefault \|\| \(local \? 'off'/);
  assert.match(liveSource, /confirmando no PULSO Core/);
  assert.doesNotMatch(liveSource, /respondendo'} no iMac/);
  assert.doesNotMatch(liveSource, /'conectada'}\s*<\/span>/);
  assert.match(adapterSource, /externalSignal\?\.addEventListener\("abort", abortFromExternal/);
  assert.match(adapterSource, /signal: request\?\.signal/);
});

test('histórico longo é compactado antes do Ollama sem perder o turno atual', () => {
  const history = [
    { role: 'system', content: 'identidade '.repeat(2500) },
    ...Array.from({ length: 80 }, (_, index) => ({
      role: index % 2 === 0 ? 'user' : 'assistant',
      content: `mensagem-${index} ` + 'conteúdo '.repeat(220),
    })),
    { role: 'user', content: 'olá, Lótus' },
  ];
  const compacted = compactMessagesForContext(history, { contextWindow: 8192 });
  assert.ok(compacted.omittedMessages > 0);
  assert.equal(compacted.messages.at(-1).content, 'olá, Lótus');
  assert.ok(compacted.estimatedInputTokens < 8192 - 700);
  assert.equal(
    compacted.messages.reduce((total, message) => total + estimateMessageTokens(message), 0),
    compacted.estimatedInputTokens,
  );
});

test('assinatura ChatGPT entrega catálogo e intensidades anunciados pelo provider', async () => {
  const adapter = new CodexSubscriptionAdapter({
    id: 'codex-fe',
    defaultModel: 'gpt-6.1-sol',
    client: {
      async listModels() {
        return {
          data: [
            {
              slug: 'gpt-6.1-sol',
              display_name: 'GPT-6.1-Sol',
              context_window: 500000,
              default_reasoning_level: 'medium',
              supportedReasoningEfforts: [
                { reasoningEffort: 'low', description: 'rápido' },
                { reasoningEffort: 'medium', description: 'equilibrado' },
                { reasoningEffort: 'ultra', description: 'máximo' },
              ],
              visibility: 'list',
            },
            { id: 'hidden-review', displayName: 'Hidden', hidden: true },
          ],
        };
      },
      async *streamCompletion() {},
    },
  });
  const models = await adapter.listModels();
  assert.equal(models.length, 1);
  assert.equal(models[0].id, 'gpt-6.1-sol');
  assert.equal(models[0].contextWindow, 500000);
  assert.equal(models[0].thinkingDefault, 'medium');
  assert.deepEqual(models[0].thinkingLevels.map(level => level.id), ['low', 'medium', 'ultra']);
});

test('providers por API consultam o catálogo vivo da conta em vez de limitar o seletor a defaults fixos', async () => {
  const secretResolver = new SecretRefResolver({ env: { PULSO_PROVIDER_CATALOG_TEST_SECRET: 'test-secret' } });
  const openaiRequests = [];
  const openai = new OpenAIModelAdapter({
    id: 'openai-fe',
    secretRef: 'env:PULSO_PROVIDER_CATALOG_TEST_SECRET',
    secretResolver,
    allowExternalNetwork: true,
    transport: async requestInput => {
      openaiRequests.push(requestInput);
      return {
        status: 200,
        ok: true,
        json: requestInput.url.endsWith('/models')
          ? {
              data: [
                { id: 'gpt-5.2' },
                { id: 'gpt-4.1-mini' },
                { id: 'text-embedding-3-large' },
              ],
            }
          : {
              id: 'chatcmpl-test', model: 'gpt-5.2',
              choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }],
              usage: { prompt_tokens: 1, completion_tokens: 1 },
            },
      };
    },
  });
  const openaiModels = await openai.listModels();
  assert.deepEqual(openaiModels.map(model => model.id), ['gpt-4.1-mini', 'gpt-5.2']);
  assert.deepEqual(openaiModels.find(model => model.id === 'gpt-5.2').thinkingLevels.map(level => level.id), [
    'low', 'medium', 'high',
  ]);
  assert.deepEqual(openaiModels.find(model => model.id === 'gpt-4.1-mini').thinkingLevels.map(level => level.id), ['off']);
  await openai.complete({ model: 'gpt-5.2', prompt: 'teste', reasoningEffort: 'high' });
  assert.equal(openaiRequests.at(-1).body.reasoning_effort, 'high');

  const anthropicRequests = [];
  const anthropic = new AnthropicModelAdapter({
    id: 'anthropic-fe',
    secretRef: 'env:PULSO_PROVIDER_CATALOG_TEST_SECRET',
    secretResolver,
    allowExternalNetwork: true,
    transport: async requestInput => {
      anthropicRequests.push(requestInput);
      return {
        status: 200,
        ok: true,
        json: requestInput.url.endsWith('/models')
          ? {
              data: [
                { id: 'claude-sonnet-4-5', display_name: 'Claude Sonnet 4.5', created_at: '2026-01-01T00:00:00Z' },
                { id: 'claude-3-5-haiku-latest', display_name: 'Claude 3.5 Haiku' },
              ],
            }
          : {
              id: 'msg-test', model: 'claude-sonnet-4-5',
              content: [{ type: 'text', text: 'ok' }], stop_reason: 'end_turn',
              usage: { input_tokens: 1, output_tokens: 1 },
            },
      };
    },
  });
  const anthropicModels = await anthropic.listModels();
  assert.deepEqual(anthropicModels.map(model => model.id), ['claude-sonnet-4-5', 'claude-3-5-haiku-latest']);
  assert.deepEqual(anthropicModels[0].thinkingLevels.map(level => level.id), ['off', 'adaptive']);
  assert.deepEqual(anthropicModels[1].thinkingLevels.map(level => level.id), ['off']);
  await anthropic.complete({ model: 'claude-sonnet-4-5', prompt: 'teste', reasoningEffort: 'adaptive' });
  assert.deepEqual(anthropicRequests.at(-1).body.thinking, { type: 'adaptive' });
});

test('tema preto aplica classes reais ao documento e restaura preferência salva', () => {
  const liveSource = readFileSync(new URL('../src/apps/pulso/pages/LivePage.tsx', import.meta.url), 'utf8');
  assert.match(liveSource, /document\.body\.classList\.toggle\('pulso-theme-black', blackTheme\)/);
  assert.match(liveSource, /document\.documentElement\.classList\.toggle\('pulso-theme-black-preload', blackTheme\)/);
  assert.match(liveSource, /applyTheme\(\);/);
  assert.match(liveSource, /safeStorageSet\('pulso-theme', next\)/);
});

test('PARAR aborta o stream HTTP real do Ollama em vez de só cancelar a interface', async () => {
  const server = createServer((_request, response) => {
    response.writeHead(200, { 'content-type': 'application/x-ndjson' });
    response.flushHeaders();
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.equal(typeof address, 'object');
  const controller = new AbortController();
  try {
    const transport = await defaultNdjsonTransport({
      url: `http://127.0.0.1:${address.port}/api/chat`,
      stream: true,
      signal: controller.signal,
      timeoutMs: 5_000,
    });
    const nextFrame = transport.frames[Symbol.asyncIterator]().next();
    controller.abort(new Error('interface_cancelled'));
    await assert.rejects(nextFrame, error => (
      error?.name === 'AbortError' || /abort|interface_cancelled/i.test(String(error?.message))
    ));
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});
