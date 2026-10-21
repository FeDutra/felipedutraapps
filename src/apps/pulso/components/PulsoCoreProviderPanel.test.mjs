import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./PulsoCoreProviderPanel.tsx', import.meta.url), 'utf8');

test('painel prioriza assinatura ChatGPT e não pede chave no fluxo de assinatura', () => {
  assert.match(source, /readSavedConfig\(\) \|\| configFor\('codex_subscription'\)/);
  assert.match(source, /\[ entrar com ChatGPT \]/);
  assert.match(source, /config\.adapterKind !== 'codex_subscription'/);
  assert.match(source, /Fe · pessoal/);
});

test('primeira candidata não oferece troca prematura para perfis Despertar ou Mila', () => {
  assert.doesNotMatch(source, /<option value="despertar"/);
  assert.doesNotMatch(source, /<option value="mila"/);
  assert.match(source, /Despertar e Mila entram depois da prova/);
});
