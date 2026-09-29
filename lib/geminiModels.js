// One model chain, shared by the two Gemini callers in this repo.
//
// lib/aiParse.js  — browser, resume camera scan (NEXT_PUBLIC_GEMINI_API_KEY)
// lib/aiServer.js — server, experience review + Ask AI (server-only GEMINI_API_KEY)
//
// Both used to carry their own copy of this list, which is exactly how it goes stale: Google
// retires and renames models constantly, and a 404 on the first entry silently wastes a
// round-trip before falling through. Keep the chain here and bump it in one place.
//
// Verified against the live API: `gemini-2.5-flash` and `gemini-2.0-flash` are closed to
// new keys, and the un-suffixed `gemini-3-flash` does not exist — only `-preview` does.
// Set NEXT_PUBLIC_GEMINI_MODEL to override the first entry, and re-check with
// GET /v1beta/models?key=... before trusting anything in this list.

export const geminiModelChain = () => {
  const first = process.env.NEXT_PUBLIC_GEMINI_MODEL;
  const chain = [
    first,
    'gemini-3.8-flash',
    'gemini-3.7-flash',
    'gemini-3.6-flash',
    'gemini-3.5-flash',
    'gemini-3.1-flash-lite',
    'gemini-flash-latest',
    'gemini-3-flash-preview',
    'gemini-3.1-flash-lite-preview',
    'gemini-2.5-flash-lite',
    'gemini-2.5-flash',
    'gemini-2.0-flash',
  ];
  return [...new Set(chain.filter(Boolean))];
};

export const GEMINI_BASE_URL = () =>
  process.env.NEXT_PUBLIC_GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com';
