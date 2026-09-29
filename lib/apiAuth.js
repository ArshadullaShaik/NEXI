// Server-only request auth for app/api/*.
//
// Two ways in:
//   1. A signed-in student — Firebase ID token in the Authorization header.
//   2. The Google Apps Script webhook — the INGEST_SECRET in the x-ingest-secret header.

import 'server-only';
import { getAuth } from 'firebase-admin/auth';

const bearer = (req) => {
  const h = req.headers.get('authorization') || '';
  return h.startsWith('Bearer ') ? h.slice(7).trim() : '';
};

/** @returns {Promise<{uid: string|null, isIngest: boolean, error: string|null}>} */
export async function identify(req) {
  // The webhook path is not a user session, so it is checked first and only via the secret.
  const secret = req.headers.get('x-ingest-secret');
  if (secret) {
    const expected = process.env.INGEST_SECRET;
    if (!expected) return { uid: null, isIngest: false, error: 'INGEST_SECRET is not configured on the server.' };
    if (secret === expected) return { uid: 'ingest:google-forms', isIngest: true, error: null };
    return { uid: null, isIngest: false, error: 'Invalid ingest secret.' };
  }

  const token = bearer(req);
  if (!token) return { uid: null, isIngest: false, error: 'Sign in to continue.' };
  try {
    const decoded = await getAuth().verifyIdToken(token);
    return { uid: decoded.uid, isIngest: false, error: null };
  } catch {
    return { uid: null, isIngest: false, error: 'Your sign-in expired. Sign in again.' };
  }
}
