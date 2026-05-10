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
  }
};
