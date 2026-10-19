import { eventDraft, invariant, pulsoId, assertExternalIdsConfined } from "../domain/contracts.mjs";
import { assertNoSecrets } from "../control-plane/secrets.mjs";
import { applyControlPlaneEvent } from "../control-plane/panel-projector.mjs";
import { SecretRefResolver } from "./secret-ref-resolver.mjs";
import {
  OUTBOX_STATUSES,
  OUTBOX_TERMINAL,
  assertOutboxTransition,
  normalizeBackoffPolicy,
  computeDeterministicBackoff,
  validateOutboxItem,
  validateDeliveryReceipt
} from "./runtime-contracts.mjs";

const OUTBOX_ACTOR = Object.freeze({ kind: "runtime", id: "durable-outbox" });

function addMsIso(isoString, deltaMs) {
  const baseMs = Date.parse(isoString);
  invariant(Number.isFinite(baseMs), "invalid_iso_timestamp:" + isoString);
  return new Date(baseMs + deltaMs).toISOString();
}

export class DurableOutbox {
  constructor({
    store,
    state = null,
    secretResolver = null,
    clock = () => new Date().toISOString(),
    idGenerator = pulsoId
  }) {
    invariant(store && store.db, "sqlite_event_store_required");
    this.store = store;
    this.db = store.db;
    this.state = state;
    this.clock = clock;
    this.idGenerator = idGenerator;
    this.secretResolver = secretResolver || new SecretRefResolver({ clock: this.clock });

    this.#initSchema();
  }

  #initSchema() {
    this.db.exec([
      "CREATE TABLE IF NOT EXISTS outbox_items (",
      " outbox_id TEXT PRIMARY KEY,",
      " idempotency_key TEXT NOT NULL UNIQUE,",
      " topic TEXT NOT NULL,",
      " status TEXT NOT NULL,",
      " payload_json TEXT NOT NULL,",
      " scope_json TEXT NOT NULL,",
      " attempt_count INTEGER NOT NULL,",
      " max_attempts INTEGER NOT NULL,",
      " backoff_policy_json TEXT NOT NULL,",
      " next_attempt_at TEXT NOT NULL,",
      " lease_json TEXT,",
      " last_error_json TEXT,",
      " receipt_json TEXT,",
      " history_json TEXT NOT NULL,",
      " created_at TEXT NOT NULL,",
      " updated_at TEXT NOT NULL",
      ");",
      "CREATE INDEX IF NOT EXISTS idx_outbox_status_next ON outbox_items(status, next_attempt_at, created_at);"
    ].join("\n"));

    this.stmtById = this.db.prepare("SELECT * FROM outbox_items WHERE outbox_id = ?");
    this.stmtByIdem = this.db.prepare("SELECT * FROM outbox_items WHERE idempotency_key = ?");
    this.stmtAll = this.db.prepare("SELECT * FROM outbox_items ORDER BY created_at ASC, rowid ASC");
    this.stmtInsert = this.db.prepare([
      "INSERT INTO outbox_items (",
      "outbox_id, idempotency_key, topic, status, payload_json, scope_json, attempt_count, max_attempts,",
      "backoff_policy_json, next_attempt_at, lease_json, last_error_json, receipt_json, history_json, created_at, updated_at",
      ") VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)"
    ].join(" "));
    this.stmtUpdate = this.db.prepare([
      "UPDATE outbox_items SET",
      "status = ?, attempt_count = ?, next_attempt_at = ?, lease_json = ?, last_error_json = ?, receipt_json = ?, history_json = ?, updated_at = ?",
      "WHERE outbox_id = ? AND status = ?"
    ].join(" "));
    this.stmtLeaseConditional = this.db.prepare([
      "UPDATE outbox_items SET",
      "status = 'leased', attempt_count = ?, next_attempt_at = ?, lease_json = ?, last_error_json = ?, receipt_json = ?, history_json = ?, updated_at = ?",
      "WHERE outbox_id = ? AND status IN ('pending', 'failed') AND next_attempt_at <= ? AND attempt_count = ?"
    ].join(" "));
  }

  #decodeRow(row) {
    if (!row) return null;
    return validateOutboxItem({
      outboxId: row.outbox_id,
      idempotencyKey: row.idempotency_key,
      topic: row.topic,
      status: row.status,
      payload: JSON.parse(row.payload_json),
      scope: JSON.parse(row.scope_json),
      attemptCount: row.attempt_count,
      maxAttempts: row.max_attempts,
      backoffPolicy: JSON.parse(row.backoff_policy_json),
      nextAttemptAt: row.next_attempt_at,
      lease: row.lease_json ? JSON.parse(row.lease_json) : null,
      lastError: row.last_error_json ? JSON.parse(row.last_error_json) : null,
      receipt: row.receipt_json ? JSON.parse(row.receipt_json) : null,
      history: JSON.parse(row.history_json),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    });
  }

  #saveItemInTx(item, expectedPreviousStatus) {
    const res = this.stmtUpdate.run(
      item.status,
      item.attemptCount,
      item.nextAttemptAt,
      item.lease ? JSON.stringify(item.lease) : null,
      item.lastError ? JSON.stringify(item.lastError) : null,
      item.receipt ? JSON.stringify(item.receipt) : null,
      JSON.stringify(item.history),
      item.updatedAt,
      item.outboxId,
      expectedPreviousStatus
    );
    invariant(res.changes === 1, `outbox_concurrent_modification:${item.outboxId}`);
  }

  #validateAndAppendInTx(drafts, options = {}) {
    assertExternalIdsConfined(drafts);
    assertNoSecrets(drafts);
    this.secretResolver.assertZeroLeakage(drafts);
    return this.store.appendInTransaction(drafts, options);
  }

  #applyCommittedEventsToProjection(events) {
    if (this.state && Array.isArray(events)) {
      for (const ev of events) {
        applyControlPlaneEvent(this.state, ev);
      }
    }
  }

  get(outboxId) {
    const row = this.stmtById.get(outboxId);
    return this.#decodeRow(row);
  }

  findByIdempotencyKey(idempotencyKey) {
    const row = this.stmtByIdem.get(idempotencyKey);
    return this.#decodeRow(row);
  }

  list(query = {}) {
    let items = this.stmtAll.all().map(r => this.#decodeRow(r));
    if (query.status) {
      items = items.filter(i => i.status === query.status);
    }
    if (query.topic) {
      items = items.filter(i => i.topic === query.topic);
    }
    if (typeof query.limit === "number") {
      items = items.slice(0, query.limit);
    }
    return items;
  }

  summary() {
    const items = this.list();
    const counts = {
      total: items.length,
      pending: 0,
      leased: 0,
      delivered: 0,
      failed: 0,
      dead_letter: 0,
      cancelled: 0
    };
    for (const item of items) {
      if (counts[item.status] !== undefined) {
        counts[item.status]++;
      }
    }
    return {
      counts,
      items,
      leases: items.filter(i => i.status === "leased"),
      retries: items.filter(i => i.status === "failed"),
      deadLetters: items.filter(i => i.status === "dead_letter"),
      receipts: items.filter(i => i.receipt !== null).map(i => i.receipt)
    };
  }

  enqueue(input, { actor = OUTBOX_ACTOR } = {}) {
    invariant(input && typeof input === "object", "outbox_enqueue_input_required");
    const idempotencyKey = input.idempotencyKey;
    invariant(typeof idempotencyKey === "string" && idempotencyKey.trim().length > 0, "idempotency_key_required");

    const payload = input.payload ?? {};
    assertNoSecrets(payload);
    assertExternalIdsConfined(payload);
    this.secretResolver.assertZeroLeakage(payload);

    const txResult = this.store.runInTransaction(() => {
      // Check existing by idempotencyKey inside the atomic transaction
      const existing = this.findByIdempotencyKey(idempotencyKey);
      if (existing) {
        return {
          duplicate: true,
          item: existing,
          events: []
        };
      }

      const now = input.createdAt ?? this.clock();
      const outboxId = input.outboxId ?? this.idGenerator("outbox");
      const topic = input.topic ?? "model.completion";
      const maxAttempts = input.maxAttempts ?? 3;
      const backoffPolicy = normalizeBackoffPolicy(input.backoffPolicy);
      const scope = input.scope ?? { type: "system", scopeId: null };

      const validated = validateOutboxItem({
        outboxId,
        idempotencyKey,
        topic,
        status: "pending",
        payload,
        scope,
        attemptCount: 0,
        maxAttempts,
        backoffPolicy,
        nextAttemptAt: input.nextAttemptAt ?? now,
        lease: null,
        lastError: null,
        receipt: null,
        history: [{ status: "pending", at: now, reason: "enqueued" }],
        createdAt: now,
        updatedAt: now
      });

      this.stmtInsert.run(
        validated.outboxId,
        validated.idempotencyKey,
        validated.topic,
        validated.status,
        JSON.stringify(validated.payload),
        JSON.stringify(validated.scope),
        validated.attemptCount,
        validated.maxAttempts,
        JSON.stringify(validated.backoffPolicy),
        validated.nextAttemptAt,
        null,
        null,
        null,
        JSON.stringify(validated.history),
        validated.createdAt,
        validated.updatedAt
      );

      const committed = this.#validateAndAppendInTx([
        eventDraft({
          type: "outbox.item_enqueued",
          aggregateType: "outbox_item",
          aggregateId: validated.outboxId,
          correlationId: validated.outboxId,
          causationId: validated.outboxId,
          actor,
          occurredAt: now,
          payload: validated
        })
      ], {
        idempotency: { scope: "outbox", key: idempotencyKey, entityId: validated.outboxId, createdAt: now }
      });

      return {
        duplicate: false,
        item: validated,
        events: committed.events
      };
    });

    if (!txResult.duplicate) {
      this.#applyCommittedEventsToProjection(txResult.events);
    }

    return txResult;
  }

  leaseItem(outboxId, {
    workerId = "runtime-worker",
    leaseDurationMs = 30000,
    now = null,
    actor = OUTBOX_ACTOR,
    beforeUpdateHook = null
  } = {}) {
    invariant(outboxId, "outbox_id_required");
    invariant(leaseDurationMs > 0, "lease_duration_must_be_positive");

    // Pre-read outside or inside transaction to support concurrent race simulation
    const initialSnapshot = this.get(outboxId);
    invariant(initialSnapshot, "outbox_item_not_found:" + outboxId);

    if (typeof beforeUpdateHook === "function") {
      beforeUpdateHook(initialSnapshot);
    }

    const txResult = this.store.runInTransaction(() => {
      const current = this.get(outboxId);
      invariant(current, "outbox_item_not_found:" + outboxId);

      if (current.status === "leased") {
        const conflictErr = new Error(
          `outbox_lease_conflict: item ${outboxId} is already leased by ${current.lease?.workerId ?? "another_worker"} (invalid_outbox_transition:leased->leased)`
        );
        conflictErr.code = "outbox_lease_conflict";
        throw conflictErr;
      }

      assertOutboxTransition(current.status, "leased");

      const timestamp = now ?? this.clock();
      invariant(current.nextAttemptAt <= timestamp, `outbox_item_backoff_not_elapsed:${outboxId}`);

      const lease = {
        leaseId: this.idGenerator("lease"),
        workerId,
        leasedAt: timestamp,
        expiresAt: addMsIso(timestamp, leaseDurationMs)
      };

      const updated = validateOutboxItem({
        ...current,
        status: "leased",
        attemptCount: current.attemptCount + 1,
        lease,
        history: [
          ...current.history,
          { status: "leased", at: timestamp, leaseId: lease.leaseId, workerId, attempt: current.attemptCount + 1 }
        ],
        updatedAt: timestamp
      });

      // Conditional atomic UPDATE using initialSnapshot.attemptCount to detect any concurrent lease acquisition
      const updateRes = this.stmtLeaseConditional.run(
        updated.attemptCount,
        updated.nextAttemptAt,
        JSON.stringify(updated.lease),
        updated.lastError ? JSON.stringify(updated.lastError) : null,
        updated.receipt ? JSON.stringify(updated.receipt) : null,
        JSON.stringify(updated.history),
        updated.updatedAt,
        updated.outboxId,
        timestamp,
        initialSnapshot.attemptCount
      );

      if (updateRes.changes !== 1) {
        const conflictErr = new Error(`outbox_lease_conflict:${outboxId}`);
        conflictErr.code = "outbox_lease_conflict";
        throw conflictErr;
      }

      const committed = this.#validateAndAppendInTx([
        eventDraft({
          type: "outbox.item_leased",
          aggregateType: "outbox_item",
          aggregateId: updated.outboxId,
          correlationId: updated.outboxId,
          causationId: updated.outboxId,
          actor,
          occurredAt: timestamp,
          payload: updated
        })
      ]);

      return {
        updated,
        events: committed.events
      };
    });

    this.#applyCommittedEventsToProjection(txResult.events);

    return Object.freeze({
      ...txResult.updated,
      item: txResult.updated,
      lease: txResult.updated.lease,
      events: txResult.events
    });
  }

  leaseNext(options = {}) {
    const {
      workerId = "runtime-worker",
      leaseDurationMs = 30000,
      limit,
      topic = null,
      now = null,
      actor = OUTBOX_ACTOR
    } = options;
    const effectiveLimit = limit !== undefined ? limit : 1;
    const timestamp = now ?? this.clock();
    const candidates = this.list().filter(item =>
      (item.status === "pending" || item.status === "failed") &&
      item.nextAttemptAt <= timestamp &&
      (!topic || item.topic === topic)
    );

    const leased = [];
    for (const candidate of candidates) {
      if (leased.length >= effectiveLimit) break;
      try {
        const res = this.leaseItem(candidate.outboxId, {
          workerId,
          leaseDurationMs,
          now: timestamp,
          actor
        });
        leased.push(res.item);
      } catch (err) {
        if (err && err.code === "outbox_lease_conflict") {
          continue;
        }
        throw err;
      }
    }

    if (limit === undefined) {
      return leased[0] ?? null;
    }
    return leased;
  }

  acknowledgeDelivery(outboxId, {
    leaseId = null,
    workerId = null,
    result = null,
    resultSummary = null,
    routingReceiptId = null,
    now = null,
    actor = OUTBOX_ACTOR
  } = {}) {
    invariant(outboxId, "outbox_id_required");

    const txResult = this.store.runInTransaction(() => {
      const current = this.get(outboxId);
      invariant(current, "outbox_item_not_found:" + outboxId);

      assertOutboxTransition(current.status, "delivered");

      if (leaseId !== null && current.lease?.leaseId !== leaseId) {
        throw new Error(`outbox_lease_mismatch: expected ${current.lease?.leaseId}, got ${leaseId}`);
      }

      const timestamp = now ?? this.clock();
      const rawSummary = resultSummary ?? result;
      const safeResultSummary = rawSummary ? this.secretResolver.redact(rawSummary) : { ok: true };

      const receipt = validateDeliveryReceipt({
        receiptId: this.idGenerator("dlv_rcpt"),
        outboxId: current.outboxId,
        idempotencyKey: current.idempotencyKey,
        topic: current.topic,
        status: "delivered",
        attemptCount: current.attemptCount,
        leaseId: current.lease?.leaseId ?? leaseId,
        workerId: current.lease?.workerId ?? workerId,
        reason: "delivery_succeeded",
        resultSummary: safeResultSummary,
        routingReceiptId: routingReceiptId ?? safeResultSummary?.routingReceipt?.receiptId ?? null,
        error: null,
        occurredAt: timestamp
      });

      const updated = validateOutboxItem({
        ...current,
        status: "delivered",
        lease: null,
        receipt,
        history: [
          ...current.history,
          { status: "delivered", at: timestamp, receiptId: receipt.receiptId }
        ],
        updatedAt: timestamp
      });

      this.#saveItemInTx(updated, current.status);

      const committed = this.#validateAndAppendInTx([
        eventDraft({
          type: "outbox.item_delivered",
          aggregateType: "outbox_item",
          aggregateId: updated.outboxId,
          correlationId: updated.outboxId,
          causationId: updated.outboxId,
          actor,
          occurredAt: timestamp,
          payload: updated
        })
      ]);

      return {
        item: updated,
        receipt,
        events: committed.events
      };
    });

    this.#applyCommittedEventsToProjection(txResult.events);
    return txResult;
  }

  deliver(outboxId, options = {}) {
    return this.acknowledgeDelivery(outboxId, options);
  }

  recordFailure(outboxId, {
    leaseId = null,
    error,
    retryable = true,
    now = null,
    actor = OUTBOX_ACTOR
  } = {}) {
    invariant(outboxId, "outbox_id_required");

    const txResult = this.store.runInTransaction(() => {
      const current = this.get(outboxId);
      invariant(current, "outbox_item_not_found:" + outboxId);

      if (OUTBOX_TERMINAL.has(current.status)) {
        throw new Error(`outbox_terminal_state_immutable:${current.status}->failed`);
      }

      if (leaseId !== null && current.lease?.leaseId !== leaseId) {
        throw new Error(`outbox_lease_mismatch: expected ${current.lease?.leaseId}, got ${leaseId}`);
      }

      const timestamp = now ?? this.clock();
      const safeErr = this.secretResolver.redactError(error);
      const canRetry = retryable !== false && current.attemptCount < current.maxAttempts;

      if (canRetry) {
        assertOutboxTransition(current.status, "failed");
        const backoffMs = computeDeterministicBackoff(current.attemptCount, current.backoffPolicy);
        const nextAttemptAt = addMsIso(timestamp, backoffMs);
        const lastError = {
          code: safeErr.code,
          message: safeErr.message,
          attempt: current.attemptCount,
          backoffMs,
          failedAt: timestamp
        };

        const updated = validateOutboxItem({
          ...current,
          status: "failed",
          lease: null,
          nextAttemptAt,
          lastError,
          history: [
            ...current.history,
            { status: "failed", at: timestamp, attempt: current.attemptCount, backoffMs, nextAttemptAt, cause: safeErr.message }
          ],
          updatedAt: timestamp
        });

        this.#saveItemInTx(updated, current.status);

        const committed = this.#validateAndAppendInTx([
          eventDraft({
            type: "outbox.item_failed",
            aggregateType: "outbox_item",
            aggregateId: updated.outboxId,
            correlationId: updated.outboxId,
            causationId: updated.outboxId,
            actor,
            occurredAt: timestamp,
            payload: updated
          })
        ]);

        return {
          item: updated,
          status: "failed",
          deadLettered: false,
          backoffMs,
          nextAttemptAt,
          receipt: null,
          events: committed.events
        };
      }

      // Move to dead_letter (terminal state)
      assertOutboxTransition(current.status, "dead_letter");
      const lastError = {
        code: safeErr.code,
        message: safeErr.message,
        attempt: current.attemptCount,
        failedAt: timestamp
      };

      const receipt = validateDeliveryReceipt({
        receiptId: this.idGenerator("dlq_rcpt"),
        outboxId: current.outboxId,
        idempotencyKey: current.idempotencyKey,
        topic: current.topic,
        status: "dead_letter",
        attemptCount: current.attemptCount,
        leaseId: current.lease?.leaseId ?? leaseId,
        workerId: current.lease?.workerId ?? null,
        reason: retryable === false ? "non_retryable_failure" : "max_attempts_exhausted",
        resultSummary: null,
        routingReceiptId: null,
        error: lastError,
        occurredAt: timestamp
      });

      const updated = validateOutboxItem({
        ...current,
        status: "dead_letter",
        lease: null,
        lastError,
        receipt,
        history: [
          ...current.history,
          { status: "dead_letter", at: timestamp, attempt: current.attemptCount, reason: receipt.reason, cause: safeErr.message }
        ],
        updatedAt: timestamp
      });

      this.#saveItemInTx(updated, current.status);

      const committed = this.#validateAndAppendInTx([
        eventDraft({
          type: "outbox.item_dead_lettered",
          aggregateType: "outbox_item",
          aggregateId: updated.outboxId,
          correlationId: updated.outboxId,
          causationId: updated.outboxId,
          actor,
          occurredAt: timestamp,
          payload: updated
        })
      ]);

      return {
        item: updated,
        status: "dead_letter",
        deadLettered: true,
        backoffMs: null,
        nextAttemptAt: updated.nextAttemptAt,
        receipt,
        events: committed.events
      };
    });

    this.#applyCommittedEventsToProjection(txResult.events);
    return txResult;
  }

  fail(outboxId, options = {}) {
    return this.recordFailure(outboxId, options);
  }

  recoverExpiredLeases({ now = null, actor = OUTBOX_ACTOR } = {}) {
    const timestamp = now ?? this.clock();

    const txResult = this.store.runInTransaction(() => {
      const expiredItems = this.list({ status: "leased" }).filter(
        item => item.lease && item.lease.expiresAt <= timestamp
      );

      const recovered = [];
      const allEvents = [];
      for (const current of expiredItems) {
        assertOutboxTransition(current.status, "pending");
        const expiredLeaseId = current.lease.leaseId;

        const updated = validateOutboxItem({
          ...current,
          status: "pending",
          lease: null,
          nextAttemptAt: timestamp,
          history: [
            ...current.history,
            { status: "pending", at: timestamp, reason: "lease_expired_recovered", expiredLeaseId }
          ],
          updatedAt: timestamp
        });

        this.#saveItemInTx(updated, "leased");

        const committed = this.#validateAndAppendInTx([
          eventDraft({
            type: "outbox.lease_recovered",
            aggregateType: "outbox_item",
            aggregateId: updated.outboxId,
            correlationId: updated.outboxId,
            causationId: updated.outboxId,
            actor,
            occurredAt: timestamp,
            payload: updated
          })
        ]);

        recovered.push(updated);
        allEvents.push(...committed.events);
      }

      return { recovered, allEvents };
    });

    this.#applyCommittedEventsToProjection(txResult.allEvents);

    return Object.assign(txResult.recovered, {
      recoveredCount: txResult.recovered.length,
      recoveredIds: txResult.recovered.map(i => i.outboxId),
      items: txResult.recovered
    });
  }

  verifyIntegrity() {
    const sum = this.summary();
    return {
      ok: true,
      total: sum.counts.total,
      counts: sum.counts
    };
  }

  retryItem(outboxId, { reason = "operator_retry", now = null, actor = OUTBOX_ACTOR } = {}) {
    invariant(outboxId, "outbox_id_required");

    const txResult = this.store.runInTransaction(() => {
      const current = this.get(outboxId);
      invariant(current, "outbox_item_not_found:" + outboxId);

      assertOutboxTransition(current.status, "pending");

      const timestamp = now ?? this.clock();
      const updated = validateOutboxItem({
        ...current,
        status: "pending",
        lease: null,
        nextAttemptAt: timestamp,
        history: [
          ...current.history,
          { status: "pending", at: timestamp, reason }
        ],
        updatedAt: timestamp
      });

      this.#saveItemInTx(updated, current.status);

      const committed = this.#validateAndAppendInTx([
        eventDraft({
          type: "outbox.item_retried",
          aggregateType: "outbox_item",
          aggregateId: updated.outboxId,
          correlationId: updated.outboxId,
          causationId: updated.outboxId,
          actor,
          occurredAt: timestamp,
          payload: updated
        })
      ]);

      return {
        item: updated,
        receipt: {
          receiptId: this.idGenerator("rty_rcpt"),
          outboxId: updated.outboxId,
          status: "pending",
          reason,
          occurredAt: timestamp
        },
        events: committed.events
      };
    });

    this.#applyCommittedEventsToProjection(txResult.events);
    return txResult;
  }

  cancelItem(outboxId, { reason = "operator_cancelled", now = null, actor = OUTBOX_ACTOR } = {}) {
    invariant(outboxId, "outbox_id_required");

    const txResult = this.store.runInTransaction(() => {
      const current = this.get(outboxId);
      invariant(current, "outbox_item_not_found:" + outboxId);

      assertOutboxTransition(current.status, "cancelled");

      const timestamp = now ?? this.clock();
      const receipt = validateDeliveryReceipt({
        receiptId: this.idGenerator("can_rcpt"),
        outboxId: current.outboxId,
        idempotencyKey: current.idempotencyKey,
        topic: current.topic,
        status: "cancelled",
        attemptCount: current.attemptCount,
        leaseId: current.lease?.leaseId ?? null,
        workerId: current.lease?.workerId ?? null,
        reason,
        resultSummary: null,
        routingReceiptId: null,
        error: null,
        occurredAt: timestamp
      });

      const updated = validateOutboxItem({
        ...current,
        status: "cancelled",
        lease: null,
        receipt,
        history: [
          ...current.history,
          { status: "cancelled", at: timestamp, reason, receiptId: receipt.receiptId }
        ],
        updatedAt: timestamp
      });

      this.#saveItemInTx(updated, current.status);

      const committed = this.#validateAndAppendInTx([
        eventDraft({
          type: "outbox.item_cancelled",
          aggregateType: "outbox_item",
          aggregateId: updated.outboxId,
          correlationId: updated.outboxId,
          causationId: updated.outboxId,
          actor,
          occurredAt: timestamp,
          payload: updated
        })
      ]);

      return {
        item: updated,
        receipt,
        events: committed.events
      };
    });

    this.#applyCommittedEventsToProjection(txResult.events);
    return txResult;
  }
}
