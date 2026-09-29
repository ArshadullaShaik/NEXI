'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/components/AuthToken';
import { useApi } from '@/lib/api';
import { Card, Title, Empty, inp } from './ui';
import ShareForm from './ShareForm';
import AskAI from './AskAI';
import ExperienceCard from './ExperienceCard';
import AdminQueue from './AdminQueue';
import { Loader2, Search, AlertTriangle, MessagesSquare, Filter, RefreshCw } from 'lucide-react';

// Small debounce so typing in the filter box doesn't fire a request per keystroke.
function useDebounced(value, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

/**
 * The Share Your Experience page.
 *
 * Reading is open to everyone — the list endpoint only uses the session to mark your own
 * entries so the delete button appears. Writing (share + ask) needs a signed-in student,
 * because the server decides ownership from the verified uid and nothing else. That is a
 * soft gate: signed out, you still get the full feed and a clear way to sign in, rather
 * than a wall in front of content that is meant to be read.
 */
export default function ShareExperience() {
  const { companies } = useApp();
  const { user, configured } = useAuth();
  const api = useApi();
  const [items, setItems] = useState([]);
  const [rounds, setRounds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [setupGap, setSetupGap] = useState(false);

  const [company, setCompany] = useState('');
  const [round, setRound] = useState('');
  const [q, setQ] = useState('');
  const dq = useDebounced(q);

  const load = useCallback(async () => {
    setLoading(true); setErr(''); setSetupGap(false);
    try {
      const r = await api.listExperiences({ company, round, q: dq, limit: 30 });
      setItems(r.items || []);
      if (r.rounds) setRounds(r.rounds);
    } catch (e) {
      const m = e?.message || 'Could not load experiences.';
      // A missing Firestore service account is a deployment gap, not the student's
      // mistake — a red error string reads like one.
      setSetupGap(/not configured/i.test(m));
      setErr(m);
    } finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company, round, dq]);

  useEffect(() => { load(); }, [load]);

  // The server reviews before responding, so the entry's state is already known —
  // no polling and no guesswork about when it will appear.
  const onSubmit = async (payload) => {
    const r = await api.submitExperience(payload);
    load();
    return r;
  };

  const onDelete = async (id) => {
    if (!confirm('Delete this experience? This cannot be undone.')) return;
    try { await api.deleteExperience(id); setItems((x) => x.filter((i) => i.id !== id)); }
    catch (e) { setErr(e?.message || 'Could not delete that.'); }
  };

  // Companies in the feed that the local tracker has never heard of still deserve a filter
  // option — otherwise a shared experience for a company you don't track is unfilterable.
  const companyOptions = useMemo(() => {
    const fromFeed = items.map((e) => e.company).filter(Boolean);
    const fromTracker = companies.map((c) => c.name).filter(Boolean);
    return [...new Set([...fromFeed, ...fromTracker])].sort((a, b) => a.localeCompare(b));
  }, [items, companies]);

  return (
    <>
      <Title
        t="Share Your Experience"
        s="Real reports from seniors who sat the same interviews. Read them, ask the AI, and add your own so the next batch is better prepared."
      />

      {!setupGap && !user && configured && (
        <Card className="p-4 mb-4 flex flex-wrap items-center gap-3 border-indigo-200 bg-indigo-50/60">
          <p className="text-sm text-slate-700 mr-auto leading-relaxed">
            <b>You’re browsing as a guest.</b> Everything here is public — sign in to share your own
            interview and to ask the AI questions.
          </p>
          <Link href="/login" className="text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 px-3.5 py-2 rounded-lg">
            Sign in
          </Link>
        </Card>
      )}

      <div className="space-y-4 mb-6">
        <AskAI companies={companyOptions} signedIn={Boolean(user)} />
        <ShareForm companies={companyOptions} onDone={onSubmit} signedIn={Boolean(user)} />
      </div>

      <div className="space-y-4">
        {/* Self-denies for signed-out and non-admin users, so it costs nothing to always mount. */}
        <AdminQueue />

        <Card className="p-5">
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <h2 className="font-medium flex items-center gap-2 mr-auto text-slate-900">
              <MessagesSquare size={16} className="text-indigo-500" /> {items.length} shared {items.length === 1 ? 'experience' : 'experiences'}
            </h2>
            <button type="button" onClick={load} disabled={loading}
              title="Refresh" aria-label="Refresh experiences"
              className="shrink-0 h-9 w-9 grid place-items-center rounded-lg border border-slate-300 bg-white text-slate-500 hover:text-slate-800 hover:bg-slate-50 disabled:opacity-50">
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
            <input className={`${inp} !w-auto flex-1 sm:flex-none`} placeholder="Search experiences…" aria-label="Search experiences" value={q} onChange={(e) => setQ(e.target.value)} />
            <select className={`${inp} !w-auto`} value={company} onChange={(e) => setCompany(e.target.value)} aria-label="Filter by company">
              <option value="">All companies</option>
              {companyOptions.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
            <select className={`${inp} !w-auto`} value={round} onChange={(e) => setRound(e.target.value)} aria-label="Filter by round">
              <option value="">All rounds</option>
              {rounds.map((r) => <option key={r}>{r}</option>)}
            </select>
          </div>

          {loading ? (
            <p className="text-sm text-slate-400 flex items-center gap-2 justify-center py-10">
              <Loader2 size={15} className="animate-spin" /> Loading experiences…
            </p>
          ) : setupGap ? (
            <div className="text-center py-10 px-4 max-w-lg mx-auto">
              <AlertTriangle size={28} className="mx-auto mb-2 text-amber-500" />
              <p className="text-sm font-medium text-slate-700">Shared experiences aren’t set up on this deployment</p>
              <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">
                The rest of the app is unaffected. To switch this on, add the server-only{' '}
                <code className="bg-slate-100 px-1 rounded text-[13px]">FIREBASE_PROJECT_ID</code>,{' '}
                <code className="bg-slate-100 px-1 rounded text-[13px]">FIREBASE_CLIENT_EMAIL</code> and{' '}
                <code className="bg-slate-100 px-1 rounded text-[13px]">FIREBASE_PRIVATE_KEY</code> variables
                from <code className="bg-slate-100 px-1 rounded text-[13px]">.env.example</code>, then restart the server.
              </p>
            </div>
          ) : err ? (
            <p className="text-sm text-red-600 flex items-center gap-1.5 justify-center py-10">
              <AlertTriangle size={14} /> {err}
            </p>
          ) : items.length === 0 ? (
            <Empty
              icon={Filter}
              text={q || company || round
                ? 'No shared experience matches these filters. Try clearing them, or be the first to write about this company.'
                : 'Nobody has shared an experience yet. Be the first — the next batch is reading your notes right now.'}
              action={q || company || round ? 'Clear filters' : undefined}
              onAction={q || company || round ? () => { setQ(''); setCompany(''); setRound(''); } : undefined}
            />
          ) : (
            <div className="space-y-3">
              {items.map((e) => <ExperienceCard key={e.id} exp={e} onDelete={() => onDelete(e.id)} canDelete={e.mine} />)}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
