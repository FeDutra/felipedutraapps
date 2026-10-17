import assert from 'node:assert/strict';
import test from 'node:test';
// @ts-expect-error Node's strip-types runner executes the TypeScript source directly.
import { classifyPresenceWork, isPresenceOwnedRequest } from '../PresenceWorkRouter.ts';

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

test('análise e priorização vencem a consulta factual de agenda', () => {
  for (const phrase of [
    'Analise o meu dia e proponha três prioridades',
    'Veja minha agenda e recomende o melhor caminho para hoje',
    'Organize meus compromissos por prioridade',
  ]) {
    const decision = classifyPresenceWork(phrase);
    assert.equal(decision.kind, 'deep_work', phrase);
    assert.equal(decision.reason, 'analytical_judgement_required', phrase);
  }
});

test('saudação pura permanece social', () => {
  assert.equal(classifyPresenceWork('E aí, beleza?').kind, 'social');
  assert.equal(classifyPresenceWork('Bom dia, Lótus').kind, 'social');
});

test('mensagens já faladas pela Presença não voltam ao narrador global', () => {
  assert.equal(isPresenceOwnedRequest({ requestType: 'local_interaction' }), true);
  assert.equal(isPresenceOwnedRequest({ originMode: 'quick_read' }), true);
  assert.equal(isPresenceOwnedRequest({ originMode: 'presence' }), true);
  assert.equal(isPresenceOwnedRequest({ context: { localFastPath: true } }), true);
  assert.equal(isPresenceOwnedRequest({ originMode: 'text' }), false);
});
