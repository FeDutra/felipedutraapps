#!/usr/bin/env node

/**
 * @file test-materialization-cycle.mjs
 * @description Standalone integration test script demonstrating the complete lifecycle
 * of an operational request via the Requests Bridge, from ingestion to materialization audit.
 */

const TOKEN = process.env.PULSO_INGEST_TOKEN;
const BASE_URL = process.env.PULSO_BRIDGE_URL || "https://felipedutraapps.web.app/api/pulso/requests";

if (!TOKEN) {
  console.error("❌ Erro: Variável de ambiente PULSO_INGEST_TOKEN não fornecida.");
  console.error("Uso: PULSO_INGEST_TOKEN=xxx node scripts/pulso/test-materialization-cycle.mjs");
  process.exit(1);
}

const headers = {
  "Authorization": `Bearer ${TOKEN}`,
  "Content-Type": "application/json"
};

const timestamp = Date.now();
const dedupeKey = `test_mat_script_${timestamp}`;
const personName = `Pessoa Teste ${timestamp}`;

async function run() {
  console.log("\n🚀 Iniciando Validação Ponta a Ponta: Requests Bridge + Materialização\n");
  console.log(`🔗 Base URL: ${BASE_URL}`);
  console.log(`🔑 Token: Fornecido (${TOKEN.substring(0, 5)}...)\n`);

  let createdRequestId = null;

  // ── 1. Criar Request ───────────────────────────────────────────────────────
  try {
    console.log("▶️  Passo 1: Criando solicitação (register_person)...");
    const payload = {
      requestType: "register_person",
      title: `Registrar ${personName}`,
      summary: "Validação automatizada via script operacional.",
      priority: "medium",
      areaRef: "area_openclaw",
      requestedBy: "agent_lotus",
      dedupeKey,
      origin: { channel: "system", source: "node_script" },
      payload: {
        name: personName,
        role: "Automated Tester",
        attentionLevel: "medium",
        notes: "Criado pelo Operational Kit test script."
      }
    };

    const res = await fetch(`${BASE_URL}/create`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${JSON.stringify(data)}`);
    
    createdRequestId = data.requestId;
    console.log(`✅ Request criado com sucesso! ID: ${createdRequestId}`);
    console.log(`   Status Retornado: ${data.status}\n`);
  } catch (err) {
    console.error("❌ Falha na criação do request:", err.message);
    process.exit(1);
  }

  // ── 2. Listar Pending ──────────────────────────────────────────────────────
  try {
    console.log("▶️  Passo 2: Verificando fila de pendentes (/pending)...");
    const res = await fetch(`${BASE_URL}/pending?status=requested&limit=10`, { headers });
    const list = await res.json();
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const found = list.find(r => r.id === createdRequestId);
    if (found) {
      console.log(`✅ Request ${createdRequestId} encontrado na fila de pendentes!`);
      console.log(`   Título: "${found.title}"`);
      console.log(`   Payload extraído com sucesso.\n`);
    } else {
      console.warn(`⚠️  Request não localizado nos primeiros resultados do /pending, mas prosseguindo pelo ID canônico...\n`);
    }
  } catch (err) {
    console.error("❌ Falha ao listar pendentes:", err.message);
    process.exit(1);
  }

  // ── 3. Fazer Claim ─────────────────────────────────────────────────────────
  try {
    console.log("▶️  Passo 3: Aplicando lock transacional (/claim)...");
    const res = await fetch(`${BASE_URL}/claim`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        requestId: createdRequestId,
        processedBy: "test_script_agent"
      })
    });

    const text = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${text}`);
    console.log(`✅ Claim efetuado com sucesso! Resposta: ${text.trim()}\n`);
  } catch (err) {
    console.error("❌ Falha no claim:", err.message);
    process.exit(1);
  }

  // ── 4. Concluir e Materializar ─────────────────────────────────────────────
  try {
    console.log("▶️  Passo 4: Concluindo solicitação para acionar materialização (/complete)...");
    const res = await fetch(`${BASE_URL}/complete`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        requestId: createdRequestId,
        result: { testExecutionStatus: "ok" }
      })
    });

    const text = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${text}`);
    console.log(`✅ Conclusão acionada com sucesso! Status retornado: ${text.trim()}\n`);
  } catch (err) {
    console.error("❌ Falha na conclusão:", err.message);
    process.exit(1);
  }

  // ── 5. Consultar Request Final por ID ──────────────────────────────────────
  try {
    console.log("▶️  Passo 5: Auditando documento final e chaves de materialização (GET /:id)...");
    const res = await fetch(`${BASE_URL}/${createdRequestId}`, { headers });
    const doc = await res.json();
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    console.log(`✅ Documento final consultado com sucesso!`);
    console.log(`   Status Final Gravado: ${doc.status}`);
    
    const mat = doc.result?.matResult;
    if (mat) {
      console.log(`\n📦 Auditoria da Materialização (Dispatcher Result):`);
      console.log(`   - Status da Operação: ${mat.ok ? "Sucesso" : "Falha"}`);
      console.log(`   - Ação Executada: ${mat.action}`);
      console.log(`   - Tipo Canônico: ${mat.entityType}`);
      console.log(`   - EntityRef (ID Gerado): ${mat.entityRef}`);
      console.log(`   - EntityPath (Coleção Firestore): ${mat.entityPath}`);
      console.log(`   - Resumo Técnico: ${mat.summary}`);
    } else {
      console.warn("⚠️  Objeto matResult não retornado no documento consultado.");
    }

    console.log("\n📊 Relatório de Certificação:");
    console.log("=========================================================================");
    console.log(`A Lótus/OpenClaw pode agora auditar a existência canônica de:`);
    console.log(`👉 ${mat?.entityPath || "workspaces/felipe_dutra/pulso_people/..."}`);
    console.log(`para provar conclusivamente que o ciclo completou ponta a ponta.`);
    console.log("=========================================================================\n");

  } catch (err) {
    console.error("❌ Falha na consulta final por ID:", err.message);
    process.exit(1);
  }
}

run();
