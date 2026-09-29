'use client';
// Account + saved-resume library.
//
// "Sign in with Google" reuses the same Google Identity Services token flow the
// Deadline Tracker uses (lib/googleCalendar.js) — no server, no client secret.
// Once signed in, every resume you parse is saved against your Google account
// (localStorage keyed by your email) so you can re-use it on any device where
// you sign in with the same account. Signed out, resumes are saved to this
// device only.

import { useEffect, useSyncExternalStore } from 'react';
import { CLIENT_ID, MAIL_SCOPE, requestToken, fetchProfile, revokeToken } from './googleCalendar';

const SESSION_KEY = 'prc:account';
const MAX_SAVED = 10;
const deviceKey = 'prc:resumes:device';
const accountKey = (email) => `prc:resumes:${email}`;

let state = { ready: false, user: null, resumes: [] };
const subs = new Set();
const emit = () => subs.forEach((f) => f());
const subscribe = (f) => { subs.add(f); return () => subs.delete(f); };
const snapshot = () => state;

const readJson = (key) => {
  try { const raw = localStorage.getItem(key); const v = raw ? JSON.parse(raw) : null; return v; } catch { return null; }
};
const writeJson = (key, v) => { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* quota */ } };

let hydrated = false;
function hydrate() {
  if (hydrated || typeof window === 'undefined') return;
  hydrated = true;
  let user = null;
  try { const raw = localStorage.getItem(SESSION_KEY); user = raw ? JSON.parse(raw) : null; } catch { user = null; }
  if (!user || typeof user.email !== 'string') user = null;
  const resumes = readJson(accountKey(user?.email)) || readJson(deviceKey) || [];
  state = { ready: true, user, resumes: Array.isArray(resumes) ? resumes : [] };
  emit();
}

const persist = () => {
  try {
    if (state.user) localStorage.setItem(SESSION_KEY, JSON.stringify(state.user));
    else localStorage.removeItem(SESSION_KEY);
  } catch { /* ignore */ }
  writeJson(accountKey(state.user?.email || 'device'), state.resumes);
};

/** Subscribe to { ready, user, resumes } + actions. */
export function useAccount() {
  useEffect(() => { hydrate(); }, []);
  const s = useSyncExternalStore(subscribe, snapshot, snapshot);
  return {
    ...s,
    googleReady: Boolean(CLIENT_ID),
    signIn,
    signOut,
    saveResume,
    deleteResume,
    shareResume,
  };
}

async function signIn() {
  if (!CLIENT_ID) throw new Error('missing-client-id');
  const token = await requestToken(MAIL_SCOPE);          // popup consent (first time)
  const user = await fetchProfile(token);                // { email, name, picture }
  const mine = readJson(accountKey(user.email)) || [];
  const device = readJson(deviceKey) || [];
  // Anything saved while signed out belongs to this person too — carry it over.
  const merged = [...mine];
  for (const r of device) {
    if (!merged.some((m) => m.text === r.text)) merged.push(r);
  }
  merged.sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
  state = { ready: true, user, resumes: merged.slice(0, MAX_SAVED) };
  try { localStorage.removeItem(deviceKey); } catch { /* ignore */ }
  persist();
  emit();
  return user;
}

function signOut() {
  const token = null; // tokens are short-lived; nothing stored to revoke
  revokeToken(token);
  state = { ready: true, user: null, resumes: readJson(deviceKey) || [] };
  persist();
  emit();
}

/**
 * Save the current resume (raw text + the profile snapshot that was parsed
 * from it). Saving the same text twice just refreshes the top entry.
 */
function saveResume({ text, profile, label, source }) {
  if (!text || text.trim().length < 10) return null;
  const entry = {
    id: 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    label: (label || 'Resume').slice(0, 80),
    source: source || 'text',
    savedAt: Date.now(),
    text,
    profile: profile || null,
  };
  const rest = state.resumes.filter((r) => r.text !== text);
  state = { ...state, resumes: [entry, ...rest].slice(0, MAX_SAVED) };
  persist();
  emit();
  return entry;
}

function deleteResume(id) {
  state = { ...state, resumes: state.resumes.filter((r) => r.id !== id) };
  persist();
  emit();
}

/**
 * "Send it properly": the Web Share sheet with the resume attached (phones),
 * plain share where only text is supported, and a .txt download as the last
 * resort (desktop browsers without sharing).
 */
async function shareResume({ label, text }) {
  const base = String(label || 'resume').replace(/\.[a-z0-9]+$/i, '').replace(/[^\w.\- ]+/gi, '_').trim().slice(0, 60) || 'resume';
  const filename = `${base}.txt`;
  const title = `Resume — ${base}`;
  const file = typeof File !== 'undefined' ? new File([text], filename, { type: 'text/plain' }) : null;

  if (file && navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title }); return 'shared'; }
    catch (e) { if (e?.name === 'AbortError') return 'cancelled'; /* try the text-only path */ }
  }
  if (navigator.share) {
    try { await navigator.share({ title, text }); return 'shared'; }
    catch (e) { if (e?.name === 'AbortError') return 'cancelled'; }
  }
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return `downloaded:${filename}`;
}
