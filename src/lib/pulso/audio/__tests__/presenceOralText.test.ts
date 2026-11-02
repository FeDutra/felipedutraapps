import assert from 'node:assert/strict';
import test from 'node:test';

import { toPresenceCheckpointSpeech, toPresenceResultSpeech } from '../presenceOralText.ts';

test('checkpoint narra só a primeira mudança concreta e remove infraestrutura', () => {
  assert.equal(
    toPresenceCheckpointSpeech('## Pesquisa\nEncontrei o documento correto.\n`/tmp/segredo.log`'),
    'Pesquisa Encontrei o documento correto.',
  );
});

test('resultado preserva o começo factual e não lê markdown ou caminho', () => {
  const oral = toPresenceResultSpeech('## Fechado\nA voz voltou a funcionar. O relay real está ligado. O texto completo segue no chat. /tmp/build.log');
  assert.equal(oral, 'Fechado A voz voltou a funcionar. O relay real está ligado. O texto completo segue no chat.');
});
