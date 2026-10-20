import { invariant } from "../domain/assertions.mjs";
import { normalizeUsageDelta } from "./agent-contracts.mjs";

function capabilityMatches(grantCap, requestedCap) {
  if (!grantCap || !requestedCap) return false;
  if (grantCap === "*" || grantCap === requestedCap) return true;
  if (grantCap.endsWith("*")) {
    return requestedCap.startsWith(grantCap.slice(0, -1));
  }
  return false;
}

function isGrantExpired(grant, nowIso) {
  if (grant.expiresAt === null || grant.expiresAt === undefined) {
    return false;
  }
  const expiresMs = Date.parse(grant.expiresAt);
  const nowMs = Date.parse(nowIso);
  if (Number.isNaN(expiresMs) || Number.isNaN(nowMs)) {
    return true;
  }
  return nowMs >= expiresMs;
}

function matchesGrantScope(grantScope, context = {}) {
  const gType = grantScope?.type ?? "global";
  const gId = grantScope?.scopeId ?? null;

  if (gType === "global") {
    if (gId === null || gId === "*") return true;
    const reqId = context?.scope?.scopeId ?? context?.scopeId ?? null;
    return reqId === gId;
  }

  const reqScopeObj = context?.scope && typeof context.scope === "object" ? context.scope : null;
  const reqType = reqScopeObj?.type ?? context?.scopeType ?? context?.type ?? null;
  const reqId = reqScopeObj?.scopeId ?? context?.scopeId ?? null;

  if (reqType === gType) {
    if (gId === null || gId === "*") return true;
    return reqId === gId;
  }

  if (gType === "workspace" && context?.workspaceId !== undefined) {
    return gId === null || gId === "*" || context.workspaceId === gId;
  }
  if (gType === "session" && context?.sessionId !== undefined) {
    return gId === null || gId === "*" || context.sessionId === gId;
  }
  if (gType === "task" && context?.taskId !== undefined) {
    return gId === null || gId === "*" || context.taskId === gId;
  }

  return false;
}

export class AgentSupervisor {
  constructor({
    state,
    foundry = null,
    globalMaxConcurrency = 5,
    clock = () => new Date().toISOString()
  } = {}) {
    this.state = state;
    this.foundry = foundry;
    this.globalMaxConcurrency = globalMaxConcurrency;
    this.clock = clock;
  }

  _now(overrideNow = null) {
    if (overrideNow) return overrideNow;
    return typeof this.clock === "function" ? this.clock() : this.clock.now();
  }

  _getGrantsForAgent(agentId) {
    const grantsMap = this.state.agentGrants?.get(agentId);
    if (grantsMap && grantsMap.size > 0) {
      return Array.from(grantsMap.values());
    }
    if (this.state.grants && this.state.grants.size > 0) {
      return Array.from(this.state.grants.values()).filter(g => g.agentId === agentId);
    }
    return [];
  }

  /**
   * Fail-closed capability and tool authorization check.
   * Evaluates expiresAt and scope across multiple grants, with explicit deny taking precedence over allow.
   */
  checkAuthorization(agentId, toolOrCapability, context = {}) {
    invariant(agentId, "agent_id_required");
    invariant(toolOrCapability, "tool_or_capability_required");

    const inst = this.state.instances.get(agentId);
    if (!inst) {
      throw new Error(`authorization_denied: agent_not_found:${agentId}`);
    }

    if (inst.status !== "active") {
      throw new Error(`authorization_denied: agent_not_active:${inst.status}`);
    }

    const agentGrants = this._getGrantsForAgent(agentId);
    if (agentGrants.length === 0) {
      throw new Error(`authorization_denied: tool_not_granted:${toolOrCapability}`);
    }

    const nowIso = this._now(context?.now ?? context?.timestamp ?? null);
    const matchingCapGrants = agentGrants.filter(g => capabilityMatches(g.capability, toolOrCapability));

    if (matchingCapGrants.length === 0) {
      throw new Error(`authorization_denied: tool_not_granted:${toolOrCapability}`);
    }

    const activeScopedGrants = [];
    let sawExpiredAllow = false;
    let sawScopeMismatchAllow = false;

    for (const grant of matchingCapGrants) {
      const expired = isGrantExpired(grant, nowIso);
      const scopeMatches = matchesGrantScope(grant.scope, context);

      if (expired) {
        if (grant.effect === "allow" && scopeMatches) {
          sawExpiredAllow = true;
        }
        continue;
      }

      if (!scopeMatches) {
        if (grant.effect === "allow") {
          sawScopeMismatchAllow = true;
        }
        continue;
      }

      activeScopedGrants.push(grant);
    }

    // 1. Explicit deny always takes precedence over allow
    for (const grant of activeScopedGrants) {
      if (grant.effect === "deny") {
        throw new Error(`authorization_denied: explicitly_denied:${toolOrCapability}`);
      }
    }

    // 2. Check for explicit allow grant
    const matchedAllow = activeScopedGrants.find(g => g.effect === "allow");
    if (matchedAllow) {
      return {
        authorized: true,
        agentId,
        toolOrCapability,
        grantId: matchedAllow.grantId,
        scope: matchedAllow.scope
      };
    }

    if (sawExpiredAllow) {
      throw new Error(`authorization_denied: grant_expired:${toolOrCapability}`);
    }
    if (sawScopeMismatchAllow) {
      throw new Error(`authorization_denied: scope_mismatch:${toolOrCapability}`);
    }

    throw new Error(`authorization_denied: tool_not_granted:${toolOrCapability}`);
  }

  /**
   * Deterministic concurrency check.
   */
  checkConcurrency(agentId) {
    invariant(agentId, "agent_id_required");
    const inst = this.state.instances.get(agentId);
    if (!inst) {
      throw new Error(`agent_not_found:${agentId}`);
    }

    const activeRuns = this.state.metrics.activeRuns;
    if (this.globalMaxConcurrency !== undefined && this.globalMaxConcurrency !== null && activeRuns >= this.globalMaxConcurrency) {
      throw new Error(`concurrency_limit_exceeded: global limit reached (${activeRuns}/${this.globalMaxConcurrency})`);
    }

    const limit = inst.limits?.maxConcurrency ?? inst.concurrency?.limit ?? 2;
    const current = inst.concurrency?.current ?? 0;
    if (current >= limit) {
      throw new Error(`concurrency_limit_exceeded: agent '${agentId}' limit reached (${current}/${limit})`);
    }

    return { allowed: true, globalActive: activeRuns, agentActive: current };
  }

  /**
   * Cumulative budget enforcement before and during runs.
   * Handles zero limits via explicit undefined/null checks.
   */
  checkBudget(runId, deltaInput = {}) {
    invariant(runId, "run_id_required");
    const run = this.state.runs.get(runId);
    if (!run) {
      throw new Error(`run_not_found:${runId}`);
    }

    const budget = run.budget ?? {};
    const usage = run.usage ?? { turns: 0, tokens: 0, cost: 0, elapsedMs: 0, toolCalls: 0 };
    const delta = normalizeUsageDelta(deltaInput) || {
      turns: 0,
      tokens: 0,
      cost: 0,
      elapsedMs: 0,
      toolCalls: 0
    };

    const projectedTurns = (usage.turns ?? 0) + delta.turns;
    const projectedTokens = (usage.tokens ?? 0) + delta.tokens;
    const projectedCost = Number(((usage.cost ?? 0) + delta.cost).toFixed(6));
    const projectedTime = (usage.elapsedMs ?? 0) + delta.elapsedMs;
    const projectedToolCalls = (usage.toolCalls ?? 0) + delta.toolCalls;

    if (budget.maxTurns !== undefined && budget.maxTurns !== null && projectedTurns > budget.maxTurns) {
      throw new Error(`budget_exceeded: max_turns_exceeded (${projectedTurns} > ${budget.maxTurns})`);
    }
    if (budget.maxTokens !== undefined && budget.maxTokens !== null && projectedTokens > budget.maxTokens) {
      throw new Error(`budget_exceeded: max_tokens_exceeded (${projectedTokens} > ${budget.maxTokens})`);
    }
    if (budget.maxCost !== undefined && budget.maxCost !== null && projectedCost > budget.maxCost) {
      throw new Error(`budget_exceeded: max_cost_exceeded (${projectedCost} > ${budget.maxCost})`);
    }
    if (budget.maxTimeMs !== undefined && budget.maxTimeMs !== null && projectedTime > budget.maxTimeMs) {
      throw new Error(`budget_exceeded: max_time_exceeded (${projectedTime} > ${budget.maxTimeMs})`);
    }
    if (budget.maxToolCalls !== undefined && budget.maxToolCalls !== null && projectedToolCalls > budget.maxToolCalls) {
      throw new Error(`budget_exceeded: max_tool_calls_exceeded (${projectedToolCalls} > ${budget.maxToolCalls})`);
    }

    return {
      ok: true,
      usageDelta: delta,
      projectedUsage: {
        turns: projectedTurns,
        tokens: projectedTokens,
        cost: projectedCost,
        elapsedMs: projectedTime,
        toolCalls: projectedToolCalls
      }
    };
  }

  /**
   * Propagates cancellation from parent run to all child runs.
   */
  async propagateCancellation(parentRunId, reason = "parent_cancelled") {
    invariant(parentRunId, "parent_run_id_required");
    const cancelledChildren = [];

    for (const [childRunId, run] of this.state.runs.entries()) {
      if (run.parentRunId === parentRunId && run.status === "running") {
        let shouldCancel = true;
        if (run.delegationId) {
          const del = this.state.delegations.get(run.delegationId);
          if (del && del.cancellationPolicy?.propagateToChild === false) {
            shouldCancel = false;
          }
        }
        if (shouldCancel && this.foundry) {
          const res = await this.foundry.cancelAgentRun(childRunId, { reason });
          cancelledChildren.push(res);
        }
      }
    }

    return cancelledChildren;
  }
}
