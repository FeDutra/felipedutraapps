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
