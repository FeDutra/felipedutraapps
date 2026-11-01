import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isInternalRuntimeDiagnostic,
  sanitizeAssistantConversationText,
  userFacingConversationError,
} from '../conversationText';

test('bloqueia stderr do bridge e eventos internos no texto da Lótus', () => {
  const leaked = '[Lótus] BRIDGE_EXIT_-15: STDERR=[sqlite/transaction] slow hold\n'
    + '{"event":"ws_event","phase":"preparing_workspace"}';
  assert.equal(isInternalRuntimeDiagnostic(leaked), true);
  assert.equal(sanitizeAssistantConversationText(leaked), '');
});

test('preserva uma resposta humana normal', () => {
  const answer = 'Encontrei seus compromissos e já cruzei com o Notion.';
  assert.equal(sanitizeAssistantConversationText(answer), answer);
});

test('converte falha técnica em mensagem humana curta', () => {
  assert.equal(
    userFacingConversationError('OPENCLAW_BRIDGE_EXIT_-15'),
    'Não consegui concluir esta resposta. O pedido ficou preservado para uma nova tentativa.',
  );
});
