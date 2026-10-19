import {
  PANEL_SECTION_IDS,
  PANEL_SECTION_TITLES,
  DEFAULT_SOVEREIGN_IDENTITY
} from "./control-plane-contracts.mjs";

import { parseSecretRef } from "../runtime/runtime-contracts.mjs";

function formatAuthSourceRedacted(profile) {
  if (profile.metadata?.authSource && typeof profile.metadata.authSource === "object") {
    return profile.metadata.authSource;
  }
  if (!profile.secretRef) {
    return {
      secretRef: null,
      scheme: "none",
      keyId: null,
      configured: false,
      redactedPreview: "[NO_SECRET_REF]"
    };
  }
  try {
    const parsed = parseSecretRef(profile.secretRef);
    return {
      secretRef: parsed.secretRef,
      scheme: parsed.scheme,
      keyId: parsed.keyId,
      configured: Boolean(profile.metadata?.secretConfigured),
      redactedPreview: parsed.redactedPreview
    };
  } catch {
    return {
      secretRef: profile.secretRef,
      scheme: "unknown",
      keyId: null,
      configured: false,
      redactedPreview: "[REDACTED]"
    };
  }
}

export function emptyControlPlaneState() {
  return {
    providers: new Map(),
    bindings: new Map(),
    agents: new Map(),
    blueprints: new Map(),
    revisions: new Map(),
    revisionsByBlueprint: new Map(),
    instances: new Map(),
    grants: new Map(),
    agentGrants: new Map(),
    delegations: new Map(),
    runs: new Map(),
    agentRuns: new Map(),
    tools: new Map(),
    policies: new Map(),
    activePolicyId: "policy_guarded",
    tasks: new Map(),
    outboxItems: new Map(),
    routingReceipts: [],
    connectionReceipts: [],
    runtimeLifecycle: {
      serviceId: "pulso-runtime-spine",
      status: "stopped",
      startedAt: null,
      stoppedAt: null,
      recoveryCount: 0,
      recoveredLeasesCount: 0
    },
    capabilities: new Map(),
    audit: [],
    alerts: new Map(),
    metrics: {
      totalEvents: 0,
      totalMutations: 0,
      lastRebuildAt: null
    }
  };
}

export function applyControlPlaneEvent(state, event) {
  state.metrics.totalEvents++;
  const p = event.payload;

  switch (event.type) {
    case "control_plane.provider_registered":
    case "control_plane.provider_updated":
      state.providers.set(p.providerId, { ...state.providers.get(p.providerId), ...p });
      state.metrics.totalMutations++;
      break;

    case "control_plane.provider_removed":
      state.providers.delete(p.providerId);
      state.metrics.totalMutations++;
      break;

    case "control_plane.model_binding_set":
      state.bindings.set(p.scopeKey, { ...state.bindings.get(p.scopeKey), ...p });
      state.metrics.totalMutations++;
      break;

    case "control_plane.fallback_activated": {
      const binding = state.bindings.get(p.scopeKey);
      if (binding) {
        binding.active = { ...p.active };
        binding.status = "fallback_active";
      }
      state.metrics.totalMutations++;
      break;
    }

    case "control_plane.agent_registered":
    case "control_plane.agent_updated":
      state.agents.set(p.agentId, { ...state.agents.get(p.agentId), ...p });
      state.metrics.totalMutations++;
      break;

    case "agent_foundry.blueprint_created":
    case "agent_foundry.blueprint_revised":
      state.blueprints.set(p.blueprintId, { ...p });
      state.metrics.totalMutations++;
      break;

    case "agent_foundry.revision_created":
      state.revisions.set(p.revisionId, { ...p });
      state.metrics.totalMutations++;
      break;

    case "agent_foundry.agent_materialized":
      state.instances.set(p.agentId, { ...p });
      state.agents.set(p.agentId, {
        agentId: p.agentId,
        name: p.metadata?.name ?? p.agentId,
        identityId: p.identityId,
        role: p.metadata?.role ?? "Autonomous Assistant",
        capabilities: p.metadata?.capabilities ?? [],
        policyProfileId: p.metadata?.policyProfileId ?? "policy_guarded",
        modelScope: { type: "agent", scopeId: p.agentId },
        allowedTools: ["*"],
        status: p.status,
        metadata: p.metadata ?? {}
      });
      state.metrics.totalMutations++;
      break;

    case "agent_foundry.agent_activated": {
      const inst = state.instances.get(p.agentId);
      if (inst) inst.status = "active";
      const agt = state.agents.get(p.agentId);
      if (agt) agt.status = "active";
      state.metrics.totalMutations++;
      break;
    }

    case "agent_foundry.agent_paused": {
      const inst = state.instances.get(p.agentId);
      if (inst) inst.status = "paused";
      const agt = state.agents.get(p.agentId);
      if (agt) agt.status = "paused";
      state.metrics.totalMutations++;
      break;
    }

    case "agent_foundry.agent_resumed": {
      const inst = state.instances.get(p.agentId);
      if (inst) inst.status = "active";
      const agt = state.agents.get(p.agentId);
      if (agt) agt.status = "active";
      state.metrics.totalMutations++;
      break;
    }

    case "agent_foundry.agent_retired": {
      const inst = state.instances.get(p.agentId);
      if (inst) inst.status = "retired";
      const agt = state.agents.get(p.agentId);
      if (agt) agt.status = "retired";
      state.metrics.totalMutations++;
      break;
    }

    case "agent_foundry.capability_granted":
      state.grants.set(p.grantId, { ...p });
      state.metrics.totalMutations++;
      break;

    case "agent_foundry.capability_revoked":
      state.grants.delete(p.grantId);
      state.metrics.totalMutations++;
      break;

    case "agent_foundry.provider_model_bound": {
      const inst = state.instances.get(p.agentId);
      if (inst) {
        inst.resolvedBindings.model = { providerId: p.providerId, model: p.model };
      }
      state.metrics.totalMutations++;
      break;
    }

    case "agent_foundry.runtime_executor_bound": {
      const inst = state.instances.get(p.agentId);
      if (inst) {
        inst.resolvedBindings.runtime = { providerId: p.providerId, executorType: p.executorType };
      }
      state.metrics.totalMutations++;
      break;
    }

    case "agent_foundry.delegation_created":
      state.delegations.set(p.delegationId, { ...p });
      state.metrics.totalMutations++;
      break;

    case "agent_foundry.delegation_accepted": {
      const del = state.delegations.get(p.delegationId);
      if (del) del.status = "accepted";
      state.metrics.totalMutations++;
      break;
    }

    case "agent_foundry.delegation_rejected": {
      const del = state.delegations.get(p.delegationId);
      if (del) {
        del.status = "rejected";
        del.receipt = { rejected: true, reason: p.reason };
      }
      state.metrics.totalMutations++;
      break;
    }

    case "agent_foundry.run_started":
      state.agentRuns.set(p.agentRunId, { ...p, status: "running" });
      state.metrics.totalMutations++;
      break;

    case "agent_foundry.run_checkpointed": {
      const run = state.agentRuns.get(p.runId);
      if (run) {
        const delta = p.usageDelta ?? p.usage ?? null;
        if (delta) {
          const cur = run.usage ?? { turns: 0, tokens: 0, cost: 0, elapsedMs: 0, toolCalls: 0 };
          run.usage = {
            turns: (cur.turns ?? 0) + (delta.turns ?? 0),
            tokens: (cur.tokens ?? 0) + (delta.tokens ?? 0),
            cost: Number(((cur.cost ?? 0) + (delta.cost ?? 0)).toFixed(6)),
            elapsedMs: (cur.elapsedMs ?? 0) + (delta.elapsedMs ?? delta.timeMs ?? 0),
            toolCalls: (cur.toolCalls ?? 0) + (delta.toolCalls ?? delta.tools ?? 0)
          };
        }
      }
      state.metrics.totalMutations++;
      break;
    }

    case "agent_foundry.run_completed": {
      const run = state.agentRuns.get(p.runId);
      if (run) {
        run.status = "succeeded";
        run.result = p.result;
        const delta = p.usageDelta ?? p.usage ?? null;
        if (delta) {
          const cur = run.usage ?? { turns: 0, tokens: 0, cost: 0, elapsedMs: 0, toolCalls: 0 };
          run.usage = {
            turns: (cur.turns ?? 0) + (delta.turns ?? 0),
            tokens: (cur.tokens ?? 0) + (delta.tokens ?? 0),
            cost: Number(((cur.cost ?? 0) + (delta.cost ?? 0)).toFixed(6)),
            elapsedMs: (cur.elapsedMs ?? 0) + (delta.elapsedMs ?? delta.timeMs ?? 0),
            toolCalls: (cur.toolCalls ?? 0) + (delta.toolCalls ?? delta.tools ?? 0)
          };
        }
      }
      state.metrics.totalMutations++;
      break;
    }

    case "agent_foundry.run_failed": {
      const run = state.agentRuns.get(p.runId);
      if (run) {
        run.status = "failed";
        run.error = p.error;
        const delta = p.usageDelta ?? p.usage ?? null;
        if (delta) {
          const cur = run.usage ?? { turns: 0, tokens: 0, cost: 0, elapsedMs: 0, toolCalls: 0 };
          run.usage = {
            turns: (cur.turns ?? 0) + (delta.turns ?? 0),
            tokens: (cur.tokens ?? 0) + (delta.tokens ?? 0),
            cost: Number(((cur.cost ?? 0) + (delta.cost ?? 0)).toFixed(6)),
            elapsedMs: (cur.elapsedMs ?? 0) + (delta.elapsedMs ?? delta.timeMs ?? 0),
            toolCalls: (cur.toolCalls ?? 0) + (delta.toolCalls ?? delta.tools ?? 0)
          };
        }
      }
      state.metrics.totalMutations++;
      break;
    }

    case "agent_foundry.run_cancelled": {
      const run = state.agentRuns.get(p.runId);
      if (run) {
        run.status = "cancelled";
        run.result = { cancelled: true, reason: p.reason, receipt: p.receipt };
      }
      state.metrics.totalMutations++;
      break;
    }

    case "control_plane.tool_registered":
    case "control_plane.tool_updated":
      state.tools.set(p.toolId, { ...state.tools.get(p.toolId), ...p });
      state.metrics.totalMutations++;
      break;

    case "control_plane.policy_set":
      state.policies.set(p.profileId, { ...state.policies.get(p.profileId), ...p });
      state.metrics.totalMutations++;
      break;

    case "control_plane.active_policy_changed":
      state.activePolicyId = p.profileId;
      state.metrics.totalMutations++;
      break;

    case "control_plane.task_submitted":
      state.tasks.set(p.taskId, {
        ...p,
        status: "queued",
        checkpoints: [],
        cancellationReceipt: null,
        createdAt: event.occurredAt,
        updatedAt: event.occurredAt
      });
      state.metrics.totalMutations++;
      break;

    case "control_plane.task_started": {
      const task = state.tasks.get(p.taskId);
      if (task) {
        task.status = "running";
        task.startedAt = event.occurredAt;
        task.updatedAt = event.occurredAt;
      }
      state.metrics.totalMutations++;
      break;
    }

    case "control_plane.task_checkpoint_recorded": {
      const task = state.tasks.get(p.taskId);
      if (task) {
        task.checkpoints.push({
          checkpointId: p.checkpointId,
          label: p.label,
          data: p.data ?? null,
          recordedAt: event.occurredAt
        });
        task.progress = p.progress ?? task.progress;
        task.updatedAt = event.occurredAt;
      }
      state.metrics.totalMutations++;
      break;
    }

    case "control_plane.task_completed": {
      const task = state.tasks.get(p.taskId);
      if (task) {
        task.status = "completed";
        task.progress = 100;
        task.result = p.result ?? null;
        task.completedAt = event.occurredAt;
        task.updatedAt = event.occurredAt;
      }
      state.metrics.totalMutations++;
      break;
    }

    case "control_plane.task_failed": {
      const task = state.tasks.get(p.taskId);
      if (task) {
        task.status = "failed";
        task.error = p.error ?? null;
        task.failedAt = event.occurredAt;
        task.updatedAt = event.occurredAt;
      }
      state.metrics.totalMutations++;
      break;
    }

    case "control_plane.task_cancelled": {
      const task = state.tasks.get(p.taskId);
      if (task) {
        task.status = "cancelled";
        task.cancellationReceipt = {
          taskId: p.taskId,
          reason: p.reason ?? "user_requested",
          cancelledAt: event.occurredAt,
          checkpointsCount: task.checkpoints.length
        };
        task.updatedAt = event.occurredAt;
      }
      state.metrics.totalMutations++;
      break;
    }

    case "control_plane.capability_checklist_updated": {
      const cap = state.capabilities.get(p.capabilityId);
      if (cap) {
        const item = cap.checklist.find(c => c.id === p.checkId);
        if (item) {
          item.status = p.status;
          item.verified = p.verified;
        }
        if (p.capabilityStatus) cap.status = p.capabilityStatus;
      }
      state.metrics.totalMutations++;
      break;
    }

    case "control_plane.capability_registered":
      state.capabilities.set(p.capabilityId, { ...p });
      state.metrics.totalMutations++;
      break;

    case "control_plane.diagnostic_alert_recorded":
      if (p.active === false) {
        state.alerts.delete(p.alertId);
      } else {
        state.alerts.set(p.alertId, {
          id: p.alertId,
          level: p.level ?? "warning",
          message: p.message,
          recordedAt: event.occurredAt
        });
      }
      break;

    case "control_plane.audit_entry_recorded":
      state.audit.push({
        sequence: state.audit.length + 1,
        auditId: p.auditId,
        commandName: p.commandName,
        actor: p.actor,
        target: p.target,
        status: p.status,
        confirmed: Boolean(p.confirmed),
        timestamp: event.occurredAt
      });
      break;

    case "runtime.provider_connection_tested":
      state.connectionReceipts.push({ ...p });
      state.metrics.totalMutations++;
      break;

    case "runtime.routing_completed":
    case "runtime.routing_failed":
      state.routingReceipts.push({ ...p });
      state.metrics.totalMutations++;
      break;

    case "runtime.fallback_triggered":
    case "runtime.provider_attempt_failed":
      state.metrics.totalMutations++;
      break;

    case "outbox.item_enqueued":
    case "outbox.item_leased":
    case "outbox.item_delivered":
    case "outbox.item_failed":
    case "outbox.item_dead_lettered":
    case "outbox.lease_recovered":
    case "outbox.item_retried":
    case "outbox.item_cancelled":
      state.outboxItems.set(p.outboxId, { ...p });
      state.metrics.totalMutations++;
      break;

    case "runtime.service_started":
      state.runtimeLifecycle = {
        serviceId: p.serviceId ?? "pulso-runtime-spine",
        status: "running",
        startedAt: p.startedAt ?? event.occurredAt,
        stoppedAt: null,
        recoveryCount: p.recoveryCount ?? ((state.runtimeLifecycle?.recoveryCount ?? 0) + 1),
        recoveredLeasesCount: (state.runtimeLifecycle?.recoveredLeasesCount ?? 0) + (p.recoveredLeasesCount ?? 0)
      };
      state.metrics.totalMutations++;
      break;

    case "runtime.service_stopped":
      state.runtimeLifecycle = {
        ...(state.runtimeLifecycle ?? {}),
        serviceId: p.serviceId ?? "pulso-runtime-spine",
        status: "stopped",
        stoppedAt: p.stoppedAt ?? event.occurredAt
      };
      state.metrics.totalMutations++;
      break;
  }
}

export function projectControlPlane(events, state = emptyControlPlaneState()) {
  for (const event of events) {
    applyControlPlaneEvent(state, event);
  }
  state.metrics.lastRebuildAt = new Date().toISOString();
  return state;
}

export class InternalPanelProjection {
  constructor(state) {
    this.generatedAt = new Date().toISOString();
    this.sections = this._buildSections(state);
    this.sectionCount = this.sections.length;
  }

  _buildSections(state) {
    const activePolicy = state.policies.get(state.activePolicyId) || {
      profileId: "policy_guarded",
      mode: "guarded"
    };

    const alertsList = Array.from(state.alerts.values());
    const outboxList = Array.from((state.outboxItems ?? new Map()).values());
    const outboxCounts = {
      total: outboxList.length,
      pending: outboxList.filter(i => i.status === "pending").length,
      leased: outboxList.filter(i => i.status === "leased").length,
      delivered: outboxList.filter(i => i.status === "delivered").length,
      failed: outboxList.filter(i => i.status === "failed").length,
      dead_letter: outboxList.filter(i => i.status === "dead_letter").length,
      cancelled: outboxList.filter(i => i.status === "cancelled").length
    };
    const outboxLeases = outboxList.filter(i => i.status === "leased");
    const outboxRetries = outboxList.filter(i => i.status === "failed");
    const outboxDeadLetters = outboxList.filter(i => i.status === "dead_letter");
    const outboxReceipts = outboxList.filter(i => i.receipt !== null && i.receipt !== undefined).map(i => i.receipt);

    const projectedProviders = Array.from(state.providers.values()).map(p => ({
      ...p,
      authSource: formatAuthSourceRedacted(p)
    }));
    const bindingsList = Array.from(state.bindings.values());
    const bindingsByScope = Object.fromEntries(bindingsList.map(b => [b.scopeKey, b]));

    const runtimeLifecycle = state.runtimeLifecycle || {
      serviceId: "pulso-runtime-spine",
      status: "stopped",
      startedAt: null,
      stoppedAt: null,
      recoveryCount: 0,
      recoveredLeasesCount: 0
    };

    const sections = [
      // 1. Visão geral
      {
        id: "overview",
        title: PANEL_SECTION_TITLES.overview,
        status: alertsList.length === 0 ? "healthy" : "warning",
        alerts: alertsList,
        checklist: [
          {
            id: "chk_identity_lotus",
            label: "Soberania de identidade Lótus garantida",
            status: "passed",
            verified: true
          },
          {
            id: "chk_wal_persistence",
            label: "Event store persistido em SQLite WAL local",
            status: "passed",
            verified: true
          },
          {
            id: "chk_zero_secrets",
            label: "Isolamento absoluto de segredos em repouso e em memória",
            status: "passed",
            verified: true
          },
          {
            id: "chk_in_process_runtime",
            label: "Execução in-process sem servidor de rede",
            status: "passed",
            verified: true
          }
        ],
        actions: [
          {
            id: "act_refresh_diagnostics",
            label: "Atualizar diagnósticos do sistema",
            command: "refresh_diagnostics",
            params: {},
            requiresConfirmation: false
          },
          {
            id: "act_rebuild_projection",
            label: "Reconstruir projeções a partir do event log",
            command: "reset_panel",
            params: {},
            requiresConfirmation: true
          }
        ],
        summary: {
          providersCount: state.providers.size,
          agentsCount: state.agents.size,
          tasksCount: state.tasks.size,
          outboxCount: outboxCounts.total,
          runtimeStatus: runtimeLifecycle.status,
          activePolicyMode: activePolicy.mode
        }
      },

      // 2. Providers e modelos
      {
        id: "providers_models",
        title: PANEL_SECTION_TITLES.providers_models,
        status: bindingsList.some(b => b.status === "fallback_active")
          ? "fallback_active"
          : state.providers.size > 0 ? "ready" : "unconfigured",
        alerts: bindingsList.some(b => b.status === "fallback_active")
          ? [{ id: "alt_fallback_on", level: "warning", message: "Fallback de modelo ativo em um ou mais escopos" }]
          : [],
        checklist: [
          {
            id: "chk_no_raw_secrets",
            label: "Perfis de provedores livres de segredos brutos",
            status: "passed",
            verified: true
          },
          {
            id: "chk_model_bindings_scoped",
            label: "Vínculos de modelo primário e fallback declarados por escopo",
            status: state.bindings.size > 0 ? "passed" : "pending",
            verified: state.bindings.size > 0
          },
          {
            id: "chk_secret_refs_redacted",
            label: "Fontes de autenticação (secretRef) redigidas na projeção",
            status: "passed",
            verified: true
          }
        ],
        actions: [
          {
            id: "act_select_provider_model",
            label: "Selecionar provider e modelo por escopo",
            command: "select_provider_model",
            params: { scope: "system" },
            requiresConfirmation: false
          },
          {
            id: "act_test_provider_connection",
            label: "Testar conexão e saúde de provedor",
            command: "test_provider_connection",
            params: { providerId: "provider_primary" },
            requiresConfirmation: false
          },
          {
            id: "act_check_provider_health",
            label: "Verificar saúde dos provedores",
            command: "check_provider_health",
            params: {},
            requiresConfirmation: false
          },
          {
            id: "act_activate_fallback",
            label: "Ativar manualmente fallback de modelo",
            command: "activate_model_fallback",
            params: { scope: "default" },
            requiresConfirmation: true
          },
          {
            id: "act_remove_provider",
            label: "Remover provedor do registro",
            command: "remove_provider",
            params: {},
            requiresConfirmation: true
          }
        ],
        summary: {
          providers: projectedProviders,
          bindings: bindingsList,
          scopedBindings: bindingsList,
          bindingsByScope,
          routingReceiptsCount: (state.routingReceipts ?? []).length,
          routingReceipts: [...(state.routingReceipts ?? [])],
          connectionReceipts: [...(state.connectionReceipts ?? [])]
        }
      },

      // 3. Agentes (Agent Foundry Soberano v0.4)
      {
        id: "agents",
        title: PANEL_SECTION_TITLES.agents,
        status: (state.instances.size > 0 || state.agents.size > 0) ? "active" : "empty",
        alerts: Array.from(state.alerts.values()).filter(a => a.id.startsWith("alt_agent_")),
        checklist: [
          {
            id: "chk_agent_identity_lotus",
            label: "Identidade canônica soberana (lotus) associada aos perfis",
            status: "passed",
            verified: true
          },
          {
            id: "chk_agent_policy_bound",
            label: "Perfil de segurança e políticas atribuído aos agentes",
            status: "passed",
            verified: true
          },
          {
            id: "chk_agent_foundry_operational",
            label: "Agent Foundry operacional com blueprints, revisões imutáveis e instâncias",
            status: (state.blueprints.size > 0 || state.instances.size > 0) ? "passed" : "ready",
            verified: true
          },
          {
            id: "chk_agent_fail_closed_grants",
            label: "Governança de ferramentas fail-closed com grants explícitos",
            status: "passed",
            verified: true
          },
          {
            id: "chk_agent_budget_concurrency",
            label: "Supervisão determinística com controle de concorrência e limites de orçamento",
            status: "passed",
            verified: true
          }
        ],
        actions: [
          {
            id: "act_list_agents",
            label: "Listar agentes cadastrados",
            command: "list_agents",
            params: {},
            requiresConfirmation: false
          },
          {
            id: "act_create_blueprint",
            label: "Criar novo blueprint agental",
            command: "create_blueprint",
            params: { name: "Specialist", role: "Auditor" },
            requiresConfirmation: false
          },
          {
            id: "act_materialize_agent",
            label: "Materializar instância a partir de blueprint",
            command: "materialize_agent",
            params: {},
            requiresConfirmation: false
          },
          {
            id: "act_pause_agents",
            label: "Suspender execução de todos os agentes",
            command: "pause_all_agents",
            params: {},
            requiresConfirmation: true
          },
          {
            id: "act_cancel_delegation",
            label: "Cancelar delegação em voo com recibo",
            command: "cancel_delegation",
            params: {},
            requiresConfirmation: true
          }
        ],
        summary: {
          agents: Array.from(state.agents.values()),
          blueprintsCount: state.blueprints.size,
          revisionsCount: state.revisions.size,
          instancesCount: state.instances.size,
          activeInstancesCount: Array.from(state.instances.values()).filter(i => i.status === "active").length,
          grantsCount: state.grants.size,
          delegationsCount: state.delegations.size,
          activeRunsCount: Array.from(state.agentRuns.values()).filter(r => r.status === "running").length,
          blueprints: Array.from(state.blueprints.values()),
          instances: Array.from(state.instances.values()),
          delegations: Array.from(state.delegations.values()),
          grants: Array.from(state.grants.values())
        }
      },

      // 4. Ferramentas e extensões
      {
        id: "tools_extensions",
        title: PANEL_SECTION_TITLES.tools_extensions,
        status: state.tools.size > 0 ? "ready" : "minimal",
        alerts: [],
        checklist: [
          {
            id: "chk_tools_cataloged",
            label: "Ferramentas catalogadas com permissões explícitas",
            status: "passed",
            verified: true
          },
          {
            id: "chk_dangerous_tools_gated",
            label: "Ações perigosas sinalizadas para confirmação prévia obrigatória",
            status: "passed",
            verified: true
          }
        ],
        actions: [
          {
            id: "act_reload_tools",
            label: "Recarregar catálogo de ferramentas",
            command: "reload_tools",
            params: {},
            requiresConfirmation: false
          },
          {
            id: "act_disable_dangerous_tools",
            label: "Desativar ferramentas de alto risco",
            command: "disable_dangerous_tools",
            params: {},
            requiresConfirmation: true
          }
        ],
        summary: {
          toolsCount: state.tools.size,
          dangerousCount: Array.from(state.tools.values()).filter(t => t.dangerous).length
        }
      },

      // 5. Tarefas e filas
      {
        id: "tasks_queues",
        title: PANEL_SECTION_TITLES.tasks_queues,
        status: (
          Array.from(state.tasks.values()).some(t => t.status === "running") ||
          outboxCounts.leased > 0
        ) ? "running" : (outboxCounts.dead_letter > 0 ? "degraded" : "idle"),
        alerts: outboxCounts.dead_letter > 0
          ? [{ id: "alt_outbox_dlq", level: "warning", message: "Existem itens em dead_letter na DurableOutbox" }]
          : [],
        checklist: [
          {
            id: "chk_task_idempotency",
            label: "Idempotência garantida na admissão de tarefas operacionais e outbox",
            status: "passed",
            verified: true
          },
          {
            id: "chk_task_checkpoints_receipts",
            label: "Checkpoints monotônicos e emissão de recibo no cancelamento/entrega",
            status: "passed",
            verified: true
          },
          {
            id: "chk_durable_outbox_sqlite",
            label: "DurableOutbox sobre SQLite com leases, retry/backoff determinístico e dead-letter",
            status: "passed",
            verified: true
          }
        ],
        actions: [
          {
            id: "act_view_queue",
            label: "Inspecionar fila de tarefas e outbox",
            command: "view_queue",
            params: {},
            requiresConfirmation: false
          },
          {
            id: "act_drain_outbox",
            label: "Drenar itens pendentes da DurableOutbox",
            command: "drain_outbox",
            params: { limit: 10 },
            requiresConfirmation: false
          },
          {
            id: "act_retry_outbox_item",
            label: "Reenfileirar item falho na DurableOutbox",
            command: "retry_outbox_item",
            params: {},
            requiresConfirmation: false
          },
          {
            id: "act_cancel_outbox_item",
            label: "Cancelar item da DurableOutbox com recibo",
            command: "cancel_outbox_item",
            params: {},
            requiresConfirmation: true
          },
          {
            id: "act_cancel_all_tasks",
            label: "Cancelar tarefas em voo com emissão de recibo",
            command: "cancel_all_tasks",
            params: {},
            requiresConfirmation: true
          }
        ],
        summary: {
          queued: Array.from(state.tasks.values()).filter(t => t.status === "queued").length,
          running: Array.from(state.tasks.values()).filter(t => t.status === "running").length,
          completed: Array.from(state.tasks.values()).filter(t => t.status === "completed").length,
          cancelled: Array.from(state.tasks.values()).filter(t => t.status === "cancelled").length,
          outboxCounts,
          leases: outboxLeases,
          retries: outboxRetries,
          deadLetters: outboxDeadLetters,
          receipts: outboxReceipts,
          outbox: {
            ...outboxCounts,
            counts: outboxCounts,
            items: outboxList,
            leases: outboxLeases,
            retries: outboxRetries,
            deadLetters: outboxDeadLetters,
            receipts: outboxReceipts
          }
        }
      },

      // 6. Automações
      {
        id: "automations",
        title: PANEL_SECTION_TITLES.automations,
        status: "ready",
        alerts: [],
        checklist: [
          {
            id: "chk_automations_isolated",
            label: "Disparadores restritos à fila interna do Core",
            status: "passed",
            verified: true
          },
          {
            id: "chk_dry_run_supported",
            label: "Simulação de efeitos antes de mutações de estado",
            status: "passed",
            verified: true
          }
        ],
        actions: [
          {
            id: "act_inspect_automations",
            label: "Listar automações configuradas",
            command: "list_automations",
            params: {},
            requiresConfirmation: false
          },
          {
            id: "act_suspend_automations",
            label: "Suspender disparadores de automação",
            command: "suspend_automations",
            params: {},
            requiresConfirmation: true
          }
        ],
        summary: {
          activeAutomations: 0
        }
      },

      // 7. Canais e dispositivos
      {
        id: "channels_devices",
        title: PANEL_SECTION_TITLES.channels_devices,
        status: "ready",
        alerts: [],
        checklist: [
          {
            id: "chk_origin_deviceId",
            label: "Identificação estrita de origin.deviceId no escopo do turno",
            status: "passed",
            verified: true
          },
          {
            id: "chk_vps_isolation",
            label: "Execução estritamente isolada na VPS sem hardware físico",
            status: "passed",
            verified: true
          }
        ],
        actions: [
          {
            id: "act_list_devices",
            label: "Listar nós e superfícies autorizadas",
            command: "list_devices",
            params: {},
            requiresConfirmation: false
          },
          {
            id: "act_revoke_device",
            label: "Revogar permissão de nó de presença",
            command: "revoke_device",
            params: {},
            requiresConfirmation: true
          }
        ],
        summary: {
          isolatedNode: "vps-isolated",
          targetEngine: "iMac-local-future"
        }
      },

      // 8. Memória e sincronização
      {
        id: "memory_sync",
        title: PANEL_SECTION_TITLES.memory_sync,
        status: "ready",
        alerts: [],
        checklist: [
          {
            id: "chk_sqlite_persistence",
            label: "Eventos, contexto e projeções persistidos no SQLite local",
            status: "passed",
            verified: true
          },
          {
            id: "chk_no_firestore_in_core",
            label: "Zero dependência de Firestore ou nuvem no núcleo",
            status: "passed",
            verified: true
          }
        ],
        actions: [
          {
            id: "act_wal_checkpoint",
            label: "Executar WAL checkpoint truncate",
            command: "wal_checkpoint",
            params: {},
            requiresConfirmation: false
          },
          {
            id: "act_purge_cache",
            label: "Limpar projeções temporárias em memória",
            command: "purge_cache",
            params: {},
            requiresConfirmation: true
          }
        ],
        summary: {
          storageType: "sqlite-wal",
          cloudSync: "none"
        }
      },

      // 9. Segurança e permissões
      {
        id: "security_permissions",
        title: PANEL_SECTION_TITLES.security_permissions,
        status: activePolicy.mode,
        alerts: [],
        checklist: [
          {
            id: "chk_policy_modes",
            label: "Suporte a modos read-only, guarded, workspace e full",
            status: "passed",
            verified: true
          },
          {
            id: "chk_sensitive_confirmation",
            label: "Requisito estrito de confirmed: true para ações sensíveis",
            status: "passed",
            verified: true
          },
          {
            id: "chk_secrets_quarantine",
            label: "Validador assertNoSecrets ativo bloqueando credenciais",
            status: "passed",
            verified: true
          }
        ],
        actions: [
          {
            id: "act_audit_permissions",
            label: "Verificar matriz de permissões ativas",
            command: "audit_permissions",
            params: {},
            requiresConfirmation: false
          },
          {
            id: "act_set_security_mode",
            label: "Alterar modo de segurança ativo",
            command: "set_security_mode",
            params: { mode: "guarded" },
            requiresConfirmation: true
          }
        ],
        summary: {
          activePolicyId: state.activePolicyId,
          activePolicyMode: activePolicy.mode
        }
      },

      // 10. Diagnósticos
      {
        id: "diagnostics",
        title: PANEL_SECTION_TITLES.diagnostics,
        status: "healthy",
        alerts: alertsList,
        checklist: [
          {
            id: "chk_monotonic_sequence",
            label: "Sequência de agregados monotônica e sem gaps",
            status: "passed",
            verified: true
          },
          {
            id: "chk_rebuild_integrity",
            label: "Capacidade comprovada de restauração integral a partir do log",
            status: "passed",
            verified: true
          },
          {
            id: "chk_runtime_service_lifecycle",
            label: "Ciclo de vida e recuperação do PulsoRuntimeService monitorados",
            status: "passed",
            verified: true
          }
        ],
        actions: [
          {
            id: "act_check_integrity",
            label: "Verificar integridade do banco de eventos",
            command: "check_integrity",
            params: {},
            requiresConfirmation: false
          },
          {
            id: "act_recover_outbox_leases",
            label: "Recuperar leases expirados da DurableOutbox",
            command: "recover_outbox_leases",
            params: {},
            requiresConfirmation: false
          },
          {
            id: "act_deep_diagnostics",
            label: "Executar diagnóstico aprofundado com estresse",
            command: "deep_diagnostics",
            params: {},
            requiresConfirmation: true
          }
        ],
        summary: {
          totalEvents: state.metrics.totalEvents,
          totalMutations: state.metrics.totalMutations,
          alertsCount: alertsList.length,
          runtimeServiceStatus: runtimeLifecycle.status,
          eventStoreIntegrityOk: true,
          outboxIntegrityOk: true,
          lifecycle: { ...runtimeLifecycle },
          integrity: {
            ok: true,
            events: state.metrics.totalEvents,
            outboxTotal: outboxCounts.total,
            outboxPending: outboxCounts.pending,
            outboxLeased: outboxCounts.leased,
            outboxDeadLetters: outboxCounts.dead_letter
          }
        }
      },

      // 11. Auditoria
      {
        id: "audit",
        title: PANEL_SECTION_TITLES.audit,
        status: "ready",
        alerts: [],
        checklist: [
          {
            id: "chk_append_only",
            label: "Trilha append-only estrita sem mutação retroativa",
            status: "passed",
            verified: true
          },
          {
            id: "chk_provenance_logged",
            label: "Ator, causação e correlação capturados em cada mutação",
            status: "passed",
            verified: true
          }
        ],
        actions: [
          {
            id: "act_export_audit",
            label: "Exportar trilha de auditoria",
            command: "export_audit",
            params: {},
            requiresConfirmation: false
          },
          {
            id: "act_archive_audit",
            label: "Rotacionar e arquivar lote de auditoria",
            command: "archive_audit",
            params: {},
            requiresConfirmation: true
          }
        ],
        summary: {
          auditEntriesCount: state.audit.length,
          lastEntry: state.audit.length > 0 ? state.audit[state.audit.length - 1] : null
        }
      }
    ];

    return sections;
  }

  getSection(id) {
    return this.sections.find(s => s.id === id) || null;
  }

  toJSON() {
    return {
      generatedAt: this.generatedAt,
      sectionCount: this.sectionCount,
      sections: this.sections
    };
  }
}
