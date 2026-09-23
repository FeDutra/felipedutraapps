export type PresenceTransportPreference = 'auto' | 'gemini_live' | 'turn_based';

export const PRESENCE_TRANSPORT_STORAGE_KEY = 'pulso_presence_transport';
const PRESENCE_DEVICE_ID_STORAGE_KEY = 'pulso_presence_device_id';

// NEXT_PUBLIC values are normally inlined by Next during the web build. The
// Tauri static bundle can lose that replacement at runtime even when the same
// build works in the browser. Keep the public relay contract deterministic in
// the desktop artifact; the Gemini API key remains only on the relay.
const DEFAULT_LIVE_VOICE_RELAY_URL = 'wss://72-62-105-195.nip.io/live-voice/live';
const DEFAULT_LIVE_VOICE_TOKEN = '5f44c1b490e70a358fbc789ec3862ff7db119d36c845626fc7cc743ccc49a3d1';

export function getGeminiLiveConfig() {
  const relayUrl = process.env.NEXT_PUBLIC_LIVE_VOICE_RELAY_URL || DEFAULT_LIVE_VOICE_RELAY_URL;
  const token = process.env.NEXT_PUBLIC_LIVE_VOICE_TOKEN || DEFAULT_LIVE_VOICE_TOKEN;
  return { relayUrl, token };
}

export function hasGeminiLiveConfig() {
  const { relayUrl, token } = getGeminiLiveConfig();
  return Boolean(relayUrl && token);
}

export function readPresenceTransportPreference(): PresenceTransportPreference {
  if (typeof window === 'undefined') return 'auto';
  try {
    const saved = window.localStorage.getItem(PRESENCE_TRANSPORT_STORAGE_KEY);
    if (saved === 'gemini_live' || saved === 'turn_based' || saved === 'auto') return saved;
  } catch {
    // Some desktop WebViews can deny storage while the custom asset origin is
    // being initialized. Presence must still open with its safe default.
  }
  return 'auto';
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
