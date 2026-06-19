import { db } from './src/shared/lib/firebase/client';
import { doc, setDoc } from 'firebase/firestore';
import { candidateAreas } from './src/apps/pulso/scripts/seedAreas';

async function run() {
  console.log("Starting upsert...");
  let count = 0;
  for (const area of candidateAreas) {
    if(!area.id) continue;
    const docRef = doc(db, 'workspaces/felipe_dutra/pulso_areas', area.id);
    await setDoc(docRef, { ...area, updatedAt: new Date() }, { merge: true });
    count++;
  }
  console.log(`Upserted ${count} areas.`);
  process.exit(0);
}

run().catch(console.error);
