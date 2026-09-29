'use client';
import { useEffect, useMemo, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { evaluate, deadlineBadge, countdownLabel } from '@/lib/logic';
import { Card, Title, Badge, Empty, inp, statusTone } from './ui';
import { Bookmark, CalendarClock, Check } from 'lucide-react';

const STATUSES = ['Not Applied', 'Applied', 'Interviewing'];
const FILTERS = ['All', 'Eligible Only', 'Applied', 'Bookmarked'];

export default function DeadlineTracker({ go }) {
  const { companies, profile, statuses, setStatus, bookmarks = {}, toggleBookmark } = useApp();
  const [now, setNow] = useState(() => Date.now());
  const [filter, setFilter] = useState('All');
  const [sort, setSort] = useState('closest');

  // One shared clock so every countdown ticks live.
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  const isEligible = (c) => !!profile && Array.isArray(profile.skills) && evaluate(profile, c).gate;

  const match = (c, f) => {
    const st = statuses[c.id] || 'Not Applied';
    if (f === 'Eligible Only') return isEligible(c);
    if (f === 'Applied') return st === 'Applied';
    if (f === 'Bookmarked') return !!bookmarks[c.id];
    return true;
  };

  const rows = useMemo(() => companies
    .filter((c) => match(c, filter))
    .sort((a, b) => (new Date(a.deadline) - new Date(b.deadline)) * (sort === 'closest' ? 1 : -1) || a.name.localeCompare(b.name)),
  [companies, statuses, bookmarks, profile, filter, sort]);

  const count = (f) => companies.filter((c) => match(c, f)).length;
  const emptyFor = () => {
    if (filter === 'Eligible Only')
      return { text: profile ? 'No eligible openings right now — your CGPA/branch gates rule out everything listed.' : 'Parse your resume first so we can check which openings you qualify for.', action: profile ? undefined : 'Go to Resume Parser', onAction: () => go && go('resume') };
    if (filter === 'Applied') return { text: 'Nothing marked as applied yet. Hit "Mark as Applied" on any row.' };
    if (filter === 'Bookmarked') return { text: 'No bookmarks yet — tap the bookmark icon on a row to pin it here.' };
    return { text: 'No deadlines match this filter.' };
  };

  return (
    <>
      <Title t="Deadline Tracker" s="Live countdowns. Red: Urgent - under 24 hrs. Amber: Closing Soon - under 3 days. Green: Open." />
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {FILTERS.map((f) => (
          <button key={f} onClick={() => setFilter(f)} aria-pressed={filter === f}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${filter === f ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
            {f} <span className={filter === f ? 'text-indigo-200' : 'text-slate-400'}>{count(f)}</span>
          </button>
        ))}
        <select className={inp + ' !w-auto !py-1.5 ml-auto'} value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort deadlines">
          <option value="closest">Sort: closest deadline</option>
          <option value="farthest">Sort: farthest deadline</option>
        </select>
      </div>
      <Card className="overflow-x-auto">
        {companies.length === 0 ? <Empty icon={CalendarClock} text="No deadlines yet. Add companies in Admin Data Feed." /> :
          rows.length === 0 ? <Empty icon={CalendarClock} {...emptyFor()} /> : (
            <table className="w-full text-sm"><thead className="text-left text-slate-500 border-b border-slate-100"><tr>
              {['', 'Company', 'Role', 'Deadline', 'Time left', 'Status', 'Actions'].map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-slate-100">{rows.map((c) => {
                const ms = new Date(c.deadline) - now;
                const b = deadlineBadge(ms);
                const st = statuses[c.id] || 'Not Applied';
                const ev = profile ? evaluate(profile, c) : null;
                const marked = st === 'Applied';
                return (
                  <tr key={c.id} className={b.urgent && !marked ? 'bg-red-50/40' : ''}>
                    <td className="pl-4 py-3">
                      <button onClick={() => toggleBookmark(c.id)} aria-label={`${bookmarks[c.id] ? 'Remove bookmark from' : 'Bookmark'} ${c.name}`} title={bookmarks[c.id] ? 'Remove bookmark' : 'Bookmark'} className="p-1 rounded hover:bg-slate-100">
                        <Bookmark size={16} className={bookmarks[c.id] ? 'fill-indigo-500 text-indigo-500' : 'text-slate-300'} />
                      </button>
                    </td>
                    <td className="px-4 py-3"><span className="font-medium">{c.name}</span>
                      {ev && <span className="ml-2 align-middle"><Badge tone={statusTone[ev.status] || 'slate'}>{ev.status}</Badge></span>}</td>
                    <td className="px-4 py-3">{c.role}</td>
                    <td className="px-4 py-3">{new Date(c.deadline).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</td>
                    <td className="px-4 py-3"><span className="block text-xs text-slate-500 tabular-nums">{countdownLabel(ms)}</span><Badge tone={b.tone}>{b.label}</Badge></td>
                    <td className="px-4 py-3"><select className={inp + ' !py-1 w-36'} value={st} onChange={(e) => setStatus(c.id, e.target.value)} disabled={b.expired}>
                      {STATUSES.map((s) => <option key={s}>{s}</option>)}</select></td>
                    <td className="px-4 py-3">
                      {marked ? <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600"><Check size={14} /> Applied</span> :
                        <button onClick={() => setStatus(c.id, 'Applied')} disabled={b.expired}
                          className="px-3 py-1 rounded-lg text-xs font-medium border border-indigo-200 text-indigo-600 hover:bg-indigo-50 disabled:opacity-40 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400">
                          {b.expired ? 'Closed' : 'Mark as Applied'}</button>}
                    </td>
                  </tr>);
              })}</tbody></table>)}
      </Card>
    </>
  );
}
