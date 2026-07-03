import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

// Usa credencial de serviço padrão (gcloud auth)
initializeApp({ projectId: 'felipedutraapps' });

const db = getFirestore();

async function clearTestSummaryCards() {
  const eventsRef = db.collection('workspaces/felipe_dutra/pulso_events');
  
  // Busca todos os eventos daily_summary_cards
  const snap = await eventsRef
    .where('action', '==', 'daily_summary_cards')
    .get();

  if (snap.empty) {
    console.log('Nenhum evento daily_summary_cards encontrado.');
    return;
  }

  console.log(`Encontrados ${snap.size} evento(s) para deletar:`);
  
  const batch = db.batch();
  snap.docs.forEach(doc => {
    console.log(' -', doc.id, JSON.stringify(doc.data().payload?.cards?.map(c => c.title)));
    batch.delete(doc.ref);
  });

  await batch.commit();
  console.log('✅ Eventos de teste deletados com sucesso.');
}

clearTestSummaryCards().catch(console.error);
