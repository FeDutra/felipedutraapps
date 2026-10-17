const { execFile } = require('node:child_process');
const { promisify } = require('node:util');

const execFileAsync = promisify(execFile);
const DEFAULT_ACCOUNTS = [
  'felipemachadodutra@gmail.com',
  'felipe@adespertar.com.br',
];

function nextDate(date) {
  const parsed = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) throw new Error('invalid_local_date');
  parsed.setUTCDate(parsed.getUTCDate() + 1);
  return parsed.toISOString().slice(0, 10);
}

function eventStart(event) {
  return event?.start?.dateTime || event?.start?.date || '';
}

function isVisibleEvent(event) {
  if (!event || event.status === 'cancelled') return false;
  const attendees = Array.isArray(event.attendees) ? event.attendees : [];
  const self = attendees.find(attendee => attendee?.self);
  return self?.responseStatus !== 'declined';
}

function formatTime(value, timezone) {
  if (!value || /^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(parsed);
}

function normalizeEvents(eventLists) {
  const byIdentity = new Map();
  for (const list of eventLists) {
    for (const event of Array.isArray(list) ? list : []) {
      if (!isVisibleEvent(event)) continue;
      const identity = event.iCalUID || event.id || `${eventStart(event)}:${event.summary || ''}`;
      if (!byIdentity.has(identity)) byIdentity.set(identity, event);
    }
  }
  return [...byIdentity.values()].sort((left, right) => eventStart(left).localeCompare(eventStart(right)));
}

function formatCalendarToday(events, timezone = 'America/Sao_Paulo') {
  if (events.length === 0) {
    return 'Fê, você não tem compromissos registrados para hoje.';
  }

  const items = events.map(event => {
    const title = String(event.summary || 'Compromisso').replace(/\s+/g, ' ').trim();
    const time = formatTime(eventStart(event), timezone);
    return time ? `${time}, ${title}` : `o dia todo, ${title}`;
  });

  if (items.length === 1) return `Fê, você tem um compromisso hoje: ${items[0]}.`;
  if (items.length === 2) return `Fê, você tem dois compromissos hoje: ${items[0]} e ${items[1]}.`;
  return `Fê, você tem ${items.length} compromissos hoje: ${items.join('; ')}.`;
}

function localDateKey(value, timezone) {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(parsed);
}

function formatCalendarRange(events, startDate, endDate, timezone = 'America/Sao_Paulo') {
  if (startDate === endDate) return formatCalendarToday(events, timezone);
  if (events.length === 0) {
    return `Fê, você não tem compromissos registrados entre ${formatDateLabel(startDate)} e ${formatDateLabel(endDate)}.`;
  }
  const byDate = new Map();
  for (const event of events) {
    const date = localDateKey(eventStart(event), timezone);
    const title = String(event.summary || 'Compromisso').replace(/\s+/g, ' ').trim();
    const time = formatTime(eventStart(event), timezone);
    const item = time ? `${time}, ${title}` : `o dia todo, ${title}`;
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date).push(item);
  }
  const days = [...byDate.entries()].map(([date, items]) => `${formatDateLabel(date)}: ${items.join('; ')}`);
  return `Fê, encontrei ${events.length} ${events.length === 1 ? 'compromisso' : 'compromissos'}: ${days.join('. ')}.`;
}

function formatDateLabel(date) {
  const parsed = new Date(`${date}T12:00:00Z`);
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(parsed);
}

async function defaultGogRunner(account, startDate, endDate) {
  const { stdout } = await execFileAsync('/usr/local/bin/gog', [
    'calendar', 'events', '--all',
    '--from', startDate,
    '--to', nextDate(endDate),
    '--account', account,
    '--json', '--results-only', '--no-input', '--max', '50',
  ], {
    timeout: 4_000,
    maxBuffer: 1024 * 1024,
    env: process.env,
  });
  const parsed = JSON.parse(stdout || '[]');
  return Array.isArray(parsed) ? parsed : [];
}

function normalizeName(value) {
  return String(value || '')
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function runWacli(args) {
  const { stdout } = await execFileAsync('/root/go/bin/wacli', [...args, '--json', '--read-only'], {
    timeout: 4_000,
    maxBuffer: 2 * 1024 * 1024,
    env: process.env,
  });
  const parsed = JSON.parse(stdout || '{}');
  if (parsed?.success !== true) throw new Error(parsed?.error || 'wacli_failed');
  return parsed.data;
}

async function resolveWhatsAppChat(contactName) {
  if (!contactName) return null;
  const chats = await runWacli(['chats', 'list']);
  const query = normalizeName(contactName);
  const candidates = (Array.isArray(chats) ? chats : [])
    .filter(chat => normalizeName(chat.name).includes(query))
    .sort((left, right) => {
      const leftExact = normalizeName(left.name) === query ? 1 : 0;
      const rightExact = normalizeName(right.name) === query ? 1 : 0;
      if (leftExact !== rightExact) return rightExact - leftExact;
      if (left.kind !== right.kind) return left.kind === 'dm' ? -1 : 1;
      return String(right.last_message_ts || '').localeCompare(String(left.last_message_ts || ''));
    });
  if (candidates.length === 0) return { error: 'chat_not_found' };
  const best = candidates[0];
  const sameRank = candidates.filter(candidate => (
    normalizeName(candidate.name) === normalizeName(best.name) && candidate.kind === best.kind
  ));
  if (sameRank.length > 1) return { error: 'chat_ambiguous' };
  return best;
}

function messageText(message) {
  const text = String(message?.Text || message?.DisplayText || message?.Snippet || message?.MediaCaption || '').replace(/\s+/g, ' ').trim();
  if (text) return text.slice(0, 280);
  const mediaType = String(message?.MediaType || message?.MimeType || 'mídia');
  return `[${mediaType}]`;
}

function formatWhatsAppMessages(messages, contactName) {
  if (messages.length === 0) {
    return contactName
      ? `Fê, não encontrei mensagens recentes recebidas de ${contactName}.`
      : 'Fê, não encontrei mensagens recentes recebidas no WhatsApp.';
  }
  const items = messages.map(message => {
    const sender = contactName || message.ChatName || message.SenderName || 'WhatsApp';
    return `${sender}: ${messageText(message)}`;
  });
  const scope = contactName ? `de ${contactName}` : 'no WhatsApp';
  return `Fê, ${messages.length === 1 ? 'a última mensagem' : `as ${messages.length} últimas mensagens`} ${scope}: ${items.join('; ')}.`;
}

async function executeWhatsAppLatest(request, options, startedAt) {
  const rawLimit = Number(request?.args?.limit || 1);
  const limit = Math.min(5, Math.max(1, Number.isFinite(rawLimit) ? rawLimit : 1));
  const contactName = String(request?.args?.contactName || '').trim();
  const runner = options.wacliRunner || runWacli;
  let chat = null;
  if (contactName) {
    chat = options.resolveWhatsAppChat
      ? await options.resolveWhatsAppChat(contactName)
      : await resolveWhatsAppChat(contactName);
    if (chat?.error) {
      return { ok: false, capability: request.capability, errorCode: chat.error, durationMs: Date.now() - startedAt };
    }
  }
  // O histórico global costuma ser dominado por grupos e newsletters. Buscamos
  // uma janela maior em bastidor e só então mantemos as mensagens diretas;
  // nada dessa janela intermediária é devolvido ao cliente.
  const fetchLimit = chat?.jid ? limit : 200;
  const args = ['messages', 'list', '--from-them', '--limit', String(fetchLimit)];
  if (chat?.jid) args.push('--chat', chat.jid);
  const data = await runner(args);
  const rawMessages = Array.isArray(data) ? data : Array.isArray(data?.messages) ? data.messages : [];
  const messages = (chat?.jid
    ? rawMessages
    : rawMessages.filter(message => String(message?.ChatJID || '').endsWith('@s.whatsapp.net'))
  ).slice(0, limit);
  return {
    ok: true,
    capability: request.capability,
    responseText: formatWhatsAppMessages(messages, contactName || undefined),
    itemCount: messages.length,
    durationMs: Date.now() - startedAt,
  };
}

function configuredAccounts() {
  const configured = String(process.env.PULSO_GOOGLE_ACCOUNTS || '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);
  return configured.length > 0 ? configured : DEFAULT_ACCOUNTS;
}

async function executeQuickRead(request, options = {}) {
  const startedAt = Date.now();
  if (!['calendar_range', 'whatsapp_latest'].includes(request?.capability)) {
    return { ok: false, errorCode: 'unsupported_capability', durationMs: Date.now() - startedAt };
  }

  if (request.capability === 'whatsapp_latest') {
    try {
      return await executeWhatsAppLatest(request, options, startedAt);
    } catch (error) {
      return {
        ok: false,
        capability: request.capability,
        errorCode: error?.code === 'ETIMEDOUT' ? 'connector_timeout' : 'connector_failed',
        durationMs: Date.now() - startedAt,
      };
    }
  }

  const startDate = String(request?.args?.startDate || request?.args?.localDate || '');
  const endDate = String(request?.args?.endDate || startDate);
  const timezone = String(request?.args?.timezone || 'America/Sao_Paulo');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate) || endDate < startDate) {
    return { ok: false, errorCode: 'invalid_arguments', durationMs: Date.now() - startedAt };
  }
  const spanDays = Math.round((new Date(`${endDate}T12:00:00Z`) - new Date(`${startDate}T12:00:00Z`)) / 86_400_000) + 1;
  if (spanDays < 1 || spanDays > 31) {
    return { ok: false, errorCode: 'invalid_arguments', durationMs: Date.now() - startedAt };
  }

  try {
    const runner = options.gogRunner || defaultGogRunner;
    const accounts = options.accounts || configuredAccounts();
    const eventLists = await Promise.all(accounts.map(account => runner(account, startDate, endDate)));
    const events = normalizeEvents(eventLists);
    return {
      ok: true,
      capability: request.capability,
      responseText: formatCalendarRange(events, startDate, endDate, timezone),
      itemCount: events.length,
      durationMs: Date.now() - startedAt,
    };
  } catch (error) {
    return {
      ok: false,
      capability: request.capability,
      errorCode: error?.code === 'ETIMEDOUT' ? 'connector_timeout' : 'connector_failed',
      durationMs: Date.now() - startedAt,
    };
  }
}

module.exports = {
  executeQuickRead,
  formatCalendarToday,
  formatCalendarRange,
  formatWhatsAppMessages,
  normalizeEvents,
};
