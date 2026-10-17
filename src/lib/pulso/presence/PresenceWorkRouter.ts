export type PresenceWorkKind = 'social' | 'local_reflex' | 'quick_read' | 'deep_work';

export type PresenceQuickReadCapability = 'calendar_today';

export interface PresenceWorkDecision {
  kind: PresenceWorkKind;
  normalizedUtterance: string;
  reason: string;
  localAction?: 'open_app';
  target?: string;
  spokenTarget?: string;
  quickReadCapability?: PresenceQuickReadCapability;
}

export interface PresenceRecordedRequest {
  requestType?: string;
  originMode?: string;
  mode?: string;
  context?: { localFastPath?: boolean };
  openclawResult?: { meta?: { localFastPath?: boolean } };
}

const APP_ALIASES: Array<{ aliases: string[]; appName: string; spokenName: string }> = [
  { aliases: ['whatsapp', 'zap'], appName: 'WhatsApp', spokenName: 'WhatsApp' },
  { aliases: ['notion'], appName: 'Notion', spokenName: 'Notion' },
  { aliases: ['obsidian'], appName: 'Obsidian', spokenName: 'Obsidian' },
  { aliases: ['finder'], appName: 'Finder', spokenName: 'Finder' },
  { aliases: ['arc'], appName: 'Arc', spokenName: 'Arc' },
  { aliases: ['safari'], appName: 'Safari', spokenName: 'Safari' },
  { aliases: ['spotify'], appName: 'Spotify', spokenName: 'Spotify' },
  { aliases: ['musica', 'music'], appName: 'Music', spokenName: 'Música' },
  { aliases: ['figma'], appName: 'Figma', spokenName: 'Figma' },
  { aliases: ['kdenlive'], appName: 'kdenlive', spokenName: 'Kdenlive' },
  { aliases: ['photoshop'], appName: 'Adobe Photoshop 2026', spokenName: 'Photoshop' },
  { aliases: ['illustrator'], appName: 'Adobe Illustrator', spokenName: 'Illustrator' },
  { aliases: ['visual studio code', 'vs code', 'vscode'], appName: 'Visual Studio Code', spokenName: 'VS Code' },
];

const SOCIAL_ONLY_PATTERNS = [
  /\b(?:bom dia|boa tarde|boa noite|tudo bem|como vai|como voce esta|e voce|e ai|salve salve|ate logo|ate mais)\b/g,
  /\b(?:oi|ola|obrigado|obrigada|valeu|tchau|beleza|show|perfeito|yay|yey)\b/g,
  /\blotus\b/g,
];

const LEADING_WRAPPERS = [
  /^(?:ei|oi|ola|lotus)\s+/,
  /^(?:beleza|ok|certo|entendi|entao|bom|show|perfeito)\s+/,
  /^(?:por favor|faz favor)\s+/,
  /^(?:voce\s+)?(?:pode|consegue)\s+/,
];

export function normalizePresenceUtterance(input: string) {
  return input
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripLeadingWrappers(input: string) {
  let current = input;
  let previous = '';
  while (current && current !== previous) {
    previous = current;
    for (const pattern of LEADING_WRAPPERS) {
      current = current.replace(pattern, '').trim();
    }
  }
  return current;
}

function normalizeRequestedApp(input: string) {
  return input
    .replace(/^(?:(?:o|a|meu|minha)\s+)*/g, '')
    .replace(/^(?:(?:aplicativo|aplicacao|app|programa)(?:\s+(?:de|do|da))?\s+)/g, '')
    .replace(/\s+(?:pra mim|para mim|por favor)$/g, '')
    .trim();
}

function resolveOpenApp(input: string) {
  const unwrapped = stripLeadingWrappers(input);
  const match = unwrapped.match(/^(?:abre|abra|abrir|inicie|inicia|ative|ativa)(?:\s+(?:pra mim|para mim))?\s+(.+)$/);
  if (!match) return null;

  const requested = normalizeRequestedApp(match[1]);
  // Uma frase composta exige contexto e nunca pode executar parcialmente.
  if (/\b(?:e|depois|tambem)\b/.test(requested)) return null;
  return APP_ALIASES.find(app => app.aliases.includes(requested)) || null;
}

function isSocialOnly(input: string) {
  if (!input) return false;
  let remainder = input;
  for (const pattern of SOCIAL_ONLY_PATTERNS) remainder = remainder.replace(pattern, ' ');
  return remainder.replace(/\s+/g, ' ').trim().length === 0;
}

function isCalendarTodayRead(input: string) {
  const asksCalendar = /\b(?:agenda|compromisso|compromissos|evento|eventos)\b/.test(input)
    || /\bo que (?:eu )?tenho hoje\b/.test(input);
  const readVerb = /\b(?:qual|quais|ve|veja|ver|olha|mostra|diz|tenho|consulta|consulte)\b/.test(input);
  const isWrite = /\b(?:cria|crie|marca|marque|agendar|agende|adiciona|adicione|cancela|cancele|remove|remova)\b/.test(input);
  return asksCalendar && readVerb && !isWrite;
}

function requiresDeepWork(input: string) {
  return /\b(?:analisa|analise|analisar|prioriza|priorize|priorizar|prioridade|prioridades|organiza|organize|organizar|reorganiza|reorganize|reorganizar|compara|compare|comparar|recomenda|recomende|recomendar|planeja|planeje|planejar|estrategia|estrategico|estrategica)\b/.test(input)
    || /\b(?:o que devo|como devo|o que voce sugere|qual caminho|melhor caminho)\b/.test(input);
}

export function classifyPresenceWork(input: string): PresenceWorkDecision {
  const normalizedUtterance = normalizePresenceUtterance(input);
  const unwrapped = stripLeadingWrappers(normalizedUtterance);

  if (isSocialOnly(normalizedUtterance)) {
    return { kind: 'social', normalizedUtterance, reason: 'social_only' };
  }

  const app = resolveOpenApp(normalizedUtterance);
  if (app) {
    return {
      kind: 'local_reflex',
      normalizedUtterance,
      reason: 'allowlisted_open_app',
      localAction: 'open_app',
      target: app.appName,
      spokenTarget: app.spokenName,
    };
  }

  // Um pedido pode citar agenda e ainda exigir julgamento. Intenção analítica
  // sempre vence uma leitura factual para que a consulta rápida nunca reduza
  // um trabalho de síntese a uma lista de eventos.
  if (requiresDeepWork(unwrapped)) {
    return { kind: 'deep_work', normalizedUtterance, reason: 'analytical_judgement_required' };
  }

  if (isCalendarTodayRead(unwrapped)) {
    return {
      kind: 'quick_read',
      normalizedUtterance,
      reason: 'typed_calendar_today_read',
      quickReadCapability: 'calendar_today',
    };
  }

  return { kind: 'deep_work', normalizedUtterance, reason: 'canonical_lotus_required' };
}

export function isPresenceOwnedRequest(request: PresenceRecordedRequest) {
  const originMode = request.originMode || request.mode;
  return request.requestType === 'local_interaction'
    || ['presence', 'local_fast_path', 'quick_read'].includes(originMode || '')
    || request.context?.localFastPath === true
    || request.openclawResult?.meta?.localFastPath === true;
}
