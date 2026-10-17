const assert = require('node:assert/strict');
const test = require('node:test');
const { executeQuickRead, formatCalendarToday, normalizeEvents } = require('./quickReadBroker');

test('responde imediatamente quando não há compromisso', async () => {
  const result = await executeQuickRead({
    capability: 'calendar_today',
    args: { localDate: '2026-10-17', timezone: 'America/Sao_Paulo' },
  }, {
    accounts: ['pessoal', 'trabalho'],
    gogRunner: async () => [],
  });
  assert.equal(result.ok, true);
  assert.equal(result.itemCount, 0);
  assert.match(result.responseText, /não tem compromissos/i);
});

test('deduplica calendários e ordena por horário', () => {
  const events = normalizeEvents([
    [{ id: 'b', iCalUID: 'b', summary: 'Segundo', start: { dateTime: '2026-10-17T14:00:00-03:00' } }],
    [
      { id: 'a1', iCalUID: 'a', summary: 'Primeiro', start: { dateTime: '2026-10-17T09:00:00-03:00' } },
      { id: 'a2', iCalUID: 'a', summary: 'Primeiro duplicado', start: { dateTime: '2026-10-17T09:00:00-03:00' } },
    ],
  ]);
  assert.deepEqual(events.map(event => event.iCalUID), ['a', 'b']);
  assert.match(formatCalendarToday(events), /09:00, Primeiro.*14:00, Segundo/);
});

test('rejeita capacidade fora da allowlist', async () => {
  const result = await executeQuickRead({ capability: 'whatsapp_latest', args: {} });
  assert.equal(result.ok, false);
  assert.equal(result.errorCode, 'unsupported_capability');
});
