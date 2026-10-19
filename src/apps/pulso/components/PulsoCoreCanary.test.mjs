import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { registerHooks, stripTypeScriptTypes } from 'node:module';

import { createDesktopBridge } from '../../../../vendor/pulso-core/desktop/bridge.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../../..');

// Lightweight React harness for Node test execution without node_modules
const reactHarness = {
  currentState: undefined,
  pendingEffects: [],
  reset() {
    this.currentState = undefined;
    this.pendingEffects = [];
  },
  createElement(type, props, ...children) {
    return {
      type,
      props: props || {},
      children: children.flat(),
    };
  },
  useState(initialValue) {
    if (reactHarness.currentState === undefined) {
      reactHarness.currentState =
        typeof initialValue === 'function' ? initialValue() : initialValue;
    }
    const setState = (nextValue) => {
      reactHarness.currentState =
        typeof nextValue === 'function'
          ? nextValue(reactHarness.currentState)
          : nextValue;
    };
    return [reactHarness.currentState, setState];
  },
  useEffect(effectFn) {
    reactHarness.pendingEffects.push(effectFn);
  },
};

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'react') {
      return {
        url: 'data:text/javascript,export default globalThis.__PULSO_TEST_REACT__; export const useState = globalThis.__PULSO_TEST_REACT__.useState; export const useEffect = globalThis.__PULSO_TEST_REACT__.useEffect;',
        shortCircuit: true,
      };
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.endsWith('/PulsoCoreCanary.tsx')) {
      const rawSource = readFileSync(fileURLToPath(url), 'utf8');
      const jsxReplaced = rawSource.replace(
        /<output\s+className="sr-only"\s+data-pulso-core-status=\{snapshot\.status\}\s+aria-live="polite"\s+aria-atomic="true"\s*>\s*\{snapshot\.message\}\s*<\/output>/m,
        `React.createElement('output', { className: 'sr-only', 'data-pulso-core-status': snapshot.status, 'aria-live': 'polite', 'aria-atomic': 'true' }, snapshot.message)`
      );
      const stripped = stripTypeScriptTypes(jsxReplaced);
      return {
        format: 'module',
        source: stripped,
        shortCircuit: true,
      };
    }
    return nextLoad(url, context);
  },
});

globalThis.__PULSO_TEST_REACT__ = reactHarness;

const canaryModule = await import('./PulsoCoreCanary.tsx');
const {
  PulsoCoreCanary,
  runPulsoCoreCanaryProbe,
  evaluateCanaryBootstrapResult,
  acknowledgeRenderedCanary,
  createRenderedReceiptPayload,
  scheduleRenderedCanaryAcknowledgment,
  isTauriEnvironment,
  INITIAL_CANARY_SNAPSHOT,
} = canaryModule;

test('render acknowledgment sends exact bounded fields only for a connected snapshot', async () => {
  const calls = [];
  const receiver = {
    marker: 'canary-render-receiver',
    async invoke(command, args) {
      assert.equal(this.marker, 'canary-render-receiver');
      calls.push({ command, args });
      return { status: 'connected' };
    },
  };
  const connected = Object.freeze({
    status: 'connected',
    message: 'ready',
    activeAreaId: 'area_pulso',
    activeSessionId: 'session_geral',
    runtimeStatus: 'stopped',
    errorCode: null,
  });

  assert.deepEqual(createRenderedReceiptPayload(connected), {
    status: 'connected',
    activeAreaId: 'area_pulso',
    activeSessionId: 'session_geral',
    runtimeStatus: 'stopped',
  });
  assert.equal(
    await acknowledgeRenderedCanary({ __TAURI__: { core: receiver } }, connected),
    true
  );
  assert.deepEqual(calls, [
    {
      command: 'core_canary_rendered',
      args: {
        payload: {
          status: 'connected',
          activeAreaId: 'area_pulso',
          activeSessionId: 'session_geral',
          runtimeStatus: 'stopped',
        },
      },
    },
  ]);

  assert.equal(
    await acknowledgeRenderedCanary(
      { __TAURI__: { core: receiver } },
      INITIAL_CANARY_SNAPSHOT
    ),
    false
  );
  assert.equal(
    await acknowledgeRenderedCanary(
      { __TAURI__: { core: receiver } },
      {
        status: 'error',
        message: 'failed',
        activeAreaId: null,
        activeSessionId: null,
        runtimeStatus: null,
        errorCode: 'FAILED',
      }
    ),
    false
  );
  assert.equal(calls.length, 1);

  let scheduled = null;
  assert.equal(
    scheduleRenderedCanaryAcknowledgment(
      { __TAURI__: { core: receiver } },
      connected,
      (callback) => {
        scheduled = callback;
      }
    ),
    true
  );
  assert.equal(calls.length, 1);
  await scheduled();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls.length, 2);
  assert.equal(
    scheduleRenderedCanaryAcknowledgment(
      { __TAURI__: { core: receiver } },
      INITIAL_CANARY_SNAPSHOT,
      () => assert.fail('idle snapshot must not schedule a receipt')
    ),
    false
  );
});

test('Outside Tauri: PulsoCoreCanary remains idle and never invokes pulsoCoreClient.bootstrap', async () => {
  let bootstrapCalls = 0;
  const spyClient = {
    async bootstrap() {
      bootstrapCalls += 1;
      throw new Error('bootstrap must not be called outside Tauri');
    },
  };

  assert.equal(isTauriEnvironment({}), false);
  assert.equal(isTauriEnvironment(null), false);

  const states = [];
  const finalSnapshot = await runPulsoCoreCanaryProbe({
    scope: {},
    client: spyClient,
    onStateChange: (s) => states.push(s),
  });

  assert.equal(bootstrapCalls, 0);
  assert.equal(finalSnapshot.status, 'idle');
  assert.equal(states.length, 1);
  assert.equal(states[0].status, 'idle');
  assert.ok(finalSnapshot.message.length > 0);

  // Component render verification outside Tauri
  reactHarness.reset();
  const initialVNode = PulsoCoreCanary({ scope: {}, client: spyClient });
  assert.equal(initialVNode.type, 'output');
  assert.equal(initialVNode.props.className, 'sr-only');
  assert.equal(initialVNode.props['data-pulso-core-status'], 'idle');
  assert.equal(initialVNode.children.join(''), INITIAL_CANARY_SNAPSHOT.message);
});

test('Inside Tauri: PulsoCoreCanary transitions idle -> connecting -> connected with bounded wait and real Core bridge', async () => {
  const dataDir = mkdtempSync(path.join(tmpdir(), 'pulso-canary-test-'));
  const bridge = createDesktopBridge({ dataDir });

  const tauriScope = {
    __TAURI__: {},
  };

  let clock = 0;
  const states = [];

  const finalSnapshot = await runPulsoCoreCanaryProbe({
    scope: tauriScope,
    timeoutMs: 250,
    intervalMs: 50,
    now: () => clock,
    sleep: async (delayMs) => {
      clock += delayMs;
      if (clock === 100) {
        tauriScope.__TAURI__.core = {
          marker: 'tauri-canary',
          invoke(command, args) {
            assert.equal(this.marker, 'tauri-canary');
            assert.equal(command, 'bridge_request');
            return bridge.handleRequest(args.request);
          },
        };
      }
    },
    onStateChange: (s) => states.push(s),
  });

  assert.deepEqual(
    states.map((s) => s.status),
    ['connecting', 'connected']
  );
  assert.equal(finalSnapshot.status, 'connected');
  assert.equal(finalSnapshot.runtimeStatus, 'stopped');
  assert.equal(finalSnapshot.activeAreaId, 'area_pulso');
  assert.equal(finalSnapshot.activeSessionId, 'session_geral');
  assert.match(finalSnapshot.message, /PULSO Core conectado/);

  // Verify component output in connected state
  reactHarness.reset();
  reactHarness.currentState = finalSnapshot;
  const connectedVNode = PulsoCoreCanary({ scope: tauriScope });
  assert.equal(connectedVNode.type, 'output');
  assert.equal(connectedVNode.props.className, 'sr-only');
  assert.equal(connectedVNode.props['data-pulso-core-status'], 'connected');
  assert.match(connectedVNode.children.join(''), /PULSO Core conectado/);

  await bridge.close();
  rmSync(dataDir, { recursive: true, force: true });
});

test('connected strictly requires ok=true, live present, and health present; missing either fails closed to error', async () => {
  const missingLive = evaluateCanaryBootstrapResult({
    ok: true,
    status: 'ok',
    requestId: 'r-no-live',
    fallbackRequired: false,
    result: {
      health: { status: 'stopped' },
      live: null,
    },
  });
  assert.equal(missingLive.status, 'error');
  assert.equal(missingLive.errorCode, 'INCOMPLETE_BOOTSTRAP_PAYLOAD');

  const missingHealth = evaluateCanaryBootstrapResult({
    ok: true,
    status: 'ok',
    requestId: 'r-no-health',
    fallbackRequired: false,
    result: {
      health: null,
      live: {
        areas: [],
        sessions: [],
        activeAreaId: null,
        activeSessionId: null,
        messages: [],
        selection: { areaId: null, sessionId: null, selectedAt: '' },
      },
    },
  });
  assert.equal(missingHealth.status, 'error');
  assert.equal(missingHealth.errorCode, 'INCOMPLETE_BOOTSTRAP_PAYLOAD');

  const bridgeError = evaluateCanaryBootstrapResult({
    ok: false,
    status: 'bridge_error',
    requestId: 'r-err',
    fallbackRequired: true,
    error: {
      code: 'BRIDGE_INVOKE_FAILED',
      message: 'Bundled Node sidecar not found',
      retryable: false,
    },
  });
  assert.equal(bridgeError.status, 'error');
  assert.equal(bridgeError.errorCode, 'BRIDGE_INVOKE_FAILED');
  assert.match(bridgeError.message, /Bundled Node sidecar not found/);

  // Bounded timeout when __TAURI__ marker exists without invoke
  let clock = 0;
  const states = [];
  const timeoutSnapshot = await runPulsoCoreCanaryProbe({
    scope: { __TAURI__: {} },
    timeoutMs: 120,
    intervalMs: 50,
    now: () => clock,
    sleep: async (delayMs) => {
      clock += delayMs;
    },
    onStateChange: (s) => states.push(s),
  });
  assert.equal(clock, 120);
  assert.deepEqual(
    states.map((s) => s.status),
    ['connecting', 'error']
  );
  assert.equal(timeoutSnapshot.status, 'error');
  assert.equal(timeoutSnapshot.errorCode, 'BRIDGE_TIMEOUT');
});

test('Structural and visual non-regression: PulsoCoreCanary is sr-only output and /pulso/live page preserves layout', () => {
  const canarySource = readFileSync(
    path.join(repoRoot, 'src', 'apps', 'pulso', 'components', 'PulsoCoreCanary.tsx'),
    'utf8'
  );
  assert.match(canarySource, /<output/);
  assert.match(canarySource, /className="sr-only"/);
  assert.match(canarySource, /data-pulso-core-status=\{snapshot\.status\}/);
  assert.match(canarySource, /aria-live="polite"/);

  const liveRouteSource = readFileSync(
    path.join(repoRoot, 'src', 'app', 'pulso', 'live', 'page.tsx'),
    'utf8'
  );
  assert.match(liveRouteSource, /<LivePage\s*\/>/);
  assert.match(liveRouteSource, /<PulsoCoreCanary\s*\/>/);
  assert.match(
    liveRouteSource,
    /<div className="theme-her h-\[100dvh\] overflow-hidden" aria-label="Abrindo Pulso" \/>/
  );
});
