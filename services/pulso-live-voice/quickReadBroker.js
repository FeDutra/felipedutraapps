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

async function defaultGogRunner(account, localDate) {
  const { stdout } = await execFileAsync('/usr/local/bin/gog', [
    'calendar', 'events', '--all',
    '--from', localDate,
    '--to', nextDate(localDate),
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

function configuredAccounts() {
  const configured = String(process.env.PULSO_GOOGLE_ACCOUNTS || '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);
  return configured.length > 0 ? configured : DEFAULT_ACCOUNTS;
}

async function executeQuickRead(request, options = {}) {
  const startedAt = Date.now();
  if (request?.capability !== 'calendar_today') {
    return { ok: false, errorCode: 'unsupported_capability', durationMs: Date.now() - startedAt };
  }

  const localDate = String(request?.args?.localDate || '');
  const timezone = String(request?.args?.timezone || 'America/Sao_Paulo');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(localDate)) {
    return { ok: false, errorCode: 'invalid_arguments', durationMs: Date.now() - startedAt };
  }

  try {
    const runner = options.gogRunner || defaultGogRunner;
    const accounts = options.accounts || configuredAccounts();
    const eventLists = await Promise.all(accounts.map(account => runner(account, localDate)));
    const events = normalizeEvents(eventLists);
    return {
      ok: true,
      capability: request.capability,
      responseText: formatCalendarToday(events, timezone),
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
  normalizeEvents,
};
