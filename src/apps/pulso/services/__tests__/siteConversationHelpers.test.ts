import assert from 'node:assert/strict';
import test from 'node:test';
import {
  computeSiteConversationMetrics,
  filterSiteConversations,
  isConversationUnread,
  mapSiteConversationRequestStatus
// @ts-ignore Node's strip-types runner executes the TypeScript source directly.
} from '../siteConversationHelpers.ts';
import type { SiteConversationSummary } from '../../types/siteConversation.types.ts';

const sample: SiteConversationSummary[] = [
  {
    id: 'one',
    visitorName: 'Roberto',
    visitorEmail: 'roberto@example.com',
    status: 'active',
    totalMessages: 2,
    createdAt: new Date('2026-09-28T10:00:00Z'),
    lastMessageAt: new Date('2026-09-28T11:00:00Z'),
    internalLastReadAt: null,
    latestRequestId: 'req-1',
    preview: 'Quero transformar meu conhecimento em um curso',
    latestRequestStatus: 'success',
    unread: true
  },
  {
    id: 'two',
    visitorName: 'Marina',
    visitorEmail: 'marina@example.com',
    status: 'active',
    totalMessages: 1,
    createdAt: new Date('2026-09-27T10:00:00Z'),
    lastMessageAt: new Date('2026-09-27T10:00:00Z'),
    internalLastReadAt: new Date('2026-09-27T11:00:00Z'),
    latestRequestId: 'req-2',
    preview: 'Tenho uma ideia de produto',
    latestRequestStatus: 'error',
    unread: false
  }
];

test('detecta leitura por comparação temporal', () => {
  assert.equal(isConversationUnread(new Date('2026-09-28T11:00:00Z'), null), true);
  assert.equal(
    isConversationUnread(
      new Date('2026-09-28T11:00:00Z'),
      new Date('2026-09-28T12:00:00Z')
    ),
    false
  );
});

test('calcula métricas sem contar falha como não lida automaticamente', () => {
  assert.deepEqual(computeSiteConversationMetrics(sample), {
    total: 2,
    unread: 1,
    active: 2,
    errors: 1
  });
});

test('filtra por estado e busca por nome, e-mail ou assunto', () => {
  assert.deepEqual(filterSiteConversations(sample, 'unread', '').map((item) => item.id), ['one']);
  assert.deepEqual(filterSiteConversations(sample, 'all', 'CURSO').map((item) => item.id), ['one']);
  assert.deepEqual(filterSiteConversations(sample, 'error', 'marina').map((item) => item.id), ['two']);
});

test('normaliza estados do trabalhador para o painel', () => {
  assert.equal(mapSiteConversationRequestStatus('completed'), 'success');
  assert.equal(mapSiteConversationRequestStatus('processing_openclaw'), 'running');
  assert.equal(mapSiteConversationRequestStatus('openclaw_failed'), 'error');
  assert.equal(mapSiteConversationRequestStatus('queued_for_openclaw'), 'queued');
});
