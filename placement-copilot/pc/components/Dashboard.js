'use client';
import { useApp } from '@/context/AppContext';
import { evaluate, readiness, deadlineInfo } from '@/lib/logic';
import { Card, Title, Badge, Empty, NoProfile } from './ui';
import { CalendarClock } from 'lucide-react';

export default function Dashboard({ go }) {
  const { companies, profile, statuses, roadmaps, removeRoadmap, setRoadmapTarget } = useApp();
  const saved = roadmaps || [];
  const eligible = profile ? companies.filter((c) => evaluate(profile, c).gate).length : null;
  const soon = companies.filter((c) => { const h = (new Date(c.deadline) - Date.now()) / 36e5; return h >= 0 && h <= 168; })
    .sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
  const score = profile ? readiness(profile, companies) : null;
  const stat = (label, v, sub) => (<Card className="p-5"><p className="text-sm text-slate-500">{label}</p><p className="text-3xl font-semibold text-slate-900 mt-1">{v ?? '–'}</p><p className="text-xs text-slate-400 mt-1">{sub}</p></Card>);
  return (
    <>
      <Title t="Dashboard" s="Where you stand right now. Numbers are only as good as your parsed profile." />
      {!profile && <div className="mb-6"><NoProfile go={go} /></div>}
      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        {stat('Eligible companies', eligible, `of ${companies.length} listed (CGPA + branch gates)`)}
        {stat('Deadlines in 7 days', soon.length, 'expired ones excluded')}
        {stat('Readiness score', score != null ? score + '%' : null, 'avg skill match, best 3 eligible companies')}
      </div>
      <Card className="p-5">
        <h2 className="font-medium mb-3">Upcoming deadlines</h2>
        {soon.length === 0 ? <Empty icon={CalendarClock} text="Nothing due in the next 7 days." /> : (
          <ul className="divide-y divide-slate-100">
            {soon.map((c) => { const d = deadlineInfo(c.deadline); return (
              <li key={c.id} className="py-3 flex items-center justify-between gap-3 text-sm">
                <span><b>{c.name}</b> <span className="text-slate-500">· {c.role}</span></span>
                <span className="flex gap-2"><Badge tone="blue">{statuses[c.id] || 'Not Applied'}</Badge><Badge tone={d.tone}>{d.label}</Badge></span>
              </li>); })}
          </ul>)}
      </Card>
      {saved.length > 0 && (
        <Card className="p-5 mt-6">
          <h2 className="font-medium mb-3">Saved roadmaps</h2>
          <ul className="divide-y divide-slate-100">
            {saved.map((r) => (
              <li key={r.id} className="py-3 flex flex-wrap items-center justify-between gap-2 text-sm">
                <span><b>{r.name}</b> <span className="text-slate-500">· {r.role}</span>
                  <span className="text-slate-400"> · {r.skillPct}% matched · saved {new Date(r.savedAt).toLocaleDateString()}</span></span>
                <span className="flex items-center gap-2">
                  <Badge tone="red">{r.critical} critical</Badge>
                  <Badge tone="yellow">{r.nice} good-to-have</Badge>
                  <button onClick={() => { setRoadmapTarget?.(r.id); go('roadmap'); }}
                    className="text-xs font-medium text-indigo-600 hover:underline">Open</button>
                  <button onClick={() => removeRoadmap(r.id)}
                    className="text-xs text-slate-400 hover:text-red-600">Remove</button>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
