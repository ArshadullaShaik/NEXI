// Server-only Firebase Admin init.
//
// Uses the service-account env vars rather than Application Default Credentials, because
// Vercel has no keyfile on disk. Cached on globalThis so Next's dev hot-reload doesn't
// re-initialise (which throws "Firebase App already exists").
//
// Init is LAZY: importing this module must not throw, or `next build` fails while
// collecting page data on any machine without credentials.

import 'server-only';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

function init() {
  if (getApps().length) return getApps()[0];

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  // Newlines arrive escaped (\n) when the key is set through a Vercel env var.
  const privateKey = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      'Firebase Admin is not configured. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL ' +
        'and FIREBASE_PRIVATE_KEY (see .env.example).'
    );
  }
  return initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}

/** Throws a clear, actionable message if credentials are missing. */
export function firestore() {
  return getFirestore(init());
}

export const EXPERIENCES = 'experiences';
