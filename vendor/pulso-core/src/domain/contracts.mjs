import { randomBytes } from "node:crypto";
import { invariant } from "./assertions.mjs";

export { invariant };
export const TURN_TERMINAL = new Set(["completed", "failed", "cancelled"]);
export const RUN_TERMINAL = new Set(["succeeded", "failed", "cancelled", "timed_out"]);
export const DEFAULT_SOVEREIGN_IDENTITY = "lotus";

export * from "./provider-contracts.mjs";

export const RUN_TRANSITIONS = Object.freeze({
  queued: new Set(["running", "cancelled", "timed_out"]),
  running: new Set(["waiting_input", "waiting_approval", "paused", "succeeded", "failed", "cancelled", "timed_out"]),
  waiting_input: new Set(["queued", "cancelled", "timed_out"]),
  waiting_approval: new Set(["queued", "cancelled", "timed_out"]),
  paused: new Set(["queued", "cancelled"]),
  succeeded: new Set(),
  failed: new Set(),
  cancelled: new Set(),
  timed_out: new Set()
});

export function now() {
  return new Date().toISOString();
}

export function pulsoId(prefix) {
  const time = Date.now().toString(36).padStart(10, "0");
  const entropy = randomBytes(10).toString("hex");
  return prefix + "_" + time + "_" + entropy;
}

export function assertRunTransition(from, to) {
  invariant(RUN_TRANSITIONS[from], "unknown_run_status:" + from);
  invariant(RUN_TRANSITIONS[from].has(to), "invalid_run_transition:" + from + "->" + to);
}

export function eventDraft({ type, aggregateType, aggregateId, correlationId, causationId = null, actor, payload = {}, occurredAt = null }) {
  invariant(type && type.includes("."), "event_type");
  invariant(aggregateType, "aggregate_type");
  invariant(aggregateId, "aggregate_id");
  invariant(correlationId, "correlation_id");
  const timestamp = occurredAt ?? now();
  return {
    eventId: pulsoId("evt"),
    type,
    aggregate: { type: aggregateType, id: aggregateId },
    correlationId,
    causationId,
    actor,
    occurredAt: timestamp,
    recordedAt: timestamp,
    payload
  };
}
