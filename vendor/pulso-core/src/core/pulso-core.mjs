import { applyEvent, emptyProjection, project } from "./projector.mjs";
import {
  eventDraft,
  invariant,
  pulsoId,
  validateProviderBinding,
  assertExternalIdsConfined
} from "../domain/contracts.mjs";

const CORE_ACTOR = Object.freeze({ kind: "core", id: "pulso-core" });

export class PulsoCore {
  constructor({ store, modelProviders = [], executorProviders = [] }) {
    this.store = store;
    this.models = new Map(modelProviders.map(provider => [provider.id, provider]));
    this.executors = new Map(executorProviders.map(provider => [provider.id, provider]));
    this.state = emptyProjection();
    this.restore();
  }

  restore() {
    this.state = project(this.store.all());
    return this.state;
  }

  commit(drafts, options = {}) {
    assertExternalIdsConfined(drafts);
    const result = this.store.append(drafts, options);
    for (const event of result.events) applyEvent(this.state, event);
    return result;
  }

  ensureSession({ sessionId, spaceId = null, identityId = "lotus" }) {
    if (this.state.sessions.has(sessionId)) return this.state.sessions.get(sessionId);
    const created = eventDraft({
      type: "session.created",
      aggregateType: "session",
      aggregateId: sessionId,
      correlationId: sessionId,
      actor: CORE_ACTOR,
      payload: { spaceId, identityId, createdAt: new Date().toISOString() }
    });
    this.commit([created]);
    return this.state.sessions.get(sessionId);
  }

  admitTurn({
    sessionId,
    spaceId = null,
    identityId = "lotus",
    initiator = { kind: "human", id: "fe" },
    input,
    origin,
    idempotencyKey,
    memory = null,
    policy = null
  }) {
    invariant(sessionId, "session_id_required");
    invariant(input?.text, "input_text_required");
    invariant(origin?.deviceId, "origin_device_required");
    invariant(idempotencyKey, "idempotency_key_required");
    this.ensureSession({ sessionId, spaceId, identityId });

    const scope = identityId + "|" + origin.deviceId;
    const existing = this.store.findIdempotency(scope, idempotencyKey);
    if (existing) {
      return { duplicate: true, turn: this.state.turns.get(existing), events: [] };
    }

    const turnId = pulsoId("turn");
    const accepted = eventDraft({
      type: "turn.accepted",
      aggregateType: "turn",
      aggregateId: turnId,
      correlationId: turnId,
      actor: initiator,
      payload: {
        sessionId,
        spaceId,
        identityId,
        initiator,
        input,
        origin,
        idempotencyKey,
        memory,
        policy,
        createdAt: new Date().toISOString()
      }
    });
    const result = this.commit([accepted], {
      idempotency: { scope, key: idempotencyKey, entityId: turnId }
    });
    return { duplicate: result.duplicate, turn: this.state.turns.get(turnId), events: result.events };
  }

  routeTurn(turnId, route) {
    const turn = this.state.turns.get(turnId);
    invariant(turn, "turn_not_found");
    this.commit([eventDraft({
      type: "turn.routed",
      aggregateType: "turn",
      aggregateId: turnId,
      correlationId: turnId,
      actor: CORE_ACTOR,
      payload: { route }
    })]);
    return this.state.turns.get(turnId);
  }

  beginRun(turnId, { kind, capability, executorProviderId }) {
    const turn = this.state.turns.get(turnId);
    invariant(turn, "turn_not_found");
    const provider = this.executors.get(executorProviderId);
    invariant(provider, "executor_provider_not_found:" + executorProviderId);
    const runId = pulsoId("run");
    const created = eventDraft({
      type: "run.created",
      aggregateType: "run",
      aggregateId: runId,
      correlationId: turnId,
      actor: CORE_ACTOR,
      payload: {
        turnId,
        sessionId: turn.sessionId,
        parentRunId: null,
        kind,
        capability,
        attempt: 1,
        createdAt: new Date().toISOString()
      }
    });
    this.commit([created]);
    return { runId, provider };
  }

  async bindRun(runId, provider, input) {
    const run = this.state.runs.get(runId);
    invariant(run, "run_not_found");
    const providerBinding = await provider.submit({
      runId,
      turnId: run.turnId,
      sessionId: run.sessionId,
      capability: run.capability,
      input
    });
    validateProviderBinding(providerBinding);
    this.commit([eventDraft({
      type: "run.started",
      aggregateType: "run",
      aggregateId: runId,
      correlationId: run.turnId,
      actor: { kind: "provider", id: provider.id },
      payload: { providerBinding }
    })]);
    return providerBinding;
  }

  async executeDeepWork(turnId, route) {
    const turn = this.state.turns.get(turnId);
    const { runId, provider } = this.beginRun(turnId, {
      kind: "deep_work",
      capability: route.capability,
      executorProviderId: route.executorProviderId
    });
    try {
      const binding = await this.bindRun(runId, provider, turn.input);
      for await (const providerEvent of provider.observe(binding)) {
        if (providerEvent.type !== "progress") continue;
        this.commit([eventDraft({
          type: "run.progressed",
          aggregateType: "run",
          aggregateId: runId,
          correlationId: turnId,
          actor: { kind: "provider", id: provider.id },
          payload: {
            phase: providerEvent.phase,
            message: providerEvent.message,
            percent: providerEvent.percent ?? null
          }
        })]);
      }
      const result = await provider.collect(binding);
      const drafts = [];
      const artifactIds = [];
      for (const artifact of result.artifacts ?? []) {
        const artifactId = pulsoId("artifact");
        artifactIds.push(artifactId);
        drafts.push(eventDraft({
          type: "artifact.created",
          aggregateType: "artifact",
          aggregateId: artifactId,
          correlationId: turnId,
          actor: { kind: "provider", id: provider.id },
          payload: { ...artifact, runId, turnId }
        }));
      }
      drafts.unshift(eventDraft({
        type: "run.succeeded",
        aggregateType: "run",
        aggregateId: runId,
        correlationId: turnId,
        actor: { kind: "provider", id: provider.id },
        payload: { result: { text: result.text, artifactIds } }
      }));
      this.commit(drafts);
      return { runId, text: result.text, artifactIds };
    } catch (error) {
      this.commit([eventDraft({
        type: "run.failed",
        aggregateType: "run",
        aggregateId: runId,
        correlationId: turnId,
        actor: { kind: "provider", id: provider.id },
        payload: { error: { code: "provider_failed", message: error.message } }
      })]);
      return { runId, failed: true, error: { code: "provider_failed", message: error.message } };
    }
  }

  async executeConversation(turnId, route) {
    const turn = this.state.turns.get(turnId);
    const provider = this.models.get(route.modelProviderId);
    invariant(provider, "model_provider_not_found:" + route.modelProviderId);
    const { runId } = this.beginModelRun(turnId, route.modelProviderId);
    const result = await provider.complete({
      turnId,
      sessionId: turn.sessionId,
      identityId: turn.identityId,
      input: turn.input
    });
    this.commit([eventDraft({
      type: "run.succeeded",
      aggregateType: "run",
      aggregateId: runId,
      correlationId: turnId,
      actor: { kind: "provider", id: provider.id },
      payload: { result }
    })]);
    return { runId, text: result.text, providerId: result.providerId };
  }

  beginModelRun(turnId, modelProviderId) {
    const turn = this.state.turns.get(turnId);
    invariant(turn, "turn_not_found");
    const runId = pulsoId("run");
    const providerBinding = validateProviderBinding({
      providerType: "model",
      providerId: modelProviderId,
      connectionId: "isolated-test",
      externalRunId: null,
      externalSessionId: null,
      boundAt: new Date().toISOString(),
      metadata: {}
    });
    this.commit([
      eventDraft({
        type: "run.created",
        aggregateType: "run",
        aggregateId: runId,
        correlationId: turnId,
        actor: CORE_ACTOR,
        payload: {
          turnId,
          sessionId: turn.sessionId,
          parentRunId: null,
          kind: "conversation",
          capability: "model.complete",
          attempt: 1,
          createdAt: new Date().toISOString()
        }
      }),
      eventDraft({
        type: "run.started",
        aggregateType: "run",
        aggregateId: runId,
        correlationId: turnId,
        actor: { kind: "provider", id: modelProviderId },
        payload: { providerBinding }
      })
    ]);
    return { runId };
  }

  completeDelivery(turnId, result) {
    const deliveryId = pulsoId("delivery");
    this.commit([
      eventDraft({
        type: "turn.delivery_started",
        aggregateType: "turn",
        aggregateId: turnId,
        correlationId: turnId,
        actor: CORE_ACTOR,
        payload: { deliveryId }
      }),
      eventDraft({
        type: "delivery.completed",
        aggregateType: "delivery",
        aggregateId: deliveryId,
        correlationId: turnId,
        actor: CORE_ACTOR,
        payload: { turnId, result, deliveredAt: new Date().toISOString() }
      }),
      eventDraft({
        type: "turn.completed",
        aggregateType: "turn",
        aggregateId: turnId,
        correlationId: turnId,
        actor: CORE_ACTOR,
        payload: { result, deliveryId }
      })
    ]);
    return { deliveryId, turn: this.state.turns.get(turnId) };
  }

  failDelivery(turnId, failure) {
    const deliveryId = pulsoId("delivery");
    this.commit([
      eventDraft({
        type: "turn.delivery_started",
        aggregateType: "turn",
        aggregateId: turnId,
        correlationId: turnId,
        actor: CORE_ACTOR,
        payload: { deliveryId, failure: true }
      }),
      eventDraft({
        type: "delivery.completed",
        aggregateType: "delivery",
        aggregateId: deliveryId,
        correlationId: turnId,
        actor: CORE_ACTOR,
        payload: {
          turnId,
          result: { status: "failed", error: failure.error },
          deliveredAt: new Date().toISOString()
        }
      }),
      eventDraft({
        type: "turn.failed",
        aggregateType: "turn",
        aggregateId: turnId,
        correlationId: turnId,
        actor: CORE_ACTOR,
        payload: { error: failure.error, deliveryId }
      })
    ]);
    return { deliveryId, turn: this.state.turns.get(turnId) };
  }

  async handle(request) {
    const admission = this.admitTurn(request);
    if (admission.duplicate) {
      return { duplicate: true, turn: admission.turn };
    }
    const turnId = admission.turn.turnId;
    this.routeTurn(turnId, request.route);
    let execution;
    if (request.route.lane === "reflex") {
      execution = { text: request.route.response ?? "Reflexo concluído.", runId: null };
    } else if (request.route.lane === "conversation") {
      execution = await this.executeConversation(turnId, request.route);
    } else if (request.route.lane === "deep_work") {
      execution = await this.executeDeepWork(turnId, request.route);
    } else {
      throw new Error("unsupported_lane:" + request.route.lane);
    }
    const delivery = execution.failed
      ? this.failDelivery(turnId, execution)
      : this.completeDelivery(turnId, execution);
    return {
      duplicate: false,
      turn: delivery.turn,
      execution,
      deliveryId: delivery.deliveryId
    };
  }

  async steerRun(runId, instruction) {
    const run = this.state.runs.get(runId);
    invariant(run, "run_not_found");
    invariant(run.status === "running", "run_not_running");
    const providerId = run.providerBinding?.providerId;
    const provider = this.executors.get(providerId);
    invariant(provider, "executor_provider_not_found:" + providerId);
    const receipt = await provider.steer(run.providerBinding, instruction);
    this.commit([
      eventDraft({
        type: "run.steered",
        aggregateType: "run",
        aggregateId: runId,
        correlationId: run.turnId,
        actor: CORE_ACTOR,
        payload: { instruction, receipt: receipt ?? null }
      })
    ]);
    return { run: this.state.runs.get(runId), receipt };
  }

  async cancelRun(runId, reason = "user_requested") {
    const run = this.state.runs.get(runId);
    invariant(run, "run_not_found");
    invariant(run.status === "running", "run_not_running");
    const providerId = run.providerBinding?.providerId;
    const provider = this.executors.get(providerId);
    invariant(provider, "executor_provider_not_found:" + providerId);
    const receipt = await provider.cancel(run.providerBinding, reason);
    invariant(receipt.accepted, "provider_cancel_rejected");
    this.commit([
      eventDraft({
        type: "run.cancelled",
        aggregateType: "run",
        aggregateId: runId,
        correlationId: run.turnId,
        actor: { kind: "provider", id: providerId },
        payload: { reason, receipt }
      }),
      eventDraft({
        type: "turn.cancelled",
        aggregateType: "turn",
        aggregateId: run.turnId,
        correlationId: run.turnId,
        actor: CORE_ACTOR,
        payload: { reason, runId }
      })
    ]);
    return { run: this.state.runs.get(runId), turn: this.state.turns.get(run.turnId) };
  }

  snapshot() {
    return {
      sessions: Object.fromEntries(this.state.sessions),
      turns: Object.fromEntries(this.state.turns),
      runs: Object.fromEntries(this.state.runs),
      artifacts: Object.fromEntries(this.state.artifacts),
      deliveries: Object.fromEntries(this.state.deliveries)
    };
  }
}
