#!/usr/bin/env node

/**
 * @file test-request-materialization.mjs
 * @description Multi-case integration test script to certify the Operational Kit for OpenClaw.
 * Sequentially tests register_person, register_source, and create_task lifecycle processing.
 */

const TOKEN = process.env.PULSO_INGEST_TOKEN;
const BASE_URL = process.env.PULSO_BRIDGE_URL || "https://felipedutraapps.web.app/api/pulso/requests";

if (!TOKEN) {
  console.error("❌ Erro: Variável de ambiente PULSO_INGEST_TOKEN não fornecida.");
  console.error("Uso: PULSO_INGEST_TOKEN=xxx node scripts/pulso/test-request-materialization.mjs");
  process.exit(1);
}

const headers = {
  "Authorization": `Bearer ${TOKEN}`,
  "Content-Type": "application/json"
};

const ts = Date.now();

const cases = [
  {
    type: "register_person",
    payload: {
      requestType: "register_person",
      title: `Stakeholder Kit Test ${ts}`,
      priority: "medium",
      requestedBy: "agent_lotus",
      dedupeKey: `person_kit_${ts}`,
      payload: { name: `Mariana Kit ${ts}`, role: "Tech Lead" }
    }
  },
  {
    type: "register_source",
    payload: {
      requestType: "register_source",
      title: `Source Kit Test ${ts}`,
      priority: "high",
      requestedBy: "agent_lotus",
      dedupeKey: `source_kit_${ts}`,
      payload: { name: `Planilha Custos ${ts}`, type: "google_sheets", url: "https://docs.google.com/spreadsheets/d/abc" }
    }
  },
  {
    type: "create_task",
    payload: {
      requestType: "create_task",
      title: `Task Kit Test ${ts}`,
      priority: "high",
      requestedBy: "agent_lotus",
      dedupeKey: `task_kit_${ts}`,
      payload: { title: `Revisar Contrato ${ts}`, description: "Auditoria estrutural via Operational Kit." }
    }
  }
];

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runCase(testCase) {
  console.log(`\n=================================================================`);
  console.log(`🧪 Testando Caso: [${testCase.type.toUpperCase()}]`);
  console.log(`=================================================================`);

  let reqId = null;

  // 1. Create
  try {
    const res = await fetch(`${BASE_URL}/create`, { method: "POST", headers, body: JSON.stringify(testCase.payload) });
    const data = await res.json();
    if (!res.ok) throw new Error(JSON.stringify(data));
    reqId = data.requestId;
    console.log(`[CREATE]  ID Canônico: ${reqId} | Status: ${data.status}`);
  } catch (err) {
    console.error(`❌ Falha no CREATE de ${testCase.type}:`, err.message);
    return;
  }

  // Small propagation delay
  await delay(1000);

  // 2. Initial Audit via Lookup
  try {
    const res = await fetch(`${BASE_URL}/${reqId}`, { headers });
    const doc = await res.json();
    console.log(`[LOOKUP]  Status Inicial: ${doc.status}`);
  } catch (err) {
    console.error(`❌ Falha na consulta inicial:`, err.message);
  }

  // 3. Claim
  try {
    const res = await fetch(`${BASE_URL}/claim`, { method: "POST", headers, body: JSON.stringify({ requestId: reqId, processedBy: "test_script_agent" }) });
    const txt = await res.text();
    console.log(`[CLAIM]   Lock efetuado: ${txt.trim()}`);
  } catch (err) {
    console.error(`❌ Falha no CLAIM:`, err.message);
    return;
  }

  // 4. Complete
  try {
    const res = await fetch(`${BASE_URL}/complete`, { method: "POST", headers, body: JSON.stringify({ requestId: reqId, result: { log: "Simulated complete execution" } }) });
    const txt = await res.text();
    console.log(`[COMPLETE] Despacho acionado: ${txt.trim()}`);
  } catch (err) {
    console.error(`❌ Falha no COMPLETE:`, err.message);
    return;
  }

  // Small execution stabilization delay
  await delay(1500);

  // 5. Final Audit & Outcome Check
  try {
    const res = await fetch(`${BASE_URL}/${reqId}`, { headers });
    const doc = await res.json();
    console.log(`[RESULT]  Status Final Gravado: ${doc.status}`);

    const resObj = doc.result || {};
    const mat = resObj.matResult || null;

    console.log(`\n📦 Auditoria Canônica do Desfecho:`);
    console.log(`   - Ação da Materialização: ${mat?.action || resObj.action || "N/A"}`);
    console.log(`   - EntityType: ${mat?.entityType || "N/A"}`);
    console.log(`   - EntityRef (ID): ${resObj.entityRef || mat?.entityRef || "N/A"}`);
    console.log(`   - EntityPath: ${resObj.entityPath || mat?.entityPath || "N/A"}`);
    console.log(`   - Coleção Alvo: ${mat?.entityPath ? mat.entityPath.split('/').slice(0, -1).join('/') : "N/A"}`);
    console.log(`   - Summary Técnico: ${mat?.summary || resObj.summary || "N/A"}`);
    if (resObj.missingFields && resObj.missingFields.length > 0) {
      console.log(`   - MissingFields: ${resObj.missingFields.join(', ')}`);
    }
    if (resObj.error || doc.error) {
      console.log(`   - Erro / Falha: ${resObj.error || doc.error}`);
    }
  } catch (err) {
    console.error(`❌ Falha na auditoria final:`, err.message);
  }
}

async function main() {
  console.log("\n🚀 Executando Bateria de Testes do Operational Kit (OpenClaw Auth)");
  console.log(`🔗 Endpoint Base: ${BASE_URL}\n`);

  for (const tc of cases) {
    await runCase(tc);
  }

  console.log("\n✨ Bateria de validação do Operational Kit concluída com sucesso.\n");
}

main();
