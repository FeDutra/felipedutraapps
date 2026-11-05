import assert from 'node:assert/strict';
import test from 'node:test';
// @ts-expect-error Node's strip-types runner executes the TypeScript source directly.
import {
  PRESENCE_TRANSPORT_STORAGE_KEY,
  readPresenceTransportPreference,
  resolvePresenceToggleAction,
  shouldUseGeminiLive,
  writePresenceTransportPreference,
} from '../PresenceTransport.ts';

test('um clique reabre a Presença depois de erro terminal', () => {
  assert.equal(resolvePresenceToggleAction(false, 'idle'), 'start');
  assert.equal(resolvePresenceToggleAction(true, 'presence_listening'), 'stop');
  assert.equal(resolvePresenceToggleAction(true, 'error'), 'retry');
});

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

test('migra o estado automático legado para a rota local comprovada', () => {
  withWindow('tauri:', (storage) => {
    storage.setItem(PRESENCE_TRANSPORT_STORAGE_KEY, 'auto');
    assert.equal(readPresenceTransportPreference(), 'turn_based');
    assert.equal(storage.getItem(PRESENCE_TRANSPORT_STORAGE_KEY), 'turn_based');
  });
});

test('usa a rota turn-based como padrão em uma instalação desktop nova', () => {
  withWindow('tauri:', (storage) => {
    assert.equal(readPresenceTransportPreference(), 'turn_based');
    assert.equal(storage.getItem(PRESENCE_TRANSPORT_STORAGE_KEY), 'turn_based');
  });
});

test('mantém a política automática como padrão fora do desktop', () => {
  withWindow('https:', () => {
    assert.equal(readPresenceTransportPreference(), 'auto');
  });
});

test('preserva uma escolha explícita posterior por Gemini Live', () => {
  withWindow('tauri:', (storage) => {
    assert.equal(readPresenceTransportPreference(), 'turn_based');
    writePresenceTransportPreference('gemini_live');
    assert.equal(readPresenceTransportPreference(), 'gemini_live');
  });
});

test('Gemini usa o relay; local continua explicitamente local', () => {
  assert.equal(shouldUseGeminiLive('gemini_live'), true);
  assert.equal(shouldUseGeminiLive('auto'), true);
  assert.equal(shouldUseGeminiLive('turn_based'), false);
  assert.equal(shouldUseGeminiLive('gemini_live', '?gemini_live=0'), false);
});
