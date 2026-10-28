import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  AgentExecutionService,
  AutomationService,
  ChannelHubService,
  ControlPlaneService,
  DeviceSyncService,
  LiveConversationService,
  LiveService,
  LiveMemoryService,
  PeerFolderTransport,
  SkillRegistryService,
  SqliteEventStore,
  eventDraft,
} from '../vendor/pulso-core/src/index.mjs';

function fixture(name = 'fabric') {
  const dir = mkdtempSync(path.join(tmpdir(), `pulso-${name}-`));
  const store = new SqliteEventStore(path.join(dir, 'core.sqlite'));
  return { dir, store, close() { store.close(); rmSync(dir, { recursive: true, force: true }); } };
}

function syncIdentity(deviceKey) {
  const { privateKey } = generateKeyPairSync('ed25519');
  return { version: 1, installationId: `${deviceKey}-installation-0001`, deviceKey, privateKeyPkcs8Base64: privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64') };
}

test('memória viva escreve, busca, atualiza, restaura e esquece por eventos', () => {
  const f = fixture('memory-live'); const memory = new LiveMemoryService({ store: f.store });
  const first = memory.remember({ title: 'PULSO', content: 'Notion é a fonte operacional canônica.', tags: ['pulso'] });
  assert.equal(memory.search({ query: 'fonte Notion' }).results[0].memoryId, first.memory.memoryId);
  memory.remember({ memoryId: first.memory.memoryId, title: 'PULSO', content: 'Notion e SQLite têm papéis distintos.', tags: ['pulso'] });
  assert.match(new LiveMemoryService({ store: f.store }).list()[0].content, /SQLite/);
  memory.forget(first.memory.memoryId);
  assert.equal(memory.list().length, 0); f.close();
});

test('catálogo de habilidades descobre skills privadas e persiste estado', () => {
  const f = fixture('skills'); const root = path.join(f.dir, 'skills', 'design'); mkdirSync(root, { recursive: true }); writeFileSync(path.join(root, 'SKILL.md'), '# Direção visual\n', 'utf8');
  const registry = new SkillRegistryService({ store: f.store, rootDir: path.join(f.dir, 'skills') }); const skill = registry.list()[0]; assert.equal(skill.enabled, true);
  registry.setEnabled(skill.skillId, false); assert.equal(new SkillRegistryService({ store: f.store, rootDir: path.join(f.dir, 'skills') }).list()[0].enabled, false); f.close();
});

test('hub de canais recebe e entrega pelo canal local com recibo', async () => {
  const f = fixture('channels'); const hub = new ChannelHubService({ store: f.store });
  const inbound = hub.receive({ text: 'oi', sender: { id: 'fe' } }); const outbound = await hub.send({ text: 'olá', target: { id: 'fe' } });
  assert.equal(inbound.message.state, 'received'); assert.equal(outbound.message.state, 'delivered'); assert.match(outbound.receipt.externalId, /^loopback:/); assert.equal(hub.history().length, 2); f.close();
});

test('hub configura webhook somente com endpoint seguro e registra recibo', async () => {
  const f = fixture('channels-webhook'); const hub = new ChannelHubService({ store: f.store });
  hub.register({ channelId: 'ops', kind: 'webhook', label: 'Operações' });
  hub.configureWebhook({ channelId: 'ops', endpoint: 'https://example.invalid/pulso', fetchImpl: async (_url, request) => ({ ok: true, status: 202, headers: { get: () => 'external-1' }, request }) });
  const delivered = await hub.send({ channelId: 'ops', text: 'feito' });
  assert.equal(delivered.receipt.status, 202); assert.equal(delivered.receipt.externalId, 'external-1'); assert.throws(() => hub.configureWebhook({ channelId: 'ops', endpoint: 'http://example.com/inseguro' }), /secure_channel_endpoint_required/); f.close();
});

test('hub entrega pelo serviço local de WhatsApp com contrato compatível', async () => {
  const f = fixture('channels-whatsapp'); const hub = new ChannelHubService({ store: f.store }); let body = null;
  hub.configureWhatsAppLocal({ fetchImpl: async (_url, request) => { body = JSON.parse(request.body); return { ok: true, status: 200, async json() { return { success: true, messageId: 'wa-1' }; } }; } });
  const delivered = await hub.send({ channelId: 'whatsapp', target: { id: '5511999999999' }, text: 'olá' });
  assert.deepEqual(body, { to: '5511999999999', message: 'olá' }); assert.equal(delivered.receipt.externalId, 'wa-1'); f.close();
});

test('automações executam agenda local, registram histórico e respeitam pausa', async () => {
  const f = fixture('automations'); let executions = 0; const automation = new AutomationService({ store: f.store, executor: async job => ({ ok: true, job: job.name, executions: ++executions }), clock: (() => { let tick = 0; return () => new Date(Date.UTC(2026, 9, 23, 20, 0, tick++)).toISOString(); })() });
  const created = automation.create({ name: 'Watchdog', enabled: true, schedule: { everyMs: 1 }, task: 'verificar saúde' });
  const result = await automation.tick({ now: '2026-10-23T20:01:00.000Z' }); assert.equal(result.runs[0].status, 'completed'); assert.equal(executions, 1);
  automation.update(created.automation.automationId, { enabled: false }); assert.equal((await automation.tick({ now: '2026-10-23T20:02:00.000Z' })).due, 0); assert.equal(automation.listRuns().length, 1); f.close();
});

test('automações cron respeitam fuso e não duplicam o mesmo minuto', async () => {
  const f = fixture('automations-cron'); let executions = 0; const automation = new AutomationService({ store: f.store, executor: async () => ({ executions: ++executions }), clock: () => '2026-10-23T12:00:00.000Z' });
  automation.create({ name: 'Briefing', enabled: true, schedule: { kind: 'cron', expr: '0 9 * * *', tz: 'America/Sao_Paulo' }, task: 'briefing' });
  assert.equal((await automation.tick({ now: '2026-10-23T11:59:00.000Z' })).due, 0);
  assert.equal((await automation.tick({ now: '2026-10-23T12:00:00.000Z' })).due, 1);
  assert.equal((await automation.tick({ now: '2026-10-23T12:00:30.000Z' })).due, 0); assert.equal(executions, 1); f.close();
});

test('importador de automações traduz payloads de agente, script e comando sem ativar duplicatas', () => {
  const f = fixture('automations-import'); const snapshot = path.join(f.dir, 'automations.json'); writeFileSync(snapshot, JSON.stringify({ jobs: [
    { id: 'agent-job', name: 'Agente', enabled: true, schedule: { kind: 'cron', expr: '0 8 * * *', tz: 'America/Sao_Paulo' }, payload: { kind: 'agentTurn', message: 'prepare o briefing' } },
    { id: 'command-job', name: 'Comando', enabled: false, schedule: { kind: 'every', everyMs: 60000 }, payload: { kind: 'command', command: ['uname', '-m'] } },
  ] }), 'utf8');
  const automation = new AutomationService({ store: f.store, snapshotPath: snapshot }); const imported = automation.importSnapshot(); const jobs = automation.list();
  assert.equal(imported.imported, 2); assert.equal(jobs.filter(job => job.enabled).length, 0); assert.equal(jobs.find(job => job.automationId === 'agent-job').task, 'prepare o briefing'); assert.equal(jobs.find(job => job.automationId === 'command-job').task, 'uname -m'); assert.equal(jobs.find(job => job.automationId === 'agent-job').metadata.importedEnabled, true); f.close();
});

test('executor real percorre foundry → provider → checkpoint → resultado', async () => {
  const f = fixture('agent-run'); const control = new ControlPlaneService({ store: f.store }); await control.initDefaults();
  const blueprint = await control.foundry.createBlueprint({ blueprintId: 'bp_forma', name: 'FORMA', role: 'direção de arte', mission: 'Dar forma.', instructions: 'Seja precisa.', skills: [], tools: [], providerDefaults: { modelProviderId: 'codex-fe', model: 'gpt-test' }, runtimePreferences: { executorProviderId: 'codex-fe-executor', timeoutMs: 30000 }, limits: { maxTurns: 4, maxTokens: 10000, maxCost: 0, maxToolCalls: 10, maxConcurrency: 1, timeoutMs: 30000 } });
  await control.foundry.materializeAgent({ blueprintId: blueprint.blueprint.blueprintId, agentId: 'agent_forma', initialStatus: 'paused' });
  const runtime = { async routeCompletion(request) { assert.match(request.systemPrompt, /FORMA/); return { text: 'artefato pronto', providerId: 'codex-fe', model: 'gpt-test', usage: { totalTokens: 42 } }; } };
  const executor = new AgentExecutionService({ foundry: control.foundry, runtime }); const result = await executor.execute({ agentId: 'agent_forma', prompt: 'Crie a direção.' });
  assert.equal(result.output, 'artefato pronto'); assert.equal(result.run.status, 'succeeded'); assert.equal(result.run.checkpoints.length, 1); f.close();
});

test('especialista só opera ferramenta concedida e devolve recibos ao integrador', async () => {
  const f = fixture('agent-tool-grant'); const control = new ControlPlaneService({ store: f.store }); await control.initDefaults();
  const blueprint = await control.foundry.createBlueprint({ blueprintId: 'bp_pesquisa', name: 'PESQUISA', role: 'pesquisa', mission: 'Localizar fontes.', instructions: 'Use apenas ferramentas concedidas.', skills: [], tools: ['notion'], providerDefaults: { modelProviderId: 'codex-fe', model: 'gpt-test' }, runtimePreferences: {}, limits: { maxTurns: 4, maxTokens: 10000, maxCost: 0, maxToolCalls: 2, maxConcurrency: 1, timeoutMs: 30000 } });
  await control.foundry.materializeAgent({ blueprintId: blueprint.blueprint.blueprintId, agentId: 'agent_pesquisa', initialStatus: 'active' });
  await control.foundry.grantCapability({ agentId: 'agent_pesquisa', capability: 'tool.notion.*', effect: 'allow', scope: { type: 'global', scopeId: '*' } });
  const runtime = { async *routeStream() {
    yield { type: 'tool.started', receipt: { itemId: 'tool-1', source: 'notion', tool: 'fetch', type: 'mcpToolCall' } };
    yield { type: 'tool.completed', receipt: { itemId: 'tool-1', source: 'notion', tool: 'fetch', type: 'mcpToolCall', success: true } };
    yield { type: 'model.delta', text: 'fonte localizada' };
    yield { type: 'model.completed', text: 'fonte localizada', providerId: 'codex-fe', model: 'gpt-test' };
  } };
  const envelopes = [];
  const executor = new AgentExecutionService({ foundry: control.foundry, runtime });
  const result = await executor.execute({ agentId: 'agent_pesquisa', prompt: 'Consulte o Notion.', onEnvelope: envelope => envelopes.push(envelope) });
  assert.equal(result.output, 'fonte localizada');
  assert.equal(result.run.usage.toolCalls, 1);
  assert.deepEqual(envelopes.filter(envelope => envelope.type.startsWith('tool.')).map(envelope => envelope.type), ['tool.started', 'tool.completed']);
  f.close();
});

test('especialista sem grant aborta a ferramenta em fail-closed', async () => {
  const f = fixture('agent-tool-denied'); const control = new ControlPlaneService({ store: f.store }); await control.initDefaults();
  const blueprint = await control.foundry.createBlueprint({ blueprintId: 'bp_sem_grant', name: 'SEM GRANT', role: 'teste', mission: 'Provar bloqueio.', instructions: 'Não extrapole.', skills: [], tools: [], providerDefaults: { modelProviderId: 'codex-fe', model: 'gpt-test' }, runtimePreferences: {}, limits: { maxTurns: 2, maxTokens: 1000, maxCost: 0, maxToolCalls: 1, maxConcurrency: 1, timeoutMs: 30000 } });
  await control.foundry.materializeAgent({ blueprintId: blueprint.blueprint.blueprintId, agentId: 'agent_sem_grant', initialStatus: 'active' });
  let observed = false;
  const runtime = { async *routeStream() { yield { type: 'tool.started', receipt: { itemId: 'tool-x', source: 'notion', tool: 'fetch', type: 'mcpToolCall' } }; yield { type: 'model.completed', text: 'não deveria chegar' }; } };
  const executor = new AgentExecutionService({ foundry: control.foundry, runtime });
  await assert.rejects(executor.execute({ agentId: 'agent_sem_grant', prompt: 'Tente.', onEnvelope: envelope => { if (envelope.type === 'tool.started') observed = true; } }), /authorization_denied/);
  assert.equal(observed, true);
  assert.equal(control.foundry.list('runs')[0].status, 'cancelled');
  f.close();
});

test('menção a especialista no chat executa agente real e atribui a resposta', async () => {
  const f = fixture('conversation-agent'); const live = new LiveService({ store: f.store }); const boot = await live.bootstrap();
  const foundry = {
    list(kind) { return kind === 'agents' ? [{ agentId: 'agent_forma', blueprintId: 'bp_forma' }] : []; },
    get(kind, id) { if (kind === 'agent' && id === 'agent_forma') return { agentId: id, blueprintId: 'bp_forma' }; if (kind === 'blueprint' && id === 'bp_forma') return { blueprintId: id, name: 'FORMA' }; return null; },
  };
  let prompt = null; const executor = { async execute(input) { prompt = input.prompt; return { output: 'direção entregue', providerId: 'codex-fe', model: 'gpt-test', run: { agentRunId: 'run_forma', status: 'succeeded' } }; } };
  const router = { resolveRoute() { return { primary: { providerId: 'codex-fe', model: 'gpt-test' } }; } };
  const conversation = new LiveConversationService({ store: f.store, live, router, agentExecutor: executor, agentFoundry: foundry });
  const run = await conversation.startTurn({ sessionId: boot.activeSessionId, text: '@FORMA construa a direção' });
  assert.equal(run.status, 'completed'); assert.equal(prompt, 'construa a direção'); assert.match(run.accumulatedText, /\*\*FORMA\*\*/); assert.match(live.listMessages(boot.activeSessionId).at(-1).texto, /direção entregue/); f.close();
});

test('múltiplas menções executam agentes na mesma sessão, preservam autoria e progresso', async () => {
  const f = fixture('conversation-multi-agent'); const live = new LiveService({ store: f.store }); const boot = await live.bootstrap();
  const agents = [
    { agentId: 'agent_forma', blueprintId: 'bp_forma', name: 'FORMA' },
    { agentId: 'agent_ritmo', blueprintId: 'bp_ritmo', name: 'RITMO' },
  ];
  const foundry = {
    list(kind) { return kind === 'agents' ? agents.map(({ agentId, blueprintId }) => ({ agentId, blueprintId })) : []; },
    get(kind, id) {
      const item = agents.find(agent => kind === 'agent' ? agent.agentId === id : agent.blueprintId === id);
      return item ? (kind === 'agent' ? { agentId: item.agentId, blueprintId: item.blueprintId } : { blueprintId: item.blueprintId, name: item.name }) : null;
    },
  };
  const calls = [];
  const executor = { async execute(input) { calls.push(input); return { output: `${input.agentId} respondeu`, providerId: 'codex-fe', model: 'gpt-test', run: { agentRunId: `run_${input.agentId}` } }; } };
  const envelopes = [];
  const conversation = new LiveConversationService({ store: f.store, live, router: { resolveRoute() { return { primary: { providerId: 'codex-fe', model: 'gpt-test' } }; } }, agentExecutor: executor, agentFoundry: foundry });
  const run = await conversation.startTurn({ sessionId: boot.activeSessionId, text: 'cruzem @FORMA e @RITMO nesta direção' }, { onEnvelope: envelope => envelopes.push(envelope) });
  const assistantMessages = live.listMessages(boot.activeSessionId).filter(message => message.role === 'assistant');
  assert.equal(run.status, 'completed');
  assert.deepEqual(run.agentIds, ['agent_forma', 'agent_ritmo']);
  assert.deepEqual(new Set(calls.map(call => call.agentId)), new Set(['agent_forma', 'agent_ritmo']));
  assert.equal(assistantMessages.length, 2);
  assert.deepEqual(new Set(assistantMessages.map(message => message.agentId)), new Set(['agent_forma', 'agent_ritmo']));
  assert.ok(envelopes.some(envelope => envelope.type === 'conversation.progress' && envelope.agentId === 'agent_forma'));
  assert.ok(envelopes.some(envelope => envelope.type === 'conversation.progress' && envelope.agentId === 'agent_ritmo'));
  f.close();
});

test('recibos de ferramenta do especialista persistem no turno e sobrevivem à reabertura', async () => {
  const f = fixture('conversation-tool-receipts'); const live = new LiveService({ store: f.store }); const boot = await live.bootstrap();
  const foundry = { list() { return [{ agentId: 'agent_pesquisa', blueprintId: 'bp_pesquisa' }]; }, get(kind) { return kind === 'agent' ? { agentId: 'agent_pesquisa', blueprintId: 'bp_pesquisa' } : { name: 'PESQUISA' }; } };
  const executor = { async execute(input) {
    await input.onEnvelope({ type: 'tool.started', receipt: { itemId: 'notion-1', type: 'mcpToolCall', phase: 'started', status: 'inProgress', tool: 'fetch', source: 'notion', target: 'Notion', action: 'connector_call' } });
    await input.onEnvelope({ type: 'tool.completed', receipt: { itemId: 'notion-1', type: 'mcpToolCall', phase: 'completed', status: 'completed', tool: 'fetch', source: 'notion', target: 'Notion', action: 'connector_call', success: true } });
    return { output: 'fonte localizada', providerId: 'codex-fe', model: 'gpt-test', run: { agentRunId: 'run_pesquisa' } };
  } };
  const router = { resolveRoute() { return { primary: { providerId: 'codex-fe', model: 'gpt-test' } }; }, secretResolver: { assertZeroLeakage() { return true; } } };
  const conversation = new LiveConversationService({ store: f.store, live, router, agentFoundry: foundry, agentExecutor: executor });
  const completed = await conversation.startTurn({ sessionId: boot.activeSessionId, text: '@PESQUISA consulte' });
  assert.equal(completed.toolReceipts.length, 1);
  assert.equal(completed.toolReceipts[0].phase, 'completed');
  const reopenedLive = new LiveService({ store: f.store }); await reopenedLive.ensureRestored();
  const reopenedConversation = new LiveConversationService({ store: f.store, live: reopenedLive, router, agentFoundry: foundry, agentExecutor: executor });
  assert.equal(reopenedConversation.getRun(completed.id).toolReceipts[0].source, 'notion');
  f.close();
});

test('especialista não vaza assinatura da Lótus dentro da própria autoria', async () => {
  const f = fixture('conversation-specialist-identity'); const live = new LiveService({ store: f.store }); const boot = await live.bootstrap();
  const foundry = {
    list() { return [{ agentId: 'agent_ritmo', blueprintId: 'bp_ritmo' }]; },
    get(kind) { return kind === 'agent' ? { agentId: 'agent_ritmo', blueprintId: 'bp_ritmo' } : { name: 'RITMO' }; },
  };
  const conversation = new LiveConversationService({
    store: f.store,
    live,
    router: { resolveRoute() { return { primary: { providerId: 'codex-fe', model: 'gpt-test' } }; } },
    agentFoundry: foundry,
    agentExecutor: { async execute() { return { output: '**Lótus:** ritmo sem ruído', providerId: 'codex-fe', model: 'gpt-test', run: { agentRunId: 'run_ritmo' } }; } },
  });
  await conversation.startTurn({ sessionId: boot.activeSessionId, text: '@RITMO responda' });
  const answer = live.listMessages(boot.activeSessionId).find(message => message.role === 'assistant');
  assert.equal(answer.texto, '**RITMO**\n\nritmo sem ruído');
  assert.doesNotMatch(answer.texto, /Lótus:/u);
  f.close();
});

test('participantes persistentes da sessão recebem o turno sem menção explícita', async () => {
  const f = fixture('conversation-session-participants'); const live = new LiveService({ store: f.store }); await live.bootstrap();
  const session = await live.createSession({ id: 'sessao_conselho', areaId: 'area_pulso', titulo: 'Conselho' });
  await live.setSessionParticipants({ sessionId: session.id, participantAgentIds: ['agent_forma', 'agent_ritmo'] });
  const agents = [{ agentId: 'agent_forma', blueprintId: 'bp_forma' }, { agentId: 'agent_ritmo', blueprintId: 'bp_ritmo' }];
  const foundry = { list() { return agents; }, get(kind, id) { if (kind === 'agent') return agents.find(agent => agent.agentId === id) || null; return { name: id === 'bp_forma' ? 'FORMA' : 'RITMO' }; } };
  const called = [];
  const conversation = new LiveConversationService({ store: f.store, live, router: { resolveRoute() { return { primary: { providerId: 'codex-fe', model: 'gpt-test' } }; } }, agentFoundry: foundry, agentExecutor: { async execute(input) { called.push(input.agentId); return { output: 'ok', providerId: 'codex-fe', model: 'gpt-test', run: { agentRunId: `run_${input.agentId}` } }; } } });
  await conversation.startTurn({ sessionId: session.id, text: 'analisem este problema' });
  assert.deepEqual(new Set(called), new Set(['agent_forma', 'agent_ritmo']));
  assert.deepEqual(live.getSession(session.id).participantAgentIds, ['agent_forma', 'agent_ritmo']);
  f.close();
});

test('cancelamento do turno aborta agentes filhos e cerca resultados tardios', async () => {
  const f = fixture('conversation-multi-cancel'); const live = new LiveService({ store: f.store }); const boot = await live.bootstrap();
  const foundry = { list() { return [{ agentId: 'agent_forma', blueprintId: 'bp_forma' }]; }, get(kind) { return kind === 'agent' ? { agentId: 'agent_forma', blueprintId: 'bp_forma' } : { name: 'FORMA' }; } };
  let childAborted = false;
  const executor = { async execute(input) { await new Promise(resolve => { input.signal.addEventListener('abort', () => { childAborted = true; resolve(); }, { once: true }); }); return { output: 'resultado tardio', providerId: 'codex-fe', model: 'gpt-test', run: { agentRunId: 'late' } }; } };
  const conversation = new LiveConversationService({ store: f.store, live, router: { resolveRoute() { return { primary: { providerId: 'codex-fe', model: 'gpt-test' } }; } }, agentFoundry: foundry, agentExecutor: executor });
  const promise = conversation.startTurn({ sessionId: boot.activeSessionId, text: '@FORMA comece' });
  await new Promise(resolve => setTimeout(resolve, 20));
  const active = conversation.listRuns(boot.activeSessionId).find(run => run.status === 'streaming');
  await conversation.cancelRun(active.id, { reason: 'mudança de direção' });
  const run = await promise;
  assert.equal(childAborted, true);
  assert.equal(run.status, 'cancelled');
  assert.equal(live.listMessages(boot.activeSessionId).some(message => message.texto.includes('resultado tardio')), false);
  assert.equal(live.listMessages(boot.activeSessionId).some(message => message.role === 'system' && message.texto.includes('execução interrompida')), true);
  f.close();
});

test('sessão de especialista mantém vínculo e executa o agente sem menção explícita', async () => {
  const f = fixture('conversation-bound-agent'); const live = new LiveService({ store: f.store }); await live.bootstrap();
  const session = await live.createSession({ id: 'sessao_ritmo', areaId: 'area_pulso', titulo: 'RITMO', agentId: 'agent_audiovisual' });
  const foundry = {
    list(kind) { return kind === 'agents' ? [{ agentId: 'agent_audiovisual', blueprintId: 'bp_ritmo' }] : []; },
    get(kind, id) { if (kind === 'agent' && id === 'agent_audiovisual') return { agentId: id, blueprintId: 'bp_ritmo' }; if (kind === 'blueprint' && id === 'bp_ritmo') return { blueprintId: id, name: 'RITMO' }; return null; },
  };
  let routedAgent = null; const executor = { async execute(input) { routedAgent = input.agentId; return { output: 'corte audiovisual pronto', providerId: 'codex-fe', model: 'gpt-test', run: { agentRunId: 'run_ritmo', status: 'succeeded' } }; } };
  const conversation = new LiveConversationService({ store: f.store, live, router: { resolveRoute() { return { primary: { providerId: 'codex-fe', model: 'gpt-test' } }; } }, agentExecutor: executor, agentFoundry: foundry });
  const run = await conversation.startTurn({ sessionId: session.id, text: 'organize o corte' });
  const assistant = live.listMessages(session.id).at(-1);
  assert.equal(run.status, 'completed'); assert.equal(routedAgent, 'agent_audiovisual'); assert.equal(assistant.agentId, 'agent_audiovisual'); assert.match(assistant.texto, /RITMO/); f.close();
});

test('conversa registra memória viva apenas quando Fe explicita decisão ou pedido de lembrar', async () => {
  const f = fixture('conversation-memory'); const live = new LiveService({ store: f.store }); const boot = await live.bootstrap(); const recorded = [];
  const foundry = { list() { return [{ agentId: 'agent_forma', blueprintId: 'bp_forma' }]; }, get(kind) { return kind === 'agent' ? { agentId: 'agent_forma', blueprintId: 'bp_forma' } : { name: 'FORMA' }; } };
  const conversation = new LiveConversationService({ store: f.store, live, router: { resolveRoute() { return { primary: { providerId: 'codex-fe', model: 'gpt-test' } }; } }, agentFoundry: foundry, agentExecutor: { async execute() { return { output: 'registrado', providerId: 'codex-fe', model: 'gpt-test', run: { agentRunId: 'run-memory' } }; } }, memoryRecorder: async memory => { recorded.push(memory); return memory; } });
  await conversation.startTurn({ sessionId: boot.activeSessionId, text: '@FORMA registre que a identidade será tipográfica' });
  assert.equal(recorded.length, 1); assert.match(recorded[0].content, /identidade será tipográfica/); f.close();
});

test('transporte por pasta move bundle assinado e mantém importação idempotente', () => {
  const a = fixture('sync-a'); const b = fixture('sync-b'); const syncA = new DeviceSyncService({ store: a.store, dataDir: a.dir, identity: syncIdentity('macbook') }); const syncB = new DeviceSyncService({ store: b.store, dataDir: b.dir, identity: syncIdentity('imac') });
  syncA.trustDevice(syncB.deviceManifest()); syncB.trustDevice(syncA.deviceManifest());
  a.store.append([eventDraft({ type: 'memory.item_written', aggregateType: 'memory_item', aggregateId: 'mem_sync', correlationId: 'corr_sync', actor: { kind: 'human', id: 'fe' }, payload: { memoryId: 'mem_sync', content: 'sincronizada' } })]);
  const shared = path.join(a.dir, 'peer'); const transportA = new PeerFolderTransport({ syncService: syncA }); const transportB = new PeerFolderTransport({ syncService: syncB }); transportA.configure(shared); transportB.configure(shared);
  transportA.publishPresence(); transportB.publishPresence();
  assert.equal(transportA.readPresence()[0].deviceKey, 'imac');
  assert.equal(transportB.readPresence()[0].deviceKey, 'macbook');
  const pushed = transportA.push(syncB.deviceManifest().deviceId); assert.equal(pushed.events, 1); assert.equal(pushed.skipped, false);
  const pulled = transportB.pull(); assert.equal(pulled.imported, 1); assert.equal(syncB.status().replicatedEvents, 1);
  const replay = transportB.pull(); assert.equal(replay.imported, 0); assert.equal(replay.scanned, 0); assert.equal(replay.skipped, 1); assert.equal(replay.receipts.length, 0);
  const delta = transportA.push(syncB.deviceManifest().deviceId); assert.equal(delta.skipped, true); assert.equal(delta.events, 0); a.close(); b.close();
});

test('transporte por pasta restaura configuração depois de abertura fria', () => {
  const f = fixture('sync-transport-restore');
  const sync = new DeviceSyncService({ store: f.store, dataDir: f.dir, identity: syncIdentity('macbook') });
  const configPath = path.join(f.dir, 'sync', 'transport.json');
  const rootDir = path.join(f.dir, 'peer-folder');
  const first = new PeerFolderTransport({ syncService: sync, configPath });
  assert.equal(first.status().configured, false);
  first.configure(rootDir);
  const restored = new PeerFolderTransport({ syncService: sync, configPath });
  assert.equal(restored.status().configured, true);
  assert.equal(restored.status().rootDir, rootDir);
  assert.equal(statSync(configPath).mode & 0o077, 0);
  f.close();
});

test('desktop mantém Core canônico e usa OpenClaw como executor operacional com recibo persistido', () => {
  const liveSource = readFileSync(new URL('../src/apps/pulso/pages/LivePage.tsx', import.meta.url), 'utf8');
  const bridgeSource = readFileSync(new URL('./pulso/operator-bridge.mjs', import.meta.url), 'utf8');
  const operatorSource = readFileSync(new URL('../src/apps/pulso/services/operatorControlService.ts', import.meta.url), 'utf8');
  const systemSource = readFileSync(new URL('../src/apps/pulso/pages/SystemPage.tsx', import.meta.url), 'utf8');
  assert.match(liveSource, /NEXT_PUBLIC_PULSO_CORE_EXECUTOR === 'openclaw'/);
  assert.match(liveSource, /openclaw_\$\{req\.id\}_assistant/);
  assert.match(liveSource, /pulsoCoreClient\.appendMessage/);
  assert.match(bridgeSource, /callGatewayFromCli\('cron\.list'/);
  assert.match(bridgeSource, /includeDisabled: true, limit: 200, offset: 0/);
  assert.match(bridgeSource, /unsupported_operator_command/);
  assert.match(bridgeSource, /db\.runTransaction/);
  assert.match(bridgeSource, /current\.data\(\)\?\.status !== 'pending'/);
  assert.match(bridgeSource, /function sanitizeSchedule/);
  assert.match(bridgeSource, /function sanitizeText/);
  assert.match(operatorSource, /raw\.status === 'completed'/);
  assert.match(operatorSource, /raw\.status === 'failed'/);
  assert.match(operatorSource, /A OpenClaw não confirmou a operação dentro de 60 segundos/);
  assert.match(systemSource, /A rotina pode produzir efeitos externos/);
  assert.match(systemSource, /Remover definitivamente a rotina/);
});

test('sync incremental filtra cursores no SQLite antes de materializar eventos', () => {
  const source = readFileSync(new URL('../vendor/pulso-core/src/sync/device-sync-service.mjs', import.meta.url), 'utf8');
  assert.match(source, /o\.origin_sequence>\?/);
  assert.match(source, /cursorClauses\.join\(" OR "\)/);
  assert.doesNotMatch(source, /const events = rows\.filter/);
});
