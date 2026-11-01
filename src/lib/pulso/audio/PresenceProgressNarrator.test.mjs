import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith('/PresenceProgressNarrator.ts')) {
      return {
        format: 'module',
        source: stripTypeScriptTypes(readFileSync(fileURLToPath(url), 'utf8')),
        shortCircuit: true,
      };
    }
    return nextLoad(url, context);
  },
});

const { PresenceProgressNarrator, normalizePresenceNarration } = await import('./PresenceProgressNarrator.ts');

test('normaliza markdown sem inventar conteúdo', () => {
  assert.equal(
    normalizePresenceNarration('**Já encontrei** os dados. [Fonte](https://example.com)'),
    'Já encontrei os dados. Fonte',
  );
});

test('deduplica checkpoints reais', () => {
  const narrator = new PresenceProgressNarrator();
  assert.equal(narrator.acceptCheckpoint('Já encontrei os compromissos nas duas agendas.'), 'Já encontrei os compromissos nas duas agendas.');
  assert.equal(narrator.acceptCheckpoint('Já encontrei os compromissos nas duas agendas.'), null);
});

test('só libera resposta em construção quando há frase completa', () => {
  const narrator = new PresenceProgressNarrator();
  assert.equal(narrator.acceptAccumulatedResponse('Estou cruzando as duas fontes e ainda'), null);
  const chunk = narrator.acceptAccumulatedResponse(
    'Estou cruzando as duas fontes e ainda conferindo os horários para não te devolver o calendário cru. A manhã está livre',
  );
  assert.equal(chunk, 'Estou cruzando as duas fontes e ainda conferindo os horários para não te devolver o calendário cru.');
  assert.equal(narrator.finalRemainder(
    'Estou cruzando as duas fontes e ainda conferindo os horários para não te devolver o calendário cru. A manhã está livre.',
  ), 'A manhã está livre.');
});
