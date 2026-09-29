'use client';
// Browser -> app/api helper. Attaches a freshly-minted Firebase ID token to every call,
// and normalises server errors into a plain message the UI can show.

import { useAuth } from '@/components/AuthToken';

async function headers(user, json = false) {
  const h = json ? { 'Content-Type': 'application/json' } : {};
  if (user) {
    // Minted per request, not cached: a stale token would cause a spurious 401.
    const token = await user.getIdToken().catch(() => null);
    if (token) h.Authorization = `Bearer ${token}`;
  }
  return h;
}

/** Turns a non-2xx response into a thrown Error carrying the server's message. */
async function unwrap(res) {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Request failed (${res.status}).`);
  return body;
}

export function useApi() {
  const { user } = useAuth();

  return {
    async listExperiences(params = {}) {
      const qs = new URLSearchParams();
      for (const [k, v] of Object.entries(params)) if (v) qs.set(k, v);
      return unwrap(await fetch(`/api/experiences?${qs}`, { headers: await headers(user) }));
    },
    async submitExperience(payload) {
      return unwrap(await fetch('/api/experiences', {
        method: 'POST',
        headers: await headers(user, true),
        body: JSON.stringify(payload),
      }));
    },
    async deleteExperience(id) {
      return unwrap(await fetch(`/api/experiences/${id}`, { method: 'DELETE', headers: await headers(user) }));
    },
    async ask(payload) {
      return unwrap(await fetch('/api/experiences/ask', {
        method: 'POST',
        headers: await headers(user, true),
        body: JSON.stringify(payload),
      }));
    },
    async adminQueue(status = 'flagged') {
      return unwrap(await fetch(`/api/admin/experiences?status=${status}`, { headers: await headers(user) }));
    },
    async adminSet(id, status) {
      return unwrap(await fetch('/api/admin/experiences', {
        method: 'PATCH',
        headers: await headers(user, true),
        body: JSON.stringify({ id, status }),
      }));
    },
  };
}
