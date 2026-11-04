import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { createDesktopBridge } from '../vendor/pulso-core/desktop/bridge.mjs';

const request = (requestId, method, params = {}) => ({ requestId, method, params });

test('catálogo local, seleção por sessão e turno real usam o modelo escolhido sem fallback', async () => {
  const dataDir = mkdtempSync(path.join(tmpdir(), 'pulso-local-selector-'));
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
    scope: { type: 'session', scopeId: 'session-local' },
    idempotencyKey: 'select:session-local:gemma4:26b',
  }));
  assert.equal(selected.ok, true);
  assert.equal(selected.result.binding.scopeKey, 'session:session-local');
  assert.deepEqual(selected.result.binding.fallbackChain, []);
  assert.equal(selected.result.fallbackEnabled, false);

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

  await bridge.close();
  rmSync(dataDir, { recursive: true, force: true });
});

test('seletor desktop chama o Core antes da rota legada da OpenClaw', () => {
  const source = readFileSync(new URL('../src/apps/pulso/pages/LivePage.tsx', import.meta.url), 'utf8');
  const handler = source.slice(source.indexOf('const handleApplySessionModel'), source.indexOf('const dynamicAreas'));
  assert.match(handler, /if \(coreDesktopEnabled\)[\s\S]*pulsoCoreProvider\.selectForSession/);
  assert.match(handler, /pulsoCoreProvider\.selectForSession[\s\S]*lotusOpenClawClient\.switchSessionModel/);
  assert.match(handler, /binding\.fallbackChain/);
});
