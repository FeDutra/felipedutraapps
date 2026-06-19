import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';

const serviceAccount = JSON.parse(fs.readFileSync('/Users/fe/.gemini/antigravity/scratch/felipedutraapps/scripts/pulso/serviceAccountKey.json', 'utf8'));

if (!initializeApp.length) {
  initializeApp({
    credential: cert(serviceAccount)
  });
}

const db = getFirestore();

async function check() {
  const snapshot = await db.collection('workspaces/felipe_dutra/pulso_requests')
    .where('requestType', '==', 'active_message')
    .orderBy('createdAt', 'desc')
    .limit(5)
    .get();

  if (snapshot.empty) {
    console.log('No active messages found.');
    return;
  }

  snapshot.forEach(doc => {
    console.log(doc.id, '=>', doc.data());
  });
}

check().catch(console.error);
