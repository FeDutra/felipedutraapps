import { getApps, initializeApp, getApp, FirebaseApp } from "firebase/app";
import {
  browserLocalPersistence,
  getAuth,
  initializeAuth,
  Auth,
} from "firebase/auth";
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
const isTauriRuntime = typeof window !== "undefined" && (
  window.location.protocol === "tauri:" ||
  window.location.protocol === "file:" ||
  !!(window as any).__TAURI__ ||
  !!(window as any).__TAURI_INTERNALS__
);

/**
 * WKWebView may leave Firebase Auth waiting indefinitely while its default
 * IndexedDB persistence settles. Tauri only needs a durable local session, so
 * prefer localStorage-backed persistence there. Keep the browser defaults on
 * the web, where popup/redirect auth has already been validated.
 */
const auth: Auth = (() => {
  if (!isTauriRuntime) return getAuth(firebaseApp);

  try {
    return initializeAuth(firebaseApp, {
      persistence: browserLocalPersistence,
    });
  } catch (error: any) {
    // Hot reloads and duplicate client modules can reach an already-created
    // Auth instance. Reuse it rather than turning startup into a hard failure.
    if (error?.code === "auth/already-initialized") {
      return getAuth(firebaseApp);
    }
    throw error;
  }
})();
const db: Firestore = getFirestore(firebaseApp);
const storage: FirebaseStorage = getStorage(firebaseApp);

export { firebaseApp, auth, db, storage };
