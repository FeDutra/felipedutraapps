import { invariant } from "../domain/assertions.mjs";
import { pulsoId, DEFAULT_SOVEREIGN_IDENTITY } from "../domain/contracts.mjs";
import { assertNoSecrets } from "./secrets.mjs";

export { DEFAULT_SOVEREIGN_IDENTITY };

export const POLICY_MODES = Object.freeze(["read-only", "guarded", "workspace", "full"]);

export const PROVIDER_KINDS = Object.freeze(["model", "executor", "local"]);

export const CAPABILITY_STATUSES = Object.freeze(["absent", "planned", "partial", "ready", "verified"]);

export const SCOPE_TYPES = Object.freeze(["global", "system", "agent", "session", "task"]);

export const PANEL_SECTION_IDS = Object.freeze([
  "overview",
  "providers_models",
  "agents",
  "tools_extensions",
  "tasks_queues",
  "automations",
  "channels_devices",
  "memory_sync",
  "security_permissions",
  "diagnostics",
  "audit"
]);

export const PANEL_SECTION_TITLES = Object.freeze({
  overview: "Visão geral",
  providers_models: "Providers e modelos",
  agents: "Agentes",
  tools_extensions: "Ferramentas e extensões",
  tasks_queues: "Tarefas e filas",
  automations: "Automações",
  channels_devices: "Canais e dispositivos",
  memory_sync: "Memória e sincronização",
  security_permissions: "Segurança e permissões",
  diagnostics: "Diagnósticos",
  audit: "Auditoria"
});

export const CAPABILITY_PARITY_DOMAINS = Object.freeze([
  "providers_models",
  "identity",
  "sessions_turns_runs",
  "memory",
  "tools",
  "skills_extensions",
  "agents",
  "tasks_queues",
  "automations",
  "channels",
  "nodes_devices",
  "voice_media",
  "policies_permissions",
  "secrets",
  "audit",
  "diagnostics_health",
  "sync_update"
]);

export const TASK_STATUSES = Object.freeze([
  "queued",
  "running",
  "paused",
  "completed",
  "failed",
  "cancelled"
]);

export function formatScopeKey(scope) {
  if (typeof scope === "string") {
    if (scope === "default" || scope === "global") return "global";
    if (scope === "system") return "system";
    return scope;
  }
  if (scope && typeof scope === "object") {
    if (scope.type === "global") return "global";
    if (scope.type === "system") return "system";
    if (scope.scopeId) return `${scope.type}:${scope.scopeId}`;
    return scope.type;
  }
  return "global";
}

export function parseScope(scopeInput) {
  if (typeof scopeInput === "string") {
    if (scopeInput === "default" || scopeInput === "global") {
      return { type: "global", scopeId: null };
    }
    if (scopeInput === "system") {
      return { type: "system", scopeId: null };
    }
    const [type, ...rest] = scopeInput.split(":");
    if (SCOPE_TYPES.includes(type)) {
      return { type, scopeId: rest.join(":") || null };
    }
    return { type: "global", scopeId: null };
  }
  if (scopeInput && typeof scopeInput === "object") {
    invariant(SCOPE_TYPES.includes(scopeInput.type), "invalid_scope_type:" + scopeInput.type);
    if (scopeInput.type !== "global" && scopeInput.type !== "system") {
      invariant(
        scopeInput.scopeId === null || typeof scopeInput.scopeId === "string",
        "scopeId_must_be_string_or_null"
      );
    }
    return {
      type: scopeInput.type,
      scopeId: (scopeInput.type === "global" || scopeInput.type === "system") ? null : (scopeInput.scopeId ?? null)
    };
  }
  return { type: "global", scopeId: null };
}

export function validateProviderProfile(profile) {
  invariant(profile && typeof profile === "object", "provider_profile_required");

  // Canonical field is providerId (accept legacy 'id' at boundary)
  const providerId = profile.providerId ?? profile.id;
  invariant(typeof providerId === "string" && providerId.length > 0, "provider_id_required");

  // Canonical field is displayName (accept legacy 'name' at boundary)
  const displayName = profile.displayName ?? profile.name;
  invariant(typeof displayName === "string" && displayName.length > 0, "display_name_required");

  // Canonical field is kind: model|executor|local (accept legacy 'type' at boundary)
  let kind = profile.kind ?? profile.type;
  if (kind === "hybrid") kind = "local";
  invariant(PROVIDER_KINDS.includes(kind), "invalid_provider_kind:" + kind);

  // Optional endpoint (can come from config.endpoint at boundary)
  const endpoint = profile.endpoint ?? profile.config?.endpoint ?? null;
  invariant(endpoint === null || typeof endpoint === "string", "invalid_endpoint");

  // Optional declarative secretRef (can come from config.secretRef at boundary)
  const secretRef = profile.secretRef ?? profile.config?.secretRef ?? null;
  invariant(secretRef === null || typeof secretRef === "string", "invalid_secret_ref");

  // Enabled boolean
  const enabled = profile.enabled !== undefined
    ? Boolean(profile.enabled)
    : (profile.status !== "inactive");

  // Health object with status and optional checkedAt/detail
  const healthInput = profile.health ?? {};
  const healthStatus = healthInput.status ?? (profile.status === "degraded" ? "degraded" : "healthy");
  const health = {
    status: healthStatus,
    checkedAt: healthInput.checkedAt ?? new Date().toISOString(),
    detail: healthInput.detail ?? null
  };

  const capabilities = Array.isArray(profile.capabilities) ? profile.capabilities : [];
  const metadata = profile.metadata ?? {};

  const canonical = {
    providerId,
    kind,
    displayName,
    endpoint,
    capabilities,
    enabled,
    health,
    metadata,
    secretRef
  };

  assertNoSecrets(canonical);
  return canonical;
}

export function validateModelBinding(binding) {
  invariant(binding && typeof binding === "object", "model_binding_required");

  // Structured scope
  const scope = parseScope(binding.scope);
  const scopeKey = formatScopeKey(scope);

  // Primary model selection
  let primary = binding.primary;
  if (!primary && (binding.primaryProviderId && binding.primaryModel)) {
    primary = {
      providerId: binding.primaryProviderId,
      model: binding.primaryModel
    };
  }
  invariant(primary && typeof primary === "object", "primary_model_selection_required");
  invariant(typeof primary.providerId === "string" && primary.providerId.length > 0, "primary_provider_id_required");
  invariant(typeof primary.model === "string" && primary.model.length > 0, "primary_model_required");

  // Ordered fallbackChain
  let fallbackChain = [];
  if (Array.isArray(binding.fallbackChain)) {
    fallbackChain = binding.fallbackChain.map((item, index) => {
      invariant(item && typeof item === "object", `fallback_item_${index}_invalid`);
      invariant(typeof item.providerId === "string" && item.providerId.length > 0, `fallback_${index}_provider_id_required`);
      invariant(typeof item.model === "string" && item.model.length > 0, `fallback_${index}_model_required`);
      return {
        providerId: item.providerId,
        model: item.model
      };
    });
  } else if (binding.fallbackProviderId && binding.fallbackModel) {
    fallbackChain = [{
      providerId: binding.fallbackProviderId,
      model: binding.fallbackModel
    }];
  }

  // Active selection
  let active = binding.active;
  if (!active) {
    if (binding.activeProviderId && binding.activeModel) {
      const selectedIndex = fallbackChain.findIndex(
        f => f.providerId === binding.activeProviderId && f.model === binding.activeModel
      );
      active = {
        providerId: binding.activeProviderId,
        model: binding.activeModel,
        selectedFallbackIndex: selectedIndex >= 0 ? selectedIndex : null,
        reason: binding.status === "fallback_active" ? "fallback" : "primary"
      };
    } else {
      active = {
        providerId: primary.providerId,
        model: primary.model,
        selectedFallbackIndex: null,
        reason: "primary"
      };
    }
  } else {
    invariant(typeof active.providerId === "string" && active.providerId.length > 0, "active_provider_id_required");
    invariant(typeof active.model === "string" && active.model.length > 0, "active_model_required");
  }

  const status = binding.status ?? (active.selectedFallbackIndex !== null ? "fallback_active" : "active");
  const metadata = binding.metadata ?? {};

  const canonical = {
    scope,
    scopeKey,
    primary,
    fallbackChain,
    active: {
      providerId: active.providerId,
      model: active.model,
      selectedFallbackIndex: active.selectedFallbackIndex ?? null,
      reason: active.reason ?? "primary"
    },
    status,
    metadata
  };

  assertNoSecrets(canonical);
  return canonical;
}

export function validateAgentProfile(agent) {
  invariant(agent && typeof agent === "object", "agent_profile_required");
  invariant(typeof agent.agentId === "string" && agent.agentId.length > 0, "agent_id_required");
  invariant(typeof agent.name === "string" && agent.name.length > 0, "agent_name_required");

  // Sovereign identity: default to lotus
  const identityId = agent.identityId ?? DEFAULT_SOVEREIGN_IDENTITY;
  invariant(typeof identityId === "string" && identityId.length > 0, "identity_id_required");

  const modelScope = parseScope(agent.modelScope ?? "global");

  const canonical = {
    agentId: agent.agentId,
    name: agent.name,
    identityId,
    role: agent.role ?? "Autonomous Assistant",
    capabilities: Array.isArray(agent.capabilities) ? agent.capabilities : [],
    policyProfileId: agent.policyProfileId ?? "policy_guarded",
    modelScope,
    allowedTools: Array.isArray(agent.allowedTools) ? agent.allowedTools : ["*"],
    status: agent.status ?? "active",
    metadata: agent.metadata ?? {}
  };

  assertNoSecrets(canonical);
  return canonical;
}

export function validatePolicyProfile(policy) {
  invariant(policy && typeof policy === "object", "policy_profile_required");
  invariant(typeof policy.profileId === "string" && policy.profileId.length > 0, "profile_id_required");
  invariant(typeof policy.name === "string" && policy.name.length > 0, "policy_name_required");
  invariant(POLICY_MODES.includes(policy.mode), "invalid_policy_mode:" + policy.mode);

  const canonical = {
    profileId: policy.profileId,
    name: policy.name,
    mode: policy.mode,
    allowedActions: Array.isArray(policy.allowedActions) ? policy.allowedActions : ["*"],
    deniedActions: Array.isArray(policy.deniedActions) ? policy.deniedActions : [],
    requireConfirmationFor: Array.isArray(policy.requireConfirmationFor)
      ? policy.requireConfirmationFor
      : ["policy:*", "security:*", "task:cancel", "provider:remove", "system:reset"],
    metadata: policy.metadata ?? {}
  };

  assertNoSecrets(canonical);
  return canonical;
}

export function validateToolRecord(tool) {
  invariant(tool && typeof tool === "object", "tool_record_required");
  invariant(typeof tool.toolId === "string" && tool.toolId.length > 0, "tool_id_required");
  invariant(typeof tool.name === "string" && tool.name.length > 0, "tool_name_required");
  invariant(["tool", "extension"].includes(tool.kind ?? "tool"), "invalid_tool_kind");

  const canonical = {
    toolId: tool.toolId,
    name: tool.name,
    kind: tool.kind ?? "tool",
    category: tool.category ?? "system",
    description: tool.description ?? "",
    enabled: tool.enabled !== false,
    dangerous: Boolean(tool.dangerous),
    requiresConfirmation: Boolean(tool.requiresConfirmation ?? tool.dangerous),
    permissionsRequired: Array.isArray(tool.permissionsRequired) ? tool.permissionsRequired : [],
    metadata: tool.metadata ?? {}
  };

  assertNoSecrets(canonical);
  return canonical;
}

export function validateOperationalTask(task) {
  invariant(task && typeof task === "object", "operational_task_required");
  invariant(typeof task.taskId === "string" && task.taskId.length > 0, "task_id_required");
  invariant(typeof task.taskType === "string" && task.taskType.length > 0, "task_type_required");
  invariant(TASK_STATUSES.includes(task.status ?? "queued"), "invalid_task_status:" + task.status);

  const canonical = {
    taskId: task.taskId,
    taskType: task.taskType,
    priority: task.priority ?? "normal",
    status: task.status ?? "queued",
    progress: task.progress ?? 0,
    checkpoints: Array.isArray(task.checkpoints) ? task.checkpoints : [],
    cancellationReceipt: task.cancellationReceipt ?? null,
    result: task.result ?? null,
    error: task.error ?? null,
    metadata: task.metadata ?? {},
    createdAt: task.createdAt ?? new Date().toISOString(),
    updatedAt: task.updatedAt ?? new Date().toISOString()
  };

  assertNoSecrets(canonical);
  return canonical;
}

export function validateCapabilityRecord(cap) {
  invariant(cap && typeof cap === "object", "capability_record_required");
  invariant(typeof cap.capabilityId === "string" && cap.capabilityId.length > 0, "capability_id_required");
  invariant(typeof cap.name === "string" && cap.name.length > 0, "name_required");

  // Canonical status enum: absent|planned|partial|ready|verified
  let status = cap.status;
  if (status === "supported") status = "verified";
  if (status === "gap") status = "planned";
  if (status === "unsupported") status = "absent";
  invariant(CAPABILITY_STATUSES.includes(status), "invalid_capability_status:" + status);

  // Canonical owner (boundary fallback: pulsoOwner)
  const owner = cap.owner ?? cap.pulsoOwner ?? "ControlPlaneService";
  invariant(typeof owner === "string" && owner.length > 0, "owner_required");

  const evidence = Array.isArray(cap.evidence) ? cap.evidence : [];
  const checklist = Array.isArray(cap.checklist) ? cap.checklist : [];

  const canonical = {
    capabilityId: cap.capabilityId,
    name: cap.name,
    category: cap.category ?? "control_plane",
    status,
    owner,
    evidence,
    checklist,
    functionalReference: cap.functionalReference ?? "Gateway control plane reference",
    nextAcceptance: cap.nextAcceptance ?? "",
    metadata: cap.metadata ?? {}
  };

  assertNoSecrets(canonical);
  return canonical;
}
