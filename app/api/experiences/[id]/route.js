// DELETE /api/experiences/[id]  -> the author or an admin deletes an entry.
// PATCH  /api/experiences/[id]  -> the author edits the raw text of a pending/flagged post.
//
// authorUid is never exposed by the GET routes, so ownership can only be decided here,
// server-side, against the verified caller.

import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { firestore, EXPERIENCES } from '@/lib/firebase/admin';
import { identify } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ADMINS = (process.env.ADMIN_UIDS || '').split(',').map((x) => x.trim()).filter(Boolean);

async function load(req, id) {
  const who = await identify(req);
  if (who.error) return { error: who.error, status: 401 };
  const snap = await firestore().collection(EXPERIENCES).doc(id).get();
  if (!snap.exists) return { error: 'That experience no longer exists.', status: 404 };
  const data = snap.data();
  const isOwner = who.uid && data.authorUid === who.uid;
  const isAdmin = ADMINS.includes(who.uid);
  if (!isOwner && !isAdmin) return { error: 'You can only change your own submission.', status: 403 };
  return { who, snap, isOwner, isAdmin };
}

export async function DELETE(req, { params }) {
  try {
    const ctx = await load(req, params.id);
    if (ctx.error) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
    await ctx.snap.ref.delete();
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[experiences DELETE]', e);
    return NextResponse.json({ error: 'Could not delete that entry.' }, { status: 500 });
  }
}

export async function PATCH(req, { params }) {
  try {
    const ctx = await load(req, params.id);
    if (ctx.error) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
    // Admins can set the published/flagged decision; authors can only edit their own words.
    if (ctx.isAdmin && !ctx.isOwner) {
      const body = await req.json();
      const status = body.status === 'published' ? 'published' : body.status === 'flagged' ? 'flagged' : null;
      if (!status) return NextResponse.json({ error: 'Unknown status.' }, { status: 400 });
      await ctx.snap.ref.update({ status, updatedAt: FieldValue.serverTimestamp() });
      return NextResponse.json({ ok: true, status });
    }

    const body = await req.json();
    const raw = typeof body.raw === 'string' ? body.raw.trim().slice(0, 8000) : '';
    if (raw.length < 80) return NextResponse.json({ error: 'Too short.' }, { status: 400 });
    await ctx.snap.ref.update({
      raw,
      status: 'pending', // edits send it back through the reviewer
      updatedAt: FieldValue.serverTimestamp(),
    });
    return NextResponse.json({ ok: true, status: 'pending' });
  } catch (e) {
    console.error('[experiences PATCH]', e);
    return NextResponse.json({ error: 'Could not update that entry.' }, { status: 500 });
  }
}
