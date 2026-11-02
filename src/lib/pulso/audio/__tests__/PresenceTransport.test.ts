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

const LOCAL_PROGRESS_NARRATOR_MIGRATION_KEY = 'pulso_presence_transport_migration_v5_local_progress';

test('restaura Gemini uma única vez nas instalações desviadas para o narrador local', () => {
  withWindow('tauri:', (storage) => {
    storage.setItem(PRESENCE_TRANSPORT_STORAGE_KEY, 'turn_based');
    storage.setItem(LOCAL_PROGRESS_NARRATOR_MIGRATION_KEY, '1');
    assert.equal(readPresenceTransportPreference(), 'gemini_live');
    assert.equal(storage.getItem(PRESENCE_TRANSPORT_STORAGE_KEY), 'gemini_live');

    writePresenceTransportPreference('turn_based');
    assert.equal(readPresenceTransportPreference(), 'turn_based');
  });
});

test('usa Gemini como padrão em uma instalação desktop nova', () => {
  withWindow('tauri:', (storage) => {
    assert.equal(readPresenceTransportPreference(), 'gemini_live');
    assert.equal(storage.getItem(PRESENCE_TRANSPORT_STORAGE_KEY), 'gemini_live');
  });
});

test('mantém Gemini explícito como padrão fora do desktop', () => {
  withWindow('https:', () => {
    assert.equal(readPresenceTransportPreference(), 'gemini_live');
  });
});

test('remove auto do desktop sem sobrescrever escolha local explícita', () => {
  withWindow('tauri:', (storage) => {
    // Executa a restauração nova e depois reproduz um estado legado ambíguo.
    assert.equal(readPresenceTransportPreference(), 'gemini_live');
    storage.setItem(PRESENCE_TRANSPORT_STORAGE_KEY, 'auto');
    assert.equal(readPresenceTransportPreference(), 'gemini_live');
    assert.equal(storage.getItem(PRESENCE_TRANSPORT_STORAGE_KEY), 'gemini_live');

    writePresenceTransportPreference('turn_based');
    assert.equal(readPresenceTransportPreference(), 'turn_based');
  });
});

test('Gemini usa o relay; local continua explicitamente local', () => {
  assert.equal(shouldUseGeminiLive('gemini_live'), true);
  assert.equal(shouldUseGeminiLive('turn_based'), false);
  assert.equal(shouldUseGeminiLive('gemini_live', '?gemini_live=0'), false);
});
