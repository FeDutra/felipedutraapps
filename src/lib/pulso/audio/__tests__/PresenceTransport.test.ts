import assert from 'node:assert/strict';
import test from 'node:test';
// @ts-expect-error Node's strip-types runner executes the TypeScript source directly.
import {
  PRESENCE_TRANSPORT_STORAGE_KEY,
  readPresenceTransportPreference,
  shouldUseGeminiLive,
  writePresenceTransportPreference,
} from '../PresenceTransport.ts';

class MemoryStorage {
  private values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

function withWindow(protocol: string, run: (storage: MemoryStorage) => void) {
  const previousWindow = (globalThis as any).window;
  const storage = new MemoryStorage();
  (globalThis as any).window = {
    location: { protocol },
    localStorage: storage,
    __TAURI_INTERNALS__: protocol === 'tauri:',
  };
  try {
    run(storage);
  } finally {
    (globalThis as any).window = previousWindow;
  }
}

test('restaura Gemini Live uma única vez no desktop Tauri', () => {
  withWindow('tauri:', (storage) => {
    storage.setItem(PRESENCE_TRANSPORT_STORAGE_KEY, 'turn_based');
    assert.equal(readPresenceTransportPreference(), 'gemini_live');
    assert.equal(storage.getItem(PRESENCE_TRANSPORT_STORAGE_KEY), 'gemini_live');

    writePresenceTransportPreference('turn_based');
    assert.equal(readPresenceTransportPreference(), 'turn_based');
  });
});

test('mantém o modo automático como padrão fora do desktop', () => {
  withWindow('https:', () => {
    assert.equal(readPresenceTransportPreference(), 'auto');
  });
});

test('auto e Gemini usam o relay; local continua explicitamente local', () => {
  assert.equal(shouldUseGeminiLive('auto'), true);
  assert.equal(shouldUseGeminiLive('gemini_live'), true);
  assert.equal(shouldUseGeminiLive('turn_based'), false);
  assert.equal(shouldUseGeminiLive('gemini_live', '?gemini_live=0'), false);
});
