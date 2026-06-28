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
console.log('Storage bucket:', storage.app.options.storageBucket);
console.log('Testing anonymous auth + storage upload...');
try {
  const cred = await signInAnonymously(auth);
  console.log('Auth UID:', cred.user.uid);
  const testRef = ref(storage, 'pulso/chats/test/probe.txt');
  console.log('Ref path:', testRef.fullPath);
  const snap = await uploadBytes(testRef, new Blob(['ok'], {type:'text/plain'}));
  const url = await getDownloadURL(snap.ref);
  console.log('✅ Upload works! URL:', url);
} catch(e) {
  console.error('❌ Error code:', e.code);
  console.error('❌ Error message:', e.message);
  console.error('❌ Server response:', e.serverResponse);
  console.error('❌ Status:', e.status_);
  console.error('Full error:', JSON.stringify(e, null, 2));
}
