/**
 * openclaw-return.mjs
 * --------------------
 * Lótus Live v1.6 — Fila Operacional OpenClaw
 *
 * Recebe o retorno da OpenClaw e grava no documento correto de pulso_requests.
 * Apenas atualiza os campos: openclawResult, status, updatedAt.
 * Nunca cria entidades, nunca executa propostas, nunca envia mensagens.
 *
 * Uso:
 *   node scripts/pulso/openclaw-return.mjs <requestId> '<json>'
 *
 * Exemplo:
 *   node scripts/pulso/openclaw-return.mjs abc123 '{
 *     "responseText": "As tarefas de hoje...",
 *     "summary": "Consulta de tarefas sem ação",
 *     "confidence": "high",
 *     "riskLevel": "low",
 *     "requiresHumanApproval": false,
 *     "sourcesConsulted": ["pulso_tasks"],
 *     "proposedActions": []
 *   }'
 *
 * Segurança:
 *   - Lê credenciais do .env.local (nunca hardcoded)
 *   - Escreve SOMENTE em openclawResult, status, updatedAt
 *   - Nunca executa propostas automaticamente
 *   - Nunca cria tarefas, projetos ou pessoas
 *   - Nunca envia mensagens externas
 *   - Nunca cria Cloud Functions ou novas coleções
 *   - Se o JSON for inválido, grava status openclaw_failed com o erro
 */

import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, updateDoc, Timestamp } from "firebase/firestore";
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
const [requestId, rawJson] = process.argv.slice(2);

if (!requestId) {
  console.error("❌ Uso: node scripts/pulso/openclaw-return.mjs <requestId> '<json>'");
  console.error("   Exemplo de JSON mínimo: {\"responseText\": \"resposta aqui\"}");
  process.exit(1);
}

// ─── FIREBASE ────────────────────────────────────────────────────────────────
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const BASE_PATH = `workspaces/${WORKSPACE_ID}`;
const DOC_PATH = `${BASE_PATH}/pulso_requests/${requestId}`;

// ─── VALIDATION ──────────────────────────────────────────────────────────────
function validateResult(raw) {
  const errors = [];

  if (!raw || typeof raw !== "object") {
    errors.push("resultado não é um objeto JSON válido");
    return { valid: false, errors };
  }

  if (!raw.responseText || typeof raw.responseText !== "string" || !raw.responseText.trim()) {
    errors.push("campo obrigatório 'responseText' ausente ou vazio");
  }

  const validConfidence = ["high", "medium", "low", undefined, null];
  if (!validConfidence.includes(raw.confidence)) {
    errors.push(`'confidence' inválido: ${raw.confidence} — use 'high', 'medium' ou 'low'`);
  }

  const validRisk = ["low", "medium", "high", undefined, null];
  if (!validRisk.includes(raw.riskLevel)) {
    errors.push(`'riskLevel' inválido: ${raw.riskLevel} — use 'low', 'medium' ou 'high'`);
  }

  if (raw.proposedActions !== undefined && !Array.isArray(raw.proposedActions)) {
    errors.push("'proposedActions' deve ser um array");
  }

  if (raw.sourcesConsulted !== undefined && !Array.isArray(raw.sourcesConsulted)) {
    errors.push("'sourcesConsulted' deve ser um array");
  }

  // Block any attempt to pass execution-triggering fields
  const BLOCKED_FIELDS = ["executeNow", "autoExecute", "triggerFunction", "callWebhook"];
  for (const field of BLOCKED_FIELDS) {
    if (raw[field] !== undefined) {
      errors.push(`campo bloqueado por segurança: '${field}'`);
    }
  }

  return { valid: errors.length === 0, errors };
}

// ─── STATUS CALCULATION ───────────────────────────────────────────────────────
function calculateStatus(result) {
  if (result.requiresHumanApproval === true) return "waiting_user_approval";
  return "proposal_ready";
}

// ─── MAIN ────────────────────────────────────────────────────────────────────
async function main() {
  console.error(`🔍 Projeto Firebase: ${firebaseConfig.projectId}`);
  console.error(`📂 Workspace: ${WORKSPACE_ID}`);
  console.error(`🎯 Request ID: ${requestId}\n`);

  // ─ Step 1: Verify document exists ────────────────────────────────────────
  const docRef = doc(db, DOC_PATH);
  let snap;
  try {
    snap = await getDoc(docRef);
  } catch (err) {
    console.error("❌ Erro ao acessar Firestore:", err.message);
    process.exit(1);
  }

  if (!snap.exists()) {
    console.error(`❌ Documento não encontrado: ${DOC_PATH}`);
    process.exit(1);
  }

  const currentData = snap.data();
  console.error(`✅ Documento encontrado: "${currentData.title || currentData.summary}"`);
  console.error(`   Status atual: ${currentData.status}`);

  if (currentData.openclawResult) {
    console.error(`⚠️  Atenção: este request já possui openclawResult. Sobrescrevendo...`);
  }

  // ─ Step 2: Parse JSON ────────────────────────────────────────────────────
  let parsed;
  if (!rawJson) {
    // If no JSON arg, try to read from stdin
    console.error("ℹ️  Nenhum JSON fornecido como argumento. Lendo stdin...");
    const chunks = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    const stdin = Buffer.concat(chunks).toString("utf-8").trim();
    if (!stdin) {
      console.error("❌ Nenhum JSON recebido. Gravando como openclaw_failed.");
      await recordFailure(docRef, ["Nenhum JSON de retorno fornecido"]);
      process.exit(1);
    }
    try {
      parsed = JSON.parse(stdin);
    } catch {
      console.error("❌ JSON de stdin inválido. Gravando como openclaw_failed.");
      await recordFailure(docRef, ["JSON de stdin inválido — parse falhou"]);
      process.exit(1);
    }
  } else {
    try {
      parsed = JSON.parse(rawJson);
    } catch {
      console.error("❌ JSON inválido. Gravando como openclaw_failed.");
      await recordFailure(docRef, ["JSON inválido — parse falhou"]);
      process.exit(1);
    }
  }

  // ─ Step 3: Validate ──────────────────────────────────────────────────────
  const { valid, errors } = validateResult(parsed);
  if (!valid) {
    console.error("❌ Validação falhou:");
    errors.forEach((e) => console.error(`   • ${e}`));
    console.error("\nGravando como openclaw_failed...");
    await recordFailure(docRef, errors);
    process.exit(1);
  }

  // ─ Step 4: Write openclawResult ──────────────────────────────────────────
  const now = new Date().toISOString();
  const newStatus = calculateStatus(parsed);

  const openclawResult = {
    processedBy: "openclaw",
    processedAt: now,
    createdAt: now,
    responseText: parsed.responseText,
    ...(parsed.summary && { summary: parsed.summary }),
    ...(parsed.confidence && { confidence: parsed.confidence }),
    ...(parsed.riskLevel && { riskLevel: parsed.riskLevel }),
    ...(parsed.requiresHumanApproval !== undefined && {
      requiresHumanApproval: Boolean(parsed.requiresHumanApproval),
    }),
    ...(parsed.sourcesConsulted && { sourcesConsulted: parsed.sourcesConsulted }),
    ...(parsed.proposedActions && { proposedActions: parsed.proposedActions }),
    ...(parsed.proposedMutation && { proposedMutation: parsed.proposedMutation }),
    ...(parsed.errors && parsed.errors.length > 0 && { errors: parsed.errors }),
    ...(parsed.auditLog && { auditLog: parsed.auditLog }),
    statusTransition: newStatus,
  };

  try {
    await updateDoc(docRef, {
      openclawResult,
      status: newStatus,
      updatedAt: Timestamp.now(),
    });
  } catch (err) {
    console.error("❌ Erro ao escrever no Firestore:", err.message);
    process.exit(1);
  }

  // ─ Step 5: Report ────────────────────────────────────────────────────────
  console.error("\n" + "─".repeat(60));
  console.error(`✅ openclawResult gravado com sucesso!`);
  console.error(`   Request ID : ${requestId}`);
  console.error(`   Novo status: ${newStatus}`);
  console.error(`   ProcessedAt: ${now}`);
  if (parsed.requiresHumanApproval) {
    console.error(`   ⚠️  Requer aprovação humana antes de qualquer ação.`);
  }
  console.error("─".repeat(60));
  console.error("\n🔒 Confirmação de segurança:");
  console.error("   ✓ Nenhuma tarefa criada");
  console.error("   ✓ Nenhum projeto criado");
  console.error("   ✓ Nenhuma pessoa criada");
  console.error("   ✓ Nenhuma mensagem externa enviada");
  console.error("   ✓ Nenhuma Cloud Function criada");
  console.error("   ✓ Apenas openclawResult, status e updatedAt foram alterados");
  process.exit(0);
}

// ─── FAILURE HELPER ───────────────────────────────────────────────────────────
async function recordFailure(docRef, errors) {
  const now = new Date().toISOString();
  try {
    await updateDoc(docRef, {
      status: "openclaw_failed",
      updatedAt: Timestamp.now(),
      openclawResult: {
        processedBy: "openclaw",
        processedAt: now,
        createdAt: now,
        responseText: "Erro no retorno da OpenClaw — ver campo errors.",
        errors,
        statusTransition: "openclaw_failed",
      },
    });
    console.error(`✅ Status atualizado para openclaw_failed.`);
    console.error(`   Errors: ${errors.join("; ")}`);
  } catch (writeErr) {
    console.error("❌ Não foi possível gravar openclaw_failed:", writeErr.message);
  }
}

main();
