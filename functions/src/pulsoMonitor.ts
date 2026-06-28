/**
 * pulsoMonitor.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Crons de monitoramento sistêmico da Pulso.
 *
 * Camada 1 (prioritária):
 *   1. pulsoHealthCheck         — a cada 5 min: saúde operacional geral
 *   2. pulsoQueueWatchdog       — a cada 2 min: watchdog de fila presa
 *   3. pulsoLatencyReport       — a cada 15 min: latência ponta a ponta
 *   4. pulsoActiveMessageCheck  — a cada 10 min: resposta ativa / duplicidade
 *
 * Camada 2 (segunda fase):
 *   5. pulsoSessionConsistency  — a cada 30 min: sessões e chats
 *   6. pulsoFrontBackendSync    — a cada 15 min: sincronização backend-front
 *   7. pulsoRegressionCheck     — a cada 1 hora: regressão funcional
 *
 * Todos escrevem em:
 *   workspaces/felipe_dutra/pulso_monitor_events   (log de cada run)
 *   workspaces/felipe_dutra/pulso_alerts           (alerta visível na Health)
 *
 * Regra de interrupção: só alerta quando há problema real e persistente,
 * nunca por micro-ruído pontual.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";

const db = getFirestore();

const WORKSPACE = "felipe_dutra";
const BASE      = `workspaces/${WORKSPACE}`;
const REQUESTS  = `${BASE}/pulso_requests`;
const ALERTS    = `${BASE}/pulso_alerts`;
const MONITOR   = `${BASE}/pulso_monitor_events`;
const SESSIONS  = `${BASE}/pulso_sessions`;

// ─── SISTEMA → ALERTAS chat (destino oficial dos alertas operacionais) ────────

const ALERTAS_CONTEXT_ID       = "sistema_alertas";
const ALERTAS_AREA_ID          = "area_sistema";
const ALERTAS_SESSION_KEY      = "agent:main:pulso:sistema_alertas";
let   alertasSessionEnsured    = false;

/** Garante que a sessão SISTEMA → ALERTAS existe no Firestore. */
async function ensureAlertasSession(): Promise<void> {
  if (alertasSessionEnsured) return;
  const ref = db.collection(SESSIONS).doc(ALERTAS_CONTEXT_ID);
  await ref.set({
    contextId:          ALERTAS_CONTEXT_ID,
    areaId:             ALERTAS_AREA_ID,
    label:              "ALERTAS",
    openclawSessionKey: ALERTAS_SESSION_KEY,
    isSystem:           true,
    pinned:             true,
    createdAt:          FieldValue.serverTimestamp(),
    updatedAt:          FieldValue.serverTimestamp(),
  }, { merge: true });
  alertasSessionEnsured = true;
}

/** Formata o emoji de severidade. */
function severityEmoji(severity: string): string {
  if (severity === "critical") return "🔴";
  if (severity === "high")     return "🟠";
  if (severity === "medium")   return "🟡";
  return "⚪";
}

/**
 * Publica uma mensagem no chat SISTEMA → ALERTAS como active_message.
 * Aparece como mensagem da Lótus no chat ALERTAS.
 */
async function publishToAlertasChat(opts: {
  alertId: string;
  name: string;
  description: string;
  severity: "low" | "medium" | "high" | "critical";
  cronName: string;
  type: "alert" | "resolved";
  details?: Record<string, any>;
}): Promise<void> {
  try {
    await ensureAlertasSession();

    const ts   = new Date().toISOString();
    const icon = opts.type === "resolved" ? "✅" : severityEmoji(opts.severity);
    const now  = FieldValue.serverTimestamp();

    let responseText: string;

    if (opts.type === "resolved") {
      responseText =
        `${icon} **RESOLVIDO** — ${opts.name}\n` +
        `↳ ${ts.replace("T", " ").substring(0, 19)} UTC`;
    } else {
      const detailLines = opts.details
        ? Object.entries(opts.details)
            .map(([k, v]) => `  • ${k}: ${JSON.stringify(v)}`)
            .join("\n")
        : "";
      responseText =
        `${icon} **${opts.name}**\n\n` +
        `${opts.description}\n` +
        (detailLines ? `\n**detalhes:**\n${detailLines}\n` : "") +
        `\n↳ ${ts.replace("T", " ").substring(0, 19)} UTC`;
    }

    await db.collection(REQUESTS).add({
      requestType:       "active_message",
      status:            "success",
      contextId:         ALERTAS_CONTEXT_ID,
      areaId:            ALERTAS_AREA_ID,
      openclawSessionKey: ALERTAS_SESSION_KEY,
      archived:          false,
      openclawResult: {
        responseText,
        processedBy:  "pulso-monitor",
        processedAt:  ts,
        summary:      opts.name,
      },
      meta: {
        originCron: opts.cronName,
        alertId:    opts.alertId,
        alertType:  opts.type,
        severity:   opts.severity,
      },
      requestedAt: now,
      createdAt:   now,
      updatedAt:   now,
    });
  } catch (err) {
    console.error("[pulsoMonitor] Failed to publish to ALERTAS chat:", err);
  }
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function toMs(ts: any): number | null {
  if (!ts) return null;
  if (ts instanceof Timestamp) return ts.toMillis();
  if (ts.seconds) return ts.seconds * 1000;
  if (typeof ts === "string") { const d = Date.parse(ts); return isNaN(d) ? null : d; }
  return null;
}

async function raiseAlert(opts: {
  id: string;
  name: string;
  description: string;
  severity: "low" | "medium" | "high" | "critical";
  tags: string[];
  cronName?: string;
  details?: Record<string, any>;
}) {
  const ts = FieldValue.serverTimestamp();

  // 1. Escreve em pulso_alerts (Health Center)
  const existing = await db.collection(ALERTS).doc(opts.id).get();
  const wasAlreadyOpen = existing.exists && existing.data()?.status === "open";

  await db.collection(ALERTS).doc(opts.id).set({
    id:          opts.id,
    slug:        opts.id,
    name:        opts.name,
    description: opts.description,
    severity:    opts.severity,
    priority:    opts.severity === "critical" ? "critical" : opts.severity === "high" ? "high" : "medium",
    status:      "open",
    tags:        ["pulso-monitor", ...opts.tags],
    agentRef:    "pulso-monitor",
    notes:       opts.details ? JSON.stringify(opts.details, null, 2) : "",
    createdAt:   ts,
    updatedAt:   ts,
  }, { merge: true });

  // 2. Publica no chat SISTEMA → ALERTAS (só se é um alerta novo, não repetição)
  const effectiveCron = opts.cronName || currentCronContext;
  if (!wasAlreadyOpen && effectiveCron) {
    await publishToAlertasChat({
      alertId:     opts.id,
      name:        opts.name,
      description: opts.description,
      severity:    opts.severity,
      cronName:    effectiveCron,
      type:        "alert",
      details:     opts.details,
    });
  }
}

async function resolveAlert(alertId: string, cronName?: string, name?: string) {
  const ref  = db.collection(ALERTS).doc(alertId);
  const snap = await ref.get();
  if (snap.exists && snap.data()?.status === "open") {
    await ref.update({ status: "resolved", updatedAt: FieldValue.serverTimestamp() });
    // Publica resolução no chat ALERTAS
    const effectiveCron = cronName || currentCronContext;
    if (effectiveCron) {
      await publishToAlertasChat({
        alertId,
        name:        name || snap.data()?.name || alertId,
        description: "Condição resolvida automaticamente.",
        severity:    snap.data()?.severity || "medium",
        cronName:    effectiveCron,
        type:        "resolved",
      });
    }
  }
}

async function logMonitorEvent(cronName: string, result: Record<string, any>) {
  await db.collection(MONITOR).add({
    cron:  cronName,
    runAt: FieldValue.serverTimestamp(),
    ...result,
  });
}

// Contexto do cron em execução — usado como fallback em raiseAlert/resolveAlert
// (Cloud Functions são single-thread por invocação, seguro usar variável de módulo)
let currentCronContext = "pulso-monitor";

// ─── thresholds ──────────────────────────────────────────────────────────────

const QUEUE_STUCK_MS         = 5 * 60 * 1000;   // request preso > 5 min = alerta
const QUEUE_CRITICAL_MS      = 15 * 60 * 1000;  // preso > 15 min = crítico
const QUEUE_SIZE_WARN        = 10;              // fila com > 10 itens = alerta
const QUEUE_SIZE_CRITICAL    = 30;              // fila > 30 = crítico
const LATENCY_WARN_MS        = 10_000;          // acima de 10s = amarelo
const LATENCY_CRITICAL_MS    = 15_000;          // acima de 15s = vermelho
const LATENCY_WINDOW_MINUTES = 60;             // olhar últimos 60 min
const ACTIVE_MSG_WINDOW_MIN  = 30;             // janela de resposta ativa

// ═══════════════════════════════════════════════════════════════════════════════
// CRON 1 — Saúde Operacional (a cada 5 minutos)
// ═══════════════════════════════════════════════════════════════════════════════
export const pulsoHealthCheck = onSchedule(
  { schedule: "every 5 minutes", region: "us-central1", timeoutSeconds: 60 },
  async () => {
    currentCronContext = "pulsoHealthCheck";
    const now = Date.now();
    const fiveMinAgo = new Date(now - 5 * 60 * 1000);
    const alerts: string[] = [];

    // 1. Requests presos em queued_for_openclaw
    const queuedSnap = await db.collection(REQUESTS)
      .where("status", "==", "queued_for_openclaw")
      .where("archived", "==", false)
      .get();

    const stuckQueued = queuedSnap.docs.filter(d => {
      const ms = toMs(d.data().requestedAt || d.data().createdAt);
      return ms !== null && now - ms > QUEUE_STUCK_MS;
    });

    if (stuckQueued.length > 0) {
      const maxAge = Math.max(...stuckQueued.map(d => {
        const ms = toMs(d.data().requestedAt || d.data().createdAt) || now;
        return now - ms;
      }));
      const severity = maxAge > QUEUE_CRITICAL_MS ? "critical" : "high";
      alerts.push(`${stuckQueued.length} request(s) presos em queued_for_openclaw (máx ${Math.round(maxAge / 60000)} min)`);
      await raiseAlert({
        id:          "pulso-health-stuck-queued",
        name:        "Pulso: Fila presa em queued_for_openclaw",
        description: `${stuckQueued.length} request(s) presos há mais de ${Math.round(maxAge / 60000)} minutos sem avançar.\nImpacto: mensagens entram mas não saem da fila.\nAção recomendada: verificar worker / bridge / runtime OpenClaw.`,
        severity,
        tags:        ["queue", "worker", "openclaw"],
        details:     { count: stuckQueued.length, maxAgeMinutes: Math.round(maxAge / 60000), samples: stuckQueued.slice(0, 3).map(d => d.id) },
      });
    } else {
      await resolveAlert("pulso-health-stuck-queued", "pulsoHealthCheck");
    }

    // 2. Requests presos em processing_openclaw
    const processingSnap = await db.collection(REQUESTS)
      .where("status", "==", "processing_openclaw")
      .where("archived", "==", false)
      .get();

    const stuckProcessing = processingSnap.docs.filter(d => {
      const ms = toMs(d.data().startedAt || d.data().updatedAt || d.data().requestedAt);
      return ms !== null && now - ms > QUEUE_STUCK_MS;
    });

    if (stuckProcessing.length > 0) {
      const maxAge = Math.max(...stuckProcessing.map(d => {
        const ms = toMs(d.data().startedAt || d.data().updatedAt || d.data().requestedAt) || now;
        return now - ms;
      }));
      const severity = maxAge > QUEUE_CRITICAL_MS ? "critical" : "high";
      alerts.push(`${stuckProcessing.length} request(s) presos em processing_openclaw`);
      await raiseAlert({
        id:          "pulso-health-stuck-processing",
        name:        "Pulso: Request preso em processing_openclaw",
        description: `${stuckProcessing.length} request(s) presos em processamento há mais de ${Math.round(maxAge / 60000)} minutos.\nImpacto: LLM/worker iniciou mas não retornou.\nAção recomendada: verificar runtime OpenClaw / timeout do bridge.`,
        severity,
        tags:        ["processing", "openclaw", "timeout"],
        details:     { count: stuckProcessing.length, maxAgeMinutes: Math.round(maxAge / 60000), samples: stuckProcessing.slice(0, 3).map(d => d.id) },
      });
    } else {
      await resolveAlert("pulso-health-stuck-processing", "pulsoHealthCheck");
    }

    // 3. Tamanho total da fila ativa
    const activeQueueSnap = await db.collection(REQUESTS)
      .where("status", "in", ["queued_for_openclaw", "processing_openclaw"])
      .where("archived", "==", false)
      .get();

    const queueSize = activeQueueSnap.size;
    if (queueSize >= QUEUE_SIZE_CRITICAL) {
      alerts.push(`Fila crítica: ${queueSize} requests ativos`);
      await raiseAlert({
        id:          "pulso-health-queue-overflow",
        name:        "Pulso: Fila em overflow crítico",
        description: `${queueSize} requests ativos simultâneos — acima do limite crítico de ${QUEUE_SIZE_CRITICAL}.\nAção recomendada: verificar worker e bridge.`,
        severity:    "critical",
        tags:        ["queue", "overflow"],
        details:     { queueSize },
      });
    } else if (queueSize >= QUEUE_SIZE_WARN) {
      alerts.push(`Fila acima do normal: ${queueSize} requests ativos`);
      await raiseAlert({
        id:          "pulso-health-queue-overflow",
        name:        "Pulso: Fila acima do normal",
        description: `${queueSize} requests ativos — acima do limite de atenção (${QUEUE_SIZE_WARN}).`,
        severity:    "medium",
        tags:        ["queue"],
        details:     { queueSize },
      });
    } else {
      await resolveAlert("pulso-health-queue-overflow", "pulsoHealthCheck");
    }

    // 4. Silêncio operacional: nenhum request nos últimos 5 min (só alerta se houve atividade recente)
    const recentSnap = await db.collection(REQUESTS)
      .where("requestedAt", ">=", fiveMinAgo)
      .where("status", "==", "success")
      .limit(1)
      .get();

    // (Silêncio não é necessariamente um problema — apenas log)

    // Log do run
    await logMonitorEvent("pulsoHealthCheck", {
      alerts,
      stuckQueuedCount:     stuckQueued.length,
      stuckProcessingCount: stuckProcessing.length,
      queueSize,
      healthy:              alerts.length === 0,
    });

    console.log("[pulsoHealthCheck]", { alerts, queueSize, stuckQueued: stuckQueued.length, stuckProcessing: stuckProcessing.length });
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// CRON 2 — Watchdog de Fila Presa (a cada 2 minutos)
// ═══════════════════════════════════════════════════════════════════════════════
export const pulsoQueueWatchdog = onSchedule(
  { schedule: "every 2 minutes", region: "us-central1", timeoutSeconds: 30 },
  async () => {
    currentCronContext = "pulsoQueueWatchdog";
    const now = Date.now();
    // Janela aceitável para requests simples: 3 minutos
    const acceptableWindowMs = 3 * 60 * 1000;
    const alerts: string[] = [];

    // Requests em queued_for_openclaw além da janela aceitável
    const queuedSnap = await db.collection(REQUESTS)
      .where("status", "==", "queued_for_openclaw")
      .where("archived", "==", false)
      .get();

    const blocked = queuedSnap.docs.filter(d => {
      const ms = toMs(d.data().requestedAt || d.data().createdAt);
      return ms !== null && now - ms > acceptableWindowMs;
    });

    if (blocked.length > 0) {
      const agesMin = blocked.map(d => {
        const ms = toMs(d.data().requestedAt || d.data().createdAt) || now;
        return Math.round((now - ms) / 60000);
      });
      const maxAge = Math.max(...agesMin);
      alerts.push(`FILA PRESA: ${blocked.length} request(s), máx ${maxAge} min sem avançar`);

      await raiseAlert({
        id:          "pulso-watchdog-queue-stuck",
        name:        "Pulso: Watchdog — Fila presa detectada",
        description: `${blocked.length} request(s) em queued_for_openclaw há mais de ${acceptableWindowMs / 60000} minutos.\nCaso clássico: entrou mas não andou.\nAção: worker / bridge / runtime OpenClaw.`,
        severity:    maxAge > 10 ? "critical" : "high",
        tags:        ["watchdog", "queue", "stuck"],
        details:     { blocked: blocked.length, maxAgeMinutes: maxAge, ids: blocked.slice(0, 5).map(d => d.id) },
      });
    } else {
      await resolveAlert("pulso-watchdog-queue-stuck", "pulsoQueueWatchdog");
    }

    // Locks expirados (requests em processing_openclaw há mais de 5 min sem atualização)
    const processingSnap = await db.collection(REQUESTS)
      .where("status", "==", "processing_openclaw")
      .where("archived", "==", false)
      .get();

    const orphanLocks = processingSnap.docs.filter(d => {
      const ms = toMs(d.data().updatedAt || d.data().startedAt || d.data().requestedAt);
      return ms !== null && now - ms > 5 * 60 * 1000;
    });

    if (orphanLocks.length > 0) {
      alerts.push(`Lock órfão: ${orphanLocks.length} request(s) travados em processing`);
      await raiseAlert({
        id:          "pulso-watchdog-orphan-lock",
        name:        "Pulso: Watchdog — Lock órfão em processing",
        description: `${orphanLocks.length} request(s) presos em processing_openclaw há mais de 5 min sem atualização de estado.\nO worker pode ter morrido durante o processamento.`,
        severity:    "high",
        tags:        ["watchdog", "lock", "orphan"],
        details:     { orphanLocks: orphanLocks.length, ids: orphanLocks.slice(0, 5).map(d => d.id) },
      });
    } else {
      await resolveAlert("pulso-watchdog-orphan-lock", "pulsoQueueWatchdog");
    }

    await logMonitorEvent("pulsoQueueWatchdog", {
      alerts,
      blocked: blocked.length,
      orphanLocks: orphanLocks.length,
      healthy: alerts.length === 0,
    });

    console.log("[pulsoQueueWatchdog]", { alerts, blocked: blocked.length, orphanLocks: orphanLocks.length });
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// CRON 3 — Latência Ponta a Ponta (a cada 15 minutos)
// ═══════════════════════════════════════════════════════════════════════════════
export const pulsoLatencyReport = onSchedule(
  { schedule: "every 15 minutes", region: "us-central1", timeoutSeconds: 60 },
  async () => {
    currentCronContext = "pulsoLatencyReport";
    const now   = Date.now();
    const since = new Date(now - LATENCY_WINDOW_MINUTES * 60 * 1000);
    const alerts: string[] = [];

    // Buscar requests completados recentemente com dados de latência
    const snap = await db.collection(REQUESTS)
      .where("status", "==", "success")
      .where("updatedAt", ">=", since)
      .where("archived", "==", false)
      .orderBy("updatedAt", "desc")
      .limit(50)
      .get();

    if (snap.empty) {
      await logMonitorEvent("pulsoLatencyReport", { message: "Sem requests concluídos na janela. Nenhuma latência calculada.", window: LATENCY_WINDOW_MINUTES });
      return;
    }

    const samples: Array<{
      id: string;
      total: number;
      t1tot2: number;
      t2tot3: number;
      t3tot4: number;
      t4tot5: number;
    }> = [];

    for (const doc of snap.docs) {
      const d = doc.data();
      // t1: clientCreatedAtMs (set by client before submit)
      const t1 = d.clientCreatedAtMs || toMs(d.requestedAt);
      // t2: requestedAt (when Firestore received it)
      const t2 = toMs(d.requestedAt);
      // t3: startedAt (when worker claimed it)
      const t3 = toMs(d.startedAt) || toMs(d.updatedAt);
      // t4: processedAt by OpenClaw
      const t4 = toMs(d.openclawResult?.processedAt) || toMs(d.openclawProcessedAt) || toMs(d.updatedAt);
      // t5: final updatedAt in Firestore
      const t5 = toMs(d.updatedAt);

      if (!t1 || !t5) continue;
      const total   = t5 - t1;
      const t1tot2  = t2 ? t2 - t1  : 0;
      const t2tot3  = (t2 && t3) ? t3 - t2 : 0;
      const t3tot4  = (t3 && t4) ? t4 - t3 : 0;
      const t4tot5  = (t4 && t5) ? t5 - t4 : 0;

      if (total > 0 && total < 5 * 60 * 1000) { // ignora outliers > 5 min
        samples.push({ id: doc.id, total, t1tot2, t2tot3, t3tot4, t4tot5 });
      }
    }

    if (samples.length === 0) {
      await logMonitorEvent("pulsoLatencyReport", { message: "Sem amostras válidas de latência." });
      return;
    }

    const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
    const avgTotal  = Math.round(avg(samples.map(s => s.total)));
    const avgT1T2   = Math.round(avg(samples.map(s => s.t1tot2)));
    const avgT2T3   = Math.round(avg(samples.map(s => s.t2tot3)));
    const avgT3T4   = Math.round(avg(samples.map(s => s.t3tot4)));
    const avgT4T5   = Math.round(avg(samples.map(s => s.t4tot5)));

    // Detectar gargalo dominante
    const stages = [
      { name: "t1→t2 (submit→firestore)",       ms: avgT1T2 },
      { name: "t2→t3 (firestore→worker)",        ms: avgT2T3 },
      { name: "t3→t4 (worker LLM processing)",   ms: avgT3T4 },
      { name: "t4→t5 (openclaw→write-back)",      ms: avgT4T5 },
    ];
    const bottleneck = stages.reduce((a, b) => a.ms >= b.ms ? a : b);

    const report = {
      sampleCount:    samples.length,
      windowMinutes:  LATENCY_WINDOW_MINUTES,
      avgTotalMs:     avgTotal,
      avgTotalSec:    (avgTotal / 1000).toFixed(2),
      stages:         { avgT1T2, avgT2T3, avgT3T4, avgT4T5 },
      bottleneck:     bottleneck.name,
      status:         avgTotal > LATENCY_CRITICAL_MS ? "critical" : avgTotal > LATENCY_WARN_MS ? "warning" : "ok",
    };

    if (avgTotal > LATENCY_CRITICAL_MS) {
      alerts.push(`Latência crítica: média ${(avgTotal / 1000).toFixed(1)}s (meta: < 7s)`);
      await raiseAlert({
        id:          "pulso-latency-critical",
        name:        "Pulso: Latência crítica ponta a ponta",
        description: `Média simples: ${(avgTotal / 1000).toFixed(1)}s — acima do limite crítico de 15s.\nMaior gargalo: ${bottleneck.name} (${(bottleneck.ms / 1000).toFixed(1)}s).\nAmostras analisadas: ${samples.length} requests nos últimos ${LATENCY_WINDOW_MINUTES} min.`,
        severity:    "critical",
        tags:        ["latency", "performance"],
        details:     report,
      });
    } else if (avgTotal > LATENCY_WARN_MS) {
      alerts.push(`Latência elevada: média ${(avgTotal / 1000).toFixed(1)}s`);
      await raiseAlert({
        id:          "pulso-latency-critical",
        name:        "Pulso: Latência acima da meta",
        description: `Média simples: ${(avgTotal / 1000).toFixed(1)}s — acima do alerta amarelo de 10s.\nMaior gargalo: ${bottleneck.name} (${(bottleneck.ms / 1000).toFixed(1)}s).`,
        severity:    "medium",
        tags:        ["latency"],
        details:     report,
      });
    } else {
      await resolveAlert("pulso-latency-critical", "pulsoLatencyReport");
    }

    await logMonitorEvent("pulsoLatencyReport", { ...report, alerts });
    console.log("[pulsoLatencyReport]", report);
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// CRON 4 — Resposta Ativa / Duplicidade (a cada 10 minutos)
// ═══════════════════════════════════════════════════════════════════════════════
export const pulsoActiveMessageCheck = onSchedule(
  { schedule: "every 10 minutes", region: "us-central1", timeoutSeconds: 60 },
  async () => {
    currentCronContext = "pulsoActiveMessageCheck";
    const now   = Date.now();
    const since = new Date(now - ACTIVE_MSG_WINDOW_MIN * 60 * 1000);
    const alerts: string[] = [];

    // Buscar requests do tipo conversation_command completados recentemente
    const cmdSnap = await db.collection(REQUESTS)
      .where("requestType", "==", "conversation_command")
      .where("status",      "==", "success")
      .where("updatedAt",   ">=", since)
      .where("archived",    "==", false)
      .orderBy("updatedAt", "desc")
      .limit(20)
      .get();

    // Buscar active_messages emitidas na mesma janela
    const activeSnap = await db.collection(REQUESTS)
      .where("requestType", "==", "active_message")
      .where("updatedAt",   ">=", since)
      .where("archived",    "==", false)
      .orderBy("updatedAt", "desc")
      .limit(50)
      .get();

    const activeMsgs = activeSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];

    // 1. Verificar se active_messages pararam de sair
    if (cmdSnap.size > 0 && activeMsgs.length === 0) {
      alerts.push("Nenhuma active_message emitida nos últimos 30 min, mas há requests completados");
      await raiseAlert({
        id:          "pulso-active-msg-silence",
        name:        "Pulso: Resposta ativa silenciosa",
        description: `${cmdSnap.size} requests completados com sucesso nos últimos ${ACTIVE_MSG_WINDOW_MIN} min, mas nenhuma active_message foi emitida.\nImpacto: Felipe pode não estar recebendo respostas em tempo real.\nAção: verificar bridge de active_messages / runtime OpenClaw.`,
        severity:    "high",
        tags:        ["active-message", "silence"],
        details:     { successfulRequests: cmdSnap.size, activeMessages: 0, window: ACTIVE_MSG_WINDOW_MIN },
      });
    } else {
      await resolveAlert("pulso-active-msg-silence", "pulsoActiveMessageCheck");
    }

    // 2. Detectar duplicidade de active_messages para o mesmo originRequestId
    const originCounts: Record<string, number> = {};
    for (const msg of activeMsgs) {
      const originId = msg.meta?.originRequestId;
      if (originId) {
        originCounts[originId] = (originCounts[originId] || 0) + 1;
      }
    }
    const duplicates = Object.entries(originCounts).filter(([, count]) => count > 1);

    if (duplicates.length > 0) {
      alerts.push(`Duplicidade detectada: ${duplicates.length} requests com múltiplas active_messages`);
      await raiseAlert({
        id:          "pulso-active-msg-duplicate",
        name:        "Pulso: Duplicidade de resposta ativa detectada",
        description: `${duplicates.length} request(s) geraram mais de uma active_message na mesma janela.\nImpacto: Felipe pode estar vendo respostas duplicadas no chat.\nAção: verificar lógica de deduplicação no bridge/worker.`,
        severity:    "high",
        tags:        ["active-message", "duplicate"],
        details:     { duplicates: duplicates.map(([id, count]) => ({ originRequestId: id, count })) },
      });
    } else {
      await resolveAlert("pulso-active-msg-duplicate", "pulsoActiveMessageCheck");
    }

    // 3. Verificar se requests "success" sem active_message têm resposta direto no openclawResult
    let missingResponse = 0;
    for (const doc of cmdSnap.docs) {
      const d = doc.data();
      const hasActiveMsg = activeMsgs.some(m => m.meta?.originRequestId === doc.id);
      const hasInlineResponse = d.openclawResult?.responseText?.trim();
      if (!hasActiveMsg && !hasInlineResponse) {
        missingResponse++;
      }
    }

    if (missingResponse > 0 && cmdSnap.size > 0) {
      const pct = Math.round((missingResponse / cmdSnap.size) * 100);
      if (pct > 30) { // só alerta se > 30% dos requests estiverem sem resposta
        alerts.push(`${missingResponse}/${cmdSnap.size} requests sem resposta visível (${pct}%)`);
        await raiseAlert({
          id:          "pulso-active-msg-no-response",
          name:        "Pulso: Requests sem retorno visível ao usuário",
          description: `${missingResponse} de ${cmdSnap.size} requests completados (${pct}%) não têm active_message nem resposta inline.\nImpacto: Felipe pode estar enviando mensagens sem receber resposta.\nAção: verificar worker / bridge / logica de emissão de resposta.`,
          severity:    pct > 60 ? "critical" : "high",
          tags:        ["active-message", "no-response"],
          details:     { missingResponse, totalSuccess: cmdSnap.size, pct },
        });
      } else {
        await resolveAlert("pulso-active-msg-no-response", "pulsoActiveMessageCheck");
      }
    } else {
      await resolveAlert("pulso-active-msg-no-response", "pulsoActiveMessageCheck");
    }

    await logMonitorEvent("pulsoActiveMessageCheck", {
      alerts,
      successRequests:  cmdSnap.size,
      activeMessages:   activeMsgs.length,
      duplicates:       duplicates.length,
      missingResponse,
      healthy:          alerts.length === 0,
    });

    console.log("[pulsoActiveMessageCheck]", { alerts, successRequests: cmdSnap.size, activeMessages: activeMsgs.length, duplicates: duplicates.length });
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// CAMADA 2 — CRON 5: Consistência de Sessões (a cada 30 min)
// ═══════════════════════════════════════════════════════════════════════════════
export const pulsoSessionConsistency = onSchedule(
  { schedule: "every 30 minutes", region: "us-central1", timeoutSeconds: 60 },
  async () => {
    currentCronContext = "pulsoSessionConsistency";
    const now   = Date.now();
    const since = new Date(now - 60 * 60 * 1000); // última hora
    const alerts: string[] = [];

    // Buscar requests recentes com contextId inválido ou ausente
    const snap = await db.collection(REQUESTS)
      .where("requestedAt", ">=", since)
      .where("archived",    "==", false)
      .orderBy("requestedAt", "desc")
      .limit(50)
      .get();

    let missingContext = 0;
    let missingSessionKey = 0;
    const contextIds = new Set<string>();

    for (const doc of snap.docs) {
      const d = doc.data();
      if (!d.contextId) missingContext++;
      if (!d.openclawSessionKey) missingSessionKey++;
      if (d.contextId) contextIds.add(d.contextId);
    }

    if (missingContext > 0 && snap.size > 0) {
      const pct = Math.round((missingContext / snap.size) * 100);
      if (pct > 20) {
        alerts.push(`${missingContext} requests sem contextId (${pct}%)`);
        await raiseAlert({
          id:          "pulso-session-missing-context",
          name:        "Pulso: Sessões com contextId ausente",
          description: `${missingContext} de ${snap.size} requests na última hora não têm contextId definido.\nImpacto: continuidade de sessão comprometida.\nAção: verificar envio de contextId no client.`,
          severity:    "medium",
          tags:        ["session", "context"],
          details:     { missingContext, total: snap.size, pct },
        });
      }
    } else {
      await resolveAlert("pulso-session-missing-context", "pulsoSessionConsistency");
    }

    if (missingSessionKey > 0 && snap.size > 0) {
      const pct = Math.round((missingSessionKey / snap.size) * 100);
      if (pct > 30) {
        alerts.push(`${missingSessionKey} requests sem openclawSessionKey (${pct}%)`);
        await raiseAlert({
          id:          "pulso-session-missing-key",
          name:        "Pulso: Sessões sem openclawSessionKey",
          description: `${missingSessionKey} de ${snap.size} requests sem chave de sessão OpenClaw.\nImpacto: contexto de conversa pode estar sendo perdido entre mensagens.`,
          severity:    "medium",
          tags:        ["session", "openclaw"],
          details:     { missingSessionKey, total: snap.size, pct },
        });
      }
    } else {
      await resolveAlert("pulso-session-missing-key", "pulsoSessionConsistency");
    }

    await logMonitorEvent("pulsoSessionConsistency", {
      alerts, total: snap.size, missingContext, missingSessionKey,
      uniqueContextIds: contextIds.size, healthy: alerts.length === 0,
    });

    console.log("[pulsoSessionConsistency]", { alerts, total: snap.size, missingContext, missingSessionKey });
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// CAMADA 2 — CRON 6: Sincronização Backend-Front (a cada 15 min)
// ═══════════════════════════════════════════════════════════════════════════════
export const pulsoFrontBackendSync = onSchedule(
  { schedule: "every 15 minutes", region: "us-central1", timeoutSeconds: 60 },
  async () => {
    currentCronContext = "pulsoFrontBackendSync";
    const now   = Date.now();
    const since = new Date(now - 15 * 60 * 1000);
    const alerts: string[] = [];

    // Verificar active_messages persistidas mas sem confirmação de render
    const activeSnap = await db.collection(REQUESTS)
      .where("requestType", "==", "active_message")
      .where("createdAt",   ">=", since)
      .where("archived",    "==", false)
      .limit(30)
      .get();

    // Verificar requests success sem active_message correspondente
    const successSnap = await db.collection(REQUESTS)
      .where("requestType", "==", "conversation_command")
      .where("status",      "==", "success")
      .where("updatedAt",   ">=", since)
      .where("archived",    "==", false)
      .limit(20)
      .get();

    const activeOrigins = new Set(activeSnap.docs.map(d => d.data().meta?.originRequestId).filter(Boolean));
    let noActiveMsg = 0;
    for (const doc of successSnap.docs) {
      if (!activeOrigins.has(doc.id) && !doc.data().openclawResult?.responseText?.trim()) {
        noActiveMsg++;
      }
    }

    const activeCount = activeSnap.size;
    const successCount = successSnap.size;
    const report = { activeCount, successCount, noActiveMsg, window: 15 };

    if (noActiveMsg > 0 && successCount > 0) {
      const pct = Math.round((noActiveMsg / successCount) * 100);
      if (pct > 40) {
        alerts.push(`${noActiveMsg}/${successCount} requests sem active_message persistida`);
        await raiseAlert({
          id:          "pulso-sync-no-active-msg",
          name:        "Pulso: Divergência backend-front detectada",
          description: `${noActiveMsg} de ${successCount} requests completados não geraram active_message persistida.\nImpacto: resposta pode ter chegado ao backend mas não ao front.\nAção: verificar bridge de emissão de active_messages.`,
          severity:    "medium",
          tags:        ["sync", "active-message", "front"],
          details:     { ...report, pct },
        });
      } else {
        await resolveAlert("pulso-sync-no-active-msg", "pulsoFrontBackendSync");
      }
    } else {
      await resolveAlert("pulso-sync-no-active-msg", "pulsoFrontBackendSync");
    }

    await logMonitorEvent("pulsoFrontBackendSync", { alerts, ...report, healthy: alerts.length === 0 });
    console.log("[pulsoFrontBackendSync]", { alerts, ...report });
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// CAMADA 2 — CRON 7: Regressão Funcional (a cada 1 hora)
// ═══════════════════════════════════════════════════════════════════════════════
export const pulsoRegressionCheck = onSchedule(
  { schedule: "every 60 minutes", region: "us-central1", timeoutSeconds: 90 },
  async () => {
    currentCronContext = "pulsoRegressionCheck";
    const now   = Date.now();
    const since = new Date(now - 60 * 60 * 1000);
    const alerts: string[] = [];

    const snap = await db.collection(REQUESTS)
      .where("requestType", "==", "conversation_command")
      .where("status",      "==", "success")
      .where("updatedAt",   ">=", since)
      .where("archived",    "==", false)
      .orderBy("updatedAt", "desc")
      .limit(50)
      .get();

    if (snap.empty) {
      await logMonitorEvent("pulsoRegressionCheck", { message: "Sem requests na janela de 1h para análise de regressão." });
      return;
    }

    let emptyResponse   = 0;
    let inconsistentStatus = 0;
    let successNoEffect    = 0;

    for (const doc of snap.docs) {
      const d = doc.data();
      const responseText = d.openclawResult?.responseText?.trim() || "";
      const activeActive = d.requestType === "conversation_command";

      // Resposta vazia
      if (d.status === "success" && !responseText && activeActive) emptyResponse++;

      // Status incoerente (success mas com errors)
      if (d.status === "success" && d.openclawResult?.errors?.length > 0) inconsistentStatus++;

      // Success sem efeito: não tem resposta inline nem active_message
      if (d.status === "success" && !responseText) successNoEffect++;
    }

    const total = snap.size;
    const emptyPct = Math.round((emptyResponse / total) * 100);
    const neffectPct = Math.round((successNoEffect / total) * 100);

    if (emptyPct > 25) {
      alerts.push(`Regressão: ${emptyPct}% de respostas vazias na última hora`);
      await raiseAlert({
        id:          "pulso-regression-empty-responses",
        name:        "Pulso: Regressão — Respostas vazias",
        description: `${emptyResponse} de ${total} requests completados (${emptyPct}%) retornaram resposta vazia na última hora.\nImpacto: usuário recebe confirmação visual mas sem conteúdo.\nAção: verificar prompt / instruções do worker OpenClaw.`,
        severity:    emptyPct > 50 ? "critical" : "high",
        tags:        ["regression", "empty-response"],
        details:     { emptyResponse, total, emptyPct, inconsistentStatus, successNoEffect },
      });
    } else {
      await resolveAlert("pulso-regression-empty-responses", "pulsoRegressionCheck");
    }

    if (inconsistentStatus > 0) {
      alerts.push(`${inconsistentStatus} requests com status "success" e erros no openclawResult`);
      await raiseAlert({
        id:          "pulso-regression-inconsistent-status",
        name:        "Pulso: Regressão — Status incoerente",
        description: `${inconsistentStatus} requests marcados como "success" contêm erros no openclawResult.\nImpacto: frontend mostra sucesso mas backend registrou falha parcial.`,
        severity:    "medium",
        tags:        ["regression", "status"],
        details:     { inconsistentStatus, total },
      });
    } else {
      await resolveAlert("pulso-regression-inconsistent-status", "pulsoRegressionCheck");
    }

    const report = { total, emptyResponse, emptyPct, inconsistentStatus, successNoEffect, neffectPct, healthy: alerts.length === 0 };
    await logMonitorEvent("pulsoRegressionCheck", { alerts, ...report });
    console.log("[pulsoRegressionCheck]", report);
  }
);

// ─── SISTEMA → RELATÓRIOS TÉCNICOS chat (destino oficial do relatório diário) ──

const RELATORIOS_CONTEXT_ID    = "sistema_relatorios-tecnicos";
const RELATORIOS_AREA_ID       = "area_sistema";
const RELATORIOS_SESSION_KEY   = "agent:main:pulso:sistema_relatorios-tecnicos";

async function ensureRelatoriosSession(): Promise<void> {
  // Disposed of database auto-creation to respect pre-existing active chat
  return;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CRON DIÁRIO — Relatório Técnico de Monitoramento (todos os dias às 9:15 AM SP)
// ═══════════════════════════════════════════════════════════════════════════════
export const pulsoDailyReport = onSchedule(
  {
    schedule: "15 9 * * *",
    timeZone: "America/Sao_Paulo",
    region: "us-central1",
    timeoutSeconds: 120
  },
  async () => {
    currentCronContext = "pulsoDailyReport";
    const now = Date.now();
    const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);

    // 1. Coleta e consolidação de dados das últimas 24h
    // Requests
    const reqsSnap = await db.collection(REQUESTS)
      .where("updatedAt", ">=", oneDayAgo)
      .where("archived", "==", false)
      .get();

    let totalCommands = 0;
    let successCommands = 0;
    let failedCommands = 0;
    let activeMessagesCount = 0;
    const latencies: number[] = [];

    reqsSnap.forEach(doc => {
      const d = doc.data();
      if (d.requestType === "conversation_command") {
        totalCommands++;
        if (d.status === "success") {
          successCommands++;
          const t1 = d.clientCreatedAtMs || toMs(d.requestedAt);
          const t5 = toMs(d.updatedAt);
          if (t1 && t5 && t5 > t1) {
            latencies.push(t5 - t1);
          }
        } else if (["failed", "error", "timeout"].includes(d.status)) {
          failedCommands++;
        }
      } else if (d.requestType === "active_message") {
        activeMessagesCount++;
      }
    });

    // Calcular estatísticas de latência
    const avgLatency = latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0;
    const maxLatency = latencies.length > 0 ? Math.max(...latencies) : 0;

    // Alertas ativos vs. resolvidos nas últimas 24h
    const alertsSnap = await db.collection(ALERTS)
      .where("updatedAt", ">=", oneDayAgo)
      .get();

    let activeAlertsCount = 0;
    let resolvedAlertsCount = 0;
    const alertSamples: string[] = [];

    alertsSnap.forEach(doc => {
      const d = doc.data();
      if (d.status === "open") {
        activeAlertsCount++;
        alertSamples.push(`🔴 ${d.name} (${d.severity})`);
      } else {
        resolvedAlertsCount++;
      }
    });

    // 2. Construção do Report em Markdown
    const title = "📊 Relatório Diário de Saúde Operacional";
    const tsStr = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

    const reportText =
      `# ${title}\n` +
      `📅 **Data:** ${tsStr.split(",")[0]} às ${tsStr.split(",")[1].trim()} (Horário de Brasília)\n` +
      `\n` +
      `### 1. Panorama Geral\n` +
      `*   **Estado Operacional:** ${activeAlertsCount > 0 ? "⚠️ ATENÇÃO - Incidentes em aberto" : "✅ NORMALIDADE - Sem alertas ativos"}\n` +
      `*   **Mensagens Ativas:** ${activeAlertsCount} aberta(s) / ${resolvedAlertsCount} resolvida(s) nas últimas 24h.\n` +
      `\n` +
      `### 2. Principais Números e Sinais (Últimas 24h)\n` +
      `*   **Total de Comandos:** \`${totalCommands}\` executados\n` +
      `*   **Taxa de Sucesso:** \`${totalCommands > 0 ? Math.round((successCommands / totalCommands) * 100) : 100}%\` (${successCommands} OK / ${failedCommands} Falhas)\n` +
      `*   **Respostas Ativas Enviadas:** \`${activeMessagesCount}\` no total\n` +
      `*   **Latência Média (ponta a ponta):** \`${(avgLatency / 1000).toFixed(2)}s\` (Máxima: \`${(maxLatency / 1000).toFixed(2)}s\`)\n` +
      `\n` +
      `### 3. Diagnóstico e Sincronização\n` +
      `*   **Sincronização Backend-Front:** ${successCommands === activeMessagesCount ? "100% íntegra (sem perda de emparelhamento)" : "Leve divergência de contagem"}\n` +
      `*   **Erros / Regressões:** ${failedCommands > 0 ? `⚠️ ${failedCommands} comandos falharam. Verifique os logs de regressão.` : "0 regressões críticas detectadas"}\n` +
      `\n` +
      `### 4. Pontos que Merecem Atenção\n` +
      (alertSamples.length > 0
        ? `Existem incidentes não resolvidos no painel:\n${alertSamples.map(s => `*   ${s}`).join("\n")}`
        : `*   Nenhum ponto crítico pendente. A infraestrutura operacional do Pulso está estável.`) +
      `\n\n` +
      `*Relatório gerado automaticamente por pulso-monitor.*`;

    // 3. Enviar para a Coleção de Requests como active_message para visualização do chat
    try {
      await ensureRelatoriosSession();

      const serverNow = FieldValue.serverTimestamp();
      await db.collection(REQUESTS).add({
        requestType:       "active_message",
        status:            "success",
        contextId:         RELATORIOS_CONTEXT_ID,
        areaId:            RELATORIOS_AREA_ID,
        openclawSessionKey: RELATORIOS_SESSION_KEY,
        archived:          false,
        openclawResult: {
          responseText: reportText,
          processedBy:  "pulso-monitor-daily",
          processedAt:  new Date().toISOString(),
          summary:      "Relatório Diário de Saúde Operacional",
        },
        meta: {
          originCron: "pulsoDailyReport",
          reportType: "daily",
        },
        requestedAt: serverNow,
        createdAt:   serverNow,
        updatedAt:   serverNow,
      });

      // Registrar logs de execução
      await logMonitorEvent("pulsoDailyReport", {
        status: "success",
        totalCommands,
        successCommands,
        failedCommands,
        activeMessagesCount,
        avgLatencyMs: avgLatency,
        activeAlertsCount,
      });

      console.log("[pulsoDailyReport] Relatório diário emitido com sucesso.");
    } catch (err) {
      console.error("[pulsoDailyReport] Erro ao salvar relatório no chat:", err);
    }
  }
);
