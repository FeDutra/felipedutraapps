import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';

const app = initializeApp({
  apiKey: 'AIzaSyB-VcAZ6emCYcIJWu2iffhGD58wqmMsShw',
  authDomain: 'felipedutraapps.firebaseapp.com',
  projectId: 'felipedutraapps',
  storageBucket: 'felipedutraapps.firebasestorage.app',
});

const auth = getAuth(app);
const db = getFirestore(app);

try {
  console.log('Authenticating...');
  await signInAnonymously(auth);

  // Ensure session exists
  const sessionRef = doc(db, 'workspaces/felipe_dutra/pulso_sessions', 'sistema_relatorios_tecnicos');
  await setDoc(sessionRef, {
    contextId: 'sistema_relatorios_tecnicos',
    areaId: 'area_sistema',
    label: 'RELATÓRIOS TÉCNICOS',
    openclawSessionKey: 'agent:main:pulso:sistema_relatorios_tecnicos',
    isSystem: true,
    pinned: true,
    updatedAt: serverTimestamp()
  }, { merge: true });

  const reportText = `# 📊 Relatório Técnico de Teste (Instância Manual)
📅 **Data:** ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')} (Horário Local)

### 1. Panorama Geral
*   **Estado Operacional:** ✅ NORMALIDADE - Sistema de testes ativado manualmente
*   **Mensagens Ativas:** 0 alertas em aberto nas últimas 24h

### 2. Principais Números e Sinais
*   **Total de Comandos:** \`24\` executados (simulado)
*   **Taxa de Sucesso:** \`100%\` (24 OK / 0 Falhas)
*   **Latência Média:** \`4.12s\`

### 3. Diagnóstico e Sincronização
*   **Sincronização Backend-Front:** 100% íntegra
*   **Erros / Regressões:** 0 regressões críticas detectadas

### 4. Pontos que Merecem Atenção
*   Este é um teste disparado manualmente para validar a visualização em Markdown no chat **SISTEMA / RELATÓRIOS TÉCNICOS**.`;

  console.log('Writing test message...');
  await addDoc(collection(db, 'workspaces/felipe_dutra/pulso_requests'), {
    requestType: 'active_message',
    status: 'success',
    contextId: 'sistema_relatorios_tecnicos',
    areaId: 'area_sistema',
    openclawSessionKey: 'agent:main:pulso:sistema_relatorios_tecnicos',
    archived: false,
    openclawResult: {
      responseText: reportText,
      processedBy: 'pulso-monitor-manual-test',
      processedAt: new Date().toISOString(),
      summary: 'Relatório Técnico de Teste'
    },
    meta: {
      originCron: 'pulsoDailyReportManual',
      reportType: 'test'
    },
    requestedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  console.log('✅ Done!');
} catch (err) {
  console.error('❌ Failed:', err.message);
}
