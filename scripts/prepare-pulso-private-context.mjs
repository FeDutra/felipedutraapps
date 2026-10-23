import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

function requiredFile(root, name) {
  const file = path.join(root, name);
  if (!existsSync(file)) throw new Error(`Private context source missing: ${name}`);
  return readFileSync(file, 'utf8');
}

export function preparePulsoPrivateContext({ sourceWorkspace, outputDir, updatedAt = new Date().toISOString() } = {}) {
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
    if (existsSync(from)) cpSync(from, path.join(contextDir, name));
  }
  if (existsSync(path.join(source, 'memory'))) {
    cpSync(path.join(source, 'memory'), path.join(contextDir, 'memory'), { recursive: true });
  }
  if (existsSync(path.join(source, 'agents', '_shared'))) {
    cpSync(path.join(source, 'agents', '_shared'), path.join(contextDir, 'agents', '_shared'), { recursive: true });
  }

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

  return { output, contextDir, overlayPath };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  const result = preparePulsoPrivateContext({
    sourceWorkspace: process.env.PULSO_PRIVATE_WORKSPACE,
    outputDir: process.env.PULSO_PRIVATE_OUTPUT,
  });
  console.log(JSON.stringify(result));
}
