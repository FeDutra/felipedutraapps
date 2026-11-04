import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { createDesktopBridge } from '../vendor/pulso-core/desktop/bridge.mjs';
import { defaultNdjsonTransport } from '../vendor/pulso-core/src/providers/model-adapters.mjs';

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

test('modelo local nasce rápido, mostra Core na interface e propaga cancelamento ao Ollama', () => {
  const providerSource = readFileSync(new URL('../src/apps/pulso/services/pulsoCoreProvider.ts', import.meta.url), 'utf8');
  const liveSource = readFileSync(new URL('../src/apps/pulso/pages/LivePage.tsx', import.meta.url), 'utf8');
  const adapterSource = readFileSync(new URL('../vendor/pulso-core/src/providers/model-adapters.mjs', import.meta.url), 'utf8');
  assert.match(providerSource, /\{ id: 'off', label: 'rápido' \}/);
  assert.match(providerSource, /thinkingDefault: model\.local === true \? 'off'/);
  assert.match(liveSource, /confirmando no PULSO Core/);
  assert.match(liveSource, /respondendo'} no iMac/);
  assert.match(adapterSource, /externalSignal\?\.addEventListener\("abort", abortFromExternal/);
  assert.match(adapterSource, /signal: request\?\.signal/);
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
