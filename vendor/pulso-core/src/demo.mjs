import { mkdir, rm } from "node:fs/promises";
import {
  PulsoCore,
  SqliteEventStore,
  FakeModelProvider,
  FakeExecutorProvider,
  OpenClawShadowAdapter,
  generateShadowReport,
  ControlPlaneService,
  InternalPanelProjection,
  PulsoRuntimeService,
  SecretRefResolver,
  OpenAIModelAdapter,
  AnthropicModelAdapter,
  LocalOpenAICompatibleAdapter
} from "./index.mjs";

const dir = ".pulso";
const database = dir + "/demo.sqlite";
await rm(dir, { recursive: true, force: true });
await mkdir(dir, { recursive: true });

const shadowAdapter = new OpenClawShadowAdapter({ id: "openclaw-shadow" });
const store = new SqliteEventStore(database);
const core = new PulsoCore({
  store,
  modelProviders: [
    new FakeModelProvider("model-a", "Motor A"),
    new FakeModelProvider("model-b", "Motor B")
  ],
  executorProviders: [
    new FakeExecutorProvider(),
    shadowAdapter
  ]
});

console.log("=== [v0.2] EXECUÇÃO DO RUN SOBERANO COM OPENCLAW EM MODO SOMBRA ===\n");
const result = await core.handle({
  sessionId: "session_demo",
  spaceId: "area_pulso",
  identityId: "lotus",
  input: { modality: "text", text: "Prove o run soberano v0.2 com OpenClaw em modo sombra.", attachments: [] },
  origin: { deviceId: "vps-isolated", surface: "harness", channel: "local" },
  idempotencyKey: "demo-v0.2",
  memory: { pinnedContext: "v0.2 shadow harness proof" },
  policy: { localOnly: true },
  route: {
    lane: "deep_work",
    capability: "core.shadow.proof",
    executorProviderId: "openclaw-shadow"
  }
});

const report = generateShadowReport({
  run: core.state.runs.get(result.execution.runId),
  turn: result.turn,
  session: core.state.sessions.get(result.turn.sessionId),
  adapter: shadowAdapter
});

console.log("=== RELATÓRIO HUMANO (MARKDOWN) ===\n");
console.log(report.human);
console.log("\n=== RELATÓRIO JSON ===\n");
console.log(JSON.stringify(report.json, null, 2));

console.log("\n=======================================================");
console.log("=== [v0.3] DEMONSTRAÇÃO DO AUTONOMY CONTROL PLANE ===");
console.log("=======================================================\n");

const controlPlane = new ControlPlaneService({ store });
await controlPlane.initDefaults();

// Submeter e iniciar uma tarefa operacional
const taskSubmit = await controlPlane.command("submit_task", {
  taskId: "demo_backup_task",
  taskType: "wal_snapshot_backup",
  priority: "high"
});
await controlPlane.command("start_task", { taskId: taskSubmit.result.taskId });
await controlPlane.command("record_task_checkpoint", {
  taskId: taskSubmit.result.taskId,
  checkpointId: "chk_wal_flushed",
  label: "WAL truncate e verificação de integridade concluídos",
  progress: 50
});

const projection = new InternalPanelProjection(controlPlane.state);
console.log(`InternalPanelProjection gerada com exatamente ${projection.sectionCount} seções:\n`);

for (const section of projection.sections) {
  const sensitiveActions = section.actions.filter(a => a.requiresConfirmation).map(a => a.id);
  console.log(`[${section.id}] ${section.title}`);
  console.log(`  - Status: ${section.status}`);
  console.log(`  - Alertas: ${section.alerts.length}`);
  console.log(`  - Checklist (${section.checklist.length} itens): ${section.checklist.map(c => c.id).join(", ")}`);
  console.log(`  - Ações (${section.actions.length} ações): ${section.actions.map(a => a.id).join(", ")}`);
  if (sensitiveActions.length > 0) {
    console.log(`  - Ações sensíveis (requiresConfirmation: true): ${sensitiveActions.join(", ")}`);
  }
  console.log("");
}

console.log(`Integridade do Event Store SQLite: ${JSON.stringify(store.verifyIntegrity())}`);
console.log(`Total de entradas na auditoria append-only: ${controlPlane.list("audit").length}`);

console.log("\n=======================================================");
console.log("=== [v0.4] DEMONSTRAÇÃO DO AGENT FOUNDRY SOBERANO ===");
console.log("=======================================================\n");

// 1. Criar blueprint especialista e provar hash
const bpSpecialist = await controlPlane.foundry.createBlueprint({
  blueprintId: "bp_specialist_auditor",
  name: "Auditor Especialista em Segurança",
  role: "Auditor Soberano",
  mission: "Auditar integridade de código e políticas em tempo de execução",
  instructions: "Execute validação estrita sem concessão de autoridade externa.",
  requiredCapabilities: ["code_audit", "policy_validation"],
  skills: ["security_audit"],
  tools: ["tool_file_inspect"],
  memory: { scope: "isolated", retainContext: true, maxContextTokens: 4096 },
  policies: { mode: "guarded", requireConfirmationFor: ["system:write"] },
  providerDefaults: { modelProviderId: "provider_primary", model: "pulso-standard-fast" },
  runtimePreferences: { executorProviderId: "fake-executor", timeoutMs: 15000 },
  limits: { maxTurns: 5, maxTokens: 4096, maxCost: 0.5, maxConcurrency: 1, timeoutMs: 15000 },
  surfaces: ["internal"],
  metadata: { domain: "security" }
});
console.log(`1. Blueprint Criado: ${bpSpecialist.blueprint.blueprintId} (${bpSpecialist.blueprint.name})`);
console.log(`   - Revisão inicial: ${bpSpecialist.revision.revisionId}`);
console.log(`   - SHA-256 integridade: ${bpSpecialist.revision.hash}`);

// 2. Materializar instância e ativar
const instSpecialist = await controlPlane.foundry.materializeAgent({
  agentId: "agent_sec_auditor",
  blueprintId: "bp_specialist_auditor",
  identityId: "specialist_security_node",
  initialStatus: "ready"
});
await controlPlane.foundry.activateAgent("agent_sec_auditor");
console.log(`2. Instância Materializada e Ativada: ${instSpecialist.instance.agentId}`);
console.log(`   - Identidade Soberana: ${instSpecialist.instance.identityId}`);
console.log(`   - Status operacional: ${controlPlane.foundry.get("instance", "agent_sec_auditor").status}`);

// 3. Conceder grant explícito e provar autorização
await controlPlane.foundry.grantCapability({
  agentId: "agent_sec_auditor",
  capability: "tool:tool_file_inspect",
  effect: "allow"
});
const authCheck = controlPlane.foundry.supervisor.checkAuthorization("agent_sec_auditor", "tool:tool_file_inspect");
console.log(`3. Autorização de Ferramenta (Fail-Closed): tool_file_inspect -> ${authCheck.authorized ? "AUTORIZADO" : "NEGADO"}`);

// 4. Delegação governada de Lótus para o Especialista
const delegation = await controlPlane.foundry.createDelegation({
  delegationId: "del_sec_audit_v04",
  parentAgentId: "agent_lotus",
  childAgentId: "agent_sec_auditor",
  objective: "Auditar repositório e atestar conformidade v0.4",
  allowedContext: { shareHistory: false, allowedVariables: ["target_dir"], artifactRefs: ["manifest.json"] },
  grantedCapabilities: ["code_audit"],
  budget: { maxTurns: 3, maxTimeMs: 10000, maxTokens: 2048, maxCost: 0.1, maxConcurrency: 1 }
});
await controlPlane.foundry.acceptDelegation("del_sec_audit_v04");
console.log(`4. Delegação Governada Criada: ${delegation.delegation.delegationId}`);
console.log(`   - Lineage: ${delegation.delegation.parentAgentId} -> ${delegation.delegation.childAgentId}`);
console.log(`   - Status da delegação: accepted`);

// 5. Iniciar run e concluir com recibo conciso e referência de artefato
const runChild = await controlPlane.foundry.startAgentRun({
  agentRunId: "run_sec_audit_01",
  agentId: "agent_sec_auditor",
  delegationId: "del_sec_audit_v04",
  parentRunId: "run_lotus_orchestration"
});
await controlPlane.foundry.recordCheckpoint({
  runId: "run_sec_audit_01",
  checkpointId: "chk_ast_verified",
  step: 1,
  data: { filesChecked: 45 },
  usageDelta: { turns: 1, tokens: 250, cost: 0.01, elapsedMs: 80, toolCalls: 1 }
});
await controlPlane.foundry.completeAgentRun({
  runId: "run_sec_audit_01",
  result: { summary: "Auditoria de segurança concluída com 100% de conformidade." },
  artifactRefs: ["art_audit_v04_receipt"],
  usageDelta: { turns: 1, tokens: 180, cost: 0.01, elapsedMs: 60, toolCalls: 0 }
});

const finishedDelegation = controlPlane.foundry.get("delegation", "del_sec_audit_v04");
console.log(`5. Run Concluído e Recibo Emitido ao Pai:`);
console.log(`   - Status da delegação: ${finishedDelegation.status}`);
console.log(`   - Recibo:`, JSON.stringify(finishedDelegation.receipt, null, 2));

// 6. Projeção da Central Interna (Seção Agentes)
const agentsSection = controlPlane.get("section", "agents");
console.log(`\n6. Central Interna - Seção [${agentsSection.id}] ${agentsSection.title}:`);
console.log(`   - Status da seção: ${agentsSection.status}`);
console.log(`   - Blueprints cadastrados: ${agentsSection.summary.blueprintsCount}`);
console.log(`   - Instâncias materializadas: ${agentsSection.summary.instancesCount}`);
console.log(`   - Instâncias ativas: ${agentsSection.summary.activeInstancesCount}`);
console.log(`   - Grants registrados: ${agentsSection.summary.grantsCount}`);
console.log(`   - Delegações: ${agentsSection.summary.delegationsCount}`);

console.log("\n=======================================================");
console.log("=== [v0.5] DEMONSTRAÇÃO DO RUNTIME SPINE OPERÁVEL ===");
console.log("=======================================================\n");

const secretResolver = controlPlane.secretResolver;
secretResolver.setSecret("env:DEMO_OPENAI_KEY", "sk-demo-openai-secret-999999999999");
secretResolver.setSecret("memory:DEMO_ANTHROPIC_KEY", "sk-ant-demo-secret-888888888888");

const runtimeService = new PulsoRuntimeService({
  store,
  core,
  controlPlane,
  secretResolver,
  router: controlPlane.router,
  outbox: controlPlane.outbox
});

// Registrar adapters provider-neutral com transporte simulado offline
const openaiFailingAdapter = new OpenAIModelAdapter({
  id: "provider_openai_primary",
  endpoint: "http://127.0.0.1:18080/v1",
  secretRef: "env:DEMO_OPENAI_KEY",
  secretResolver,
  transport: async () => ({
    ok: false,
    status: 503,
    headers: {},
    text: async () => JSON.stringify({ error: { message: "upstream overloaded (sk-demo-openai-secret-999999999999)" } })
  })
});

const anthropicFallbackAdapter = new AnthropicModelAdapter({
  id: "provider_anthropic_fallback",
  endpoint: "http://127.0.0.1:18081/v1",
  secretRef: "memory:DEMO_ANTHROPIC_KEY",
  secretResolver,
  transport: async () => ({
    ok: true,
    status: 200,
    headers: {},
    text: async () => JSON.stringify({
      id: "msg_ext_demo_01",
      model: "claude-3-7-sonnet",
      stop_reason: "end_turn",
      content: [{ type: "text", text: "Resposta soberana entregue pelo fallback explícito Anthropic." }],
      usage: { input_tokens: 18, output_tokens: 12 }
    })
  })
});

const localAdapter = new LocalOpenAICompatibleAdapter({
  id: "provider_local_x86",
  endpoint: "http://127.0.0.1:11434/v1",
  secretResolver,
  transport: async () => ({
    ok: true,
    status: 200,
    headers: {},
    text: async () => JSON.stringify({
      id: "chatcmpl_local_01",
      model: "qwen2.5-coder-local",
      choices: [{ finish_reason: "stop", message: { content: "Inferência local pronta." } }],
      usage: { prompt_tokens: 10, completion_tokens: 6, total_tokens: 16 }
    })
  })
});

await runtimeService.registerProvider({
  profile: {
    providerId: "provider_openai_primary",
    kind: "model",
    displayName: "OpenAI Primary Adapter",
    endpoint: "http://127.0.0.1:18080/v1",
    secretRef: "env:DEMO_OPENAI_KEY"
  },
  adapter: openaiFailingAdapter
});
await runtimeService.registerProvider({
  profile: {
    providerId: "provider_anthropic_fallback",
    kind: "model",
    displayName: "Anthropic Fallback Adapter",
    endpoint: "http://127.0.0.1:18081/v1",
    secretRef: "memory:DEMO_ANTHROPIC_KEY"
  },
  adapter: anthropicFallbackAdapter
});
await runtimeService.registerProvider({
  profile: {
    providerId: "provider_local_x86",
    kind: "local",
    displayName: "Local OpenAI-Compatible Adapter",
    endpoint: "http://127.0.0.1:11434/v1",
    secretRef: null
  },
  adapter: localAdapter
});

await runtimeService.setBinding({
  scope: { type: "session", scopeId: "session_demo" },
  primary: { providerId: "provider_openai_primary", model: "gpt-4.1" },
  fallbackChain: [
    { providerId: "provider_anthropic_fallback", model: "claude-3-7-sonnet" },
    { providerId: "provider_local_x86", model: "qwen2.5-coder-local" }
  ]
});

const startStatus = await runtimeService.start();
console.log(`1. PulsoRuntimeService Iniciado: status=${startStatus.status}, storeOk=${startStatus.storeIntegrity.ok}`);

const enqueueRes = runtimeService.enqueueOutbox({
  idempotencyKey: "demo-outbox-v05-1",
  topic: "model.completion",
  scope: { type: "session", scopeId: "session_demo" },
  payload: {
    sessionId: "session_demo",
    agentId: "agent_lotus",
    prompt: "Execute síntese com fallback explícito e outbox durável."
  }
});
console.log(`2. Item Enfileirado no DurableOutbox: ${enqueueRes.item.outboxId} (status=${enqueueRes.item.status})`);

const drainRes = await runtimeService.drainOutbox();
console.log(`3. DurableOutbox Drenado: processed=${drainRes.processedCount}, delivered=${drainRes.delivered.length}`);
console.log(`   - Recibo de entrega:`, JSON.stringify(drainRes.delivered[0].receipt, null, 2));

const providersSec = controlPlane.get("section", "providers_models");
const queuesSec = controlPlane.get("section", "tasks_queues");
const diagSec = controlPlane.get("section", "diagnostics");
console.log(`\n4. Projeções da Central v0.5:`);
console.log(`   - [providers_models] status=${providersSec.status}, recibos de roteamento=${providersSec.summary.routingReceiptsCount}`);
console.log(`   - [tasks_queues] outbox total=${queuesSec.summary.outbox.total}, delivered=${queuesSec.summary.outbox.delivered}`);
console.log(`   - [diagnostics] runtime=${diagSec.summary.runtimeServiceStatus}, outboxIntegro=${diagSec.summary.outboxIntegrityOk}`);

await runtimeService.stop();
store.close();
