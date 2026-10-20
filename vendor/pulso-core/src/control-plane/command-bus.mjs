import {
  eventDraft,
  invariant,
  pulsoId,
  assertExternalIdsConfined
} from "../domain/contracts.mjs";
import { assertNoSecrets } from "./secrets.mjs";
import {
  validateProviderProfile,
  validateModelBinding,
  validateAgentProfile,
  validatePolicyProfile,
  validateToolRecord,
  validateOperationalTask,
  formatScopeKey,
  DEFAULT_SOVEREIGN_IDENTITY
} from "./control-plane-contracts.mjs";
import { applyControlPlaneEvent } from "./panel-projector.mjs";
import { AgentFoundryService } from "../agents/agent-foundry-service.mjs";

const DEFAULT_ACTOR = Object.freeze({ kind: "operator", id: "fe" });

const SENSITIVE_COMMANDS = new Set([
  "activate_model_fallback",
  "remove_provider",
  "cancel_outbox_item",
  "deep_diagnostics",
  "cancel_task",
  "cancel_all_tasks",
  "reset_panel",
  "set_active_policy",
  "pause_all_agents",
  "cancel_delegation",
  "retire_agent",
  "revoke_capability",
  "disable_dangerous_tools",
  "revoke_device",
  "purge_cache",
  "archive_audit"
]);

export class CommandBus {
  constructor({
    store,
    state,
    initialPolicy = "guarded",
    foundry = null,
    secretResolver = null,
    router = null,
    outbox = null,
    runtime = null
  }) {
    this.store = store;
    this.state = state;
    this.initialPolicy = initialPolicy;
    this.foundry = foundry || new AgentFoundryService({ store });
    this.secretResolver = secretResolver;
    this.router = router;
    this.outbox = outbox;
    this.runtime = runtime;
  }

  getActivePolicy() {
    return this.state.policies.get(this.state.activePolicyId) || {
      profileId: "policy_guarded",
      mode: this.initialPolicy,
      requireConfirmationFor: ["*"]
    };
  }

  isActionSensitive(commandName, payload = {}) {
    if (SENSITIVE_COMMANDS.has(commandName)) return true;
    if (commandName === "execute_tool" && payload.toolId) {
      const tool = this.state.tools.get(payload.toolId);
      if (tool?.dangerous || tool?.requiresConfirmation) return true;
    }
    const policy = this.getActivePolicy();
    if (policy.requireConfirmationFor?.includes("*") || policy.requireConfirmationFor?.includes(commandName)) {
      return true;
    }
    return false;
  }

  checkPolicy(commandName, payload, confirmed) {
    const policy = this.getActivePolicy();
    const mode = policy.mode;

    // 1. In read-only mode, mutations are blocked (except administrative policy unlock with confirmed: true)
    if (mode === "read-only") {
      if (commandName === "set_active_policy" && confirmed === true) {
        return;
      }
      throw new Error(`policy_violation: mutations_forbidden_in_read_only_mode (command: ${commandName})`);
    }

    // 2. Sensitive commands require explicit confirmation
    if (this.isActionSensitive(commandName, payload)) {
      if (confirmed !== true) {
        throw new Error(
          `confirmation_required: command '${commandName}' is sensitive and requires explicit confirmation (confirmed: true)`
        );
      }
    }

    // 3. In workspace mode, administrative commands (policy changes, root provider changes) require confirmation
    if (mode === "workspace" && (commandName === "set_active_policy" || commandName === "set_policy_profile")) {
      if (confirmed !== true) {
        throw new Error(
          `confirmation_required: administrative command '${commandName}' requires confirmation in workspace mode`
        );
      }
    }
  }

  async execute({
    commandId = pulsoId("cmd"),
    name,
    actor = DEFAULT_ACTOR,
    idempotencyKey = null,
    payload = {},
    confirmed = false
  }) {
    invariant(name && typeof name === "string", "command_name_required");

    // Strictly forbid raw secrets in any command payload
    assertNoSecrets(payload);

    // Enforce security policy & sensitive action confirmation
    this.checkPolicy(name, payload, confirmed);

    // Idempotency check if idempotencyKey is supplied
    const scope = "cp|" + name;
    if (idempotencyKey) {
      const existing = this.store.findIdempotency(scope, idempotencyKey);
      if (existing) {
        return {
          duplicate: true,
          commandId,
          entityId: existing,
          result: { idempotentReplay: true },
          events: []
        };
      }
    }

    const drafts = [];
    let target = { type: "control_plane", id: "system" };
    let result = { ok: true };

    switch (name) {
      case "register_provider": {
        const validated = validateProviderProfile(payload);
        target = { type: "provider_profile", id: validated.providerId };
        drafts.push(eventDraft({
          type: "control_plane.provider_registered",
          aggregateType: "provider_profile",
          aggregateId: validated.providerId,
          correlationId: commandId,
          causationId: commandId,
          actor,
          payload: validated
        }));
        result = validated;
        break;
      }

      case "update_provider": {
        const providerId = payload.providerId ?? payload.id;
        invariant(providerId, "provider_id_required");
        const existing = this.state.providers.get(providerId);
        invariant(existing, "provider_not_found:" + providerId);
        const updated = validateProviderProfile({ ...existing, ...payload, providerId });
        target = { type: "provider_profile", id: updated.providerId };
        drafts.push(eventDraft({
          type: "control_plane.provider_updated",
          aggregateType: "provider_profile",
          aggregateId: updated.providerId,
          correlationId: commandId,
          causationId: commandId,
          actor,
          payload: updated
        }));
        result = updated;
        break;
      }

      case "select_provider_model":
      case "set_model_binding": {
        const normalizedPayload = {
          ...payload,
          scope: payload.scope ?? "global",
          primary: payload.primary ?? (
            payload.providerId && payload.model
              ? { providerId: payload.providerId, model: payload.model }
              : undefined
          )
        };
        const validated = validateModelBinding(normalizedPayload);
        target = { type: "model_binding", id: validated.scopeKey };
        drafts.push(eventDraft({
          type: "control_plane.model_binding_set",
          aggregateType: "model_binding",
          aggregateId: validated.scopeKey,
          correlationId: commandId,
          causationId: commandId,
          actor,
          payload: validated
        }));
        result = {
          ...validated,
          receipt: {
            receiptId: pulsoId("rcpt"),
            action: name,
            scopeKey: validated.scopeKey,
            primary: validated.primary,
            fallbackChain: validated.fallbackChain
          }
        };
        break;
      }

      case "activate_model_fallback": {
        let scopeKey = formatScopeKey(payload.scope ?? payload.scopeKey ?? "global");
        if (!this.state.bindings.has(scopeKey) && scopeKey === "system" && this.state.bindings.has("global")) {
          scopeKey = "global";
        }
        const binding = this.state.bindings.get(scopeKey);
        invariant(binding, "binding_not_found:" + scopeKey);
        invariant(Array.isArray(binding.fallbackChain) && binding.fallbackChain.length > 0, "fallback_chain_empty");

        let selectedIndex = 0;
        if (typeof payload.fallbackIndex === "number") {
          selectedIndex = payload.fallbackIndex;
          invariant(selectedIndex >= 0 && selectedIndex < binding.fallbackChain.length, "invalid_fallback_index:" + selectedIndex);
        } else if (payload.providerId || payload.model) {
          selectedIndex = binding.fallbackChain.findIndex(f =>
            (!payload.providerId || f.providerId === payload.providerId) &&
            (!payload.model || f.model === payload.model)
          );
          invariant(selectedIndex >= 0, "fallback_target_not_found_in_chain");
        }

        const chosen = binding.fallbackChain[selectedIndex];
        const active = {
          providerId: chosen.providerId,
          model: chosen.model,
          selectedFallbackIndex: selectedIndex,
          reason: payload.reason ?? "manual_trigger"
        };

        target = { type: "model_binding", id: scopeKey };
        drafts.push(eventDraft({
          type: "control_plane.fallback_activated",
          aggregateType: "model_binding",
          aggregateId: scopeKey,
          correlationId: commandId,
          causationId: commandId,
          actor,
          payload: {
            scopeKey,
            active,
            reason: payload.reason ?? "manual_trigger"
          }
        }));
        result = {
          scopeKey,
          active,
          status: "fallback_active",
          receipt: {
            receiptId: pulsoId("rcpt"),
            action: "activate_model_fallback",
            scopeKey,
            active,
            reason: payload.reason ?? "manual_trigger",
            confirmed: Boolean(confirmed)
          }
        };
        break;
      }

      case "register_agent": {
        const validated = validateAgentProfile({
          ...payload,
          identityId: payload.identityId ?? DEFAULT_SOVEREIGN_IDENTITY
        });
        target = { type: "agent_profile", id: validated.agentId };
        drafts.push(eventDraft({
          type: "control_plane.agent_registered",
          aggregateType: "agent_profile",
          aggregateId: validated.agentId,
          correlationId: commandId,
          causationId: commandId,
          actor,
          payload: validated
        }));
        result = validated;
        break;
      }

      case "update_agent": {
        invariant(payload.agentId, "agent_id_required");
        const existing = this.state.agents.get(payload.agentId);
        invariant(existing, "agent_not_found:" + payload.agentId);
        const updated = validateAgentProfile({ ...existing, ...payload });
        target = { type: "agent_profile", id: updated.agentId };
        drafts.push(eventDraft({
          type: "control_plane.agent_updated",
          aggregateType: "agent_profile",
          aggregateId: updated.agentId,
          correlationId: commandId,
          causationId: commandId,
          actor,
          payload: updated
        }));
        result = updated;
        break;
      }

      case "register_tool": {
        const validated = validateToolRecord(payload);
        target = { type: "tool_record", id: validated.toolId };
        drafts.push(eventDraft({
          type: "control_plane.tool_registered",
          aggregateType: "tool_record",
          aggregateId: validated.toolId,
          correlationId: commandId,
          causationId: commandId,
          actor,
          payload: validated
        }));
        result = validated;
        break;
      }

      case "update_tool": {
        invariant(payload.toolId, "tool_id_required");
        const existing = this.state.tools.get(payload.toolId);
        invariant(existing, "tool_not_found:" + payload.toolId);
        const updated = validateToolRecord({ ...existing, ...payload });
        target = { type: "tool_record", id: updated.toolId };
        drafts.push(eventDraft({
          type: "control_plane.tool_updated",
          aggregateType: "tool_record",
          aggregateId: updated.toolId,
          correlationId: commandId,
          causationId: commandId,
          actor,
          payload: updated
        }));
        result = updated;
        break;
      }

      case "set_policy_profile": {
        const validated = validatePolicyProfile(payload);
        target = { type: "policy_profile", id: validated.profileId };
        drafts.push(eventDraft({
          type: "control_plane.policy_set",
          aggregateType: "policy_profile",
          aggregateId: validated.profileId,
          correlationId: commandId,
          causationId: commandId,
          actor,
          payload: validated
        }));
        result = validated;
        break;
      }

      case "set_active_policy": {
        invariant(payload.profileId, "profile_id_required");
        target = { type: "system_policy", id: payload.profileId };
        drafts.push(eventDraft({
          type: "control_plane.active_policy_changed",
          aggregateType: "system_policy",
          aggregateId: payload.profileId,
          correlationId: commandId,
          causationId: commandId,
          actor,
          payload: { profileId: payload.profileId }
        }));
        result = { activePolicyId: payload.profileId };
        break;
      }

      case "submit_task": {
        const taskId = payload.taskId ?? pulsoId("task");
        const task = validateOperationalTask({
          taskId,
          taskType: payload.taskType ?? "operation",
          priority: payload.priority ?? "normal",
          status: "queued",
          metadata: payload.metadata ?? {}
        });
        target = { type: "operational_task", id: taskId };
        drafts.push(eventDraft({
          type: "control_plane.task_submitted",
          aggregateType: "operational_task",
          aggregateId: taskId,
          correlationId: commandId,
          causationId: commandId,
          actor,
          payload: task
        }));
        result = task;
        break;
      }

      case "start_task": {
        invariant(payload.taskId, "task_id_required");
        const task = this.state.tasks.get(payload.taskId);
        invariant(task, "task_not_found:" + payload.taskId);
        invariant(task.status === "queued", "task_not_queued");
        target = { type: "operational_task", id: payload.taskId };
        drafts.push(eventDraft({
          type: "control_plane.task_started",
          aggregateType: "operational_task",
          aggregateId: payload.taskId,
          correlationId: commandId,
          causationId: commandId,
          actor,
          payload: { taskId: payload.taskId }
        }));
        result = { taskId: payload.taskId, status: "running" };
        break;
      }

      case "record_task_checkpoint": {
        invariant(payload.taskId, "task_id_required");
        const task = this.state.tasks.get(payload.taskId);
        invariant(task, "task_not_found:" + payload.taskId);
        invariant(task.status === "running", "task_not_running");
        const checkpointId = payload.checkpointId ?? pulsoId("chk");
        target = { type: "operational_task", id: payload.taskId };
        drafts.push(eventDraft({
          type: "control_plane.task_checkpoint_recorded",
          aggregateType: "operational_task",
          aggregateId: payload.taskId,
          correlationId: commandId,
          causationId: commandId,
          actor,
          payload: {
            taskId: payload.taskId,
            checkpointId,
            label: payload.label ?? "progress",
            data: payload.data ?? null,
            progress: payload.progress ?? task.progress
          }
        }));
        result = { taskId: payload.taskId, checkpointId };
        break;
      }

      case "complete_task": {
        invariant(payload.taskId, "task_id_required");
        const task = this.state.tasks.get(payload.taskId);
        invariant(task, "task_not_found:" + payload.taskId);
        target = { type: "operational_task", id: payload.taskId };
        drafts.push(eventDraft({
          type: "control_plane.task_completed",
          aggregateType: "operational_task",
          aggregateId: payload.taskId,
          correlationId: commandId,
          causationId: commandId,
          actor,
          payload: { taskId: payload.taskId, result: payload.result ?? null }
        }));
        result = { taskId: payload.taskId, status: "completed" };
        break;
      }

      case "fail_task": {
        invariant(payload.taskId, "task_id_required");
        const task = this.state.tasks.get(payload.taskId);
        invariant(task, "task_not_found:" + payload.taskId);
        target = { type: "operational_task", id: payload.taskId };
        drafts.push(eventDraft({
          type: "control_plane.task_failed",
          aggregateType: "operational_task",
          aggregateId: payload.taskId,
          correlationId: commandId,
          causationId: commandId,
          actor,
          payload: { taskId: payload.taskId, error: payload.error ?? { message: "unknown_failure" } }
        }));
        result = { taskId: payload.taskId, status: "failed" };
        break;
      }

      case "cancel_task": {
        invariant(payload.taskId, "task_id_required");
        const task = this.state.tasks.get(payload.taskId);
        invariant(task, "task_not_found:" + payload.taskId);
        target = { type: "operational_task", id: payload.taskId };
        drafts.push(eventDraft({
          type: "control_plane.task_cancelled",
          aggregateType: "operational_task",
          aggregateId: payload.taskId,
          correlationId: commandId,
          causationId: commandId,
          actor,
          payload: {
            taskId: payload.taskId,
            reason: payload.reason ?? "user_requested"
          }
        }));
        result = {
          taskId: payload.taskId,
          status: "cancelled",
          receipt: {
            taskId: payload.taskId,
            reason: payload.reason ?? "user_requested",
            checkpointsCount: task.checkpoints.length
          }
        };
        break;
      }

      case "update_capability_checklist": {
        invariant(payload.capabilityId, "capability_id_required");
        invariant(payload.checkId, "check_id_required");
        target = { type: "capability_record", id: payload.capabilityId };
        drafts.push(eventDraft({
          type: "control_plane.capability_checklist_updated",
          aggregateType: "capability_record",
          aggregateId: payload.capabilityId,
          correlationId: commandId,
          causationId: commandId,
          actor,
          payload: {
            capabilityId: payload.capabilityId,
            checkId: payload.checkId,
            status: payload.status ?? "passed",
            verified: payload.verified !== false,
            capabilityStatus: payload.capabilityStatus ?? null
          }
        }));
        result = { capabilityId: payload.capabilityId, checkId: payload.checkId, verified: payload.verified !== false };
        break;
      }

      case "record_diagnostic_alert": {
        invariant(payload.alertId, "alert_id_required");
        target = { type: "diagnostic_alert", id: payload.alertId };
        drafts.push(eventDraft({
          type: "control_plane.diagnostic_alert_recorded",
          aggregateType: "diagnostic_alert",
          aggregateId: payload.alertId,
          correlationId: commandId,
          causationId: commandId,
          actor,
          payload: {
            alertId: payload.alertId,
            level: payload.level ?? "warning",
            message: payload.message ?? "",
            active: payload.active !== false
          }
        }));
        result = { alertId: payload.alertId, active: payload.active !== false };
        break;
      }

      case "create_blueprint": {
        const res = await this.foundry.createBlueprint(payload, { actor, idempotencyKey });
        for (const ev of res.events) applyControlPlaneEvent(this.state, ev);
        return {
          success: true,
          duplicate: res.duplicate,
          commandId,
          entityId: res.blueprint?.blueprintId,
          events: res.events,
          result: res.blueprint
        };
      }

      case "revise_blueprint": {
        const res = await this.foundry.reviseBlueprint(payload, { actor, idempotencyKey });
        for (const ev of res.events) applyControlPlaneEvent(this.state, ev);
        return {
          success: true,
          duplicate: res.duplicate,
          commandId,
          entityId: res.revision?.revisionId,
          events: res.events,
          result: res.revision
        };
      }

      case "materialize_agent": {
        const res = await this.foundry.materializeAgent(payload, { actor, idempotencyKey });
        for (const ev of res.events) applyControlPlaneEvent(this.state, ev);
        return {
          success: true,
          duplicate: res.duplicate,
          commandId,
          entityId: res.instance?.agentId,
          events: res.events,
          result: res.instance
        };
      }

      case "activate_agent": {
        const res = await this.foundry.activateAgent(payload.agentId, { actor, idempotencyKey });
        for (const ev of res.events) applyControlPlaneEvent(this.state, ev);
        return {
          success: true,
          duplicate: res.duplicate,
          commandId,
          entityId: payload.agentId,
          events: res.events,
          result: res.instance
        };
      }

      case "pause_agent": {
        const res = await this.foundry.pauseAgent(payload.agentId, { reason: payload.reason, actor, idempotencyKey });
        for (const ev of res.events) applyControlPlaneEvent(this.state, ev);
        return {
          success: true,
          duplicate: res.duplicate,
          commandId,
          entityId: payload.agentId,
          events: res.events,
          result: res.instance
        };
      }

      case "resume_agent": {
        const res = await this.foundry.resumeAgent(payload.agentId, { actor, idempotencyKey });
        for (const ev of res.events) applyControlPlaneEvent(this.state, ev);
        return {
          success: true,
          duplicate: res.duplicate,
          commandId,
          entityId: payload.agentId,
          events: res.events,
          result: res.instance
        };
      }

      case "retire_agent": {
        const res = await this.foundry.retireAgent(payload.agentId, { reason: payload.reason, actor, idempotencyKey });
        for (const ev of res.events) applyControlPlaneEvent(this.state, ev);
        return {
          success: true,
          duplicate: res.duplicate,
          commandId,
          entityId: payload.agentId,
          events: res.events,
          result: res.instance
        };
      }

      case "grant_capability": {
        const res = await this.foundry.grantCapability(payload, { actor, idempotencyKey });
        for (const ev of res.events) applyControlPlaneEvent(this.state, ev);
        return {
          success: true,
          duplicate: res.duplicate,
          commandId,
          entityId: res.grant?.grantId,
          events: res.events,
          result: res.grant
        };
      }

      case "revoke_capability": {
        const res = await this.foundry.revokeCapability(payload, { actor, idempotencyKey });
        for (const ev of res.events) applyControlPlaneEvent(this.state, ev);
        return {
          success: true,
          duplicate: res.duplicate,
          commandId,
          entityId: res.revokedId,
          events: res.events,
          result: { revokedId: res.revokedId }
        };
      }

      case "bind_agent_model": {
        const res = await this.foundry.bindProviderModel(payload, { actor, idempotencyKey });
        for (const ev of res.events) applyControlPlaneEvent(this.state, ev);
        return {
          success: true,
          duplicate: res.duplicate,
          commandId,
          entityId: payload.agentId,
          events: res.events,
          result: res.instance
        };
      }

      case "bind_agent_runtime": {
        const res = await this.foundry.bindRuntimeExecutor(payload, { actor, idempotencyKey });
        for (const ev of res.events) applyControlPlaneEvent(this.state, ev);
        return {
          success: true,
          duplicate: res.duplicate,
          commandId,
          entityId: payload.agentId,
          events: res.events,
          result: res.instance
        };
      }

      case "create_delegation": {
        const res = await this.foundry.createDelegation(payload, { actor, idempotencyKey });
        for (const ev of res.events) applyControlPlaneEvent(this.state, ev);
        return {
          success: true,
          duplicate: res.duplicate,
          commandId,
          entityId: res.delegation?.delegationId,
          events: res.events,
          result: res.delegation
        };
      }

      case "accept_delegation": {
        const res = await this.foundry.acceptDelegation(payload.delegationId, { actor, idempotencyKey });
        for (const ev of res.events) applyControlPlaneEvent(this.state, ev);
        return {
          success: true,
          duplicate: res.duplicate,
          commandId,
          entityId: payload.delegationId,
          events: res.events,
          result: res.delegation
        };
      }

      case "reject_delegation": {
        const res = await this.foundry.rejectDelegation(payload.delegationId, { reason: payload.reason, actor, idempotencyKey });
        for (const ev of res.events) applyControlPlaneEvent(this.state, ev);
        return {
          success: true,
          duplicate: res.duplicate,
          commandId,
          entityId: payload.delegationId,
          events: res.events,
          result: res.delegation
        };
      }

      case "cancel_delegation": {
        invariant(payload.runId || payload.delegationId, "run_id_or_delegation_id_required");
        const runId = payload.runId ?? (
          Array.from(this.state.agentRuns.values()).find(r => r.delegationId === payload.delegationId && r.status === "running")?.agentRunId
        );
        if (runId) {
          const res = await this.foundry.cancelAgentRun(runId, { reason: payload.reason ?? "user_requested", actor, idempotencyKey });
          for (const ev of res.events) applyControlPlaneEvent(this.state, ev);
          return {
            success: true,
            duplicate: res.duplicate,
            commandId,
            entityId: runId,
            events: res.events,
            result: { cancelled: true, runId, receipt: res.receipt }
          };
        } else {
          return {
            success: true,
            duplicate: false,
            commandId,
            entityId: payload.delegationId,
            events: [],
            result: { cancelled: false, reason: "no_active_run_found" }
          };
        }
      }

      case "pause_all_agents": {
        target = { type: "control_plane", id: "all_agents" };
        const pausedIds = [];
        for (const [agentId, inst] of this.state.instances.entries()) {
          if (inst.status === "active") {
            const res = await this.foundry.pauseAgent(agentId, { reason: payload.reason ?? "pause_all_agents", actor });
            for (const ev of res.events) applyControlPlaneEvent(this.state, ev);
            pausedIds.push(agentId);
          }
        }
        for (const [agentId, agt] of this.state.agents.entries()) {
          if (!this.state.instances.has(agentId) && agt.status === "active") {
            agt.status = "paused";
            pausedIds.push(agentId);
          }
        }
        result = { pausedCount: pausedIds.length, pausedIds };
        break;
      }

      case "test_provider_connection": {
        invariant(payload.providerId, "provider_id_required");
        invariant(this.router, "provider_router_required");
        target = { type: "provider_profile", id: payload.providerId };
        const receipt = await this.router.testConnection(payload.providerId, { actor });
        result = {
          ...receipt,
          providerId: payload.providerId,
          status: receipt.status,
          receipt
        };
        break;
      }

      case "check_provider_health": {
        invariant(this.router, "provider_router_required");
        const targetIds = payload.providerId
          ? [payload.providerId]
          : Array.from(this.state.providers.keys());
        const receipts = [];
        for (const pid of targetIds) {
          receipts.push(await this.router.testConnection(pid, { actor }));
        }
        target = { type: "control_plane", id: "providers_health" };
        result = {
          checkedCount: receipts.length,
          receipts
        };
        break;
      }

      case "remove_provider": {
        invariant(payload.providerId, "provider_id_required");
        target = { type: "provider_profile", id: payload.providerId };
        if (this.router) {
          const removedRes = this.router.removeProvider(payload.providerId, {
            actor,
            reason: payload.reason ?? "operator_removed"
          });
          result = {
            ...removedRes,
            receipt: {
              receiptId: pulsoId("rcpt"),
              action: "remove_provider",
              providerId: payload.providerId,
              reason: removedRes.reason,
              confirmed: Boolean(confirmed)
            }
          };
        } else {
          invariant(this.state.providers.has(payload.providerId), "provider_not_found:" + payload.providerId);
          drafts.push(eventDraft({
            type: "control_plane.provider_removed",
            aggregateType: "provider_profile",
            aggregateId: payload.providerId,
            correlationId: commandId,
            causationId: commandId,
            actor,
            payload: {
              providerId: payload.providerId,
              reason: payload.reason ?? "operator_removed"
            }
          }));
          result = {
            removed: true,
            providerId: payload.providerId,
            receipt: {
              receiptId: pulsoId("rcpt"),
              action: "remove_provider",
              providerId: payload.providerId,
              reason: payload.reason ?? "operator_removed",
              confirmed: Boolean(confirmed)
            }
          };
        }
        break;
      }

      case "enqueue_outbox_item": {
        invariant(this.outbox, "durable_outbox_required");
        const enq = this.outbox.enqueue(payload, { actor });
        target = { type: "outbox_item", id: enq.item.outboxId };
        result = {
          duplicate: enq.duplicate,
          item: enq.item
        };
        break;
      }

      case "retry_outbox_item": {
        invariant(this.outbox, "durable_outbox_required");
        invariant(payload.outboxId, "outbox_id_required");
        const rty = this.outbox.retryItem(payload.outboxId, {
          reason: payload.reason ?? "operator_retry",
          actor
        });
        target = { type: "outbox_item", id: payload.outboxId };
        result = {
          item: rty.item,
          status: rty.item.status,
          receipt: rty.receipt
        };
        break;
      }

      case "cancel_outbox_item": {
        invariant(this.outbox, "durable_outbox_required");
        invariant(payload.outboxId, "outbox_id_required");
        const can = this.outbox.cancelItem(payload.outboxId, {
          reason: payload.reason ?? "operator_cancelled",
          actor
        });
        target = { type: "outbox_item", id: payload.outboxId };
        result = {
          item: can.item,
          status: "cancelled",
          receipt: can.receipt
        };
        break;
      }

      case "drain_outbox": {
        invariant(this.outbox, "durable_outbox_required");
        target = { type: "control_plane", id: "outbox_drain" };
        if (this.runtime && this.runtime.status === "running") {
          const drainRes = await this.runtime.drainOutbox(payload);
          result = {
            ...drainRes,
            receipt: {
              receiptId: pulsoId("rcpt"),
              action: "drain_outbox",
              processedCount: drainRes.processedCount,
              deliveredCount: drainRes.delivered.length,
              failedCount: drainRes.failed.length,
              deadLetteredCount: drainRes.deadLettered.length
            }
          };
        } else {
          const effectiveLimit = payload.maxItems ?? payload.limit ?? 10;
          const leased = this.outbox.leaseNext({
            workerId: payload.workerId ?? "control-plane-drain",
            leaseDurationMs: payload.leaseDurationMs ?? 30000,
            limit: effectiveLimit,
            topic: payload.topic ?? null
          });
          const delivered = [];
          const failed = [];
          const deadLettered = [];
          const receipts = [];
          for (const item of leased) {
            try {
              let execResult = { processed: true, topic: item.topic };
              if (item.topic === "model.completion" && this.router) {
                const comp = await this.router.complete({ ...item.payload, scope: item.scope });
                execResult = {
                  providerId: comp.providerId,
                  model: comp.model,
                  text: comp.text,
                  fallbackActivated: comp.fallbackActivated,
                  routingReceipt: comp.routingReceipt
                };
              } else if (typeof payload.handler === "function") {
                execResult = await payload.handler(item);
              }
              const ack = this.outbox.acknowledgeDelivery(item.outboxId, {
                leaseId: item.lease.leaseId,
                result: execResult
              });
              delivered.push(ack.item);
              receipts.push(ack.receipt);
            } catch (err) {
              const fRes = this.outbox.recordFailure(item.outboxId, {
                leaseId: item.lease.leaseId,
                error: err
              });
              if (fRes.deadLettered) {
                deadLettered.push(fRes.item);
                if (fRes.receipt) receipts.push(fRes.receipt);
              } else {
                failed.push(fRes.item);
              }
            }
          }
          result = {
            processedCount: leased.length,
            delivered,
            failed,
            deadLettered,
            receipts,
            receipt: {
              receiptId: pulsoId("rcpt"),
              action: "drain_outbox",
              processedCount: leased.length,
              deliveredCount: delivered.length,
              failedCount: failed.length,
              deadLetteredCount: deadLettered.length
            }
          };
        }
        break;
      }

      case "recover_outbox_leases": {
        invariant(this.outbox, "durable_outbox_required");
        target = { type: "control_plane", id: "outbox_lease_recovery" };
        const rec = this.outbox.recoverExpiredLeases({ now: payload.now, actor });
        result = {
          ...rec,
          receipt: {
            receiptId: pulsoId("rcpt"),
            action: "recover_outbox_leases",
            recoveredCount: rec.recoveredCount,
            recoveredIds: rec.recoveredIds
          }
        };
        break;
      }

      case "view_queue": {
        target = { type: "control_plane", id: "outbox_queue" };
        result = this.outbox ? this.outbox.summary() : { counts: { total: 0 } };
        break;
      }

      case "check_integrity":
      case "refresh_diagnostics": {
        target = { type: "control_plane", id: "diagnostics_check" };
        const integrity = this.store.verifyIntegrity();
        const outboxIntegrity = this.outbox ? this.outbox.verifyIntegrity() : { ok: true };
        const outboxCounts = this.outbox ? this.outbox.summary().counts : { total: 0 };
        result = {
          ok: integrity.ok && outboxIntegrity.ok,
          integrity,
          storeIntegrity: integrity,
          outboxIntegrity,
          outboxCounts,
          lifecycle: this.state.runtimeLifecycle,
          receipt: {
            receiptId: pulsoId("rcpt"),
            action: name,
            ok: integrity.ok && outboxIntegrity.ok
          }
        };
        break;
      }

      case "deep_diagnostics": {
        target = { type: "control_plane", id: "deep_diagnostics" };
        const integrity = this.store.verifyIntegrity();
        const outboxIntegrity = this.outbox ? this.outbox.verifyIntegrity() : { ok: true };
        const outboxCounts = this.outbox ? this.outbox.summary().counts : { total: 0 };
        result = {
          ok: integrity.ok && outboxIntegrity.ok,
          integrity,
          storeIntegrity: integrity,
          outboxIntegrity,
          providersCount: this.state.providers.size,
          outboxCounts,
          lifecycle: this.state.runtimeLifecycle,
          receipt: {
            receiptId: pulsoId("rcpt"),
            action: "deep_diagnostics",
            confirmed: Boolean(confirmed),
            ok: integrity.ok && outboxIntegrity.ok
          }
        };
        break;
      }

      case "reset_panel": {
        target = { type: "control_plane", id: "projection_reset" };
        result = {
          ok: true,
          reset: true,
          receipt: {
            receiptId: pulsoId("rcpt"),
            action: "reset_panel",
            confirmed: Boolean(confirmed)
          }
        };
        break;
      }

      default:
        throw new Error("unsupported_control_plane_command:" + name);
    }

    // Always append an immutable audit trail entry for every command
    const auditId = pulsoId("audit");
    drafts.push(eventDraft({
      type: "control_plane.audit_entry_recorded",
      aggregateType: "audit_entry",
      aggregateId: auditId,
      correlationId: commandId,
      causationId: commandId,
      actor,
      payload: {
        auditId,
        commandName: name,
        actor,
        target,
        status: "success",
        confirmed: Boolean(confirmed)
      }
    }));

    // Verify external IDs and secrets confinement before committing to the SQLite event store
    assertExternalIdsConfined(drafts);
    assertNoSecrets(drafts);

    const commitOptions = idempotencyKey
      ? { idempotency: { scope, key: idempotencyKey, entityId: target.id } }
      : {};

    const commitResult = this.store.append(drafts, commitOptions);

    for (const committedEvent of commitResult.events) {
      applyControlPlaneEvent(this.state, committedEvent);
    }

    return {
      success: true,
      duplicate: false,
      commandId,
      entityId: target.id,
      events: commitResult.events,
      result
    };
  }
}
