import { chmodSync, cpSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

function hardenPrivateTree(root) {
  if (!existsSync(root)) return;
  const entry = lstatSync(root);
  if (entry.isSymbolicLink()) return;
  chmodSync(root, entry.isDirectory() ? 0o700 : 0o600);
  if (!entry.isDirectory()) return;
  for (const name of readdirSync(root)) hardenPrivateTree(path.join(root, name));
}

function copyPrivateTree(from, to) {
  cpSync(from, to, {
    recursive: true,
    filter: source => !lstatSync(source).isSymbolicLink(),
  });
  hardenPrivateTree(to);
}

function sha256File(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

function archiveManifest(root) {
  const files = [];
  function visit(current) {
    for (const name of readdirSync(current)) {
      const absolute = path.join(current, name);
      const entry = lstatSync(absolute);
      if (entry.isDirectory()) visit(absolute);
      else if (entry.isFile()) files.push({
        path: path.relative(root, absolute),
        bytes: entry.size,
        sha256: sha256File(absolute),
      });
    }
  }
  visit(root);
  return files.sort((a, b) => a.path.localeCompare(b.path));
}

function requiredFile(root, name) {
  const file = path.join(root, name);
  if (!existsSync(file)) throw new Error(`Private context source missing: ${name}`);
  return readFileSync(file, 'utf8');
}

export function preparePulsoPrivateContext({
  sourceWorkspace,
  outputDir,
  openclawConfigPath: explicitOpenclawConfigPath = null,
  openclawRoot: explicitOpenclawRoot = null,
  automationsSnapshotPath = null,
  includeArchive = false,
  updatedAt = new Date().toISOString(),
} = {}) {
  if (!sourceWorkspace || !outputDir) throw new Error('sourceWorkspace and outputDir are required');
  const source = path.resolve(sourceWorkspace);
  const output = path.resolve(outputDir);
  const contextDir = path.join(output, 'private-context');
  mkdirSync(contextDir, { recursive: true, mode: 0o700 });

  const soul = requiredFile(source, 'SOUL.md');
  const user = requiredFile(source, 'USER.md');
  const identity = requiredFile(source, 'IDENTITY.md');
  const agents = requiredFile(source, 'AGENTS.md');
  const boot = existsSync(path.join(source, 'BOOT.md')) ? readFileSync(path.join(source, 'BOOT.md'), 'utf8') : '';
  const longMemory = existsSync(path.join(source, 'MEMORY.md')) ? readFileSync(path.join(source, 'MEMORY.md'), 'utf8') : '';

  for (const name of ['SOUL.md', 'USER.md', 'IDENTITY.md', 'AGENTS.md', 'BOOT.md', 'MEMORY.md']) {
    const from = path.join(source, name);
    if (existsSync(from)) copyPrivateTree(from, path.join(contextDir, name));
  }
  if (existsSync(path.join(source, 'memory'))) {
    copyPrivateTree(path.join(source, 'memory'), path.join(contextDir, 'memory'));
  }
  if (existsSync(path.join(source, 'agents', '_shared'))) {
    copyPrivateTree(path.join(source, 'agents', '_shared'), path.join(contextDir, 'agents', '_shared'));
  }

  const openclawConfigPath = explicitOpenclawConfigPath || process.env.PULSO_OPENCLAW_CONFIG || path.resolve(source, '..', 'openclaw.json');
  const openclawRoot = explicitOpenclawRoot || process.env.PULSO_OPENCLAW_ROOT || path.dirname(openclawConfigPath);
  const configuredAgents = [];
  const archivedAgentCandidates = [];
  if (existsSync(openclawConfigPath)) {
    const openclawConfig = JSON.parse(readFileSync(openclawConfigPath, 'utf8'));
    const entries = openclawConfig?.agents?.entries || {};
    const configuredIds = new Set(Object.keys(entries));
    const agentWorkspaceRoot = path.join(source, 'agents');
    const agentRuntimeRoot = path.resolve(source, '..', 'agents');

    for (const [agentId, entry] of Object.entries(entries)) {
      const isMain = agentId === 'main';
      const workspace = isMain
        ? source
        : path.resolve(entry.workspace || path.join(agentWorkspaceRoot, agentId));
      const privateAgentDir = path.join(contextDir, 'agents', agentId);
      mkdirSync(privateAgentDir, { recursive: true, mode: 0o700 });

      const formationFiles = {};
      for (const name of ['IDENTITY.md', 'SOUL.md', 'USER.md', 'AGENTS.md', 'MEMORY.md', 'HEARTBEAT.md']) {
        const from = path.join(workspace, name);
        if (!existsSync(from)) continue;
        const text = readFileSync(from, 'utf8');
        formationFiles[name] = text;
        writeFileSync(path.join(privateAgentDir, name), text, { mode: 0o600 });
      }

      if (existsSync(path.join(workspace, 'memory'))) {
        copyPrivateTree(path.join(workspace, 'memory'), path.join(privateAgentDir, 'memory'));
      }

      const identity = entry.identity || {};
      const safeId = agentId.replace(/[^a-zA-Z0-9_-]/g, '-');
      const model = typeof entry.model === 'string' ? entry.model.split('@')[0] : null;
      const policyMode = entry?.tools?.profile === 'minimal' ? 'read-only' : (isMain ? 'full' : 'workspace');
      const instructions = [formationFiles['SOUL.md'], formationFiles['AGENTS.md']]
        .filter(Boolean)
        .join('\n\n---\n\n');
      const skills = Array.isArray(entry.skills) ? entry.skills : [];

      configuredAgents.push({
        sourceAgentId: agentId,
        agentId: isMain ? 'agent_lotus' : `agent_${safeId}`,
        blueprint: {
          blueprintId: isMain ? 'bp_lotus_assistant' : `bp_openclaw_${safeId}`,
          name: identity.name || entry.name || agentId,
          role: identity.theme || (isMain ? 'centro integrador' : 'especialista importada'),
          mission: identity.theme
            ? `Sustentar ${identity.theme} dentro da constelação PULSO.`
            : `Preservar o mandato importado de ${agentId} dentro da constelação PULSO.`,
          instructions,
          requiredCapabilities: isMain
            ? ['reasoning', 'task_planning', 'tool_dispatch', 'agent_orchestration']
            : ['reasoning', 'tool_dispatch', 'handoff'],
          skills,
          tools: Array.isArray(entry?.tools?.allow) ? entry.tools.allow : [],
          memory: {
            scope: isMain ? 'shared' : 'workspace',
            retainContext: true,
            maxContextTokens: isMain ? 32768 : 16384,
          },
          policies: {
            mode: policyMode,
            requireConfirmationFor: [
              'external_message',
              'public_publish',
              'financial_action',
              'credential_change',
              'destructive_action',
            ],
          },
          providerDefaults: {
            modelProviderId: 'codex-fe',
            model: 'gpt-6.1-sol',
          },
          runtimePreferences: {
            executorProviderId: 'codex-fe-executor',
            timeoutMs: 900000,
          },
          limits: {
            maxTurns: 40,
            maxTokens: 131072,
            maxCost: 0,
            maxToolCalls: 200,
            maxConcurrency: isMain ? 8 : 3,
            timeoutMs: 900000,
          },
          surfaces: isMain ? ['desktop', 'pulso', 'internal'] : ['desktop', 'pulso', 'internal', 'council'],
          metadata: {
            sourceSystem: 'openclaw',
            sourceAgentId: agentId,
            emoji: identity.emoji || null,
            sourceModel: model,
            sourceToolProfile: entry?.tools?.profile || null,
            sourceToolDeny: Array.isArray(entry?.tools?.deny) ? entry.tools.deny : [],
            formationRoot: `private-context/agents/${agentId}`,
          },
          provenance: {
            kind: 'import',
            createdBy: 'pulso-openclaw-importer',
            lineage: [`openclaw:${agentId}`],
          },
        },
        initialStatus: 'paused',
      });
    }

    const archivedIds = new Set();
    for (const [root, reason] of [
      [agentWorkspaceRoot, 'formation_exists_but_agent_is_not_configured'],
      [agentRuntimeRoot, 'runtime_exists_but_agent_is_not_configured'],
    ]) {
      if (!existsSync(root)) continue;
      for (const name of readdirSync(root)) {
        if (name === '_shared' || configuredIds.has(name) || archivedIds.has(name)) continue;
        const candidatePath = path.join(root, name);
        if (!statSync(candidatePath).isDirectory()) continue;
        archivedIds.add(name);
        archivedAgentCandidates.push({ sourceAgentId: name, status: 'archived_candidate', reason });
      }
    }
  }

  writeFileSync(
    path.join(contextDir, 'agent-constellation.json'),
    JSON.stringify({
      schemaVersion: 1,
      generatedAt: updatedAt,
      source: 'openclaw-sanitized-import',
      configuredAgents,
      archivedAgentCandidates,
    }, null, 2) + '\n',
    { mode: 0o600 },
  );

  const overlay = {
    schemaVersion: 1,
    identityId: 'lotus',
    version: `private-${updatedAt.replace(/[^0-9]/g, '').slice(0, 14)}`,
    human: {
      name: 'Felipe',
      preferredName: 'Fe',
      timezone: 'America/Sao_Paulo',
      source: 'USER.md',
      fullText: user,
    },
    context: {
      source: ['SOUL.md', 'IDENTITY.md'],
      soul,
      identity,
      privateContextRoot: 'private-context',
    },
    policies: {
      source: 'AGENTS.md',
      fullText: agents,
      accessMode: 'integral_when_enabled',
    },
    memoryDirectives: {
      source: ['BOOT.md', 'MEMORY.md', 'memory/**/*.md'],
      boot,
      longMemoryAvailable: Boolean(longMemory),
      retrieval: 'local_private_with_provenance',
    },
    updatedAt,
  };
  const overlayPath = path.join(output, 'lotus.private.json');
  writeFileSync(overlayPath, JSON.stringify(overlay, null, 2) + '\n', { mode: 0o600 });

  const workspaceInstructions = [
    '# PULSO · Contexto privado integral',
    '',
    'Este diretório é o contexto privado local da Lótus para Fe.',
    'Leia SOUL.md, USER.md e IDENTITY.md no início de cada conversa.',
    'Consulte memory/ e MEMORY.md sob demanda; preserve proveniência e não invente lembranças.',
    'Use os apps/conectores da conta — especialmente Notion — como fontes reais quando o pedido exigir.',
    'Não exponha segredos, credenciais, chamadas de ferramenta ou bastidor técnico no chat.',
    'Mensagens externas, publicações, dinheiro, credenciais e relações delicadas continuam exigindo autorização humana explícita.',
  ].join('\n');
  writeFileSync(path.join(output, 'AGENTS.md'), workspaceInstructions + '\n', { mode: 0o600 });

  if (includeArchive) {
    const archiveDir = path.join(contextDir, 'archive');
    mkdirSync(archiveDir, { recursive: true, mode: 0o700 });
    const sessionsDir = path.join(archiveDir, 'sessions');
    const runtimeAgentsDir = path.join(openclawRoot, 'agents');
    if (existsSync(runtimeAgentsDir)) {
      for (const agentId of readdirSync(runtimeAgentsDir)) {
        const from = path.join(runtimeAgentsDir, agentId, 'sessions');
        if (existsSync(from) && statSync(from).isDirectory()) {
          copyPrivateTree(from, path.join(sessionsDir, agentId));
        }
      }
    }

    const skillRoots = [
      ['workspace', path.join(source, 'skills')],
      ['workshop', path.join(openclawRoot, 'agents', 'main', 'agent', 'workshop-skills')],
      ['general', path.join(openclawRoot, 'skills')],
    ];
    for (const [name, from] of skillRoots) {
      if (existsSync(from)) copyPrivateTree(from, path.join(archiveDir, 'skills', name));
    }

    if (automationsSnapshotPath && existsSync(automationsSnapshotPath)) {
      copyPrivateTree(automationsSnapshotPath, path.join(archiveDir, 'automations.json'));
    }

    if (existsSync(openclawConfigPath)) {
      const config = JSON.parse(readFileSync(openclawConfigPath, 'utf8'));
      const catalog = {
        schemaVersion: 1,
        generatedAt: updatedAt,
        agents: Object.keys(config?.agents?.entries || {}).sort(),
        channels: Object.keys(config?.channels || {}).sort(),
        plugins: Object.keys(config?.plugins?.entries || {}).sort(),
        authProfiles: Object.keys(config?.auth?.profiles || {}).sort(),
        mcpApps: Object.keys(config?.mcp?.apps || {}).sort(),
        mcpServers: Object.keys(config?.mcp?.servers || {}).sort(),
      };
      writeFileSync(path.join(archiveDir, 'runtime-catalog.json'), JSON.stringify(catalog, null, 2) + '\n', { mode: 0o600 });
    }

    const files = archiveManifest(archiveDir);
    writeFileSync(path.join(archiveDir, 'manifest.json'), JSON.stringify({
      schemaVersion: 1,
      generatedAt: updatedAt,
      files,
      totals: {
        files: files.length,
        bytes: files.reduce((sum, item) => sum + item.bytes, 0),
      },
    }, null, 2) + '\n', { mode: 0o600 });
  }
  hardenPrivateTree(output);

  return { output, contextDir, overlayPath };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  const result = preparePulsoPrivateContext({
    sourceWorkspace: process.env.PULSO_PRIVATE_WORKSPACE,
    outputDir: process.env.PULSO_PRIVATE_OUTPUT,
    openclawRoot: process.env.PULSO_OPENCLAW_ROOT,
    automationsSnapshotPath: process.env.PULSO_AUTOMATIONS_SNAPSHOT,
    includeArchive: process.env.PULSO_INCLUDE_OPENCLAW_ARCHIVE === '1',
  });
  console.log(JSON.stringify(result));
}
