import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./PulsoCoreProviderPanel.tsx', import.meta.url), 'utf8');
const providerSource = readFileSync(new URL('../services/pulsoCoreProvider.ts', import.meta.url), 'utf8');
const livePageSource = readFileSync(new URL('../pages/LivePage.tsx', import.meta.url), 'utf8');

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

test('primeira abertura registra automaticamente o provider canônico antes de liberar o Core', () => {
  assert.match(providerSource, /PULSO_CANONICAL_PROVIDER_CONFIG/);
  assert.match(providerSource, /providerId: 'codex-fe'/);
  assert.match(providerSource, /adapterKind: 'codex_subscription'/);
  assert.match(providerSource, /model: 'gpt-6\.1-sol'/);
  assert.match(providerSource, /this\.readSavedConfig\(\) \|\| PULSO_CANONICAL_PROVIDER_CONFIG/);
  assert.match(
    livePageSource,
    /await pulsoCoreProvider\.restore\(\)[\s\S]*setCoreReady\(true\)/
  );
});

test('todos os botões do painel possuem type="button" explícito para impedir submit implícito', () => {
  const buttonMatches = source.match(/<button\b[^>]*>/g) || [];
  assert.ok(buttonMatches.length >= 5);
  for (const buttonTag of buttonMatches) {
    assert.match(buttonTag, /type="button"/);
  }
});
