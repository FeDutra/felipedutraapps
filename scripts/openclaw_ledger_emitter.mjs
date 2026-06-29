import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Validação de credenciais antes de prosseguir
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error(`
❌ ERRO FATAL: Credenciais do Firebase ausentes.
Para gravar eventos reais no Ledger, a OpenClaw precisa de permissão.

Como resolver:
1. Gere uma nova chave privada em (Firebase Console > Project settings > Service accounts > Generate new private key).
2. Salve o arquivo .json em um local seguro (não comite!).
3. Defina a variável de ambiente apontando para o arquivo, por exemplo:
   export GOOGLE_APPLICATION_CREDENTIALS="/caminho/absoluto/para/serviceAccount.json"

Depois rode o script novamente.
`);
  process.exit(1);
}

// Inicializa a aplicação Admin apenas se ainda não houver nenhuma
if (getApps().length === 0) {
  initializeApp({
    credential: applicationDefault()
  });
}

const db = getFirestore();
const WORKSPACE_PATH = 'workspaces/felipe_dutra/pulso_events';

/**
 * Emite um evento real da Lótus/OpenClaw direto no Ledger do PULSO via Firebase Admin.
 * Esta função deve ser importada no Worker da OpenClaw futuramente.
 * 
 * @param {Object} event Evento formatado de acordo com o Schema do Ledger.
 * @returns {Promise<string>} O ID do documento criado no Firestore.
 */
export async function emitPulsoLedgerEvent(event) {
  try {
    const eventsRef = db.collection(WORKSPACE_PATH);
    
    // Garantir que os timestamps essenciais sempre existam (prevenindo falhas de query orderBy createdAt)
    const payload = {
      ...event,
      createdAt: event.createdAt || new Date().toISOString(),
    };

    const docRef = await eventsRef.add(payload);
    console.log(`✅ [Ledger Emitter] Evento '${event.action}' registrado com sucesso no Ledger. ID: ${docRef.id}`);
    return docRef.id;
  } catch (error) {
    console.error(`❌ [Ledger Emitter] Falha ao registrar evento '${event.action}' no Ledger:`, error);
    throw error;
  }
}

// ============================================================================
// Suporte a CLI para Validação Local (Fase 2)
// ============================================================================

const args = process.argv.slice(2);
const command = args[0];

if (command === 'ping') {
  console.log('🚀 Iniciando envio do Ping Real (system.ledger_ping)...');
  emitPulsoLedgerEvent({
    source: "lotus_openclaw",
    intent: "Registrar teste real da Lótus no Ledger da PULSO",
    action: "system.ledger_ping",
    target: "pulso/live",
    payload: {
      message: "Lótus registrou um evento real no Ledger da PULSO."
    },
    status: "success",
    result: {
      ok: true
    },
    externalRefs: {},
    surface: "openclaw"
  }).then(() => process.exit(0)).catch(() => process.exit(1));
} else if (command === 'task') {
  console.log('🚀 Iniciando envio da Task Real Mockada (notion.create_task)...');
  emitPulsoLedgerEvent({
    source: "lotus_openclaw",
    intent: "Registrar intenção de tarefa criada pela Lótus",
    action: "notion.create_task",
    target: "notion/test",
    payload: {
      title: "Teste real de tarefa via Lótus/OpenClaw",
      assignee: "Fê",
      project: "PULSO"
    },
    status: "success",
    result: {
      taskId: "openclaw_test_task_001"
    },
    externalRefs: {
      notionPageId: "openclaw_test_task_001"
    },
    surface: "openclaw"
  }).then(() => process.exit(0)).catch(() => process.exit(1));
} else if (command) {
  console.error(`⚠️ Comando desconhecido: ${command}. Use 'ping' ou 'task'.`);
  process.exit(1);
}
