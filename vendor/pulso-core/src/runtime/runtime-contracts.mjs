import { invariant } from "../domain/assertions.mjs";
import { assertNoSecrets } from "../control-plane/secrets.mjs";
import { assertExternalIdsConfined } from "../domain/provider-contracts.mjs";
import { deepClone, deepFreeze, deepCloneAndFreeze } from "../agents/agent-contracts.mjs";

export { deepClone, deepFreeze, deepCloneAndFreeze };

export const SECRET_REF_SCHEMES = Object.freeze(["env", "memory", "keychain"]);

export const ADAPTER_KINDS = Object.freeze([
  "openai",
  "anthropic",
  "local_openai_compatible",
  "fake"
]);

export const ROUTING_SCOPE_PRECEDENCE = Object.freeze([
  "task",
  "session",
  "agent",
  "system"
]);

export const OUTBOX_STATUSES = Object.freeze([
  "pending",
  "leased",
  "delivered",
  "failed",
  "dead_letter",
  "cancelled"
]);

export const OUTBOX_TERMINAL = Object.freeze(new Set([
  "delivered",
  "dead_letter",
  "cancelled"
]));

export const OUTBOX_TRANSITIONS = Object.freeze({
  pending: new Set(["leased", "cancelled"]),
  leased: new Set(["delivered", "failed", "dead_letter", "pending", "cancelled"]),
  failed: new Set(["pending", "leased", "dead_letter", "cancelled"]),
  delivered: new Set(),
  dead_letter: new Set(),
  cancelled: new Set()
});

export const RUNTIME_SERVICE_STATUSES = Object.freeze([
  "stopped",
  "starting",
  "running",
  "stopping",
  "degraded"
]);

export const RUNTIME_SERVICE_TRANSITIONS = Object.freeze({
  stopped: new Set(["starting", "running"]),
  starting: new Set(["running", "degraded", "stopped"]),
  running: new Set(["stopping", "stopped", "degraded"]),
  degraded: new Set(["running", "stopping", "stopped"]),
  stopping: new Set(["stopped"])
});

export function assertOutboxTransition(from, to) {
  invariant(OUTBOX_TRANSITIONS[from], "unknown_outbox_status:" + from);
  if (OUTBOX_TERMINAL.has(from)) {
    throw new Error(`outbox_terminal_state_immutable:${from}->${to}`);
  }
  invariant(
    OUTBOX_TRANSITIONS[from].has(to),
    `invalid_outbox_transition:${from}->${to}`
  );
}

export function assertRuntimeServiceTransition(from, to) {
  invariant(RUNTIME_SERVICE_TRANSITIONS[from], "unknown_runtime_service_status:" + from);
  invariant(
    RUNTIME_SERVICE_TRANSITIONS[from].has(to),
    `invalid_runtime_service_transition:${from}->${to}`
  );
}

export function normalizeBackoffPolicy(policy = {}) {
  const baseDelayMs = policy.baseDelayMs !== undefined ? Number(policy.baseDelayMs) : 1000;
  const maxDelayMs = policy.maxDelayMs !== undefined ? Number(policy.maxDelayMs) : 60000;
  const multiplier = policy.multiplier !== undefined ? Number(policy.multiplier) : 2;
  invariant(Number.isFinite(baseDelayMs) && baseDelayMs >= 0, "invalid_backoff_base_delay");
  invariant(Number.isFinite(maxDelayMs) && maxDelayMs >= baseDelayMs, "invalid_backoff_max_delay");
  invariant(Number.isFinite(multiplier) && multiplier >= 1, "invalid_backoff_multiplier");
  return Object.freeze({
    baseDelayMs,
    maxDelayMs,
    multiplier
  });
}

export function computeDeterministicBackoff(attemptNumber, policy = {}) {
  invariant(Number.isInteger(attemptNumber) && attemptNumber >= 1, "attempt_number_must_be_positive_integer");
  const normalized = normalizeBackoffPolicy(policy);
  const raw = normalized.baseDelayMs * Math.pow(normalized.multiplier, attemptNumber - 1);
  return Math.min(normalized.maxDelayMs, Math.round(raw));
}

export function parseSecretRef(secretRef) {
  invariant(typeof secretRef === "string" && secretRef.trim().length > 0, "secret_ref_required");
  const trimmed = secretRef.trim();
  const colonIdx = trimmed.indexOf(":");
  invariant(colonIdx > 0, "invalid_secret_ref_format:" + trimmed);

  const scheme = trimmed.slice(0, colonIdx).toLowerCase();
  const keyId = trimmed.slice(colonIdx + 1).trim();

  invariant(SECRET_REF_SCHEMES.includes(scheme), "unsupported_secret_ref_scheme:" + scheme);
  invariant(keyId.length > 0, "secret_ref_key_id_required");
  invariant(!/\s/.test(keyId), "invalid_secret_ref_key_id");

  return Object.freeze({
    secretRef: `${scheme}:${keyId}`,
    scheme,
    keyId,
    redactedPreview: `[REDACTED:${scheme}:${keyId}]`
  });
}

export function validateSecretRefDescriptor(descriptor) {
  invariant(descriptor && typeof descriptor === "object", "secret_ref_descriptor_required");
  if (descriptor.secretRef === null || descriptor.scheme === "none") {
    const canonicalNone = {
      secretRef: null,
      scheme: "none",
      keyId: null,
      configured: false,
      redactedPreview: "[NO_SECRET_REF]",
      checkedAt: descriptor.checkedAt ?? null
    };
    return deepCloneAndFreeze(canonicalNone);
  }

  const parsed = parseSecretRef(descriptor.secretRef);
  invariant(typeof descriptor.configured === "boolean", "secret_ref_configured_boolean_required");
  const canonical = {
    secretRef: parsed.secretRef,
    scheme: parsed.scheme,
    keyId: parsed.keyId,
    configured: descriptor.configured,
    redactedPreview: parsed.redactedPreview,
    checkedAt: descriptor.checkedAt ?? null
  };
  assertNoSecrets(canonical);
  return deepCloneAndFreeze(canonical);
}

export function validateRoutingReceipt(receipt) {
  invariant(receipt && typeof receipt === "object", "routing_receipt_required");
  invariant(typeof receipt.receiptId === "string" && receipt.receiptId.length > 0, "receipt_id_required");
  invariant(["succeeded", "failed"].includes(receipt.status), "invalid_routing_receipt_status:" + receipt.status);
  invariant(typeof receipt.resolvedScope === "string" && receipt.resolvedScope.length > 0, "resolved_scope_required");
  invariant(Array.isArray(receipt.evaluatedScopes), "evaluated_scopes_array_required");
  invariant(receipt.primary && typeof receipt.primary === "object", "primary_selection_required");
  invariant(typeof receipt.primary.providerId === "string" && receipt.primary.providerId.length > 0, "primary_provider_id_required");
  invariant(typeof receipt.primary.model === "string" && receipt.primary.model.length > 0, "primary_model_required");

  if (receipt.status === "succeeded") {
    invariant(receipt.effective && typeof receipt.effective === "object", "effective_provider_required_on_success");
    invariant(typeof receipt.effective.providerId === "string" && receipt.effective.providerId.length > 0, "effective_provider_id_required");
    invariant(typeof receipt.effective.model === "string" && receipt.effective.model.length > 0, "effective_model_required");
  }

  invariant(typeof receipt.fallbackActivated === "boolean", "fallback_activated_boolean_required");
  invariant(Array.isArray(receipt.attempts) && receipt.attempts.length > 0, "routing_attempts_required");
  invariant(typeof receipt.occurredAt === "string" && receipt.occurredAt.length > 0, "occurred_at_required");

  const attempts = receipt.attempts.map((att, idx) => {
    invariant(att && typeof att === "object", `attempt_${idx}_invalid`);
    invariant(typeof att.providerId === "string" && att.providerId.length > 0, `attempt_${idx}_provider_required`);
    invariant(typeof att.model === "string" && att.model.length > 0, `attempt_${idx}_model_required`);
    invariant(["primary", "fallback"].includes(att.role), `attempt_${idx}_invalid_role`);
    invariant(["succeeded", "failed", "skipped"].includes(att.status), `attempt_${idx}_invalid_status`);
    return {
      attemptIndex: typeof att.attemptIndex === "number" ? att.attemptIndex : idx,
      providerId: att.providerId,
      model: att.model,
      role: att.role,
      fallbackIndex: att.fallbackIndex ?? null,
      status: att.status,
      cause: att.cause ?? null,
      errorCode: att.errorCode ?? null,
      latencyMs: typeof att.latencyMs === "number" ? att.latencyMs : 0,
      timestamp: att.timestamp ?? receipt.occurredAt
    };
  });

  const canonical = {
    receiptId: receipt.receiptId,
    status: receipt.status,
    resolvedScope: receipt.resolvedScope,
    evaluatedScopes: [...receipt.evaluatedScopes],
    primary: {
      providerId: receipt.primary.providerId,
      model: receipt.primary.model
    },
    effective: receipt.effective
      ? {
          providerId: receipt.effective.providerId,
          model: receipt.effective.model,
          isFallback: Boolean(receipt.effective.isFallback),
          fallbackIndex: receipt.effective.fallbackIndex ?? null
        }
      : null,
    fallbackActivated: receipt.fallbackActivated,
    cause: receipt.cause ?? null,
    origin: {
      turnId: receipt.origin?.turnId ?? null,
      sessionId: receipt.origin?.sessionId ?? null,
      agentId: receipt.origin?.agentId ?? null,
      taskId: receipt.origin?.taskId ?? null
    },
    attempts,
    occurredAt: receipt.occurredAt
  };

  assertNoSecrets(canonical);
  assertExternalIdsConfined(canonical);
  return deepCloneAndFreeze(canonical);
}

export function validateDeliveryReceipt(receipt) {
  invariant(receipt && typeof receipt === "object", "delivery_receipt_required");
  invariant(typeof receipt.receiptId === "string" && receipt.receiptId.length > 0, "receipt_id_required");
  invariant(typeof receipt.outboxId === "string" && receipt.outboxId.length > 0, "outbox_id_required");
  invariant(typeof receipt.idempotencyKey === "string" && receipt.idempotencyKey.length > 0, "idempotency_key_required");
  invariant(typeof receipt.topic === "string" && receipt.topic.length > 0, "topic_required");
  invariant(["delivered", "dead_letter", "cancelled"].includes(receipt.status), "invalid_delivery_receipt_status:" + receipt.status);
  invariant(Number.isInteger(receipt.attemptCount) && receipt.attemptCount >= 0, "attempt_count_required");
  invariant(typeof receipt.occurredAt === "string" && receipt.occurredAt.length > 0, "occurred_at_required");

  const canonical = {
    receiptId: receipt.receiptId,
    outboxId: receipt.outboxId,
    idempotencyKey: receipt.idempotencyKey,
    topic: receipt.topic,
    status: receipt.status,
    attemptCount: receipt.attemptCount,
    leaseId: receipt.leaseId ?? null,
    workerId: receipt.workerId ?? null,
    reason: receipt.reason ?? null,
    resultSummary: receipt.resultSummary ?? null,
    routingReceiptId: receipt.routingReceiptId ?? null,
    error: receipt.error ?? null,
    occurredAt: receipt.occurredAt
  };

  assertNoSecrets(canonical);
  assertExternalIdsConfined(canonical);
  return deepCloneAndFreeze(canonical);
}

export function validateOutboxItem(item) {
  invariant(item && typeof item === "object", "outbox_item_required");
  invariant(typeof item.outboxId === "string" && item.outboxId.length > 0, "outbox_id_required");
  invariant(typeof item.idempotencyKey === "string" && item.idempotencyKey.length > 0, "idempotency_key_required");
  invariant(typeof item.topic === "string" && item.topic.length > 0, "topic_required");
  invariant(OUTBOX_STATUSES.includes(item.status), "invalid_outbox_status:" + item.status);
  invariant(item.payload && typeof item.payload === "object", "payload_object_required");
  invariant(Number.isInteger(item.attemptCount) && item.attemptCount >= 0, "invalid_attempt_count");
  invariant(Number.isInteger(item.maxAttempts) && item.maxAttempts >= 1, "invalid_max_attempts");
  invariant(typeof item.nextAttemptAt === "string" && item.nextAttemptAt.length > 0, "next_attempt_at_required");
  invariant(typeof item.createdAt === "string" && item.createdAt.length > 0, "created_at_required");
  invariant(typeof item.updatedAt === "string" && item.updatedAt.length > 0, "updated_at_required");

  const backoffPolicy = normalizeBackoffPolicy(item.backoffPolicy);

  const canonical = {
    outboxId: item.outboxId,
    idempotencyKey: item.idempotencyKey,
    topic: item.topic,
    status: item.status,
    payload: deepClone(item.payload),
    scope: item.scope ? deepClone(item.scope) : { type: "system", scopeId: null },
    attemptCount: item.attemptCount,
    maxAttempts: item.maxAttempts,
    backoffPolicy,
    nextAttemptAt: item.nextAttemptAt,
    lease: item.lease
      ? {
          leaseId: item.lease.leaseId,
          workerId: item.lease.workerId,
          leasedAt: item.lease.leasedAt,
          expiresAt: item.lease.expiresAt
        }
      : null,
    lastError: item.lastError ?? null,
    receipt: item.receipt ?? null,
    history: Array.isArray(item.history) ? deepClone(item.history) : [],
    createdAt: item.createdAt,
    updatedAt: item.updatedAt
  };

  assertNoSecrets(canonical);
  assertExternalIdsConfined(canonical);
  return deepCloneAndFreeze(canonical);
}

export function validateRuntimeServiceStatus(statusObj) {
  invariant(statusObj && typeof statusObj === "object", "runtime_service_status_required");
  invariant(typeof statusObj.serviceId === "string" && statusObj.serviceId.length > 0, "service_id_required");
  invariant(RUNTIME_SERVICE_STATUSES.includes(statusObj.status), "invalid_runtime_service_status:" + statusObj.status);
  invariant(typeof statusObj.checkedAt === "string" && statusObj.checkedAt.length > 0, "checked_at_required");

  const canonical = {
    serviceId: statusObj.serviceId,
    status: statusObj.status,
    startedAt: statusObj.startedAt ?? null,
    stoppedAt: statusObj.stoppedAt ?? null,
    checkedAt: statusObj.checkedAt,
    recoveryCount: statusObj.recoveryCount ?? 0,
    recoveredLeasesCount: statusObj.recoveredLeasesCount ?? 0,
    storeIntegrity: statusObj.storeIntegrity ?? { ok: true, events: 0, aggregates: 0 },
    outboxSummary: statusObj.outboxSummary ?? {
      total: 0,
      pending: 0,
      leased: 0,
      delivered: 0,
      failed: 0,
      dead_letter: 0,
      cancelled: 0
    },
    providersSummary: statusObj.providersSummary ?? {
      total: 0,
      healthy: 0,
      degraded: 0,
      unhealthy: 0
    }
  };

  assertNoSecrets(canonical);
  return deepCloneAndFreeze(canonical);
}
