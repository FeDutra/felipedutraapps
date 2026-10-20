import { invariant } from "../domain/assertions.mjs";
import { pulsoId } from "../domain/contracts.mjs";
import { assertNoSecrets } from "./secrets.mjs";
import {
  DEFAULT_SOVEREIGN_IDENTITY,
  CAPABILITY_PARITY_DOMAINS,
  formatScopeKey,
  validateCapabilityRecord
} from "./control-plane-contracts.mjs";
import {
  emptyControlPlaneState,
  projectControlPlane,
  InternalPanelProjection
} from "./panel-projector.mjs";
import { CommandBus } from "./command-bus.mjs";
import { AgentFoundryService } from "../agents/agent-foundry-service.mjs";
import { SecretRefResolver } from "../runtime/secret-ref-resolver.mjs";
import { ProviderRouter } from "../runtime/provider-router.mjs";
import { DurableOutbox } from "../runtime/durable-outbox.mjs";

export class ControlPlaneService {
  constructor({
    store,
    bus = null,
    initialPolicy = "guarded",
    clock = () => new Date().toISOString(),
    secretResolver = null,
    router = null,
    outbox = null,
    runtime = null
  }) {
    invariant(store, "event_store_required");
    this.store = store;
    this.clock = clock;
    this.state = emptyControlPlaneState();
    this.secretResolver = secretResolver || new SecretRefResolver({ clock: this.clock });
    this.foundry = new AgentFoundryService({ store, state: this.state, clock: this.clock });
    this.router = router || new ProviderRouter({
      store,
      state: this.state,
      secretResolver: this.secretResolver,
      clock: this.clock
    });
    this.outbox = outbox || new DurableOutbox({
      store,
      state: this.state,
      secretResolver: this.secretResolver,
      clock: this.clock
    });
    this.runtime = runtime;
    this.bus = bus || new CommandBus({
      store,
      state: this.state,
      initialPolicy,
      foundry: this.foundry,
      secretResolver: this.secretResolver,
      router: this.router,
      outbox: this.outbox,
      runtime: this.runtime
    });
    this.restore();
  }

  restore() {
    this.state = emptyControlPlaneState();
    this.foundry.state = this.state;
    this.foundry.supervisor.state = this.state;
    this.foundry.restore();
    const events = this.store.all().filter(e =>
      e.type.startsWith("control_plane.") ||
      e.type.startsWith("agent_foundry.") ||
      e.type.startsWith("runtime.") ||
      e.type.startsWith("outbox.")
    );
    projectControlPlane(events, this.state);
    if (this.outbox) {
      this.outbox.state = this.state;
      for (const item of this.outbox.list()) {
        this.state.outboxItems.set(item.outboxId, item);
      }
    }
    if (this.router) {
      this.router.state = this.state;
    }
    this.bus.state = this.state;
    return this.state;
  }

  async command(name, payload = {}, options = {}) {
    return this.bus.execute({
      name,
      payload,
      ...options
    });
  }

  list(resource, query = {}) {
    let items = [];
    switch (resource) {
      case "providers":
        items = Array.from(this.state.providers.values());
        break;
      case "bindings":
        items = Array.from(this.state.bindings.values());
        break;
      case "capabilities":
        items = Array.from(this.state.capabilities.values());
        break;
      case "agents":
        items = Array.from(this.state.agents.values());
        break;
      case "blueprints":
        items = Array.from(this.state.blueprints.values());
        break;
      case "revisions":
        items = Array.from(this.state.revisions.values());
        break;
      case "instances":
        items = Array.from(this.state.instances.values());
        break;
      case "grants":
        items = Array.from(this.state.grants.values());
        break;
      case "delegations":
        items = Array.from(this.state.delegations.values());
        break;
      case "agent_runs":
      case "runs":
        items = Array.from(this.state.agentRuns.values());
        break;
      case "tools":
        items = Array.from(this.state.tools.values());
        break;
      case "policies":
        items = Array.from(this.state.policies.values());
        break;
      case "tasks":
        items = Array.from(this.state.tasks.values());
        break;
      case "outbox":
      case "outbox_items":
        items = this.outbox ? this.outbox.list() : Array.from(this.state.outboxItems.values());
        break;
      case "routing_receipts":
        items = [...this.state.routingReceipts];
        break;
      case "connection_receipts":
        items = [...this.state.connectionReceipts];
        break;
      case "audit":
        items = [...this.state.audit];
        break;
      case "alerts":
        items = Array.from(this.state.alerts.values());
        break;
      case "sections":
        items = new InternalPanelProjection(this.state).sections;
        break;
      default:
        throw new Error("unknown_control_plane_resource:" + resource);
    }

    if (query.status) {
      items = items.filter(i => i.status === query.status);
    }
    if (query.kind) {
      items = items.filter(i => i.kind === query.kind);
    }
    if (query.type) {
      items = items.filter(i => (i.type === query.type || i.kind === query.type));
    }
    if (query.limit && typeof query.limit === "number") {
      items = items.slice(0, query.limit);
    }

    // Defensive check: no raw secrets ever leak in query results
    assertNoSecrets(items);
    this.secretResolver.assertZeroLeakage(items);
    return JSON.parse(JSON.stringify(items));
  }

  get(resource, id) {
    let item = null;
    switch (resource) {
      case "provider":
      case "providers":
        item = this.state.providers.get(id) ?? null;
        break;
      case "binding":
      case "bindings": {
        const key = formatScopeKey(id);
        item = this.state.bindings.get(key)
          ?? this.state.bindings.get(id)
          ?? (key === "system" ? this.state.bindings.get("global") : null)
          ?? (key === "global" ? this.state.bindings.get("system") : null)
          ?? null;
        break;
      }
      case "capability":
      case "capabilities":
        item = this.state.capabilities.get(id) ?? null;
        break;
      case "agent":
      case "agents":
        item = this.state.agents.get(id) ?? this.state.instances.get(id) ?? null;
        break;
      case "blueprint":
      case "blueprints":
        item = this.state.blueprints.get(id) ?? null;
        break;
      case "revision":
      case "revisions":
        item = this.state.revisions.get(id) ?? null;
        break;
      case "instance":
      case "instances":
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
      case "agent_run":
      case "agent_runs":
        item = this.state.agentRuns.get(id) ?? null;
        break;
      case "tool":
      case "tools":
        item = this.state.tools.get(id) ?? null;
        break;
      case "policy":
      case "policies":
        item = this.state.policies.get(id) ?? null;
        break;
      case "task":
      case "tasks":
        item = this.state.tasks.get(id) ?? null;
        break;
      case "outbox":
      case "outbox_item":
      case "outbox_items":
        item = (this.outbox ? this.outbox.get(id) : null) ?? this.state.outboxItems.get(id) ?? null;
        break;
      case "section":
        if (this.outbox) {
          for (const outItem of this.outbox.list()) {
            this.state.outboxItems.set(outItem.outboxId, outItem);
          }
        }
        item = new InternalPanelProjection(this.state).getSection(id);
        break;
      case "panel":
        if (this.outbox) {
          for (const outItem of this.outbox.list()) {
            this.state.outboxItems.set(outItem.outboxId, outItem);
          }
        }
        item = new InternalPanelProjection(this.state).toJSON();
        break;
      default:
        throw new Error("unknown_control_plane_resource:" + resource);
    }

    if (item) {
      assertNoSecrets(item);
      this.secretResolver.assertZeroLeakage(item);
      return JSON.parse(JSON.stringify(item));
    }
    return null;
  }

  snapshot({ version = "0.3.0" } = {}) {
    if (this.outbox) {
      for (const outItem of this.outbox.list()) {
        this.state.outboxItems.set(outItem.outboxId, outItem);
      }
    }
    const projection = new InternalPanelProjection(this.state);
    const activePolicy = this.state.policies.get(this.state.activePolicyId) || { mode: "guarded" };

    const snap = {
      version,
      timestamp: new Date().toISOString(),
      identityId: DEFAULT_SOVEREIGN_IDENTITY,
      activePolicyMode: activePolicy.mode,
      providers: Array.from(this.state.providers.values()),
      bindings: Array.from(this.state.bindings.values()),
      capabilities: Array.from(this.state.capabilities.values()),
      agents: Array.from(this.state.agents.values()),
      blueprints: Array.from(this.state.blueprints.values()),
      revisions: Array.from(this.state.revisions.values()),
      instances: Array.from(this.state.instances.values()),
      grants: Array.from(this.state.grants.values()),
      delegations: Array.from(this.state.delegations.values()),
      tools: Array.from(this.state.tools.values()),
      policies: Array.from(this.state.policies.values()),
      tasks: Array.from(this.state.tasks.values()),
      outbox: Array.from(this.state.outboxItems.values()),
      routingReceipts: [...this.state.routingReceipts],
      connectionReceipts: [...this.state.connectionReceipts],
      runtimeLifecycle: { ...this.state.runtimeLifecycle },
      audit: [...this.state.audit],
      panel: projection.toJSON()
    };

    assertNoSecrets(snap);
    this.secretResolver.assertZeroLeakage(snap);
    return JSON.parse(JSON.stringify(snap));
  }

  async initDefaults({ identityId = DEFAULT_SOVEREIGN_IDENTITY } = {}) {
    // 1. Standard Policy Profiles
    const policyProfiles = [
      {
        profileId: "policy_read_only",
        name: "Read-Only Security Mode",
        mode: "read-only",
        allowedActions: ["read:*", "list:*", "get:*", "inspect:*"],
        deniedActions: ["*"],
        requireConfirmationFor: ["*"]
      },
      {
        profileId: "policy_guarded",
        name: "Guarded Security Mode",
        mode: "guarded",
        allowedActions: ["*"],
        deniedActions: [],
        requireConfirmationFor: [
          "activate_model_fallback",
          "remove_provider",
          "cancel_outbox_item",
          "deep_diagnostics",
          "cancel_task",
          "cancel_all_tasks",
          "reset_panel",
          "set_active_policy",
          "pause_all_agents",
          "disable_dangerous_tools",
          "revoke_device",
          "purge_cache",
          "archive_audit"
        ]
      },
      {
        profileId: "policy_workspace",
        name: "Workspace Scoped Security Mode",
        mode: "workspace",
        allowedActions: ["*"],
        deniedActions: [],
        requireConfirmationFor: ["set_active_policy", "set_policy_profile", "reset_panel"]
      },
      {
        profileId: "policy_full",
        name: "Full Autonomous Security Mode",
        mode: "full",
        allowedActions: ["*"],
        deniedActions: [],
        requireConfirmationFor: ["reset_panel", "archive_audit"]
      }
    ];

    for (const pol of policyProfiles) {
      if (!this.state.policies.has(pol.profileId)) {
        await this.command("set_policy_profile", pol, { confirmed: true });
      }
    }

    // 2. Standard Provider Profiles with canonical fields
    if (!this.state.providers.has("provider_primary")) {
      await this.command("register_provider", {
        providerId: "provider_primary",
        kind: "model",
        displayName: "Pulso Primary Model Engine",
        endpoint: "in-process://primary-engine",
        capabilities: ["text_completion", "structured_output", "reasoning"],
        enabled: true,
        health: { status: "healthy", detail: "ready" },
        metadata: { tier: "primary" },
        secretRef: "env:PULSO_PRIMARY_MODEL_KEY"
      });
    }

    if (!this.state.providers.has("provider_fallback_1")) {
      await this.command("register_provider", {
        providerId: "provider_fallback_1",
        kind: "model",
        displayName: "Pulso Fast Fallback Engine",
        endpoint: "in-process://fallback-1",
        capabilities: ["text_completion", "fast_response"],
        enabled: true,
        health: { status: "healthy", detail: "ready" },
        metadata: { tier: "secondary" },
        secretRef: "env:PULSO_FALLBACK_1_KEY"
      });
    }

    if (!this.state.providers.has("provider_fallback_2")) {
      await this.command("register_provider", {
        providerId: "provider_fallback_2",
        kind: "model",
        displayName: "Pulso Resilient Fallback Engine",
        endpoint: "in-process://fallback-2",
        capabilities: ["text_completion", "high_availability"],
        enabled: true,
        health: { status: "healthy", detail: "ready" },
        metadata: { tier: "tertiary" },
        secretRef: "env:PULSO_FALLBACK_2_KEY"
      });
    }

    // 3. Model Binding with primary and ordered fallbackChain
    if (!this.state.bindings.has("global")) {
      await this.command("set_model_binding", {
        scope: { type: "global", scopeId: null },
        primary: {
          providerId: "provider_primary",
          model: "pulso-standard-fast"
        },
        fallbackChain: [
          {
            providerId: "provider_fallback_1",
            model: "pulso-fallback-fast"
          },
          {
            providerId: "provider_fallback_2",
            model: "pulso-fallback-resilient"
          }
        ]
      });
    }

    // 4. Default Agent Blueprint, Instance and Profile with sovereign identity lotus
    if (!this.state.blueprints.has("bp_lotus_assistant")) {
      await this.foundry.createBlueprint({
        blueprintId: "bp_lotus_assistant",
        name: "Lótus Sovereign Assistant",
        role: "Autonomous Sovereign Co-Pilot",
        mission: "Governar a orquestração soberana da PULSO sem concessão de autoridade a provedores terceiros",
        instructions: "Você é Lótus, integradora soberana da PULSO. Mantenha controle, integridade e fail-closed.",
        requiredCapabilities: ["reasoning", "task_planning", "tool_dispatch"],
        skills: ["code_audit", "system_diagnostics"],
        tools: ["tool_file_inspect"],
        memory: { scope: "isolated", retainContext: true, maxContextTokens: 8192 },
        policies: { mode: "guarded", requireConfirmationFor: ["system:reset", "provider:remove"] },
        providerDefaults: { modelProviderId: "provider_primary", model: "pulso-standard-fast" },
        runtimePreferences: { executorProviderId: "fake-executor", timeoutMs: 30000 },
        limits: { maxTurns: 10, maxTokens: 8192, maxCost: 1.0, maxConcurrency: 2, timeoutMs: 30000 },
        surfaces: ["desktop", "internal", "terminal"],
        metadata: { sovereign: true },
        provenance: { kind: "human", createdBy: "fe", lineage: ["lotus-root"] }
      });
    }

    if (!this.state.instances.has("agent_lotus")) {
      await this.foundry.materializeAgent({
        agentId: "agent_lotus",
        blueprintId: "bp_lotus_assistant",
        identityId,
        initialStatus: "active",
        metadata: { sovereign: true, name: "Lótus Sovereign Assistant", role: "Autonomous Sovereign Co-Pilot" }
      });
      await this.foundry.grantCapability({
        agentId: "agent_lotus",
        capability: "tool:tool_file_inspect",
        effect: "allow"
      });
    }

    if (!this.state.agents.has("agent_lotus")) {
      await this.command("register_agent", {
        agentId: "agent_lotus",
        name: "Lótus Sovereign Assistant",
        identityId,
        role: "Autonomous Sovereign Co-Pilot",
        capabilities: ["reasoning", "task_planning", "tool_dispatch"],
        policyProfileId: "policy_guarded",
        modelScope: { type: "global", scopeId: null },
        allowedTools: ["*"],
        status: "active",
        metadata: { sovereign: true }
      });
    }

    // 5. Standard Tools & Extensions
    const tools = [
      {
        toolId: "tool_file_inspect",
        name: "Inspecionar Arquivo",
        kind: "tool",
        category: "filesystem",
        description: "Lê arquivos locais sob permissão de workspace",
        enabled: true,
        dangerous: false,
        requiresConfirmation: false
      },
      {
        toolId: "tool_system_shell",
        name: "Executar Comando Shell",
        kind: "tool",
        category: "system",
        description: "Executa comandos no ambiente isolado",
        enabled: true,
        dangerous: true,
        requiresConfirmation: true
      }
    ];

    for (const tool of tools) {
      if (!this.state.tools.has(tool.toolId)) {
        await this.command("register_tool", tool);
      }
    }

    // 6. Capability Records (all 17 parity domains with canonical status: absent|planned|partial|ready|verified)
    const parityDefinitions = [
      {
        id: "providers_models",
        name: "Providers e Modelos",
        status: "partial",
        owner: "ProviderRouter / ModelAdapters / ControlPlaneService",
        evidence: [
          "test/control-plane.test.mjs: primário e fallbackChain ordenado",
          "test/runtime-spine.test.mjs: adapters OpenAI/Anthropic/Local por protocolo em loopback, precedência task>session>agent>system e fallback explícito com recibo"
        ],
        reference: "Provedores hospedados e locais substituíveis com perfis de autenticação e fallback configurável no Gateway local",
        checks: [
          { id: "c1", label: "ProviderRouter com seleção task > session > agent > system e fallback explícito com recibo", status: "passed", verified: true },
          { id: "c2", label: "Adapters provider-neutral (OpenAI, Anthropic, Local OpenAI-compatible) verificados por protocolo em loopback/transporte injetado", status: "passed", verified: true },
          { id: "c3", label: "Isolamento estrito de segredos com SecretRefResolver em runtime e zero vazamento", status: "passed", verified: true },
          { id: "c4", label: "Verificação live com credenciais reais/canária e inferência local física no iMac Intel x86_64", status: "pending", verified: false }
        ],
        next: "Canária live opcional com credenciais reais e inferência física no iMac Intel x86_64 com macOS Keychain"
      },
      {
        id: "identity",
        name: "Identidade Soberana",
        status: "verified",
        owner: "PulsoCore / DEFAULT_SOVEREIGN_IDENTITY",
        evidence: ["test/control-plane.test.mjs: identidade soberana Lótus", "src/domain/contracts.mjs: assertExternalIdsConfined"],
        reference: "Identidades de agentes gerenciadas no Gateway local com perfis de execução por workspace",
        checks: [
          { id: "c1", label: "Identidade 'lotus' imutável e soberana", status: "passed", verified: true },
          { id: "c2", label: "Confinamento estrito de identificadores externos", status: "passed", verified: true }
        ],
        next: "Assinatura criptográfica local de identidade de nó"
      },
      {
        id: "sessions_turns_runs",
        name: "Sessões, Turnos e Runs",
        status: "verified",
        owner: "PulsoCore / State Machine",
        evidence: ["test/core.test.mjs: trabalho profundo, idempotência, cancelamento", "src/core/pulso-core.mjs"],
        reference: "Gestão de sessões e eventos com loop de turnos de diálogo e streaming de deltas no Gateway",
        checks: [
          { id: "c1", label: "Agregados canônicos com ciclo de vida formal", status: "passed", verified: true },
          { id: "c2", label: "Idempotência transacional na admissão", status: "passed", verified: true }
        ],
        next: "Janela de contexto adaptativa gerenciada pelo Core"
      },
      {
        id: "memory",
        name: "Memória Episódica e Contextual",
        status: "partial",
        owner: "PulsoCore / SqliteEventStore",
        evidence: ["test/core.test.mjs: sessão e memória preservada no event log"],
        reference: "Armazenamento e indexação de memória contextual, documentos de workspace e cache de contexto",
        checks: [
          { id: "c1", label: "Contexto associado a sessões e turnos", status: "passed", verified: true },
          { id: "c2", label: "Índice vetorial semântico local", status: "pending", verified: false }
        ],
        next: "Vetorização local com embeddings e sqlite-vss no iMac Intel x86_64"
      },
      {
        id: "tools",
        name: "Ferramentas e Executores",
        status: "verified",
        owner: "ControlPlaneService / ToolRecord",
        evidence: ["test/control-plane.test.mjs: confirmação sensível e catálogo", "src/control-plane/command-bus.mjs"],
        reference: "Registro de ferramentas (tools), protocolo MCP e execução controlada por políticas de sandbox",
        checks: [
          { id: "c1", label: "Catálogo tipado de ferramentas", status: "passed", verified: true },
          { id: "c2", label: "Portão obrigatório de confirmação para ações perigosas", status: "passed", verified: true }
        ],
        next: "Sandbox de isolamento de processos com controle de quotas"
      },
      {
        id: "skills_extensions",
        name: "Skills e Extensões",
        status: "partial",
        owner: "ControlPlaneService / ExtensionRecord",
        evidence: ["src/control-plane/control-plane-contracts.mjs: validateToolRecord"],
        reference: "Sistema extensível de plugins e diretórios de skills (SKILL.md) com empacotamento declarativo",
        checks: [
          { id: "c1", label: "Registro formal de extensões no control plane", status: "passed", verified: true },
          { id: "c2", label: "Parser e carregador dinâmico em runtime", status: "pending", verified: false }
        ],
        next: "Carregador dinâmico de manifests com verificação SHA-256"
      },
      {
        id: "agents",
        name: "Agentes e Subagentes",
        status: "partial",
        owner: "AgentFoundryService / Supervisor / ControlPlane",
        evidence: [
          "test/control-plane.test.mjs: perfis de agentes e preservação de lotus",
          "test/agent-foundry.test.mjs: Agent Foundry soberano, delegação governada e supervisor determinístico"
        ],
        reference: "Perfis de agentes, orquestração de subagentes e roteamento de contexto no Gateway",
        checks: [
          { id: "c1", label: "Agent Foundry soberano: blueprints, revisões imutáveis SHA-256 e instâncias materializadas", status: "passed", verified: true },
          { id: "c2", label: "Delegação governada com lineage parent/child e retorno por recibo sem cópia integral de memória", status: "passed", verified: true },
          { id: "c3", label: "Supervisão com limites de concorrência, fail-closed de ferramentas e orçamento estrito", status: "passed", verified: true },
          { id: "c4", label: "Inferência local física de modelos no hardware iMac Intel x86_64", status: "pending", verified: false }
        ],
        next: "Integração com inferência local no iMac Intel x86_64 (CPU / hardware-neutral) e modelos locais com resolução de credenciais via macOS Keychain"
      },
      {
        id: "tasks_queues",
        name: "Tarefas Operacionais e Filas",
        status: "verified",
        owner: "DurableOutbox / PulsoRuntimeService / ControlPlaneService",
        evidence: [
          "test/control-plane.test.mjs: tarefas operacionais, checkpoints e cancelamento",
          "test/runtime-spine.test.mjs: DurableOutbox SQLite com idempotência, lease, backoff, dead-letter e recovery"
        ],
        reference: "Execução de tarefas em background (background tasks), filas assíncronas e monitoramento no Gateway",
        checks: [
          { id: "c1", label: "Fila de tarefas operacionais e DurableOutbox SQLite persistida e auditável", status: "passed", verified: true },
          { id: "c2", label: "Lease com expiração, recovery no restart, retry/backoff determinístico, dead-letter e recibos", status: "passed", verified: true }
        ],
        next: "Workers concorrentes multi-processo sobre o DurableOutbox"
      },
      {
        id: "automations",
        name: "Automações e Disparadores",
        status: "partial",
        owner: "ControlPlaneService / Automations",
        evidence: ["src/control-plane/panel-projector.mjs: seção de automações"],
        reference: "Agendador de cron, gatilhos de eventos e automações baseadas em regras e webhooks",
        checks: [
          { id: "c1", label: "Definição de domínio e controle no painel", status: "passed", verified: true },
          { id: "c2", label: "Scheduler durável interno de cron", status: "pending", verified: false }
        ],
        next: "Engine interno de timers e agendamento durável"
      },
      {
        id: "channels",
        name: "Canais e Mensageria",
        status: "partial",
        owner: "PulsoCore / Origin Specification",
        evidence: ["src/core/pulso-core.mjs: origin.channel desacoplado"],
        reference: "Integração multicanal (Telegram, Discord, Slack, WhatsApp, webhooks) via adaptadores de mensageria",
        checks: [
          { id: "c1", label: "Contrato de canal desacoplado em origin do turno", status: "passed", verified: true },
          { id: "c2", label: "Adapters in-process para canais desktop locais", status: "pending", verified: false }
        ],
        next: "Ponte in-process para UI de mensageria da casca desktop"
      },
      {
        id: "nodes_devices",
        name: "Nós e Dispositivos",
        status: "verified",
        owner: "PulsoCore / Device Topology",
        evidence: ["test/core.test.mjs: origin.deviceId verificado em cada turno"],
        reference: "Rede de nós complementares (companion nodes) e dispositivos pareados com o Gateway local",
        checks: [
          { id: "c1", label: "Topologia clara: nó VPS, alvo futuro de instalação desktop no MacBook e futuro host de inferência local no iMac Intel x86_64", status: "passed", verified: true },
          { id: "c2", label: "Validação estrita de origin.deviceId na admissão", status: "passed", verified: true }
        ],
        next: "Protocolo de pareamento criptográfico mTLS ponto a ponto"
      },
      {
        id: "voice_media",
        name: "Voz e Mídia",
        status: "planned",
        owner: "PulsoCore / Modality Contract",
        evidence: ["src/domain/contracts.mjs: suporte a modality no input"],
        reference: "Pipelines de áudio, fala (TTS/STT) e processamento multimodal integrados aos fluxos do Gateway",
        checks: [
          { id: "c1", label: "Contratos de multimodalidade no turno", status: "passed", verified: true },
          { id: "c2", label: "Motor local de áudio STT/TTS", status: "pending", verified: false }
        ],
        next: "Whisper local e síntese de voz compatíveis com arquitetura x86_64 (CPU / hardware-neutral)"
      },
      {
        id: "policies_permissions",
        name: "Políticas e Modos de Segurança",
        status: "verified",
        owner: "ControlPlaneService / CommandBus",
        evidence: ["test/control-plane.test.mjs: modos read-only, guarded, workspace, full"],
        reference: "Modos de permissão, políticas de sandbox e controle de autorização de ferramentas no Gateway",
        checks: [
          { id: "c1", label: "4 modos operacionais: read-only, guarded, workspace, full", status: "passed", verified: true },
          { id: "c2", label: "Portão de confirmação obrigatório para ações sensíveis", status: "passed", verified: true }
        ],
        next: "Verificação contextual baseada em RBAC e aprovação local"
      },
      {
        id: "secrets",
        name: "Gestão e Isolamento de Segredos",
        status: "verified",
        owner: "SecretRefResolver / ControlPlaneService / assertNoSecrets",
        evidence: [
          "test/control-plane.test.mjs: isolamento estrito de segredos assertNoSecrets",
          "test/runtime-spine.test.mjs: SecretRefResolver runtime-only e redaction estruturada com zero vazamento"
        ],
        reference: "Gestão de segredos, referências de credenciais (SecretRef) e perfis de autenticação desacoplados",
        checks: [
          { id: "c1", label: "Proibição estrita de credenciais brutas em event log, snapshots, erros, health, receipts e painel", status: "passed", verified: true },
          { id: "c2", label: "SecretRefResolver runtime-only (env/memory/keychain) sem leitura de process.env por padrão", status: "passed", verified: true }
        ],
        next: "Provedor de resolução de secretRef integrado ao macOS Keychain nativo no MacBook e iMac Intel x86_64"
      },
      {
        id: "audit",
        name: "Auditoria Imutável e Rastreabilidade",
        status: "verified",
        owner: "SqliteEventStore / Audit Log",
        evidence: ["test/control-plane.test.mjs: auditoria append-only monotônica"],
        reference: "Logs de auditoria estruturados, registro de eventos de execução e telemetria no Gateway",
        checks: [
          { id: "c1", label: "Event log append-only com sequência monotônica", status: "passed", verified: true },
          { id: "c2", label: "Rastreio completo de ator, causação e correlação", status: "passed", verified: true }
        ],
        next: "Exportação com selo criptográfico assinado da trilha de eventos"
      },
      {
        id: "diagnostics_health",
        name: "Diagnósticos e Saúde do Sistema",
        status: "verified",
        owner: "PulsoRuntimeService / SqliteEventStore / verifyIntegrity",
        evidence: [
          "test/core.test.mjs: verifyIntegrity no SqliteEventStore",
          "test/runtime-spine.test.mjs: PulsoRuntimeService lifecycle, health e recovery on start"
        ],
        reference: "Health endpoints, monitoramento de subsistemas, status de conexões e diagnósticos do Gateway",
        checks: [
          { id: "c1", label: "Verificação de integridade estrutural do EventStore e do DurableOutbox", status: "passed", verified: true },
          { id: "c2", label: "Ciclo de vida PulsoRuntimeService (start/stop/health/recovery) e projeção diagnóstica nas 11 seções", status: "passed", verified: true }
        ],
        next: "Telemetria local com percentis p95/p99 de latência"
      },
      {
        id: "sync_update",
        name: "Sincronização e Atualização",
        status: "partial",
        owner: "SqliteEventStore / DurableOutbox",
        evidence: [
          "test/core.test.mjs: backup e restore transacional WAL",
          "test/runtime-spine.test.mjs: DurableOutbox local em SQLite com recibos e recovery após restart"
        ],
        reference: "Ciclo de vida de configuração, rotinas de backup de estado e procedimentos de atualização",
        checks: [
          { id: "c1", label: "Backup e restauração determinística via WAL truncate e DurableOutbox local com recovery", status: "passed", verified: true },
          { id: "c2", label: "Replicação remota ponto a ponto via outbox entre nós físicos", status: "pending", verified: false }
        ],
        next: "Transporte de sincronização outbox entre VPS, MacBook e iMac Intel x86_64"
      }
    ];

    for (const capDef of parityDefinitions) {
      if (!this.state.capabilities.has(capDef.id)) {
        const validated = validateCapabilityRecord({
          capabilityId: capDef.id,
          name: capDef.name,
          category: "control_plane",
          status: capDef.status,
          owner: capDef.owner,
          evidence: capDef.evidence,
          functionalReference: capDef.reference,
          nextAcceptance: capDef.next,
          checklist: capDef.checks,
          metadata: {}
        });
        this.state.capabilities.set(capDef.id, validated);
      }
    }

    return this.snapshot();
  }
}
