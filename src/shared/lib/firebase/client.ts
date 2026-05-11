import { getApps, initializeApp, getApp, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";
import { getStorage, FirebaseStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Validação básica de configuração
export const isFirebaseConfigured = !!(
  firebaseConfig.apiKey &&
  firebaseConfig.projectId &&
  firebaseConfig.appId
);

/**
 * Singleton instance of Firebase App
 */
const firebaseApp: FirebaseApp = getApps().length === 0 
  ? initializeApp(firebaseConfig) 
  : getApp();

/**
 * Mandatory Firebase service instances
 */
const auth: Auth = getAuth(firebaseApp);
const db: Firestore = getFirestore(firebaseApp);
const storage: FirebaseStorage = getStorage(firebaseApp);

export { firebaseApp, auth, db, storage };
