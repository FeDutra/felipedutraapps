import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as path from 'path';
import * as os from 'os';

// Configuração do ambiente e inicialização do Firebase Admin
// Pressupõe que a variável GOOGLE_APPLICATION_CREDENTIALS está setada ou 
// pode ser passada via ADC padrão.
const WORKSPACE_ID = "felipe_dutra";

async function main() {
  const args = process.argv.slice(2);
  const message = args.join(" ");

  if (!message) {
    console.error("Uso: npx ts-node scripts/talk_to_lotus.ts 'Sua mensagem aqui'");
    process.exit(1);
  }

  console.log("🔌 Iniciando canal direto com Lótus (OpenClaw)...");
  
  // Initialize App. Use ADC if GOOGLE_APPLICATION_CREDENTIALS is set.
  // If it's not set, it will try to find default credentials.
  try {
    initializeApp();
  } catch (e: any) {
    if (e.code !== 'app/duplicate-app') {
      console.error("Erro ao inicializar Firebase. Verifique sua credencial ADC.");
      process.exit(1);
    }
  }

  const db = getFirestore();
  const requestsCol = db.collection(`workspaces/${WORKSPACE_ID}/pulso_requests`);

  const requestPayload = {
    requestType: "conversation_command",
    status: "requested",
    source: "gemini_antigravity", // Identificador de que eu estou chamando
    surface: "cli_bridge",
    sessionRef: "agent:main:pulso:sistema_infraestrutura", // Roteando para a área de infra
    payload: {
      input: message
    },
    requestedAt: new Date(),
    updatedAt: new Date()
  };

  console.log("✉️  Enviando mensagem...");
  const docRef = await requestsCol.add(requestPayload);
  console.log(`✅ Request ID gerado: ${docRef.id}`);
  console.log("🎧 Aguardando Lótus processar e responder...\n");

  // Ouve as mudanças no documento até a Lótus responder
  const unsubscribe = docRef.onSnapshot((snap) => {
    if (!snap.exists) return;
    
    const data = snap.data();
    if (data?.status === "completed" || data?.status === "success" || data?.openclawResult) {
      console.log("✨ === RESPOSTA DA LÓTUS ===");
      if (data.openclawResult && data.openclawResult.responseText) {
        console.log(data.openclawResult.responseText);
      } else {
        console.log("(Resposta recebida, mas sem texto estruturado em openclawResult)");
        console.log(JSON.stringify(data.openclawResult || data, null, 2));
      }
      console.log("=============================\n");
      
      // Encerra o script e a escuta
      unsubscribe();
      process.exit(0);
    }
  });

  // Timeout de segurança (5 minutos)
  setTimeout(() => {
    console.error("⏳ Timeout: A Lótus não respondeu dentro de 5 minutos.");
    unsubscribe();
    process.exit(1);
  }, 300000);
}

main().catch(console.error);
