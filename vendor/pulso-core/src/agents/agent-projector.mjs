import {
  deepClone,
  deepCloneAndFreeze
} from "./agent-contracts.mjs";

function accumulateRunUsage(currentUsage, delta) {
  const cur = currentUsage ?? { turns: 0, tokens: 0, cost: 0, elapsedMs: 0, toolCalls: 0 };
  if (!delta) {
    return {
      turns: cur.turns ?? 0,
      tokens: cur.tokens ?? 0,
      cost: cur.cost ?? 0,
      elapsedMs: cur.elapsedMs ?? 0,
      toolCalls: cur.toolCalls ?? 0
    };
  }
  return {
    turns: (cur.turns ?? 0) + (delta.turns ?? 0),
    tokens: (cur.tokens ?? 0) + (delta.tokens ?? 0),
    cost: Number(((cur.cost ?? 0) + (delta.cost ?? 0)).toFixed(6)),
    elapsedMs: (cur.elapsedMs ?? 0) + (delta.elapsedMs ?? delta.timeMs ?? 0),
    toolCalls: (cur.toolCalls ?? 0) + (delta.toolCalls ?? delta.tools ?? 0)
  };
}

export function emptyAgentFoundryState() {
  return {
    blueprints: new Map(),
    revisions: new Map(), // key: revisionId
    revisionsByBlueprint: new Map(), // key: blueprintId -> array of revisions
    instances: new Map(), // key: agentId
    grants: new Map(), // key: grantId
    agentGrants: new Map(), // key: agentId -> Map(grantId -> grant)
    delegations: new Map(), // key: delegationId
    runs: new Map(), // key: runId
    metrics: {
      totalEvents: 0,
      totalBlueprints: 0,
      totalRevisions: 0,
      totalInstances: 0,
      totalDelegations: 0,
      totalRuns: 0,
      activeRuns: 0,
      completedRuns: 0,
      failedRuns: 0,
      cancelledRuns: 0
    }
  };
}

export function applyAgentFoundryEvent(state, event) {
  state.metrics.totalEvents++;
  const p = event.payload;

  switch (event.type) {
    case "agent_foundry.blueprint_created": {
      state.blueprints.set(p.blueprintId, deepCloneAndFreeze(p));
      state.metrics.totalBlueprints = state.blueprints.size;
      break;
    }

    case "agent_foundry.blueprint_revised": {
      state.blueprints.set(p.blueprintId, deepCloneAndFreeze(p));
      break;
    }

    case "agent_foundry.revision_created": {
      const frozenRev = deepCloneAndFreeze(p);
      state.revisions.set(p.revisionId, frozenRev);
      if (!state.revisionsByBlueprint.has(p.blueprintId)) {
        state.revisionsByBlueprint.set(p.blueprintId, []);
      }
      state.revisionsByBlueprint.get(p.blueprintId).push(frozenRev);
      state.metrics.totalRevisions = state.revisions.size;
      break;
    }

    case "agent_foundry.agent_materialized": {
      state.instances.set(p.agentId, deepClone(p));
      state.metrics.totalInstances = state.instances.size;
      break;
    }

    case "agent_foundry.agent_activated": {
      const inst = state.instances.get(p.agentId);
      if (inst) {
        inst.status = "active";
        inst.updatedAt = event.occurredAt;
      }
      break;
    }

    case "agent_foundry.agent_paused": {
      const inst = state.instances.get(p.agentId);
      if (inst) {
        inst.status = "paused";
        inst.metadata.pauseReason = p.reason ?? "user_requested";
        inst.updatedAt = event.occurredAt;
      }
      break;
    }

    case "agent_foundry.agent_resumed": {
      const inst = state.instances.get(p.agentId);
      if (inst) {
        inst.status = "active";
        delete inst.metadata.pauseReason;
        inst.updatedAt = event.occurredAt;
      }
      break;
    }

    case "agent_foundry.agent_draining": {
      const inst = state.instances.get(p.agentId);
      if (inst) {
        inst.status = "draining";
        inst.updatedAt = event.occurredAt;
      }
      break;
    }

    case "agent_foundry.agent_retired": {
      const inst = state.instances.get(p.agentId);
      if (inst) {
        inst.status = "retired";
        inst.metadata.retirementReason = p.reason ?? "user_requested";
        inst.updatedAt = event.occurredAt;
      }
      break;
    }

    case "agent_foundry.capability_granted": {
      const grantCopy = deepClone(p);
      state.grants.set(p.grantId, grantCopy);
      if (!state.agentGrants.has(p.agentId)) {
        state.agentGrants.set(p.agentId, new Map());
      }
      state.agentGrants.get(p.agentId).set(p.grantId, deepClone(p));
      break;
    }

    case "agent_foundry.capability_revoked": {
      const grant = p.grantId ? state.grants.get(p.grantId) : null;
      if (grant) {
        state.grants.delete(p.grantId);
        const map = state.agentGrants.get(grant.agentId);
        if (map) {
          map.delete(p.grantId);
        }
      } else if (p.agentId && p.capability) {
        const map = state.agentGrants.get(p.agentId);
        if (map) {
          for (const [gId, g] of map.entries()) {
            const scopeMatches = !p.scope || (
              g.scope?.type === p.scope.type &&
              (g.scope?.scopeId ?? null) === (p.scope.scopeId ?? null)
            );
            if (g.capability === p.capability && scopeMatches) {
              map.delete(gId);
              state.grants.delete(gId);
            }
          }
        }
      }
      break;
    }

    case "agent_foundry.provider_model_bound": {
      const inst = state.instances.get(p.agentId);
      if (inst) {
        inst.resolvedBindings.model = {
          providerId: p.providerId,
          model: p.model
        };
        inst.updatedAt = event.occurredAt;
      }
      break;
    }

    case "agent_foundry.runtime_executor_bound": {
      const inst = state.instances.get(p.agentId);
      if (inst) {
        inst.resolvedBindings.runtime = {
          providerId: p.providerId,
          executorType: p.executorType
        };
        inst.updatedAt = event.occurredAt;
      }
      break;
    }

    case "agent_foundry.delegation_created": {
      state.delegations.set(p.delegationId, deepClone(p));
      state.metrics.totalDelegations = state.delegations.size;
      break;
    }

    case "agent_foundry.delegation_accepted": {
      const del = state.delegations.get(p.delegationId);
      if (del) {
        del.status = "accepted";
        del.provenance.decidedAt = event.occurredAt;
      }
      break;
    }

    case "agent_foundry.delegation_rejected": {
      const del = state.delegations.get(p.delegationId);
      if (del) {
        del.status = "rejected";
        del.provenance.decidedAt = event.occurredAt;
        del.receipt = { rejected: true, reason: p.reason ?? "rejected" };
      }
      break;
    }

    case "agent_foundry.run_started": {
      const runCopy = deepClone(p);
      runCopy.status = "running";
      runCopy.startedAt = event.occurredAt;
      runCopy.usage = accumulateRunUsage(runCopy.usage, null);
      state.runs.set(p.agentRunId, runCopy);
      state.metrics.totalRuns++;
      state.metrics.activeRuns++;

      const inst = state.instances.get(p.agentId);
      if (inst) {
        inst.concurrency.current++;
      }

      if (p.delegationId) {
        const del = state.delegations.get(p.delegationId);
        if (del) del.status = "running";
      }
      break;
    }

    case "agent_foundry.run_checkpointed": {
      const run = state.runs.get(p.runId);
      if (run) {
        const delta = p.usageDelta ?? p.usage ?? null;
        if (delta) {
          run.usage = accumulateRunUsage(run.usage, delta);
        }
        run.checkpoints.push({
          checkpointId: p.checkpointId,
          step: p.step,
          data: p.data ? deepClone(p.data) : null,
          usageDelta: delta ? deepClone(delta) : null,
          cumulativeUsage: deepClone(run.usage),
          timestamp: event.occurredAt
        });
      }
      break;
    }

    case "agent_foundry.run_completed": {
      const run = state.runs.get(p.runId);
      if (run) {
        run.status = "succeeded";
        run.result = p.result ? deepClone(p.result) : null;
        run.completedAt = event.occurredAt;
        const delta = p.usageDelta ?? p.usage ?? null;
        if (delta) {
          run.usage = accumulateRunUsage(run.usage, delta);
        }
        state.metrics.completedRuns++;
        state.metrics.activeRuns = Math.max(0, state.metrics.activeRuns - 1);

        const inst = state.instances.get(run.agentId);
        if (inst) {
          inst.concurrency.current = Math.max(0, inst.concurrency.current - 1);
        }

        if (run.delegationId) {
          const del = state.delegations.get(run.delegationId);
          if (del) {
            del.status = "completed";
            del.receipt = {
              delegationId: del.delegationId,
              childRunId: run.agentRunId,
              result: p.result ? deepClone(p.result) : null,
              artifactRefs: Array.isArray(p.artifactRefs) ? [...p.artifactRefs] : [],
              usage: deepClone(run.usage),
              finishedAt: event.occurredAt
            };
            del.provenance.finishedAt = event.occurredAt;
          }
        }
      }
      break;
    }

    case "agent_foundry.run_failed": {
      const run = state.runs.get(p.runId);
      if (run) {
        run.status = "failed";
        run.error = p.error ? deepClone(p.error) : { code: "unknown_error", message: "run_failed" };
        run.completedAt = event.occurredAt;
        const delta = p.usageDelta ?? p.usage ?? null;
        if (delta) {
          run.usage = accumulateRunUsage(run.usage, delta);
        }
        state.metrics.failedRuns++;
        state.metrics.activeRuns = Math.max(0, state.metrics.activeRuns - 1);

        const inst = state.instances.get(run.agentId);
        if (inst) {
          inst.concurrency.current = Math.max(0, inst.concurrency.current - 1);
        }

        if (run.delegationId) {
          const del = state.delegations.get(run.delegationId);
          if (del) {
            del.status = "failed";
            del.receipt = {
              delegationId: del.delegationId,
              childRunId: run.agentRunId,
              failed: true,
              error: deepClone(run.error),
              usage: deepClone(run.usage),
              finishedAt: event.occurredAt
            };
            del.provenance.finishedAt = event.occurredAt;
          }
        }
      }
      break;
    }

    case "agent_foundry.run_cancelled": {
      const run = state.runs.get(p.runId);
      if (run) {
        run.status = "cancelled";
        run.completedAt = event.occurredAt;
        run.result = {
          cancelled: true,
          reason: p.reason ?? "user_requested",
          receipt: p.receipt ? deepClone(p.receipt) : null
        };
        state.metrics.cancelledRuns++;
        state.metrics.activeRuns = Math.max(0, state.metrics.activeRuns - 1);

        const inst = state.instances.get(run.agentId);
        if (inst) {
          inst.concurrency.current = Math.max(0, inst.concurrency.current - 1);
        }

        if (run.delegationId) {
          const del = state.delegations.get(run.delegationId);
          if (del) {
            del.status = "cancelled";
            del.receipt = {
              delegationId: del.delegationId,
              childRunId: run.agentRunId,
              cancelled: true,
              reason: p.reason ?? "cancelled",
              finishedAt: event.occurredAt
            };
            del.provenance.finishedAt = event.occurredAt;
          }
        }
      }
      break;
    }
  }
}

export function projectAgentFoundry(events, state = emptyAgentFoundryState()) {
  for (const event of events) {
    if (event.type.startsWith("agent_foundry.")) {
      applyAgentFoundryEvent(state, event);
    }
  }
  return state;
}
