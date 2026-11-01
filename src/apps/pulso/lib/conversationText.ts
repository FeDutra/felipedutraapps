const INTERNAL_RUNTIME_MARKERS = [
  'bridge_exit_',
  'stderr=',
  'stdout=',
  '[sqlite/transaction]',
  '"event":"ws_event"',
  '"phase":"preparing_workspace"',
  '"phase":"preparing_context"',
];

export function isInternalRuntimeDiagnostic(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const sample = value.trim().toLowerCase();
  if (!sample) return false;
  return INTERNAL_RUNTIME_MARKERS.some(marker => sample.includes(marker));
}

export function sanitizeAssistantConversationText(value: unknown): string {
  const text = typeof value === 'string' ? value : '';
  return isInternalRuntimeDiagnostic(text) ? '' : text;
}

export function userFacingConversationError(value: unknown): string {
  const text = sanitizeAssistantConversationText(value).trim();
  if (!text || /^[a-z0-9_:-]+$/i.test(text)) {
    return 'Não consegui concluir esta resposta. O pedido ficou preservado para uma nova tentativa.';
  }
  return text;
}
