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

function normalizeSpecialistOutput(output, agentName) {
  const text = String(output || "").trim();
  const escapedName = String(agentName || "")
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const redundantIdentity = new RegExp(
    `^(?:\\*\\*)?(?:${escapedName}|L[oó]tus|Assistente|Assistant)(?:\\s*:\\s*)?(?:\\*\\*)?\\s*:?\\s*`,
    "iu"
  );
  return text.replace(redundantIdentity, "").trim();
}

export class LiveConversationService {
  constructor({ store, live, router, identityService = null, connectionRegistry = null, memoryProvider = null, memoryRecorder = null, agentExecutor = null, agentFoundry = null, clock = () => new Date().toISOString(), idGenerator = pulsoId } = {}) {
    invariant(store, "event_store_required");
    invariant(live, "live_service_required");
    invariant(router, "provider_router_required");
    this.store = store;
    this.live = live;
    this.router = router;
    this.identityService = identityService;
    this.connectionRegistry = connectionRegistry;
    this.memoryProvider = memoryProvider;
    this.memoryRecorder = memoryRecorder;
    this.agentExecutor = agentExecutor;
    this.agentFoundry = agentFoundry;
    this.clock = clock;
    this.idGenerator = idGenerator;
    this.activeRuns = new Map();
    this.inflightIdempotency = new Map();
  }

  async #recordExplicitMemory({ sessionId, humanText, assistantText }) {
    if (!this.memoryRecorder || !/(?:\blembre\b|\bnão esqueça\b|\bregistre\b|\bdecid(?:i|imos|ido)\b|\bfica decidido\b)/iu.test(String(humanText || ""))) return null;
    const title = String(humanText || "Memória da conversa").replace(/\s+/g, " ").trim().slice(0, 120);
    const content = `Fe: ${String(humanText || "").trim()}\n\nResposta: ${String(assistantText || "").trim()}`.slice(0, 12000);
    return await this.memoryRecorder({ title, content, tags: ["conversa", sessionId], source: { kind: "live-session", sessionId } });
  }

  #agentDirectory() {
    if (!this.agentFoundry) return [];
    return this.agentFoundry.list("agents").map(instance => {
      const blueprint = this.agentFoundry.get("blueprint", instance.blueprintId);
      return { instance, blueprint, aliases: [instance.agentId, String(instance.agentId).replace(/^agent_/, ""), blueprint?.name].filter(Boolean) };
    });
  }

  #normalizeMention(value) {
    return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
  }

  #resolveAgents(text, explicitAgentIds = [], session = null) {
    if (!this.agentFoundry) return [];
    const directory = this.#agentDirectory();
    const resolve = value => {
      const needle = this.#normalizeMention(value);
      return directory.find(item => item.aliases.some(alias => this.#normalizeMention(alias) === needle))?.instance.agentId || null;
    };
    const candidates = Array.isArray(explicitAgentIds) ? [...explicitAgentIds] : [];
    const mentions = String(text || "").matchAll(/@([\p{L}\p{N}._-]+)/gu);
    for (const mention of mentions) candidates.push(mention[1]);
    if (candidates.length === 0 && Array.isArray(session?.participantAgentIds)) candidates.push(...session.participantAgentIds);
    if (candidates.length === 0) {
      const bound = this.#resolveSessionAgent(session);
      if (bound) candidates.push(bound);
    }
    const resolved = [];
    for (const candidate of candidates) {
      const agentId = this.agentFoundry.get("agent", candidate) ? candidate : resolve(candidate);
      if (agentId && !resolved.includes(agentId)) resolved.push(agentId);
    }
    return resolved;
  }

  #resolveSessionAgent(session) {
    if (!this.agentFoundry || !session) return null;
    if (session.agentId && this.agentFoundry.get("agent", session.agentId)) return session.agentId;
    const title = String(session.titulo || "").trim().toLocaleLowerCase("pt-BR");
    if (!title) return null;
    for (const instance of this.agentFoundry.list("agents")) {
      const blueprint = this.agentFoundry.get("blueprint", instance.blueprintId);
      if (String(blueprint?.name || "").trim().toLocaleLowerCase("pt-BR") === title) return instance.agentId;
    }
    return null;
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

  async #progress(runId, correlationId, details, onEnvelope) {
    const occurredAt = this.clock();
    const payload = {
      phase: String(details.phase || "execution"),
      label: String(details.label || "execução em andamento").slice(0, 240),
      status: details.status || "running",
      agentId: details.agentId || null,
    };
    this.#append([this.#runDraft({
      type: "live.conversation_run.progressed",
      runId,
      correlationId,
      occurredAt,
      payload,
    })]);
    await onEnvelope?.({ type: "conversation.progress", runId, ...payload, occurredAt });
  }

  async #recordToolEnvelope(runId, correlationId, envelope, onEnvelope) {
    const occurredAt = this.clock();
    const isApproval = envelope.type.startsWith("tool.approval.");
    const payload = structuredClone(envelope.receipt || {});
    this.#append([this.#runDraft({
      type: isApproval ? "live.tool_approval.recorded" : "live.tool_execution.recorded",
      runId,
      correlationId,
      occurredAt,
      payload,
    })]);
    const label = isApproval
      ? (payload.status === "pending" ? `decisão necessária · ${payload.risk || "ferramenta"}` : `decisão ${payload.status || "registrada"}`)
      : `${payload.source || "ferramenta"} · ${payload.tool || payload.action || "execução"} ${envelope.type.endsWith("completed") ? "concluída" : "em execução"}`;
    await this.#progress(runId, correlationId, {
      phase: isApproval ? "approval" : "tool",
      label,
      status: payload.status === "declined" || payload.success === false ? "failed" : (envelope.type.endsWith("completed") ? "completed" : "running"),
    }, onEnvelope);
    await onEnvelope?.({ type: envelope.type, runId, receipt: payload, occurredAt });
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
    const session = this.live.getSession(sessionId);
    const specialistAgentIds = this.#resolveAgents(
      humanMessage.texto,
      params.agentIds || (params.agentId ? [params.agentId] : []),
      session
    );
    const correlationId = params.correlationId || runId;
    const createdAt = this.clock();
    const run = validateConversationRun({
      id: runId,
      sessionId,
      humanMessageId: humanMessage.id,
      identityId: LIVE_DEFAULT_IDENTITY,
      agentIds: specialistAgentIds,
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
        agentIds: specialistAgentIds,
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
    await this.#progress(runId, correlationId, {
      phase: "planning",
      label: specialistAgentIds.length > 1 ? `coordenando ${specialistAgentIds.length} agentes` : "preparando contexto",
      status: "running",
    }, options.onEnvelope);

    let routingReceipt = null;
    let completion = null;
    try {
      const memory = this.memoryProvider ? await this.memoryProvider({ sessionId, input: humanMessage.texto }) : null;
      const identityPrompt = this.identityService?.composeSystemPrompt({ session, memory }) ?? null;
      const connectionScope = {
        taskId: runId,
        agentId: LIVE_DEFAULT_IDENTITY,
        areaId: session.areaId,
      };
      const connectionPrompt = this.connectionRegistry?.promptContext(connectionScope) || null;
      const systemPrompt = [identityPrompt, connectionPrompt].filter(Boolean).join("\n\n") || null;
      const history = this.live.listMessages(sessionId).map(message => ({
        role: message.role === "human" ? "user" : message.role,
        content: message.texto
      }));
      if (systemPrompt) history.unshift({ role: "system", content: systemPrompt });
      const stream = specialistAgentIds.length > 0 && this.agentExecutor
        ? null
        : this.router.stream({
        sessionId,
        agentId: LIVE_DEFAULT_IDENTITY,
        turnId: runId,
        input: { modality: "text", text: humanMessage.texto },
        messages: history,
        signal: controller.signal,
        authorizeTool: input => this.connectionRegistry?.authorizeTool(input, connectionScope),
      });

      if (specialistAgentIds.length > 0 && this.agentExecutor) {
        const objective = humanMessage.texto.replace(/@[\p{L}\p{N}._-]+\s*/gu, "").trim() || humanMessage.texto;
        const executions = await Promise.allSettled(specialistAgentIds.map(async specialistAgentId => {
          const instance = this.agentFoundry.get("agent", specialistAgentId);
          const blueprint = instance ? this.agentFoundry.get("blueprint", instance.blueprintId) : null;
          const agentName = blueprint?.name || specialistAgentId;
          await this.#progress(runId, correlationId, { phase: "execution", label: `${agentName} trabalhando`, status: "running", agentId: specialistAgentId }, options.onEnvelope);
          const specialist = await this.agentExecutor.execute({
            agentId: specialistAgentId,
            prompt: objective,
            sessionId,
            areaId: session.areaId,
            parentRunId: runId,
            activate: true,
            signal: controller.signal,
            onEnvelope: async envelope => {
              if (envelope.type?.startsWith("tool.")) {
                await this.#recordToolEnvelope(runId, correlationId, {
                  ...envelope,
                  receipt: { ...(envelope.receipt || {}), agentId: specialistAgentId },
                }, options.onEnvelope);
              }
            },
          });
          if (controller.signal.aborted) {
            const error = new Error("conversation_cancelled");
            error.code = "conversation_cancelled";
            throw error;
          }
          const specialistOutput = normalizeSpecialistOutput(specialist.output, agentName);
          invariant(specialistOutput, "specialist_output_empty");
          const attributedText = `**${agentName}**\n\n${specialistOutput}`;
          const current = this.getRun(runId);
          this.#append([this.#runDraft({ type: "live.conversation_run.delta_appended", runId, correlationId, occurredAt: this.clock(), payload: { index: current.deltasCount, text: `${current.deltasCount ? "\n\n" : ""}${attributedText}` } })]);
          await options.onEnvelope?.({ type: "conversation.delta", runId, index: current.deltasCount, text: attributedText, accumulatedText: this.getRun(runId).accumulatedText, agentId: specialistAgentId });
          await this.#progress(runId, correlationId, { phase: "execution", label: `${agentName} concluiu`, status: "completed", agentId: specialistAgentId }, options.onEnvelope);
          return { text: attributedText, outputText: attributedText, providerId: specialist.providerId, model: specialist.model, agentId: specialistAgentId, agentRunId: specialist.run.agentRunId };
        }));
        const responses = [];
        const failures = [];
        executions.forEach((result, index) => {
          if (result.status === "fulfilled") responses.push(result.value);
          else failures.push({ agentId: specialistAgentIds[index], error: errorDescriptor(result.reason) });
        });
        if (controller.signal.aborted) {
          const error = new Error("conversation_cancelled");
          error.code = "conversation_cancelled";
          throw error;
        }
        invariant(responses.length > 0, failures[0]?.error?.message || "all_agent_executions_failed");
        completion = { type: "model.completed", text: this.getRun(runId).accumulatedText, outputText: this.getRun(runId).accumulatedText, providerId: responses[0].providerId, model: responses[0].model, responses, failures };
      }

      for await (const envelope of stream || []) {
        if (controller.signal.aborted) {
          const cancelled = new Error("conversation_cancelled");
          cancelled.code = "conversation_cancelled";
          throw cancelled;
        }
        if (envelope.type.startsWith("tool.")) {
          await this.#recordToolEnvelope(runId, correlationId, envelope, options.onEnvelope);
        } else if (envelope.type === "model.delta") {
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
      const responses = completion.responses?.length ? completion.responses : [{ text: finalText, agentId: completion.agentId || null, agentRunId: completion.agentRunId || null }];
      const assistantMessages = responses.map(response => ({ id: this.idGenerator("msg"), text: String(response.text || "").trim(), agentId: response.agentId || null }));
      const assistantMessageId = assistantMessages[0].id;
      const completedAt = this.clock();
      const receipt = {
        status: "completed",
        runId,
        sessionId,
        humanMessageId: humanMessage.id,
        assistantMessageId,
        assistantMessageIds: assistantMessages.map(message => message.id),
        identityId: LIVE_DEFAULT_IDENTITY,
        providerId: completion.providerId,
        model: completion.model,
        routingReceipt,
        agentIds: specialistAgentIds,
        agentId: completion.agentId || specialistAgentIds[0] || LIVE_DEFAULT_IDENTITY,
        agentRunId: completion.agentRunId || responses[0]?.agentRunId || null,
        failures: completion.failures || [],
        completedAt
      };
      assertNoSecrets(receipt);
      this.router.secretResolver?.assertZeroLeakage(receipt);

      const finalDrafts = [
        ...assistantMessages.map(message => eventDraft({
          type: "live.message.appended",
          aggregateType: "message",
          aggregateId: message.id,
          correlationId,
          causationId: runId,
          actor: LOTUS_ACTOR,
          occurredAt: completedAt,
          payload: {
            sessionId,
            role: "assistant",
            texto: message.text,
            estado: "persisted",
            agentId: message.agentId,
            createdAt: completedAt
          }
        })),
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
      await this.#progress(runId, correlationId, { phase: "delivery", label: "respostas entregues na sessão", status: "completed" }, options.onEnvelope);
      this.#appendAtomic(finalDrafts);
      await this.#recordExplicitMemory({ sessionId, humanText: humanMessage.texto, assistantText: finalText }).catch(() => null);
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
    const reason = options.reason || "operator_cancelled";
    this.activeRuns.get(runId)?.abort(reason);
    const cancelled = this.#transitionIfActive(runId, "cancelled", {
      failure: { code: "conversation_cancelled", message: options.reason || "operator_cancelled" }
    }, options.correlationId || runId);
    const cancellationMessageId = `msg_cancel_${runId}`;
    if (!this.live.state.messages.has(cancellationMessageId)) {
      const occurredAt = this.clock();
      this.#appendAtomic([
        eventDraft({
          type: "live.message.appended",
          aggregateType: "message",
          aggregateId: cancellationMessageId,
          correlationId: options.correlationId || runId,
          causationId: runId,
          actor: CORE_ACTOR,
          occurredAt,
          payload: {
            sessionId: run.sessionId,
            role: "system",
            texto: "execução interrompida. ajuste a direção e envie novamente quando quiser.",
            estado: "persisted",
            createdAt: occurredAt,
          },
        }),
        eventDraft({
          type: "live.message.state_changed",
          aggregateType: "message",
          aggregateId: run.humanMessageId,
          correlationId: options.correlationId || runId,
          causationId: runId,
          actor: CORE_ACTOR,
          occurredAt,
          payload: { estado: "persisted" },
        }),
      ]);
    }
    return cancelled;
  }

  async resolveToolApproval(runId, approvalId, { decision = "decline", answers = null } = {}) {
    await this.ensureReady();
    const run = this.getRun(runId);
    invariant(run, "conversation_run_not_found:" + runId);
    const approval = (run.toolApprovals || []).find(item => item.approvalId === approvalId);
    const adapter = this.router.getAdapter(approval?.providerId || run.providerId);
    invariant(adapter?.client && typeof adapter.client.resolveApproval === "function", "provider_tool_approval_unavailable");
    return adapter.client.resolveApproval(approvalId, { decision, answers });
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
