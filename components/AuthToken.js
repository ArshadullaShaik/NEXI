'use client';
// The single source of truth for "who is signed in".
//
// Deliberately thin: it holds the Firebase user object and the *readiness* of the auth
// check, nothing else. The ID token is never cached here — consumers call
// `user.getIdToken()` at request time (see lib/api.js) so a rotated or expired token can't
// cause a spurious 401. The browser never talks to Firestore directly, so ownership is
// always decided server-side in app/api/*.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, authConfigured, signInWithGoogle, signOutUser } from '@/lib/firebase/client';
import { setAccountResumes } from '@/lib/account';

const Ctx = createContext({
  user: null,
  ready: false,        // has the initial auth check finished?
  configured: false,   // are the NEXT_PUBLIC_FIREBASE_* vars present?
  error: '',           // human-readable, already mapped from Firebase codes
  signIn: async () => {},
  signOut: async () => {},
  clearError: () => {},
});
export const useAuth = () => useContext(Ctx);
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const configured = authConfigured();

  // onAuthStateChanged only settles once Firebase answers. On a bad authDomain, a captive
  // wifi portal, or plain offline, it never answers at all — which left the login button
  // stuck on "Checking sign-in…" with no way to retry and no way to reach the app. After this
  // long we treat the session as "nobody is signed in" and let the button work, so a bad
  // network degrades to a failed sign-in rather than a dead page.
  const AUTH_CHECK_TIMEOUT_MS = 8000;

  useEffect(() => {
    // No Firebase project on this machine: not an error, just "nobody is signed in".
    // The rest of the app keeps working, so we go straight to ready.
    if (!configured) { setReady(true); return; }
    let unsub = () => {};
    let settled = false;
    const settle = (fn) => { if (!settled) { settled = true; fn(); } };

    const timer = setTimeout(() => {
      settle(() => {
        setError('Could not reach the sign-in service. Check your connection, or continue without an account.');
        setReady(true);
      });
    }, AUTH_CHECK_TIMEOUT_MS);

    try {
      unsub = onAuthStateChanged(
        auth(),
        (u) => { clearTimeout(timer); settle(() => { setUser(u); setReady(true); }); },
        (e) => { clearTimeout(timer); settle(() => { setError(friendly(e)); setReady(true); }); }
      );
    } catch (e) {
      clearTimeout(timer);
      settle(() => { setError(friendly(e)); setReady(true); });
    }
    return () => { clearTimeout(timer); unsub(); };
  }, [configured]);

  const signIn = useCallback(async () => {
    setError('');
    try {
      const cred = await signInWithGoogle();
      return cred.user;
    } catch (e) {
      // A user who closes the picker has not made a mistake — don't scold them.
      if (e?.code === 'auth/popup-closed-by-user' || e?.code === 'auth/cancelled-popup-request') return null;
      setError(friendly(e));
      throw e;
    }
  }, []);

  const signOut = useCallback(async () => {
    setError('');
    try { await signOutUser(); } catch (e) { setError(friendly(e)); }
  }, []);

  const clearError = useCallback(() => setError(''), []);

  // Hand the resume library over to the account, exactly once per sign-in.
  //
  // This is the step lib/account.js was left waiting on: resumes parsed while signed out
  // live under `prc:resumes:device`, and signing in has to re-file them under the email or
  // "syncs across devices" is a lie. A ref (not state) because this is a side effect of the
  // transition, not a value anything renders from — and it must not re-run on every render
  // or it would rewrite the same library over and over.
  const adopted = useRef(null);
  useEffect(() => {
    if (!ready || !user?.email) return;
    if (adopted.current === user.email) return;
    adopted.current = user.email;
    try { setAccountResumes(user.email); } catch { /* a quota error must not block sign-in */ }
  }, [ready, user]);

  const value = useMemo(
    () => ({ user, ready, configured, error, signIn, signOut, clearError }),
    [user, ready, configured, error, signIn, signOut, clearError]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

/** Turns a Firebase auth error into something worth showing a student. */
function friendly(e) {
  const c = e?.code || '';
  if (c === 'auth/popup-blocked') return 'Your browser blocked the sign-in popup. Allow popups for this site and try again.';
  if (c === 'auth/network-request-failed') return 'Could not reach Google. Check your connection and try again.';
  if (c === 'auth/unauthorized-domain') return 'This domain is not authorised for sign-in yet — see the setup notes below.';
  if (c === 'auth/operation-not-allowed') return 'Google sign-in is not enabled for this Firebase project yet.';
  if (c === 'auth/account-exists-with-different-credential') return 'That email is already registered with another sign-in method.';
  if (/not configured/i.test(e?.message || '')) return 'Sign-in is not configured on this deployment yet.';
  return e?.message?.replace(/^Firebase:\s*/, '').replace(/\s*\(auth\/.+\)\.?$/, '') || 'Sign-in failed.';
}
