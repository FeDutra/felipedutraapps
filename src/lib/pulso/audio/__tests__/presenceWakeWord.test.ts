import test from 'node:test';
import assert from 'node:assert/strict';

import { parsePresenceWakeUtterance } from '../presenceWakeWord.ts';

test('aceita a invocação canônica e remove o wake word do pedido', () => {
  assert.deepEqual(parsePresenceWakeUtterance('Lótus, como está minha agenda?'), {
    matched: true,
    commandText: 'como está minha agenda?',
    matchedAlias: 'lótus',
  });
});

test('tolera as grafias produzidas pelo STT local', () => {
  assert.equal(parsePresenceWakeUtterance('Lotus acenda a luz').matched, true);
  assert.equal(parsePresenceWakeUtterance('Lotos me escuta').matched, true);
});

test('tolera uma chamada curta antes do nome', () => {
  assert.deepEqual(parsePresenceWakeUtterance('Ei, Lótus, você está aí?'), {
    matched: true,
    commandText: 'você está aí?',
    matchedAlias: 'lótus',
  });
});

test('reconhece a invocação sem pedido para permitir resposta de presença', () => {
  assert.deepEqual(parsePresenceWakeUtterance('Lótus'), {
    matched: true,
    commandText: '',
    matchedAlias: 'lótus',
  });
});

test('descarta conversa ambiente que não chama a Lótus', () => {
  assert.deepEqual(parsePresenceWakeUtterance('A luz do escritório está acesa'), {
    matched: false,
    commandText: '',
  });
});

test('não aceita o nome no meio de uma conversa comum', () => {
  assert.equal(parsePresenceWakeUtterance('Eu estava falando da Lótus ontem').matched, false);
});
