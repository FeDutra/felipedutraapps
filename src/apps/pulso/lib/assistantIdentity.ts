type AssistantIdentity = {
  agentId: string;
  name: string;
};

const AGENT_IDENTITIES: Record<string, AssistantIdentity> = {
  main: { agentId: 'main', name: 'Lótus' },
  designer: { agentId: 'designer', name: 'FORMA' },
  audiovisual: { agentId: 'audiovisual', name: 'RITMO' },
  'engenharia-produto': { agentId: 'engenharia-produto', name: 'ESTRUTURA' },
  comunicacao: { agentId: 'comunicacao', name: 'VERBO' },
  'experiencia-cliente': { agentId: 'experiencia-cliente', name: 'VÍNCULO' },
  trafego: { agentId: 'trafego', name: 'VETOR' },
  financeiro: { agentId: 'financeiro', name: 'LASTRO' },
  'social-media': { agentId: 'social-media', name: 'TRAMA' },
};

const parseAgentIdFromSessionKey = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const match = value.match(/^agent:([^:]+):/);
  return match?.[1] || null;
};

export const resolveAssistantIdentity = (
  value?: Record<string, unknown> | null,
  fallbackSessionKey?: string | null,
): AssistantIdentity => {
  const result = value?.openclawResult && typeof value.openclawResult === 'object'
    ? value.openclawResult as Record<string, unknown>
    : null;
  const meta = value?.meta && typeof value.meta === 'object'
    ? value.meta as Record<string, unknown>
    : null;
  const resultMeta = result?.meta && typeof result.meta === 'object'
    ? result.meta as Record<string, unknown>
    : null;
  const candidateIds = [
    value?.agentId,
    meta?.agentId,
    result?.agentId,
    resultMeta?.agentId,
    parseAgentIdFromSessionKey(value?.openclawSessionKey),
    parseAgentIdFromSessionKey(fallbackSessionKey),
  ];

  for (const candidate of candidateIds) {
    if (typeof candidate === 'string' && AGENT_IDENTITIES[candidate]) {
      return AGENT_IDENTITIES[candidate];
    }
  }
  return AGENT_IDENTITIES.main;
};

export const getAssistantResponseText = (value: Record<string, unknown>): string => {
  const result = value.openclawResult && typeof value.openclawResult === 'object'
    ? value.openclawResult as Record<string, unknown>
    : null;
  const canonicalResponse = typeof result?.responseText === 'string' ? result.responseText : '';
  if (canonicalResponse.trim()) return canonicalResponse;

  const meta = value.meta && typeof value.meta === 'object'
    ? value.meta as Record<string, unknown>
    : null;
  const resultMeta = result?.meta && typeof result.meta === 'object'
    ? result.meta as Record<string, unknown>
    : null;
  const isStandaloneActiveMessage = value.requestType === 'active_message'
    && !meta?.originRequestId
    && !resultMeta?.originRequestId
    && !value.originRequestId;
  if (!isStandaloneActiveMessage) return '';

  if (typeof value.text === 'string') return value.text;
  if (typeof value.message === 'string') return value.message;
  return '';
};
