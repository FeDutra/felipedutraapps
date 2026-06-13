/**
 * openclaw-bridge.mjs
 * -------------------
 * Lótus Live v2.0 — Asynchronous OpenClaw local queue bridge.
 *
 * Reads requests with status 'queued_for_openclaw' from Firestore,
 * transitions them to 'processing_by_openclaw', processes them,
 * and writes back the openclawResult before setting the final status.
 *
 * Usage:
 *   node scripts/pulso/openclaw-bridge.mjs
 */

import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, updateDoc, query, orderBy, limit, Timestamp } from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";
import fs from "fs";
import path from "path";

// ─── ENV ────────────────────────────────────────────────────────────────────
const envPath = path.resolve(process.cwd(), ".env.local");
if (!fs.existsSync(envPath)) {
  console.error("❌ .env.local não encontrado. Crie o arquivo com as credenciais Firebase.");
  process.exit(1);
}

const envVars = {};
fs.readFileSync(envPath, "utf-8")
  .split("\n")
  .forEach((line) => {
    const idx = line.indexOf("=");
    if (idx > 0) {
      const key = line.slice(0, idx).trim();
      const val = line.slice(idx + 1).trim();
      envVars[key] = val;
    }
  });

const firebaseConfig = {
  apiKey: envVars.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: envVars.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: envVars.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: envVars.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: envVars.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: envVars.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const WORKSPACE_ID = envVars.NEXT_PUBLIC_PULSO_WORKSPACE_ID || "felipe_dutra";

// ─── FIREBASE ────────────────────────────────────────────────────────────────
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const BASE_PATH = `workspaces/${WORKSPACE_ID}`;
const REQUESTS_COL = `${BASE_PATH}/pulso_requests`;

// ─── PROCESSOR ───────────────────────────────────────────────────────────────
async function processRequest(docSnap) {
  const requestId = docSnap.id;
  const docRef = doc(db, REQUESTS_COL, requestId);
  const data = docSnap.data();

  console.log(`\n────────────────────────────────────────────────────────────`);
  console.log(`⚙️  Processando Request ID: ${requestId}`);
  console.log(`💬 Input: "${data.input}"`);

  try {
    // Step 1: transition status to processing_by_openclaw
    console.log(`⏳ Alterando status para 'processing_by_openclaw'...`);
    await updateDoc(docRef, {
      status: "processing_by_openclaw",
      updatedAt: Timestamp.now()
    });

    // Simulated local delay (simulate cérebro pensando)
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Step 2: Call local adapter or return fallback error
    console.log(`🧠 Invocando cérebro Lótus/OpenClaw...`);
    
    // As per user directives, if not configured, return honest fallback error
    const openclawResult = {
      status: "error",
      intent: "unknown",
      responseText: "A Lótus/OpenClaw ainda não possui comando local configurado neste bridge. O request foi recebido e o contrato está pronto.",
      summary: "Falha de configuração do bridge local",
      confidence: "high",
      riskLevel: "low",
      requiresHumanApproval: false,
      canExecuteNow: false,
      needsClarification: false,
      blockedReason: null,
      links: [],
      actions: [],
      sourcesConsulted: [],
      proposedMutation: null,
      error: "OPENCLAW_BRIDGE_NOT_CONFIGURED",
      processedBy: "openclaw",
      processedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    // Step 3: Write openclawResult and transition status to 'error' (final status)
    console.log(`💾 Gravando openclawResult e atualizando status para 'error'...`);
    await updateDoc(docRef, {
      openclawResult,
      status: "error",
      updatedAt: Timestamp.now()
    });

    console.log(`✅ Concluído com sucesso.`);
  } catch (err) {
    console.error(`❌ Erro ao processar request ${requestId}:`, err.message);
  }
}

// ─── MAIN ────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`🔍 Conectando ao projeto Firebase: ${firebaseConfig.projectId}`);
  console.log(`📂 Workspace: ${WORKSPACE_ID}`);
  console.log(`📋 Escutando por requests em 'queued_for_openclaw'...\n`);

  try {
    const auth = getAuth(app);
    await signInAnonymously(auth);
    
    const colRef = collection(db, REQUESTS_COL);
    const q = query(colRef, orderBy("requestedAt", "desc"), limit(100));
    const snap = await getDocs(q);

    const pending = snap.docs.filter(docSnap => docSnap.data().status === "queued_for_openclaw");

    if (pending.length === 0) {
      console.log("✅ Fila vazia — nenhum request pendente em 'queued_for_openclaw'.");
      process.exit(0);
    }

    console.log(`📦 Encontrados ${pending.length} request(s) pendente(s).`);

    for (const docSnap of pending) {
      await processRequest(docSnap);
    }

    console.log(`\n🏁 Todos os requests da fila foram processados.`);
    process.exit(0);
  } catch (err) {
    console.error("❌ Erro no bridge local:", err.message);
    process.exit(1);
  }
}

main();
