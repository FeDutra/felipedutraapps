import { initializeApp } from 'firebase/app';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getAuth, signInAnonymously } from 'firebase/auth';

const app = initializeApp({
  apiKey: 'AIzaSyB-VcAZ6emCYcIJWu2iffhGD58wqmMsShw',
  authDomain: 'felipedutraapps.firebaseapp.com',
  projectId: 'felipedutraapps',
  storageBucket: 'felipedutraapps.firebasestorage.app',
});

const auth = getAuth(app);
const storage = getStorage(app);
console.log('Signing in anonymously...');
const cred = await signInAnonymously(auth);
console.log('Auth UID:', cred.user.uid);

// Use the exact same path pattern the app uses
const contextId = 'sistema_pulso';
const attId = 'att-' + Date.now();
const fileName = attId + '_test.txt';
const path = `pulso/chats/${contextId}/attachments/${fileName}`;
console.log('Uploading to path:', path);

const testRef = ref(storage, path);
try {
  const snap = await uploadBytes(testRef, new Blob(['hello storage test'], {type:'text/plain'}));
  const url = await getDownloadURL(snap.ref);
  console.log('✅ Upload works! URL:', url);
} catch(e) {
  console.error('❌ Error:', e.code, e.message);
}
