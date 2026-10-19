import { eventDraft, invariant, pulsoId, DEFAULT_SOVEREIGN_IDENTITY } from "../domain/contracts.mjs";
import { PulsoCore } from "../core/pulso-core.mjs";
import { ControlPlaneService } from "../control-plane/control-plane-service.mjs";
import { applyControlPlaneEvent } from "../control-plane/panel-projector.mjs";
import { SecretRefResolver } from "./secret-ref-resolver.mjs";
import { ProviderRouter } from "./provider-router.mjs";
import { DurableOutbox } from "./durable-outbox.mjs";
import {
  assertRuntimeServiceTransition,
  validateRuntimeServiceStatus
} from "./runtime-contracts.mjs";

const RUNTIME_ACTOR = Object.freeze({ kind: "runtime", id: "pulso-runtime-service" });

export class PulsoRuntimeService {
  constructor({
    store,
    serviceId = "pulso-runtime-spine",
    core = null,
    controlPlane = null,
    secretResolver = null,
    router = null,
    outbox = null,
    modelProviders = [],
    executorProviders = [],
    topicHandlers = {},
    clock = () => new Date().toISOString(),
    idGenerator = pulsoId
  }) {
    invariant(store, "event_store_required");
    this.store = store;
    this.serviceId = serviceId;
    this.clock = clock;
    this.idGenerator = idGenerator;

    this.secretResolver = secretResolver || new SecretRefResolver({ clock: this.clock });
    this.controlPlane = controlPlane || new ControlPlaneService({
      store: this.store,
      clock: this.clock,
      secretResolver: this.secretResolver
    });

    // Share the same secretResolver, router, and outbox with controlPlane
    this.router = router || this.controlPlane.router || new ProviderRouter({
      store: this.store,
      state: this.controlPlane.state,
      secretResolver: this.secretResolver,
      adapters: modelProviders,
      clock: this.clock,
      idGenerator: this.idGenerator
    });

    for (const mp of modelProviders) {
      if (mp && mp.id) {
        this.router.attachAdapter(mp.id, mp);
      }
    }

    this.outbox = outbox || this.controlPlane.outbox || new DurableOutbox({
      store: this.store,
      state: this.controlPlane.state,
      secretResolver: this.secretResolver,
      clock: this.clock,
      idGenerator: this.idGenerator
    });

    this.controlPlane.secretResolver = this.secretResolver;
    this.controlPlane.router = this.router;
    this.controlPlane.outbox = this.outbox;
    this.controlPlane.runtime = this;
    if (this.controlPlane.bus) {
      this.controlPlane.bus.secretResolver = this.secretResolver;
      this.controlPlane.bus.router = this.router;
      this.controlPlane.bus.outbox = this.outbox;
      this.controlPlane.bus.runtime = this;
    }

    this.core = core || new PulsoCore({
      store: this.store,
      modelProviders,
      executorProviders
    });

    const coreModelsMap = this.core?.models instanceof Map
      ? this.core.models
      : (this.core?.modelProviders instanceof Map ? this.core.modelProviders : null);
    if (coreModelsMap) {
      for (const [id, mp] of coreModelsMap.entries()) {
        if (id && mp && !this.router.getAdapter(id)) {
          this.router.attachAdapter(id, mp);
        }
      }
    }

    this.topicHandlers = new Map(Object.entries(topicHandlers || {}));

    this.status = "stopped";
    this.startedAt = null;
    this.stoppedAt = null;
    this.recoveryCount = 0;
    this.recoveredLeasesCount = 0;

    this.#restoreHistoricalMetrics();
  }

  #restoreHistoricalMetrics() {
    for (const ev of this.store.all()) {
      if (ev.type === "runtime.service_started") {
        this.recoveryCount = ev.payload.recoveryCount ?? (this.recoveryCount + 1);
        this.recoveredLeasesCount += (ev.payload.recoveredLeasesCount ?? 0);
      }
    }
  }

  registerTopicHandler(topic, handlerFn) {
    invariant(typeof topic === "string" && topic.length > 0, "topic_required");
    invariant(typeof handlerFn === "function", "handler_function_required");
    this.topicHandlers.set(topic, handlerFn);
  }

  registerProvider(profileOrOptions, adapterOrOptions = null, maybeOptions = {}) {
    return this.router.registerProvider(profileOrOptions, adapterOrOptions, maybeOptions);
  }

  setBinding(bindingInput, options = {}) {
    return this.router.setBinding(bindingInput, options);
  }

  removeProvider(providerId, options = {}) {
    return this.router.removeProvider(providerId, options);
  }

  async testConnection(providerId, options = {}) {
    return this.router.testConnection(providerId, options);
  }

  async start({ recoverLeases = true, initDefaults = false } = {}) {
    if (this.status === "running") {
      const currentHealth = await this.health();
      return {
        ...currentHealth,
        recoveredLeasesCount: 0,
        recoveredIds: [],
        pendingCount: currentHealth.outboxSummary.pending
      };
    }

    assertRuntimeServiceTransition(this.status, "starting");
    this.status = "starting";

    if (initDefaults) {
      await this.controlPlane.initDefaults();
    }

    const integrity = this.store.verifyIntegrity();
    invariant(integrity.ok, "store_integrity_failed_on_start");

    this.core.restore();
    this.controlPlane.restore();

    let leaseRecovery = { recoveredCount: 0, recoveredIds: [] };
    if (recoverLeases !== false) {
      leaseRecovery = this.outbox.recoverExpiredLeases({ now: this.clock() });
    }

    assertRuntimeServiceTransition(this.status, "running");
    this.status = "running";
    this.startedAt = this.clock();
    this.stoppedAt = null;
    this.recoveryCount += 1;
    this.recoveredLeasesCount += leaseRecovery.recoveredCount;

    const outboxCounts = this.outbox.summary().counts;
    const startEvent = eventDraft({
      type: "runtime.service_started",
      aggregateType: "runtime_service",
      aggregateId: this.serviceId,
      correlationId: this.idGenerator("rt_start"),
      actor: RUNTIME_ACTOR,
      occurredAt: this.startedAt,
      payload: {
        serviceId: this.serviceId,
        status: "running",
        startedAt: this.startedAt,
        recoveryCount: this.recoveryCount,
        recoveredLeasesCount: leaseRecovery.recoveredCount,
        recoveredLeaseIds: leaseRecovery.recoveredIds,
        pendingOutboxCount: outboxCounts.pending
      }
    });

    const committed = this.store.append([startEvent]);
    for (const ev of committed.events) {
      applyControlPlaneEvent(this.controlPlane.state, ev);
    }

    const healthStatus = await this.health();
    return {
      ...healthStatus,
      recoveredLeasesCount: leaseRecovery.recoveredCount,
      recoveredIds: leaseRecovery.recoveredIds,
      pendingCount: outboxCounts.pending
    };
  }

  async stop({ reason = "graceful_shutdown", drainBeforeStop = false } = {}) {
    if (this.status === "stopped") {
      const currentHealth = await this.health();
      return {
        ...currentHealth,
        reason,
        pendingPreservedCount: currentHealth.outboxSummary.pending
      };
    }

    assertRuntimeServiceTransition(this.status, "stopping");
    this.status = "stopping";

    let drainReport = null;
    if (drainBeforeStop) {
      drainReport = await this.drainOutbox({ allowWhenStopping: true });
    }

    assertRuntimeServiceTransition(this.status, "stopped");
    this.status = "stopped";
    this.stoppedAt = this.clock();

    const outboxCounts = this.outbox.summary().counts;
    const stopEvent = eventDraft({
      type: "runtime.service_stopped",
      aggregateType: "runtime_service",
      aggregateId: this.serviceId,
      correlationId: this.idGenerator("rt_stop"),
      actor: RUNTIME_ACTOR,
      occurredAt: this.stoppedAt,
      payload: {
        serviceId: this.serviceId,
        status: "stopped",
        stoppedAt: this.stoppedAt,
        reason,
        pendingPreservedCount: outboxCounts.pending,
        leasedCountAtStop: outboxCounts.leased
      }
    });

    const committed = this.store.append([stopEvent]);
    for (const ev of committed.events) {
      applyControlPlaneEvent(this.controlPlane.state, ev);
    }

    const healthStatus = await this.health();
    return {
      ...healthStatus,
      reason,
      pendingPreservedCount: outboxCounts.pending,
      drainReport
    };
  }

  async health() {
    const checkedAt = this.clock();
    const storeIntegrity = this.store.verifyIntegrity();
    const outboxSummary = this.outbox.summary().counts;
    const providers = Array.from(this.controlPlane.state.providers.values());

    const providersSummary = {
      total: providers.length,
      healthy: providers.filter(p => p.health?.status === "healthy").length,
      degraded: providers.filter(p => p.health?.status === "degraded").length,
      unhealthy: providers.filter(p => p.health?.status === "unhealthy").length
    };

    const validatedStatus = validateRuntimeServiceStatus({
      serviceId: this.serviceId,
      status: this.status,
      startedAt: this.startedAt,
      stoppedAt: this.stoppedAt,
      checkedAt,
      recoveryCount: this.recoveryCount,
      recoveredLeasesCount: this.recoveredLeasesCount,
      storeIntegrity,
      outboxSummary,
      providersSummary
    });

    this.secretResolver.assertZeroLeakage(validatedStatus);
    return validatedStatus;
  }

  async routeCompletion(request, options = {}) {
    if (options.requireRunning) {
      invariant(this.status === "running", "runtime_service_not_running:" + this.status);
    } else if (!options.allowWhenStopped) {
      invariant(this.status !== "stopping", "runtime_service_stopping");
    }

    const identityId = request.identityId ?? DEFAULT_SOVEREIGN_IDENTITY;
    if (request.sessionId) {
      this.core.ensureSession({
        sessionId: request.sessionId,
        spaceId: request.spaceId ?? null,
        identityId
      });
    }

    return this.router.complete(
      {
        ...request,
        identityId
      },
      options
    );
  }

  async *routeStream(request, options = {}) {
    if (options.requireRunning) {
      invariant(this.status === "running", "runtime_service_not_running:" + this.status);
    } else if (!options.allowWhenStopped) {
      invariant(this.status !== "stopping", "runtime_service_stopping");
    }
    for await (const chunk of this.router.stream(request, options)) {
      yield chunk;
    }
  }

  enqueueOutbox(entry, options = {}) {
    return this.outbox.enqueue(entry, options);
  }

  async drainOutbox({
    limit = undefined,
    maxItems = undefined,
    workerId = null,
    leaseDurationMs = 30000,
    topic = null,
    now = null,
    handler = null,
    allowWhenStopping = false
  } = {}) {
    if (!allowWhenStopping) {
      invariant(this.status === "running", "runtime_service_not_running:" + this.status);
    }

    const effectiveLimit = maxItems ?? limit ?? 10;
    const leasedItems = this.outbox.leaseNext({
      workerId: workerId ?? this.serviceId,
      leaseDurationMs,
      limit: effectiveLimit,
      topic,
      now
    });

    const delivered = [];
    const failed = [];
    const deadLettered = [];
    const receipts = [];

    for (const item of leasedItems) {
      const leaseId = item.lease.leaseId;
      try {
        const customHandler = handler ?? this.topicHandlers.get(item.topic);
        let executionResult;

        if (typeof customHandler === "function") {
          executionResult = await customHandler(item, this);
        } else if (item.topic === "model.completion") {
          const completion = await this.routeCompletion(
            {
              ...item.payload,
              scope: item.scope
            },
            { allowWhenStopped: true }
          );
          executionResult = {
            providerId: completion.providerId,
            model: completion.model,
            text: completion.text,
            fallbackActivated: completion.fallbackActivated,
            routingReceipt: completion.routingReceipt
          };
        } else if (item.topic === "turn.handle") {
          executionResult = await this.core.handle(item.payload);
        } else {
          executionResult = { processed: true, topic: item.topic };
        }

        const ack = this.outbox.acknowledgeDelivery(item.outboxId, {
          leaseId,
          workerId: workerId ?? this.serviceId,
          result: executionResult,
          routingReceiptId: executionResult?.routingReceipt?.receiptId ?? null
        });

        delivered.push(ack.item);
        receipts.push(ack.receipt);
      } catch (error) {
        const failRes = this.outbox.recordFailure(item.outboxId, {
          leaseId,
          error,
          retryable: error?.retryable !== false
        });
        if (failRes.deadLettered) {
          deadLettered.push(failRes.item);
          if (failRes.receipt) receipts.push(failRes.receipt);
        } else {
          failed.push(failRes.item);
        }
      }
    }

    return {
      processedCount: leasedItems.length,
      delivered,
      failed,
      deadLettered,
      receipts
    };
  }
}
