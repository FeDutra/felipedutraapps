import { 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged,
  User
} from "firebase/auth";
import { auth, isFirebaseConfigured } from "../lib/firebase/client";

/**
 * @file authService.ts
 * @description Minimal Google Authentication service for the ÉDEN ecosystem.
 */

const googleProvider = isFirebaseConfigured ? new GoogleAuthProvider() : null;

export const authService = {
  /**
   * Triggers a Google Sign-In popup
   */
  signInWithGoogle: async () => {
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
    return onAuthStateChanged(auth, callback);
  },

  /**
   * Returns the currently authenticated user
   */
  getCurrentUser: () => {
    return auth.currentUser;
  },

  /**
   * Waits for the Firebase auth state to settle and returns the current
   * authenticated Google user. Rejects if no user is authenticated.
   * Pages should only call this after AuthGate has already confirmed login.
   */
  ensurePulsoAuthReady: async (): Promise<User> => {
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
