import { 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInAnonymously as firebaseSignInAnonymously,
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
    if (!auth || !googleProvider) {
      console.warn("AuthService: Firebase Auth not configured.");
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
   * Signs in anonymously for public/MVP access
   */
  signInAnonymously: async () => {
    if (!auth) {
      console.warn("AuthService: Firebase Auth not configured.");
      return null;
    }
    try {
      const result = await firebaseSignInAnonymously(auth);
      return result.user;
    } catch (error: any) {
      if (error.code === 'auth/operation-not-allowed') {
        console.error("AuthService: Anonymous Auth is disabled in Firebase Console. Please enable it in Authentication > Sign-in method.");
      } else {
        console.error("AuthService: Error during Anonymous Sign-In", error);
      }
      throw error;
    }
  },

  /**
   * Signs out the current user
   */
  logout: async () => {
    if (!auth) return;
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
    if (!auth) {
      callback(null);
      return () => {};
    }
    return onAuthStateChanged(auth, callback);
  },

  /**
   * Returns the currently authenticated user
   */
  getCurrentUser: () => {
    return auth?.currentUser || null;
  },

  /**
   * Ensures the user is authenticated (using anonymous auth if necessary)
   * and returns the user object only when ready for Firestore operations.
   */
  ensurePulsoAuthReady: async (): Promise<User> => {
    if (!auth) throw new Error("Firebase Auth not configured");
    
    // Check if user already exists
    if (auth.currentUser) return auth.currentUser;
    
    // Wait for the auth state to settle (in case it's still loading)
    return new Promise((resolve, reject) => {
      let resolved = false;
      
      const unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (resolved) return;
        
        if (user) {
          resolved = true;
          unsubscribe();
          resolve(user);
        } else {
          // If no user after initial check, try anonymous sign in
          try {
            const anonymousUser = await authService.signInAnonymously();
            if (anonymousUser) {
              resolved = true;
              unsubscribe();
              resolve(anonymousUser);
            }
          } catch (err) {
            resolved = true;
            unsubscribe();
            reject(err);
          }
        }
      });
      
      // Safety timeout
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          unsubscribe();
          reject(new Error("Auth timeout: could not establish secure session. Please check your internet connection."));
        }
      }, 15000);
    });
  }
};
