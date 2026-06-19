import { 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged,
  signInAnonymously,
  signInWithEmailAndPassword,
  User
} from "firebase/auth";
import { auth, isFirebaseConfigured } from "../lib/firebase/client";

/**
 * @file authService.ts
 * @description Minimal Google Authentication service for the ÉDEN ecosystem.
 */

const googleProvider = isFirebaseConfigured ? new GoogleAuthProvider() : null;

const isTauriDev = 
  process.env.NODE_ENV === "development" &&
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).get("pulso_tauri_dev") === "1";

const wrapDevUser = (firebaseUser: User | null): User | null => {
  if (!firebaseUser) return null;
  return new Proxy(firebaseUser, {
    get(target, prop, receiver) {
      if (prop === "uid") {
        return target.uid || "pulso_tauri_dev_felipe";
      }
      if (prop === "email") {
        return "felipe_dutra";
      }
      if (prop === "displayName") {
        return "Felipe / Fê";
      }
      if (prop === "isAnonymous") {
        return false;
      }
      const val = Reflect.get(target, prop, receiver);
      if (typeof val === "function") {
        return val.bind(target);
      }
      return val;
    }
  }) as any as User;
};

export const authService = {
  /**
   * Triggers a Google Sign-In popup
   */
  signInWithGoogle: async () => {
    if (isTauriDev) {
      try {
        const result = await signInAnonymously(auth);
        return wrapDevUser(result.user);
      } catch (error) {
        console.error("AuthService: Error during anonymous sign in in Tauri Dev mode", error);
        throw error;
      }
    }
    if (!googleProvider) {
      console.warn("AuthService: Google Sign-In not available (check Firebase config).");
      return null;
    }
    try {
      const result = await signInWithPopup(auth, googleProvider);
      return result.user;
    } catch (error) {
      console.error("AuthService: Error during Google Sign-In", error);
      throw error;
    }
  },

  /**
   * Signs in with email and password (specifically for Tauri production fallback)
   */
  signInWithEmail: async (email: string, password: string) => {
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      return result.user;
    } catch (error) {
      console.error("AuthService: Error during Email Sign-In", error);
      throw error;
    }
  },

  /**
   * Signs out the current user
   */
  logout: async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("AuthService: Error during logout", error);
      throw error;
    }
  },

  /**
   * Listens to authentication state changes
   */
  onAuthStateChange: (callback: (user: User | null) => void) => {
    if (isTauriDev) {
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        if (!user) {
          signInAnonymously(auth).catch((error) => {
            console.error("AuthService: Error during anonymous sign in in onAuthStateChange", error);
            callback(null);
          });
        } else {
          callback(wrapDevUser(user));
        }
      });
      return unsubscribe;
    }
    return onAuthStateChanged(auth, callback);
  },

  /**
   * Returns the currently authenticated user
   */
  getCurrentUser: () => {
    if (isTauriDev && auth.currentUser) {
      return wrapDevUser(auth.currentUser);
    }
    return auth.currentUser;
  },

  /**
   * Waits for the Firebase auth state to settle and returns the current
   * authenticated Google user. Rejects if no user is authenticated.
   * Pages should only call this after AuthGate has already confirmed login.
   */
  ensurePulsoAuthReady: async (): Promise<User> => {
    if (isTauriDev) {
      if (auth.currentUser) return wrapDevUser(auth.currentUser)!;

      return new Promise((resolve, reject) => {
        let resolved = false;

        const unsubscribe = onAuthStateChanged(auth, (user) => {
          if (resolved) return;
          if (user) {
            resolved = true;
            unsubscribe();
            resolve(wrapDevUser(user)!);
          }
        });

        // Trigger anonymous sign in if not already present
        if (!auth.currentUser) {
          signInAnonymously(auth).catch((error) => {
            if (!resolved) {
              resolved = true;
              unsubscribe();
              reject(error);
            }
          });
        }

        setTimeout(() => {
          if (!resolved) {
            resolved = true;
            unsubscribe();
            reject(new Error("Timeout de autenticação em Tauri Dev."));
          }
        }, 10000);
      });
    }

    // Fast path: user already available
    if (auth.currentUser) return auth.currentUser;

    // Slow path: wait for onAuthStateChanged to fire once (handles cold loads)
    return new Promise((resolve, reject) => {
      let resolved = false;

      const unsubscribe = onAuthStateChanged(auth, (user) => {
        if (resolved) return;
        resolved = true;
        unsubscribe();

        if (user) {
          resolve(user);
        } else {
          reject(new Error("Nenhum usuário autenticado. Faça login com Google para continuar."));
        }
      });

      // Safety timeout (should never hit if AuthGate is working)
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          unsubscribe();
          reject(new Error("Timeout de autenticação. Verifique sua conexão e tente novamente."));
        }
      }, 10000);
    });
  }
};

