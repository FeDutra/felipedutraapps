import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import fs from "fs";
import path from "path";

// Read .env.local
const envPath = path.resolve(process.cwd(), ".env.local");
if (!fs.existsSync(envPath)) {
  console.error("❌ .env.local not found!");
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, "utf-8");
const envVars = {};
envContent.split("\n").forEach(line => {
  const parts = line.split("=");
  if (parts.length >= 2) {
    const key = parts[0].trim();
    const val = parts.slice(1).join("=").trim();
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
const BASE_PATH = `workspaces/${WORKSPACE_ID}`;

console.log("🔥 Initializing Firebase with Project ID:", firebaseConfig.projectId);
console.log("📂 Workspace Base Path:", BASE_PATH);

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const COLLECTIONS = [
  "pulso_tasks",
  "pulso_projects",
  "pulso_areas",
  "pulso_people",
  "pulso_agents",
  "pulso_requests",
  "pulso_decisions",
  "pulso_alerts",
  "pulso_sources",
  "pulso_routines"
];

async function runAudit() {
  const dump = {};

  for (const colName of COLLECTIONS) {
    const fullPath = `${BASE_PATH}/${colName}`;
    console.log(`📡 Fetching collection: ${fullPath}...`);
    try {
      const colRef = collection(db, fullPath);
      const snap = await getDocs(colRef);
      dump[colName] = snap.docs.map(doc => {
        const data = doc.data();
        // Convert Timestamp objects to string timestamps
        Object.keys(data).forEach(key => {
          if (data[key] && typeof data[key] === "object" && data[key].seconds !== undefined) {
            data[key] = new Date(data[key].seconds * 1000).toISOString();
          }
        });
        return {
          id: doc.id,
          ...data
        };
      });
      console.log(`✅ Fetched ${dump[colName].length} items from ${colName}`);
    } catch (err) {
      console.error(`❌ Failed to fetch ${colName}:`, err.message);
      dump[colName] = [];
    }
  }

  const outputPath = path.resolve(process.cwd(), "scripts/pulso/audit_dump.json");
  fs.writeFileSync(outputPath, JSON.stringify(dump, null, 2), "utf-8");
  console.log(`\n🎉 Audit dump written to: ${outputPath}`);
}

runAudit().catch(err => {
  console.error("🔥 Global execution error:", err);
  process.exit(1);
});
