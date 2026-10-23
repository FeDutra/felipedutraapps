import { existsSync, readFileSync } from "node:fs";
import { eventDraft, invariant, pulsoId } from "../domain/contracts.mjs";

const ACTOR = Object.freeze({ kind: "system", id: "pulso-automation" });

function modelClass(job) {
  if (job.modelClass) return job.modelClass;
  const text = `${job.name || ""} ${job.kind || ""} ${job.task || ""}`.toLowerCase();
  if (/estrat|decis|investiga|conselho|delicad/.test(text)) return "strong";
  if (/resumo|brief|agenda|planej|relat/.test(text)) return "intermediate";
  return "light";
}

function normalizeJob(input, now) {
  const automationId = String(input.automationId || input.id || pulsoId("auto"));
  const payload = input.payload && typeof input.payload === "object" ? input.payload : {};
  const delivery = input.delivery && typeof input.delivery === "object" ? input.delivery : {};
  const payloadCommand = Array.isArray(payload.command) ? payload.command.join(" ") : payload.command;
  return {
    automationId,
    name: String(input.name || input.title || automationId),
    kind: input.kind || payload.kind || "task",
    enabled: input.enabled === true,
    schedule: input.schedule || null,
    task: input.task || input.prompt || input.message || payload.message || payload.text || payload.script || payloadCommand || input.description || "",
    agentId: input.agentId || input.owner?.agentId || null,
    channelId: input.channelId || delivery.channel || null,
    modelClass: modelClass(input),
    source: input.source || "pulso",
    lastRunAt: input.lastRunAt || null,
    nextRunAt: input.nextRunAt || null,
    createdAt: input.createdAt || now,
    updatedAt: now,
    metadata: input.metadata || {},
  };
}

function wallClockParts(date, timeZone = "UTC") {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    minute: "2-digit",
    hour: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    weekday: "short",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(formatter.formatToParts(date).filter(part => part.type !== "literal").map(part => [part.type, part.value]));
  const weekdays = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return { minute: Number(parts.minute), hour: Number(parts.hour), day: Number(parts.day), month: Number(parts.month), weekday: weekdays[parts.weekday], key: `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}` };
}

function cronFieldMatches(field, value, min, max) {
  return String(field || "*").split(",").some(token => {
    const [base, stepRaw] = token.split("/");
    const step = Math.max(1, Number(stepRaw || 1));
    let start = min; let end = max;
    if (base !== "*") {
      if (base.includes("-")) [start, end] = base.split("-").map(Number);
      else start = end = Number(base);
    }
    return Number.isFinite(start) && Number.isFinite(end) && value >= start && value <= end && (value - start) % step === 0;
  });
}

function cronMatches(schedule, now) {
  const expression = String(schedule?.expr || schedule?.cron || "").trim();
  const fields = expression.split(/\s+/);
  if (fields.length !== 5) return false;
  const parts = wallClockParts(now, schedule?.tz || schedule?.timeZone || "UTC");
  return cronFieldMatches(fields[0], parts.minute, 0, 59)
    && cronFieldMatches(fields[1], parts.hour, 0, 23)
    && cronFieldMatches(fields[2], parts.day, 1, 31)
    && cronFieldMatches(fields[3], parts.month, 1, 12)
    && cronFieldMatches(fields[4], parts.weekday, 0, 6);
}

function due(job, nowMs) {
  if (!job.enabled) return false;
  if (job.nextRunAt) return Date.parse(job.nextRunAt) <= nowMs;
  if (job.schedule?.at) return Date.parse(job.schedule.at) <= nowMs && !job.lastRunAt;
  if (job.schedule?.everyMs) return !job.lastRunAt || Date.parse(job.lastRunAt) + Number(job.schedule.everyMs) <= nowMs;
  if (job.schedule?.kind === "every" && job.schedule?.everyMs) return !job.lastRunAt || Date.parse(job.lastRunAt) + Number(job.schedule.everyMs) <= nowMs;
  if (job.schedule?.kind === "at" && job.schedule?.at) return Date.parse(job.schedule.at) <= nowMs && !job.lastRunAt;
  if (job.schedule?.kind === "cron" || job.schedule?.expr || job.schedule?.cron) {
    const now = new Date(nowMs);
    if (!cronMatches(job.schedule, now)) return false;
    if (!job.lastRunAt) return true;
    const currentKey = wallClockParts(now, job.schedule?.tz || job.schedule?.timeZone || "UTC").key;
    const previousKey = wallClockParts(new Date(job.lastRunAt), job.schedule?.tz || job.schedule?.timeZone || "UTC").key;
    return currentKey !== previousKey;
  }
  return false;
}

export class AutomationService {
  constructor({ store, snapshotPath = null, executor = null, clock = () => new Date().toISOString() } = {}) {
    invariant(store, "event_store_required");
    this.store = store; this.snapshotPath = snapshotPath; this.executor = executor; this.clock = clock;
    this.jobs = new Map(); this.runs = new Map(); this.restore();
  }

  restore() {
    this.jobs.clear(); this.runs.clear();
    for (const event of this.store.all().filter(item => item.type.startsWith("automation."))) {
      if (["automation.created", "automation.updated", "automation.state_changed"].includes(event.type)) this.jobs.set(event.payload.automationId, structuredClone(event.payload));
      if (["automation.run_started", "automation.run_completed", "automation.run_failed"].includes(event.type)) this.runs.set(event.payload.runId, structuredClone(event.payload));
    }
    return this.status();
  }

  importSnapshot() {
    if (!this.snapshotPath || !existsSync(this.snapshotPath)) return { configured: false, imported: 0, skipped: 0 };
    const parsed = JSON.parse(readFileSync(this.snapshotPath, "utf8"));
    const jobs = Array.isArray(parsed) ? parsed : (parsed.jobs || parsed.automations || []);
    let imported = 0, skipped = 0;
    for (const source of jobs) {
      const automationId = String(source.id || source.automationId || pulsoId("auto_import"));
      if (this.jobs.has(automationId)) { skipped += 1; continue; }
      this.create({ ...source, automationId, enabled: false, source: "legacy-import", metadata: { ...(source.metadata || {}), importedEnabled: source.enabled === true } });
      imported += 1;
    }
    return { configured: true, imported, skipped, total: jobs.length };
  }

  create(input = {}) {
    const occurredAt = this.clock(); const job = normalizeJob(input, occurredAt); invariant(!this.jobs.has(job.automationId), `automation_exists:${job.automationId}`);
    const result = this.store.append([eventDraft({ type: "automation.created", aggregateType: "automation", aggregateId: job.automationId, correlationId: pulsoId("autocmd"), actor: ACTOR, occurredAt, payload: job })]);
    this.jobs.set(job.automationId, structuredClone(job)); return { automation: job, events: result.events };
  }

  update(automationId, patch = {}) {
    const current = this.jobs.get(automationId); invariant(current, `automation_not_found:${automationId}`); const occurredAt = this.clock();
    const job = normalizeJob({ ...current, ...patch, automationId, createdAt: current.createdAt }, occurredAt);
    const result = this.store.append([eventDraft({ type: patch.enabled === undefined ? "automation.updated" : "automation.state_changed", aggregateType: "automation", aggregateId: automationId, correlationId: pulsoId("autocmd"), actor: ACTOR, occurredAt, payload: job })]);
    this.jobs.set(automationId, structuredClone(job)); return { automation: job, events: result.events };
  }

  list(query = {}) { let jobs = [...this.jobs.values()]; if (query.enabled !== undefined) jobs = jobs.filter(item => item.enabled === query.enabled); if (query.kind) jobs = jobs.filter(item => item.kind === query.kind); return jobs.sort((a, b) => a.name.localeCompare(b.name)).map(item => structuredClone(item)); }
  listRuns({ automationId = null, limit = 100 } = {}) { return [...this.runs.values()].filter(item => !automationId || item.automationId === automationId).sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, limit).map(item => structuredClone(item)); }

  async runNow(automationId, { reason = "manual", input = null } = {}) {
    const job = this.jobs.get(automationId); invariant(job, `automation_not_found:${automationId}`); invariant(typeof this.executor === "function", "automation_executor_unavailable");
    const runId = pulsoId("autorun"); const startedAt = this.clock(); const started = { runId, automationId, status: "running", reason, startedAt, completedAt: null, result: null, error: null };
    this.store.append([eventDraft({ type: "automation.run_started", aggregateType: "automation_run", aggregateId: runId, correlationId: runId, actor: ACTOR, occurredAt: startedAt, payload: started })]); this.runs.set(runId, structuredClone(started));
    try {
      const result = await this.executor(job, input);
      const completedAt = this.clock(); const completed = { ...started, status: "completed", completedAt, result };
      this.store.append([eventDraft({ type: "automation.run_completed", aggregateType: "automation_run", aggregateId: runId, correlationId: runId, actor: ACTOR, occurredAt: completedAt, payload: completed })]); this.runs.set(runId, structuredClone(completed));
      this.update(automationId, { lastRunAt: completedAt, nextRunAt: job.schedule?.everyMs ? new Date(Date.parse(completedAt) + Number(job.schedule.everyMs)).toISOString() : null });
      return completed;
    } catch (error) {
      const completedAt = this.clock(); const failed = { ...started, status: "failed", completedAt, error: { code: error?.code || "AUTOMATION_FAILED", message: error?.message || String(error) } };
      this.store.append([eventDraft({ type: "automation.run_failed", aggregateType: "automation_run", aggregateId: runId, correlationId: runId, actor: ACTOR, occurredAt: completedAt, payload: failed })]); this.runs.set(runId, structuredClone(failed)); return failed;
    }
  }

  async tick({ now = this.clock(), limit = 10 } = {}) {
    const nowMs = Date.parse(now); const candidates = this.list({ enabled: true }).filter(job => due(job, nowMs)).slice(0, limit); const runs = [];
    for (const job of candidates) runs.push(await this.runNow(job.automationId, { reason: "schedule" }));
    return { checkedAt: now, due: candidates.length, runs };
  }

  status() { const jobs = this.list(); const runs = this.listRuns(); return { configured: Boolean(this.snapshotPath), total: jobs.length, enabled: jobs.filter(item => item.enabled).length, disabled: jobs.filter(item => !item.enabled).length, runs: runs.length, running: runs.filter(item => item.status === "running").length }; }
}
