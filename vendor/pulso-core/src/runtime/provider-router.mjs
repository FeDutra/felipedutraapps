import { eventDraft, invariant, pulsoId, assertExternalIdsConfined } from "../domain/contracts.mjs";
import { assertNoSecrets } from "../control-plane/secrets.mjs";
import {
  formatScopeKey,
  parseScope,
  validateProviderProfile,
  validateModelBinding
} from "../control-plane/control-plane-contracts.mjs";
import { applyControlPlaneEvent } from "../control-plane/panel-projector.mjs";
import { SecretRefResolver } from "./secret-ref-resolver.mjs";
import { validateRoutingReceipt } from "./runtime-contracts.mjs";

const ROUTER_ACTOR = Object.freeze({ kind: "runtime", id: "provider-router" });

async function nextStreamItem(iterator, signal) {
  if (!signal) return iterator.next();
  if (signal.aborted) {
    const cancelled = new Error("provider_stream_cancelled");
    cancelled.code = "request_cancelled";
    throw cancelled;
  }
  let abortHandler;
  const aborted = new Promise((_, reject) => {
    abortHandler = () => {
      const cancelled = new Error("provider_stream_cancelled");
      cancelled.code = "request_cancelled";
      reject(cancelled);
    };
    signal.addEventListener("abort", abortHandler, { once: true });
  });
  try {
    return await Promise.race([iterator.next(), aborted]);
  } finally {
    signal.removeEventListener("abort", abortHandler);
  }
}

export class ProviderRouter {
  constructor({
    store,
    state = null,
    secretResolver = null,
    adapters = [],
    clock = () => new Date().toISOString(),
    idGenerator = pulsoId
  }) {
    invariant(store, "event_store_required");
    this.store = store;
    this.state = state;
    this.clock = clock;
    this.idGenerator = idGenerator;
    this.secretResolver = secretResolver || new SecretRefResolver({ clock: this.clock });
    this.adapters = new Map();

    for (const adapter of adapters) {
      if (adapter && adapter.id) {
        this.adapters.set(adapter.id, adapter);
      }
    }
  }

  #commitEvents(drafts, options = {}) {
    assertExternalIdsConfined(drafts);
    assertNoSecrets(drafts);
    this.secretResolver.assertZeroLeakage(drafts);
    const committed = this.store.append(drafts, options);
    if (this.state) {
      for (const ev of committed.events) {
        applyControlPlaneEvent(this.state, ev);
      }
    }
    return committed;
  }

  #commitRoutingEvents(drafts, contextMeta = {}) {
    try {
      return this.#commitEvents(drafts);
    } catch (error) {
      const infraErr = new Error(`routing_commit_failed:${error.message}`);
      infraErr.code = "routing_commit_failed";
      infraErr.cause = error;
      if (contextMeta.providerId) infraErr.providerId = contextMeta.providerId;
      if (contextMeta.model) infraErr.model = contextMeta.model;
      if (contextMeta.receipt) {
        infraErr.routingReceipt = contextMeta.receipt;
        infraErr.receipt = contextMeta.receipt;
      }
      throw infraErr;
    }
  }

  #getProvidersMap() {
    if (this.state?.providers) return this.state.providers;
    const map = new Map();
    for (const ev of this.store.all()) {
      if (ev.type === "control_plane.provider_registered" || ev.type === "control_plane.provider_updated") {
        map.set(ev.payload.providerId, { ...map.get(ev.payload.providerId), ...ev.payload });
      } else if (ev.type === "control_plane.provider_removed") {
        map.delete(ev.payload.providerId);
      }
    }
    return map;
  }

  #getBindingsMap() {
    if (this.state?.bindings) return this.state.bindings;
    const map = new Map();
    for (const ev of this.store.all()) {
      if (ev.type === "control_plane.model_binding_set") {
        map.set(ev.payload.scopeKey, { ...map.get(ev.payload.scopeKey), ...ev.payload });
      } else if (ev.type === "control_plane.fallback_activated") {
        const b = map.get(ev.payload.scopeKey);
        if (b) {
          b.active = { ...ev.payload.active };
          b.status = "fallback_active";
        }
      }
    }
    return map;
  }

  attachAdapter(providerId, adapter) {
    invariant(providerId && typeof providerId === "string", "provider_id_required");
    invariant(adapter && typeof adapter.complete === "function", "valid_model_adapter_required");
    if (adapter.secretResolver && this.secretResolver && adapter.secretResolver !== this.secretResolver) {
      adapter.secretResolver = this.secretResolver;
    }
    this.adapters.set(providerId, adapter);
    return adapter;
  }

  bindAdapter(providerId, adapter) {
    return this.attachAdapter(providerId, adapter);
  }

  getAdapter(providerId) {
    return this.adapters.get(providerId) ?? null;
  }

  async registerProvider(profileOrOptions, adapter = null, { actor = ROUTER_ACTOR, idempotencyKey = null } = {}) {
    invariant(profileOrOptions && typeof profileOrOptions === "object", "provider_profile_required");
    const profileInput = profileOrOptions.profile && typeof profileOrOptions.profile === "object"
      ? profileOrOptions.profile
      : profileOrOptions;
    const effectiveAdapter = adapter ?? profileOrOptions.adapter ?? null;

    if (effectiveAdapter) {
      this.attachAdapter(profileInput.providerId ?? profileInput.id ?? effectiveAdapter.id, effectiveAdapter);
    }
    const resolvedAdapter = effectiveAdapter ?? this.adapters.get(profileInput.providerId ?? profileInput.id);
    let capabilitiesList = profileInput.capabilities;
    if (!Array.isArray(capabilitiesList) && resolvedAdapter && typeof resolvedAdapter.capabilities === "function") {
      const capObj = await resolvedAdapter.capabilities();
      capabilitiesList = [
        ...(capObj.modalities || ["text"]),
        ...(capObj.streaming ? ["streaming"] : []),
        ...(capObj.local ? ["local"] : [])
      ];
    }

    const secretRef = profileInput.secretRef !== undefined
      ? profileInput.secretRef
      : (resolvedAdapter?.secretRef ?? null);
    const authDescriptor = this.secretResolver.inspectRef(secretRef);

    const validated = validateProviderProfile({
      ...profileInput,
      providerId: profileInput.providerId ?? profileInput.id ?? resolvedAdapter?.id,
      displayName: profileInput.displayName ?? profileInput.name ?? resolvedAdapter?.label ?? resolvedAdapter?.id,
      kind: profileInput.kind ?? (resolvedAdapter?.local ? "local" : "model"),
      endpoint: profileInput.endpoint ?? resolvedAdapter?.endpoint ?? null,
      secretRef,
      capabilities: capabilitiesList ?? ["text"],
      health: {
        status: profileInput.health?.status ?? "healthy",
        checkedAt: profileInput.health?.checkedAt ?? this.clock(),
        detail: profileInput.health?.detail ?? "registered"
      },
      metadata: {
        ...(profileInput.metadata ?? {}),
        adapterKind: profileInput.adapterKind ?? resolvedAdapter?.adapterKind ?? "fake",
        defaultModel: profileInput.defaultModel ?? resolvedAdapter?.defaultModel ?? "default",
        authSource: authDescriptor
      }
    });

    const correlationId = this.idGenerator("cmd");
    const draft = eventDraft({
      type: "control_plane.provider_registered",
      aggregateType: "provider_profile",
      aggregateId: validated.providerId,
      correlationId,
      causationId: correlationId,
      actor,
      occurredAt: this.clock(),
      payload: validated
    });

    const options = idempotencyKey
      ? { idempotency: { scope: "router|register_provider", key: idempotencyKey, entityId: validated.providerId } }
      : {};
    this.#commitEvents([draft], options);
    return validated;
  }

  removeProvider(providerId, { actor = ROUTER_ACTOR, reason = "operator_removed" } = {}) {
    invariant(providerId && typeof providerId === "string", "provider_id_required");
    const providers = this.#getProvidersMap();
    const existing = providers.get(providerId);
    invariant(existing, "provider_not_found:" + providerId);

    this.adapters.delete(providerId);
    const removedAt = this.clock();
    const correlationId = this.idGenerator("cmd");

    const draft = eventDraft({
      type: "control_plane.provider_removed",
      aggregateType: "provider_profile",
      aggregateId: providerId,
      correlationId,
      causationId: correlationId,
      actor,
      occurredAt: removedAt,
      payload: {
        providerId,
        reason,
        removedAt
      }
    });

    this.#commitEvents([draft]);
    return {
      removed: true,
      providerId,
      reason,
      removedAt
    };
  }

  setBinding(bindingInput, { actor = ROUTER_ACTOR, idempotencyKey = null } = {}) {
    const validated = validateModelBinding(bindingInput);
    const correlationId = this.idGenerator("cmd");
    const draft = eventDraft({
      type: "control_plane.model_binding_set",
      aggregateType: "model_binding",
      aggregateId: validated.scopeKey,
      correlationId,
      causationId: correlationId,
      actor,
      occurredAt: this.clock(),
      payload: validated
    });

    const options = idempotencyKey
      ? { idempotency: { scope: "router|set_binding", key: idempotencyKey, entityId: validated.scopeKey } }
      : {};
    this.#commitEvents([draft], options);
    return validated;
  }

  /**
   * Resolves binding using strict scope precedence: task > session > agent > system (global).
   */
  resolveRoute(context = {}) {
    const bindings = this.#getBindingsMap();
    const candidateKeys = [];

    // 1. Explicit scope override if passed directly as { scope: { type, scopeId } } or string
    if (context.scope) {
      const parsed = parseScope(context.scope);
      const explicitKey = formatScopeKey(parsed);
      if (parsed.type === "task" && parsed.scopeId) candidateKeys.push(explicitKey);
      if (parsed.type === "session" && parsed.scopeId) candidateKeys.push(explicitKey);
      if (parsed.type === "agent" && parsed.scopeId) candidateKeys.push(explicitKey);
    }

    // 2. Hierarchical precedence: task > session > agent > system
    if (context.taskId) {
      const k = `task:${context.taskId}`;
      if (!candidateKeys.includes(k)) candidateKeys.push(k);
    }
    if (context.sessionId) {
      const k = `session:${context.sessionId}`;
      if (!candidateKeys.includes(k)) candidateKeys.push(k);
    }
    if (context.agentId) {
      const k = `agent:${context.agentId}`;
      if (!candidateKeys.includes(k)) candidateKeys.push(k);
    }
    candidateKeys.push("system");

    const evaluatedScopes = [];
    for (const key of candidateKeys) {
      if (!evaluatedScopes.includes(key)) {
        evaluatedScopes.push(key);
      }
      const matched = bindings.get(key) ?? (key === "system" ? bindings.get("global") : null);
      if (matched) {
        return {
          resolvedScope: key === "global" ? "system" : key,
          scopeKey: matched.scopeKey,
          evaluatedScopes,
          binding: matched,
          primary: matched.primary,
          fallbackChain: matched.fallbackChain ?? []
        };
      }
    }

    throw new Error(`model_binding_not_found_for_scopes:${evaluatedScopes.join(",")}`);
  }

  resolveBinding(context = {}) {
    return this.resolveRoute(context);
  }

  async testConnection(providerId, { actor = ROUTER_ACTOR } = {}) {
    invariant(providerId && typeof providerId === "string", "provider_id_required");
    const providers = this.#getProvidersMap();
    const profile = providers.get(providerId);
    invariant(profile, "provider_not_found:" + providerId);

    const adapter = this.adapters.get(providerId);
    const checkedAt = this.clock();
    const authSource = this.secretResolver.inspectRef(profile.secretRef);

    let healthReport;
    if (!profile.enabled) {
      healthReport = {
        status: "unhealthy",
        providerId,
        checkedAt,
        authSource,
        detail: "provider_disabled"
      };
    } else if (!adapter) {
      healthReport = {
        status: authSource.secretRef && !authSource.configured ? "unhealthy" : (profile.health?.status ?? "healthy"),
        providerId,
        checkedAt,
        authSource,
        detail: authSource.secretRef && !authSource.configured
          ? `secret_not_found:${authSource.secretRef}`
          : "profile_registered_no_live_adapter"
      };
    } else {
      healthReport = await adapter.health();
    }

    const updatedProfile = validateProviderProfile({
      ...profile,
      health: {
        status: healthReport.status === "healthy" ? "healthy" : (healthReport.status === "degraded" ? "degraded" : "unhealthy"),
        checkedAt: healthReport.checkedAt ?? checkedAt,
        detail: healthReport.detail ?? null
      },
      metadata: {
        ...(profile.metadata ?? {}),
        authSource
      }
    });

    const receiptId = this.idGenerator("conn_rcpt");
    const connectionReceipt = {
      receiptId,
      providerId,
      status: updatedProfile.health.status,
      checkedAt: updatedProfile.health.checkedAt,
      authSource,
      detail: updatedProfile.health.detail
    };

    this.secretResolver.assertZeroLeakage(connectionReceipt);

    const correlationId = this.idGenerator("cmd");
    this.#commitEvents([
      eventDraft({
        type: "control_plane.provider_updated",
        aggregateType: "provider_profile",
        aggregateId: providerId,
        correlationId,
        causationId: correlationId,
        actor,
        occurredAt: checkedAt,
        payload: updatedProfile
      }),
      eventDraft({
        type: "runtime.provider_connection_tested",
        aggregateType: "provider_profile",
        aggregateId: providerId,
        correlationId,
        causationId: correlationId,
        actor,
        occurredAt: checkedAt,
        payload: connectionReceipt
      })
    ]);

    return connectionReceipt;
  }

  async complete(request, options = {}) {
    const actor = options.actor ?? ROUTER_ACTOR;
    const allowFallback = options.allowFallback !== false;
    const route = this.resolveRoute({
      taskId: request.taskId ?? options.taskId ?? null,
      sessionId: request.sessionId ?? options.sessionId ?? null,
      agentId: request.agentId ?? options.agentId ?? null,
      scope: request.scope ?? options.scope ?? null
    });

    const origin = {
      turnId: request.turnId ?? null,
      sessionId: request.sessionId ?? null,
      agentId: request.agentId ?? null,
      taskId: request.taskId ?? null
    };

    const candidates = [
      {
        providerId: route.primary.providerId,
        model: route.primary.model,
        role: "primary",
        fallbackIndex: null
      },
      ...(allowFallback
        ? route.fallbackChain.map((item, idx) => ({
            providerId: item.providerId,
            model: item.model,
            role: "fallback",
            fallbackIndex: idx
          }))
        : [])
    ];

    const providers = this.#getProvidersMap();
    const attempts = [];
    const correlationId = request.turnId ?? request.taskId ?? this.idGenerator("route");
    let primaryFailureCause = null;

    for (let i = 0; i < candidates.length; i++) {
      if (request.signal?.aborted) {
        const cancelled = new Error("provider_stream_cancelled");
        cancelled.code = "request_cancelled";
        throw cancelled;
      }
      const candidate = candidates[i];
      const attemptTime = this.clock();
      const profile = providers.get(candidate.providerId);
      const adapter = this.adapters.get(candidate.providerId);

      // 1. Provider invocation boundary ONLY: only errors inside this block can trigger fallback
      let rawCompletion;
      try {
        if (profile && profile.enabled === false) {
          const err = new Error(`provider_disabled:${candidate.providerId}`);
          err.code = "provider_disabled";
          throw err;
        }
        if (!adapter) {
          const err = new Error(`provider_adapter_not_registered:${candidate.providerId}`);
          err.code = "adapter_not_registered";
          throw err;
        }

        const normalizedRequest = {
          ...request,
          input: request.input ?? {
            modality: "text",
            text: String(request.prompt ?? request.text ?? "")
          },
          model: candidate.model
        };

        rawCompletion = await adapter.complete(normalizedRequest);
      } catch (providerError) {
        const safeErr = this.secretResolver.redactError(providerError, profile?.secretRef ?? adapter?.secretRef ?? null);
        if (candidate.role === "primary") {
          primaryFailureCause = safeErr.message;
        }

        const failedAttempt = {
          attemptIndex: i,
          providerId: candidate.providerId,
          model: candidate.model,
          role: candidate.role,
          fallbackIndex: candidate.fallbackIndex,
          status: "failed",
          cause: safeErr.message,
          errorCode: safeErr.code,
          latencyMs: 0,
          timestamp: attemptTime
        };
        attempts.push(failedAttempt);

        this.#commitRoutingEvents([
          eventDraft({
            type: "runtime.provider_attempt_failed",
            aggregateType: "model_binding",
            aggregateId: route.scopeKey,
            correlationId,
            causationId: correlationId,
            actor,
            occurredAt: attemptTime,
            payload: {
              scopeKey: route.scopeKey,
              resolvedScope: route.resolvedScope,
              attempt: failedAttempt,
              origin
            }
          })
        ], { providerId: candidate.providerId, model: candidate.model });

        continue;
      }

      // 2. Post-invocation validation and persistence: NEVER triggers fallback!
      try {
        const completion = {
          ...rawCompletion,
          text: rawCompletion.text ?? rawCompletion.outputText ?? "",
          outputText: rawCompletion.outputText ?? rawCompletion.text ?? ""
        };

        this.secretResolver.assertZeroLeakage(completion);

        attempts.push({
          attemptIndex: i,
          providerId: candidate.providerId,
          model: candidate.model,
          role: candidate.role,
          fallbackIndex: candidate.fallbackIndex,
          status: "succeeded",
          cause: null,
          errorCode: null,
          latencyMs: 0,
          timestamp: attemptTime
        });

        const fallbackActivated = candidate.role === "fallback";
        const occurredAt = this.clock();
        const receipt = validateRoutingReceipt({
          receiptId: this.idGenerator("rt_rcpt"),
          status: "succeeded",
          resolvedScope: route.resolvedScope,
          evaluatedScopes: route.evaluatedScopes,
          primary: route.primary,
          effective: {
            providerId: candidate.providerId,
            model: candidate.model,
            isFallback: fallbackActivated,
            fallbackIndex: candidate.fallbackIndex
          },
          fallbackActivated,
          cause: fallbackActivated ? primaryFailureCause : null,
          origin,
          attempts,
          occurredAt
        });

        const drafts = [];
        if (fallbackActivated) {
          const activeSelection = {
            providerId: candidate.providerId,
            model: candidate.model,
            selectedFallbackIndex: candidate.fallbackIndex,
            reason: primaryFailureCause ?? "primary_provider_failed"
          };
          drafts.push(
            eventDraft({
              type: "control_plane.fallback_activated",
              aggregateType: "model_binding",
              aggregateId: route.scopeKey,
              correlationId,
              causationId: correlationId,
              actor,
              occurredAt,
              payload: {
                scopeKey: route.scopeKey,
                active: activeSelection,
                reason: primaryFailureCause ?? "primary_provider_failed",
                origin
              }
            }),
            eventDraft({
              type: "runtime.fallback_triggered",
              aggregateType: "model_binding",
              aggregateId: route.scopeKey,
              correlationId,
              causationId: correlationId,
              actor,
              occurredAt,
              payload: {
                receiptId: receipt.receiptId,
                resolvedScope: route.resolvedScope,
                scopeKey: route.scopeKey,
                primary: route.primary,
                effective: receipt.effective,
                cause: primaryFailureCause,
                origin,
                attempts: receipt.attempts
              }
            })
          );
        }

        drafts.push(
          eventDraft({
            type: "runtime.routing_completed",
            aggregateType: "model_binding",
            aggregateId: route.scopeKey,
            correlationId,
            causationId: correlationId,
            actor,
            occurredAt,
            payload: receipt
          })
        );

        this.#commitEvents(drafts);

        return {
          ...completion,
          completion,
          providerId: candidate.providerId,
          model: candidate.model,
          fallbackActivated,
          routingReceipt: receipt,
          receipt
        };
      } catch (internalError) {
        const infraErr = new Error(`routing_commit_failed:${internalError.message}`);
        infraErr.code = "routing_commit_failed";
        infraErr.cause = internalError;
        infraErr.providerId = candidate.providerId;
        infraErr.model = candidate.model;
        throw infraErr;
      }
    }

    // All candidates failed (or fallback was disabled/empty)
    const occurredAt = this.clock();
    const failedReceipt = validateRoutingReceipt({
      receiptId: this.idGenerator("rt_rcpt"),
      status: "failed",
      resolvedScope: route.resolvedScope,
      evaluatedScopes: route.evaluatedScopes,
      primary: route.primary,
      effective: null,
      fallbackActivated: attempts.length > 1,
      cause: primaryFailureCause ?? "all_providers_failed",
      origin,
      attempts,
      occurredAt
    });

    this.#commitRoutingEvents([
      eventDraft({
        type: "runtime.routing_failed",
        aggregateType: "model_binding",
        aggregateId: route.scopeKey,
        correlationId,
        causationId: correlationId,
        actor,
        occurredAt,
        payload: failedReceipt
      })
    ], { receipt: failedReceipt });

    const finalError = new Error(`routing_failed:${failedReceipt.cause}`);
    finalError.code = "routing_failed";
    finalError.routingReceipt = failedReceipt;
    finalError.receipt = failedReceipt;
    finalError.attempts = failedReceipt.attempts;
    throw finalError;
  }

  async *stream(request, options = {}) {
    const actor = options.actor ?? ROUTER_ACTOR;
    const allowFallback = options.allowFallback !== false;
    const route = this.resolveRoute({
      taskId: request.taskId ?? options.taskId ?? null,
      sessionId: request.sessionId ?? options.sessionId ?? null,
      agentId: request.agentId ?? options.agentId ?? null,
      scope: request.scope ?? options.scope ?? null
    });

    const origin = {
      turnId: request.turnId ?? null,
      sessionId: request.sessionId ?? null,
      agentId: request.agentId ?? null,
      taskId: request.taskId ?? null
    };

    const candidates = [
      {
        providerId: route.primary.providerId,
        model: route.primary.model,
        role: "primary",
        fallbackIndex: null
      },
      ...(allowFallback
        ? route.fallbackChain.map((item, idx) => ({
            providerId: item.providerId,
            model: item.model,
            role: "fallback",
            fallbackIndex: idx
          }))
        : [])
    ];

    const providers = this.#getProvidersMap();
    const attempts = [];
    const correlationId = request.turnId ?? request.taskId ?? this.idGenerator("route");
    let primaryFailureCause = null;

    for (let i = 0; i < candidates.length; i++) {
      if (request.signal?.aborted) {
        const cancelled = new Error("provider_stream_cancelled");
        cancelled.code = "request_cancelled";
        throw cancelled;
      }
      const candidate = candidates[i];
      const attemptTime = this.clock();
      const profile = providers.get(candidate.providerId);
      const adapter = this.adapters.get(candidate.providerId);

      let visibleDeltasCount = 0;
      let accumulatedText = "";
      let completedEvent = null;

      try {
        if (profile && profile.enabled === false) {
          const err = new Error(`provider_disabled:${candidate.providerId}`);
          err.code = "provider_disabled";
          throw err;
        }
        if (!adapter) {
          const err = new Error(`provider_adapter_not_registered:${candidate.providerId}`);
          err.code = "adapter_not_registered";
          throw err;
        }
        if (typeof adapter.stream !== "function") {
          const err = new Error(`provider_streaming_not_supported:${candidate.providerId}`);
          err.code = "streaming_not_supported";
          throw err;
        }

        const normalizedRequest = {
          ...request,
          input: request.input ?? {
            modality: "text",
            text: String(request.prompt ?? request.text ?? "")
          },
          model: candidate.model,
          stream: true
        };

        const iterator = adapter.stream(normalizedRequest)[Symbol.asyncIterator]();
        while (true) {
          const next = await nextStreamItem(iterator, request.signal);
          if (next.done) break;
          const chunk = next.value;
          if (request.signal?.aborted) {
            const cancelled = new Error("provider_stream_cancelled");
            cancelled.code = "request_cancelled";
            throw cancelled;
          }
          if (chunk.type === "model.delta" || chunk.kind === "delta" || chunk.type === "delta") {
            const deltaText = String(chunk.text ?? chunk.delta ?? "");
            if (deltaText.length > 0) {
              visibleDeltasCount += 1;
              accumulatedText += deltaText;
              const deltaOut = {
                ...chunk,
                type: "model.delta",
                kind: "delta",
                providerId: candidate.providerId,
                model: chunk.model ?? candidate.model,
                text: deltaText,
                delta: deltaText
              };
              this.secretResolver.assertZeroLeakage(deltaOut);
              yield deltaOut;
            }
          } else if (chunk.type === "model.completed" || chunk.kind === "completed" || chunk.type === "completed") {
            completedEvent = chunk;
          }
        }

        if (!completedEvent) {
          const err = new Error("stream_terminated_without_completion");
          err.code = "stream_incomplete";
          throw err;
        }
      } catch (streamError) {
        if (request.signal?.aborted || streamError?.code === "request_cancelled" || streamError?.name === "AbortError") {
          const cancelled = new Error("provider_stream_cancelled");
          cancelled.code = "request_cancelled";
          cancelled.partialText = accumulatedText;
          cancelled.deltasEmitted = visibleDeltasCount;
          throw cancelled;
        }
        const safeErr = this.secretResolver.redactError(streamError, profile?.secretRef ?? adapter?.secretRef ?? null);

        // CRITICAL RULE: Once a visible delta has been emitted, NEVER fallback to another provider!
        if (visibleDeltasCount > 0) {
          const interruptCause = `stream_interrupted:${safeErr.message}`;
          const failedAttempt = {
            attemptIndex: i,
            providerId: candidate.providerId,
            model: candidate.model,
            role: candidate.role,
            fallbackIndex: candidate.fallbackIndex,
            status: "failed",
            cause: interruptCause,
            errorCode: "stream_interrupted",
            latencyMs: 0,
            timestamp: attemptTime
          };
          attempts.push(failedAttempt);

          const occurredAt = this.clock();
          const interruptedReceipt = validateRoutingReceipt({
            receiptId: this.idGenerator("rt_rcpt"),
            status: "failed",
            resolvedScope: route.resolvedScope,
            evaluatedScopes: route.evaluatedScopes,
            primary: route.primary,
            effective: null,
            fallbackActivated: candidate.role === "fallback",
            cause: interruptCause,
            origin,
            attempts,
            occurredAt
          });

          this.#commitRoutingEvents([
            eventDraft({
              type: "runtime.provider_attempt_failed",
              aggregateType: "model_binding",
              aggregateId: route.scopeKey,
              correlationId,
              causationId: correlationId,
              actor,
              occurredAt: attemptTime,
              payload: {
                scopeKey: route.scopeKey,
                resolvedScope: route.resolvedScope,
                attempt: failedAttempt,
                origin
              }
            }),
            eventDraft({
              type: "runtime.routing_failed",
              aggregateType: "model_binding",
              aggregateId: route.scopeKey,
              correlationId,
              causationId: correlationId,
              actor,
              occurredAt,
              payload: interruptedReceipt
            })
          ], { providerId: candidate.providerId, model: candidate.model, receipt: interruptedReceipt });

          const interruptedError = new Error(interruptCause);
          interruptedError.code = "stream_interrupted";
          interruptedError.routingReceipt = interruptedReceipt;
          interruptedError.receipt = interruptedReceipt;
          interruptedError.attempts = interruptedReceipt.attempts;
          interruptedError.partialText = accumulatedText;
          interruptedError.deltasEmitted = visibleDeltasCount;
          interruptedError.partialDeltasCount = visibleDeltasCount;
          throw interruptedError;
        }

        // Failed BEFORE any visible delta: record failed attempt and allow fallback
        if (candidate.role === "primary") {
          primaryFailureCause = safeErr.message;
        }

        const failedAttempt = {
          attemptIndex: i,
          providerId: candidate.providerId,
          model: candidate.model,
          role: candidate.role,
          fallbackIndex: candidate.fallbackIndex,
          status: "failed",
          cause: safeErr.message,
          errorCode: safeErr.code,
          latencyMs: 0,
          timestamp: attemptTime
        };
        attempts.push(failedAttempt);

        this.#commitRoutingEvents([
          eventDraft({
            type: "runtime.provider_attempt_failed",
            aggregateType: "model_binding",
            aggregateId: route.scopeKey,
            correlationId,
            causationId: correlationId,
            actor,
            occurredAt: attemptTime,
            payload: {
              scopeKey: route.scopeKey,
              resolvedScope: route.resolvedScope,
              attempt: failedAttempt,
              origin
            }
          })
        ], { providerId: candidate.providerId, model: candidate.model });

        continue;
      }

      // Stream completed normally: commit receipt & yield completion (never triggers fallback on commit error)
      let receipt;
      let finalCompletionEvent;
      try {
        this.secretResolver.assertZeroLeakage(completedEvent);

        attempts.push({
          attemptIndex: i,
          providerId: candidate.providerId,
          model: candidate.model,
          role: candidate.role,
          fallbackIndex: candidate.fallbackIndex,
          status: "succeeded",
          cause: null,
          errorCode: null,
          latencyMs: 0,
          timestamp: attemptTime
        });

        const fallbackActivated = candidate.role === "fallback";
        const occurredAt = this.clock();
        receipt = validateRoutingReceipt({
          receiptId: this.idGenerator("rt_rcpt"),
          status: "succeeded",
          resolvedScope: route.resolvedScope,
          evaluatedScopes: route.evaluatedScopes,
          primary: route.primary,
          effective: {
            providerId: candidate.providerId,
            model: candidate.model,
            isFallback: fallbackActivated,
            fallbackIndex: candidate.fallbackIndex
          },
          fallbackActivated,
          cause: fallbackActivated ? primaryFailureCause : null,
          origin,
          attempts,
          occurredAt
        });

        const drafts = [];
        if (fallbackActivated) {
          const activeSelection = {
            providerId: candidate.providerId,
            model: candidate.model,
            selectedFallbackIndex: candidate.fallbackIndex,
            reason: primaryFailureCause ?? "primary_provider_failed"
          };
          drafts.push(
            eventDraft({
              type: "control_plane.fallback_activated",
              aggregateType: "model_binding",
              aggregateId: route.scopeKey,
              correlationId,
              causationId: correlationId,
              actor,
              occurredAt,
              payload: {
                scopeKey: route.scopeKey,
                active: activeSelection,
                reason: primaryFailureCause ?? "primary_provider_failed",
                origin
              }
            }),
            eventDraft({
              type: "runtime.fallback_triggered",
              aggregateType: "model_binding",
              aggregateId: route.scopeKey,
              correlationId,
              causationId: correlationId,
              actor,
              occurredAt,
              payload: {
                receiptId: receipt.receiptId,
                resolvedScope: route.resolvedScope,
                scopeKey: route.scopeKey,
                primary: route.primary,
                effective: receipt.effective,
                cause: primaryFailureCause,
                origin,
                attempts: receipt.attempts
              }
            })
          );
        }

        drafts.push(
          eventDraft({
            type: "runtime.routing_completed",
            aggregateType: "model_binding",
            aggregateId: route.scopeKey,
            correlationId,
            causationId: correlationId,
            actor,
            occurredAt,
            payload: receipt
          })
        );

        this.#commitEvents(drafts);

        const finalText = completedEvent.text ?? completedEvent.outputText ?? accumulatedText;
        finalCompletionEvent = {
          ...completedEvent,
          type: "model.completed",
          kind: "completed",
          providerId: candidate.providerId,
          model: completedEvent.model ?? candidate.model,
          text: finalText,
          outputText: completedEvent.outputText ?? finalText,
          fallbackActivated,
          routingReceipt: receipt,
          receipt
        };
      } catch (internalError) {
        const infraErr = new Error(`routing_commit_failed:${internalError.message}`);
        infraErr.code = "routing_commit_failed";
        infraErr.cause = internalError;
        infraErr.providerId = candidate.providerId;
        infraErr.model = candidate.model;
        throw infraErr;
      }

      yield {
        type: "routing.receipt",
        receipt,
        routingReceipt: receipt
      };
      yield finalCompletionEvent;
      return;
    }

    // All candidates failed before emitting any visible delta
    const occurredAt = this.clock();
    const failedReceipt = validateRoutingReceipt({
      receiptId: this.idGenerator("rt_rcpt"),
      status: "failed",
      resolvedScope: route.resolvedScope,
      evaluatedScopes: route.evaluatedScopes,
      primary: route.primary,
      effective: null,
      fallbackActivated: attempts.length > 1,
      cause: primaryFailureCause ?? "all_providers_failed",
      origin,
      attempts,
      occurredAt
    });

    this.#commitRoutingEvents([
      eventDraft({
        type: "runtime.routing_failed",
        aggregateType: "model_binding",
        aggregateId: route.scopeKey,
        correlationId,
        causationId: correlationId,
        actor,
        occurredAt,
        payload: failedReceipt
      })
    ], { receipt: failedReceipt });

    const finalError = new Error(`routing_failed:${failedReceipt.cause}`);
    finalError.code = "routing_failed";
    finalError.routingReceipt = failedReceipt;
    finalError.receipt = failedReceipt;
    finalError.attempts = failedReceipt.attempts;
    throw finalError;
  }
}

export { ProviderRouter as ProviderRegistry };
