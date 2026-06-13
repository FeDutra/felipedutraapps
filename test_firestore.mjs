import { initializeApp } from "firebase/app";
import { getFirestore, collection, query, orderBy, limit, getDocs } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function test() {
  const q = query(collection(db, "workspaces/felipe_dutra/pulso_requests"), orderBy("requestedAt", "desc"), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) {
    console.log("Nenhum request encontrado.");
  } else {
    const doc = snap.docs[0];
    console.log("Documento encontrado:", doc.id);
    console.log(JSON.stringify(doc.data(), null, 2));
  }
  process.exit(0);
}

test().catch(console.error);
