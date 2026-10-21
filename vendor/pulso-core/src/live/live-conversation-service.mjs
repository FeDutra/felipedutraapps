import { eventDraft, invariant, pulsoId } from "../domain/contracts.mjs";
import { assertNoSecrets, sanitizeSecrets } from "../control-plane/secrets.mjs";
import {
  LIVE_DEFAULT_IDENTITY,
  LIVE_CONVERSATION_RUN_TERMINAL,
  assertConversationRunTransition,
  validateMessage,
  validateConversationRun
} from "./live-contracts.mjs";
import { applyLiveEvent } from "./live-projector.mjs";

const CORE_ACTOR = Object.freeze({ kind: "core", id: "pulso-live-conversation" });
const HUMAN_ACTOR = Object.freeze({ kind: "human", id: "fe" });
const LOTUS_ACTOR = Object.freeze({ kind: "identity", id: LIVE_DEFAULT_IDENTITY });

function errorDescriptor(error) {
  return sanitizeSecrets({
    code: error?.code || "conversation_run_failed",
    message: error?.message || "conversation_run_failed"
  });
}

export class LiveConversationService {
  constructor({ store, live, router, identityService = null, memoryProvider = null, clock = () => new Date().toISOString(), idGenerator = pulsoId } = {}) {
    invariant(store, "event_store_required");
    invariant(live, "live_service_required");
    invariant(router, "provider_router_required");
    this.store = store;
    this.live = live;
    this.router = router;
    this.identityService = identityService;
    this.memoryProvider = memoryProvider;
    this.clock = clock;
    this.idGenerator = idGenerator;
    this.activeRuns = new Map();
    this.inflightIdempotency = new Map();
  }

  async ensureReady() {
    await this.live.ensureRestored();
  }

  getRun(runId) {
    return this.live.state.conversationRuns.get(runId) ?? null;
  }

  listRuns(sessionId = null) {
    const runs = Array.from(this.live.state.conversationRuns.values());
    return sessionId ? runs.filter(run => run.sessionId === sessionId) : runs;
  }

  #apply(events) {
    for (const event of events) applyLiveEvent(this.live.state, event);
  }

  #append(drafts, options = {}) {
    assertNoSecrets(drafts);
    this.router.secretResolver?.assertZeroLeakage(drafts);
    const result = this.store.append(drafts, options);
    this.#apply(result.events);
    return result;
  }

  #appendAtomic(drafts, options = {}) {
    assertNoSecrets(drafts);
    this.router.secretResolver?.assertZeroLeakage(drafts);
    const result = this.store.runInTransaction(() => this.store.appendInTransaction(drafts, options));
    this.#apply(result.events);
    return result;
  }

  #runDraft({ type, runId, correlationId, payload, occurredAt }) {
    return eventDraft({
      type,
      aggregateType: "live_conversation_run",
      aggregateId: runId,
      correlationId,
      causationId: correlationId,
      actor: CORE_ACTOR,
      occurredAt,
      payload
    });
  }

  #transition(runId, toStatus, details = {}, correlationId = runId) {
    const run = this.getRun(runId);
    invariant(run, "conversation_run_not_found:" + runId);
    if (run.status === toStatus) return run;
    invariant(!LIVE_CONVERSATION_RUN_TERMINAL.has(run.status), "conversation_run_terminal:" + runId);
    assertConversationRunTransition(run.status, toStatus);
    const occurredAt = this.clock();
    const terminal = LIVE_CONVERSATION_RUN_TERMINAL.has(toStatus);
    const draft = this.#runDraft({
      type: "live.conversation_run.transitioned",
      runId,
      correlationId,
      occurredAt,
      payload: {
        fromStatus: run.status,
        toStatus,
        providerId: details.providerId ?? run.providerId,
        model: details.model ?? run.model,
        failure: details.failure ?? null,
        startedAt: details.startedAt ?? (toStatus === "streaming" ? occurredAt : run.startedAt),
        completedAt: details.completedAt ?? (terminal ? occurredAt : null)
      }
    });
    this.#append([draft]);
    return this.getRun(runId);
  }

  #transitionIfActive(runId, toStatus, details = {}, correlationId = runId) {
    const run = this.getRun(runId);
    if (!run || LIVE_CONVERSATION_RUN_TERMINAL.has(run.status)) return run;
    return this.#transition(runId, toStatus, details, correlationId);
  }

  async startTurn(params = {}, options = {}) {
    await this.ensureReady();
    const idempotencyKey = options.idempotencyKey ?? params.idempotencyKey ?? null;
    if (idempotencyKey && this.inflightIdempotency.has(idempotencyKey)) {
      return this.inflightIdempotency.get(idempotencyKey);
    }
    if (idempotencyKey) {
      const existingRunId = this.store.findIdempotency("live.conversation.turn", idempotencyKey);
      if (existingRunId) {
        const existing = this.getRun(existingRunId);
        invariant(existing, "idempotent_conversation_run_not_found:" + existingRunId);
        return existing;
      }
    }

    const promise = this.#startTurn(params, { ...options, idempotencyKey });
    if (idempotencyKey) this.inflightIdempotency.set(idempotencyKey, promise);
    try {
      return await promise;
    } finally {
      if (idempotencyKey) this.inflightIdempotency.delete(idempotencyKey);
    }
  }

  async #startTurn(params, options) {
    const sessionId = String(params.sessionId || "").trim();
    invariant(sessionId, "session_id_required");
    invariant(this.live.getSession(sessionId), "session_not_found:" + sessionId);

    const resumedFromRunId = params.resumedFromRunId ?? null;
    let humanMessage;
    if (params.humanMessageId) {
      humanMessage = this.live.state.messages.get(params.humanMessageId);
      invariant(humanMessage, "human_message_not_found:" + params.humanMessageId);
      invariant(humanMessage.role === "human", "resume_requires_human_message");
      invariant(humanMessage.sessionId === sessionId, "human_message_session_mismatch");
    } else {
      humanMessage = validateMessage({
        id: params.messageId || this.idGenerator("msg"),
        sessionId,
        role: "human",
        texto: params.texto ?? params.text,
        estado: "awaiting_provider",
        createdAt: this.clock()
      }, new Set(this.live.state.sessions.keys()));
    }

    const runId = params.runId || this.idGenerator("live_run");
    const correlationId = params.correlationId || runId;
    const createdAt = this.clock();
    const run = validateConversationRun({
      id: runId,
      sessionId,
      humanMessageId: humanMessage.id,
      identityId: LIVE_DEFAULT_IDENTITY,
      status: "awaiting_provider",
      accumulatedText: "",
      deltasCount: 0,
      resumedFromRunId,
      createdAt,
      updatedAt: createdAt
    });

    const drafts = [];
    if (!params.humanMessageId) {
      drafts.push(eventDraft({
        type: "live.message.appended",
        aggregateType: "message",
        aggregateId: humanMessage.id,
        correlationId,
        causationId: correlationId,
        actor: HUMAN_ACTOR,
        occurredAt: humanMessage.createdAt,
        payload: {
          sessionId,
          role: "human",
          texto: humanMessage.texto,
          estado: humanMessage.estado,
          createdAt: humanMessage.createdAt
        }
      }));
    }
    drafts.push(this.#runDraft({
      type: "live.conversation_run.created",
      runId,
      correlationId,
      occurredAt: createdAt,
      payload: {
        sessionId,
        humanMessageId: humanMessage.id,
        identityId: LIVE_DEFAULT_IDENTITY,
        status: "awaiting_provider",
        resumedFromRunId,
        createdAt
      }
    }));

    const appendOptions = options.idempotencyKey ? {
      idempotency: {
        scope: "live.conversation.turn",
        key: options.idempotencyKey,
        entityId: runId,
        createdAt
      }
    } : {};
    const initial = this.#appendAtomic(drafts, appendOptions);
    if (initial.duplicate) return this.getRun(initial.entityId);

    let route;
    try {
      route = this.router.resolveRoute({ sessionId, agentId: LIVE_DEFAULT_IDENTITY });
    } catch (error) {
      await options.onEnvelope?.({
        type: "conversation.awaiting_provider",
        run: this.getRun(runId),
        error: errorDescriptor(error)
      });
      return this.getRun(runId);
    }

    const controller = new AbortController();
    this.activeRuns.set(runId, controller);
    this.#transition(runId, "queued", {
      providerId: route.primary.providerId,
      model: route.primary.model
    }, correlationId);
    this.#transition(runId, "streaming", {}, correlationId);
    await options.onEnvelope?.({ type: "conversation.started", run: this.getRun(runId) });

    let routingReceipt = null;
    let completion = null;
    try {
      const session = this.live.getSession(sessionId);
      const memory = this.memoryProvider ? await this.memoryProvider({ sessionId, input: humanMessage.texto }) : null;
      const systemPrompt = this.identityService?.composeSystemPrompt({ session, memory }) ?? null;
      const history = this.live.listMessages(sessionId).map(message => ({
        role: message.role === "human" ? "user" : message.role,
        content: message.texto
      }));
      if (systemPrompt) history.unshift({ role: "system", content: systemPrompt });
      const stream = this.router.stream({
        sessionId,
        agentId: LIVE_DEFAULT_IDENTITY,
        turnId: runId,
        input: { modality: "text", text: humanMessage.texto },
        messages: history,
        signal: controller.signal
      });

      for await (const envelope of stream) {
        if (controller.signal.aborted) {
          const cancelled = new Error("conversation_cancelled");
          cancelled.code = "conversation_cancelled";
          throw cancelled;
        }
        if (envelope.type === "model.delta") {
          const current = this.getRun(runId);
          const occurredAt = this.clock();
          const deltaDraft = this.#runDraft({
            type: "live.conversation_run.delta_appended",
            runId,
            correlationId,
            occurredAt,
            payload: { index: current.deltasCount, text: envelope.text }
          });
          this.#append([deltaDraft]);
          await options.onEnvelope?.({
            type: "conversation.delta",
            runId,
            index: current.deltasCount,
            text: envelope.text,
            accumulatedText: this.getRun(runId).accumulatedText
          });
        } else if (envelope.type === "routing.receipt") {
          routingReceipt = envelope.receipt;
        } else if (envelope.type === "model.completed") {
          completion = envelope;
          routingReceipt = envelope.routingReceipt ?? routingReceipt;
        }
      }

      invariant(completion, "conversation_stream_completed_without_completion");
      const current = this.getRun(runId);
      const finalText = String(completion.text ?? completion.outputText ?? current.accumulatedText).trim();
      invariant(finalText, "assistant_message_empty");
      const assistantMessageId = this.idGenerator("msg");
      const completedAt = this.clock();
      const receipt = {
        status: "completed",
        runId,
        sessionId,
        humanMessageId: humanMessage.id,
        assistantMessageId,
        identityId: LIVE_DEFAULT_IDENTITY,
        providerId: completion.providerId,
        model: completion.model,
        routingReceipt,
        completedAt
      };
      assertNoSecrets(receipt);
      this.router.secretResolver?.assertZeroLeakage(receipt);

      const finalDrafts = [
        eventDraft({
          type: "live.message.appended",
          aggregateType: "message",
          aggregateId: assistantMessageId,
          correlationId,
          causationId: runId,
          actor: LOTUS_ACTOR,
          occurredAt: completedAt,
          payload: {
            sessionId,
            role: "assistant",
            texto: finalText,
            estado: "persisted",
            createdAt: completedAt
          }
        }),
        eventDraft({
          type: "live.message.state_changed",
          aggregateType: "message",
          aggregateId: humanMessage.id,
          correlationId,
          causationId: runId,
          actor: CORE_ACTOR,
          occurredAt: completedAt,
          payload: { estado: "persisted" }
        }),
        this.#runDraft({
          type: "live.conversation_run.receipt_recorded",
          runId,
          correlationId,
          occurredAt: completedAt,
          payload: {
            assistantMessageId,
            providerId: completion.providerId,
            model: completion.model,
            receipt
          }
        }),
        this.#runDraft({
          type: "live.conversation_run.transitioned",
          runId,
          correlationId,
          occurredAt: completedAt,
          payload: {
            fromStatus: current.status,
            toStatus: "completed",
            providerId: completion.providerId,
            model: completion.model,
            completedAt
          }
        })
      ];
      this.#appendAtomic(finalDrafts);
      const completedRun = validateConversationRun(this.getRun(runId));
      await options.onEnvelope?.({ type: "conversation.completed", run: completedRun, receipt });
      return completedRun;
    } catch (error) {
      const current = this.getRun(runId);
      if (!current || LIVE_CONVERSATION_RUN_TERMINAL.has(current.status)) return current;
      const cancelled = controller.signal.aborted || error?.code === "conversation_cancelled" || error?.name === "AbortError";
      const interrupted = !cancelled && (current.deltasCount > 0 || error?.code === "stream_interrupted");
      const status = cancelled ? "cancelled" : (interrupted ? "interrupted" : "failed");
      const terminal = this.#transitionIfActive(runId, status, { failure: errorDescriptor(error) }, correlationId);
      await options.onEnvelope?.({ type: `conversation.${status}`, run: terminal, error: errorDescriptor(error) });
      return terminal;
    } finally {
      this.activeRuns.delete(runId);
    }
  }

  async cancelRun(runId, options = {}) {
    await this.ensureReady();
    const run = this.getRun(runId);
    invariant(run, "conversation_run_not_found:" + runId);
    if (LIVE_CONVERSATION_RUN_TERMINAL.has(run.status)) return run;
    this.activeRuns.get(runId)?.abort(options.reason || "operator_cancelled");
    return this.#transitionIfActive(runId, "cancelled", {
      failure: { code: "conversation_cancelled", message: options.reason || "operator_cancelled" }
    }, options.correlationId || runId);
  }

  async resumeRun(runId, options = {}) {
    await this.ensureReady();
    const prior = this.getRun(runId);
    invariant(prior, "conversation_run_not_found:" + runId);
    invariant(["failed", "cancelled", "interrupted"].includes(prior.status), "conversation_run_not_resumable:" + prior.status);
    return this.startTurn({
      runId: options.runId,
      sessionId: prior.sessionId,
      humanMessageId: prior.humanMessageId,
      resumedFromRunId: prior.id
    }, options);
  }
}
