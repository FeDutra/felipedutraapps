import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, getDocs, query, where } from "firebase/firestore";
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
  console.log("Autenticando...");
  const auth = getAuth(app);
  await signInAnonymously(auth);

  console.log("Criando documento PULSO_ATIVO_UI_002 sem o campo 'archived' explícito...");
  const colRef = collection(db, REQUESTS_COL);
  const docRef = await addDoc(colRef, {
    requestType: "active_message",
    type: "active_message",
    source: "pulso_active_simulator",
    sender: "lotus",
    status: "success",
    message: "PULSO_ATIVO_UI_002 — mensagem ativa textual da Lótus para a PULSO, com anexo.",
    text: "PULSO_ATIVO_UI_002 — mensagem ativa textual da Lótus para a PULSO, com anexo.",
    attachments: [
      {
        id: "att-simulated-123",
        name: "relatorio_teste.pdf",
        mimeType: "application/pdf",
        url: "https://example.com/relatorio_teste.pdf",
        sizeBytes: 1048576,
        createdAt: new Date().toISOString()
      }
    ],
    createdAt: new Date(),
    updatedAt: new Date()
  });

  console.log("✅ Documento criado: " + docRef.id);
  
  console.log("Executando a mesma Query do Listener do LivePage.tsx...");
  const q = query(
    collection(db, REQUESTS_COL),
    where("requestType", "in", ["conversation_command", "active_message"])
  );
  
  const snap = await getDocs(q);
  let found1 = false;
  let found2 = false;
  
  snap.forEach(docSnap => {
    const data = docSnap.data();
    if (data.archived === true) return; // Filtro em memória como no LivePage
    
    if (docSnap.id === "nj6wcuWw4PcP890t3Sfd") {
        found1 = true;
        console.log("🔥 Encontrado nj6wcuWw4PcP890t3Sfd!");
    }
    if (docSnap.id === docRef.id) {
        found2 = true;
        console.log(`🔥 Encontrado o novo doc ${docRef.id}!`);
        
        // Simular o mapeamento do LivePage.tsx
        const responseText = data.openclawResult?.responseText ?? data.openclawResponse ?? null;
        const replyText = data.message ?? data.text ?? responseText ?? '';
        console.log("📝 Texto Mapeado: " + replyText);
    }
  });

  console.log(`Teste nj6wcuWw4PcP890t3Sfd: ${found1 ? "PASSOU" : "FALHOU"}`);
  console.log(`Teste Novo Doc: ${found2 ? "PASSOU" : "FALHOU"}`);
  process.exit(0);
}

main().catch(console.error);
