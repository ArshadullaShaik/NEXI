'use client';
// Saved-resume library.
//
// Resumes you parse are kept in localStorage and re-usable from the "Your saved resumes"
// list. Which storage slot they land in depends on whether you are signed in:
//
//   signed out  -> prc:resumes:device   (this device only)
//   signed in   -> prc:resumes:<email> (re-filed on sign-in, so signing in on another
//                                           device brings them back)
//
// Sign-in itself lives in components/AuthToken.js, which calls setAccountResumes() once the
// user is confirmed. This module stays account-agnostic: it only knows the storage keys.

import { useEffect, useSyncExternalStore } from 'react';

const MAX_SAVED = 10;
const deviceKey = 'prc:resumes:device';
const accountKey = (email) => `prc:resumes:${email}`;

// Who the library currently belongs to. Module-level because this store already is
// module-level; it is set by setAccountResumes() and read by persist().
let owner = null;

let state = { ready: false, resumes: [] };
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
  const resumes = readJson(deviceKey) || [];
  state = { ready: true, resumes: Array.isArray(resumes) ? resumes : [] };
  emit();
}

// Signed in, write to the account slot; signed out, to the device slot. Without this the
// first resume saved after signing in would be written device-side and then never come
// back on a second sign-in — the migration above is one-way otherwise.
const persist = () => writeJson(owner ? accountKey(owner) : deviceKey, state.resumes);

/** Subscribe to { ready, resumes } + actions. */
export function useAccount() {
  useEffect(() => { hydrate(); }, []);
  const s = useSyncExternalStore(subscribe, snapshot, snapshot);
  return { ...s, saveResume, deleteResume, shareResume };
}

/**
 * Adopt a signed-in account's resume library — called once per sign-in from
 * components/AuthToken.js. Resumes already on this device are carried over, so signing in
 * after the fact never loses anything. Pass null to go back to device-only storage.
 */
export function setAccountResumes(email) {
  owner = email || null;
  const mine = email ? (readJson(accountKey(email)) || []) : [];
  const device = readJson(deviceKey) || [];
  const merged = [...mine];
  for (const r of device) if (!merged.some((m) => m.text === r.text)) merged.push(r);
  merged.sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
  const trimmed = merged.slice(0, MAX_SAVED);
  if (email) {
    state = { ready: true, resumes: trimmed };
    writeJson(accountKey(email), trimmed);
    try { localStorage.removeItem(deviceKey); } catch { /* ignore */ }
  } else {
    state = { ready: true, resumes: device };
  }
  emit();
  return trimmed;
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
