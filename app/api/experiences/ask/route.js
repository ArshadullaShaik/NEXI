// POST /api/experiences/ask
//
// Retrieval: published experiences filtered by company/role/round, keyword-ranked against
// the question, top 8. If that is too thin to answer from, Gemini is allowed to search the
// web and the response is tagged `grounded: false` so the UI can warn the reader.

import { NextResponse } from 'next/server';
import { firestore, EXPERIENCES } from '@/lib/firebase/admin';
import { identify } from '@/lib/apiAuth';
import { answerQuestion, aiConfigured } from '@/lib/aiServer';
import { rankExperiences } from '@/lib/experienceSearch';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// In-process cache of answers. Re-asking the same question is extremely common while
// exploring, and each one otherwise costs a Gemini call — the main way this feature
// exhausts a free-tier quota. Survives warm invocations, which is most of what matters.
const CACHE_TTL_MS = 30 * 60 * 1000;
const cache = new Map();

const cacheKey = ({ question, company, role, round }) =>
  [question.toLowerCase().replace(/\s+/g, ' ').trim(), company, role, round].join('|');

function cacheGet(key) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return hit.value;
}

// Keep the map from growing without bound on a long-lived server.
function cacheSet(key, value) {
  if (cache.size > 200) cache.delete(cache.keys().next().value);
  cache.set(key, { at: Date.now(), value });
}

export async function POST(req) {
  let who;
  try {
    who = await identify(req);
  } catch (e) {
    return NextResponse.json({ error: e?.message || 'Could not verify who you are.' }, { status: 500 });
  }
  if (who.error) return NextResponse.json({ error: who.error }, { status: 401 });

  if (!aiConfigured()) {
    return NextResponse.json(
      { error: 'The AI is not configured on the server yet. Set GEMINI_API_KEY (see .env.example).' },
      { status: 503 }
    );
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const question = typeof body.question === 'string' ? body.question.trim().slice(0, 500) : '';
  if (question.length < 8) {
    return NextResponse.json({ error: 'Ask a fuller question (at least 8 characters).' }, { status: 400 });
  }

  const company = typeof body.company === 'string' ? body.company.slice(0, 80) : '';
  const role = typeof body.role === 'string' ? body.role.slice(0, 80) : '';
  const round = typeof body.round === 'string' ? body.round.slice(0, 24) : '';

  const key = cacheKey({ question, company, role, round });
  const cached = cacheGet(key);
  if (cached) return NextResponse.json({ ...cached, cached: true });

  try {
    const snap = await firestore().collection(EXPERIENCES).where('status', '==', 'published').limit(300).get();
    const experiences = rankExperiences(
      snap.docs.map((d) => ({ id: d.id, ...d.data() })),
      { company, role, round, q: question, limit: 8 }
    );

    const out = await answerQuestion({ question, experiences, company, role, round });
    const payload = { ...out, retrieved: experiences.length, filters: { company, role, round } };
    // Web-grounded answers are not cached: they go stale, and they cost a search call.
    if (out.grounded) cacheSet(key, payload);
    return NextResponse.json(payload);
  } catch (e) {
    // A missing Firestore service account is a setup gap, not a user-facing failure.
    if (/not configured/i.test(e?.message || '')) {
      return NextResponse.json(
        { error: 'The database is not configured yet. Add the FIREBASE_* server vars to .env.local.' },
        { status: 503 }
      );
    }
    // Quota exhaustion is an operator problem, not the student's fault — say so plainly
    // and make clear it clears itself, since per-minute limits reset on their own.
    if (e?.quota) {
      return NextResponse.json(
        { error: 'The AI is busy right now and has hit its free-tier rate limit. It resets within a minute — try again shortly.', quota: true },
        { status: 429 }
      );
    }
    console.error('[experiences/ask]', e);
    return NextResponse.json(
      { error: e?.message || 'The AI could not answer that right now.' },
      { status: 500 }
    );
  }
}
