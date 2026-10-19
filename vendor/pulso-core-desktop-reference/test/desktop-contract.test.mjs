import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import {
  BRIDGE_METHODS,
  validateBridgeRequest,
  validateBridgeResponse
} from '../desktop/bridge-contract.mjs';
const tauriInvokeSource = readFileSync(new URL('../desktop-ui/tauri-invoke.js', import.meta.url), 'utf8');

function loadTauriInvoke(scope = {}) {
  runInNewContext(tauriInvokeSource, scope);
  return { scope, ...scope.PulsoTauriInvoke };
}

test('resolveTauriInvoke prefers the public Tauri core API and preserves receiver and arguments', async () => {
  const calls = [];
  const core = {
    marker: 'public',
    invoke(command, args) {
      calls.push({ receiver: this.marker, command, args });
      return Promise.resolve('public-ok');
    }
  };
  const internals = {
    marker: 'internal',
    invoke() {
      throw new Error('public API must win');
    }
  };

  const { resolveTauriInvoke } = loadTauriInvoke();
  const invoke = resolveTauriInvoke({ __TAURI__: { core }, __TAURI_INTERNALS__: internals });
  assert.equal(await invoke('bridge_request', { request: 1 }), 'public-ok');
  assert.deepEqual(calls, [{ receiver: 'public', command: 'bridge_request', args: { request: 1 } }]);
});

test('resolveTauriInvoke uses Tauri internals when the optional public global is absent', async () => {
  const calls = [];
  const internals = {
    marker: 'internal',
    invoke(command, args) {
      calls.push({ receiver: this.marker, command, args });
      return Promise.resolve('internal-ok');
    }
  };

  const { resolveTauriInvoke } = loadTauriInvoke();
  const invoke = resolveTauriInvoke({ __TAURI_INTERNALS__: internals });
  assert.equal(await invoke('provider_secret_status', { providerId: 'openai' }), 'internal-ok');
  assert.deepEqual(calls, [{
    receiver: 'internal',
    command: 'provider_secret_status',
    args: { providerId: 'openai' }
  }]);
});

test('resolveTauriInvoke returns null outside a Tauri webview', () => {
  const { resolveTauriInvoke } = loadTauriInvoke();
  assert.equal(resolveTauriInvoke({}), null);
  assert.equal(resolveTauriInvoke(null), null);
});

test('waitForTauriInvoke detects an API that appears after DOM readiness', async () => {
  const { scope, waitForTauriInvoke } = loadTauriInvoke();
  let clock = 0;
  const invokeImpl = () => Promise.resolve('late-ok');

  const invoke = await waitForTauriInvoke(scope, {
    timeoutMs: 200,
    intervalMs: 50,
    now: () => clock,
    sleep: async (delayMs) => {
      clock += delayMs;
      if (clock === 100) scope.__TAURI_INTERNALS__ = { invoke: invokeImpl };
    }
  });

  assert.equal(typeof invoke, 'function');
  assert.equal(await invoke('store_provider_secret', { providerId: 'openai' }), 'late-ok');
});

test('waitForTauriInvoke stops at its bounded timeout when the API stays absent', async () => {
  const { waitForTauriInvoke } = loadTauriInvoke();
  let clock = 0;
  const invoke = await waitForTauriInvoke({}, {
    timeoutMs: 120,
    intervalMs: 50,
    now: () => clock,
    sleep: async (delayMs) => {
      clock += delayMs;
    }
  });

  assert.equal(invoke, null);
  assert.equal(clock, 120);
});

test('BRIDGE_METHODS contains exact frozen list of methods', () => {
  const expectedMethods = [
    'bootstrap',
    'snapshot',
    'health',
    'shutdown',
    'runtime.start',
    'runtime.stop',
    'control.command',
    'provider.configure',
    'provider.select',
    'provider.test',
    'provider.remove',
    'provider.secret.inject',
    'outbox.enqueue',
    'outbox.drain',
    'outbox.cancel',
    'agent.create_blueprint',
    'agent.publish_revision',
    'agent.materialize',
    'agent.transition',
    'audit.list',
    'live.bootstrap',
    'live.area.create',
    'live.session.create',
    'live.session.select',
    'live.message.append',
    'live.messages.list'
  ];

  assert.deepEqual(BRIDGE_METHODS, expectedMethods);
  assert.equal(Object.isFrozen(BRIDGE_METHODS), true);
  assert.throws(() => {
    BRIDGE_METHODS.push('invalid.method');
  }, TypeError);
});

test('validateBridgeRequest accepts valid requests and returns frozen objects', () => {
  for (const method of BRIDGE_METHODS) {
    const input = {
      requestId: 'req-123',
      method,
      params: { key: 'value', nested: { count: 1 } }
    };
    const validated = validateBridgeRequest(input);

    assert.equal(validated.requestId, 'req-123');
    assert.equal(validated.method, method);
    assert.deepEqual(validated.params, { key: 'value', nested: { count: 1 } });
    assert.equal(Object.isFrozen(validated), true);
    assert.equal(Object.isFrozen(validated.params), true);
    assert.equal(Object.isFrozen(validated.params.nested), true);

    // Defensive copy check: modifying original shouldn't affect validated
    input.params.key = 'mutated';
    assert.equal(validated.params.key, 'value');
  }
});

test('validateBridgeRequest rejects unknown method', () => {
  assert.throws(
    () => validateBridgeRequest({ requestId: 'r1', method: 'unknown.method', params: {} }),
    /Unknown or invalid bridge method: unknown\.method/
  );
  assert.throws(
    () => validateBridgeRequest({ requestId: 'r1', method: '', params: {} }),
    /Unknown or invalid bridge method/
  );
  assert.throws(
    () => validateBridgeRequest({ requestId: 'r1', method: 123, params: {} }),
    /Unknown or invalid bridge method/
  );
});

test('validateBridgeRequest validates requestId and params types', () => {
  assert.throws(() => validateBridgeRequest(null), TypeError);
  assert.throws(() => validateBridgeRequest('string'), TypeError);
  assert.throws(() => validateBridgeRequest({ requestId: '', method: 'health', params: {} }), TypeError);
  assert.throws(() => validateBridgeRequest({ requestId: '   ', method: 'health', params: {} }), TypeError);
  assert.throws(() => validateBridgeRequest({ requestId: null, method: 'health', params: {} }), TypeError);
  assert.throws(() => validateBridgeRequest({ requestId: 'r1', method: 'health', params: null }), TypeError);
  assert.throws(() => validateBridgeRequest({ requestId: 'r1', method: 'health', params: [1, 2] }), TypeError);
  assert.throws(() => validateBridgeRequest({ requestId: 'r1', method: 'health', params: 'invalid' }), TypeError);
});

test('validateBridgeResponse handles success responses', () => {
  const successRes = {
    requestId: 'req-123',
    ok: true,
    result: { status: 'healthy', details: { uptime: 100 } }
  };

  const validated = validateBridgeResponse(successRes);
  assert.equal(validated.requestId, 'req-123');
  assert.equal(validated.ok, true);
  assert.deepEqual(validated.result, { status: 'healthy', details: { uptime: 100 } });
  assert.equal(Object.isFrozen(validated), true);
  assert.equal(Object.isFrozen(validated.result), true);
  assert.equal(Object.isFrozen(validated.result.details), true);

  // Defensive copy check
  successRes.result.status = 'mutated';
  assert.equal(validated.result.status, 'healthy');

  // Success with primitive result
  const primitiveResult = validateBridgeResponse({
    requestId: 'req-primitive',
    ok: true,
    result: 42
  });
  assert.equal(primitiveResult.result, 42);
});

test('validateBridgeResponse handles error responses', () => {
  const errorRes = {
    requestId: 'req-123',
    ok: false,
    error: {
      code: 'ERR_TIMEOUT',
      message: 'Operation timed out',
      retryable: true
    }
  };

  const validated = validateBridgeResponse(errorRes);
  assert.equal(validated.requestId, 'req-123');
  assert.equal(validated.ok, false);
  assert.deepEqual(validated.error, {
    code: 'ERR_TIMEOUT',
    message: 'Operation timed out',
    retryable: true
  });
  assert.equal(Object.isFrozen(validated), true);
  assert.equal(Object.isFrozen(validated.error), true);
});

test('validateBridgeResponse rejects invalid responses', () => {
  assert.throws(() => validateBridgeResponse(null), TypeError);
  assert.throws(() => validateBridgeResponse({}), TypeError);
  assert.throws(() => validateBridgeResponse({ requestId: '', ok: true, result: {} }), TypeError);
  assert.throws(() => validateBridgeResponse({ requestId: 'r1', ok: 'not-bool', result: {} }), TypeError);
  assert.throws(() => validateBridgeResponse({ requestId: 'r1', ok: true }), TypeError); // missing result

  // Invalid error structures
  assert.throws(() => validateBridgeResponse({ requestId: 'r1', ok: false }), TypeError);
  assert.throws(() => validateBridgeResponse({ requestId: 'r1', ok: false, error: null }), TypeError);
  assert.throws(
    () => validateBridgeResponse({ requestId: 'r1', ok: false, error: { code: '', message: 'msg', retryable: true } }),
    TypeError
  );
  assert.throws(
    () => validateBridgeResponse({ requestId: 'r1', ok: false, error: { code: 'E', message: 123, retryable: true } }),
    TypeError
  );
  assert.throws(
    () => validateBridgeResponse({ requestId: 'r1', ok: false, error: { code: 'E', message: 'msg', retryable: 'true' } }),
    TypeError
  );
});

const htmlSource = readFileSync(new URL('../desktop-ui/index.html', import.meta.url), 'utf8');
const identityCssSource = readFileSync(new URL('../desktop-ui/pulso-identity.css', import.meta.url), 'utf8');
const stylesCssSource = readFileSync(new URL('../desktop-ui/styles.css', import.meta.url), 'utf8');
const appJsSource = readFileSync(new URL('../desktop-ui/app.js', import.meta.url), 'utf8');

test('Identidade visual PULSO v1: tokens exatos presentes em pulso-identity.css', () => {
  // Cor de campo padrão
  assert.match(identityCssSource, /#b8283e/);
  // Branco quente
  assert.match(identityCssSource, /#fbf9f5/);
  // Vazio / tema negro
  assert.match(identityCssSource, /#0f0f0f/);
  // Texto mudo e texto baixo
  assert.match(identityCssSource, /rgba\(\s*251\s*,\s*249\s*,\s*245\s*,\s*0\.60?\s*\)/);
  assert.match(identityCssSource, /rgba\(\s*251\s*,\s*249\s*,\s*245\s*,\s*0\.40?\s*\)/);
  // Vidro PULSO
  assert.match(identityCssSource, /rgba\(\s*12\s*,\s*12\s*,\s*12\s*,\s*0\.42\s*\)/);
  assert.match(identityCssSource, /blur\(32px\)\s+saturate\(125%\)/);
  assert.match(identityCssSource, /rgba\(\s*251\s*,\s*249\s*,\s*245\s*,\s*0\.10?\s*\)/);
  // Vidro de rodapé
  assert.match(identityCssSource, /blur\(24px\)\s+saturate\(118%\)/);
  // Movimento de entrada e de superfícies
  assert.match(identityCssSource, /420ms\s+cubic-bezier\(0\.4,\s*0,\s*0\.2,\s*1\)/);
  assert.match(identityCssSource, /1000ms\s+cubic-bezier\(0\.4,\s*0,\s*0\.2,\s*1\)/);
  // Orbe timings
  assert.match(identityCssSource, /7s/);
  assert.match(identityCssSource, /2\.5s/);
  assert.match(identityCssSource, /4\.5s/);
  assert.match(identityCssSource, /1\.6s/);
  assert.match(identityCssSource, /1\.8s/);
  assert.match(identityCssSource, /prefers-reduced-motion/);
  assert.match(identityCssSource, /1ms/);
});

test('Identidade visual PULSO v1: stylesheets carregados em ordem no index.html', () => {
  assert.match(htmlSource, /<link\s+rel=["']stylesheet["']\s+href=["']pulso-identity\.css["']/);
  assert.match(htmlSource, /<link\s+rel=["']stylesheet["']\s+href=["']styles\.css["']/);
  const identityIdx = htmlSource.indexOf('pulso-identity.css');
  const stylesIdx = htmlSource.indexOf('styles.css');
  assert.ok(identityIdx !== -1 && stylesIdx !== -1 && identityIdx < stylesIdx);
});

test('Identidade visual PULSO v1: ações formatadas rigorosamente entre colchetes', () => {
  assert.match(htmlSource, /id=["']btn-header-refresh["'][^>]*>\s*\[\s*atualizar\s*\]\s*<\/button>/);
  assert.match(htmlSource, /id=["']btn-runtime-start["'][^>]*>\s*\[\s*ligar\s*\]\s*<\/button>/);
  assert.match(htmlSource, /id=["']btn-runtime-stop["'][^>]*>\s*\[\s*parar\s*\]\s*<\/button>/);
  assert.match(htmlSource, /id=["']btn-save-provider["'][^>]*>\s*\[\s*salvar\s+configuração\s*\]\s*<\/button>/);
  // Ações dinâmicas no canvas também usam colchetes
  assert.match(appJsSource, /\[\s*atualizar\s*\]/);
  assert.match(appJsSource, /`\[\s*\$\{\s*String\(/);
});

test('Identidade visual PULSO v1: orbe de presença persistente única com data-state e aria-label', () => {
  const matches = [...htmlSource.matchAll(/id=["']lotus-presence-orb["']/g)];
  assert.equal(matches.length, 1, 'Deve existir exatamente uma instância da orbe no DOM');
  assert.match(htmlSource, /id=["']lotus-presence-orb["'][^>]*aria-label=/);
  assert.match(htmlSource, /id=["']lotus-presence-orb["'][^>]*data-state=/);
  // Sincronização em app.js
  assert.match(appJsSource, /setOrbState\(/);
  assert.match(appJsSource, /elements\.lotusPresenceOrb/);
  // Runtime ligado usa estado idle com aria-label 'lótus operacional em repouso'
  assert.match(appJsSource, /setOrbState\(['"]idle['"],\s*['"]lótus operacional em repouso['"]\)/);
  // Rótulo visual na interface exibe 'identidade v1'
  assert.match(htmlSource, /class=["']brand-version["']>identidade v1<\/span>/);
});

test('Identidade visual PULSO v1: campo carmim dominante e ausência de --bg-field #0f0f0f', () => {
  // body/campo usa var(--pulso-field) como background dominante
  assert.match(stylesCssSource, /background-color:\s*var\(--pulso-field\)/);
  // Não há --bg-field #0f0f0f em nenhum stylesheet
  assert.equal(stylesCssSource.includes('--bg-field'), false, 'styles.css não deve conter --bg-field');
  assert.equal(stylesCssSource.includes('#0f0f0f'), false, 'styles.css não deve redefinir #0f0f0f');
  assert.equal(identityCssSource.includes('--bg-field'), false, 'pulso-identity.css não deve conter --bg-field');
});

test('Identidade visual PULSO v1: orbe como camada autônoma fora de .header-brand com dimensão >=112px e halo branco quente', () => {
  // orbe NÃO está dentro de .header-brand
  const headerBrandMatch = htmlSource.match(/<div class=["']header-brand["']>([\s\S]*?)<\/div>/);
  assert.ok(headerBrandMatch, 'header-brand deve existir no html');
  assert.equal(headerBrandMatch[1].includes('lotus-presence-orb'), false, 'orbe NÃO deve estar dentro de .header-brand');

  // dimensão >= 112px
  const dimMatch = identityCssSource.match(/#lotus-presence-orb[\s\S]*?width:\s*(\d+)px/);
  assert.ok(dimMatch, 'deve definir width em px para a orbe');
  const orbWidth = parseInt(dimMatch[1], 10);
  assert.ok(orbWidth >= 112 && orbWidth <= 148, `dimensão da orbe deve estar entre 112px e 148px (encontrado ${orbWidth}px)`);

  // halo branco quente
  const orbHaloMatch = identityCssSource.match(/#lotus-presence-orb[\s\S]*?box-shadow:\s*0\s+0\s+\d+px\s+rgba\(\s*251\s*,\s*249\s*,\s*245/);
  assert.ok(orbHaloMatch, 'halo padrão da orbe deve usar branco quente rgba(251, 249, 245, ...)');
});

test('Identidade visual PULSO v1: active rail utiliza indicador em branco quente', () => {
  const activeRailMatch = stylesCssSource.match(/\.nav-item\.active[\s\S]*?border-left:\s*2px\s+solid\s+rgba\(\s*251\s*,\s*249\s*,\s*245/);
  assert.ok(activeRailMatch, 'active rail deve usar indicador em branco quente');
});

test('Identidade visual PULSO v1: overlay glass e lentes flutuantes sem placa preta chapada', () => {
  assert.match(htmlSource, /class=["'][^"']*fatal-card[^"']*pulso-lens[^"']*["']/);
  assert.match(htmlSource, /class=["'][^"']*right-inspector[^"']*pulso-lens[^"']*["']/);
  assert.match(stylesCssSource, /--glass-bg:\s*var\(--pulso-glass-bg\)/);
  assert.match(stylesCssSource, /--glass-blur:\s*var\(--pulso-glass-blur\)/);
});

test('Identidade visual PULSO v1: ausência estrita de accent-purple, Dark Violet, #8e68f3 e grid de metric-card', () => {
  const allDesktopUiSources = [
    { name: 'index.html', src: htmlSource },
    { name: 'pulso-identity.css', src: identityCssSource },
    { name: 'styles.css', src: stylesCssSource },
    { name: 'app.js', src: appJsSource },
  ];

  for (const { name, src } of allDesktopUiSources) {
    assert.equal(src.includes('accent-purple'), false, `${name} não deve conter accent-purple`);
    assert.equal(src.includes('Dark Violet'), false, `${name} não deve conter Dark Violet`);
    assert.equal(src.includes('#8e68f3'), false, `${name} não deve conter #8e68f3`);
    assert.equal(src.includes('metric-card'), false, `${name} não deve conter metric-card`);
  }
});

test('Interface v0.7: /live é home principal, Central é overlay atrás de [ configurações ]', () => {
  // /live shell existe e está visível
  assert.match(htmlSource, /id=["']live-shell["']/);

  // IDs obrigatórios de áreas, sessões, conversa, orbe e composer existem
  assert.match(htmlSource, /id=["']live-areas-rail["']/);
  assert.match(htmlSource, /id=["']live-areas-list["']/);
  assert.match(htmlSource, /id=["']live-sessions-sidebar["']/);
  assert.match(htmlSource, /id=["']live-sessions-list["']/);
  assert.match(htmlSource, /id=["']live-conversation["']/);
  assert.match(htmlSource, /id=["']lotus-presence-orb["']/);
  assert.match(htmlSource, /id=["']live-composer["']/);
  assert.match(htmlSource, /id=["']live-composer-input["']/);
  assert.match(htmlSource, /id=["']btn-live-send["']/);

  // Botão [ configurações ] existe no header
  assert.match(htmlSource, /id=["']btn-open-settings["'][^>]*>\s*\[\s*configurações\s*\]\s*<\/button>/);

  // Central NÃO é a home: reside dentro de #central-overlay que inicia oculto (hidden)
  assert.match(htmlSource, /id=["']central-overlay["'][^>]*hidden/);

  // Botão [ fechar ] da Central existe
  assert.match(htmlSource, /id=["']btn-close-settings["'][^>]*>\s*\[\s*fechar\s*\]\s*<\/button>/);

  // Estado vazio honesto existe
  assert.match(htmlSource, /id=["']live-empty-state["']/);

  // Nenhum texto finge resposta da Lótus sem provider
  assert.equal(htmlSource.includes('resposta simulada'), false);
  assert.equal(appJsSource.includes('resposta simulada'), false);
  assert.equal(appJsSource.includes('fake lotus'), false);
  assert.match(appJsSource, /awaiting_provider/);
});

test('Interface v0.7: todos os IDs usados por document.getElementById em app.js existem em index.html', () => {
  const appJsIds = [...appJsSource.matchAll(/document\.getElementById\(['"]([^'"]+)['"]\)/g)].map(m => m[1]);
  const htmlIds = new Set([...htmlSource.matchAll(/\bid=["']([^'"]+)['"]/g)].map(m => m[1]));

  const missing = [...new Set(appJsIds.filter(id => !htmlIds.has(id)))];
  assert.deepEqual(missing, [], `IDs presentes em app.js mas ausentes em index.html: ${missing.join(', ')}`);
});
