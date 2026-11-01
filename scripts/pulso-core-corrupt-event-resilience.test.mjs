import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { createDesktopBridge } from '../vendor/pulso-core/desktop/bridge.mjs';
import {
  SqliteEventStore,
  eventDraft,
} from '../vendor/pulso-core/src/index.mjs';

const occurredAt = '2026-11-01T12:00:00.000Z';

function sessionCreated(sessionId) {
  return eventDraft({
    type: 'session.created',
    aggregateType: 'session',
    aggregateId: sessionId,
    correlationId: sessionId,
    actor: { kind: 'core', id: 'pulso-core' },
    payload: {
      spaceId: null,
      identityId: 'lotus',
      createdAt: occurredAt,
    },
    occurredAt,
  });
}

test('evento com JSON corrompido é isolado sem apagar história nem derrubar o Core', async () => {
  const dataDir = mkdtempSync(path.join(tmpdir(), 'pulso-corrupt-event-'));
  const dbPath = path.join(dataDir, 'pulso-core.sqlite');
  const store = new SqliteEventStore(dbPath);
  const first = sessionCreated('session_readable_1');
  const corrupt = sessionCreated('session_corrupt');
  const last = sessionCreated('session_readable_2');

  store.append([first, corrupt, last]);
  store.db.prepare('UPDATE events SET payload_json = ? WHERE event_id = ?').run(
    '{"secret":"must-never-leak",BROKEN',
    corrupt.eventId,
  );

  const readable = store.all();
  assert.deepEqual(readable.map(event => event.eventId), [first.eventId, last.eventId]);

  const report = store.corruptionReport();
  assert.equal(report.status, 'degraded');
  assert.equal(report.totalEvents, 3);
  assert.equal(report.readableEvents, 2);
  assert.equal(report.corruptEvents, 1);
  assert.equal(report.events[0].eventId, corrupt.eventId);
  assert.deepEqual(report.events[0].fields, ['payload_json']);
  assert.doesNotMatch(JSON.stringify(report), /must-never-leak/);

  const integrity = store.verifyIntegrity();
  assert.equal(integrity.ok, true);
  assert.equal(integrity.degraded, true);
  assert.equal(integrity.events, 3);
  assert.equal(integrity.readableEvents, 2);
  assert.equal(integrity.corruptEvents, 1);
  store.close();

  const bridge = createDesktopBridge({ dataDir });
  const bootstrap = await bridge.handleRequest({
    requestId: 'bootstrap-corrupt-event',
    method: 'bootstrap',
    params: {},
  });
  assert.equal(bootstrap.ok, true);
  assert.equal(bootstrap.result.health.storeIntegrity.ok, true);
  assert.equal(bootstrap.result.health.storeIntegrity.degraded, true);
  assert.equal(bootstrap.result.health.storeIntegrity.corruptEvents, 1);
  assert.doesNotMatch(JSON.stringify(bootstrap), /must-never-leak/);

  await bridge.close();
  rmSync(dataDir, { recursive: true, force: true });
});
