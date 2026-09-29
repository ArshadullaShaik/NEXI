'use client';
import { useEffect, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { evaluate, categorizeGaps, buildRoadmap, resourcesFor, SKILL_META } from '@/lib/logic';
import { Card, Title, Badge, Empty, NoProfile, inp } from './ui';
import {
  AlertTriangle, CheckCircle2, Flame, Sparkles, Printer, BookmarkPlus, BookmarkCheck,
  Target, Layers, Rocket, MessagesSquare, ExternalLink,
} from 'lucide-react';

const WEEK_ICON = [Target, Layers, Rocket, MessagesSquare];
const R = 34;
const CIRC = 2 * Math.PI * R;

const ResourceTag = ({ r }) => (
  <a href={r.url} target="_blank" rel="noopener noreferrer"
    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-white border border-slate-200 text-indigo-600 hover:border-indigo-400 hover:text-indigo-700 transition-colors">
    {r.label}<ExternalLink size={11} />
  </a>
);

const TierBadge = ({ skill }) => {
  const t = SKILL_META[skill]?.tier;
  if (t === 'core') return <Badge tone="red">Interview-critical</Badge>;
  if (t === 'stack') return <Badge tone="blue">Stack depth</Badge>;
  return <Badge tone="slate">Tooling</Badge>;
};

function GapCard({ icon: I, tone, title, hint, skills, empty }) {
  const iconTone = tone === 'red' ? 'text-red-600' : 'text-amber-500';
  return (
    <Card className="p-5">
      <h2 className="font-medium mb-1 flex items-center gap-2"><I size={16} className={iconTone} />{title}</h2>
      <p className="text-xs text-slate-400 mb-3">{hint}</p>
      {skills.length === 0 ? <p className="text-sm text-slate-400">{empty}</p> : (
        <ul className="space-y-3">
          {skills.map((s) => (
            <li key={s} className="rounded-lg border border-slate-200/80 bg-slate-50 p-3">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-sm font-semibold text-slate-800">{s}</span>
                <TierBadge skill={s} />
              </div>
              <div className="flex flex-wrap gap-1.5">{resourcesFor(s).map((r) => <ResourceTag key={r.url} r={r} />)}</div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export default function Roadmap({ go }) {
  const { profile, companies, roadmaps, saveRoadmap, removeRoadmap, roadmapTarget, setRoadmapTarget } = useApp();
  const [id, setId] = useState('');

  // Dashboard "Open" jumps straight to that company's plan.
  useEffect(() => {
    if (roadmapTarget && companies.some((x) => x.id === roadmapTarget)) {
      setId(roadmapTarget);
      setRoadmapTarget?.(null);
    }
  }, [roadmapTarget, companies, setRoadmapTarget]);

  if (!profile) return (<><Title t="Skill-Gap Roadmap" s="" /><NoProfile go={go} /></>);
  if (!companies.length) return (<><Title t="Skill-Gap Roadmap" s="" /><Card><Empty text="No companies to compare against." /></Card></>);

  const c = companies.find((x) => x.id === id) || companies[0];
  const e = evaluate(profile, c);
  const { critical, nice } = categorizeGaps(e.missing, companies);
  const plan = buildRoadmap({ critical, nice, company: c, profile });
  const isSaved = (roadmaps || []).some((r) => r.id === c.id);
  const ringColor = e.skillPct >= 70 ? '#10b981' : e.skillPct >= 40 ? '#f59e0b' : '#ef4444';

  const toggleSave = () => {
    if (isSaved) removeRoadmap(c.id);
    else saveRoadmap({
      id: c.id, name: c.name, role: c.role, savedAt: new Date().toISOString(),
      skillPct: e.skillPct, critical: critical.length, nice: nice.length, missing: e.missing,
    });
  };

  const stat = (label, v, sub) => (
    <div className="min-w-0">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-2xl font-semibold text-slate-900 mt-0.5">{v}</p>
      <p className="text-xs text-slate-400 truncate">{sub}</p>
    </div>
  );

  return (
    <>
      <Title t="Skill-Gap Roadmap" s="Your extracted skills vs the target company's requirements. Skills only — CGPA and branch gates are separate." />

      <Card className="p-5 mb-6">
        <div className="flex flex-wrap items-end justify-between gap-4 print:hidden">
          <div className="min-w-[260px]">
            <p className="text-xs font-medium text-slate-500 mb-1">Target company</p>
            <select className={inp + ' max-w-sm'} value={c.id} onChange={(x) => setId(x.target.value)}>
              {companies.map((x) => <option key={x.id} value={x.id}>{x.name}: {x.role}</option>)}
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => window.print()}
              className="inline-flex items-center gap-2 border border-slate-300 hover:border-slate-400 text-slate-700 text-sm font-medium px-4 py-2 rounded-lg bg-white">
              <Printer size={16} />Export PDF / Print
            </button>
            <button onClick={toggleSave}
              className={`inline-flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg ${isSaved
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}>
              {isSaved ? <><BookmarkCheck size={16} />Saved to Dashboard</> : <><BookmarkPlus size={16} />Save to Dashboard</>}
            </button>
          </div>
        </div>
        <div className="hidden print:block text-sm font-semibold text-slate-800">{c.name} — {c.role}</div>
        {!e.gate && <p className="mt-3 text-sm text-red-600 flex gap-2"><AlertTriangle size={16} />You fail the {!e.cgpaOk ? 'CGPA' : 'branch'} gate for this role ({e.status}).</p>}
      </Card>

      <Card className="p-5 mb-6">
        <div className="flex flex-wrap items-center gap-6">
          <div className="relative w-[96px] h-[96px] shrink-0">
            <svg width="96" height="96" viewBox="0 0 96 96" className="-rotate-90">
              <circle cx="48" cy="48" r={R} fill="none" stroke="#e2e8f0" strokeWidth="9" />
              <circle cx="48" cy="48" r={R} fill="none" stroke={ringColor} strokeWidth="9" strokeLinecap="round"
                strokeDasharray={CIRC} strokeDashoffset={CIRC * (1 - e.skillPct / 100)}
                style={{ transition: 'stroke-dashoffset .6s ease' }} />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-lg font-semibold text-slate-900">{e.skillPct}%</span>
          </div>
          <div className="grid grid-cols-3 gap-5 flex-1 min-w-[240px]">
            {stat('Matched skills', e.matched.length, `of ${c.skills.length} required by ${c.name}`)}
            {stat('Critical core', critical.length, 'close these first')}
            {stat('Good-to-have', nice.length, 'close these next')}
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-slate-500 mr-1">You already have:</span>
          {e.matched.length ? e.matched.map((s) => <Badge key={s} tone="green">{s}</Badge>)
            : <span className="text-sm text-slate-400">none of the required skills — start from week 1.</span>}
        </div>
      </Card>

      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <GapCard icon={Flame} tone="red" title="Critical Core Skills" skills={critical}
          hint="Interview-critical for this role, or demanded by most listed companies."
          empty="No critical gaps — your fundamentals already cover this role." />
        <GapCard icon={Sparkles} tone="yellow" title="Good-to-Have Skills" skills={nice}
          hint="Framework depth and tooling that strengthen your profile."
          empty="No extra gaps — everything left is stretch material." />
      </div>

      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
          <h2 className="font-medium">4-week roadmap to {c.name}</h2>
          <Badge tone="indigo">{e.missing.length ? `${e.missing.length} skill${e.missing.length > 1 ? 's' : ''} to close` : 'Maintenance plan'}</Badge>
        </div>
        <p className="text-xs text-slate-400 print:hidden">Tick items off as you go — the plan regenerates when you change company or resume.</p>
        <ol className="mt-5">
          {plan.map((w, i) => {
            const I = WEEK_ICON[i] || Target;
            const last = i === plan.length - 1;
            return (
              <li key={w.n} className="relative pl-12 pb-8 last:pb-0">
                {!last && <span className="absolute left-[19.5px] top-10 bottom-0 w-px bg-slate-200" />}
                <span className="absolute left-0 top-0 w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-sm">
                  <I size={18} />
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-indigo-600 uppercase tracking-wide">Week {w.n}</span>
                  <h3 className="text-sm font-semibold text-slate-900">{w.title}</h3>
                  <Badge tone="slate">{w.focus}</Badge>
                </div>
                <p className="text-sm text-slate-600 mt-1">{w.goal}</p>
                {w.skills.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">{w.skills.map((s) => <Badge key={s} tone="blue">{s}</Badge>)}</div>
                )}
                <ul className="mt-2 space-y-1">
                  {w.tasks.map((t) => (
                    <li key={t} className="flex gap-2 text-sm text-slate-600">
                      <CheckCircle2 size={15} className="text-emerald-500 mt-0.5 shrink-0" />{t}
                    </li>
                  ))}
                </ul>
                {w.resources.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    <span className="text-xs text-slate-400 self-center mr-1">Resources:</span>
                    {w.resources.map((r) => <ResourceTag key={r.url} r={r} />)}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </Card>
    </>
  );
}
