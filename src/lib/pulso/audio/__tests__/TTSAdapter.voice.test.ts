import assert from 'node:assert/strict';
import test from 'node:test';

// @ts-expect-error Node's strip-types runner executes the TypeScript source directly.
import {
  buildRemoteKokoroPayload,
  resolveKokoroVoiceForProvider,
  resolveNativeTtsFallback,
} from '../../TTSAdapter.ts';

test('sidecar local rejeita blend e fixa a voz brasileira canônica', () => {
  assert.equal(
    resolveKokoroVoiceForProvider(
      'local_kokoro_sidecar',
      'pf_dora(0.70)+af_bella(0.30)',
    ),
    'pf_dora',
  );
});

test('serviço remoto também rejeita blend com voz inglesa', () => {
  assert.equal(
    resolveKokoroVoiceForProvider(
      'kokoro_http',
      'pf_dora(0.70)+af_bella(0.30)',
    ),
    'pf_dora',
  );
});

test('fallback remoto declara explicitamente português brasileiro', () => {
  assert.deepEqual(
    buildRemoteKokoroPayload('olá', 'pf_dora', 0.95),
    {
      model: 'kokoro',
      input: 'olá',
      voice: 'pf_dora',
      response_format: 'mp3',
      speed: 0.95,
      lang: 'pt-br',
    },
  );
});

test('desktop nunca degrada silenciosamente para voz nativa', () => {
  assert.equal(resolveNativeTtsFallback(true), false);
  assert.equal(resolveNativeTtsFallback(false), true);
  assert.equal(resolveNativeTtsFallback(true, false), false);
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
