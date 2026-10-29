import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  DeviceSyncService,
  classifySyncConflict,
  LiveService,
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
  assert.equal(b.sync.status().conflictInventory.summary.domainPending, 1);

  a.store.close();
  b.store.close();
  rmSync(a.dataDir, { recursive: true, force: true });
  rmSync(b.dataDir, { recursive: true, force: true });
});

test('classificador distingue bootstrap equivalente, estado local e conflito de domínio', () => {
  const base = {
    type: 'automation.created',
    aggregate: { type: 'automation', id: 'auto_1', sequence: 1 },
    payload: { automationId: 'auto_1', name: 'vigia', createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z' },
  };
  const equivalent = classifySyncConflict({
    reason: 'aggregate_sequence_collision',
    incomingEvent: base,
    existingEvent: { ...base, payload: { ...base.payload, createdAt: '2026-10-02T00:00:00Z', updatedAt: '2026-10-02T00:00:00Z' } },
  });
  assert.equal(equivalent.classification, 'equivalent_semantic');
  assert.equal(equivalent.status, 'classified');

  const local = classifySyncConflict({
    reason: 'aggregate_sequence_collision',
    incomingEvent: { type: 'live.session.selected', aggregate: { type: 'selection', id: 'active', sequence: 1 }, payload: { sessionId: 'a' } },
    existingEvent: { type: 'live.session.selected', aggregate: { type: 'selection', id: 'active', sequence: 1 }, payload: { sessionId: 'b' } },
  });
  assert.equal(local.classification, 'local_divergence_allowed');

  const domain = classifySyncConflict({
    reason: 'aggregate_sequence_collision',
    incomingEvent: { type: 'live.area.created', aggregate: { type: 'area', id: 'pulso', sequence: 1 }, payload: { nome: 'PULSO' } },
    existingEvent: { type: 'live.area.created', aggregate: { type: 'area', id: 'pulso', sequence: 1 }, payload: { nome: 'Outra área' } },
  });
  assert.equal(domain.classification, 'domain_conflict');
  assert.equal(domain.status, 'pending');
});

test('inventário classifica conflitos antigos sem apagar envelopes', () => {
  const a = fixture('macbook', 'inventory');
  const b = fixture('imac', 'inventory');
  b.sync.trustDevice(a.sync.deviceManifest());
  const occurredAt = '2026-10-23T15:00:00.000Z';
  for (const [store, createdAt] of [[a.store, '2026-10-01T00:00:00.000Z'], [b.store, '2026-10-02T00:00:00.000Z']]) {
    const draft = eventDraft({
      type: 'automation.created',
      aggregateType: 'automation',
      aggregateId: 'auto_same',
      correlationId: 'corr_auto_same',
      actor: { kind: 'system', id: 'test' },
      payload: { automationId: 'auto_same', name: 'vigia', createdAt, updatedAt: createdAt },
      occurredAt,
    });
    store.append([draft]);
  }
  const bundle = a.sync.exportBundle({ targetDeviceId: b.sync.deviceManifest().deviceId });
  assert.equal(b.sync.importBundle({ bundlePath: bundle.path }).conflicts, 1);
  const inventory = b.sync.classifyConflicts();
  assert.equal(inventory.summary.total, 1);
  assert.equal(inventory.summary.equivalent, 1);
  assert.equal(inventory.summary.domainPending, 0);
  assert.equal(b.store.db.prepare('SELECT COUNT(*) AS count FROM sync_conflicts').get().count, 1);
  const resolution = b.sync.resolveSafeClassifiedConflicts();
  assert.equal(resolution.resolved, 1);
  assert.equal(resolution.destructive, false);
  assert.equal(resolution.inventory.summary.unresolved, 0);
  assert.equal(b.store.db.prepare('SELECT COUNT(*) AS count FROM sync_conflicts').get().count, 1);
  a.store.close(); b.store.close();
  rmSync(a.dataDir, { recursive: true, force: true });
  rmSync(b.dataDir, { recursive: true, force: true });
});

test('estado efêmero e registro local de conexões não saem no bundle entre pares', () => {
  const a = fixture('macbook', 'local-only');
  const b = fixture('imac', 'local-only');
  a.sync.trustDevice(b.sync.deviceManifest());
  const drafts = [
    eventDraft({ type: 'live.session.selected', aggregateType: 'selection', aggregateId: 'active', correlationId: 'local-selection', actor: { kind: 'system', id: 'test' }, payload: { areaId: 'area_pulso', sessionId: 'session_a' }, occurredAt: '2026-10-23T15:00:00.000Z' }),
    eventDraft({ type: 'connection.profile_registered', aggregateType: 'connection_profile', aggregateId: 'notion-fe', correlationId: 'local-connection', actor: { kind: 'system', id: 'test' }, payload: { connectionId: 'notion-fe', service: 'notion', status: 'available' }, occurredAt: '2026-10-23T15:00:00.000Z' }),
    eventDraft({ type: 'live.message_appended', aggregateType: 'live_session', aggregateId: 'session_a', correlationId: 'shared-message', actor: { kind: 'human', id: 'fe' }, payload: { messageId: 'message_a', text: 'compartilhável' }, occurredAt: '2026-10-23T15:00:00.000Z' }),
  ];
  a.store.append(drafts);
  const exported = a.sync.exportBundle({ targetDeviceId: b.sync.deviceManifest().deviceId });
  const bundle = JSON.parse(readFileSync(exported.path, 'utf8'));
  assert.deepEqual(bundle.events.map(item => item.event.aggregate.type), ['live_session']);
  a.store.close(); b.store.close();
  rmSync(a.dataDir, { recursive: true, force: true });
  rmSync(b.dataDir, { recursive: true, force: true });
});

test('evento posterior explícito reconcilia projeções sem apagar os creates conflitantes', async () => {
  const macbook = fixture('macbook', 'area-reconcile');
  const imac = fixture('imac', 'area-reconcile');
  macbook.sync.trustDevice(imac.sync.deviceManifest());
  imac.sync.trustDevice(macbook.sync.deviceManifest());

  const macbookLive = new LiveService({ store: macbook.store });
  const imacLive = new LiveService({ store: imac.store });
  await macbookLive.createArea({ id: 'area_casa', nome: 'casa', glifo: '⌂', ordem: 3 });
  await imacLive.createArea({ id: 'area_casa', nome: 'Casa / Construção', glifo: '○', ordem: 5 });

  const initial = imac.sync.exportBundle({ targetDeviceId: macbook.sync.deviceManifest().deviceId });
  const initialImport = macbook.sync.importBundle({ bundlePath: initial.path });
  assert.equal(initialImport.conflicts, 1);
  assert.equal(macbookLive.getArea('area_casa').nome, 'casa');

  await imacLive.updateArea(
    { id: 'area_casa', nome: 'Casa / Construção', glifo: '○', ordem: 5 },
    { force: true, idempotencyKey: 'reconcile:area_casa:v1' },
  );
  const reconciliation = imac.sync.exportBundle({ targetDeviceId: macbook.sync.deviceManifest().deviceId });
  const reconciled = macbook.sync.importBundle({ bundlePath: reconciliation.path });
  assert.equal(reconciled.imported, 1);
  await macbookLive.restore();
  assert.deepEqual(
    {
      nome: macbookLive.getArea('area_casa').nome,
      glifo: macbookLive.getArea('area_casa').glifo,
      ordem: macbookLive.getArea('area_casa').ordem,
    },
    { nome: 'Casa / Construção', glifo: '○', ordem: 5 },
  );
  // The second bundle can repeat the unresolved create before the sequence-2
  // reconciliation event; it remains quarantined while the later event wins
  // the projection. Replay of the same bundle must not add another record.
  assert.equal(macbook.sync.status().conflicts, 2);

  const replay = macbook.sync.importBundle({ bundlePath: reconciliation.path });
  assert.equal(replay.imported, 0);
  assert.equal(replay.replay, true);

  macbook.store.close();
  imac.store.close();
  rmSync(macbook.dataDir, { recursive: true, force: true });
  rmSync(imac.dataDir, { recursive: true, force: true });
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
