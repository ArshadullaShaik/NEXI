// GET   /api/admin/experiences?status=flagged  -> the review queue (admins only)
// PATCH /api/admin/experiences                   -> { id, status: 'published' | 'flagged' | 'deleted' }
//
// The Gemini reviewer auto-publishes clean submissions, so this queue only holds the
// exceptions: spam, abuse, too-short text, and reviews that failed to run.

import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { firestore, EXPERIENCES } from '@/lib/firebase/admin';
import { identify } from '@/lib/apiAuth';
import { normaliseDates } from '@/lib/experienceSearch';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ADMINS = (process.env.ADMIN_UIDS || '').split(',').map((x) => x.trim()).filter(Boolean);

/** True only for a signed-in uid listed in ADMIN_UIDS. */
async function requireAdmin(req) {
  const who = await identify(req);
  if (who.error) return { error: who.error, status: 401 };
  if (!ADMINS.includes(who.uid)) {
    return { error: 'Admins only. Add your Firebase uid to ADMIN_UIDS to get access.', status: 403 };
  }
  return { who };
}

export async function GET(req) {
  try {
    const gate = await requireAdmin(req);
    if (gate.error) return NextResponse.json({ error: gate.error }, { status: gate.status });

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || 'flagged';
    const where = status === 'all' ? null : { field: 'status', op: '==', value: status };

    const q = where
      ? firestore().collection(EXPERIENCES).where(where.field, where.op, where.value)
      : firestore().collection(EXPERIENCES);

    const snap = await q.orderBy('createdAt', 'desc').limit(100).get();
    return NextResponse.json({
      items: snap.docs.map((d) => ({ id: d.id, ...normaliseDates(d.data()) })),
      isAdmin: true,
    });
  } catch (e) {
    console.error('[admin/experiences GET]', e);
    return NextResponse.json({ error: 'Could not load the review queue.' }, { status: 500 });
  }
}

export async function PATCH(req) {
  try {
    const gate = await requireAdmin(req);
    if (gate.error) return NextResponse.json({ error: gate.error }, { status: gate.status });

    const { id, status } = await req.json();
    if (!id) return NextResponse.json({ error: 'Missing id.' }, { status: 400 });
    const ref = firestore().collection(EXPERIENCES).doc(id);

    if (status === 'deleted') {
      await ref.delete();
      return NextResponse.json({ ok: true });
    }
    if (status !== 'published' && status !== 'flagged') {
      return NextResponse.json({ error: 'Unknown status.' }, { status: 400 });
    }
    await ref.update({ status, reviewedBy: gate.who.uid, updatedAt: FieldValue.serverTimestamp() });
    return NextResponse.json({ ok: true, status });
  } catch (e) {
    console.error('[admin/experiences PATCH]', e);
    return NextResponse.json({ error: 'Could not update that entry.' }, { status: 500 });
  }
}
