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

const VOLATILE_SEMANTIC_KEYS = new Set([
  "createdAt",
  "updatedAt",
  "startedAt",
  "stoppedAt",
  "checkedAt",
  "provenance",
]);
const LOCAL_DIVERGENCE_AGGREGATES = new Set(["runtime_service", "selection"]);
const LOCAL_ONLY_AGGREGATES = Object.freeze([
  "runtime_service",
  "selection",
  "connection_profile",
  "connection_binding",
]);

function semanticValue(value) {
  if (Array.isArray(value)) return value.map(semanticValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value)
      .filter(([key]) => !VOLATILE_SEMANTIC_KEYS.has(key))
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => [key, semanticValue(item)]));
  }
  return value;
}

export function classifySyncConflict({ reason, incomingEvent, existingEvent = null } = {}) {
  if (reason !== "aggregate_sequence_collision" || !incomingEvent || !existingEvent) {
    return { classification: "domain_conflict", status: "pending", rationale: reason || "unknown_conflict" };
  }
  const sameType = incomingEvent.type === existingEvent.type;
  const samePayload = canonicalStringify(semanticValue(incomingEvent.payload))
    === canonicalStringify(semanticValue(existingEvent.payload));
  if (sameType && samePayload) {
    return {
      classification: "equivalent_semantic",
      status: "classified",
      rationale: "mesmo fato de domínio; diferem apenas proveniência ou campos voláteis",
    };
  }
  if (LOCAL_DIVERGENCE_AGGREGATES.has(incomingEvent.aggregate?.type)) {
    return {
      classification: "local_divergence_allowed",
      status: "classified",
      rationale: "estado efêmero deliberadamente local à instalação",
    };
  }
  return {
    classification: "domain_conflict",
    status: "pending",
    rationale: "eventos concorrentes exigem regra ou resolução explícita de domínio",
  };
}

const SENSITIVE_KEY = /^(?:authorization|cookie|set-cookie|password|passwd|access_?token|refresh_?token|api_?key|client_?secret|private_?key|privateKeyPkcs8Base64)$/i;
const SENSITIVE_VALUE = /(?:-----BEGIN [A-Z ]*PRIVATE KEY-----|\bBearer\s+[A-Za-z0-9._~+\/-]{20,}|\bsk-[A-Za-z0-9_-]{20,}|\bgh[pousr]_[A-Za-z0-9]{20,}|\bAIza[A-Za-z0-9_-]{25,}|\bxox[baprs]-[A-Za-z0-9-]{20,}|\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,})/;
const LOCAL_SECRET_REDACTION = "[conteúdo sensível mantido apenas no dispositivo de origem]";

function sensitivePaths(value, path = "$", hits = []) {
  if (hits.length >= 20) return hits;
  if (Array.isArray(value)) {
    value.forEach((item, index) => sensitivePaths(item, `${path}[${index}]`, hits));
    return hits;
  }
  if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      const nextPath = `${path}.${key}`;
      if (SENSITIVE_KEY.test(key) && item !== null && item !== "") hits.push(nextPath);
      else sensitivePaths(item, nextPath, hits);
    }
    return hits;
  }
  if (typeof value === "string" && SENSITIVE_VALUE.test(value)) hits.push(path);
  return hits;
}

function redactSensitiveValues(value) {
  if (Array.isArray(value)) return value.map(redactSensitiveValues);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [
      key,
      SENSITIVE_KEY.test(key) && item !== null && item !== ""
        ? LOCAL_SECRET_REDACTION
        : redactSensitiveValues(item),
    ]));
  }
  if (typeof value === "string" && SENSITIVE_VALUE.test(value)) return LOCAL_SECRET_REDACTION;
  return value;
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
      "CREATE TABLE IF NOT EXISTS sync_processed_bundles (",
      " bundle_id TEXT PRIMARY KEY,",
      " source_device_id TEXT NOT NULL,",
      " digest TEXT NOT NULL,",
      " imported_at TEXT NOT NULL,",
      " imported_events INTEGER NOT NULL,",
      " duplicate_events INTEGER NOT NULL,",
      " conflict_events INTEGER NOT NULL",
      ");",
      "CREATE TABLE IF NOT EXISTS sync_redactions (",
      " event_id TEXT PRIMARY KEY,",
      " source_device_id TEXT NOT NULL,",
      " origin_sequence INTEGER NOT NULL,",
      " sensitive_paths_json TEXT NOT NULL,",
      " recorded_at TEXT NOT NULL",
      ");",
      "CREATE INDEX IF NOT EXISTS idx_sync_origin_device ON sync_event_origin(origin_device_id, origin_sequence);",
    ].join("\n"));
    const conflictColumns = new Set(this.store.db.prepare("PRAGMA table_info(sync_conflicts)").all().map(row => row.name));
    if (!conflictColumns.has("classification")) this.store.db.exec("ALTER TABLE sync_conflicts ADD COLUMN classification TEXT");
    if (!conflictColumns.has("status")) this.store.db.exec("ALTER TABLE sync_conflicts ADD COLUMN status TEXT NOT NULL DEFAULT 'pending'");
    if (!conflictColumns.has("rationale")) this.store.db.exec("ALTER TABLE sync_conflicts ADD COLUMN rationale TEXT");
    if (!conflictColumns.has("classified_at")) this.store.db.exec("ALTER TABLE sync_conflicts ADD COLUMN classified_at TEXT");
    if (!conflictColumns.has("resolution_json")) this.store.db.exec("ALTER TABLE sync_conflicts ADD COLUMN resolution_json TEXT");
    if (!conflictColumns.has("resolved_at")) this.store.db.exec("ALTER TABLE sync_conflicts ADD COLUMN resolved_at TEXT");
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

  createPresence() {
    const identity = this.#identity();
    const unsigned = {
      schemaVersion: 1,
      source: this.deviceManifest(),
      observedAt: this.#now(),
    };
    const digest = sha256(canonicalStringify(unsigned));
    const signature = sign(null, Buffer.from(digest, "hex"), identity.privateKey).toString("base64");
    return { ...unsigned, digest, signature };
  }

  acceptPresence(presence) {
    invariant(presence?.schemaVersion === 1, "unsupported_sync_presence");
    const local = this.deviceManifest();
    const trusted = presence.source.deviceId === local.deviceId
      ? { public_key_spki_base64: local.publicKeySpkiBase64, trust_state: "trusted" }
      : this.store.db.prepare(
          "SELECT public_key_spki_base64,trust_state FROM sync_devices WHERE device_id=?"
        ).get(presence.source.deviceId);
    invariant(trusted?.trust_state === "trusted", "sync_presence_source_not_trusted");
    const unsigned = { schemaVersion: presence.schemaVersion, source: presence.source, observedAt: presence.observedAt };
    const digest = sha256(canonicalStringify(unsigned));
    invariant(digest === presence.digest, "sync_presence_digest_mismatch");
    const publicKey = createPublicKey({
      key: Buffer.from(trusted.public_key_spki_base64, "base64"),
      format: "der",
      type: "spki",
    });
    invariant(verify(null, Buffer.from(digest, "hex"), publicKey, Buffer.from(presence.signature, "base64")), "sync_presence_signature_invalid");
    invariant(Number.isFinite(Date.parse(presence.observedAt)), "sync_presence_time_invalid");
    if (presence.source.deviceId !== local.deviceId) {
      this.store.db.prepare("UPDATE sync_devices SET last_seen_at=? WHERE device_id=?")
        .run(presence.observedAt, presence.source.deviceId);
    }
    return { deviceId: presence.source.deviceId, deviceKey: presence.source.deviceKey, observedAt: presence.observedAt, fingerprint: presence.source.fingerprint };
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
    const conflictInventory = this.conflictInventory({ refresh: false, includeItems: false });
    const redactionCount = Number(this.store.db.prepare("SELECT COUNT(*) AS count FROM sync_redactions").get().count);
    return { configured: true, localDevice: manifest, trustedDevices: trusted, replicatedEvents: eventCount, conflicts: conflictCount, conflictInventory, redactions: redactionCount };
  }

  exportBundle({ targetDeviceId = null, outputPath = null, afterByOrigin = {} } = {}) {
    this.#backfillLocalOrigins();
    const identity = this.#identity();
    const origins = this.store.db.prepare(
      "SELECT DISTINCT origin_device_id FROM sync_event_origin ORDER BY origin_device_id"
    ).all().map(row => row.origin_device_id).filter(originDeviceId => originDeviceId !== targetDeviceId);
    const cursorClauses = origins.map(() => "(o.origin_device_id=? AND o.origin_sequence>?)");
    const cursorParams = origins.flatMap(originDeviceId => [
      originDeviceId,
      Number(afterByOrigin?.[originDeviceId] || 0),
    ]);
    const rows = cursorClauses.length === 0 ? [] : this.store.db.prepare([
      "SELECT e.*,o.origin_device_id,o.origin_sequence,o.event_hash",
      "FROM events e JOIN sync_event_origin o ON o.event_id=e.event_id",
      `WHERE (${cursorClauses.join(" OR ")})`,
      `AND e.aggregate_type NOT IN (${LOCAL_ONLY_AGGREGATES.map(() => "?").join(",")})`,
      "ORDER BY o.origin_device_id,o.origin_sequence",
    ].join(" ")).all(...cursorParams, ...LOCAL_ONLY_AGGREGATES);
    const quarantine = [];
    const events = rows.map(row => {
      const event = eventFromRow(row);
      const hits = sensitivePaths(event);
      if (hits.length === 0) {
        return {
          originDeviceId: row.origin_device_id,
          originSequence: row.origin_sequence,
          eventHash: row.event_hash,
          event,
        };
      }
      const redactedEvent = redactSensitiveValues(event);
      quarantine.push({
        eventId: event.eventId,
        eventType: event.type,
        aggregateType: event.aggregate.type,
        aggregateId: event.aggregate.id,
        originDeviceId: row.origin_device_id,
        originSequence: row.origin_sequence,
        sensitivePaths: hits,
      });
      return {
        originDeviceId: row.origin_device_id,
        originSequence: row.origin_sequence,
        eventHash: sha256(canonicalStringify(redactedEvent)),
        event: redactedEvent,
        redaction: { reason: "sensitive_content_local_only", sensitivePaths: hits },
      };
    });
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
    const secretHits = sensitivePaths(unsigned);
    if (secretHits.length > 0) {
      const quarantineId = pulsoId("sync_quarantine");
      atomicWriteJson(join(this.syncDir, "quarantine", `${quarantineId}.json`), {
        schemaVersion: 1,
        quarantineId,
        createdAt,
        targetDeviceId,
        eventCount: events.length,
        sensitivePaths: secretHits,
        reason: "sensitive_content_detected",
      });
      const error = new Error("sync_bundle_sensitive_content_detected");
      error.code = "SYNC_SENSITIVE_CONTENT";
      throw error;
    }
    if (quarantine.length > 0) {
      const quarantineId = pulsoId("sync_quarantine");
      atomicWriteJson(join(this.syncDir, "quarantine", `${quarantineId}.json`), {
        schemaVersion: 2,
        quarantineId,
        createdAt,
        targetDeviceId,
        eventCount: events.length,
        redactedEvents: quarantine,
        reason: "sensitive_content_redacted_from_bundle",
      });
    }
    const digest = sha256(canonicalStringify(unsigned));
    const signature = sign(null, Buffer.from(digest, "hex"), identity.privateKey).toString("base64");
    const bundle = { ...unsigned, digest, signature };
    const destination = outputPath || join(this.syncDir, "outbox", `${bundleId}.json`);
    atomicWriteJson(destination, bundle);
    const sourceCursors = Object.fromEntries(events.reduce((entries, envelope) => {
      const current = Number(entries.get(envelope.originDeviceId) || 0);
      entries.set(envelope.originDeviceId, Math.max(current, Number(envelope.originSequence)));
      return entries;
    }, new Map()));
    return { bundleId, path: destination, digest, events: events.length, redactions: quarantine.length, sourceCursors, sourceDeviceId: identity.deviceId, targetDeviceId };
  }

  #existingEventForEnvelope(envelope) {
    const aggregate = envelope?.event?.aggregate;
    if (!aggregate) return null;
    const row = this.store.db.prepare(
      "SELECT * FROM events WHERE aggregate_type=? AND aggregate_id=? AND aggregate_sequence=?"
    ).get(aggregate.type, aggregate.id, aggregate.sequence);
    return row ? eventFromRow(row) : null;
  }

  #recordConflict(bundle, envelope, reason) {
    const conflictId = pulsoId("conflict");
    const createdAt = this.#now();
    const classified = classifySyncConflict({
      reason,
      incomingEvent: envelope?.event || null,
      existingEvent: this.#existingEventForEnvelope(envelope),
    });
    this.store.db.prepare([
      "INSERT INTO sync_conflicts(conflict_id,bundle_id,source_device_id,event_id,reason,envelope_json,created_at,classification,status,rationale,classified_at)",
      "VALUES(?,?,?,?,?,?,?,?,?,?,?)",
    ].join(" ")).run(
      conflictId,
      bundle.bundleId,
      bundle.source.deviceId,
      envelope?.event?.eventId || null,
      reason,
      JSON.stringify(envelope || null),
      createdAt,
      classified.classification,
      classified.status,
      classified.rationale,
      createdAt,
    );
    atomicWriteJson(join(this.syncDir, "conflicts", `${conflictId}.json`), {
      conflictId,
      bundleId: bundle.bundleId,
      sourceDeviceId: bundle.source.deviceId,
      reason,
      classification: classified.classification,
      status: classified.status,
      envelope,
      createdAt,
    });
    return conflictId;
  }

  classifyConflicts() {
    const rows = this.store.db.prepare(
      "SELECT conflict_id,reason,envelope_json FROM sync_conflicts WHERE resolved_at IS NULL"
    ).all();
    const update = this.store.db.prepare(
      "UPDATE sync_conflicts SET classification=?,status=?,rationale=?,classified_at=? WHERE conflict_id=?"
    );
    const classifiedAt = this.#now();
    this.store.runInTransaction(() => {
      for (const row of rows) {
        const envelope = JSON.parse(row.envelope_json);
        const classified = classifySyncConflict({
          reason: row.reason,
          incomingEvent: envelope?.event || null,
          existingEvent: this.#existingEventForEnvelope(envelope),
        });
        update.run(classified.classification, classified.status, classified.rationale, classifiedAt, row.conflict_id);
      }
    });
    return this.conflictInventory({ refresh: false, includeItems: false });
  }

  resolveSafeClassifiedConflicts() {
    this.classifyConflicts();
    const rows = this.store.db.prepare([
      "SELECT conflict_id,classification,rationale FROM sync_conflicts",
      "WHERE resolved_at IS NULL AND status='classified'",
      "AND classification IN ('equivalent_semantic','local_divergence_allowed')",
    ].join(" ")).all();
    const resolvedAt = this.#now();
    const update = this.store.db.prepare([
      "UPDATE sync_conflicts SET status='resolved',resolution_json=?,resolved_at=?",
      "WHERE conflict_id=? AND resolved_at IS NULL",
    ].join(" "));
    this.store.runInTransaction(() => {
      for (const row of rows) {
        const resolution = row.classification === "equivalent_semantic"
          ? { policy: "retain_local_equivalent", destructive: false, rationale: row.rationale }
          : { policy: "retain_device_local_state", destructive: false, rationale: row.rationale };
        update.run(JSON.stringify(resolution), resolvedAt, row.conflict_id);
      }
    });
    return {
      resolved: rows.length,
      retainedEnvelopes: rows.length,
      destructive: false,
      inventory: this.conflictInventory({ refresh: false, includeItems: false }),
    };
  }

  conflictInventory({ refresh = false, includeItems = false, limit = 100 } = {}) {
    if (refresh) return this.classifyConflicts();
    const groups = this.store.db.prepare([
      "SELECT COALESCE(classification,'unclassified') AS classification,status,reason,COUNT(*) AS count,COUNT(DISTINCT event_id) AS events",
      "FROM sync_conflicts GROUP BY COALESCE(classification,'unclassified'),status,reason",
      "ORDER BY count DESC,classification,status,reason",
    ].join(" ")).all().map(row => ({
      classification: row.classification,
      status: row.status,
      reason: row.reason,
      count: Number(row.count),
      events: Number(row.events),
    }));
    const total = groups.reduce((sum, item) => sum + item.count, 0);
    const summary = {
      total,
      equivalent: groups.filter(item => item.classification === "equivalent_semantic").reduce((sum, item) => sum + item.count, 0),
      localDivergence: groups.filter(item => item.classification === "local_divergence_allowed").reduce((sum, item) => sum + item.count, 0),
      domainPending: groups.filter(item => item.classification === "domain_conflict" && item.status === "pending").reduce((sum, item) => sum + item.count, 0),
      unresolved: groups.filter(item => item.status === "pending").reduce((sum, item) => sum + item.count, 0),
    };
    const result = { summary, groups };
    if (includeItems) {
      result.items = this.store.db.prepare([
        "SELECT conflict_id,bundle_id,source_device_id,event_id,reason,classification,status,rationale,created_at,classified_at,resolved_at",
        "FROM sync_conflicts ORDER BY created_at DESC LIMIT ?",
      ].join(" ")).all(Math.max(1, Math.min(500, Number(limit) || 100))).map(row => ({
        conflictId: row.conflict_id,
        bundleId: row.bundle_id,
        sourceDeviceId: row.source_device_id,
        eventId: row.event_id,
        reason: row.reason,
        classification: row.classification || "unclassified",
        status: row.status,
        rationale: row.rationale,
        createdAt: row.created_at,
        classifiedAt: row.classified_at,
        resolvedAt: row.resolved_at,
      }));
    }
    return result;
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

    const processed = this.store.db.prepare(
      "SELECT digest,imported_events,duplicate_events,conflict_events,imported_at FROM sync_processed_bundles WHERE bundle_id=?"
    ).get(parsed.bundleId);
    if (processed) {
      invariant(processed.digest === digest, "sync_bundle_id_digest_mismatch");
      return {
        bundleId: parsed.bundleId,
        sourceDeviceId: parsed.source.deviceId,
        imported: 0,
        duplicates: parsed.events.length,
        conflicts: 0,
        total: parsed.events.length,
        replay: true,
        firstImportedAt: processed.imported_at,
        integrity: this.store.verifyIntegrity(),
      };
    }

    let imported = 0;
    let duplicates = 0;
    let conflicts = 0;
    const insertOrigin = this.store.db.prepare([
      "INSERT INTO sync_event_origin(event_id,origin_device_id,origin_sequence,event_hash,imported_at)",
      "VALUES(?,?,?,?,?)",
    ].join(" "));
    const insertRedaction = this.store.db.prepare([
      "INSERT OR REPLACE INTO sync_redactions(event_id,source_device_id,origin_sequence,sensitive_paths_json,recorded_at)",
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
        if (envelope.redaction?.reason === "sensitive_content_local_only") {
          insertRedaction.run(
            event.eventId,
            envelope.originDeviceId,
            envelope.originSequence,
            JSON.stringify(Array.isArray(envelope.redaction.sensitivePaths) ? envelope.redaction.sensitivePaths : []),
            this.#now(),
          );
        }
      });
      imported += 1;
    }

    if (parsed.source.deviceId !== local.deviceId) {
      this.store.db.prepare("UPDATE sync_devices SET last_seen_at=? WHERE device_id=?")
        .run(this.#now(), parsed.source.deviceId);
    }
    this.store.db.prepare([
      "INSERT INTO sync_processed_bundles(bundle_id,source_device_id,digest,imported_at,imported_events,duplicate_events,conflict_events)",
      "VALUES(?,?,?,?,?,?,?)",
    ].join(" ")).run(
      parsed.bundleId,
      parsed.source.deviceId,
      digest,
      this.#now(),
      imported,
      duplicates,
      conflicts,
    );
    return {
      bundleId: parsed.bundleId,
      sourceDeviceId: parsed.source.deviceId,
      imported,
      duplicates,
      conflicts,
      redactions: parsed.events.filter(envelope => envelope.redaction?.reason === "sensitive_content_local_only").length,
      total: parsed.events.length,
      replay: false,
      integrity: this.store.verifyIntegrity(),
    };
  }
}
