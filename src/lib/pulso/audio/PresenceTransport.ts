export type PresenceTransportPreference = 'auto' | 'gemini_live' | 'turn_based';

export const PRESENCE_TRANSPORT_STORAGE_KEY = 'pulso_presence_transport';
const PRESENCE_DEVICE_ID_STORAGE_KEY = 'pulso_presence_device_id';

export function hasGeminiLiveConfig() {
  return Boolean(
    process.env.NEXT_PUBLIC_LIVE_VOICE_RELAY_URL
    && process.env.NEXT_PUBLIC_LIVE_VOICE_TOKEN
  );
}

export function readPresenceTransportPreference(): PresenceTransportPreference {
  if (typeof window === 'undefined') return 'auto';
  const saved = window.localStorage.getItem(PRESENCE_TRANSPORT_STORAGE_KEY);
  if (saved === 'gemini_live' || saved === 'turn_based' || saved === 'auto') return saved;
  return 'auto';
}

export function writePresenceTransportPreference(preference: PresenceTransportPreference) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(PRESENCE_TRANSPORT_STORAGE_KEY, preference);
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
  const existing = window.localStorage.getItem(PRESENCE_DEVICE_ID_STORAGE_KEY);
  if (existing) return existing;
  const generated = globalThis.crypto?.randomUUID?.() || `device_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  window.localStorage.setItem(PRESENCE_DEVICE_ID_STORAGE_KEY, generated);
  return generated;
}
