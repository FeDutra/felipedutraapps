export type PresenceTransportPreference = 'auto' | 'gemini_live' | 'turn_based';

export const PRESENCE_TRANSPORT_STORAGE_KEY = 'pulso_presence_transport';
const PRESENCE_DEVICE_ID_STORAGE_KEY = 'pulso_presence_device_id';
const GEMINI_DESKTOP_RESTORE_MIGRATION_KEY = 'pulso_presence_transport_migration_v3_gemini_restore';

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
    // Em 14/10, o desktop foi migrado silenciosamente para turn_based para
    // investigar a Presença local. A experiência aprovada por Fe era Gemini
    // Live; restaura uma única vez o transporte correto nos apps Tauri sem
    // apagar escolhas futuras feitas no seletor.
    if (
      isDesktopRuntime()
      && window.localStorage.getItem(GEMINI_DESKTOP_RESTORE_MIGRATION_KEY) !== '1'
    ) {
      window.localStorage.setItem(PRESENCE_TRANSPORT_STORAGE_KEY, 'gemini_live');
      window.localStorage.setItem(GEMINI_DESKTOP_RESTORE_MIGRATION_KEY, '1');
      return 'gemini_live';
    }

    const saved = window.localStorage.getItem(PRESENCE_TRANSPORT_STORAGE_KEY);
    if (saved === 'gemini_live' || saved === 'turn_based' || saved === 'auto') return saved;
  } catch {
    // Some desktop WebViews can deny storage while the custom asset origin is
    // being initialized. Presence must still open with its intended default.
  }
  return isDesktopRuntime() ? 'gemini_live' : 'auto';
}

export function writePresenceTransportPreference(preference: PresenceTransportPreference) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PRESENCE_TRANSPORT_STORAGE_KEY, preference);
  } catch {
    // The preference is an optimization, never a startup requirement.
  }
}

export function shouldUseGeminiLive(preference: PresenceTransportPreference, search = '') {
  const override = new URLSearchParams(search).get('gemini_live');
  if (override === '0') return false;
  if (override === '1') return hasGeminiLiveConfig();
  if (preference === 'turn_based') return false;
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
