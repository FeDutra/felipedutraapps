import {
  ExecutorProvider,
  validateProviderBinding,
  invariant,
  pulsoId
} from "../domain/contracts.mjs";
import { OPENCLAW_FIXTURES } from "./openclaw-fixtures.mjs";
import {
  normalizeProviderEvent,
  deduplicateAndSortEvents
} from "../shadow/normalizer.mjs";

/**
 * Default offline mock transport for OpenClaw.
 * Fully deterministic, isolated, with zero network or production dependencies.
 */
export class OfflineOpenClawTransport {
  constructor(options = {}) {
    this.fixtures = options.fixtures ?? OPENCLAW_FIXTURES.happyPath;
    this.isOffline = options.isOffline ?? false;
    this.failOnSubmit = options.failOnSubmit ?? false;
    this.failOnCollect = options.failOnCollect ?? false;
  }

  async send(action, payload) {
    if (this.isOffline) {
      throw new Error("transport_unavailable: OpenClaw transport is offline");
    }
    if (this.failOnSubmit && action === "submit") {
      throw new Error("transport_unavailable: connection refused to OpenClaw daemon");
    }
    return { ok: true, action, payload };
  }

  async *stream(binding) {
    if (this.isOffline) {
      throw new Error("transport_unavailable: OpenClaw stream unreachable");
    }
    for (const frame of this.fixtures) {
      yield frame;
    }
  }

  async cancel(binding, reason) {
    if (this.isOffline) {
      throw new Error("transport_unavailable: unable to send cancel frame");
    }
    return { accepted: true, reason };
  }

  async isHealthy() {
    return !this.isOffline;
  }
}

/**
 * OpenClaw Shadow Adapter
 * 
 * Runs in shadow mode alongside Pulso sovereign core.
 * Guarantees:
 * 1. Zero external ID leakage into domain entities (strictly confined to providerBinding).
 * 2. Deterministic normalization, deduplication, and ordering of streaming events.
 * 3. Preservation of sovereign identity ("lotus"), session, memory, and local-first policies.
 * 4. Transparent handling of transport unavailability, malformation, duplicate frames, out-of-order delivery, terminal failure, and cancellation.
 */
export class OpenClawShadowAdapter extends ExecutorProvider {
  constructor(options = {}) {
    super(options.id ?? "openclaw-shadow");
    this.transport = options.transport ?? new OfflineOpenClawTransport({
      fixtures: options.fixtures
    });
    this.agentId = options.agentId ?? "openclaw-worker-v1";
    this.connectionId = options.connectionId ?? "shadow-transport-offline";
    this.runs = new Map();
  }

  async capabilities() {
    return {
      providerId: this.id,
      observe: true,
      steer: true,
      cancel: true,
      collect: true,
      shadow: true,
      offline: true,
      local: true
    };
  }

  async submit(request) {
    invariant(request?.runId, "request_run_id_required");
    invariant(request?.turnId, "request_turn_id_required");

    // Transport check
    await this.transport.send("submit", { request });

    // Generate external identifiers - strictly confined to providerBinding
    const externalRunId = "claw_run_" + pulsoId("ext").replace("evt_", "").slice(0, 16);
    const externalSessionId = "claw_sess_" + pulsoId("ext").slice(0, 12);

    const providerBinding = validateProviderBinding({
      providerType: "executor",
      providerId: this.id,
      connectionId: this.connectionId,
      externalRunId,
      externalSessionId,
      boundAt: new Date().toISOString(),
      metadata: {
        openclawAgentId: this.agentId,
        mode: "shadow_offline",
        policyVerified: true,
        identitySovereign: "lotus"
      }
    });

    this.runs.set(externalRunId, {
      pulsoRunId: request.runId,
      turnId: request.turnId,
      sessionId: request.sessionId,
      binding: providerBinding,
      cancelled: false,
      steering: [],
      rawFrames: [],
      normalizedEvents: [],
      anomalies: [],
      hasTerminalFailure: false
    });

    return providerBinding;
  }

  async *observe(binding) {
    invariant(binding?.externalRunId, "external_run_id_required");
    const run = this.runs.get(binding.externalRunId);
    invariant(run, "provider_run_not_found:" + binding.externalRunId);

    if (run.cancelled) return;

    // Collect frames from transport
    const rawFrames = [];
    try {
      for await (const frame of this.transport.stream(binding)) {
        if (run.cancelled) break;
        rawFrames.push(frame);
      }
    } catch (err) {
      run.anomalies.push({ type: "transport_unavailable", error: err.message });
      throw err;
    }

    run.rawFrames = rawFrames;

    // Deterministic deduplication and sorting
    const processed = deduplicateAndSortEvents(rawFrames, {
      context: { turnId: run.turnId, runId: run.pulsoRunId }
    });

    run.anomalies.push(...processed.anomalies);
    run.normalizedEvents = processed.events;

    for (const event of processed.events) {
      if (run.cancelled) break;

      if (event.phase === "failed") {
        run.hasTerminalFailure = true;
        yield {
          type: "progress",
          phase: "failed",
          message: event.message,
          percent: event.percent,
          metadata: event.metadata
        };
        return;
      }

      yield {
        type: "progress",
        phase: event.phase,
        message: event.message,
        percent: event.percent,
        metadata: event.metadata
      };
    }
  }

  async steer(binding, instruction) {
    invariant(binding?.externalRunId, "external_run_id_required");
    const run = this.runs.get(binding.externalRunId);
    invariant(run, "provider_run_not_found:" + binding.externalRunId);
    if (run.cancelled) {
      throw new Error("provider_run_cancelled");
    }

    run.steering.push({
      instruction,
      steeredAt: new Date().toISOString()
    });

    await this.transport.send("steer", { binding, instruction });
    return { accepted: true, steeredCount: run.steering.length };
  }

  async cancel(binding, reason = "user_requested") {
    invariant(binding?.externalRunId, "external_run_id_required");
    const run = this.runs.get(binding.externalRunId);
    if (!run) return { accepted: false, reason: "provider_run_not_found" };

    run.cancelled = true;
    await this.transport.cancel(binding, reason);
    return { accepted: true, reason };
  }

  async collect(binding) {
    invariant(binding?.externalRunId, "external_run_id_required");
    const run = this.runs.get(binding.externalRunId);
    invariant(run, "provider_run_not_found:" + binding.externalRunId);

    if (run.cancelled) {
      throw new Error("provider_run_cancelled");
    }
    if (run.hasTerminalFailure) {
      throw new Error("provider_run_failed_terminally");
    }

    if (this.transport.failOnCollect) {
      throw new Error("transport_unavailable: failed to collect shadow artifacts");
    }

    // Build sovereign artifacts without exposing external IDs
    const artifacts = [
      {
        kind: "shadow_execution_artifact",
        title: "Relatório de Execução Sombra OpenClaw",
        mediaType: "text/markdown",
        content: `# Execução Sombra OpenClaw\n\nExecução concluída com sucesso em modo sombra offline.`
      }
    ];

    return {
      text: "Execução sombra OpenClaw concluída com conformidade.",
      artifacts,
      shadowTrace: {
        totalFrames: run.rawFrames.length,
        normalizedCount: run.normalizedEvents.length,
        anomaliesCount: run.anomalies.length,
        cancelled: run.cancelled
      }
    };
  }

  async health() {
    const isHealthy = await this.transport.isHealthy();
    return {
      status: isHealthy ? "healthy" : "unavailable",
      providerId: this.id,
      mode: "shadow_offline"
    };
  }

  getRunTrace(externalRunId) {
    return this.runs.get(externalRunId) ?? null;
  }
}
