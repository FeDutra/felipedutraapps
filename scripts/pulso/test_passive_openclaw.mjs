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
  console.log("Autenticando no Firebase para teste PASSIVO...");
  const auth = getAuth(app);
  await signInAnonymously(auth);

  console.log("Inserindo requisição passiva: PULSO_PASSIVO_TESTE_001");
  const payload = {
    requestType: "conversation_command",
    status: "queued_for_openclaw",
    source: "pulso_live",
    origin: "lotus_live",
    mode: "text",
    input: "PULSO_PASSIVO_TESTE_001",
    rawInput: "PULSO_PASSIVO_TESTE_001",
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
  console.log(`✅ Documento passivo criado! ID: ${docRef.id}`);
  
  process.exit(0);
}

main().catch(console.error);
