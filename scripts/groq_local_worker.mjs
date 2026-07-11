#!/usr/bin/env node
// scripts/groq_local_worker.mjs
// Worker local do Mac para o canal sistema_groq → Groq API (LLaMA 3.3 70B)
// Roda em paralelo ao worker da VPS sem conflito algum.
// Uso: node scripts/groq_local_worker.mjs

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// ── Config ──────────────────────────────────────────
const SERVICE_ACCOUNT_PATH = '/Users/felipedutra/.gemini/antigravity/firebase-pulso-service-account.json';
// Chave Groq: defina GROQ_API_KEY no ambiente ou salve em ~/.pulso/secrets/groq_api_key
function loadGroqKey() {
  if (process.env.GROQ_API_KEY) return process.env.GROQ_API_KEY;
  try {
    return readFileSync(`${process.env.HOME}/.pulso/secrets/groq_api_key`, 'utf8').trim();
  } catch { return ''; }
}
const GROQ_API_KEY = loadGroqKey();
const GROQ_MODEL    = 'llama-3.3-70b-versatile';
const GROQ_API_URL  = 'https://api.groq.com/openai/v1/chat/completions';
const WORKSPACE_ID  = 'felipe_dutra';
const GROQ_SESSIONS = new Set(['sistema_groq']);
const POLL_INTERVAL = 1500; // ms

const SYSTEM_PROMPT = `Você é Lótus, assistente cognitivo da PULSO — sistema de gestão de vida e operação do Felipe Dutra.

Você é precisa, direta, calorosa e estratégica. Você conhece o contexto operacional do Felipe: projetos Eden Terra, família, finanças, construção, despertar, MODU.

Responda sempre em português brasileiro. Seja concisa e útil.
Este canal usa Groq / LLaMA 3.3 70B (modelo alternativo em teste).`;

// ── Firebase ─────────────────────────────────────────
const serviceAccount = JSON.parse(readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const requestsCol = () =>
  db.collection('workspaces').doc(WORKSPACE_ID).collection('pulso_requests');

const sessionsCol = () =>
  db.collection('workspaces').doc(WORKSPACE_ID).collection('pulso_sessions');

// ── Groq ─────────────────────────────────────────────
async function callGroq(input, contextWindow = []) {
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...contextWindow
      .filter(m => m?.role && (m?.content || m?.text))
      .map(m => ({ role: m.role, content: m.content || m.text })),
    { role: 'user', content: input },
  ];

  const res = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({ model: GROQ_MODEL, messages, temperature: 0.7, max_tokens: 2048 }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GROQ_HTTP_${res.status}: ${err.slice(0, 200)}`);
  }

  const data = await res.json();
  return data.choices[0].message.content;
}

// ── Bootstrap: marca sistema_groq como ready no Firestore ──
async function ensureGroqSessionsReady() {
  for (const sessId of GROQ_SESSIONS) {
    const ref = sessionsCol().doc(sessId);
    const snap = await ref.get();
    const status = snap.exists ? snap.data()?.runtimeStatus : null;

    if (!snap.exists) {
      await ref.set({
        id: sessId, chatId: sessId, areaId: 'area_sistema',
        openclawSessionKey: `agent:groq:${sessId}`,
        runtimeStatus: 'ready', bootstrapVersion: '1.0.0',
        fallbackAllowed: false, errorMessage: null,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      console.log(`[GROQ-WORKER] ✅ Sessão ${sessId} criada como ready.`);
    } else if (['pending', 'bootstrapping', 'error'].includes(status)) {
      await ref.update({ runtimeStatus: 'ready', errorMessage: null, updatedAt: FieldValue.serverTimestamp() });
      console.log(`[GROQ-WORKER] ✅ Sessão ${sessId} atualizada para ready (era: ${status}).`);
    } else {
      console.log(`[GROQ-WORKER] Sessão ${sessId} já está ${status}.`);
    }
  }
}

// ── Loop principal ────────────────────────────────────
async function processNext() {
  const snap = await requestsCol()
    .where('status', '==', 'queued_for_openclaw')
    .limit(10)
    .get();

  for (const doc of snap.docs) {
    const data   = doc.data();
    const ctxId  = data.contextId || data.conversationId || '';

    if (!GROQ_SESSIONS.has(ctxId)) continue;

    const input = (data.input || data.message || data.text || '').trim();
    if (!input) continue;

    // Verifica lock
    const lockExp = data.lockExpiresAt?.toDate?.();
    if (lockExp && lockExp > new Date()) continue;

    console.log(`[GROQ-WORKER] Processando ${doc.id} → "${input.slice(0, 60)}..."`);

    await doc.ref.update({
      lockOwner:     'groq_local_worker_mac',
      lockExpiresAt: new Date(Date.now() + 180_000),
    });

    try {
      const responseText = await callGroq(input, data.contextWindow || []);

      await doc.ref.update({
        status:         'success',
        openclawResult: {
          status:       'success',
          responseText,
          model:        GROQ_MODEL,
          provider:     'groq',
        },
        updatedAt:      FieldValue.serverTimestamp(),
        lockOwner:      FieldValue.delete(),
        lockExpiresAt:  FieldValue.delete(),
      });

      console.log(`[GROQ-WORKER] ✅ ${doc.id} → success`);
    } catch (err) {
      console.error(`[GROQ-WORKER] ❌ ${doc.id}: ${err.message}`);
      await doc.ref.update({
        status:         'error',
        openclawResult: {
          status:       'error',
          responseText: `[Lótus via Groq] Erro: ${err.message}`,
          error:        err.message,
        },
        updatedAt:      FieldValue.serverTimestamp(),
        lockOwner:      FieldValue.delete(),
        lockExpiresAt:  FieldValue.delete(),
      });
    }
  }
}

async function main() {
  console.log('╔════════════════════════════════════════╗');
  console.log('║   PULSO — Groq Local Worker (Mac)      ║');
  console.log(`║   Modelo: ${GROQ_MODEL}  ║`);
  console.log(`║   Sessões: ${[...GROQ_SESSIONS].join(', ')}         ║`);
  console.log('╚════════════════════════════════════════╝');

  await ensureGroqSessionsReady();
  console.log('[GROQ-WORKER] Aguardando requests...\n');

  while (true) {
    try {
      await processNext();
    } catch (err) {
      console.error(`[GROQ-WORKER] Erro no loop: ${err.message}`);
    }
    await new Promise(r => setTimeout(r, POLL_INTERVAL));
  }
}

main().catch(err => {
  console.error('[GROQ-WORKER] Fatal:', err);
  process.exit(1);
});
