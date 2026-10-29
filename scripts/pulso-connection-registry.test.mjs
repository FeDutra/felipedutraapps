import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ConnectionRegistryService,
  SqliteEventStore,
} from '../vendor/pulso-core/src/index.mjs';

test('registro nomeia identidades sem expor slot de credencial', () => {
  const registry = new ConnectionRegistryService({
    store: new SqliteEventStore(':memory:'),
    clock: () => '2026-10-29T00:00:00.000Z',
  });
  const created = registry.register({
    connectionId: 'google-pessoal',
    service: 'google',
    label: 'Google · pessoal',
    principal: 'felipemachadodutra@gmail.com',
    adapter: 'codex_apps',
    credentialSlot: 'codex:personal:google',
    capabilities: ['calendar.read', 'drive.read', 'gmail.read'],
    status: 'available',
  }, { idempotencyKey: 'inventory:google-pessoal:v1' });
  assert.equal(created.connection.connectionId, 'google-pessoal');
  assert.equal(created.connection.credentialConfigured, true);
  assert.equal('credentialSlot' in created.connection, false);
  assert.equal(registry.status().available, 1);
});

test('vínculo contextual vence o default e impede Google ambíguo', () => {
  const registry = new ConnectionRegistryService({ store: new SqliteEventStore(':memory:') });
  registry.register({ connectionId: 'google-pessoal', service: 'google', label: 'Google pessoal', status: 'available' });
  registry.register({ connectionId: 'google-despertar', service: 'google', label: 'Google Despertar', status: 'available' });
  registry.bind({ scopeType: 'system', scopeId: 'global', service: 'google', connectionId: 'google-pessoal' });
  registry.bind({ scopeType: 'area', scopeId: 'despertar', service: 'google', connectionId: 'google-despertar' });
  assert.equal(registry.resolve({ service: 'google', areaId: 'despertar' }).connection.connectionId, 'google-despertar');
  assert.equal(registry.resolve({ service: 'google', areaId: 'pulso' }).connection.connectionId, 'google-pessoal');
});

test('registro falha fechado diante de segredo bruto', () => {
  const registry = new ConnectionRegistryService({ store: new SqliteEventStore(':memory:') });
  assert.throws(() => registry.register({
    connectionId: 'notion-fe',
    service: 'notion',
    status: 'available',
    metadata: { token: 'segredo-bruto' },
  }), /secret_detected/);
});

test('eventos do registro restauram perfis e bindings em outra instância', () => {
  const store = new SqliteEventStore(':memory:');
  const first = new ConnectionRegistryService({ store });
  first.register({ connectionId: 'notion-fe', service: 'notion', label: 'Notion · Fe', status: 'available' });
  first.bind({ scopeType: 'area', scopeId: 'pulso', service: 'notion', connectionId: 'notion-fe' });
  const restored = new ConnectionRegistryService({ store });
  assert.equal(restored.list().length, 1);
  assert.equal(restored.resolve({ service: 'notion', areaId: 'pulso' }).connection.connectionId, 'notion-fe');
});

test('inventário idempotente não cria novos eventos quando o conteúdo já existe', () => {
  const store = new SqliteEventStore(':memory:');
  const registry = new ConnectionRegistryService({ store, clock: () => '2026-10-29T00:00:00.000Z' });
  const inventory = {
    inventoryId: 'inventory-v1',
    connections: [{ connectionId: 'whatsapp-fe', service: 'whatsapp', label: 'WhatsApp · Fe', status: 'available' }],
    bindings: [{ scopeType: 'system', scopeId: 'global', service: 'whatsapp', connectionId: 'whatsapp-fe' }],
  };
  const first = registry.importInventory(inventory);
  const eventCount = store.all().length;
  const second = registry.importInventory(inventory);
  assert.equal(first.created, 2);
  assert.equal(second.created, 0);
  assert.equal(second.unchanged, 2);
  assert.equal(store.all().length, eventCount);
});

test('autorização de conector falha fechada para conta ainda não migrada', () => {
  const registry = new ConnectionRegistryService({ store: new SqliteEventStore(':memory:') });
  registry.register({ connectionId: 'google-pessoal', service: 'google', label: 'Google pessoal', status: 'needs_auth' });
  registry.bind({ scopeType: 'system', scopeId: 'global', service: 'google', connectionId: 'google-pessoal' });
  assert.throws(() => registry.authorizeTool({ source: 'gmail', tool: 'search_email_ids' }, { areaId: 'area_pulso' }), error => {
    assert.equal(error.code, 'connection_unavailable');
    assert.equal(error.connectionId, 'google-pessoal');
    return true;
  });
  assert.equal(registry.authorizeTool({ source: 'local', tool: 'shell' }, { areaId: 'area_pulso' }).governed, false);
});

test('autorização usa binding de Área e libera identidade institucional correta', () => {
  const registry = new ConnectionRegistryService({ store: new SqliteEventStore(':memory:') });
  registry.register({ connectionId: 'google-pessoal', service: 'google', status: 'needs_auth' });
  registry.register({ connectionId: 'google-despertar', service: 'google', status: 'available' });
  registry.bind({ scopeType: 'system', scopeId: 'global', service: 'google', connectionId: 'google-pessoal' });
  registry.bind({ scopeType: 'area', scopeId: 'area_despertar', service: 'google', connectionId: 'google-despertar' });
  const receipt = registry.authorizeTool({ capability: 'tool.google_calendar.list_calendars' }, { areaId: 'area_despertar' });
  assert.equal(receipt.connection.connectionId, 'google-despertar');
});
