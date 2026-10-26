import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  DeviceSyncService,
  SqliteEventStore,
  eventDraft,
} from '../vendor/pulso-core/src/index.mjs';

function identity(deviceKey, suffix) {
  const { privateKey } = generateKeyPairSync('ed25519');
  return {
    version: 1,
    installationId: `${deviceKey}-${suffix}`.padEnd(24, '0'),
    deviceKey,
    privateKeyPkcs8Base64: privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64'),
  };
}

function fixture(deviceKey, suffix) {
  const dataDir = mkdtempSync(path.join(tmpdir(), `pulso-sync-${deviceKey}-`));
  const store = new SqliteEventStore(path.join(dataDir, 'core.sqlite'));
  const sync = new DeviceSyncService({
    store,
    dataDir,
    identity: identity(deviceKey, suffix),
    clock: () => '2026-10-23T15:00:00.000Z',
  });
  return { dataDir, store, sync };
}

function appendMessage(store, eventId, text) {
  const draft = eventDraft({
    type: 'live.message_appended',
    aggregateType: 'live_session',
    aggregateId: 'session_geral',
    correlationId: `corr_${eventId}`,
    actor: { kind: 'human', id: 'fe' },
    payload: { messageId: eventId, text },
    occurredAt: '2026-10-23T15:00:00.000Z',
  });
  draft.eventId = eventId;
  store.append([draft]);
}

test('identidade de sync expõe apenas chave pública e fingerprint estável', () => {
  const a = fixture('macbook', 'identity');
  const first = a.sync.deviceManifest();
  const second = a.sync.deviceManifest();
  assert.equal(first.fingerprint, second.fingerprint);
  assert.equal(first.deviceId, second.deviceId);
  assert.equal('privateKeyPkcs8Base64' in first, false);
  assert.equal(first.fingerprint.length, 64);
  a.store.close();
  rmSync(a.dataDir, { recursive: true, force: true });
});

test('troca de chave de um par confiável exige revogação explícita', () => {
  const a = fixture('macbook', 'pairing');
  const b1 = fixture('imac', 'same-device');
  const b2 = fixture('imac', 'same-device');
  assert.equal(b1.sync.deviceManifest().deviceId, b2.sync.deviceManifest().deviceId);
  a.sync.trustDevice(b1.sync.deviceManifest());
  assert.throws(
    () => a.sync.trustDevice(b2.sync.deviceManifest()),
    /trusted_peer_key_rotation_requires_revoke/,
  );
  a.sync.revokeDevice(b1.sync.deviceManifest().deviceId);
  assert.equal(a.sync.trustDevice(b2.sync.deviceManifest()).trustState, 'trusted');

  for (const item of [a, b1, b2]) {
    item.store.close();
    rmSync(item.dataDir, { recursive: true, force: true });
  }
});

test('bundle assinado replica eventos, é idempotente e não contém chave privada', () => {
  const a = fixture('macbook', 'roundtrip');
  const b = fixture('imac', 'roundtrip');
  a.sync.trustDevice(b.sync.deviceManifest(), { expectedFingerprint: b.sync.deviceManifest().fingerprint });
  b.sync.trustDevice(a.sync.deviceManifest(), { expectedFingerprint: a.sync.deviceManifest().fingerprint });
  appendMessage(a.store, 'evt_message_a', 'olá do MacBook');

  const exported = a.sync.exportBundle({ targetDeviceId: b.sync.deviceManifest().deviceId });
  const serialized = readFileSync(exported.path, 'utf8');
  assert.doesNotMatch(serialized, /privateKey|private_key|pkcs8/i);
  const firstImport = b.sync.importBundle({ bundlePath: exported.path });
  assert.equal(firstImport.imported, 1);
  assert.equal(firstImport.conflicts, 0);
  assert.equal(b.store.all()[0].payload.text, 'olá do MacBook');

  const secondImport = b.sync.importBundle({ bundlePath: exported.path });
  assert.equal(secondImport.imported, 0);
  assert.equal(secondImport.duplicates, 1);
  assert.equal(secondImport.conflicts, 0);
  assert.equal(secondImport.replay, true);

  const returnBundle = b.sync.exportBundle({ targetDeviceId: a.sync.deviceManifest().deviceId });
  const returnImport = a.sync.importBundle({ bundlePath: returnBundle.path });
  assert.equal(returnImport.imported, 0);
  assert.equal(returnImport.duplicates, 0);
  assert.equal(a.store.verifyIntegrity().ok, true);
  assert.equal(b.store.verifyIntegrity().ok, true);

  a.store.close();
  b.store.close();
  rmSync(a.dataDir, { recursive: true, force: true });
  rmSync(b.dataDir, { recursive: true, force: true });
});

test('edição concorrente não sobrescreve: entra em quarentena de conflito', () => {
  const a = fixture('macbook', 'conflict');
  const b = fixture('imac', 'conflict');
  b.sync.trustDevice(a.sync.deviceManifest());
  appendMessage(a.store, 'evt_from_macbook', 'texto A');
  appendMessage(b.store, 'evt_from_imac', 'texto B');
  const exported = a.sync.exportBundle({ targetDeviceId: b.sync.deviceManifest().deviceId });
  const result = b.sync.importBundle({ bundlePath: exported.path });
  assert.equal(result.imported, 0);
  assert.equal(result.conflicts, 1);
  assert.equal(b.store.all()[0].payload.text, 'texto B');
  assert.equal(b.sync.status().conflicts, 1);

  a.store.close();
  b.store.close();
  rmSync(a.dataDir, { recursive: true, force: true });
  rmSync(b.dataDir, { recursive: true, force: true });
});

test('exportação mantém segredo local, envia marcador assinado e registra redação no destino', () => {
  const a = fixture('macbook', 'secret-scan');
  const b = fixture('imac', 'secret-scan');
  a.sync.trustDevice(b.sync.deviceManifest());
  b.sync.trustDevice(a.sync.deviceManifest());
  appendMessage(a.store, 'evt_secret', 'Authorization: Bearer abcdefghijklmnopqrstuvwxyz123456');
  const exported = a.sync.exportBundle({ targetDeviceId: b.sync.deviceManifest().deviceId });
  assert.equal(exported.redactions, 1);
  const serialized = readFileSync(exported.path, 'utf8');
  assert.doesNotMatch(serialized, /abcdefghijklmnopqrstuvwxyz123456/);
  assert.match(serialized, /conteúdo sensível mantido apenas no dispositivo de origem/);
  const imported = b.sync.importBundle({ bundlePath: exported.path });
  assert.equal(imported.imported, 1);
  assert.equal(imported.redactions, 1);
  assert.equal(b.sync.status().redactions, 1);
  assert.equal(b.store.all()[0].payload.text, '[conteúdo sensível mantido apenas no dispositivo de origem]');
  const quarantine = path.join(a.dataDir, 'sync', 'quarantine');
  const receipt = readFileSync(path.join(quarantine, readdirSync(quarantine)[0]), 'utf8');
  assert.doesNotMatch(receipt, /abcdefghijklmnopqrstuvwxyz123456/);
  a.store.close(); b.store.close();
  rmSync(a.dataDir, { recursive: true, force: true });
  rmSync(b.dataDir, { recursive: true, force: true });
});
