import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveKokoroVoiceForProvider } from '../../TTSAdapter';

test('sidecar local reduz blend ponderado a um voice id suportado', () => {
  assert.equal(
    resolveKokoroVoiceForProvider(
      'local_kokoro_sidecar',
      'pf_dora(0.70)+af_bella(0.30)',
    ),
    'pf_dora',
  );
});

test('serviço remoto preserva a expressão ponderada', () => {
  assert.equal(
    resolveKokoroVoiceForProvider(
      'kokoro_http',
      'pf_dora(0.70)+af_bella(0.30)',
    ),
    'pf_dora(0.70)+af_bella(0.30)',
  );
});

test('warmup do sidecar usa o contrato local text/voice/speed/lang', async () => {
  const originalFetch = globalThis.fetch;
  let request: { url: string; body: any } | undefined;
  globalThis.fetch = async (input, init) => {
    request = { url: String(input), body: JSON.parse(String(init?.body)) };
    return new Response('{}', { status: 200 });
  };
  try {
    const { TTSAdapter } = await import('../../TTSAdapter');
    const adapter = new TTSAdapter();
    adapter.updatePreferences({
      ttsProvider: 'local_kokoro_sidecar',
      voiceName: 'pf_dora',
      rate: 0.95,
    }, false);
    await adapter.warmup();
    assert.equal(request?.url, 'http://127.0.0.1:14321');
    assert.deepEqual(request?.body, { text: 'ok', voice: 'pf_dora', speed: 0.95, lang: 'pt-br' });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
