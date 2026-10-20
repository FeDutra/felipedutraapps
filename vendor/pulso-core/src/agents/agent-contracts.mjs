import { createHash } from "node:crypto";
import { invariant } from "../domain/assertions.mjs";
import { assertNoSecrets } from "../control-plane/secrets.mjs";
import { DEFAULT_SOVEREIGN_IDENTITY } from "../domain/contracts.mjs";

export { DEFAULT_SOVEREIGN_IDENTITY };

export const AGENT_INSTANCE_STATUSES = Object.freeze([
  "draft",
  "ready",
  "active",
  "paused",
  "draining",
  "retired",
  "failed"
]);

export const AGENT_INSTANCE_TERMINAL = Object.freeze(new Set(["retired"]));

export const AGENT_INSTANCE_TRANSITIONS = Object.freeze({
  draft: new Set(["ready", "active", "retired", "failed"]),
  ready: new Set(["active", "retired", "failed"]),
  active: new Set(["paused", "draining", "retired", "failed"]),
  paused: new Set(["active", "retired", "failed"]),
  draining: new Set(["paused", "retired", "failed"]),
  retired: new Set(),
  failed: new Set(["retired"])
});

export const AGENT_GRANT_EFFECTS = Object.freeze(["allow", "deny"]);

export const DELEGATION_STATUSES = Object.freeze([
  "proposed",
  "accepted",
  "rejected",
  "running",
  "completed",
  "failed",
  "cancelled"
]);

export const DELEGATION_TERMINAL = Object.freeze(new Set([
  "rejected",
  "completed",
  "failed",
  "cancelled"
]));

export const DELEGATION_TRANSITIONS = Object.freeze({
  proposed: new Set(["accepted", "rejected", "cancelled"]),
  accepted: new Set(["running", "cancelled"]),
  rejected: new Set(),
  running: new Set(["completed", "failed", "cancelled"]),
  completed: new Set(),
  failed: new Set(),
  cancelled: new Set()
});

export const AGENT_RUN_STATUSES = Object.freeze([
  "queued",
  "running",
  "waiting_approval",
  "paused",
  "succeeded",
  "failed",
  "cancelled",
  "timed_out"
]);

export const AGENT_RUN_TERMINAL = Object.freeze(new Set([
  "succeeded",
  "failed",
  "cancelled",
  "timed_out"
]));

export const AGENT_RUN_TRANSITIONS = Object.freeze({
  queued: new Set(["running", "cancelled", "timed_out"]),
  running: new Set(["waiting_approval", "paused", "succeeded", "failed", "cancelled", "timed_out"]),
  waiting_approval: new Set(["running", "cancelled", "timed_out"]),
  paused: new Set(["running", "cancelled", "timed_out"]),
  succeeded: new Set(),
  failed: new Set(),
  cancelled: new Set(),
  timed_out: new Set()
});

export function assertAgentInstanceTransition(from, to) {
  invariant(AGENT_INSTANCE_TRANSITIONS[from], "unknown_instance_status:" + from);
  invariant(AGENT_INSTANCE_TRANSITIONS[from].has(to), "invalid_instance_transition:" + from + "->" + to);
}

export function assertDelegationTransition(from, to) {
  invariant(DELEGATION_TRANSITIONS[from], "unknown_delegation_status:" + from);
  invariant(DELEGATION_TRANSITIONS[from].has(to), "invalid_delegation_transition:" + from + "->" + to);
}

export function assertAgentRunTransition(from, to) {
  invariant(AGENT_RUN_TRANSITIONS[from], "unknown_agent_run_status:" + from);
  invariant(AGENT_RUN_TRANSITIONS[from].has(to), "invalid_agent_run_transition:" + from + "->" + to);
}

/**
 * Recursively clones arrays and plain objects to detach caller references.
 */
export function deepClone(value) {
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(deepClone);
  }
  const cloned = {};
  for (const key of Object.keys(value)) {
    cloned[key] = deepClone(value[key]);
  }
  return cloned;
}

/**
 * Recursively freezes an object and all its nested properties/elements.
 */
export function deepFreeze(value) {
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      deepFreeze(item);
    }
    return Object.freeze(value);
  }
  for (const key of Object.keys(value)) {
    deepFreeze(value[key]);
  }
  return Object.freeze(value);
}

/**
 * Defensively clones and deeply freezes a structure against caller mutation.
 */
export function deepCloneAndFreeze(value) {
  return deepFreeze(deepClone(value));
}

/**
 * Deterministically sorts object keys deeply for canonical hashing.
 */
function canonicalizeForHashing(value) {
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(canonicalizeForHashing);
  }
  const sorted = {};
  for (const key of Object.keys(value).sort()) {
    sorted[key] = canonicalizeForHashing(value[key]);
  }
  return sorted;
}

/**
 * Computes a deterministic SHA-256 integrity hash for an AgentBlueprint.
 */
export function computeBlueprintHash(blueprint) {
  invariant(blueprint && typeof blueprint === "object", "blueprint_required_for_hash");
  const limitsInput = blueprint.limits ?? {};
  const hashableLimits = {
    maxTurns: typeof limitsInput.maxTurns === "number" ? limitsInput.maxTurns : 10,
    maxTokens: typeof limitsInput.maxTokens === "number" ? limitsInput.maxTokens : 8192,
    maxCost: typeof limitsInput.maxCost === "number" ? limitsInput.maxCost : 1.0,
    maxConcurrency: typeof limitsInput.maxConcurrency === "number" ? limitsInput.maxConcurrency : 2,
    timeoutMs: typeof limitsInput.timeoutMs === "number" ? limitsInput.timeoutMs : 30000
  };
  if (limitsInput.maxToolCalls !== undefined && limitsInput.maxToolCalls !== null) {
    hashableLimits.maxToolCalls = limitsInput.maxToolCalls;
  }

  const hashableContent = {
    blueprintId: blueprint.blueprintId,
    name: blueprint.name,
    role: blueprint.role,
    mission: blueprint.mission,
    instructions: blueprint.instructions,
    requiredCapabilities: Array.isArray(blueprint.requiredCapabilities) ? [...blueprint.requiredCapabilities].sort() : [],
    skills: Array.isArray(blueprint.skills) ? [...blueprint.skills].sort() : [],
    tools: Array.isArray(blueprint.tools) ? [...blueprint.tools].sort() : [],
    memory: blueprint.memory,
    policies: blueprint.policies,
    providerDefaults: blueprint.providerDefaults,
    runtimePreferences: blueprint.runtimePreferences,
    limits: hashableLimits,
    surfaces: Array.isArray(blueprint.surfaces) ? [...blueprint.surfaces].sort() : [],
    metadata: blueprint.metadata ?? {}
  };
  const canonical = canonicalizeForHashing(hashableContent);
  const json = JSON.stringify(canonical);
  return createHash("sha256").update(json).digest("hex");
}

function validateLimitsObject(limitsInput, defaults = {
  maxTurns: 10,
  maxTokens: 8192,
  maxCost: 1.0,
  maxToolCalls: null,
  maxConcurrency: 2,
  timeoutMs: 30000
}) {
  const src = limitsInput ?? {};
  const maxTurns = src.maxTurns !== undefined && src.maxTurns !== null ? src.maxTurns : defaults.maxTurns;
  const maxTokens = src.maxTokens !== undefined && src.maxTokens !== null ? src.maxTokens : defaults.maxTokens;
  const maxCost = src.maxCost !== undefined && src.maxCost !== null ? src.maxCost : defaults.maxCost;
  const maxToolCalls = src.maxToolCalls !== undefined ? src.maxToolCalls : (src.maxTools !== undefined ? src.maxTools : defaults.maxToolCalls);
  const maxConcurrency = src.maxConcurrency !== undefined && src.maxConcurrency !== null ? src.maxConcurrency : defaults.maxConcurrency;
  const timeoutMs = src.timeoutMs !== undefined && src.timeoutMs !== null ? src.timeoutMs : defaults.timeoutMs;

  invariant(typeof maxTurns === "number" && maxTurns >= 0, "invalid_max_turns");
  invariant(typeof maxTokens === "number" && maxTokens >= 0, "invalid_max_tokens");
  invariant(typeof maxCost === "number" && maxCost >= 0, "invalid_max_cost");
  invariant(maxToolCalls === null || (typeof maxToolCalls === "number" && maxToolCalls >= 0), "invalid_max_tool_calls");
  invariant(typeof maxConcurrency === "number" && maxConcurrency >= 1, "invalid_max_concurrency");
  invariant(typeof timeoutMs === "number" && timeoutMs >= 0, "invalid_timeout_ms");

  const result = {
    maxTurns,
    maxTokens,
    maxCost,
    maxConcurrency,
    timeoutMs
  };
  if (maxToolCalls !== null && maxToolCalls !== undefined) {
    result.maxToolCalls = maxToolCalls;
  }
  return result;
}

function validateBudgetObject(budgetInput) {
  const src = budgetInput ?? {};
  const maxTurns = src.maxTurns !== undefined && src.maxTurns !== null ? src.maxTurns : 5;
  const maxTimeMs = src.maxTimeMs !== undefined && src.maxTimeMs !== null ? src.maxTimeMs : 30000;
  const maxTokens = src.maxTokens !== undefined && src.maxTokens !== null ? src.maxTokens : 4096;
  const maxCost = src.maxCost !== undefined && src.maxCost !== null ? src.maxCost : 0.5;
  const maxToolCalls = src.maxToolCalls !== undefined ? src.maxToolCalls : (src.maxTools !== undefined ? src.maxTools : null);
  const maxConcurrency = src.maxConcurrency !== undefined && src.maxConcurrency !== null ? src.maxConcurrency : 1;

  invariant(typeof maxTurns === "number" && maxTurns >= 0, "invalid_budget_max_turns");
  invariant(typeof maxTimeMs === "number" && maxTimeMs >= 0, "invalid_budget_max_time_ms");
  invariant(typeof maxTokens === "number" && maxTokens >= 0, "invalid_budget_max_tokens");
  invariant(typeof maxCost === "number" && maxCost >= 0, "invalid_budget_max_cost");
  invariant(maxToolCalls === null || (typeof maxToolCalls === "number" && maxToolCalls >= 0), "invalid_budget_max_tool_calls");
  invariant(typeof maxConcurrency === "number" && maxConcurrency >= 1, "invalid_budget_max_concurrency");

  const result = {
    maxTurns,
    maxTimeMs,
    maxTokens,
    maxCost,
    maxConcurrency
  };
  if (maxToolCalls !== null && maxToolCalls !== undefined) {
    result.maxToolCalls = maxToolCalls;
  }
  return result;
}

export function normalizeUsageDelta(deltaInput) {
  if (deltaInput === undefined || deltaInput === null) {
    return null;
  }
  invariant(typeof deltaInput === "object", "usage_delta_must_be_object");
  const turns = deltaInput.turns !== undefined && deltaInput.turns !== null ? deltaInput.turns : 0;
  const tokens = deltaInput.tokens !== undefined && deltaInput.tokens !== null ? deltaInput.tokens : 0;
  const cost = deltaInput.cost !== undefined && deltaInput.cost !== null ? deltaInput.cost : 0;
  const elapsedMs = deltaInput.elapsedMs !== undefined && deltaInput.elapsedMs !== null
    ? deltaInput.elapsedMs
    : (deltaInput.timeMs !== undefined && deltaInput.timeMs !== null ? deltaInput.timeMs : 0);
  const toolCalls = deltaInput.toolCalls !== undefined && deltaInput.toolCalls !== null
    ? deltaInput.toolCalls
    : (deltaInput.tools !== undefined && deltaInput.tools !== null ? deltaInput.tools : 0);

  invariant(typeof turns === "number" && turns >= 0, "usage_delta_turns_must_be_non_negative");
  invariant(typeof tokens === "number" && tokens >= 0, "usage_delta_tokens_must_be_non_negative");
  invariant(typeof cost === "number" && cost >= 0, "usage_delta_cost_must_be_non_negative");
  invariant(typeof elapsedMs === "number" && elapsedMs >= 0, "usage_delta_elapsed_ms_must_be_non_negative");
  invariant(typeof toolCalls === "number" && toolCalls >= 0, "usage_delta_tool_calls_must_be_non_negative");

  return {
    turns,
    tokens,
    cost,
    elapsedMs,
    toolCalls
  };
}

export function validateAgentBlueprint(bp) {
  invariant(bp && typeof bp === "object", "agent_blueprint_required");
  invariant(typeof bp.blueprintId === "string" && bp.blueprintId.length > 0, "blueprint_id_required");
  invariant(typeof bp.name === "string" && bp.name.length > 0, "blueprint_name_required");
  invariant(typeof bp.role === "string" && bp.role.length > 0, "blueprint_role_required");
  invariant(typeof bp.mission === "string" && bp.mission.length > 0, "blueprint_mission_required");
  invariant(typeof bp.instructions === "string", "blueprint_instructions_required");

  const requiredCapabilities = Array.isArray(bp.requiredCapabilities) ? [...bp.requiredCapabilities] : [];
  const skills = Array.isArray(bp.skills) ? [...bp.skills] : [];
  const tools = Array.isArray(bp.tools) ? [...bp.tools] : [];

  const memory = bp.memory ? {
    scope: bp.memory.scope ?? "isolated",
    retainContext: Boolean(bp.memory.retainContext !== false),
    maxContextTokens: typeof bp.memory.maxContextTokens === "number" ? bp.memory.maxContextTokens : 4096
  } : {
    scope: "isolated",
    retainContext: true,
    maxContextTokens: 4096
  };
  invariant(["isolated", "shared", "session", "workspace"].includes(memory.scope), "invalid_memory_scope:" + memory.scope);

  const policies = bp.policies ? {
    mode: bp.policies.mode ?? "guarded",
    requireConfirmationFor: Array.isArray(bp.policies.requireConfirmationFor) ? [...bp.policies.requireConfirmationFor] : []
  } : {
    mode: "guarded",
    requireConfirmationFor: []
  };
  invariant(["read-only", "guarded", "workspace", "full"].includes(policies.mode), "invalid_policy_mode:" + policies.mode);

  const providerDefaults = bp.providerDefaults ? {
    modelProviderId: bp.providerDefaults.modelProviderId ?? "provider_primary",
    model: bp.providerDefaults.model ?? "pulso-standard-fast"
  } : {
    modelProviderId: "provider_primary",
    model: "pulso-standard-fast"
  };
  invariant(typeof providerDefaults.modelProviderId === "string" && providerDefaults.modelProviderId.length > 0, "model_provider_id_required");
  invariant(typeof providerDefaults.model === "string" && providerDefaults.model.length > 0, "model_required");

  const runtimePreferences = bp.runtimePreferences ? {
    executorProviderId: bp.runtimePreferences.executorProviderId ?? "fake-executor",
    timeoutMs: typeof bp.runtimePreferences.timeoutMs === "number" ? bp.runtimePreferences.timeoutMs : 30000
  } : {
    executorProviderId: "fake-executor",
    timeoutMs: 30000
  };
  invariant(typeof runtimePreferences.executorProviderId === "string" && runtimePreferences.executorProviderId.length > 0, "executor_provider_id_required");

  const limits = validateLimitsObject(bp.limits);
  const surfaces = Array.isArray(bp.surfaces) ? [...bp.surfaces] : ["internal"];
  const metadata = bp.metadata ? deepClone(bp.metadata) : {};

  const provenance = bp.provenance ? {
    kind: bp.provenance.kind ?? "human",
    createdBy: bp.provenance.createdBy ?? "fe",
    lineage: Array.isArray(bp.provenance.lineage) ? [...bp.provenance.lineage] : []
  } : {
    kind: "human",
    createdBy: "fe",
    lineage: []
  };
  invariant(["human", "agent", "import"].includes(provenance.kind), "invalid_provenance_kind:" + provenance.kind);

  const canonical = {
    blueprintId: bp.blueprintId,
    name: bp.name,
    role: bp.role,
    mission: bp.mission,
    instructions: bp.instructions,
    requiredCapabilities,
    skills,
    tools,
    memory,
    policies,
    providerDefaults,
    runtimePreferences,
    limits,
    surfaces,
    metadata,
    provenance
  };

  assertNoSecrets(canonical);
  return deepCloneAndFreeze(canonical);
}

export function validateAgentRevision(rev) {
  invariant(rev && typeof rev === "object", "agent_revision_required");
  invariant(typeof rev.revisionId === "string" && rev.revisionId.length > 0, "revision_id_required");
  invariant(typeof rev.blueprintId === "string" && rev.blueprintId.length > 0, "blueprint_id_required");
  invariant(Number.isInteger(rev.version) && rev.version >= 1, "version_must_be_positive_integer");
  invariant(typeof rev.hash === "string" && /^[a-f0-9]{64}$/.test(rev.hash), "valid_sha256_hash_required");
  invariant(typeof rev.changelog === "string", "changelog_required");
  invariant(typeof rev.createdAt === "string" && rev.createdAt.length > 0, "created_at_required");

  const validatedBlueprint = validateAgentBlueprint(rev.blueprint);
  const expectedHash = computeBlueprintHash(validatedBlueprint);
  invariant(rev.hash === expectedHash, `revision_hash_mismatch: got ${rev.hash}, expected ${expectedHash}`);

  const provenance = rev.provenance ? {
    kind: rev.provenance.kind ?? "human",
    createdBy: rev.provenance.createdBy ?? "fe"
  } : {
    kind: "human",
    createdBy: "fe"
  };
  invariant(["human", "agent", "import"].includes(provenance.kind), "invalid_provenance_kind");

  const canonical = {
    revisionId: rev.revisionId,
    blueprintId: rev.blueprintId,
    version: rev.version,
    hash: rev.hash,
    blueprint: validatedBlueprint,
    changelog: rev.changelog,
    provenance,
    createdAt: rev.createdAt
  };

  assertNoSecrets(canonical);
  return deepCloneAndFreeze(canonical);
}

export function validateAgentInstance(inst) {
  invariant(inst && typeof inst === "object", "agent_instance_required");
  invariant(typeof inst.instanceId === "string" && inst.instanceId.length > 0, "instance_id_required");
  invariant(typeof inst.agentId === "string" && inst.agentId.length > 0, "agent_id_required");
  invariant(typeof inst.blueprintId === "string" && inst.blueprintId.length > 0, "blueprint_id_required");
  invariant(typeof inst.revisionId === "string" && inst.revisionId.length > 0, "revision_id_required");
  invariant(Number.isInteger(inst.version) && inst.version >= 1, "version_must_be_positive_integer");
  invariant(typeof inst.identityId === "string" && inst.identityId.length > 0, "identity_id_required");
  invariant(typeof inst.createdAt === "string" && inst.createdAt.length > 0, "created_at_required");

  const status = inst.status ?? "draft";
  invariant(AGENT_INSTANCE_STATUSES.includes(status), "invalid_instance_status:" + status);

  invariant(inst.resolvedBindings && typeof inst.resolvedBindings === "object", "resolved_bindings_required");
  invariant(inst.resolvedBindings.model && typeof inst.resolvedBindings.model === "object", "model_binding_required");
  invariant(typeof inst.resolvedBindings.model.providerId === "string", "model_provider_id_required");
  invariant(typeof inst.resolvedBindings.model.model === "string", "model_name_required");
  invariant(inst.resolvedBindings.runtime && typeof inst.resolvedBindings.runtime === "object", "runtime_binding_required");
  invariant(typeof inst.resolvedBindings.runtime.providerId === "string", "runtime_provider_id_required");
  invariant(typeof inst.resolvedBindings.runtime.executorType === "string", "executor_type_required");

  const updatedAt = inst.updatedAt ?? inst.createdAt;
  invariant(typeof updatedAt === "string" && updatedAt.length > 0, "updated_at_required");

  const healthInput = inst.health ?? {};
  const checkedAt = healthInput.checkedAt ?? inst.createdAt;
  invariant(typeof checkedAt === "string" && checkedAt.length > 0, "health_checked_at_required");
  const health = {
    status: healthInput.status ?? "healthy",
    checkedAt,
    detail: healthInput.detail ?? null
  };
  invariant(["healthy", "degraded", "failed"].includes(health.status), "invalid_health_status:" + health.status);

  const concurrencyInput = inst.concurrency ?? {};
  const concurrency = {
    current: typeof concurrencyInput.current === "number" ? concurrencyInput.current : 0,
    limit: typeof concurrencyInput.limit === "number" ? concurrencyInput.limit : 2
  };

  const limits = validateLimitsObject(inst.limits);
  const metadata = inst.metadata ? deepClone(inst.metadata) : {};

  const canonical = {
    instanceId: inst.instanceId,
    agentId: inst.agentId,
    blueprintId: inst.blueprintId,
    revisionId: inst.revisionId,
    version: inst.version,
    identityId: inst.identityId,
    status,
    resolvedBindings: {
      model: {
        providerId: inst.resolvedBindings.model.providerId,
        model: inst.resolvedBindings.model.model
      },
      runtime: {
        providerId: inst.resolvedBindings.runtime.providerId,
        executorType: inst.resolvedBindings.runtime.executorType
      }
    },
    health,
    concurrency,
    limits,
    createdAt: inst.createdAt,
    updatedAt,
    metadata
  };

  assertNoSecrets(canonical);
  return deepClone(canonical);
}

export function validateAgentGrant(grant) {
  invariant(grant && typeof grant === "object", "agent_grant_required");
  invariant(typeof grant.grantId === "string" && grant.grantId.length > 0, "grant_id_required");
  invariant(typeof grant.agentId === "string" && grant.agentId.length > 0, "agent_id_required");
  invariant(typeof grant.capability === "string" && grant.capability.length > 0, "capability_required");
  invariant(typeof grant.grantedAt === "string" && grant.grantedAt.length > 0, "granted_at_required");

  const effect = grant.effect ?? "allow";
  invariant(AGENT_GRANT_EFFECTS.includes(effect), "invalid_grant_effect:" + effect);

  const scopeInput = grant.scope ?? { type: "global", scopeId: null };
  invariant(["global", "workspace", "session", "task"].includes(scopeInput.type), "invalid_grant_scope_type");
  const scope = {
    type: scopeInput.type,
    scopeId: scopeInput.scopeId ?? null
  };

  const grantedBy = grant.grantedBy ? {
    kind: grant.grantedBy.kind ?? "operator",
    id: grant.grantedBy.id ?? "fe"
  } : { kind: "operator", id: "fe" };

  const expiresAt = grant.expiresAt ?? null;
  invariant(expiresAt === null || (typeof expiresAt === "string" && expiresAt.length > 0), "invalid_expires_at");

  const canonical = {
    grantId: grant.grantId,
    agentId: grant.agentId,
    capability: grant.capability,
    effect,
    scope,
    grantedBy,
    grantedAt: grant.grantedAt,
    expiresAt
  };

  assertNoSecrets(canonical);
  return deepClone(canonical);
}

export function validateDelegationContract(del) {
  invariant(del && typeof del === "object", "delegation_contract_required");
  invariant(typeof del.delegationId === "string" && del.delegationId.length > 0, "delegation_id_required");
  invariant(typeof del.parentAgentId === "string" && del.parentAgentId.length > 0, "parent_agent_id_required");
  invariant(typeof del.childAgentId === "string" && del.childAgentId.length > 0, "child_agent_id_required");
  invariant(typeof del.objective === "string" && del.objective.length > 0, "objective_required");

  const createdAt = del.provenance?.createdAt ?? del.createdAt;
  invariant(typeof createdAt === "string" && createdAt.length > 0, "delegation_created_at_required");

  const allowedContext = del.allowedContext ? {
    shareHistory: Boolean(del.allowedContext.shareHistory),
    allowedVariables: Array.isArray(del.allowedContext.allowedVariables) ? [...del.allowedContext.allowedVariables] : [],
    artifactRefs: Array.isArray(del.allowedContext.artifactRefs) ? [...del.allowedContext.artifactRefs] : []
  } : {
    shareHistory: false,
    allowedVariables: [],
    artifactRefs: []
  };

  const grantedCapabilities = Array.isArray(del.grantedCapabilities) ? [...del.grantedCapabilities] : [];
  const budget = validateBudgetObject(del.budget);

  const status = del.status ?? "proposed";
  invariant(DELEGATION_STATUSES.includes(status), "invalid_delegation_status:" + status);

  const cancellationPolicy = del.cancellationPolicy ? {
    propagateToChild: del.cancellationPolicy.propagateToChild !== false,
    onParentCancel: del.cancellationPolicy.onParentCancel ?? "cancel"
  } : {
    propagateToChild: true,
    onParentCancel: "cancel"
  };
  invariant(["cancel", "drain", "orphan"].includes(cancellationPolicy.onParentCancel), "invalid_on_parent_cancel");

  const checkpoints = Array.isArray(del.checkpoints) ? deepClone(del.checkpoints) : [];
  const expectedOutput = del.expectedOutput !== undefined ? deepClone(del.expectedOutput) : null;
  const receipt = del.receipt !== undefined ? deepClone(del.receipt) : null;

  const provenance = {
    initiator: del.provenance?.initiator ? deepClone(del.provenance.initiator) : { kind: "agent", id: del.parentAgentId },
    createdAt,
    decidedAt: del.provenance?.decidedAt ?? null,
    finishedAt: del.provenance?.finishedAt ?? null
  };

  const canonical = {
    delegationId: del.delegationId,
    parentAgentId: del.parentAgentId,
    childAgentId: del.childAgentId,
    objective: del.objective,
    allowedContext,
    grantedCapabilities,
    budget,
    expectedOutput,
    status,
    checkpoints,
    cancellationPolicy,
    receipt,
    provenance
  };

  if (del.metadata !== undefined) {
    assertNoSecrets(del.metadata);
  }
  assertNoSecrets(canonical);
  return deepClone(canonical);
}

export function validateAgentRun(run) {
  invariant(run && typeof run === "object", "agent_run_required");
  invariant(typeof run.agentRunId === "string" && run.agentRunId.length > 0, "agent_run_id_required");
  invariant(typeof run.agentId === "string" && run.agentId.length > 0, "agent_id_required");
  invariant(typeof run.createdAt === "string" && run.createdAt.length > 0, "created_at_required");

  const status = run.status ?? "queued";
  invariant(AGENT_RUN_STATUSES.includes(status), "invalid_agent_run_status:" + status);

  const budget = validateBudgetObject(run.budget);

  const usageInput = run.usage ?? {};
  const usage = {
    turns: typeof usageInput.turns === "number" ? usageInput.turns : 0,
    tokens: typeof usageInput.tokens === "number" ? usageInput.tokens : 0,
    cost: typeof usageInput.cost === "number" ? usageInput.cost : 0,
    elapsedMs: typeof usageInput.elapsedMs === "number" ? usageInput.elapsedMs : 0,
    toolCalls: typeof usageInput.toolCalls === "number" ? usageInput.toolCalls : 0
  };
  invariant(
    usage.turns >= 0 && usage.tokens >= 0 && usage.cost >= 0 && usage.elapsedMs >= 0 && usage.toolCalls >= 0,
    "invalid_run_usage"
  );

  const checkpoints = Array.isArray(run.checkpoints) ? deepClone(run.checkpoints) : [];
  const canonical = {
    agentRunId: run.agentRunId,
    agentId: run.agentId,
    delegationId: run.delegationId ?? null,
    parentRunId: run.parentRunId ?? null,
    status,
    budget,
    usage,
    checkpoints,
    result: run.result !== undefined ? deepClone(run.result) : null,
    error: run.error !== undefined ? deepClone(run.error) : null,
    createdAt: run.createdAt,
    startedAt: run.startedAt ?? null,
    completedAt: run.completedAt ?? null
  };

  assertNoSecrets(canonical);
  return deepClone(canonical);
}
