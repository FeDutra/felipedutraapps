import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  BRIDGE_METHODS,
  resolveTauriInvoke,
  isTauriBridgeAvailable,
  waitForTauriInvoke,
  validateBridgeRequest,
  validateBridgeResponse,
  createPulsoCoreClient,
} from './pulsoCoreClient.ts';

import {
  BRIDGE_METHODS as REFERENCE_BRIDGE_METHODS,
  validateBridgeRequest as referenceValidateRequest,
  validateBridgeResponse as referenceValidateResponse,
} from '../../../../vendor/pulso-core/desktop/bridge-contract.mjs';

import { createDesktopBridge } from '../../../../vendor/pulso-core/desktop/bridge.mjs';

const makeTempDir = () => mkdtempSync(join(tmpdir(), 'pulso-core-client-test-'));

test('resolveTauriInvoke prefers public __TAURI__.core.invoke and preserves receiver (this) and arguments', async () => {
  const calls = [];
  const core = {
    marker: 'public-core',
    invoke(command, args) {
      calls.push({ receiver: this.marker, command, args });
      return Promise.resolve({ ok: true, source: this.marker });
    },
  };
  const internals = {
    marker: 'internal-core',
    invoke() {
      throw new Error('__TAURI_INTERNALS__ must not be called when __TAURI__.core.invoke is present');
    },
  };

  const scope = { __TAURI__: { core }, __TAURI_INTERNALS__: internals };
  assert.equal(isTauriBridgeAvailable(scope), true);

  const invoke = resolveTauriInvoke(scope);
  assert.equal(typeof invoke, 'function');

  const res = await invoke('bridge_request', { request: { requestId: 'r1' } });
  assert.deepEqual(res, { ok: true, source: 'public-core' });
  assert.deepEqual(calls, [
    {
      receiver: 'public-core',
      command: 'bridge_request',
      args: { request: { requestId: 'r1' } },
    },
  ]);
});

test('resolveTauriInvoke falls back to __TAURI_INTERNALS__.invoke and preserves receiver (this)', async () => {
  const calls = [];
  const internals = {
    marker: 'internal-only',
    invoke(command, args) {
      calls.push({ receiver: this.marker, command, args });
      return Promise.resolve('internal-ok');
    },
  };

  const scope = { __TAURI_INTERNALS__: internals };
  assert.equal(isTauriBridgeAvailable(scope), true);

  const invoke = resolveTauriInvoke(scope);
  assert.equal(typeof invoke, 'function');
  assert.equal(await invoke('bridge_request', { ping: 1 }), 'internal-ok');
  assert.deepEqual(calls, [
    {
      receiver: 'internal-only',
      command: 'bridge_request',
      args: { ping: 1 },
    },
  ]);
});

test('resolveTauriInvoke returns null outside a Tauri v2 webview', () => {
  assert.equal(resolveTauriInvoke({}), null);
  assert.equal(resolveTauriInvoke(null), null);
  assert.equal(resolveTauriInvoke({ __TAURI__: {} }), null);
  assert.equal(isTauriBridgeAvailable({}), false);
});

test('waitForTauriInvoke detects late Tauri injection and stops at bounded timeout when absent', async () => {
  const scope = {};
  let clock = 0;

  const lateInvoke = await waitForTauriInvoke(scope, {
    timeoutMs: 200,
    intervalMs: 50,
    now: () => clock,
    sleep: async (delayMs) => {
      clock += delayMs;
      if (clock === 100) {
        scope.__TAURI_INTERNALS__ = {
          tag: 'late-internals',
          invoke(cmd) {
            return Promise.resolve(`${this.tag}:${cmd}`);
          },
        };
      }
    },
  });

  assert.equal(typeof lateInvoke, 'function');
  assert.equal(await lateInvoke('bridge_request'), 'late-internals:bridge_request');

  let absentClock = 0;
  const absentInvoke = await waitForTauriInvoke({}, {
    timeoutMs: 120,
    intervalMs: 50,
    now: () => absentClock,
    sleep: async (delayMs) => {
      absentClock += delayMs;
    },
  });

  assert.equal(absentInvoke, null);
  assert.equal(absentClock, 120);
});

test('BRIDGE_METHODS and validators match the vendored reference contract', () => {
  assert.deepEqual(BRIDGE_METHODS, REFERENCE_BRIDGE_METHODS);
  assert.equal(Object.isFrozen(BRIDGE_METHODS), true);

  for (const method of BRIDGE_METHODS) {
    const rawReq = {
      requestId: `req-${method}`,
      method,
      params: { nested: { value: 1 } },
    };
    const clientValidated = validateBridgeRequest(rawReq);
    const refValidated = referenceValidateRequest(rawReq);
    assert.deepEqual(clientValidated, refValidated);
    assert.equal(Object.isFrozen(clientValidated), true);
    assert.equal(Object.isFrozen(clientValidated.params), true);
  }

  const okEnvelope = {
    requestId: 'req-ok',
    ok: true,
    result: { status: 'stopped' },
  };
  assert.deepEqual(validateBridgeResponse(okEnvelope), referenceValidateResponse(okEnvelope));

  const errEnvelope = {
    requestId: 'req-err',
    ok: false,
    error: { code: 'NOT_IMPLEMENTED', message: 'Not implemented', retryable: false },
  };
  assert.deepEqual(validateBridgeResponse(errEnvelope), referenceValidateResponse(errEnvelope));
});

test('pulsoCoreClient fails closed with discriminated result when Tauri bridge is absent', async () => {
  const client = createPulsoCoreClient({ scope: {} });
  assert.equal(client.isAvailable(), false);

  const bs = await client.bootstrap('bs-absent-1');
  assert.equal(bs.ok, false);
  if (!bs.ok) {
    assert.equal(bs.status, 'bridge_unavailable');
    assert.equal(bs.requestId, 'bs-absent-1');
    assert.equal(bs.fallbackRequired, true);
    assert.equal(bs.error.code, 'BRIDGE_UNAVAILABLE');
    assert.equal(bs.error.retryable, false);
  }

  const st = await client.status('status-absent-1');
  assert.equal(st.ok, false);
  if (!st.ok) {
    assert.equal(st.status, 'bridge_unavailable');
    assert.equal(st.fallbackRequired, true);
  }

  const liveBs = await client.liveBootstrap('live-absent-1');
  assert.equal(liveBs.ok, false);
  if (!liveBs.ok) {
    assert.equal(liveBs.status, 'bridge_unavailable');
    assert.equal(liveBs.fallbackRequired, true);
  }
});

test('pulsoCoreClient fails closed when invoke throws or returns malformed response', async () => {
  const throwingClient = createPulsoCoreClient({
    scope: {
      __TAURI_INTERNALS__: {
        invoke() {
          return Promise.reject(new Error('Bundled Node sidecar not found'));
        },
      },
    },
  });

  const throwRes = await throwingClient.status('req-throw');
  assert.equal(throwRes.ok, false);
  if (!throwRes.ok) {
    assert.equal(throwRes.status, 'bridge_error');
    assert.equal(throwRes.fallbackRequired, true);
    assert.equal(throwRes.error.code, 'BRIDGE_INVOKE_FAILED');
    assert.match(throwRes.error.message, /Bundled Node sidecar not found/);
  }

  const malformedClient = createPulsoCoreClient({
    scope: {
      __TAURI_INTERNALS__: {
        invoke() {
          return Promise.resolve({ unexpected: true });
        },
      },
    },
  });

  const malformedRes = await malformedClient.bootstrap('req-malformed');
  assert.equal(malformedRes.ok, false);
  if (!malformedRes.ok) {
    assert.equal(malformedRes.status, 'bridge_error');
    assert.equal(malformedRes.fallbackRequired, true);
    assert.equal(malformedRes.error.code, 'INVALID_BRIDGE_RESPONSE');
  }
});

test('pulsoCoreClient integrates end-to-end with vendored PulsoDesktopBridge for bootstrap, status/health, live.*, and restart', async () => {
  const dataDir = makeTempDir();
  let bridge = createDesktopBridge({ dataDir });

  const tauriScope = {
    __TAURI__: {
      core: {
        contextMarker: 'tauri-v2-core',
        async invoke(command, args) {
          assert.equal(this.contextMarker, 'tauri-v2-core');
          assert.equal(command, 'bridge_request');
          return bridge.handleRequest(args.request);
        },
      },
    },
  };

  const client = createPulsoCoreClient({ scope: tauriScope });
  assert.equal(client.isAvailable(), true);

  // 1. Bootstrap full Core + Live snapshot
  const bs = await client.bootstrap('req-bs-1');
  assert.equal(bs.ok, true);
  if (bs.ok) {
    assert.equal(bs.status, 'ok');
    assert.equal(bs.fallbackRequired, false);
    assert.equal(bs.result.health.status, 'stopped');
    assert.equal(bs.result.panel?.sectionCount, 11);
    assert.equal(bs.result.live.activeAreaId, 'area_pulso');
    assert.equal(bs.result.live.activeSessionId, 'session_geral');
  }

  // 2. Status / health check
  const statusRes = await client.status('req-status-1');
  assert.equal(statusRes.ok, true);
  if (statusRes.ok) {
    assert.equal(statusRes.result.status, 'stopped');
  }

  // 3. Create area, session, select, append message, and list messages
  const areaRes = await client.createArea(
    { id: 'area_obra', nome: 'OBRA', glifo: '◇', ordem: 1 },
    'req-area-1'
  );
  assert.equal(areaRes.ok, true);
  if (areaRes.ok) {
    assert.equal(areaRes.result.id, 'area_obra');
    assert.equal(areaRes.result.nome, 'OBRA');
  }

  const sessionRes = await client.createSession(
    { id: 'session_obra_1', areaId: 'area_obra', titulo: 'arquitetura' },
    'req-session-1'
  );
  assert.equal(sessionRes.ok, true);
  if (sessionRes.ok) {
    assert.equal(sessionRes.result.id, 'session_obra_1');
    assert.equal(sessionRes.result.identityId, 'lotus');
  }

  const selectRes = await client.selectSession(
    { areaId: 'area_obra', sessionId: 'session_obra_1' },
    'req-select-1'
  );
  assert.equal(selectRes.ok, true);
  if (selectRes.ok) {
    assert.equal(selectRes.result.areaId, 'area_obra');
    assert.equal(selectRes.result.sessionId, 'session_obra_1');
  }

  const msgRes = await client.appendMessage(
    {
      sessionId: 'session_obra_1',
      role: 'human',
      texto: 'Validar ponte tipada sem regressão visual',
    },
    'req-msg-1'
  );
  assert.equal(msgRes.ok, true);
  if (msgRes.ok) {
    assert.equal(msgRes.result.message.texto, 'Validar ponte tipada sem regressão visual');
    assert.equal(msgRes.result.receipt.status, 'awaiting_provider');
  }

  const listRes = await client.listMessages({ sessionId: 'session_obra_1' }, 'req-list-1');
  assert.equal(listRes.ok, true);
  if (listRes.ok) {
    assert.equal(listRes.result.length, 1);
    assert.equal(listRes.result[0].texto, 'Validar ponte tipada sem regressão visual');
  }

  // 4. Simulated sidecar restart preserves SQLite state
  await client.shutdown('req-shutdown-1');
  bridge = createDesktopBridge({ dataDir });

  const liveAfterRestart = await client.liveBootstrap('req-live-bs-2');
  assert.equal(liveAfterRestart.ok, true);
  if (liveAfterRestart.ok) {
    assert.equal(liveAfterRestart.result.areas.length, 2);
    assert.equal(liveAfterRestart.result.activeAreaId, 'area_obra');
    assert.equal(liveAfterRestart.result.activeSessionId, 'session_obra_1');
    assert.equal(liveAfterRestart.result.messages.length, 1);
    assert.equal(
      liveAfterRestart.result.messages[0].texto,
      'Validar ponte tipada sem regressão visual'
    );
  }

  await bridge.close();
});

test('live.topology.ensure adopts legacy entities by canonical id without duplicating them', async () => {
  const dataDir = makeTempDir();
  const bridge = createDesktopBridge({ dataDir });
  const client = createPulsoCoreClient({
    scope: {
      __TAURI__: {
        core: {
          invoke(_command, args) {
            return bridge.handleRequest(args.request);
          },
        },
      },
    },
  });

  await client.bootstrap('req-topology-bootstrap');
  const legacyArea = await client.createArea(
    { id: 'area_eu', nome: 'eu legado', glifo: '⊙', ordem: 1 },
    'req-topology-legacy-area'
  );
  assert.equal(legacyArea.ok, true);
  const legacySession = await client.createSession(
    { id: 'eu_geral', areaId: 'area_eu', titulo: 'geral legado' },
    'req-topology-legacy-session'
  );
  assert.equal(legacySession.ok, true);

  const ensured = await client.ensureTopology({
    areas: [
      { id: 'area_eu', nome: 'eu', glifo: '⊙', ordem: 0 },
      { id: 'area_casa', nome: 'casa', glifo: '⌂', ordem: 1 },
    ],
    sessions: [
      { id: 'eu_geral', areaId: 'area_eu', titulo: 'geral' },
      { id: 'casa_geral', areaId: 'area_casa', titulo: 'geral' },
    ],
  }, 'req-topology-ensure');

  assert.equal(ensured.ok, true);
  if (ensured.ok) {
    assert.equal(ensured.result.areas.filter(area => area.id === 'area_eu').length, 1);
    assert.equal(ensured.result.sessions.filter(session => session.id === 'eu_geral').length, 1);
    assert.equal(ensured.result.areas.find(area => area.id === 'area_eu')?.nome, 'eu legado');
    assert.equal(ensured.result.sessions.find(session => session.id === 'eu_geral')?.titulo, 'geral legado');
    assert.ok(ensured.result.areas.some(area => area.id === 'area_casa'));
    assert.ok(ensured.result.sessions.some(session => session.id === 'casa_geral'));
  }

  const repeated = await client.ensureTopology({
    areas: [{ id: 'area_eu', nome: 'eu', glifo: '⊙', ordem: 0 }],
    sessions: [{ id: 'eu_geral', areaId: 'area_eu', titulo: 'geral' }],
  }, 'req-topology-repeat');
  assert.equal(repeated.ok, true);
  if (repeated.ok) {
    assert.equal(repeated.result.areas.filter(area => area.id === 'area_eu').length, 1);
    assert.equal(repeated.result.sessions.filter(session => session.id === 'eu_geral').length, 1);
  }

  await bridge.close();
});
