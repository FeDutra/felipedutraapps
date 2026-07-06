import { getFirestore } from "firebase-admin/firestore";
import * as admin from "firebase-admin";

process.env.GOOGLE_APPLICATION_CREDENTIALS = "/Users/felipedutra/Secrets/pulso/firebase-service-account.json";
admin.initializeApp();
const db = getFirestore();

async function run() {
  const q = await db.collection("workspaces/felipe_dutra/pulso_ingestion_events")
    .orderBy("createdAt", "desc")
    .limit(1)
    .get();
  
  if (q.empty) {
    console.log("No events found");
    return;
  }
  
  const doc = q.docs[0];
  console.log("Last Ingestion Event:", doc.id);
  console.log(JSON.stringify(doc.data(), null, 2));
}

run().catch(console.error);
