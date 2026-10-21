import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { chmodSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildLegacySnapshot } from "./lib/pulso-legacy-snapshot.mjs";

const outputArg = process.argv[2];
if (!outputArg) throw new Error("usage: node scripts/export-pulso-legacy-snapshot.mjs <private-output.json>");
const projectId = process.env.PULSO_FIREBASE_PROJECT_ID || "felipedutraapps";
const workspaceId = process.env.PULSO_WORKSPACE_ID || "felipe_dutra";
const exportedAt = new Date().toISOString();
if (getApps().length === 0) initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore();
const base = db.collection("workspaces").doc(workspaceId);
const [areas, sessions, customContexts, requests] = await Promise.all([
  base.collection("pulso_areas").get(),
  base.collection("pulso_sessions").get(),
  base.collection("pulso_custom_contexts").get(),
  base.collection("pulso_requests").get()
]);
const result = buildLegacySnapshot({
  projectId,
  workspaceId,
  exportedAt,
  areaDocs: areas.docs.map(doc => ({ id: doc.id, data: doc.data() })),
  sessionDocs: sessions.docs.map(doc => ({ id: doc.id, data: doc.data() })),
  customContextDocs: customContexts.docs.map(doc => ({ id: doc.id, data: doc.data() })),
  requestDocs: requests.docs.map(doc => ({ id: doc.id, data: doc.data() }))
});
const output = resolve(outputArg);
writeFileSync(output, JSON.stringify(result, null, 2) + "\n", { mode: 0o600 });
chmodSync(output, 0o600);
console.log(JSON.stringify({ output, ...result.report.migratedCounts, skippedSessions: result.report.skippedSessions.length, skippedRequests: result.report.skippedRequests.length }));
