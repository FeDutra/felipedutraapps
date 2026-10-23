import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
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
  const sharedA = path.join(a.dir, 'peer'); const sharedB = path.join(b.dir, 'peer'); const transportA = new PeerFolderTransport({ syncService: syncA }); const transportB = new PeerFolderTransport({ syncService: syncB }); transportA.configure(sharedA); transportB.configure(sharedB);
  const pushed = transportA.push(syncB.deviceManifest().deviceId); copyFileSync(pushed.transportPath, path.join(sharedB, 'inbox', path.basename(pushed.transportPath)));
  const pulled = transportB.pull(); assert.equal(pulled.receipts[0].receipt.imported, 1); assert.equal(syncB.status().replicatedEvents, 1); a.close(); b.close();
});
