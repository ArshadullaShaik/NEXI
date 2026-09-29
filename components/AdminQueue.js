'use client';
import { useCallback, useEffect, useState } from 'react';
import { useApi } from '@/lib/api';
import { useAuth } from './AuthToken';
import { Card, Empty, Badge } from './ui';
import { ShieldCheck, Loader2, AlertTriangle, Trash2, CheckCircle2 } from 'lucide-react';

const date = (ts) => {
  if (!ts) return '';
  const d = new Date(ts.seconds ? ts.seconds * 1000 : ts);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
};

// What each prefilter/AI flag actually means, so an admin decides rather than guesses.
const FLAG_HELP = {
  'too-short': 'Too short to help anyone — was it cut off in transit?',
  duplicate: 'Identical text already submitted for this company.',
  spam: 'Matched a spam keyword pattern.',
  'link-farm': 'Four or more links — that is a link farm, not a write-up.',
  repetitive: 'Very low unique-word ratio; looks pasted.',
  'personal-data': 'Contains a phone number, email, address or roll number.',
  'off-topic': 'Not about a placement interview.',
  'ai-not-configured': 'No server AI key, so nothing was reviewed. Check GEMINI_API_KEY.',
  'review-failed': 'The reviewer returned something unreadable.',
  'review-error': 'The reviewer threw. Check the server logs.',
};

/**
 * Exceptions only. Clean submissions are auto-published by the Gemini reviewer, so this
 * queue holds spam, abuse, too-short text, and reviews that failed to run.
 */
export default function AdminQueue() {
  const api = useApi();
  const { user, ready } = useAuth();
  const [items, setItems] = useState([]);
  const [state, setState] = useState('loading'); // loading | ready | denied
  const [err, setErr] = useState('');
  const [busyId, setBusyId] = useState('');

  const load = useCallback(async () => {
    setState('loading');
    try {
      const r = await api.adminQueue('flagged');
      setItems(r.items || []);
      setState('ready');
    } catch (e) {
      setErr(e?.message || 'Could not load the queue.');
      setState('denied');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Only fetch once we know who the caller is. A signed-out visitor gets nothing at all
  // rather than a "Sign in to continue" card: a moderation queue is not something a
  // student needs to be told exists, and the 401 it triggers is a dead end for them.
  useEffect(() => {
    if (!ready) return;
    if (!user) { setState('denied'); return; }
    load();
  }, [ready, user, load]);

  const act = async (id, status) => {
    if (status === 'deleted' && !confirm('Reject and permanently delete this submission?')) return;
    setBusyId(id); setErr('');
    try {
      await api.adminSet(id, status);
      setItems((x) => x.filter((i) => i.id !== id));
    } catch (e) {
      setErr(e?.message || 'That did not work.');
    } finally { setBusyId(''); }
  };

  // Signed out, or signed in but not an admin: render nothing. A 403 still means the
  // feature works, it just isn't for this account — showing an empty shell would be a lie.
  if (!ready || !user || state === 'denied') {
    return user ? (
      <Card className="p-5">
        <h2 className="font-medium mb-1 flex items-center gap-2 text-slate-900">
          <ShieldCheck size={16} className="text-slate-400" /> Review queue
        </h2>
        <p className="text-sm text-slate-500">{err}</p>
      </Card>
    ) : null;
  }

  return (
    <Card className="p-5">
      <h2 className="font-medium mb-1 flex items-center gap-2 text-slate-900">
        <ShieldCheck size={16} className="text-emerald-500" /> Review queue
        <Badge tone={items.length ? 'red' : 'slate'}>{items.length}</Badge>
      </h2>
      <p className="text-xs text-slate-400 mb-4">
        The AI reviewer auto-publishes clean submissions. Only the exceptions land here.
      </p>

      {err && <p role="alert" className="text-sm text-red-600 mb-3 flex items-start gap-1.5"><AlertTriangle size={14} className="shrink-0 mt-0.5" />{err}</p>}

      {state === 'loading' ? (
        <p className="text-sm text-slate-400 flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Loading…</p>
      ) : items.length === 0 ? (
        <Empty icon={ShieldCheck} text="Nothing to review. Every submission passed the AI check." />
      ) : (
        <ul className="space-y-3">
          {items.map((e) => {
            const at = date(e.createdAt);
            return (
              <li key={e.id} className="rounded-lg border border-slate-200 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                  <b className="text-sm">{e.company} · {e.role} · {e.round}</b>
                  <span className="flex flex-wrap gap-1.5">
                    {(e.flags || []).map((f) => (
                      <span key={f} title={FLAG_HELP[f] || f}><Badge tone="red">{f}</Badge></span>
                    ))}
                  </span>
                </div>
                {/* One flag's explanation is enough context to decide without opening anything. */}
                {e.flags?.length === 1 && FLAG_HELP[e.flags[0]] && (
                  <p className="text-xs text-amber-700 mb-2">{FLAG_HELP[e.flags[0]]}</p>
                )}
                <p className="text-sm text-slate-600 whitespace-pre-line">{e.raw}</p>
                <div className="flex flex-wrap items-center gap-2 mt-3">
                  <button type="button" onClick={() => act(e.id, 'published')} disabled={busyId === e.id}
                    className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-emerald-200 text-emerald-700 hover:bg-emerald-50 disabled:opacity-50">
                    <CheckCircle2 size={13} /> Approve
                  </button>
                  <button type="button" onClick={() => act(e.id, 'deleted')} disabled={busyId === e.id}
                    className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50">
                    <Trash2 size={13} /> Reject
                  </button>
                  <span className="text-xs text-slate-400 ml-auto">quality {Number(e.quality || 0).toFixed(2)}{at && ` · ${at}`}</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
