import assert from 'node:assert/strict';
import test from 'node:test';
// @ts-expect-error Node's strip-types runner executes the TypeScript source directly.
import { classifyPresenceWork } from '../PresenceWorkRouter.ts';

test('aceita invólucro conversacional antes de abrir aplicativo', () => {
  const decision = classifyPresenceWork('Beleza. Abre para mim o WhatsApp.');
  assert.equal(decision.kind, 'local_reflex');
  assert.equal(decision.localAction, 'open_app');
  assert.equal(decision.target, 'WhatsApp');
});

test('normaliza artigo e palavra aplicativo sem fuzzy execution', () => {
  const decision = classifyPresenceWork('Lótus, pode abrir o aplicativo do Notion por favor?');
  assert.equal(decision.kind, 'local_reflex');
  assert.equal(decision.target, 'Notion');
});

test('não executa parcialmente comando composto', () => {
  const decision = classifyPresenceWork('Abra o WhatsApp e leia a última mensagem do Rodrigo');
  assert.equal(decision.kind, 'deep_work');
});

test('classifica agenda de hoje como consulta rápida tipada', () => {
  for (const phrase of [
    'Quais são os meus compromissos de hoje?',
    'Vê minha agenda hoje para mim',
    'O que eu tenho hoje?',
  ]) {
    const decision = classifyPresenceWork(phrase);
    assert.equal(decision.kind, 'quick_read', phrase);
    assert.equal(decision.quickReadCapability, 'calendar_today', phrase);
  }
});

test('escrita em agenda sempre exige Lótus', () => {
  const decision = classifyPresenceWork('Marque um compromisso amanhã às dez');
  assert.equal(decision.kind, 'deep_work');
});

test('saudação pura permanece social', () => {
  assert.equal(classifyPresenceWork('E aí, beleza?').kind, 'social');
  assert.equal(classifyPresenceWork('Bom dia, Lótus').kind, 'social');
});
