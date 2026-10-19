import { invariant } from "../domain/assertions.mjs";
import { pulsoId, eventDraft, assertExternalIdsConfined } from "../domain/contracts.mjs";
import { assertNoSecrets } from "../control-plane/secrets.mjs";
import {
  computeBlueprintHash,
  validateAgentBlueprint,
  validateAgentRevision,
  validateAgentInstance,
  validateAgentGrant,
  validateDelegationContract,
  validateAgentRun,
  normalizeUsageDelta,
  deepClone,
  deepCloneAndFreeze,
  AGENT_INSTANCE_TERMINAL,
  AGENT_RUN_TERMINAL,
  assertAgentInstanceTransition,
  assertDelegationTransition,
  assertAgentRunTransition,
  DEFAULT_SOVEREIGN_IDENTITY
} from "./agent-contracts.mjs";
import {
  emptyAgentFoundryState,
  applyAgentFoundryEvent,
  projectAgentFoundry
} from "./agent-projector.mjs";
import { AgentSupervisor } from "./agent-supervisor.mjs";

const DEFAULT_ACTOR = Object.freeze({ kind: "operator", id: "fe" });

export class AgentFoundryService {
  constructor({
    store,
    state = null,
    clock = () => new Date().toISOString(),
    supervisorOptions = {}
  }) {
    invariant(store, "event_store_required");
    this.store = store;
    this.clock = clock;
    this.state = state || emptyAgentFoundryState();
    if (!this.state.revisionsByBlueprint) {
      this.state.revisionsByBlueprint = new Map();
    }
    if (!this.state.agentGrants) {
      this.state.agentGrants = new Map();
    }
    this.supervisor = new AgentSupervisor({
      state: this.state,
      foundry: this,
      clock: this.clock,
      ...supervisorOptions
    });
    this.restore();
  }

  _now(overrideNow = null) {
    if (overrideNow) return overrideNow;
    return typeof this.clock === "function" ? this.clock() : this.clock.now();
  }

  restore() {
    if (!this.state.blueprints) this.state.blueprints = new Map();
    else this.state.blueprints.clear();
    if (!this.state.revisions) this.state.revisions = new Map();
    else this.state.revisions.clear();
    if (!this.state.revisionsByBlueprint) this.state.revisionsByBlueprint = new Map();
    else this.state.revisionsByBlueprint.clear();
    if (!this.state.instances) this.state.instances = new Map();
    else this.state.instances.clear();
    if (!this.state.grants) this.state.grants = new Map();
    else this.state.grants.clear();
    if (!this.state.agentGrants) this.state.agentGrants = new Map();
    else this.state.agentGrants.clear();
    if (!this.state.delegations) this.state.delegations = new Map();
    else this.state.delegations.clear();
    if (!this.state.runs) this.state.runs = new Map();
    else this.state.runs.clear();

    this.state.metrics = {
      ...this.state.metrics,
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
    };

    this.supervisor.state = this.state;
    const events = this.store.all().filter(e => e.type.startsWith("agent_foundry."));
    projectAgentFoundry(events, this.state);
    return this.state;
  }

  _commit(drafts, { scope = null, idempotencyKey = null, entityId = null } = {}) {
    assertExternalIdsConfined(drafts);
    assertNoSecrets(drafts);

    const options = (scope && idempotencyKey && entityId)
      ? { idempotency: { scope, key: idempotencyKey, entityId } }
      : {};

    const commitResult = this.store.append(drafts, options);
    for (const committedEvent of commitResult.events) {
      applyAgentFoundryEvent(this.state, committedEvent);
    }
    return commitResult;
  }

  _auditDraft(actionName, target, actor, correlationId, occurredAt) {
    const auditId = pulsoId("audit");
    return eventDraft({
      type: "agent_foundry.audit_entry_recorded",
      aggregateType: "audit_entry",
      aggregateId: auditId,
      correlationId,
      causationId: correlationId,
      actor,
      occurredAt,
      payload: {
        auditId,
        actionName,
        target,
        actor,
        status: "success"
      }
    });
  }

  // --- BLUEPRINT & REVISION LIFECYCLE ---

  validateBlueprint(blueprint) {
    return validateAgentBlueprint(blueprint);
  }

  async createBlueprint(input, { actor = DEFAULT_ACTOR, idempotencyKey = null, now = null } = {}) {
    assertNoSecrets(input);
    const scope = "foundry|create_blueprint";
    if (idempotencyKey) {
      const existing = this.store.findIdempotency(scope, idempotencyKey);
      if (existing) {
        const bp = this.state.blueprints.get(existing);
        const revs = this.state.revisionsByBlueprint.get(existing) ?? [];
        return {
          duplicate: true,
          blueprint: bp ? deepCloneAndFreeze(bp) : null,
          revision: revs.length > 0 ? deepCloneAndFreeze(revs[0]) : null,
          events: []
        };
      }
    }

    const occurredAt = this._now(now ?? input.createdAt ?? null);
    const blueprintId = input.blueprintId ?? pulsoId("bp");
    const blueprint = validateAgentBlueprint({ ...deepClone(input), blueprintId });

    const hash = computeBlueprintHash(blueprint);
    const revisionId = `${blueprintId}@v1`;

    const revision = validateAgentRevision({
      revisionId,
      blueprintId,
      version: 1,
      hash,
      blueprint,
      changelog: input.changelog ?? "Initial blueprint creation",
      provenance: blueprint.provenance,
      createdAt: occurredAt
    });

    const correlationId = pulsoId("cmd");
    const drafts = [
      eventDraft({
        type: "agent_foundry.blueprint_created",
        aggregateType: "agent_blueprint",
        aggregateId: blueprintId,
        correlationId,
        actor,
        occurredAt,
        payload: blueprint
      }),
      eventDraft({
        type: "agent_foundry.revision_created",
        aggregateType: "agent_revision",
        aggregateId: revisionId,
        correlationId,
        actor,
        occurredAt,
        payload: revision
      }),
      this._auditDraft("create_blueprint", { type: "agent_blueprint", id: blueprintId }, actor, correlationId, occurredAt)
    ];

    const result = this._commit(drafts, { scope, idempotencyKey, entityId: blueprintId });
    return {
      duplicate: false,
      blueprint: deepCloneAndFreeze(blueprint),
      revision: deepCloneAndFreeze(revision),
      events: result.events
    };
  }

  async reviseBlueprint(input, { actor = DEFAULT_ACTOR, idempotencyKey = null, now = null } = {}) {
    assertNoSecrets(input);
    const scope = "foundry|revise_blueprint";
    if (idempotencyKey) {
      const existing = this.store.findIdempotency(scope, idempotencyKey);
      if (existing) {
        const rev = this.state.revisions.get(existing);
        return {
          duplicate: true,
          blueprint: rev ? deepCloneAndFreeze(rev.blueprint) : null,
          revision: rev ? deepCloneAndFreeze(rev) : null,
          events: []
        };
      }
    }

    invariant(input.blueprintId, "blueprint_id_required");
    const existing = this.state.blueprints.get(input.blueprintId);
    invariant(existing, "blueprint_not_found:" + input.blueprintId);

    const occurredAt = this._now(now ?? input.createdAt ?? null);
    const merged = validateAgentBlueprint({
      ...deepClone(existing),
      ...(input.changes ? deepClone(input.changes) : {}),
      blueprintId: input.blueprintId
    });

    const revisions = this.state.revisionsByBlueprint.get(input.blueprintId) ?? [];
    const nextVersion = revisions.length + 1;
    const revisionId = `${input.blueprintId}@v${nextVersion}`;
    const hash = computeBlueprintHash(merged);

    const provKind = (actor.kind === "agent" || actor.kind === "import") ? actor.kind : "human";
    const provenance = input.provenance ? {
      kind: (input.provenance.kind === "agent" || input.provenance.kind === "import") ? input.provenance.kind : "human",
      createdBy: input.provenance.createdBy ?? actor.id ?? "fe"
    } : {
      kind: provKind,
      createdBy: actor.id ?? "fe"
    };

    const revision = validateAgentRevision({
      revisionId,
      blueprintId: input.blueprintId,
      version: nextVersion,
      hash,
      blueprint: merged,
      changelog: input.changelog ?? `Revision v${nextVersion}`,
      provenance,
      createdAt: occurredAt
    });

    const correlationId = pulsoId("cmd");
    const drafts = [
      eventDraft({
        type: "agent_foundry.blueprint_revised",
        aggregateType: "agent_blueprint",
        aggregateId: input.blueprintId,
        correlationId,
        actor,
        occurredAt,
        payload: merged
      }),
      eventDraft({
        type: "agent_foundry.revision_created",
        aggregateType: "agent_revision",
        aggregateId: revisionId,
        correlationId,
        actor,
        occurredAt,
        payload: revision
      }),
      this._auditDraft("revise_blueprint", { type: "agent_revision", id: revisionId }, actor, correlationId, occurredAt)
    ];

    const result = this._commit(drafts, { scope, idempotencyKey, entityId: revisionId });
    return {
      duplicate: false,
      blueprint: deepCloneAndFreeze(merged),
      revision: deepCloneAndFreeze(revision),
      events: result.events
    };
  }

  // --- MATERIALIZATION & INSTANCE LIFECYCLE ---

  async materializeAgent(input, { actor = DEFAULT_ACTOR, idempotencyKey = null, now = null } = {}) {
    assertNoSecrets(input);
    const scope = "foundry|materialize_agent";
    if (idempotencyKey) {
      const existing = this.store.findIdempotency(scope, idempotencyKey);
      if (existing) {
        return {
          duplicate: true,
          instance: deepClone(this.state.instances.get(existing)),
          events: []
        };
      }
    }

    invariant(input.blueprintId, "blueprint_id_required");
    const blueprint = this.state.blueprints.get(input.blueprintId);
    invariant(blueprint, "blueprint_not_found:" + input.blueprintId);

    let revision;
    if (input.revisionId) {
      revision = this.state.revisions.get(input.revisionId);
      invariant(revision, "revision_not_found:" + input.revisionId);
    } else {
      const revs = this.state.revisionsByBlueprint.get(input.blueprintId) ?? [];
      invariant(revs.length > 0, "no_revisions_found_for_blueprint:" + input.blueprintId);
      revision = revs[revs.length - 1];
    }

    const occurredAt = this._now(now ?? input.createdAt ?? null);
    const agentId = input.agentId ?? pulsoId("agt");
    const instanceId = input.instanceId ?? pulsoId("inst");
    const identityId = input.identityId ?? DEFAULT_SOVEREIGN_IDENTITY;

    const resolvedBindings = input.resolvedBindings ?? {
      model: {
        providerId: blueprint.providerDefaults.modelProviderId,
        model: blueprint.providerDefaults.model
      },
      runtime: {
        providerId: blueprint.runtimePreferences.executorProviderId,
        executorType: "fake-executor"
      }
    };

    const instance = validateAgentInstance({
      instanceId,
      agentId,
      blueprintId: input.blueprintId,
      revisionId: revision.revisionId,
      version: revision.version,
      identityId,
      status: input.initialStatus ?? "ready",
      resolvedBindings,
      health: {
        status: input.health?.status ?? "healthy",
        checkedAt: input.health?.checkedAt ?? occurredAt,
        detail: input.health?.detail ?? null
      },
      concurrency: { current: 0, limit: blueprint.limits.maxConcurrency },
      limits: blueprint.limits,
      createdAt: occurredAt,
      updatedAt: input.updatedAt ?? occurredAt,
      metadata: input.metadata ?? {}
    });

    const correlationId = pulsoId("cmd");
    const drafts = [
      eventDraft({
        type: "agent_foundry.agent_materialized",
        aggregateType: "agent_instance",
        aggregateId: agentId,
        correlationId,
        actor,
        occurredAt,
        payload: instance
      }),
      this._auditDraft("materialize_agent", { type: "agent_instance", id: agentId }, actor, correlationId, occurredAt)
    ];

    const result = this._commit(drafts, { scope, idempotencyKey, entityId: agentId });
    return {
      duplicate: false,
      instance: deepClone(instance),
      events: result.events
    };
  }

  async activateAgent(agentId, { actor = DEFAULT_ACTOR, idempotencyKey = null, now = null } = {}) {
    const scope = "foundry|activate_agent";
    if (idempotencyKey) {
      const existing = this.store.findIdempotency(scope, idempotencyKey);
      if (existing) {
        return { duplicate: true, instance: deepClone(this.state.instances.get(existing)), events: [] };
      }
    }
    const inst = this.state.instances.get(agentId);
    invariant(inst, "instance_not_found:" + agentId);
    invariant(
      inst.status === "draft" || inst.status === "ready",
      "invalid_instance_transition: cannot activate agent '" + agentId + "' from status '" + inst.status + "'"
    );
    assertAgentInstanceTransition(inst.status, "active");

    const occurredAt = this._now(now);
    const correlationId = pulsoId("cmd");
    const drafts = [
      eventDraft({
        type: "agent_foundry.agent_activated",
        aggregateType: "agent_instance",
        aggregateId: agentId,
        correlationId,
        actor,
        occurredAt,
        payload: { agentId }
      }),
      this._auditDraft("activate_agent", { type: "agent_instance", id: agentId }, actor, correlationId, occurredAt)
    ];

    const result = this._commit(drafts, { scope, idempotencyKey, entityId: agentId });
    return { duplicate: false, instance: deepClone(this.state.instances.get(agentId)), events: result.events };
  }

  async pauseAgent(agentId, { reason = "user_requested", actor = DEFAULT_ACTOR, idempotencyKey = null, now = null } = {}) {
    const scope = "foundry|pause_agent";
    if (idempotencyKey) {
      const existing = this.store.findIdempotency(scope, idempotencyKey);
      if (existing) {
        return { duplicate: true, instance: deepClone(this.state.instances.get(existing)), events: [] };
      }
    }
    const inst = this.state.instances.get(agentId);
    invariant(inst, "instance_not_found:" + agentId);
    invariant(
      inst.status === "active" || inst.status === "draining",
      "invalid_instance_transition: cannot pause agent '" + agentId + "' from status '" + inst.status + "'"
    );
    assertAgentInstanceTransition(inst.status, "paused");

    const occurredAt = this._now(now);
    const correlationId = pulsoId("cmd");
    const drafts = [
      eventDraft({
        type: "agent_foundry.agent_paused",
        aggregateType: "agent_instance",
        aggregateId: agentId,
        correlationId,
        actor,
        occurredAt,
        payload: { agentId, reason }
      }),
      this._auditDraft("pause_agent", { type: "agent_instance", id: agentId }, actor, correlationId, occurredAt)
    ];

    const result = this._commit(drafts, { scope, idempotencyKey, entityId: agentId });
    return { duplicate: false, instance: deepClone(this.state.instances.get(agentId)), events: result.events };
  }

  async resumeAgent(agentId, { actor = DEFAULT_ACTOR, idempotencyKey = null, now = null } = {}) {
    const scope = "foundry|resume_agent";
    if (idempotencyKey) {
      const existing = this.store.findIdempotency(scope, idempotencyKey);
      if (existing) {
        return { duplicate: true, instance: deepClone(this.state.instances.get(existing)), events: [] };
      }
    }
    const inst = this.state.instances.get(agentId);
    invariant(inst, "instance_not_found:" + agentId);
    invariant(
      inst.status === "paused",
      "invalid_instance_transition: cannot resume agent '" + agentId + "' unless paused (current: '" + inst.status + "')"
    );
    assertAgentInstanceTransition(inst.status, "active");

    const occurredAt = this._now(now);
    const correlationId = pulsoId("cmd");
    const drafts = [
      eventDraft({
        type: "agent_foundry.agent_resumed",
        aggregateType: "agent_instance",
        aggregateId: agentId,
        correlationId,
        actor,
        occurredAt,
        payload: { agentId }
      }),
      this._auditDraft("resume_agent", { type: "agent_instance", id: agentId }, actor, correlationId, occurredAt)
    ];

    const result = this._commit(drafts, { scope, idempotencyKey, entityId: agentId });
    return { duplicate: false, instance: deepClone(this.state.instances.get(agentId)), events: result.events };
  }

  async drainAgent(agentId, { actor = DEFAULT_ACTOR, idempotencyKey = null, now = null } = {}) {
    const scope = "foundry|drain_agent";
    if (idempotencyKey) {
      const existing = this.store.findIdempotency(scope, idempotencyKey);
      if (existing) {
        return { duplicate: true, instance: deepClone(this.state.instances.get(existing)), events: [] };
      }
    }
    const inst = this.state.instances.get(agentId);
    invariant(inst, "instance_not_found:" + agentId);
    assertAgentInstanceTransition(inst.status, "draining");

    const occurredAt = this._now(now);
    const correlationId = pulsoId("cmd");
    const drafts = [
      eventDraft({
        type: "agent_foundry.agent_draining",
        aggregateType: "agent_instance",
        aggregateId: agentId,
        correlationId,
        actor,
        occurredAt,
        payload: { agentId }
      }),
      this._auditDraft("drain_agent", { type: "agent_instance", id: agentId }, actor, correlationId, occurredAt)
    ];

    const result = this._commit(drafts, { scope, idempotencyKey, entityId: agentId });
    return { duplicate: false, instance: deepClone(this.state.instances.get(agentId)), events: result.events };
  }

  async retireAgent(agentId, { reason = "decommissioned", actor = DEFAULT_ACTOR, idempotencyKey = null, now = null } = {}) {
    const scope = "foundry|retire_agent";
    if (idempotencyKey) {
      const existing = this.store.findIdempotency(scope, idempotencyKey);
      if (existing) {
        return { duplicate: true, instance: deepClone(this.state.instances.get(existing)), events: [] };
      }
    }
    const inst = this.state.instances.get(agentId);
    invariant(inst, "instance_not_found:" + agentId);
    assertAgentInstanceTransition(inst.status, "retired");

    const occurredAt = this._now(now);
    const correlationId = pulsoId("cmd");
    const drafts = [
      eventDraft({
        type: "agent_foundry.agent_retired",
        aggregateType: "agent_instance",
        aggregateId: agentId,
        correlationId,
        actor,
        occurredAt,
        payload: { agentId, reason }
      }),
      this._auditDraft("retire_agent", { type: "agent_instance", id: agentId }, actor, correlationId, occurredAt)
    ];

    const result = this._commit(drafts, { scope, idempotencyKey, entityId: agentId });
    return { duplicate: false, instance: deepClone(this.state.instances.get(agentId)), events: result.events };
  }

  // --- CAPABILITY GRANTS & REVOCATION ---

  async grantCapability(input, { actor = DEFAULT_ACTOR, idempotencyKey = null, now = null } = {}) {
    assertNoSecrets(input);
    const scope = "foundry|grant_capability";
    if (idempotencyKey) {
      const existing = this.store.findIdempotency(scope, idempotencyKey);
      if (existing) {
        return { duplicate: true, grant: deepClone(this.state.grants.get(existing)), events: [] };
      }
    }

    const occurredAt = this._now(now ?? input.grantedAt ?? null);
    const grantId = input.grantId ?? pulsoId("grant");
    const grant = validateAgentGrant({
      ...input,
      grantId,
      grantedAt: input.grantedAt ?? occurredAt
    });

    const correlationId = pulsoId("cmd");
    const drafts = [
      eventDraft({
        type: "agent_foundry.capability_granted",
        aggregateType: "agent_grant",
        aggregateId: grantId,
        correlationId,
        actor,
        occurredAt,
        payload: grant
      }),
      this._auditDraft("grant_capability", { type: "agent_grant", id: grantId }, actor, correlationId, occurredAt)
    ];

    const result = this._commit(drafts, { scope, idempotencyKey, entityId: grantId });
    return { duplicate: false, grant: deepClone(grant), events: result.events };
  }

  async revokeCapability(input, { actor = DEFAULT_ACTOR, idempotencyKey = null, now = null } = {}) {
    const scope = "foundry|revoke_capability";
    if (idempotencyKey) {
      const existing = this.store.findIdempotency(scope, idempotencyKey);
      if (existing) {
        return { duplicate: true, revokedId: existing, events: [] };
      }
    }

    const occurredAt = this._now(now);
    const grantId = input.grantId ?? input.id ?? pulsoId("rev");
    const correlationId = pulsoId("cmd");
    const drafts = [
      eventDraft({
        type: "agent_foundry.capability_revoked",
        aggregateType: "agent_grant",
        aggregateId: grantId,
        correlationId,
        actor,
        occurredAt,
        payload: {
          grantId: input.grantId ?? input.id ?? null,
          agentId: input.agentId ?? null,
          capability: input.capability ?? null,
          scope: input.scope ?? null
        }
      }),
      this._auditDraft("revoke_capability", { type: "agent_grant", id: grantId }, actor, correlationId, occurredAt)
    ];

    const result = this._commit(drafts, { scope, idempotencyKey, entityId: grantId });
    return { duplicate: false, revokedId: grantId, events: result.events };
  }

  // --- PROVIDER & RUNTIME BINDINGS (WITHOUT CHANGING IDENTITY) ---

  async bindProviderModel(input, { actor = DEFAULT_ACTOR, idempotencyKey = null, now = null } = {}) {
    assertNoSecrets(input);
    invariant(input.agentId, "agent_id_required");
    invariant(input.providerId, "provider_id_required");
    invariant(input.model, "model_required");

    const scope = "foundry|bind_model";
    if (idempotencyKey) {
      const existing = this.store.findIdempotency(scope, idempotencyKey);
      if (existing) {
        return { duplicate: true, instance: deepClone(this.state.instances.get(existing)), events: [] };
      }
    }

    const inst = this.state.instances.get(input.agentId);
    invariant(inst, "instance_not_found:" + input.agentId);
    invariant(!AGENT_INSTANCE_TERMINAL.has(inst.status), "invalid_instance_state: cannot rebind retired agent '" + input.agentId + "'");

    const occurredAt = this._now(now);
    const correlationId = pulsoId("cmd");
    const drafts = [
      eventDraft({
        type: "agent_foundry.provider_model_bound",
        aggregateType: "agent_instance",
        aggregateId: input.agentId,
        correlationId,
        actor,
        occurredAt,
        payload: {
          agentId: input.agentId,
          providerId: input.providerId,
          model: input.model
        }
      }),
      this._auditDraft("bind_provider_model", { type: "agent_instance", id: input.agentId }, actor, correlationId, occurredAt)
    ];

    const result = this._commit(drafts, { scope, idempotencyKey, entityId: input.agentId });
    return { duplicate: false, instance: deepClone(this.state.instances.get(input.agentId)), events: result.events };
  }

  async bindRuntimeExecutor(input, { actor = DEFAULT_ACTOR, idempotencyKey = null, now = null } = {}) {
    assertNoSecrets(input);
    invariant(input.agentId, "agent_id_required");
    invariant(input.providerId, "provider_id_required");
    invariant(input.executorType, "executor_type_required");

    const scope = "foundry|bind_runtime";
    if (idempotencyKey) {
      const existing = this.store.findIdempotency(scope, idempotencyKey);
      if (existing) {
        return { duplicate: true, instance: deepClone(this.state.instances.get(existing)), events: [] };
      }
    }

    const inst = this.state.instances.get(input.agentId);
    invariant(inst, "instance_not_found:" + input.agentId);
    invariant(!AGENT_INSTANCE_TERMINAL.has(inst.status), "invalid_instance_state: cannot rebind retired agent '" + input.agentId + "'");

    const occurredAt = this._now(now);
    const correlationId = pulsoId("cmd");
    const drafts = [
      eventDraft({
        type: "agent_foundry.runtime_executor_bound",
        aggregateType: "agent_instance",
        aggregateId: input.agentId,
        correlationId,
        actor,
        occurredAt,
        payload: {
          agentId: input.agentId,
          providerId: input.providerId,
          executorType: input.executorType
        }
      }),
      this._auditDraft("bind_runtime_executor", { type: "agent_instance", id: input.agentId }, actor, correlationId, occurredAt)
    ];

    const result = this._commit(drafts, { scope, idempotencyKey, entityId: input.agentId });
    return { duplicate: false, instance: deepClone(this.state.instances.get(input.agentId)), events: result.events };
  }

  // --- DELEGATION & LINEAGE ---

  async createDelegation(input, { actor = DEFAULT_ACTOR, idempotencyKey = null, now = null } = {}) {
    assertNoSecrets(input);
    const scope = "foundry|create_delegation";
    if (idempotencyKey) {
      const existing = this.store.findIdempotency(scope, idempotencyKey);
      if (existing) {
        return { duplicate: true, delegation: deepClone(this.state.delegations.get(existing)), events: [] };
      }
    }

    const occurredAt = this._now(now ?? input.provenance?.createdAt ?? input.createdAt ?? null);
    const delegationId = input.delegationId ?? pulsoId("del");
    invariant(!this.state.delegations.has(delegationId), "delegation_already_exists:" + delegationId);

    const delegation = validateDelegationContract({
      ...input,
      delegationId,
      status: "proposed",
      provenance: {
        ...(input.provenance ?? {}),
        createdAt: input.provenance?.createdAt ?? input.createdAt ?? occurredAt
      }
    });

    const correlationId = pulsoId("cmd");
    const drafts = [
      eventDraft({
        type: "agent_foundry.delegation_created",
        aggregateType: "delegation_contract",
        aggregateId: delegationId,
        correlationId,
        actor,
        occurredAt,
        payload: delegation
      }),
      this._auditDraft("create_delegation", { type: "delegation_contract", id: delegationId }, actor, correlationId, occurredAt)
    ];

    const result = this._commit(drafts, { scope, idempotencyKey, entityId: delegationId });
    return { duplicate: false, delegation: deepClone(delegation), events: result.events };
  }

  async acceptDelegation(delegationId, { actor = DEFAULT_ACTOR, idempotencyKey = null, now = null } = {}) {
    const scope = "foundry|accept_delegation";
    if (idempotencyKey) {
      const existing = this.store.findIdempotency(scope, idempotencyKey);
      if (existing) {
        return { duplicate: true, delegation: deepClone(this.state.delegations.get(existing)), events: [] };
      }
    }
    const del = this.state.delegations.get(delegationId);
    invariant(del, "delegation_not_found:" + delegationId);
    invariant(
      del.status === "proposed",
      "invalid_delegation_transition: delegation '" + delegationId + "' cannot be accepted from status '" + del.status + "'"
    );
    assertDelegationTransition(del.status, "accepted");

    const occurredAt = this._now(now);
    const correlationId = pulsoId("cmd");
    const drafts = [
      eventDraft({
        type: "agent_foundry.delegation_accepted",
        aggregateType: "delegation_contract",
        aggregateId: delegationId,
        correlationId,
        actor,
        occurredAt,
        payload: { delegationId }
      }),
      this._auditDraft("accept_delegation", { type: "delegation_contract", id: delegationId }, actor, correlationId, occurredAt)
    ];

    const result = this._commit(drafts, { scope, idempotencyKey, entityId: delegationId });
    return { duplicate: false, delegation: deepClone(this.state.delegations.get(delegationId)), events: result.events };
  }

  async rejectDelegation(delegationId, { reason = "rejected", actor = DEFAULT_ACTOR, idempotencyKey = null, now = null } = {}) {
    const scope = "foundry|reject_delegation";
    if (idempotencyKey) {
      const existing = this.store.findIdempotency(scope, idempotencyKey);
      if (existing) {
        return { duplicate: true, delegation: deepClone(this.state.delegations.get(existing)), events: [] };
      }
    }
    const del = this.state.delegations.get(delegationId);
    invariant(del, "delegation_not_found:" + delegationId);
    invariant(
      del.status === "proposed",
      "invalid_delegation_transition: delegation '" + delegationId + "' cannot be rejected from status '" + del.status + "'"
    );
    assertDelegationTransition(del.status, "rejected");

    const occurredAt = this._now(now);
    const correlationId = pulsoId("cmd");
    const drafts = [
      eventDraft({
        type: "agent_foundry.delegation_rejected",
        aggregateType: "delegation_contract",
        aggregateId: delegationId,
        correlationId,
        actor,
        occurredAt,
        payload: { delegationId, reason }
      }),
      this._auditDraft("reject_delegation", { type: "delegation_contract", id: delegationId }, actor, correlationId, occurredAt)
    ];

    const result = this._commit(drafts, { scope, idempotencyKey, entityId: delegationId });
    return { duplicate: false, delegation: deepClone(this.state.delegations.get(delegationId)), events: result.events };
  }

  // --- RUNS, CHECKPOINTS & SUPERVISION ---

  async startAgentRun(input, { actor = DEFAULT_ACTOR, idempotencyKey = null, now = null } = {}) {
    assertNoSecrets(input);
    const scope = "foundry|start_run";
    if (idempotencyKey) {
      const existing = this.store.findIdempotency(scope, idempotencyKey);
      if (existing) {
        return { duplicate: true, run: deepClone(this.state.runs.get(existing)), events: [] };
      }
    }

    invariant(input.agentId, "agent_id_required");
    const inst = this.state.instances.get(input.agentId);
    invariant(inst, "instance_not_found:" + input.agentId);
    invariant(
      inst.status === "active",
      "agent_not_active: cannot start run for agent '" + input.agentId + "' in status '" + inst.status + "'"
    );

    if (input.delegationId !== undefined && input.delegationId !== null) {
      const del = this.state.delegations.get(input.delegationId);
      invariant(del, "delegation_not_found:" + input.delegationId);
      invariant(
        del.status === "accepted",
        "delegation_not_accepted: delegation '" + input.delegationId + "' must be accepted before starting run (current: '" + del.status + "')"
      );
      invariant(
        del.childAgentId === input.agentId,
        "delegation_agent_mismatch: delegation '" + input.delegationId + "' is for child '" + del.childAgentId + "', not '" + input.agentId + "'"
      );
      assertDelegationTransition(del.status, "running");
    }

    // Concurrency check via Supervisor
    this.supervisor.checkConcurrency(input.agentId);

    const occurredAt = this._now(now ?? input.createdAt ?? null);
    const agentRunId = input.agentRunId ?? pulsoId("agtrun");
    invariant(!this.state.runs.has(agentRunId), "run_already_exists:" + agentRunId);

    const run = validateAgentRun({
      ...input,
      agentRunId,
      status: "running",
      createdAt: occurredAt,
      startedAt: occurredAt
    });

    const correlationId = pulsoId("cmd");
    const drafts = [
      eventDraft({
        type: "agent_foundry.run_started",
        aggregateType: "agent_run",
        aggregateId: agentRunId,
        correlationId,
        actor,
        occurredAt,
        payload: run
      }),
      this._auditDraft("start_run", { type: "agent_run", id: agentRunId }, actor, correlationId, occurredAt)
    ];

    const result = this._commit(drafts, { scope, idempotencyKey, entityId: agentRunId });
    return { duplicate: false, run: deepClone(this.state.runs.get(agentRunId)), events: result.events };
  }

  async recordCheckpoint(input, { actor = DEFAULT_ACTOR, idempotencyKey = null, now = null } = {}) {
    assertNoSecrets(input);
    invariant(input.runId, "run_id_required");

    const scope = "foundry|record_checkpoint";
    if (idempotencyKey) {
      const existing = this.store.findIdempotency(scope, idempotencyKey);
      if (existing) {
        return { duplicate: true, checkpointId: existing, events: [] };
      }
    }

    const run = this.state.runs.get(input.runId);
    invariant(run, "run_not_found:" + input.runId);
    invariant(
      !AGENT_RUN_TERMINAL.has(run.status),
      "invalid_agent_run_transition: cannot checkpoint terminal run '" + input.runId + "' in status '" + run.status + "'"
    );
    invariant(
      run.status === "running",
      "invalid_agent_run_state: cannot checkpoint run '" + input.runId + "' in status '" + run.status + "'"
    );

    const usageDelta = normalizeUsageDelta(input.usageDelta ?? input.usage ?? null);
    this.supervisor.checkBudget(input.runId, usageDelta || {});

    const occurredAt = this._now(now);
    const checkpointId = input.checkpointId ?? pulsoId("chk");
    const correlationId = pulsoId("cmd");
    const drafts = [
      eventDraft({
        type: "agent_foundry.run_checkpointed",
        aggregateType: "agent_run",
        aggregateId: input.runId,
        correlationId,
        actor,
        occurredAt,
        payload: {
          runId: input.runId,
          checkpointId,
          step: input.step ?? (run.checkpoints.length + 1),
          data: input.data ? deepClone(input.data) : null,
          usageDelta,
          usage: usageDelta
        }
      })
    ];

    const result = this._commit(drafts, { scope, idempotencyKey, entityId: checkpointId });
    return {
      duplicate: false,
      checkpointId,
      run: deepClone(this.state.runs.get(input.runId)),
      events: result.events
    };
  }

  async completeAgentRun(input, { actor = DEFAULT_ACTOR, idempotencyKey = null, now = null } = {}) {
    assertNoSecrets(input);
    invariant(input.runId, "run_id_required");

    const scope = "foundry|complete_run";
    if (idempotencyKey) {
      const existing = this.store.findIdempotency(scope, idempotencyKey);
      if (existing) {
        return { duplicate: true, run: deepClone(this.state.runs.get(existing)), events: [] };
      }
    }

    const run = this.state.runs.get(input.runId);
    invariant(run, "run_not_found:" + input.runId);
    assertAgentRunTransition(run.status, "succeeded");

    const usageDelta = normalizeUsageDelta(input.usageDelta ?? input.usage ?? null);
    this.supervisor.checkBudget(input.runId, usageDelta || {});

    const occurredAt = this._now(now);
    const correlationId = pulsoId("cmd");
    const drafts = [
      eventDraft({
        type: "agent_foundry.run_completed",
        aggregateType: "agent_run",
        aggregateId: input.runId,
        correlationId,
        actor,
        occurredAt,
        payload: {
          runId: input.runId,
          result: input.result ? deepClone(input.result) : { status: "completed" },
          artifactRefs: Array.isArray(input.artifactRefs) ? [...input.artifactRefs] : [],
          usageDelta,
          usage: usageDelta
        }
      }),
      this._auditDraft("complete_run", { type: "agent_run", id: input.runId }, actor, correlationId, occurredAt)
    ];

    const result = this._commit(drafts, { scope, idempotencyKey, entityId: input.runId });
    return { duplicate: false, run: deepClone(this.state.runs.get(input.runId)), events: result.events };
  }

  async failAgentRun(input, { actor = DEFAULT_ACTOR, idempotencyKey = null, now = null } = {}) {
    assertNoSecrets(input);
    invariant(input.runId, "run_id_required");

    const scope = "foundry|fail_run";
    if (idempotencyKey) {
      const existing = this.store.findIdempotency(scope, idempotencyKey);
      if (existing) {
        return { duplicate: true, run: deepClone(this.state.runs.get(existing)), events: [] };
      }
    }

    const run = this.state.runs.get(input.runId);
    invariant(run, "run_not_found:" + input.runId);
    assertAgentRunTransition(run.status, "failed");

    const usageDelta = normalizeUsageDelta(input.usageDelta ?? input.usage ?? null);
    const occurredAt = this._now(now);
    const correlationId = pulsoId("cmd");
    const drafts = [
      eventDraft({
        type: "agent_foundry.run_failed",
        aggregateType: "agent_run",
        aggregateId: input.runId,
        correlationId,
        actor,
        occurredAt,
        payload: {
          runId: input.runId,
          error: input.error ? deepClone(input.error) : { message: "unknown_failure" },
          usageDelta,
          usage: usageDelta
        }
      }),
      this._auditDraft("fail_run", { type: "agent_run", id: input.runId }, actor, correlationId, occurredAt)
    ];

    const result = this._commit(drafts, { scope, idempotencyKey, entityId: input.runId });
    return { duplicate: false, run: deepClone(this.state.runs.get(input.runId)), events: result.events };
  }

  async cancelAgentRun(runId, { reason = "user_requested", actor = DEFAULT_ACTOR, idempotencyKey = null, now = null } = {}) {
    invariant(runId, "run_id_required");
    const scope = "foundry|cancel_run";
    if (idempotencyKey) {
      const existing = this.store.findIdempotency(scope, idempotencyKey);
      if (existing) {
        return { duplicate: true, run: deepClone(this.state.runs.get(existing)), events: [] };
      }
    }

    const run = this.state.runs.get(runId);
    invariant(run, "run_not_found:" + runId);
    assertAgentRunTransition(run.status, "cancelled");

    // Propagate cancellation to child runs first
    const cancelledChildren = await this.supervisor.propagateCancellation(runId, reason);

    const occurredAt = this._now(now);
    const receipt = {
      runId,
      reason,
      cancelledAt: occurredAt,
      cancelledChildrenCount: cancelledChildren.length
    };

    const correlationId = pulsoId("cmd");
    const drafts = [
      eventDraft({
        type: "agent_foundry.run_cancelled",
        aggregateType: "agent_run",
        aggregateId: runId,
        correlationId,
        actor,
        occurredAt,
        payload: {
          runId,
          reason,
          receipt
        }
      }),
      this._auditDraft("cancel_run", { type: "agent_run", id: runId }, actor, correlationId, occurredAt)
    ];

    const result = this._commit(drafts, { scope, idempotencyKey, entityId: runId });
    return {
      duplicate: false,
      run: deepClone(this.state.runs.get(runId)),
      receipt: deepClone(receipt),
      cancelledChildren,
      events: result.events
    };
  }

  // --- QUERY & RETRIEVAL API ---

  list(resource, query = {}) {
    let items = [];
    let freezeItems = false;
    switch (resource) {
      case "blueprints":
        items = Array.from(this.state.blueprints.values());
        freezeItems = true;
        break;
      case "revisions":
        items = Array.from(this.state.revisions.values());
        freezeItems = true;
        break;
      case "instances":
      case "agents":
        items = Array.from(this.state.instances.values());
        break;
      case "grants":
        items = Array.from(this.state.grants.values());
        break;
      case "delegations":
        items = Array.from(this.state.delegations.values());
        break;
      case "runs":
        items = Array.from(this.state.runs.values());
        break;
      default:
        throw new Error("unknown_foundry_resource:" + resource);
    }

    if (query.status) {
      items = items.filter(i => i.status === query.status);
    }
    if (query.blueprintId) {
      items = items.filter(i => i.blueprintId === query.blueprintId);
    }
    if (query.agentId) {
      items = items.filter(i => i.agentId === query.agentId);
    }
    if (query.limit && typeof query.limit === "number") {
      items = items.slice(0, query.limit);
    }

    assertNoSecrets(items);
    const cloned = JSON.parse(JSON.stringify(items));
    return freezeItems ? deepCloneAndFreeze(cloned) : cloned;
  }

  get(resource, id) {
    let item = null;
    let freezeItem = false;
    switch (resource) {
      case "blueprint":
      case "blueprints":
        item = this.state.blueprints.get(id) ?? null;
        freezeItem = true;
        break;
      case "revision":
      case "revisions":
        item = this.state.revisions.get(id) ?? null;
        freezeItem = true;
        break;
      case "instance":
      case "instances":
      case "agent":
      case "agents":
        item = this.state.instances.get(id) ?? null;
        break;
      case "grant":
      case "grants":
        item = this.state.grants.get(id) ?? null;
        break;
      case "delegation":
      case "delegations":
        item = this.state.delegations.get(id) ?? null;
        break;
      case "run":
      case "runs":
        item = this.state.runs.get(id) ?? null;
        break;
      default:
        throw new Error("unknown_foundry_resource:" + resource);
    }

    if (item) {
      assertNoSecrets(item);
      const cloned = JSON.parse(JSON.stringify(item));
      return freezeItem ? deepCloneAndFreeze(cloned) : cloned;
    }
    return null;
  }

  snapshot({ now = null } = {}) {
    const snap = {
      version: "0.4.0",
      timestamp: this._now(now),
      blueprints: Array.from(this.state.blueprints.values()),
      revisions: Array.from(this.state.revisions.values()),
      instances: Array.from(this.state.instances.values()),
      grants: Array.from(this.state.grants.values()),
      delegations: Array.from(this.state.delegations.values()),
      runs: Array.from(this.state.runs.values()),
      metrics: { ...this.state.metrics }
    };
    assertNoSecrets(snap);
    return JSON.parse(JSON.stringify(snap));
  }
}
