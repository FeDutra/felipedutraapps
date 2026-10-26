import { invariant, pulsoId } from "../domain/contracts.mjs";

function systemPrompt(blueprint, memories, skills) {
  return [
    `Você é ${blueprint.name}, especialista da constelação PULSO.`,
    `Papel: ${blueprint.role}`,
    `Missão: ${blueprint.mission}`,
    blueprint.instructions,
    skills.length ? `Habilidades ativas: ${skills.map(item => item.name).join(", ")}` : "",
    memories.length ? `Memória pertinente com proveniência:\n${memories.map(item => `- [${item.memoryId}] ${item.content}`).join("\n")}` : "",
    "Produza um resultado finito, declare limites e devolva artefatos/decisões ao integrador.",
  ].filter(Boolean).join("\n\n");
}

export class AgentExecutionService {
  constructor({ foundry, runtime, memory = null, skills = null, clock = () => new Date().toISOString() } = {}) {
    invariant(foundry, "agent_foundry_required"); invariant(runtime, "runtime_required");
    this.foundry = foundry; this.runtime = runtime; this.memory = memory; this.skills = skills; this.clock = clock; this.aborters = new Map();
  }

  async execute(input = {}) {
    const agentId = String(input.agentId || ""); invariant(agentId, "agent_id_required"); const prompt = String(input.prompt || input.objective || "").trim(); invariant(prompt, "agent_prompt_required");
    let instance = this.foundry.get("agent", agentId); invariant(instance, `agent_not_found:${agentId}`);
    if (instance.status === "paused" && input.activate !== false) { await this.foundry.resumeAgent(agentId, { idempotencyKey: input.idempotencyKey ? `${input.idempotencyKey}:resume` : null }); instance = this.foundry.get("agent", agentId); }
    invariant(instance.status === "active", `agent_not_active:${instance.status}`);
    const blueprint = this.foundry.get("blueprint", instance.blueprintId); invariant(blueprint, `blueprint_not_found:${instance.blueprintId}`);
    const runId = input.runId || pulsoId("agtrun"); const budget = input.budget || instance.limits || blueprint.limits;
    const started = await this.foundry.startAgentRun({ agentRunId: runId, agentId, delegationId: input.delegationId || null, parentRunId: input.parentRunId || null, budget, createdAt: this.clock() }, { idempotencyKey: input.idempotencyKey || null });
    const controller = new AbortController();
    const abortFromParent = () => controller.abort(input.signal?.reason || "parent_cancelled");
    if (input.signal?.aborted) abortFromParent();
    else input.signal?.addEventListener?.("abort", abortFromParent, { once: true });
    this.aborters.set(runId, controller); const startedMs = Date.now();
    try {
      const memories = this.memory ? [
        ...this.memory.search({ query: prompt, scopeType: "agent", scopeId: agentId, limit: 6 }).results,
        ...this.memory.search({ query: prompt, scopeType: "global", limit: 4 }).results,
      ].filter((item, index, all) => all.findIndex(other => other.memoryId === item.memoryId) === index).slice(0, 8) : [];
      const skills = this.skills ? this.skills.list({ enabled: true }).filter(item => blueprint.skills.some(name => item.skillId.includes(name) || item.name.toLowerCase().includes(String(name).toLowerCase()))) : [];
      await this.foundry.recordCheckpoint({ runId, step: 1, data: { phase: "context_ready", memories: memories.map(item => item.memoryId), skills: skills.map(item => item.skillId) }, usageDelta: { turns: 0, tokens: 0, cost: 0, elapsedMs: Date.now() - startedMs, toolCalls: 0 } });
      const completion = await this.runtime.routeCompletion({ agentId, taskId: input.taskId || runId, sessionId: input.sessionId || null, prompt, systemPrompt: systemPrompt(blueprint, memories, skills), signal: controller.signal }, { agentId, allowFallback: input.allowFallback !== false });
      const usage = { turns: 1, tokens: Number(completion.usage?.totalTokens || 0), cost: 0, elapsedMs: Date.now() - startedMs, toolCalls: Number(completion.usage?.toolCalls || 0) };
      const completed = await this.foundry.completeAgentRun({ runId, result: { text: completion.text, providerId: completion.providerId, model: completion.model, routingReceipt: completion.routingReceipt || null }, artifactRefs: input.artifactRefs || [], usageDelta: usage });
      return { run: completed.run, output: completion.text, providerId: completion.providerId, model: completion.model, routingReceipt: completion.routingReceipt || null };
    } catch (error) {
      if (controller.signal.aborted || error?.name === "AbortError" || error?.code === "conversation_cancelled") {
        const cancelled = await this.foundry.cancelAgentRun(runId, {
          reason: String(controller.signal.reason || error?.message || "parent_cancelled"),
        }).catch(() => null);
        error.run = cancelled?.run || started.run;
        throw error;
      }
      const failed = await this.foundry.failAgentRun({ runId, error: { code: error?.code || "AGENT_EXECUTION_FAILED", message: error?.message || String(error) }, usageDelta: { turns: 1, tokens: 0, cost: 0, elapsedMs: Date.now() - startedMs, toolCalls: 0 } }).catch(() => null);
      error.run = failed?.run || started.run; throw error;
    } finally { input.signal?.removeEventListener?.("abort", abortFromParent); this.aborters.delete(runId); }
  }

  async cancel(runId, reason = "user_requested") { this.aborters.get(runId)?.abort(); return this.foundry.cancelAgentRun(runId, { reason }); }

  async delegate(input = {}) {
    const created = await this.foundry.createDelegation(input, { idempotencyKey: input.idempotencyKey || null });
    await this.foundry.acceptDelegation(created.delegation.delegationId, { idempotencyKey: input.idempotencyKey ? `${input.idempotencyKey}:accept` : null });
    return this.execute({ agentId: input.childAgentId, prompt: input.objective, delegationId: created.delegation.delegationId, parentRunId: input.parentRunId || null, sessionId: input.sessionId || null, budget: input.budget, activate: true });
  }
}
