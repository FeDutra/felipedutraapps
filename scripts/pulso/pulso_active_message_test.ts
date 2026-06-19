import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc } from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";
import fs from "fs";
import path from "path";

const envPath = path.resolve(process.cwd(), ".env.local");
const envVars: any = {};
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
  console.log("Autenticando no Firebase para enviar MENSAGEM ATIVA...");
  const auth = getAuth(app);
  await signInAnonymously(auth);

  console.log("Inserindo mensagem ativa no Firestore...");
  const payload = {
    requestType: "active_message",
    source: "openclaw_active",
    sender: "lotus",
    conversationId: "conv_live",
    message: "PULSO_ATIVO_TESTE_001 — mensagem ativa vinda da Lótus para a PULSO.",
    status: "delivered_to_pulso",
    requestedAt: new Date(),
    clientCreatedAtMs: Date.now(),
    updatedAt: new Date(),
    archived: false,
    deliveryMode: "text",
    requiresUserAction: false
  };

  const colRef = collection(db, REQUESTS_COL);
  const docRef = await addDoc(colRef, payload);
  console.log(`✅ Documento de mensagem ativa criado! ID: ${docRef.id}`);
  console.log(`Acesse a interface e verifique se a Lótus iniciou a conversa com:`);
  console.log(`"${payload.message}"`);
  
  process.exit(0);
}

main().catch(console.error);
