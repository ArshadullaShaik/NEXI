// Firebase *client* SDK, for Google sign-in only.
//
// Every read/write of shared data goes through app/api/* with firebase-admin — the browser
// never talks to Firestore directly, so no Firestore security rules are needed and the
// service account stays server-side.
//
// The whole module is inert until the NEXT_PUBLIC_FIREBASE_* vars are present, so the app
// still boots (and the saved-resume library still works) on a machine with no Firebase
// project. `authConfigured()` is what the UI checks before offering to sign in.

import { initializeApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';

const cfg = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

/** False when the env vars are missing — the app falls back to a clear setup notice. */
export const authConfigured = () => Boolean(cfg.apiKey && cfg.authDomain && cfg.projectId);

let cached = null;
function auth() {
  if (cached) return cached;
  if (!authConfigured()) {
    throw new Error('Firebase Auth is not configured. Set the NEXT_PUBLIC_FIREBASE_* vars (see .env.example).');
  }
  const app = getApps().length ? getApps()[0] : initializeApp(cfg);
  cached = getAuth(app);
  return cached;
}

/**
 * One code path for both "Sign in" and "Create account".
 *
 * Google is the only provider, so a first-time user and a returning user hit the exact same
 * button — Firebase creates the account on first use. `prompt: 'select_account'` forces the
 * account chooser every time, which is what you want on a shared lab machine: without it
 * you silently sign in as whoever used it last.
 */
export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  return signInWithPopup(auth(), provider);
}

export async function signOutUser() {
  return signOut(auth());
}

export { auth };
