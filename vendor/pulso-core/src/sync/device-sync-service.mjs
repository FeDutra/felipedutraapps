import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import {
  createHash,
  createPrivateKey,
  createPublicKey,
  sign,
  verify,
} from "node:crypto";
import { invariant } from "../domain/assertions.mjs";
import { pulsoId } from "../domain/contracts.mjs";

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalize(value[key])]));
  }
  return value;
}

export function canonicalStringify(value) {
  return JSON.stringify(canonicalize(value));
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function eventFromRow(row) {
  return {
    eventId: row.event_id,
    type: row.event_type,
    aggregate: {
      type: row.aggregate_type,
      id: row.aggregate_id,
      sequence: row.aggregate_sequence,
    },
    correlationId: row.correlation_id,
    causationId: row.causation_id,
    actor: JSON.parse(row.actor_json),
    payload: JSON.parse(row.payload_json),
    occurredAt: row.occurred_at,
    recordedAt: row.recorded_at,
  };
}

function atomicWriteJson(path, value) {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const temp = `${path}.tmp-${process.pid}-${Date.now()}`;
  writeFileSync(temp, JSON.stringify(value, null, 2) + "\n", { mode: 0o600 });
  renameSync(temp, path);
  chmodSync(path, 0o600);
}

export class DeviceSyncService {
  constructor({ store, dataDir, identityPath = null, identity = null, clock = () => new Date().toISOString() }) {
    invariant(store?.db, "sqlite_event_store_required");
    invariant(typeof dataDir === "string" && dataDir.trim(), "sync_data_dir_required");
    this.store = store;
    this.dataDir = dataDir;
    this.syncDir = join(dataDir, "sync");
    this.identityPath = identityPath || join(dataDir, "device-origin.json");
    this.identityOverride = identity;
    this.clock = clock;
    mkdirSync(join(this.syncDir, "outbox"), { recursive: true, mode: 0o700 });
    mkdirSync(join(this.syncDir, "inbox"), { recursive: true, mode: 0o700 });
    mkdirSync(join(this.syncDir, "conflicts"), { recursive: true, mode: 0o700 });
    this.#ensureSchema();
  }

  #now() {
    return typeof this.clock === "function" ? this.clock() : this.clock.now();
  }

  #ensureSchema() {
    this.store.db.exec([
      "CREATE TABLE IF NOT EXISTS sync_devices (",
      " device_id TEXT PRIMARY KEY,",
      " device_key TEXT NOT NULL,",
      " public_key_spki_base64 TEXT NOT NULL,",
      " fingerprint TEXT NOT NULL UNIQUE,",
      " trust_state TEXT NOT NULL,",
      " first_seen_at TEXT NOT NULL,",
      " last_seen_at TEXT NOT NULL,",
      " revoked_at TEXT",
      ");",
      "CREATE TABLE IF NOT EXISTS sync_event_origin (",
      " event_id TEXT PRIMARY KEY,",
      " origin_device_id TEXT NOT NULL,",
      " origin_sequence INTEGER NOT NULL,",
      " event_hash TEXT NOT NULL,",
      " imported_at TEXT NOT NULL,",
      " UNIQUE(origin_device_id, origin_sequence)",
      ");",
      "CREATE TABLE IF NOT EXISTS sync_conflicts (",
      " conflict_id TEXT PRIMARY KEY,",
      " bundle_id TEXT NOT NULL,",
      " source_device_id TEXT NOT NULL,",
      " event_id TEXT,",
      " reason TEXT NOT NULL,",
      " envelope_json TEXT NOT NULL,",
      " created_at TEXT NOT NULL",
      ");",
      "CREATE INDEX IF NOT EXISTS idx_sync_origin_device ON sync_event_origin(origin_device_id, origin_sequence);",
    ].join("\n"));
  }

  #identity() {
    const raw = this.identityOverride || (() => {
      invariant(existsSync(this.identityPath), "device_origin_not_provisioned");
      return JSON.parse(readFileSync(this.identityPath, "utf8"));
    })();
    const deviceId = raw.installationId || raw.installation_id;
    const deviceKey = raw.deviceKey || raw.device_key;
    const privateKeyPkcs8Base64 = raw.privateKeyPkcs8Base64 || raw.private_key_pkcs8_base64;
    invariant(typeof deviceId === "string" && deviceId.length >= 16, "invalid_device_id");
    invariant(typeof deviceKey === "string" && deviceKey.length > 0, "invalid_device_key");
    invariant(typeof privateKeyPkcs8Base64 === "string" && privateKeyPkcs8Base64.length >= 48, "invalid_device_private_key");
    const privateKey = createPrivateKey({
      key: Buffer.from(privateKeyPkcs8Base64, "base64"),
      format: "der",
      type: "pkcs8",
    });
    const publicDer = createPublicKey(privateKey).export({ format: "der", type: "spki" });
    const publicKeySpkiBase64 = Buffer.from(publicDer).toString("base64");
    return {
      deviceId,
      deviceKey,
      privateKey,
      publicKeySpkiBase64,
      fingerprint: sha256(publicDer),
    };
  }

  deviceManifest() {
    const identity = this.#identity();
    return {
      schemaVersion: 1,
      deviceId: identity.deviceId,
      deviceKey: identity.deviceKey,
      publicKeySpkiBase64: identity.publicKeySpkiBase64,
      fingerprint: identity.fingerprint,
    };
  }

  trustDevice(manifest, { expectedFingerprint } = {}) {
    invariant(manifest?.schemaVersion === 1, "unsupported_device_manifest");
    invariant(typeof manifest.deviceId === "string" && manifest.deviceId.length >= 16, "invalid_peer_device_id");
    invariant(typeof manifest.publicKeySpkiBase64 === "string", "invalid_peer_public_key");
    const publicDer = Buffer.from(manifest.publicKeySpkiBase64, "base64");
    const fingerprint = sha256(publicDer);
    invariant(fingerprint === manifest.fingerprint, "peer_fingerprint_mismatch");
    if (expectedFingerprint) invariant(fingerprint === expectedFingerprint, "unexpected_peer_fingerprint");
    const existing = this.store.db.prepare(
      "SELECT fingerprint,trust_state FROM sync_devices WHERE device_id=?"
    ).get(manifest.deviceId);
    if (existing?.trust_state === "trusted") {
      invariant(existing.fingerprint === fingerprint, "trusted_peer_key_rotation_requires_revoke");
    }
    const now = this.#now();
    this.store.db.prepare([
      "INSERT INTO sync_devices(device_id,device_key,public_key_spki_base64,fingerprint,trust_state,first_seen_at,last_seen_at,revoked_at)",
      "VALUES(?,?,?,?,?,?,?,NULL)",
      "ON CONFLICT(device_id) DO UPDATE SET",
      "device_key=excluded.device_key, public_key_spki_base64=excluded.public_key_spki_base64,",
      "fingerprint=excluded.fingerprint, trust_state='trusted', last_seen_at=excluded.last_seen_at, revoked_at=NULL",
    ].join(" ")).run(
      manifest.deviceId,
      manifest.deviceKey || "peer",
      manifest.publicKeySpkiBase64,
      fingerprint,
      "trusted",
      now,
      now,
    );
    return { deviceId: manifest.deviceId, fingerprint, trustState: "trusted" };
  }

  revokeDevice(deviceId) {
    const now = this.#now();
    const result = this.store.db.prepare(
      "UPDATE sync_devices SET trust_state='revoked', revoked_at=?, last_seen_at=? WHERE device_id=?"
    ).run(now, now, deviceId);
    invariant(result.changes === 1, "peer_device_not_found");
    return { deviceId, trustState: "revoked", revokedAt: now };
  }

  #backfillLocalOrigins() {
    const identity = this.#identity();
    const rows = this.store.db.prepare([
      "SELECT e.* FROM events e",
      "LEFT JOIN sync_event_origin o ON o.event_id=e.event_id",
      "WHERE o.event_id IS NULL ORDER BY e.rowid",
    ].join(" ")).all();
    let next = Number(this.store.db.prepare(
      "SELECT COALESCE(MAX(origin_sequence),0) AS seq FROM sync_event_origin WHERE origin_device_id=?"
    ).get(identity.deviceId)?.seq || 0);
    const insert = this.store.db.prepare([
      "INSERT INTO sync_event_origin(event_id,origin_device_id,origin_sequence,event_hash,imported_at)",
      "VALUES(?,?,?,?,?)",
    ].join(" "));
    const now = this.#now();
    this.store.runInTransaction(() => {
      for (const row of rows) {
        const event = eventFromRow(row);
        next += 1;
        insert.run(event.eventId, identity.deviceId, next, sha256(canonicalStringify(event)), now);
      }
    });
    return rows.length;
  }

  status() {
    const manifest = this.deviceManifest();
    this.#backfillLocalOrigins();
    const trusted = this.store.db.prepare(
      "SELECT device_id,device_key,fingerprint,trust_state,first_seen_at,last_seen_at,revoked_at FROM sync_devices ORDER BY device_key,device_id"
    ).all();
    const eventCount = Number(this.store.db.prepare("SELECT COUNT(*) AS count FROM sync_event_origin").get().count);
    const conflictCount = Number(this.store.db.prepare("SELECT COUNT(*) AS count FROM sync_conflicts").get().count);
    return { configured: true, localDevice: manifest, trustedDevices: trusted, replicatedEvents: eventCount, conflicts: conflictCount };
  }

  exportBundle({ targetDeviceId = null, outputPath = null } = {}) {
    this.#backfillLocalOrigins();
    const identity = this.#identity();
    const rows = this.store.db.prepare([
      "SELECT e.*,o.origin_device_id,o.origin_sequence,o.event_hash",
      "FROM events e JOIN sync_event_origin o ON o.event_id=e.event_id",
      "ORDER BY o.origin_device_id,o.origin_sequence",
    ].join(" ")).all();
    const events = rows.map(row => ({
      originDeviceId: row.origin_device_id,
      originSequence: row.origin_sequence,
      eventHash: row.event_hash,
      event: eventFromRow(row),
    }));
    const createdAt = this.#now();
    const bundleId = pulsoId("sync");
    const unsigned = {
      schemaVersion: 1,
      bundleId,
      createdAt,
      targetDeviceId,
      source: this.deviceManifest(),
      events,
    };
    const digest = sha256(canonicalStringify(unsigned));
    const signature = sign(null, Buffer.from(digest, "hex"), identity.privateKey).toString("base64");
    const bundle = { ...unsigned, digest, signature };
    const destination = outputPath || join(this.syncDir, "outbox", `${bundleId}.json`);
    atomicWriteJson(destination, bundle);
    return { bundleId, path: destination, digest, events: events.length, sourceDeviceId: identity.deviceId, targetDeviceId };
  }

  #recordConflict(bundle, envelope, reason) {
    const conflictId = pulsoId("conflict");
    const createdAt = this.#now();
    this.store.db.prepare([
      "INSERT INTO sync_conflicts(conflict_id,bundle_id,source_device_id,event_id,reason,envelope_json,created_at)",
      "VALUES(?,?,?,?,?,?,?)",
    ].join(" ")).run(
      conflictId,
      bundle.bundleId,
      bundle.source.deviceId,
      envelope?.event?.eventId || null,
      reason,
      JSON.stringify(envelope || null),
      createdAt,
    );
    atomicWriteJson(join(this.syncDir, "conflicts", `${conflictId}.json`), {
      conflictId,
      bundleId: bundle.bundleId,
      sourceDeviceId: bundle.source.deviceId,
      reason,
      envelope,
      createdAt,
    });
    return conflictId;
  }

  importBundle({ bundle = null, bundlePath = null } = {}) {
    invariant(bundle || bundlePath, "sync_bundle_required");
    const parsed = bundle || JSON.parse(readFileSync(bundlePath, "utf8"));
    invariant(parsed?.schemaVersion === 1, "unsupported_sync_bundle");
    invariant(Array.isArray(parsed.events), "sync_bundle_events_required");
    const local = this.deviceManifest();
    if (parsed.targetDeviceId) invariant(parsed.targetDeviceId === local.deviceId, "sync_bundle_wrong_target");
    const trusted = parsed.source.deviceId === local.deviceId
      ? { public_key_spki_base64: local.publicKeySpkiBase64, trust_state: "trusted" }
      : this.store.db.prepare(
          "SELECT public_key_spki_base64,trust_state FROM sync_devices WHERE device_id=?"
        ).get(parsed.source.deviceId);
    invariant(trusted?.trust_state === "trusted", "sync_source_not_trusted");
    const unsigned = {
      schemaVersion: parsed.schemaVersion,
      bundleId: parsed.bundleId,
      createdAt: parsed.createdAt,
      targetDeviceId: parsed.targetDeviceId ?? null,
      source: parsed.source,
      events: parsed.events,
    };
    const digest = sha256(canonicalStringify(unsigned));
    invariant(digest === parsed.digest, "sync_bundle_digest_mismatch");
    const publicKey = createPublicKey({
      key: Buffer.from(trusted.public_key_spki_base64, "base64"),
      format: "der",
      type: "spki",
    });
    invariant(verify(null, Buffer.from(digest, "hex"), publicKey, Buffer.from(parsed.signature, "base64")), "sync_bundle_signature_invalid");

    let imported = 0;
    let duplicates = 0;
    let conflicts = 0;
    const insertOrigin = this.store.db.prepare([
      "INSERT INTO sync_event_origin(event_id,origin_device_id,origin_sequence,event_hash,imported_at)",
      "VALUES(?,?,?,?,?)",
    ].join(" "));

    for (const envelope of parsed.events) {
      const event = envelope.event;
      const calculatedHash = sha256(canonicalStringify(event));
      if (calculatedHash !== envelope.eventHash) {
        this.#recordConflict(parsed, envelope, "event_hash_mismatch");
        conflicts += 1;
        continue;
      }
      const existingById = this.store.db.prepare("SELECT * FROM events WHERE event_id=?").get(event.eventId);
      if (existingById) {
        if (sha256(canonicalStringify(eventFromRow(existingById))) === envelope.eventHash) duplicates += 1;
        else {
          this.#recordConflict(parsed, envelope, "event_id_collision");
          conflicts += 1;
        }
        continue;
      }
      const sequenceCollision = this.store.db.prepare(
        "SELECT event_id FROM events WHERE aggregate_type=? AND aggregate_id=? AND aggregate_sequence=?"
      ).get(event.aggregate.type, event.aggregate.id, event.aggregate.sequence);
      if (sequenceCollision) {
        this.#recordConflict(parsed, envelope, "aggregate_sequence_collision");
        conflicts += 1;
        continue;
      }
      const head = Number(this.store.db.prepare(
        "SELECT COALESCE(MAX(aggregate_sequence),0) AS seq FROM events WHERE aggregate_type=? AND aggregate_id=?"
      ).get(event.aggregate.type, event.aggregate.id)?.seq || 0);
      if (event.aggregate.sequence !== head + 1) {
        this.#recordConflict(parsed, envelope, "aggregate_sequence_gap");
        conflicts += 1;
        continue;
      }

      this.store.runInTransaction(() => {
        this.store.insertEvent.run(
          event.eventId,
          event.type,
          event.aggregate.type,
          event.aggregate.id,
          event.aggregate.sequence,
          event.correlationId,
          event.causationId,
          JSON.stringify(event.actor),
          JSON.stringify(event.payload),
          event.occurredAt,
          event.recordedAt,
        );
        insertOrigin.run(
          event.eventId,
          envelope.originDeviceId,
          envelope.originSequence,
          envelope.eventHash,
          this.#now(),
        );
      });
      imported += 1;
    }

    if (parsed.source.deviceId !== local.deviceId) {
      this.store.db.prepare("UPDATE sync_devices SET last_seen_at=? WHERE device_id=?")
        .run(this.#now(), parsed.source.deviceId);
    }
    return {
      bundleId: parsed.bundleId,
      sourceDeviceId: parsed.source.deviceId,
      imported,
      duplicates,
      conflicts,
      total: parsed.events.length,
      integrity: this.store.verifyIntegrity(),
    };
  }
}
