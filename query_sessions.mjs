import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';

const app = initializeApp({
  apiKey: 'AIzaSyB-VcAZ6emCYcIJWu2iffhGD58wqmMsShw',
  authDomain: 'felipedutraapps.firebaseapp.com',
  projectId: 'felipedutraapps',
  storageBucket: 'felipedutraapps.firebasestorage.app',
});
const auth = getAuth(app);
const db = getFirestore(app);

await signInAnonymously(auth);

const snap = await getDocs(collection(db, 'workspaces/felipe_dutra/pulso_sessions'));
console.log(`Found ${snap.size} sessions:`);
snap.forEach(doc => {
  const d = doc.data();
  console.log(JSON.stringify({ id: doc.id, contextId: d.contextId, areaId: d.areaId, label: d.label, chatId: d.chatId, openclawSessionKey: d.openclawSessionKey }));
});
