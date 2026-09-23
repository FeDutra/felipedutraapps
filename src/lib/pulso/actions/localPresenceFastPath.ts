import { localActions } from './localActions';

export interface LocalPresenceFastPathResult {
  handled: boolean;
  action?: 'open_app' | 'close_mesa';
  target?: string;
  responseText?: string;
  durationMs?: number;
}

const APP_ALIASES: Array<{ aliases: string[]; appName: string; spokenName: string }> = [
  { aliases: ['whatsapp', 'zap'], appName: 'WhatsApp', spokenName: 'WhatsApp' },
  { aliases: ['notion'], appName: 'Notion', spokenName: 'Notion' },
  { aliases: ['obsidian'], appName: 'Obsidian', spokenName: 'Obsidian' },
  { aliases: ['finder'], appName: 'Finder', spokenName: 'Finder' },
  { aliases: ['arc'], appName: 'Arc', spokenName: 'Arc' },
  { aliases: ['chrome', 'google chrome'], appName: 'Google Chrome', spokenName: 'Chrome' },
  { aliases: ['safari'], appName: 'Safari', spokenName: 'Safari' },
  { aliases: ['spotify'], appName: 'Spotify', spokenName: 'Spotify' },
  { aliases: ['musica', 'music'], appName: 'Music', spokenName: 'Música' },
  { aliases: ['figma'], appName: 'Figma', spokenName: 'Figma' },
  { aliases: ['kdenlive'], appName: 'kdenlive', spokenName: 'Kdenlive' },
  { aliases: ['photoshop'], appName: 'Adobe Photoshop 2026', spokenName: 'Photoshop' },
  { aliases: ['illustrator'], appName: 'Adobe Illustrator', spokenName: 'Illustrator' },
  { aliases: ['visual studio code', 'vs code', 'vscode'], appName: 'Visual Studio Code', spokenName: 'VS Code' },
];

function normalize(input: string) {
  return input
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[!?.,;:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeRequestedApp(input: string) {
  return input
    .replace(/^(?:(?:o|a|meu|minha)\s+)*/g, '')
    .replace(/^(?:(?:aplicativo|aplicacao|app|programa)(?:\s+de)?\s+)/g, '')
    .trim();
}

function resolveOpenApp(input: string) {
  const normalized = normalize(input);
  const match = normalized.match(/^(?:lotus\s+)?(?:abre|abra|abrir|pode abrir)(?:\s+(?:pra mim|para mim))?\s+(.+?)(?:\s+(?:pra mim|para mim|por favor))?$/);
  if (!match) return null;

  const requested = normalizeRequestedApp(match[1]);
  return APP_ALIASES.find(app => app.aliases.includes(requested)) || null;
}

function isTauriDesktop() {
  if (typeof window === 'undefined') return false;
  const tauriWindow = window as Window & {
    __TAURI__?: unknown;
    __TAURI_INTERNALS__?: unknown;
  };
  return window.location.protocol === 'tauri:'
    || window.location.protocol === 'file:'
    || Boolean(tauriWindow.__TAURI__)
    || Boolean(tauriWindow.__TAURI_INTERNALS__);
}

export async function executeLocalPresenceFastPath(input: string): Promise<LocalPresenceFastPathResult> {
  if (!isTauriDesktop()) return { handled: false };

  const app = resolveOpenApp(input);
  if (!app) return { handled: false };

  const startedAt = performance.now();
  const result = await localActions.openApp(app.appName);
  const durationMs = Math.round(performance.now() - startedAt);
  const failed = result.toLocaleLowerCase('pt-BR').includes('problema');

  return {
    handled: true,
    action: 'open_app',
    target: app.appName,
    responseText: failed ? result : `Abri o ${app.spokenName}.`,
    durationMs,
  };
}
