import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { AccessModeStore } from '../vendor/pulso-core/src/runtime/access-mode-store.mjs';
import { PrivateMemoryProvider } from '../vendor/pulso-core/src/memory/private-memory-provider.mjs';
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
  writeFileSync(path.join(rootDir, 'SOUL.md'), '# Lótus\nClareza e movimento.', 'utf8');
  writeFileSync(path.join(rootDir, 'memory', 'pulso.md'), '# PULSO\nNotion é fonte canônica operacional.', 'utf8');
  const provider = new PrivateMemoryProvider({ rootDir, maxResults: 2, chunkChars: 500 });
  const result = await provider.retrieve({ sessionId: 'livre_geral', input: 'qual é a fonte Notion da PULSO?' });
  assert.equal(result.provider, 'private-local-memory');
  assert.equal(result.sessionId, 'livre_geral');
  assert.equal(result.results[0].source, path.join('memory', 'pulso.md'));
  assert.match(result.results[0].content, /fonte canônica/);
  rmSync(rootDir, { recursive: true, force: true });
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
  rmSync(source, { recursive: true, force: true });
  rmSync(output, { recursive: true, force: true });
});
