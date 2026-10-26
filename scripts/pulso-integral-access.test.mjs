import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  AccessModeStore,
  ConstellationImporter,
  ControlPlaneService,
  PrivateArchiveService,
  PrivateMemoryProvider,
  SqliteEventStore,
  installPrivateSkills,
} from '../vendor/pulso-core/src/index.mjs';
import { preparePulsoPrivateContext } from './prepare-pulso-private-context.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

test('modo integral é local, privado, persistente e reversível', () => {
  const dataDir = mkdtempSync(path.join(tmpdir(), 'pulso-access-'));
  const store = new AccessModeStore({ dataDir, clock: () => '2026-10-23T13:00:00.000Z' });
  assert.equal(store.read().mode, 'restricted');
  assert.equal(store.read().configured, false);
  const integral = store.set('integral');
  assert.equal(integral.mode, 'integral');
  assert.equal(integral.capabilities.notion, true);
  assert.equal(integral.capabilities.shell, true);
  assert.equal(statSync(path.join(dataDir, 'access', 'mode.json')).mode & 0o077, 0);
  assert.equal(new AccessModeStore({ dataDir }).read().mode, 'integral');
  assert.equal(store.set('restricted').mode, 'restricted');
  rmSync(dataDir, { recursive: true, force: true });
});

test('memória privada recupera trechos com proveniência sem depender do provider', async () => {
  const rootDir = mkdtempSync(path.join(tmpdir(), 'pulso-memory-'));
  mkdirSync(path.join(rootDir, 'memory'), { recursive: true });
  mkdirSync(path.join(rootDir, 'archive', 'sessions'), { recursive: true });
  writeFileSync(path.join(rootDir, 'SOUL.md'), '# Lótus\nClareza e movimento.', 'utf8');
  writeFileSync(path.join(rootDir, 'memory', 'pulso.md'), '# PULSO\nNotion é fonte canônica operacional.', 'utf8');
  writeFileSync(path.join(rootDir, 'archive', 'sessions', 'legacy.json'), '{"texto":"segredo histórico não recuperável automaticamente"}', 'utf8');
  const provider = new PrivateMemoryProvider({ rootDir, maxResults: 2, chunkChars: 500 });
  const result = await provider.retrieve({ sessionId: 'livre_geral', input: 'qual é a fonte Notion da PULSO?' });
  assert.equal(result.provider, 'private-local-memory');
  assert.equal(result.sessionId, 'livre_geral');
  assert.equal(result.results[0].source, path.join('memory', 'pulso.md'));
  assert.match(result.results[0].content, /fonte canônica/);
  assert.equal(result.results.some(item => item.source.includes('archive')), false);
  rmSync(rootDir, { recursive: true, force: true });
});

test('arquivo histórico é pesquisável sob demanda sem entrar na memória automática', () => {
  const rootDir = mkdtempSync(path.join(tmpdir(), 'pulso-archive-search-'));
  mkdirSync(path.join(rootDir, 'sessions', 'main'), { recursive: true });
  writeFileSync(path.join(rootDir, 'sessions', 'main', 'session.jsonl'), [
    '{"role":"user","text":"A constelação FORMA cuida de direção de arte."}',
    '{"role":"assistant","text":"Registro preservado localmente."}',
  ].join('\n'), 'utf8');
  writeFileSync(path.join(rootDir, 'manifest.json'), JSON.stringify({
    generatedAt: '2026-10-23T13:00:00.000Z',
    totals: { files: 1, bytes: 120 },
  }), 'utf8');
  const archive = new PrivateArchiveService({ rootDir });
  assert.equal(archive.status().configured, true);
  const result = archive.search({ query: 'FORMA direção', scopes: ['sessions'], limit: 5 });
  assert.equal(result.provider, 'private-local-archive');
  assert.equal(result.results.length, 1);
  assert.match(result.results[0].source, /session\.jsonl/);
  assert.match(result.results[0].snippet, /direção de arte/);
  rmSync(rootDir, { recursive: true, force: true });
});

test('skills privadas são instaladas localmente no perfil Codex sem depender da origem', () => {
  const privateContextRoot = mkdtempSync(path.join(tmpdir(), 'pulso-skills-private-'));
  const codexHome = mkdtempSync(path.join(tmpdir(), 'pulso-skills-codex-'));
  for (const [root, name] of [['workspace', 'planejamento'], ['workshop', 'design']]) {
    const skillDir = path.join(privateContextRoot, 'archive', 'skills', root, name);
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(path.join(skillDir, 'SKILL.md'), `# ${name}`, 'utf8');
  }
  const result = installPrivateSkills({ privateContextRoot, codexHome });
  assert.equal(result.installed, 2);
  const manifest = JSON.parse(readFileSync(path.join(codexHome, 'skills', '.pulso-managed.json'), 'utf8'));
  assert.equal(manifest.installed.length, 2);
  for (const item of manifest.installed) {
    assert.equal(statSync(path.join(codexHome, 'skills', item.name, 'SKILL.md')).mode & 0o077, 0);
  }
  rmSync(privateContextRoot, { recursive: true, force: true });
  rmSync(codexHome, { recursive: true, force: true });
});

test('adaptador, bridge e painel carregam o contrato integral sem remover o modo restrito', () => {
  const adapter = readFileSync(path.join(repoRoot, 'vendor/pulso-core/src/providers/codex-app-server-adapter.mjs'), 'utf8');
  const bridge = readFileSync(path.join(repoRoot, 'vendor/pulso-core/desktop/bridge.mjs'), 'utf8');
  const panel = readFileSync(path.join(repoRoot, 'src/apps/pulso/components/PulsoCoreProviderPanel.tsx'), 'utf8');
  assert.match(adapter, /danger-full-access/);
  assert.match(adapter, /integralDeveloperInstructions/);
  assert.match(adapter, /item\/commandExecution\/requestApproval/);
  assert.match(adapter, /item\/permissions\/requestApproval/);
  assert.match(adapter, /mcpServerOpenaiFormElicitation/);
  assert.match(adapter, /Verdade operacional é obrigatória/);
  assert.match(adapter, /evidência produzida por uma ferramenta no turno atual/);
  assert.match(adapter, /Nunca apresente como funcional um comando hipotético/);
  assert.match(adapter, /entidade mencionada em memória, dispositivo realmente descoberto e dispositivo efetivamente controlável/);
  assert.match(bridge, /access\.mode\.read/);
  assert.match(bridge, /access\.mode\.set/);
  assert.match(bridge, /PrivateMemoryProvider/);
  assert.match(panel, /modo integral ativo/);
  assert.match(panel, /role="switch"/);
});

test('empacotador privado mantém identidade e memória fora do bundle público', () => {
  const source = mkdtempSync(path.join(tmpdir(), 'pulso-private-source-'));
  const output = mkdtempSync(path.join(tmpdir(), 'pulso-private-output-'));
  for (const name of ['SOUL.md', 'USER.md', 'IDENTITY.md', 'AGENTS.md']) {
    writeFileSync(path.join(source, name), `# ${name}\nconteúdo privado`, 'utf8');
  }
  mkdirSync(path.join(source, 'memory'), { recursive: true });
  writeFileSync(path.join(source, 'memory', 'today.md'), 'memória privada', 'utf8');
  const result = preparePulsoPrivateContext({ sourceWorkspace: source, outputDir: output, updatedAt: '2026-10-23T13:00:00.000Z' });
  const overlay = JSON.parse(readFileSync(result.overlayPath, 'utf8'));
  assert.equal(overlay.identityId, 'lotus');
  assert.match(overlay.context.soul, /conteúdo privado/);
  assert.equal(readFileSync(path.join(result.contextDir, 'memory', 'today.md'), 'utf8'), 'memória privada');
  assert.equal(statSync(result.contextDir).mode & 0o077, 0);
  assert.equal(statSync(path.join(result.contextDir, 'memory', 'today.md')).mode & 0o077, 0);
  rmSync(source, { recursive: true, force: true });
  rmSync(output, { recursive: true, force: true });
});

test('empacotador privado traduz agentes configurados em blueprints e arquiva workspaces órfãos', () => {
  const source = mkdtempSync(path.join(tmpdir(), 'pulso-constellation-source-'));
  const output = mkdtempSync(path.join(tmpdir(), 'pulso-constellation-output-'));
  for (const name of ['SOUL.md', 'USER.md', 'IDENTITY.md', 'AGENTS.md']) {
    writeFileSync(path.join(source, name), `# ${name}\nLótus`, 'utf8');
  }
  const specialist = path.join(source, 'agents', 'designer');
  mkdirSync(specialist, { recursive: true });
  writeFileSync(path.join(specialist, 'SOUL.md'), '# FORMA\nDireção de arte.', 'utf8');
  writeFileSync(path.join(specialist, 'AGENTS.md'), '# Operação\nPreservar fontes.', 'utf8');
  mkdirSync(path.join(source, 'agents', 'legacy-agent'), { recursive: true });
  const configPath = path.join(source, 'openclaw.test.json');
  writeFileSync(configPath, JSON.stringify({
    agents: {
      entries: {
        main: { identity: { name: 'Lótus', theme: 'centro integrador' }, tools: { profile: 'full' } },
        designer: {
          workspace: specialist,
          identity: { name: 'FORMA', emoji: '◇', theme: 'imagem e direção de arte' },
          model: 'openai/gpt-test@profile',
          skills: ['canvas-design'],
          tools: { profile: 'full', deny: ['secrets'] },
        },
      },
    },
  }), 'utf8');

  const result = preparePulsoPrivateContext({
    sourceWorkspace: source,
    outputDir: output,
    openclawConfigPath: configPath,
    updatedAt: '2026-10-23T13:00:00.000Z',
  });
  const constellation = JSON.parse(readFileSync(path.join(result.contextDir, 'agent-constellation.json'), 'utf8'));
  assert.equal(constellation.configuredAgents.length, 2);
  assert.equal(constellation.configuredAgents[1].blueprint.name, 'FORMA');
  assert.deepEqual(constellation.configuredAgents[1].blueprint.skills, ['canvas-design']);
  assert.equal(constellation.configuredAgents[1].blueprint.metadata.sourceModel, 'openai/gpt-test');
  assert.equal(constellation.archivedAgentCandidates[0].sourceAgentId, 'legacy-agent');
  assert.match(readFileSync(path.join(result.contextDir, 'agents', 'designer', 'SOUL.md'), 'utf8'), /FORMA/);
  rmSync(source, { recursive: true, force: true });
  rmSync(output, { recursive: true, force: true });
});

test('arquivo integral preserva sessões, skills e automações com manifesto e sem segredos de configuração', () => {
  const source = mkdtempSync(path.join(tmpdir(), 'pulso-archive-source-'));
  const openclawRoot = mkdtempSync(path.join(tmpdir(), 'pulso-archive-runtime-'));
  const output = mkdtempSync(path.join(tmpdir(), 'pulso-archive-output-'));
  for (const name of ['SOUL.md', 'USER.md', 'IDENTITY.md', 'AGENTS.md']) {
    writeFileSync(path.join(source, name), `# ${name}\nLótus`, 'utf8');
  }
  mkdirSync(path.join(source, 'skills', 'local-skill'), { recursive: true });
  writeFileSync(path.join(source, 'skills', 'local-skill', 'SKILL.md'), '# Local skill', 'utf8');
  mkdirSync(path.join(openclawRoot, 'agents', 'main', 'sessions'), { recursive: true });
  writeFileSync(path.join(openclawRoot, 'agents', 'main', 'sessions', 'session.jsonl'), '{"role":"user"}\n', 'utf8');
  mkdirSync(path.join(openclawRoot, 'agents', 'main', 'agent', 'workshop-skills', 'workshop-skill'), { recursive: true });
  writeFileSync(path.join(openclawRoot, 'agents', 'main', 'agent', 'workshop-skills', 'workshop-skill', 'SKILL.md'), '# Workshop', 'utf8');
  mkdirSync(path.join(openclawRoot, 'skills', 'general-skill'), { recursive: true });
  writeFileSync(path.join(openclawRoot, 'skills', 'general-skill', 'SKILL.md'), '# General', 'utf8');
  const configPath = path.join(openclawRoot, 'openclaw.json');
  writeFileSync(configPath, JSON.stringify({
    agents: { entries: { main: { identity: { name: 'Lótus' } } } },
    channels: { matrix: { token: 'must-not-leak' } },
    plugins: { entries: { codex: { secret: 'must-not-leak' } } },
    auth: { profiles: { personal: { token: 'must-not-leak' } } },
  }), 'utf8');
  const automationsPath = path.join(openclawRoot, 'automations.snapshot.json');
  writeFileSync(automationsPath, JSON.stringify({ jobs: [{ id: 'job_1', enabled: true }] }), 'utf8');

  const result = preparePulsoPrivateContext({
    sourceWorkspace: source,
    outputDir: output,
    openclawConfigPath: configPath,
    openclawRoot,
    automationsSnapshotPath: automationsPath,
    includeArchive: true,
    updatedAt: '2026-10-23T13:00:00.000Z',
  });
  const archive = path.join(result.contextDir, 'archive');
  assert.match(readFileSync(path.join(archive, 'sessions', 'main', 'session.jsonl'), 'utf8'), /user/);
  assert.match(readFileSync(path.join(archive, 'skills', 'workspace', 'local-skill', 'SKILL.md'), 'utf8'), /Local/);
  assert.match(readFileSync(path.join(archive, 'automations.json'), 'utf8'), /job_1/);
  const catalogText = readFileSync(path.join(archive, 'runtime-catalog.json'), 'utf8');
  assert.match(catalogText, /matrix/);
  assert.doesNotMatch(catalogText, /must-not-leak/);
  const manifest = JSON.parse(readFileSync(path.join(archive, 'manifest.json'), 'utf8'));
  assert.ok(manifest.totals.files >= 6);
  assert.equal(statSync(path.join(archive, 'sessions', 'main', 'session.jsonl')).mode & 0o077, 0);

  rmSync(source, { recursive: true, force: true });
  rmSync(openclawRoot, { recursive: true, force: true });
  rmSync(output, { recursive: true, force: true });
});

test('importador materializa a constelação de forma idempotente e mantém legados arquivados', async () => {
  const dataDir = mkdtempSync(path.join(tmpdir(), 'pulso-foundry-import-'));
  const store = new SqliteEventStore(path.join(dataDir, 'core.sqlite'));
  const controlPlane = new ControlPlaneService({ store });
  await controlPlane.restore();
  await controlPlane.initDefaults();
  const snapshotPath = path.join(dataDir, 'agent-constellation.json');
  const blueprint = {
    blueprintId: 'bp_openclaw_designer',
    name: 'FORMA',
    role: 'imagem e direção de arte',
    mission: 'Sustentar forma e coerência visual.',
    instructions: 'Preserve a fonte canônica.',
    requiredCapabilities: ['reasoning', 'handoff'],
    skills: ['canvas-design'],
    tools: [],
    memory: { scope: 'workspace', retainContext: true, maxContextTokens: 16384 },
    policies: { mode: 'workspace', requireConfirmationFor: ['public_publish'] },
    providerDefaults: { modelProviderId: 'codex-fe', model: 'gpt-6.1-sol' },
    runtimePreferences: { executorProviderId: 'codex-fe-executor', timeoutMs: 900000 },
    limits: { maxTurns: 40, maxTokens: 131072, maxCost: 0, maxToolCalls: 200, maxConcurrency: 3, timeoutMs: 900000 },
    surfaces: ['desktop', 'pulso', 'council'],
    metadata: { sourceSystem: 'openclaw', sourceAgentId: 'designer' },
    provenance: { kind: 'import', createdBy: 'pulso-openclaw-importer', lineage: ['openclaw:designer'] },
  };
  writeFileSync(snapshotPath, JSON.stringify({
    schemaVersion: 1,
    generatedAt: '2026-10-23T15:00:00.000Z',
    source: 'openclaw-sanitized-import',
    configuredAgents: [{ sourceAgentId: 'designer', agentId: 'agent_designer', blueprint, initialStatus: 'paused' }],
    archivedAgentCandidates: [{ sourceAgentId: 'legacy', status: 'archived_candidate' }],
  }), 'utf8');

  const importer = new ConstellationImporter({ foundry: controlPlane.foundry, snapshotPath });
  assert.equal(importer.plan().create, 1);
  const first = await importer.apply();
  assert.equal(first.receipts[0].blueprintAction, 'created');
  assert.equal(first.receipts[0].materialized, true);
  assert.equal(controlPlane.foundry.get('agent', 'agent_designer').status, 'paused');
  const second = await importer.apply();
  assert.equal(second.receipts[0].blueprintAction, 'unchanged');
  assert.equal(second.receipts[0].materialized, false);
  assert.equal(importer.plan().archivedCandidates, 1);

  store.close();
  rmSync(dataDir, { recursive: true, force: true });
});
