import { DatabaseSync } from "node:sqlite";
import { dirname } from "node:path";
import { copyFileSync, mkdirSync } from "node:fs";
import { invariant } from "../domain/contracts.mjs";

function encode(value) {
  return JSON.stringify(value ?? null);
}

function decode(value) {
  return JSON.parse(value);
}

export class SqliteEventStore {
  constructor(filename = ":memory:") {
    this.filename = filename;
    if (filename !== ":memory:") mkdirSync(dirname(filename), { recursive: true });
    this.db = new DatabaseSync(filename);
    this.db.exec("PRAGMA journal_mode = WAL");
    this.db.exec("PRAGMA busy_timeout = 5000");
    this.db.exec("PRAGMA foreign_keys = ON");
    this.db.exec([
      "CREATE TABLE IF NOT EXISTS events (",
      " event_id TEXT PRIMARY KEY,",
      " event_type TEXT NOT NULL,",
      " aggregate_type TEXT NOT NULL,",
      " aggregate_id TEXT NOT NULL,",
      " aggregate_sequence INTEGER NOT NULL,",
      " correlation_id TEXT NOT NULL,",
      " causation_id TEXT,",
      " actor_json TEXT NOT NULL,",
      " payload_json TEXT NOT NULL,",
      " occurred_at TEXT NOT NULL,",
      " recorded_at TEXT NOT NULL,",
      " UNIQUE(aggregate_type, aggregate_id, aggregate_sequence)",
      ");",
      "CREATE INDEX IF NOT EXISTS idx_events_correlation ON events(correlation_id, recorded_at, event_id);",
      "CREATE TABLE IF NOT EXISTS idempotency (",
      " scope TEXT NOT NULL,",
      " key TEXT NOT NULL,",
      " entity_id TEXT NOT NULL,",
      " created_at TEXT NOT NULL,",
      " PRIMARY KEY(scope, key)",
      ");"
    ].join("\n"));
    this.insertEvent = this.db.prepare([
      "INSERT INTO events (event_id,event_type,aggregate_type,aggregate_id,aggregate_sequence,correlation_id,causation_id,actor_json,payload_json,occurred_at,recorded_at)",
      "VALUES (?,?,?,?,?,?,?,?,?,?,?)"
    ].join(" "));
    this.nextSequence = this.db.prepare("SELECT COALESCE(MAX(aggregate_sequence),0)+1 AS seq FROM events WHERE aggregate_type=? AND aggregate_id=?");
    this.findIdempotencyStmt = this.db.prepare("SELECT entity_id FROM idempotency WHERE scope=? AND key=?");
    this.insertIdempotency = this.db.prepare("INSERT INTO idempotency (scope,key,entity_id,created_at) VALUES (?,?,?,?)");
    this._txDepth = 0;
    this.beforeAppendHook = null;
  }

  get inTransaction() {
    return this._txDepth > 0;
  }

  findIdempotency(scope, key) {
    return this.findIdempotencyStmt.get(scope, key)?.entity_id ?? null;
  }

  runInTransaction(fn) {
    invariant(typeof fn === "function", "transaction_fn_required");
    if (this._txDepth > 0) {
      const spName = `sp_pulso_${this._txDepth}`;
      this.db.exec(`SAVEPOINT ${spName}`);
      this._txDepth += 1;
      try {
        const result = fn();
        this._txDepth -= 1;
        this.db.exec(`RELEASE SAVEPOINT ${spName}`);
        return result;
      } catch (error) {
        this._txDepth -= 1;
        this.db.exec(`ROLLBACK TO SAVEPOINT ${spName}`);
        this.db.exec(`RELEASE SAVEPOINT ${spName}`);
        throw error;
      }
    }

    this.db.exec("BEGIN IMMEDIATE");
    this._txDepth = 1;
    try {
      const result = fn();
      this._txDepth = 0;
      this.db.exec("COMMIT");
      return result;
    } catch (error) {
      this._txDepth = 0;
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  appendInTransaction(drafts, options = {}) {
    invariant(this._txDepth > 0, "active_transaction_required");
    invariant(Array.isArray(drafts) && drafts.length > 0, "events_required");
    if (options.idempotency) {
      const existing = this.findIdempotency(options.idempotency.scope, options.idempotency.key);
      if (existing) {
        return { duplicate: true, entityId: existing, events: [] };
      }
    }
    const committed = [];
    for (const draft of drafts) {
      if (typeof this.beforeAppendHook === "function") {
        this.beforeAppendHook(draft, drafts, options);
      }
      const sequence = this.nextSequence.get(draft.aggregate.type, draft.aggregate.id).seq;
      const event = {
        ...draft,
        aggregate: { ...draft.aggregate, sequence }
      };
      this.insertEvent.run(
        event.eventId,
        event.type,
        event.aggregate.type,
        event.aggregate.id,
        event.aggregate.sequence,
        event.correlationId,
        event.causationId,
        encode(event.actor),
        encode(event.payload),
        event.occurredAt,
        event.recordedAt
      );
      committed.push(event);
    }
    if (options.idempotency) {
      this.insertIdempotency.run(
        options.idempotency.scope,
        options.idempotency.key,
        options.idempotency.entityId,
        options.idempotency.createdAt ?? new Date().toISOString()
      );
    }
    return { duplicate: false, entityId: options.idempotency?.entityId ?? null, events: committed };
  }

  append(drafts, options = {}) {
    invariant(Array.isArray(drafts) && drafts.length > 0, "events_required");
    return this.runInTransaction(() => this.appendInTransaction(drafts, options));
  }

  all() {
    return this.db.prepare("SELECT * FROM events ORDER BY rowid").all().map(row => ({
      eventId: row.event_id,
      type: row.event_type,
      aggregate: {
        type: row.aggregate_type,
        id: row.aggregate_id,
        sequence: row.aggregate_sequence
      },
      correlationId: row.correlation_id,
      causationId: row.causation_id,
      actor: decode(row.actor_json),
      payload: decode(row.payload_json),
      occurredAt: row.occurred_at,
      recordedAt: row.recorded_at
    }));
  }

  byCorrelation(correlationId) {
    return this.all().filter(event => event.correlationId === correlationId);
  }

  verifyIntegrity() {
    const expected = new Map();
    for (const event of this.all()) {
      const key = event.aggregate.type + ":" + event.aggregate.id;
      const next = (expected.get(key) ?? 0) + 1;
      invariant(event.aggregate.sequence === next, "aggregate_sequence_gap:" + key);
      expected.set(key, next);
    }
    return { ok: true, events: this.all().length, aggregates: expected.size };
  }

  backup(destination) {
    invariant(this.filename !== ":memory:", "cannot_backup_memory_store");
    mkdirSync(dirname(destination), { recursive: true });
    this.db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
    copyFileSync(this.filename, destination);
    return destination;
  }

  close() {
    this.db.close();
  }
}
