import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, doc, onSnapshot } from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";
import fs from "fs";
import path from "path";

const envPath = path.resolve(process.cwd(), ".env.local");
const envVars = {};
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, "utf-8").split("\n").forEach((line) => {
    const idx = line.indexOf("=");
    if (idx > 0) {
      envVars[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
    }
  });
}

const firebaseConfig = {
  apiKey: envVars.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: envVars.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: envVars.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: envVars.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: envVars.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: envVars.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const WORKSPACE_ID = envVars.NEXT_PUBLIC_PULSO_WORKSPACE_ID || "felipe_dutra";
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const REQUESTS_COL = `workspaces/${WORKSPACE_ID}/pulso_requests`;

async function main() {
  console.log("Autenticando no Firebase para testar o backend REAL...");
  const auth = getAuth(app);
  await signInAnonymously(auth);

  console.log("Inserindo requisição UI REAL...");
  const payload = {
    requestType: "conversation_command",
    status: "queued_for_openclaw",
    source: "pulso_live",
    mode: "text",
    input: "PULSO_PASSIVO_UI_REAL_001 Responda exatamente: PASSIVO_UI_REAL_OK_001",
    rawInput: "PULSO_PASSIVO_UI_REAL_001 Responda exatamente: PASSIVO_UI_REAL_OK_001",
    requestedBy: "felipe_dutra",
    requestedAt: new Date(),
    clientCreatedAtMs: Date.now(),
    updatedAt: new Date(),
    archived: false,
    priority: "medium",
    handoff: {
        target: "openclaw",
        mode: "proposal_only"
    }
  };

  const colRef = collection(db, REQUESTS_COL);
  const docRef = await addDoc(colRef, payload);
  console.log(`✅ Documento criado! ID: ${docRef.id}`);
  console.log(`Aguardando resposta do OpenClaw REAL...`);
  
  let unsubscribe;
  
  const timeoutId = setTimeout(() => {
    console.log("❌ Timeout: O backend real não respondeu em 30 segundos.");
    if (unsubscribe) unsubscribe();
    process.exit(1);
  }, 30000);

  unsubscribe = onSnapshot(doc(db, REQUESTS_COL, docRef.id), (snap) => {
    if (!snap.exists()) return;
    const data = snap.data();
    if (data.status !== "queued_for_openclaw" && data.status !== "processing_by_openclaw") {
       clearTimeout(timeoutId);
       console.log("🎉 Resposta recebida do OpenClaw Real!");
       console.log("Status final:", data.status);
       const responseText = data.openclawResult?.responseText || data.openclawResponse || null;
       console.log("Resposta Textual (Fallback resolvido):", responseText);
       process.exit(0);
    }
  });
}

main().catch(console.error);
