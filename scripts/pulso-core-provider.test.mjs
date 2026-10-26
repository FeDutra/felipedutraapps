import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { createDesktopBridge } from '../vendor/pulso-core/desktop/bridge.mjs';

const request = (requestId, method, params = {}) => ({ requestId, method, params });

const fakeAdapterFactory = calls => (params, secretRef, secretResolver) => {
  calls.push(params);
  return {
    id: params.providerId,
    label: params.displayName,
    local: params.adapterKind === 'local',
    secretRef,
    secretResolver,
    complete: async () => ({ text: 'ok' }),
    health: async () => ({
      status: 'healthy',
      providerId: params.providerId,
      adapterKind: params.adapterKind,
      checkedAt: '2026-10-20T00:00:00.000Z',
      detail: 'test_transport_ok',
      authSource: secretResolver.inspectRef(secretRef),
    }),
  };
};

test('provider configure + test returns sanitized health from the attached adapter', async () => {
  const dataDir = mkdtempSync(path.join(tmpdir(), 'pulso-provider-'));
  const rawSecret = 'sk-never-return-this-value';
  const bridge = createDesktopBridge({
    dataDir,
    adapterFactory(params, secretRef, secretResolver) {
      return {
        id: params.providerId,
        label: params.displayName,
        local: params.adapterKind === 'local',
        secretRef,
        secretResolver,
        complete: async () => ({ text: 'ok' }),
        health: async () => ({
          status: 'healthy',
          providerId: params.providerId,
          adapterKind: params.adapterKind,
          checkedAt: '2026-10-20T00:00:00.000Z',
          detail: 'test_transport_ok',
          authSource: secretResolver.inspectRef(secretRef),
        }),
      };
    },
  });

  const injected = await bridge.handleRequest(request('secret', 'provider.secret.inject', {
    providerId: 'openai',
    secret: rawSecret,
  }));
  assert.equal(injected.ok, true);

  const configured = await bridge.handleRequest(request('configure', 'provider.configure', {
    providerId: 'openai',
    displayName: 'OpenAI',
    adapterKind: 'openai',
    model: 'gpt-test',
    allowExternalNetwork: true,
  }));
  assert.equal(configured.ok, true);

  const tested = await bridge.handleRequest(request('test', 'provider.test', {
    providerId: 'openai',
  }));
  assert.equal(tested.ok, true);
  assert.equal(tested.result.status, 'healthy');
  assert.equal(tested.result.providerId, 'openai');
  assert.equal(JSON.stringify({ injected, configured, tested }).includes(rawSecret), false);

  await bridge.close();
  rmSync(dataDir, { recursive: true, force: true });
});

test('provider adapter is restored from the event store after a cold restart', async () => {
  const dataDir = mkdtempSync(path.join(tmpdir(), 'pulso-provider-restore-'));
  const firstCalls = [];
  const first = createDesktopBridge({
    dataDir,
    adapterFactory: fakeAdapterFactory(firstCalls),
  });
  const configured = await first.handleRequest(request('configure-persisted', 'provider.configure', {
    providerId: 'codex-fe',
    displayName: 'ChatGPT · Fe pessoal',
    adapterKind: 'codex_subscription',
    profileId: 'personal',
    model: 'gpt-6.1-sol',
    allowExternalNetwork: true,
  }));
  assert.equal(configured.ok, true);
  await first.close();

  const restoredCalls = [];
  const second = createDesktopBridge({
    dataDir,
    adapterFactory: fakeAdapterFactory(restoredCalls),
  });
  const boot = await second.handleRequest(request('boot-restored', 'bootstrap'));
  assert.equal(boot.ok, true);
  assert.equal(boot.result.health.status, 'running');
  assert.equal(restoredCalls.length, 1);
  assert.equal(restoredCalls[0].providerId, 'codex-fe');
  assert.equal(restoredCalls[0].adapterKind, 'codex_subscription');
  assert.equal(restoredCalls[0].model, 'gpt-6.1-sol');
  const tested = await second.handleRequest(request('test-restored', 'provider.test', { providerId: 'codex-fe' }));
  assert.equal(tested.ok, true);
  assert.equal(tested.result.status, 'healthy');

  await second.close();
  rmSync(dataDir, { recursive: true, force: true });
});

test('provider test fails closed when no adapter is configured', async () => {
  const dataDir = mkdtempSync(path.join(tmpdir(), 'pulso-provider-missing-'));
  const bridge = createDesktopBridge({ dataDir });
  const tested = await bridge.handleRequest(request('test-missing', 'provider.test', {
    providerId: 'missing',
  }));
  assert.equal(tested.ok, false);
  assert.equal(tested.error.code, 'PROVIDER_NOT_CONFIGURED');
  await bridge.close();
  rmSync(dataDir, { recursive: true, force: true });
});
