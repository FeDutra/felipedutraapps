const assert = require('node:assert/strict');
const test = require('node:test');
const { executeQuickRead, formatCalendarToday, formatCalendarRange, formatWhatsAppMessages, normalizeEvents } = require('./quickReadBroker');

test('responde imediatamente quando não há compromisso', async () => {
  const result = await executeQuickRead({
    capability: 'calendar_range',
    args: { startDate: '2026-10-17', endDate: '2026-10-17', timezone: 'America/Sao_Paulo' },
  }, {
    accounts: ['pessoal', 'trabalho'],
    gogRunner: async (_account, startDate, endDate) => {
      assert.equal(startDate, '2026-10-17');
      assert.equal(endDate, '2026-10-17');
      return [];
    },
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
  const result = await executeQuickRead({ capability: 'shell', args: {} });
  assert.equal(result.ok, false);
  assert.equal(result.errorCode, 'unsupported_capability');
});

test('consulta calendário por intervalo inclusivo', async () => {
  const result = await executeQuickRead({
    capability: 'calendar_range',
    args: { startDate: '2026-10-17', endDate: '2026-10-21', timezone: 'America/Sao_Paulo' },
  }, {
    accounts: ['pessoal'],
    gogRunner: async (_account, startDate, endDate) => {
      assert.equal(startDate, '2026-10-17');
      assert.equal(endDate, '2026-10-21');
      return [{ id: 'x', summary: 'Reunião', start: { dateTime: '2026-10-20T10:00:00-03:00' } }];
    },
  });
  assert.equal(result.ok, true);
  assert.match(result.responseText, /20\/10: 10:00, Reunião/);
  assert.match(formatCalendarRange([], '2026-10-17', '2026-10-21'), /entre 17\/10 e 21\/10/);
});

test('lê até cinco mensagens recentes sem abrir interface', async () => {
  const result = await executeQuickRead({
    capability: 'whatsapp_latest',
    args: { contactName: 'Rodrigo', limit: 9, direction: 'received' },
  }, {
    resolveWhatsAppChat: async () => ({ jid: '5511999999999@s.whatsapp.net', name: 'Rodrigo' }),
    wacliRunner: async args => {
      assert.deepEqual(args, ['messages', 'list', '--from-them', '--limit', '5', '--chat', '5511999999999@s.whatsapp.net']);
      return { messages: [{ Text: 'Chego às cinco.' }, { MediaType: 'audio' }] };
    },
  });
  assert.equal(result.ok, true);
  assert.equal(result.itemCount, 2);
  assert.match(result.responseText, /Rodrigo: Chego às cinco/);
  assert.match(formatWhatsAppMessages([{ MediaType: 'image' }], 'Ana'), /\[image\]/);
});

test('consulta global ignora grupos e newsletters sem tomar a tela', async () => {
  const result = await executeQuickRead({
    capability: 'whatsapp_latest',
    args: { limit: 2, direction: 'received' },
  }, {
    wacliRunner: async args => {
      assert.deepEqual(args, ['messages', 'list', '--from-them', '--limit', '200']);
      return { messages: [
        { ChatJID: '120@g.us', ChatName: 'Grupo', Text: 'ruído' },
        { ChatJID: '5511@s.whatsapp.net', ChatName: 'Ana', Text: 'primeira' },
        { ChatJID: '5512@s.whatsapp.net', ChatName: 'Bia', Text: 'segunda' },
      ] };
    },
  });
  assert.equal(result.itemCount, 2);
  assert.doesNotMatch(result.responseText, /ruído/);
  assert.match(result.responseText, /Ana: primeira/);
});
