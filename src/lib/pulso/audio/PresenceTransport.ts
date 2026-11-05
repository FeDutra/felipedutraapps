export type PresenceTransportPreference = 'auto' | 'gemini_live' | 'turn_based';
export type PresenceToggleAction = 'start' | 'stop' | 'retry';

export function resolvePresenceToggleAction(
  presenceMode: boolean,
  voiceState: string,
): PresenceToggleAction {
  if (!presenceMode) return 'start';
  if (voiceState === 'error') return 'retry';
  return 'stop';
}

export const PRESENCE_TRANSPORT_STORAGE_KEY = 'pulso_presence_transport';
const PRESENCE_DEVICE_ID_STORAGE_KEY = 'pulso_presence_device_id';
const TURN_BASED_DESKTOP_RESTORE_MIGRATION_KEY = 'pulso_presence_transport_migration_v8_turn_based_restore';

// NEXT_PUBLIC values are normally inlined by Next during the web build. The
// Tauri static bundle can lose that replacement at runtime even when the same
// build works in the browser. The relay URL is public; authorization comes
// from the signed Firebase session sent after the WebSocket opens.
const DEFAULT_LIVE_VOICE_RELAY_URL = 'wss://72-62-105-195.nip.io/live-voice/live';

export function getGeminiLiveConfig() {
  const relayUrl = process.env.NEXT_PUBLIC_LIVE_VOICE_RELAY_URL || DEFAULT_LIVE_VOICE_RELAY_URL;
  return { relayUrl };
}

export function hasGeminiLiveConfig() {
  const { relayUrl } = getGeminiLiveConfig();
  return Boolean(relayUrl);
}

function isDesktopRuntime() {
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

export function readPresenceTransportPreference(): PresenceTransportPreference {
  if (typeof window === 'undefined') return 'auto';
  try {
    const saved = window.localStorage.getItem(PRESENCE_TRANSPORT_STORAGE_KEY);
    if (isDesktopRuntime()) {
      // A rota cotidiana comprovada no desktop é a sessão turn-based: abre o
      // microfone local, transcreve pelo sidecar e entrega o turno ao cérebro
      // canônico. Gemini Live permanece disponível somente por escolha
      // explícita; uma falha de autorização no experimento não pode bloquear o
      // microfone da Presença inteira.
      if (window.localStorage.getItem(TURN_BASED_DESKTOP_RESTORE_MIGRATION_KEY) !== '1') {
        window.localStorage.setItem(TURN_BASED_DESKTOP_RESTORE_MIGRATION_KEY, '1');
        if (saved === null || saved === 'auto') {
          window.localStorage.setItem(PRESENCE_TRANSPORT_STORAGE_KEY, 'turn_based');
          return 'turn_based';
        }
      }
      if (saved === 'auto' || saved === 'gemini_live' || saved === 'turn_based') return saved;
      window.localStorage.setItem(PRESENCE_TRANSPORT_STORAGE_KEY, 'turn_based');
      return 'turn_based';
    }
    if (saved === 'auto' || saved === 'gemini_live' || saved === 'turn_based') return saved;
  } catch {
    // Some desktop WebViews can deny storage while the custom asset origin is
    // being initialized. Presence must still open with its intended default.
  }
  return isDesktopRuntime() ? 'turn_based' : 'auto';
}

export function writePresenceTransportPreference(preference: PresenceTransportPreference) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PRESENCE_TRANSPORT_STORAGE_KEY, preference);
  } catch {
    // The preference is an optimization, never a startup requirement.
  }
}

export function shouldUseGeminiLive(
  preference: PresenceTransportPreference,
  search = '',
  options: { desktopCore?: boolean } = {},
) {
  const override = new URLSearchParams(search).get('gemini_live');
  if (override === '0') return false;
  if (override === '1') return hasGeminiLiveConfig();
  if (preference === 'turn_based') return false;
  // No Core desktop, `auto` precisa significar a rota local comprovada.
  // Gemini Live continua disponível por escolha explícita, mas uma sessão
  // remota sem autorização nunca pode impedir a abertura do microfone, STT e
  // roteamento locais da Presença.
  if (preference === 'auto' && options.desktopCore) return false;
  return hasGeminiLiveConfig();
}

export function getPresenceDeviceId() {
  if (typeof window === 'undefined') return 'server';
  try {
    const existing = window.localStorage.getItem(PRESENCE_DEVICE_ID_STORAGE_KEY);
    if (existing) return existing;
  } catch {
    // Continue with an ephemeral identifier when persistence is unavailable.
  }
  const generated = globalThis.crypto?.randomUUID?.() || `device_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  try {
    window.localStorage.setItem(PRESENCE_DEVICE_ID_STORAGE_KEY, generated);
  } catch {
    // Ephemeral is sufficient for observability; continuity is session-based.
  }
  return generated;
}
