import type { Area, PulsoContextNode } from '../../../apps/pulso/types/pulso.types';

export const PRESENCE_ROUTER_VERSION = '1.0.0-local-hot-context';

const HOT_CONTEXT_KEY = 'pulso.presence.hot-context.v1';
const ROUTE_CONFIDENCE_THRESHOLD = 0.78;
const MAX_RECENT_ROUTES = 24;

const STOP_WORDS = new Set([
  'a', 'ao', 'aos', 'as', 'com', 'da', 'das', 'de', 'do', 'dos', 'e', 'em',
  'me', 'meu', 'minha', 'o', 'os', 'para', 'por', 'pra', 'pro', 'que', 'um',
  'uma', 'ver', 've', 'olha', 'olhada', 'lotus',
]);

const SESSION_ALIASES: Record<string, string[]> = {
  sistema_pulso: ['pulso'],
  sistema_infraestrutura: ['infraestrutura', 'servidor', 'vps'],
  sistema_openclaw_agentes: ['openclaw', 'agentes', 'agente'],
  trabalho_modu: ['modu'],
  trabalho_despertar: ['despertar'],
  casa_construcao: ['construcao', 'obra', 'reforma da casa'],
  casa_horta: ['horta'],
  familia_escola_guayi: ['guayi', 'escola guayi'],
  criacao_producao_autoral: ['producao autoral', 'obra autoral', 'minha obra'],
  livre_geral: ['geral'],
  global_estrada: ['estrada'],
};

export interface PresenceRouteTrace {
  contextId: string;
  areaId: string;
  confidence: number;
  at: number;
}

export interface PresenceHotContext {
  version: 1;
  routerVersion: string;
  updatedAt: number;
  sessions: Array<{
    contextId: string;
    areaId: string;
    label: string;
    openclawSessionKey: string;
  }>;
  areas: Array<{ id: string; name: string }>;
  recentRoutes: PresenceRouteTrace[];
}

export interface PresenceRoutingDecision {
  target: PulsoContextNode;
  switched: boolean;
  confidence: number;
  reason: string;
  matchedTerms: string[];
  routerVersion: string;
  decidedAtMs: number;
  durationMs: number;
}

export interface PresenceRoutingInput {
  utterance: string;
  activeContext: PulsoContextNode;
  sessions: PulsoContextNode[];
  areas: Area[];
  hotContext?: PresenceHotContext | null;
}

function normalize(value: string) {
  return value
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function meaningfulTokens(value: string) {
  return normalize(value)
    .split(' ')
    .filter(token => token.length > 1 && !STOP_WORDS.has(token));
}

function safeReadStorage(): PresenceHotContext | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(HOT_CONTEXT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PresenceHotContext;
    return parsed?.version === 1 ? parsed : null;
  } catch {
    return null;
  }
}

function safeWriteStorage(value: PresenceHotContext) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(HOT_CONTEXT_KEY, JSON.stringify(value));
  } catch {
    // O cache é uma otimização descartável; nunca pode bloquear a Presença.
  }
}

export function readPresenceHotContext() {
  return safeReadStorage();
}

export function refreshPresenceHotContext(
  sessions: PulsoContextNode[],
  areas: Area[],
  route?: PresenceRouteTrace
) {
  const previous = safeReadStorage();
  const recentRoutes = route
    ? [route, ...(previous?.recentRoutes || []).filter(item => item.contextId !== route.contextId)].slice(0, MAX_RECENT_ROUTES)
    : (previous?.recentRoutes || []).slice(0, MAX_RECENT_ROUTES);

  const next: PresenceHotContext = {
    version: 1,
    routerVersion: PRESENCE_ROUTER_VERSION,
    updatedAt: Date.now(),
    sessions: sessions
      .filter(session => !session.archived)
      .map(session => ({
        contextId: session.contextId,
        areaId: session.areaId,
        label: session.label,
        openclawSessionKey: session.openclawSessionKey,
      })),
    areas: areas.map(area => ({ id: area.id, name: area.name })),
    recentRoutes,
  };

  safeWriteStorage(next);
  return next;
}

function phrasesForSession(session: PulsoContextNode) {
  return Array.from(new Set([
    normalize(session.label),
    normalize(session.subareaId || ''),
    ...normalize(session.contextId).split(' '),
    ...(SESSION_ALIASES[session.contextId] || []).map(normalize),
  ].filter(Boolean)));
}

function areaScore(input: string, area: Area) {
  const matches = [area.name, ...(area.aliases || []), ...(area.keywords || [])]
    .map(normalize)
    .filter(term => term.length > 2 && input.includes(term));
  return { score: matches.length > 0 ? 3 + Math.min(matches.length, 3) : 0, matches };
}

export function routePresenceIntent(input: PresenceRoutingInput): PresenceRoutingDecision {
  const startedAt = performance.now();
  const utterance = normalize(input.utterance);
  const inputTokens = new Set(meaningfulTokens(utterance));
  const candidates = input.sessions.filter(session => !session.archived);
  const hotContext = input.hotContext ?? safeReadStorage();
  const recentRank = new Map((hotContext?.recentRoutes || []).map((route, index) => [route.contextId, index]));

  const scored = candidates.map(session => {
    let score = 0;
    const matchedTerms = new Set<string>();

    for (const phrase of phrasesForSession(session)) {
      if (phrase.length > 2 && utterance.includes(phrase)) {
        score += phrase.includes(' ') ? 8 : 6;
        matchedTerms.add(phrase);
      } else {
        const tokens = meaningfulTokens(phrase);
        const overlap = tokens.filter(token => inputTokens.has(token));
        if (overlap.length > 0) {
          score += overlap.length * 2;
          overlap.forEach(token => matchedTerms.add(token));
        }
      }
    }

    const area = input.areas.find(item => item.id === session.areaId);
    if (area) {
      const match = areaScore(utterance, area);
      score += match.score;
      match.matches.forEach(term => matchedTerms.add(term));
    }

    const rank = recentRank.get(session.contextId);
    if (rank !== undefined && score > 0) score += Math.max(0.25, 1.25 - rank * 0.15);
    if (session.contextId === input.activeContext.contextId) score += 0.5;

    return { session, score, matchedTerms: Array.from(matchedTerms) };
  }).sort((a, b) => b.score - a.score);

  const first = scored[0];
  const second = scored[1];
  const margin = (first?.score || 0) - (second?.score || 0);
  let confidence = 0.1;
  if ((first?.score || 0) >= 8 && margin >= 2) confidence = 0.96;
  else if ((first?.score || 0) >= 5 && margin >= 1.5) confidence = 0.84;
  else if ((first?.score || 0) >= 3) confidence = 0.62;

  const explicitTarget = first && confidence >= ROUTE_CONFIDENCE_THRESHOLD ? first.session : null;
  const target = explicitTarget || input.activeContext;
  const switched = target.contextId !== input.activeContext.contextId;
  const reason = explicitTarget
    ? `destino inferido por ${first.matchedTerms.join(', ') || 'contexto lexical'}`
    : 'ambiguidade preservou a sessão ativa';

  return {
    target,
    switched,
    confidence,
    reason,
    matchedTerms: explicitTarget ? first.matchedTerms : [],
    routerVersion: PRESENCE_ROUTER_VERSION,
    decidedAtMs: Date.now(),
    durationMs: Math.round((performance.now() - startedAt) * 100) / 100,
  };
}

