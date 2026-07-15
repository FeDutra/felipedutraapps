import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, query, orderBy, limit } from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";
import fs from "fs";
import path from "path";

const envPath = path.resolve(process.cwd(), ".env");
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

  console.log("Listando todas as requisições de hoje...");
  const colRef = collection(db, REQUESTS_COL);
  const snap = await getDocs(colRef);

  let count = 0;
  snap.forEach(docSnap => {
    const data = docSnap.data();
    let isToday = false;
    
    if (data.createdAt) {
      const date = data.createdAt.toDate ? data.createdAt.toDate() : new Date(data.createdAt);
      if (date.toISOString().startsWith("2026-07-13")) {
        isToday = true;
      }
    }

    if (isToday) {
      count++;
      console.log("=========================================");
      console.log(`Document ID: ${docSnap.id}`);
      console.log(`requestType: ${data.requestType}`);
      console.log(`status: ${data.status}`);
      console.log(`createdAt:`, data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt);
      console.log(`updatedAt:`, data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : data.updatedAt);
      console.log(`text/message:`, data.text || data.message || data.input || data.rawInput);
      console.log(`openclawResult:`, JSON.stringify(data.openclawResult, null, 2));
      console.log(`attachments:`, JSON.stringify(data.attachments, null, 2));
    }
  });

  console.log(`Busca finalizada. Encontrados ${count} documentos hoje.`);
  process.exit(0);
}

main().catch(console.error);
