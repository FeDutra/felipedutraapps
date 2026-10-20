import { createHash } from "node:crypto";
import { invariant } from "../domain/contracts.mjs";

export const STABLE_FALLBACK_TIMESTAMP = "1970-01-01T00:00:00.000Z";

/**
 * Computes a deterministic hash for deduplicating frames and events.
 */
export function computeEventFingerprint(raw) {
  const normalizedKey = [
    raw.id ?? raw.eventId ?? "",
    raw.type ?? "",
    raw.phase ?? "",
    raw.message ?? raw.text ?? "",
    raw.sequence ?? raw.seq ?? "",
    raw.percent ?? ""
  ].join("|");
  return createHash("sha256").update(normalizedKey).digest("hex");
}

/**
 * Normalizes an external/raw event frame into a canonical Pulso progress/event shape,
 * strictly confining any external provider identifiers into `metadata.external`.
 */
export function normalizeProviderEvent(raw, context = {}) {
  invariant(raw && typeof raw === "object", "malformed_event: must be an object");

  // Validate minimal acceptable structure
  if (!raw.type && !raw.phase && !raw.message && !raw.text && !raw.error) {
    throw new Error("malformed_event: missing recognizable event payload or type");
  }

  const rawType = String(raw.type || "progress").toLowerCase();
  let phase = "execution";
  if (raw.phase) {
    phase = String(raw.phase).toLowerCase();
  } else if (rawType.includes("plan") || raw.stage === "planning") {
    phase = "planning";
  } else if (rawType.includes("exec") || rawType.includes("tool") || raw.stage === "execution") {
    phase = "execution";
  } else if (rawType.includes("valid") || raw.stage === "validation") {
    phase = "validation";
  } else if (rawType.includes("done") || rawType.includes("complete") || raw.stage === "completion") {
    phase = "completion";
  } else if (rawType.includes("fail") || rawType.includes("err") || raw.error) {
    phase = "failed";
  } else if (rawType.includes("cancel")) {
    phase = "cancelled";
  }

  const message = String(raw.message ?? raw.text ?? raw.statusText ?? raw.error?.message ?? "");

  let percent = null;
  if (typeof raw.percent === "number" && !Number.isNaN(raw.percent)) {
    percent = Math.max(0, Math.min(100, raw.percent));
  } else if (typeof raw.progress === "number" && !Number.isNaN(raw.progress)) {
    percent = Math.max(0, Math.min(100, raw.progress * 100));
  }

  let sequence = null;
  if (typeof raw.sequence === "number") {
    sequence = raw.sequence;
  } else if (typeof raw.seq === "number") {
    sequence = raw.seq;
  }

  // Extract external IDs to ensure confinement in metadata.external
  const external = {};
  if (raw.externalRunId || raw.clawRunId || raw.run_id) {
    external.externalRunId = raw.externalRunId || raw.clawRunId || raw.run_id;
  }
  if (raw.externalSessionId || raw.clawSessionId || raw.session_uuid) {
    external.externalSessionId = raw.externalSessionId || raw.clawSessionId || raw.session_uuid;
  }
  if (raw.agentId || raw.workerId) {
    external.agentId = raw.agentId || raw.workerId;
  }

  const fingerprint = computeEventFingerprint(raw);
  const timestamp = raw.timestamp || raw.occurredAt || context?.fallbackTimestamp || STABLE_FALLBACK_TIMESTAMP;

  return {
    type: phase === "failed" ? "failure" : (phase === "cancelled" ? "cancellation" : "progress"),
    phase,
    message,
    percent,
    sequence,
    timestamp,
    fingerprint,
    metadata: {
      rawType,
      external,
      originalSequence: sequence,
      contextTurnId: context.turnId ?? null,
      contextRunId: context.runId ?? null
    }
  };
}

/**
 * Deduplicates and deterministically sorts a stream or array of provider events.
 * 
 * Rules:
 * 1. Deduplication: exact fingerprint match or sequence match is deduplicated.
 * 2. Deterministic ordering:
 *    - primary: numeric sequence if both present
 *    - secondary: ISO timestamp
 *    - tertiary: fingerprint (lexicographical)
 */
export function deduplicateAndSortEvents(events, options = {}) {
  const seenFingerprints = new Set();
  const seenSequences = new Set();
  const normalized = [];
  const anomalies = [];
  let duplicatesCount = 0;
  let reorderedCount = 0;

  for (let i = 0; i < events.length; i++) {
    const raw = events[i];
    try {
      const event = normalizeProviderEvent(raw, options.context);
      
      // Check deduplication
      if (seenFingerprints.has(event.fingerprint)) {
        duplicatesCount++;
        anomalies.push({ type: "duplicate", reason: "duplicate_fingerprint", fingerprint: event.fingerprint });
        continue;
      }
      if (event.sequence !== null && seenSequences.has(event.sequence)) {
        duplicatesCount++;
        anomalies.push({ type: "duplicate", reason: "duplicate_sequence", sequence: event.sequence });
        continue;
      }

      seenFingerprints.add(event.fingerprint);
      if (event.sequence !== null) seenSequences.add(event.sequence);
      normalized.push({ event, originalIndex: i });
    } catch (err) {
      anomalies.push({ type: "malformation", index: i, error: err.message, raw });
      if (options.strict) throw err;
    }
  }

  // Deterministic sorting
  const sorted = [...normalized].sort((a, b) => {
    const evA = a.event;
    const evB = b.event;

    // 1. If both have sequence, sort by sequence
    if (evA.sequence !== null && evB.sequence !== null) {
      if (evA.sequence !== evB.sequence) return evA.sequence - evB.sequence;
    }

    // 2. Sort by timestamp
    const tA = new Date(evA.timestamp).getTime();
    const tB = new Date(evB.timestamp).getTime();
    if (!Number.isNaN(tA) && !Number.isNaN(tB) && tA !== tB) {
      return tA - tB;
    }

    // 3. Tie-breaker by fingerprint
    return evA.fingerprint.localeCompare(evB.fingerprint);
  });

  // Count reordered elements
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].originalIndex !== i) {
      reorderedCount++;
    }
  }

  return {
    events: sorted.map(item => item.event),
    stats: {
      totalReceived: events.length,
      acceptedCount: sorted.length,
      duplicatesCount,
      reorderedCount,
      anomaliesCount: anomalies.length
    },
    anomalies
  };
}
