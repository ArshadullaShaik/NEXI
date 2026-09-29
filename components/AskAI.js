'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Card, inp } from './ui';
import { ROUNDS } from '@/lib/experienceSearch';
import { useApi } from '@/lib/api';
import { Sparkles, Loader2, AlertTriangle, Globe, Quote, ExternalLink, Search, LogIn, RefreshCw } from 'lucide-react';

/**
 * The "ask the AI" box. Retrieval is company/role/round-filtered; when the database has
 * nothing solid the answer is served from a web search and labelled as such, with sources.
 *
 * That label is the whole point of the feature. A model that quietly blends web results
 * into "what seniors told me" is a lie, and it is the exact failure mode that a retrieval
 * box like this exists to prevent — so `grounded: false` is always rendered, never inferred.
 */
export default function AskAI({ companies, signedIn }) {
  const api = useApi();
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [round, setRound] = useState('');
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [res, setRes] = useState(null);

  const ask = async (e) => {
    e.preventDefault();
    setErr(''); setRes(null);
    if (q.trim().length < 8) return setErr('Ask a fuller question (at least 8 characters).');
    setBusy(true);
    try {
      setRes(await api.ask({ question: q.trim(), company, role, round }));
    } catch (ex) {
      setErr(ex?.message || 'The AI could not answer that.');
    } finally { setBusy(false); }
  };

  return (
    <Card className="p-5">
      <h2 className="font-medium mb-1 flex items-center gap-2 text-slate-900">
        <Sparkles size={16} className="text-indigo-500" /> Ask AI about a company
      </h2>
      <p className="text-xs text-slate-400 mb-4 leading-relaxed">
        Answers are built from what seniors actually wrote here. If nobody has covered it, the AI will say so
        and may search the web instead — that answer is clearly marked.
      </p>

      <form onSubmit={ask} className="space-y-3">
        <div className="grid sm:grid-cols-3 gap-3">
          <div>
            <label className="sr-only" htmlFor="ask-company">Company</label>
            <select id="ask-company" className={inp} value={company} onChange={(e) => setCompany(e.target.value)}>
              <option value="">Any company</option>
              {companies.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </div>
          <div>
            <label className="sr-only" htmlFor="ask-role">Role (optional)</label>
            <input id="ask-role" className={inp} placeholder="Role (optional)" value={role} onChange={(e) => setRole(e.target.value)} />
          </div>
          <div>
            <label className="sr-only" htmlFor="ask-round">Round</label>
            <select id="ask-round" className={inp} value={round} onChange={(e) => setRound(e.target.value)}>
              <option value="">Any round</option>
              {ROUNDS.map((r) => <option key={r}>{r}</option>)}
            </select>
          </div>
        </div>
        <div className="flex gap-2">
          <label className="sr-only" htmlFor="ask-q">Your question</label>
          <input id="ask-q" className={inp} placeholder="e.g. What actually gets asked in the Google OA?"
            value={q} onChange={(e) => setQ(e.target.value)} />
          <button type="submit" disabled={busy || q.trim().length < 8}
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg whitespace-nowrap">
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />} Ask
          </button>
        </div>
      </form>

      {!signedIn && (
        <p className="mt-3 text-xs text-slate-400 flex flex-wrap items-center gap-x-1.5">
          <LogIn size={13} />
          <span>
            Asking uses the server&apos;s AI key, so it needs an account.{' '}
            <Link href="/login" className="text-indigo-600 hover:underline font-medium">Sign in</Link> to ask.
          </span>
        </p>
      )}

      {err && <p role="alert" className="mt-4 text-sm text-red-600 flex items-start gap-1.5 leading-snug"><AlertTriangle size={14} className="shrink-0 mt-0.5" />{err}</p>}

      {res && (
        <div className="mt-5 space-y-3">
          {res.grounded ? (
            <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
              Answered from {res.retrieved} real {res.retrieved === 1 ? 'experience' : 'experiences'} shared on this page.
            </p>
          ) : (
            <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 leading-relaxed">
              <b>Not from student experiences.</b> Nobody here has covered this, so the AI searched the web.
              Treat it as a starting point, not as a real placement report.
            </div>
          )}

          <p className="text-sm text-slate-800 whitespace-pre-line">{res.answer}</p>

          {!!res.sources?.length && (
            <div>
              <p className="text-xs text-slate-500 mb-1.5 flex items-center gap-1"><Globe size={12} /> Sources</p>
              <div className="flex flex-wrap gap-1.5">
                {res.sources.map((s) => (
                  <a key={s.uri} href={s.uri} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs bg-white border border-slate-200 text-indigo-600 hover:border-indigo-400 rounded-full px-2 py-0.5">
                    {s.title} <ExternalLink size={10} />
                  </a>
                ))}
              </div>
            </div>
          )}

          {!!res.usedExperiences?.length && (
            <div>
              <p className="text-xs text-slate-500 mb-1.5 flex items-center gap-1"><Quote size={12} /> Drawn from</p>
              <div className="flex flex-wrap gap-1.5">
                {res.usedExperiences.map((e) => (
                  <span key={e.id} className="text-xs bg-slate-50 border border-slate-200 text-slate-600 rounded-full px-2 py-0.5">
                    {e.company} · {e.role} · {e.round}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Same question, same filters = same answer, and the server cached it. Make that
              visible so nobody wonders why the second ask was suspiciously instant. */}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button type="button" onClick={ask} disabled={busy}
              className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-indigo-600 disabled:opacity-50">
              <RefreshCw size={12} className={busy ? 'animate-spin' : ''} /> Ask again
            </button>
            {res.cached && <span className="text-xs text-slate-400">Served from cache — same question, same answer.</span>}
          </div>
        </div>
      )}
    </Card>
  );
}
