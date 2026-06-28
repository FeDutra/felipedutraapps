/**
 * queue-monitor.mjs
 * -------------------
 * Health monitor and auto-recovery script for the PULSO OpenClaw request queue.
 *
 * Checks for requests stuck in 'queued_for_openclaw' for more than 3 minutes.
 * If found:
 *   1. Prints a warning alert.
 *   2. Automatically spawns openclaw-bridge.mjs to process the queue.
 *   3. Inserts a 'create_alert' request into Firestore so it surfaces in the PULSO dashboard.
 *
 * Usage:
 *   node scripts/pulso/queue-monitor.mjs
 */

import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, addDoc, query, orderBy, limit } from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";
import { fork } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

async function main() {
  console.log("🔍 [Monitor] Verificando integridade da fila PULSO...");
  
  try {
    const auth = getAuth(app);
    await signInAnonymously(auth);

    const colRef = collection(db, REQUESTS_COL);
    const q = query(colRef, orderBy("requestedAt", "desc"), limit(100));
    const snap = await getDocs(q);

    const now = Date.now();
    const STUCK_THRESHOLD_MS = 3 * 60 * 1000; // 3 minutes

    const stuckRequests = [];
    
    snap.docs.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.status === "queued_for_openclaw") {
        const requestedAtMs = data.requestedAt?.toMillis ? data.requestedAt.toMillis() : new Date(data.requestedAt).getTime();
        if (now - requestedAtMs > STUCK_THRESHOLD_MS) {
          stuckRequests.push({ id: docSnap.id, ...data, ageMinutes: Math.round((now - requestedAtMs) / 60000) });
        }
      }
    });

    if (stuckRequests.length === 0) {
      console.log("✅ [Monitor] Fila saudável. Nenhuma requisição travada encontrada.");
      process.exit(0);
    }

    console.warn(`⚠️ [Monitor] ALERTA: Detectadas ${stuckRequests.length} requisições travadas na fila!`);
    stuckRequests.forEach(req => {
      console.warn(`   - Request ID: ${req.id} (status: ${req.status}, aguardando há ${req.ageMinutes} min)`);
    });

    // 1. Trigger local bridge auto-start / restart
    console.log("🚀 [Monitor] Iniciando auto-recovery: disparando openclaw-bridge.mjs...");
    const bridgePath = path.resolve(__dirname, "openclaw-bridge.mjs");
    
    const bridgeProcess = fork(bridgePath);
    
    bridgeProcess.on("exit", (code) => {
      console.log(`🏁 [Monitor] Auto-recovery: openclaw-bridge.mjs finalizado com código ${code}`);
    });

    // 2. Emit alert payload to PULSO dashboard via requests/alerts collection
    console.log("📢 [Monitor] Registrando alerta no painel PULSO...");
    const alertPayload = {
      requestType: "create_alert",
      status: "requested",
      requestedBy: "queue_monitor",
      requestedAt: new Date(),
      updatedAt: new Date(),
      archived: false,
      priority: "high",
      title: "Fila do OpenClaw Parada Detectada",
      summary: `O monitor automático detectou ${stuckRequests.length} requisições travadas na fila e acionou a contingência.`,
      payload: {
        title: "Fila do OpenClaw Parada",
        description: `O monitor detectou requests aguardando há mais de 3 minutos. O bridge local foi reiniciado automaticamente para limpar a fila.`,
        severity: "warning",
        timestamp: new Date().toISOString()
      }
    };

    const docRef = await addDoc(colRef, alertPayload);
    console.log(`✅ [Monitor] Alerta de fila parada enviado ao PULSO! ID do Alerta: ${docRef.id}`);

    process.exit(0);
  } catch (err) {
    console.error("❌ [Monitor] Erro na execução do monitor:", err.message);
    process.exit(1);
  }
}

main();
