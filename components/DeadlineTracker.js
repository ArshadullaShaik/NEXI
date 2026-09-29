'use client';
import { useEffect, useMemo, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { evaluate, deadlineBadge, countdownLabel } from '@/lib/logic';
import { Card, Badge, Empty, statusTone } from './ui';
import { AlertCircle, AlertTriangle, Bookmark, CalendarCheck, CalendarClock, CalendarPlus, Check, CheckCircle2, ChevronDown, Loader2, LogOut, RefreshCw, Search, X } from 'lucide-react';
import { CLIENT_ID, MAIL_SCOPE, CAL_SCOPE, requestToken, revokeToken, fetchEmail, createDeadlineEvent, calendarLoginUrl, templateUrl } from '@/lib/googleCalendar';

const STATUSES = ['Not Applied', 'Applied', 'Interviewing'];
const FILTERS = ['All', 'Eligible Only', 'Applied', 'Bookmarked'];
const SORTS = [
  ['closest', 'Deadline — closest first'],
  ['farthest', 'Deadline — farthest first'],
  ['name-asc', 'Company — A to Z'],
  ['name-desc', 'Company — Z to A'],
  ['role-asc', 'Role — A to Z'],
  ['role-desc', 'Role — Z to A'],
];
const SORTERS = {
  closest: (a, b) => new Date(a.deadline) - new Date(b.deadline),
  farthest: (a, b) => new Date(b.deadline) - new Date(a.deadline),
  'name-asc': (a, b) => a.name.localeCompare(b.name),
  'name-desc': (a, b) => b.name.localeCompare(a.name),
  'role-asc': (a, b) => a.role.localeCompare(b.role),
  'role-desc': (a, b) => b.role.localeCompare(a.role),
};
const GCAL_KEY = 'prc:gcal';
const EVENTS_KEY = 'prc:gcal:events';
const readLS = (k, fb) => { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? fb; } catch { return fb; } };
const writeLS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

const CD_TONE = { red: 'text-red-600', yellow: 'text-amber-600', green: 'text-slate-600', slate: 'text-slate-400' };
const TEXT_TONE = { green: 'text-emerald-600', yellow: 'text-amber-600', red: 'text-red-600', slate: 'text-slate-400' };
const TOAST = {
  ok: { ring: 'border-emerald-200', chip: 'bg-emerald-50 text-emerald-600', Icon: CheckCircle2 },
  warn: { ring: 'border-amber-200', chip: 'bg-amber-50 text-amber-600', Icon: AlertTriangle },
  err: { ring: 'border-red-200', chip: 'bg-red-50 text-red-600', Icon: AlertCircle },
};
const initials = (n) => n.replace(/[^A-Za-z ]/g, ' ').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '??';

const noteFor = (e) => {
  const m = String(e?.message || e);
  if (m === 'missing-client-id') return { tone: 'warn', text: 'Calendar sync isn’t set up yet — connect Google from your account settings.' };
  if (m.includes('popup_closed') || m.includes('popup_failed') || m === 'access_denied' || m === 'closed') return { tone: 'warn', text: 'Google sign-in was cancelled — nothing changed.' };
  return { tone: 'err', text: `Google error: ${m}` };
};

export default function DeadlineTracker({ go }) {
  const { companies, profile, statuses, setStatus, bookmarks = {}, toggleBookmark } = useApp();
  const [now, setNow] = useState(() => Date.now());
  const [filter, setFilter] = useState('All');
  const [sort, setSort] = useState('closest');
  const [q, setQ] = useState('');
  // Google connection: identity + calendar flags persist, tokens stay in memory only.
  const [gcal, setGcal] = useState({ email: null, calendar: false });
  const [token, setToken] = useState(null);
  const [syncedMap, setSyncedMap] = useState({});
  const [busy, setBusy] = useState(''); // 'gmail' | 'calendar' | 'all' | company id
  const [note, setNote] = useState(null);

  // One shared clock so every countdown ticks live.
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  // Hydrate Google state and quietly refresh the token if we were connected before.
  useEffect(() => {
    const saved = readLS(GCAL_KEY, null);
    setSyncedMap(readLS(EVENTS_KEY, {}));
    if (saved?.email) {
      setGcal(saved);
      const scopes = saved.calendar ? `${MAIL_SCOPE} ${CAL_SCOPE}` : MAIL_SCOPE;
      requestToken(scopes, '').then(setToken).catch(() => {}); // best-effort; actions re-auth on click
    }
  }, []);

  // Toasts dismiss themselves: success lingers briefly, problems a little longer.
  useEffect(() => {
    if (!note) return undefined;
    const t = setTimeout(() => setNote(null), note.tone === 'ok' ? 4000 : 8000);
    return () => clearTimeout(t);
  }, [note]);

  const isEligible = (c) => !!profile && Array.isArray(profile.skills) && evaluate(profile, c).gate;
  const match = (c, f) => {
    const st = statuses[c.id] || 'Not Applied';
    if (f === 'Eligible Only') return isEligible(c);
    if (f === 'Applied') return st === 'Applied';
    if (f === 'Bookmarked') return !!bookmarks[c.id];
    return true;
  };

  const rows = useMemo(() => {
    const query = q.trim().toLowerCase();
    return companies
      .filter((c) => match(c, filter))
      .filter((c) => !query || c.role.toLowerCase().includes(query) || c.name.toLowerCase().includes(query))
      .sort((a, b) => SORTERS[sort](a, b) || new Date(a.deadline) - new Date(b.deadline) || a.name.localeCompare(b.name));
  }, [companies, statuses, bookmarks, profile, filter, sort, q]);

  const stats = useMemo(() => {
    const s = { urgent: 0, closing: 0, open: 0, applied: 0 };
    for (const c of companies) {
      const b = deadlineBadge(new Date(c.deadline) - now);
      if (b.expired) continue;
      if (b.urgent) s.urgent += 1;
      else if (b.tone === 'yellow') s.closing += 1;
      else s.open += 1;
      if ((statuses[c.id] || 'Not Applied') === 'Applied') s.applied += 1;
    }
    return s;
  }, [companies, statuses, now]);

  const count = (f) => companies.filter((c) => match(c, f)).length;
  const emptyFor = () => {
    if (q.trim()) return { text: `No openings match “${q.trim()}” — try a different role or company.` };
    if (filter === 'Eligible Only')
      return { text: profile ? 'No eligible openings right now — your CGPA/branch gates rule out everything listed.' : 'Parse your resume first so we can check which openings you qualify for.', action: profile ? undefined : 'Go to Resume Parser', onAction: () => go && go('resume') };
    if (filter === 'Applied') return { text: 'Nothing marked as applied yet. Hit "Mark as Applied" on any row.' };
    if (filter === 'Bookmarked') return { text: 'No bookmarks yet — tap the bookmark icon on a row to pin it here.' };
    return { text: 'No deadlines match this filter.' };
  };

  /* ---------------- Google: Gmail first, then Calendar ---------------- */
  // With an OAuth client id we use the real API (popup account chooser + sync).
  // Without one we fall back to Google's own sign-in / prefilled-event pages —
  // no setup, no errors, the account choice happens on Google's side.
  const apiMode = !!CLIENT_ID;

  const saveGcal = (next) => { setGcal(next); writeLS(GCAL_KEY, next); };

  // Staged flow: Gmail if not signed in → Calendar scope (incremental consent) → token.
  const ensureCalendar = async () => {
    let { email, calendar } = gcal;
    let t = token;
    if (!email) { t = await requestToken(MAIL_SCOPE); email = await fetchEmail(t); }
    if (!calendar) { t = await requestToken(`${MAIL_SCOPE} ${CAL_SCOPE}`); calendar = true; }
    if (!t) {
      const scopes = calendar ? `${MAIL_SCOPE} ${CAL_SCOPE}` : MAIL_SCOPE;
      try { t = await requestToken(scopes, ''); } catch { t = await requestToken(scopes); }
    }
    saveGcal({ email, calendar });
    setToken(t);
    return t;
  };

  const connectCalendar = async () => {
    setBusy('calendar'); setNote(null);
    try {
      await ensureCalendar();
      setNote({ tone: 'ok', text: 'Google Calendar connected — use the calendar icon on any row, or "Sync all".' });
    } catch (e) { setNote(noteFor(e)); } finally { setBusy(''); }
  };

  const disconnect = () => {
    if (token) revokeToken(token);
    setToken(null); saveGcal({ email: null, calendar: false });
    setNote({ tone: 'ok', text: 'Google disconnected.' });
  };

  // Fallback login: Google's Calendar sign-in shows the account chooser when
  // signed out, or drops the user straight into their Calendar when signed in.
  const openLogin = () => {
    window.open(calendarLoginUrl(), '_blank', 'noopener');
    setNote({ tone: 'ok', text: 'Google sign-in opened in a new tab — choose the Gmail account you want to use for your deadlines.' });
  };

  const addToCalendar = async (c) => {
    if (!apiMode) {
      window.open(templateUrl(c, statuses[c.id] || 'Not Applied'), '_blank', 'noopener');
      setNote({ tone: 'ok', text: `Opened ${c.name} — press Save in Google Calendar (sign in if asked).` });
      return;
    }
    setBusy(c.id); setNote(null);
    try {
      const t = await ensureCalendar();
      const ev = await createDeadlineEvent(t, c, statuses[c.id] || 'Not Applied');
      const next = { ...syncedMap, [c.id]: ev.id };
      setSyncedMap(next); writeLS(EVENTS_KEY, next);
      setNote({ tone: 'ok', text: `${c.name} — ${c.role} added to Google Calendar.` });
    } catch (e) { setNote(noteFor(e)); } finally { setBusy(''); }
  };

  const syncAll = async () => {
    const targets = companies.filter((c) => new Date(c.deadline) - now > 0 && !syncedMap[c.id]);
    if (!targets.length) { setNote({ tone: 'ok', text: 'Everything upcoming is already in Google Calendar.' }); return; }
    setBusy('all'); setNote(null);
    try {
      const t = await ensureCalendar();
      const next = { ...syncedMap };
      let added = 0;
      for (const c of targets) {
        try { const ev = await createDeadlineEvent(t, c, statuses[c.id] || 'Not Applied'); next[c.id] = ev.id; added += 1; }
        catch (e) { if (!String(e.message).includes('(409')) throw e; } // 409 = already there
      }
      setSyncedMap(next); writeLS(EVENTS_KEY, next);
      setNote({ tone: 'ok', text: `${added} deadline${added === 1 ? '' : 's'} added to Google Calendar.` });
    } catch (e) { setNote(noteFor(e)); } finally { setBusy(''); }
  };

  const connected = !!(gcal.email && gcal.calendar);
  const googleUi = !apiMode ? (
    <button onClick={openLogin}
      className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200">
      <CalendarPlus size={16} />
      Login with Google Calendar
    </button>
  ) : connected ? (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white p-1.5 pl-2 shadow-sm">
      <span className="grid h-7 w-7 place-items-center rounded-full bg-indigo-100 text-[11px] font-semibold text-indigo-700">{(gcal.email[0] || '?').toUpperCase()}</span>
      <span className="max-w-[12rem] truncate text-xs text-slate-600" title={gcal.email}>{gcal.email}</span>
      <span className="flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700"><CalendarCheck size={13} /> Synced</span>
      <button onClick={syncAll} disabled={!!busy}
        className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-60">
        {busy === 'all' ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Sync all
      </button>
      <button onClick={disconnect} title="Disconnect Google" className="grid h-7 w-7 place-items-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-600">
        <LogOut size={14} />
      </button>
    </div>
  ) : (
    <div className="flex flex-col items-start gap-1.5 sm:items-end">
      <button onClick={connectCalendar} disabled={!!busy}
        className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:opacity-60">
        {busy === 'calendar' ? <Loader2 size={16} className="animate-spin" /> : <CalendarPlus size={16} />}
        {gcal.email ? 'Connect Google Calendar' : 'Login with Google Calendar'}
      </button>
    </div>
  );

  const summary = [
    { label: 'Urgent', sub: 'under 24 hrs', value: stats.urgent, dot: 'bg-red-500', valueCls: 'text-red-600' },
    { label: 'Closing soon', sub: 'under 3 days', value: stats.closing, dot: 'bg-amber-400', valueCls: 'text-amber-600' },
    { label: 'Open', sub: '3+ days left', value: stats.open, dot: 'bg-emerald-500', valueCls: 'text-slate-900' },
    { label: 'Applied', sub: 'submitted by you', value: stats.applied, dot: 'bg-indigo-500', valueCls: 'text-indigo-600' },
  ];

  const toast = note && (TOAST[note.tone] || TOAST.warn);

  return (
    <>
      <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Deadline Tracker</h1>
          <p className="mt-1 text-sm text-slate-500">Live countdowns — red under 24 hrs, amber under 3 days, green open. Sync every deadline to Google Calendar.</p>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          {googleUi}
        </div>
      </header>

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {summary.map((s) => (
          <div key={s.label} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3.5 shadow-sm">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{s.label}</p>
              <p className="mt-0.5 text-xs text-slate-400">{s.sub}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${s.dot}`} />
              <span className={`text-2xl font-semibold tabular-nums ${s.valueCls}`}>{s.value}</span>
            </div>
          </div>
        ))}
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-4 py-3">
          <div className="flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1">
            {FILTERS.map((f) => {
              const active = filter === f;
              return (
                <button key={f} onClick={() => setFilter(f)} aria-pressed={active}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${active ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                  {f}<span className={`ml-1.5 ${active ? 'text-indigo-600' : 'text-slate-400'}`}>{count(f)}</span>
                </button>
              );
            })}
          </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search role or company…" aria-label="Search by role or company"
              className="w-52 rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-8 text-sm text-slate-700 shadow-sm placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100" />
            {q && (
              <button onClick={() => setQ('')} aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600">
                <X size={14} />
              </button>
            )}
          </div>
          <label className="flex items-center gap-2 text-xs font-medium text-slate-500">
            Sort
            <span className="relative">
              <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort deadlines"
                className="appearance-none rounded-lg border border-slate-200 bg-white py-1.5 pl-3 pr-8 text-sm font-medium text-slate-700 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100">
                {SORTS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
              </select>
              <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            </span>
          </label>
        </div>
      </div>

        {companies.length === 0 ? <Empty icon={CalendarClock} text="No deadlines yet. Add companies in Admin Data Feed." /> :
          rows.length === 0 ? <Empty icon={CalendarClock} {...emptyFor()} /> : (
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  <th className="w-10 px-4 py-2.5" />
                  <th className="px-4 py-2.5">Company</th>
                  <th className="hidden px-4 py-2.5 lg:table-cell">Role</th>
                  <th className="hidden px-4 py-2.5 xl:table-cell">Deadline</th>
                  <th className="px-4 py-2.5">Time left</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((c) => {
                  const ms = new Date(c.deadline) - now;
                  const b = deadlineBadge(ms);
                  const st = statuses[c.id] || 'Not Applied';
                  const ev = profile ? evaluate(profile, c) : null;
                  const marked = st === 'Applied';
                  const isSynced = !!syncedMap[c.id];
                  const calTitle = !apiMode ? 'Open in Google Calendar' : b.expired ? 'Deadline passed' : isSynced ? 'In Google Calendar' : 'Add to Google Calendar';
                  return (
                    <tr key={c.id} className={`group transition ${b.urgent && !marked ? 'bg-red-50/50 hover:bg-red-50' : 'hover:bg-slate-50/80'} ${b.expired ? 'opacity-60' : ''}`}>
                      <td className={`border-l-4 py-3 pl-3 pr-1 align-middle ${b.urgent && !marked ? 'border-red-400' : 'border-transparent'}`}>
                        <button onClick={() => toggleBookmark(c.id)} title={bookmarks[c.id] ? 'Remove bookmark' : 'Bookmark'}
                          aria-label={`${bookmarks[c.id] ? 'Remove bookmark from' : 'Bookmark'} ${c.name}`} className="grid h-8 w-8 place-items-center rounded-md transition hover:bg-slate-100">
                          <Bookmark size={15} className={bookmarks[c.id] ? 'fill-indigo-500 text-indigo-500' : 'text-slate-300'} />
                        </button>
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <div className="flex items-center gap-3">
                          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-[11px] font-semibold text-slate-500 transition group-hover:bg-indigo-50 group-hover:text-indigo-600">{initials(c.name)}</span>
                          <div className="min-w-0">
                            <div className="truncate font-medium text-slate-900" title={c.name}>{c.name}</div>
                            <div className={`truncate text-[11px] ${TEXT_TONE[statusTone[ev?.status]] || 'text-slate-400'}`}>
                              {ev ? ev.status : `CGPA ${c.minCgpa}+`}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="hidden max-w-[14rem] px-4 py-3 align-middle lg:table-cell">
                        <span className="block truncate text-slate-600" title={c.role}>{c.role}</span>
                      </td>
                      <td className="hidden whitespace-nowrap px-4 py-3 align-middle text-slate-600 xl:table-cell">
                        {new Date(c.deadline).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <div className={`whitespace-nowrap text-sm font-medium tabular-nums ${CD_TONE[b.tone]}`}>{countdownLabel(ms)}</div>
                        <div className="mt-1"><Badge tone={b.tone}>{b.label}</Badge></div>
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <div className="relative">
                          <select value={st} onChange={(e) => setStatus(c.id, e.target.value)} disabled={b.expired} aria-label={`${c.name} status`}
                            className="w-40 appearance-none rounded-lg border border-slate-200 bg-white py-1.5 pl-3 pr-8 text-sm text-slate-700 shadow-sm transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400">
                            {STATUSES.map((s) => <option key={s}>{s}</option>)}
                          </select>
                          <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right align-middle">
                        <div className="flex items-center justify-end gap-2">
                          {(apiMode ? gcal.calendar : true) && (
                            <button onClick={() => addToCalendar(c)} disabled={b.expired || !!busy} title={calTitle}
                              aria-label={`Add ${c.name} to Google Calendar`}
                              className={`grid h-8 w-8 place-items-center rounded-lg border transition disabled:opacity-40 ${isSynced ? 'border-emerald-200 bg-emerald-50 text-emerald-600' : 'border-slate-200 bg-white text-slate-500 hover:border-indigo-300 hover:text-indigo-600'}`}>
                              {busy === c.id ? <Loader2 size={15} className="animate-spin" /> : isSynced ? <CalendarCheck size={15} /> : <CalendarPlus size={15} />}
                            </button>
                          )}
                          {marked ? (
                            <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700"><Check size={14} /> Applied</span>
                          ) : (
                            <button onClick={() => setStatus(c.id, 'Applied')} disabled={b.expired}
                              className="whitespace-nowrap rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none">
                              {b.expired ? 'Closed' : 'Mark as Applied'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          )}
      </Card>

      {note && toast && (
        <div role="status" aria-live="polite"
          className={`fixed bottom-5 right-5 z-50 flex w-[min(24rem,calc(100vw-2.5rem))] items-start gap-3 rounded-xl border bg-white p-3.5 shadow-lg ring-1 ring-slate-900/5 ${toast.ring}`}>
          <span className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full ${toast.chip}`}>
            <toast.Icon size={15} />
          </span>
          <p className="flex-1 text-[13px] leading-relaxed text-slate-700">{note.text}</p>
          <button onClick={() => setNote(null)} aria-label="Dismiss notification"
            className="-m-1 rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600">
            <X size={14} />
          </button>
        </div>
      )}
    </>
  );
}
