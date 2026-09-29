'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Card, inp } from './ui';
import { ROUNDS } from '@/lib/experienceSearch';
import { useApp } from '@/context/AppContext';
import { Send, Loader2, AlertTriangle, CheckCircle2, Sparkles, LogIn } from 'lucide-react';

const MIN = 80;
const BLANK = { company: '', role: '', round: 'OA', batchYear: '', cgpa: '', branch: '', raw: '' };

const field = 'block text-xs font-medium text-slate-600 mb-1';

/**
 * In-app submission form. Deliberately mirrors the Google Form so students who prefer
 * either path end up in the same collection, with the same review.
 *
 * Every field is labelled rather than placeholder-only: this is the one form in the app
 * where a screen-reader user has to read back what they typed before it becomes public,
 * and placeholders vanish the moment you start typing.
 */
export default function ShareForm({ companies, onDone, signedIn }) {
  const { profile } = useApp();
  const [f, setF] = useState(BLANK);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');

  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const written = f.raw.trim().length;

  // One tap to prefill from the resume profile the student already parsed.
  const prefill = () => {
    if (!profile) return;
    const filled = [];
    setF((x) => {
      const next = { ...x };
      if (!next.cgpa && profile.cgpa != null) { next.cgpa = String(profile.cgpa); filled.push('CGPA'); }
      if (!next.branch && profile.branch) { next.branch = profile.branch; filled.push('branch'); }
      return next;
    });
    setErr('');
    setOk(filled.length
      ? `Filled in your ${filled.join(' and ')} from your parsed profile.`
      : 'Your profile had nothing to add — CGPA and branch are already filled in or missing.');
  };

  const submit = async (e) => {
    e.preventDefault();
    setErr(''); setOk('');
    if (!f.company.trim()) return setErr('Which company was this for?');
    if (!f.role.trim()) return setErr('Which role were you interviewing for?');
    if (written < MIN) {
      return setErr(`Write at least ${MIN} characters so the experience is actually useful to someone.`);
    }
    setBusy(true);
    try {
      const res = await onDone({
        company: f.company.trim(),
        role: f.role.trim(),
        round: f.round,
        batchYear: f.batchYear || null,
        cgpa: f.cgpa === '' ? null : f.cgpa,
        branch: f.branch.trim(),
        raw: f.raw.trim(),
      });
      setOk(
        res?.status === 'published'
          ? 'Published. The AI reviewed it and it is live in the feed below.'
          : res?.status === 'flagged'
            ? 'Saved, but it is queued for a human review — it will appear once approved.'
            : 'Submitted. It will appear in the feed shortly.'
      );
      setF(BLANK);
    } catch (ex) {
      setErr(ex?.message || 'Could not submit that.');
    } finally { setBusy(false); }
  };

  if (!signedIn) {
    return (
      <Card className="p-5">
        <h2 className="font-medium flex items-center gap-2 text-slate-900">
          <Send size={15} className="text-indigo-500" /> Share your experience
        </h2>
        <p className="text-sm text-slate-500 mt-2 leading-relaxed max-w-lg">
          Signing in is what tells the server this write-up is yours — it is how the delete button
          works and how abuse is traced. It takes one Google tap.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Link href="/login" className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg">
            <LogIn size={15} /> Sign in to share
          </Link>
          <Link href="/signup" className="text-sm font-medium text-indigo-600 hover:underline">New here? Create an account</Link>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3 mb-1">
        <h2 className="font-medium flex items-center gap-2 text-slate-900">
          <Send size={15} className="text-indigo-500" /> Share your experience
        </h2>
        {profile && (
          <button type="button" onClick={prefill}
            className="text-xs text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-1 shrink-0">
            <Sparkles size={12} /> Fill from my profile
          </button>
        )}
      </div>
      <p className="text-xs text-slate-400 mb-4 leading-relaxed">
        An AI reviewer reads every submission, rewrites it so juniors can use it, and checks it for spam.
        Identical submissions sent through the Google Form land in the same place.
      </p>

      <form onSubmit={submit} className="space-y-3">
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className={field} htmlFor="ex-company">Company</label>
            <input id="ex-company" className={inp} list="share-companies" placeholder="e.g. Google" value={f.company} onChange={set('company')} required />
            <datalist id="share-companies">{companies.map((name) => <option key={name} value={name} />)}</datalist>
          </div>
          <div>
            <label className={field} htmlFor="ex-role">Role</label>
            <input id="ex-role" className={inp} placeholder="e.g. SDE Intern" value={f.role} onChange={set('role')} required />
          </div>
          <div>
            <label className={field} htmlFor="ex-round">Round</label>
            <select id="ex-round" className={inp} value={f.round} onChange={set('round')}>
              {ROUNDS.map((r) => <option key={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className={field} htmlFor="ex-batch">Batch year <span className="font-normal text-slate-400">(optional)</span></label>
            <input id="ex-batch" className={inp} type="number" min="2000" max="2100" placeholder="e.g. 2026" value={f.batchYear} onChange={set('batchYear')} />
          </div>
          <div>
            <label className={field} htmlFor="ex-cgpa">CGPA <span className="font-normal text-slate-400">(optional)</span></label>
            <input id="ex-cgpa" className={inp} type="number" step="0.01" min="0" max="10" placeholder="8.4" value={f.cgpa} onChange={set('cgpa')} />
          </div>
          <div>
            <label className={field} htmlFor="ex-branch">Branch <span className="font-normal text-slate-400">(optional)</span></label>
            <input id="ex-branch" className={inp} placeholder="e.g. CSE" value={f.branch} onChange={set('branch')} />
          </div>
        </div>

        <div>
          <label className={field} htmlFor="ex-raw">
            Your write-up
            <span className="font-normal text-slate-400"> — what was the process like, which rounds did you face, what did they ask?</span>
          </label>
          <textarea
            id="ex-raw" className={`${inp} h-36`} aria-describedby="ex-count"
            placeholder="Round 1 was an OA on arrays and hashing — 45 minutes, 30 questions, you get partial credit…"
            value={f.raw} onChange={set('raw')}
          />
        </div>
        {/* A progress bar, not just a number: "60 to go" is a chore, a filling bar is a nudge. */}
        <div id="ex-count" className="flex items-center gap-2.5">
          <div className="h-1.5 flex-1 max-w-[16rem] rounded-full bg-slate-100 overflow-hidden" aria-hidden="true">
            <div className={`h-full rounded-full transition-all duration-300 ${written >= MIN ? 'bg-emerald-500' : 'bg-indigo-400'}`}
              style={{ width: `${Math.min(100, (written / MIN) * 100)}%` }} />
          </div>
          <p className="text-xs text-slate-400">
            {written >= MIN
              ? <span className="text-emerald-600">{written} characters</span>
              : <>{written} characters · {MIN - written} to go</>}
          </p>
        </div>

        {/* role=alert so validation and server errors are announced to screen readers */}
        {err && <p role="alert" className="text-sm text-red-600 flex items-start gap-1.5 leading-snug"><AlertTriangle size={14} className="shrink-0 mt-0.5" />{err}</p>}
        {ok && <p role="status" className="text-sm text-emerald-600 flex items-start gap-1.5 leading-snug"><CheckCircle2 size={14} className="shrink-0 mt-0.5" />{ok}</p>}

        <div className="flex flex-wrap items-center gap-2">
          <button type="submit" disabled={busy || written < MIN}
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg">
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Submit experience
          </button>
          <span className="text-xs text-slate-400">Posted under your branch/year, not your name.</span>
        </div>
      </form>
    </Card>
  );
}
