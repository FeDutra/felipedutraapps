/**
 * openclaw-next.mjs
 * ------------------
 * Lótus Live v1.6 — Fila Operacional OpenClaw
 *
 * Localiza o próximo request elegível na fila OpenClaw e imprime
 * o pacote operacional completo no stdout, pronto para ser consumido
 * pela OpenClaw.
 *
 * Uso:
 *   node scripts/pulso/openclaw-next.mjs
 *   node scripts/pulso/openclaw-next.mjs --all         (lista todos, não só o primeiro)
 *   node scripts/pulso/openclaw-next.mjs --limit 5     (limite customizado)
 *
 * Segurança:
 *   - Lê credenciais do .env.local (nunca hardcoded)
 *   - Opera em modo READ-ONLY — zero mutações no banco
 *   - Nunca executa propostas
 *   - Nunca cria entidades
 *   - Nunca envia mensagens externas
 */

import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, query, where, orderBy, limit } from "firebase/firestore";
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

// ─── ARGS ────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const showAll = args.includes("--all");
const limitIdx = args.indexOf("--limit");
const maxResults = limitIdx >= 0 ? parseInt(args[limitIdx + 1], 10) || 5 : 1;

// ─── FIREBASE ────────────────────────────────────────────────────────────────
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const BASE_PATH = `workspaces/${WORKSPACE_ID}`;
const REQUESTS_COL = `${BASE_PATH}/pulso_requests`;

// ─── ELIGIBILITY CRITERIA ────────────────────────────────────────────────────
const ELIGIBLE_STATUSES = new Set(["requested", "queued_for_openclaw"]);

function isEligible(doc) {
  const d = doc.data();
  if (d.archived === true) return false;
  if (!ELIGIBLE_STATUSES.has(d.status)) return false;
  if (d.requestType !== "conversation_command") return false;
  if (d.origin !== "lotus_live" && d.origin !== "lotus_live") return false;
  
  const interpretation = d.interpretation || {};
  const handoff = d.handoff || interpretation?.handoff || null;
  if (!handoff) return false;
  if (handoff.target !== "openclaw") return false;
  if (handoff.mode !== "proposal_only" && handoff.canExecuteNow !== false) return false;

  return true;
}

// ─── PACKAGE BUILDER ─────────────────────────────────────────────────────────
function buildPackage(doc) {
  const d = doc.data();
  const requestId = doc.id;

  const interpretation = d.interpretation || {};
  const handoff = d.handoff || interpretation?.handoff || null;

  return {
    requestId: requestId,
    title: d.title || "",
    summary: d.summary || "",
    interpretation: interpretation,
    handoff: handoff
      ? {
          target: handoff.target,
          mode: handoff.mode,
          canExecuteNow: false, // sempre false — segurança obrigatória
          requiresHumanConfirmation: handoff.requiresHumanConfirmation,
          intent: handoff.intent,
          domain: handoff.domain,
          riskLevel: handoff.riskLevel,
          actionType: handoff.actionType,
          entitiesMentioned: handoff.entitiesMentioned || [],
          suggestedNextStep: handoff.suggestedNextStep,
          executionPrompt: handoff.executionPrompt,
        }
      : null,
    executionPrompt: handoff?.executionPrompt || "",
    attachments: (d.attachments || []).map((a: any) => ({
      artifactId: a.id || a.artifactId,
      name: a.name,
      mimeType: a.mimeType,
      sizeBytes: a.sizeBytes || 0,
      summary: a.summary || "",
      keyExcerpts: a.keyExcerpts || [],
      sectionIndex: a.sectionIndex || [],
      textExtracted: a.textExtracted || "",
      availableToLotus: a.availableToLotus ?? false,
      includedInline: a.includedInline ?? false,
      fullTextDeferred: a.fullTextDeferred ?? false,
      extractionMode: a.extractionMode || "none",
      url: a.url || "",
      downloadUrl: a.downloadUrl || a.url || "",
      publicUrl: a.publicUrl || a.url || "",
      storagePath: a.storagePath || ""
    })),
    mediaPath: d.mediaPath || "",
    mediaType: d.mediaType || "",
    mediaFileName: d.mediaFileName || "",
    sourcesNeeded: interpretation?.sourcesNeeded || [],
    entitiesMentioned: handoff?.entitiesMentioned || [],
    riskLevel: handoff?.riskLevel || interpretation?.riskLevel || "low",
    requiresHumanApproval: handoff?.requiresHumanConfirmation ?? interpretation?.requiresConfirmation ?? true,
    meta: {
      version: "v1.9",
      generatedAt: new Date().toISOString(),
      generator: "openclaw-next.mjs",
      mode: "proposal_only",
      securityConstraints: {
        canExecuteNow: false,
        noDirectMutations: true,
        noExternalMessages: true,
        noTaskCreation: true,
        noProjectCreation: true,
        noPersonCreation: true,
        responseTarget: `workspaces/${WORKSPACE_ID}/pulso_requests/${requestId}`,
        responseField: "openclawResult",
        onlyAllowedActions: ["read", "create_proposal", "update_proposal"],
      },
    },
    responseSchema: {
      processedBy: "openclaw",
      processedAt: "<ISO string>",
      createdAt: "<ISO string>",
      responseText: "<string: resposta em linguagem natural>",
      summary: "<string: resumo de 1 linha opcional>",
      confidence: "<high | medium | low>",
      riskLevel: "<low | medium | high>",
      requiresHumanApproval: "<boolean>",
      sourcesConsulted: ["<array de strings>"],
      proposedActions: [
        {
          label: "<string: descrição da ação>",
          description: "<string: detalhe opcional>",
          riskLevel: "<low | medium | high>",
          requiresConfirmation: "<boolean>",
        },
      ],
      proposedMutation: null,
      errors: [],
      auditLog: {
        model: "<string>",
        skillUsed: "<string>",
        confidence: "<high | medium | low>",
        notes: "<string>",
      },
      statusTransition: "proposal_ready | waiting_user_approval | openclaw_failed",
    },
  };
}

// ─── MAIN ────────────────────────────────────────────────────────────────────
async function main() {
  console.error(`🔍 Conectando ao projeto Firebase: ${firebaseConfig.projectId}`);
  console.error(`📂 Workspace: ${WORKSPACE_ID}`);
  console.error(`📋 Coletando fila OpenClaw (status: requested | queued_for_openclaw)...\n`);

  try {
    // Authenticate anonymously first
    const auth = getAuth(app);
    await signInAnonymously(auth);
    
    const colRef = collection(db, REQUESTS_COL);
    // Fetch a window — local filtering handles the rest (avoids composite index)
    const q = query(colRef, orderBy("requestedAt", "desc"), limit(100));
    const snap = await getDocs(q);

    const eligible = snap.docs.filter(isEligible);

    if (eligible.length === 0) {
      console.error("✅ Fila vazia — nenhum request elegível para OpenClaw no momento.");
      process.exit(0);
    }

    const toShow = showAll ? eligible : eligible.slice(0, maxResults);

    console.error(`📦 ${eligible.length} request(s) elegível(eis). Exibindo ${toShow.length}.\n`);
    console.error("─".repeat(60));

    if (toShow.length === 1) {
      // Single package — print directly as JSON to stdout (pipeable)
      console.log(JSON.stringify(buildPackage(toShow[0]), null, 2));
    } else {
      // Multiple packages — wrap in array
      console.log(JSON.stringify(toShow.map(buildPackage), null, 2));
    }

    console.error("\n─".repeat(60));
    console.error("ℹ️  MODO READ-ONLY — nenhuma alteração foi feita no banco.");
    console.error(
      "📌 Para registrar a resposta, use:\n   node scripts/pulso/openclaw-return.mjs <requestId> '<JSON>'"
    );
    process.exit(0);
  } catch (err) {
    console.error("❌ Erro ao acessar Firestore:", err.message);
    process.exit(1);
  }
}

main();
