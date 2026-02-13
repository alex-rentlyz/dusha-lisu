import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";
import { getApp } from "./config";

let _auth = null;
let currentUser = null;
let authReady = false;
let authPromiseResolve = null;
let authReadyPromise = null;

/**
 * Get Firebase Auth instance (lazy initialization).
 */
function getAuthInstance() {
  if (_auth) return _auth;
  _auth = getAuth(getApp());

  authReadyPromise = new Promise((resolve) => {
    authPromiseResolve = resolve;
  });

  onAuthStateChanged(_auth, (user) => {
    currentUser = user;
    if (!authReady) {
      authReady = true;
      authPromiseResolve(user);
    }
  });

  return _auth;
}

/**
 * Ensure the user is authenticated (anonymous).
 * Returns the current user, signing in anonymously if needed.
 */
export async function ensureAuth() {
  const auth = getAuthInstance();

  // Wait for initial auth state
  await authReadyPromise;

  if (currentUser) return currentUser;

  // Sign in anonymously
  const credential = await signInAnonymously(auth);
  currentUser = credential.user;
  return currentUser;
}
