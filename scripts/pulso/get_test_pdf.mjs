import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc } from "firebase/firestore";
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

  const docId = "Tyi11DkDrSQ3PgU123eX";
  console.log(`Buscando dados completos de: ${docId}`);
  const docRef = doc(db, REQUESTS_COL, docId);
  const snap = await getDoc(docRef);

  if (snap.exists()) {
    console.log(JSON.stringify(snap.data(), null, 2));
  } else {
    console.log("Documento não encontrado!");
  }
  process.exit(0);
}

main().catch(console.error);
