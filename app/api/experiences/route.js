// GET  /api/experiences   -> published experiences, filtered + ranked
// POST /api/experiences   -> submit one (in-app form or Google Apps Script webhook)
//
// The Google Form path is deliberately supported as a first-class alternative to the
// in-app form: it hits the exact same endpoint, so there is one validation + review path.

import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { firestore, EXPERIENCES } from '@/lib/firebase/admin';
import { identify } from '@/lib/apiAuth';
import { reviewExperience, aiConfigured, prefilter } from '@/lib/aiServer';
import { rankExperiences, normaliseSkills, ROUNDS, toPublic } from '@/lib/experienceSearch';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Firestore being unconfigured is a setup problem, not a runtime failure, so it is
 * reported as 503 with an actionable message instead of a generic 500.
 */
function firestoreError(e) {
  if (/not configured/i.test(e?.message || '')) {
    return NextResponse.json(
      { error: 'The database is not configured yet. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY in .env.local.' },
      { status: 503 }
    );
  }
  console.error('[experiences]', e);
  return NextResponse.json({ error: 'Could not load experiences right now.' }, { status: 500 });
}

const MAX_RAW = 8000;
const s = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const int = (v) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n > 1990 && n < 2100 ? n : null;
};
const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n <= 10 ? Math.round(n * 100) / 100 : null;
};

// ---------------------------------------------------------------------------
// GET
// ---------------------------------------------------------------------------
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20', 10) || 20));

    // Read-only, so an anonymous or expired session is fine — we just can't mark `mine`.
    let uid = null;
    try { uid = (await identify(req)).uid; } catch { /* anonymous */ }

    const snap = await firestore().collection(EXPERIENCES).where('status', '==', 'published').limit(300).get();
    const rows = rankExperiences(
      snap.docs.map((d) => ({ id: d.id, ...d.data() })),
      {
        company: searchParams.get('company') || '',
        role: searchParams.get('role') || '',
        round: searchParams.get('round') || '',
        q: searchParams.get('q') || '',
        limit,
      }
    );

    return NextResponse.json({ items: rows.map((d) => toPublic(d, uid)), rounds: ROUNDS });
  } catch (e) {
    return firestoreError(e);
  }
}

// ---------------------------------------------------------------------------
// POST
// ---------------------------------------------------------------------------
export async function POST(req) {
  let who;
  try {
    who = await identify(req);
  } catch (e) {
    return NextResponse.json({ error: e?.message || 'Could not verify who you are.' }, { status: 500 });
  }
  if (who.error) return NextResponse.json({ error: who.error }, { status: 401 });

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const company = s(body.company, 80);
  const role = s(body.role, 80);
  const raw = s(body.raw ?? body.experience, MAX_RAW);
  const round = ROUNDS.includes(s(body.round, 24)) ? s(body.round, 24) : 'Other';

  if (!company) return NextResponse.json({ error: 'Company is required.' }, { status: 400 });
  if (!role) return NextResponse.json({ error: 'Role is required.' }, { status: 400 });
  if (raw.length < 80) {
    return NextResponse.json(
      { error: 'Please write at least a few sentences (80+ characters) so others can learn from it.' },
      { status: 400 }
    );
  }

  const entry = {
    company,
    role,
    round,
    batchYear: int(body.batchYear),
    cgpa: num(body.cgpa),
    branch: s(body.branch, 40) || null,
    raw,
    // Default to a non-identifying label; a signed-in student gets their branch/year.
    authorLabel: who.isIngest ? 'Anonymous senior' : s(body.authorLabel, 40) || 'Anonymous senior',
    authorUid: who.uid,
    source: who.isIngest ? 'google-form' : 'app',
    summary: '',
    topics: [],
    questions: [],
    skills: normaliseSkills(body.skills),
    quality: 0,
    flags: [],
    status: 'pending', // the reviewer decides; 'pending' is never readable by juniors
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  // Near-duplicate check. Firestore cannot query a hash field it does not know about, so
  // we fetch a small window of recent entries for the same company and compare fingerprints.
  // This stops the same text being submitted repeatedly from burning a review call each time.
  let duplicate = false;
  try {
    const recent = await firestore()
      .collection(EXPERIENCES)
      .where('company', '==', entry.company)
      .limit(20)
      .get();
    const fingerprint = (s) => String(s || '').toLowerCase().replace(/\W+/g, '').slice(0, 240);
    const mine = fingerprint(raw);
    duplicate = recent.docs.some((d) => fingerprint(d.data().raw) === mine);
  } catch {
    // A failed duplicate check must not block the submission.
  }

  let ref;
  try {
    ref = await firestore().collection(EXPERIENCES).add(entry);
  } catch (e) {
    return firestoreError(e);
  }

  // The review MUST be awaited. A fire-and-forget promise gets frozen the moment the
  // response is sent on a serverless host, which would strand the entry in 'pending'
  // forever. Waiting costs the student a few seconds but guarantees a decision.
  const decide = async () => {
    // Cheap local checks first: anything obviously unusable is held for a human without
    // spending a Gemini call, which is what keeps this inside a free-tier quota.
    const skip = prefilter(entry, { duplicate });
    if (skip) {
      await ref.update({
        status: 'flagged',
        flags: [skip],
        summary: raw.slice(0, 600),
        updatedAt: FieldValue.serverTimestamp(),
      });
      return 'flagged';
    }

    if (!aiConfigured()) {
      await ref.update({
        status: 'flagged',
        flags: ['ai-not-configured'],
        summary: raw.slice(0, 600),
        updatedAt: FieldValue.serverTimestamp(),
      });
      return 'flagged';
    }
    try {
      const out = await reviewExperience(entry);
      if (!out.ok) {
        await ref.update({
          status: 'flagged',
          flags: ['review-failed'],
          summary: raw.slice(0, 600),
          updatedAt: FieldValue.serverTimestamp(),
        });
        return 'flagged';
      }
      await ref.update({
        summary: out.review.summary,
        topics: out.review.topics,
        questions: out.review.questions,
        skills: normaliseSkills(out.review.skills),
        quality: out.review.quality,
        flags: out.review.flags,
        status: out.review.status,
        reviewer: out.model,
        updatedAt: FieldValue.serverTimestamp(),
      });
      return out.review.status;
    } catch (e) {
      console.error('[experiences POST] review', e);
      await ref
        .update({ flags: ['review-error'], updatedAt: FieldValue.serverTimestamp() })
        .catch(() => {});
      return 'pending';
    }
  };

  const status = await decide();
  return NextResponse.json({ id: ref.id, status }, { status: 201 });
}
