'use client';
import { useEffect, useMemo, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { evaluate, categorizeGaps, buildRoadmap, resourceKind, SKILL_META, PACE_NOTE, paceOf } from '@/lib/logic';
import { Card, Title, Badge, Empty, NoProfile, inp } from './ui';
import RoadmapGraph from './RoadmapGraph';
import {
  AlertTriangle, Flame, Sparkles, Printer, BookmarkPlus, BookmarkCheck,
  ExternalLink, X, Check, Clock, CalendarDays,
} from 'lucide-react';

const UIKEY = 'prc:roadmapUI';
const WEEKS = [
  { w: 2, label: '2 wks', title: 'Crash' },
  { w: 4, label: '4 wks', title: 'Standard' },
  { w: 8, label: '8 wks', title: 'Thorough' },
  { w: 12, label: '12 wks', title: 'Relaxed' },
];
const KIND_TONE = {
  Official: 'bg-blue-50 text-blue-700 border-blue-200',
  Article: 'bg-slate-100 text-slate-600 border-slate-200',
  Video: 'bg-red-50 text-red-600 border-red-200',
  Course: 'bg-violet-50 text-violet-700 border-violet-200',
  Practice: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Book: 'bg-amber-50 text-amber-700 border-amber-200',
};

const ResLink = ({ r }) => {
  const kind = resourceKind(r);
  return (
    <a href={r.url} target="_blank" rel="noopener noreferrer"
      className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm hover:border-indigo-400 hover:bg-indigo-50/40 transition">
      <span className="flex items-center gap-2 min-w-0">
        <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${KIND_TONE[kind] || KIND_TONE.Article}`}>{kind}</span>
        <span className="truncate text-slate-700">{r.label}</span>
      </span>
      <ExternalLink size={13} className="shrink-0 text-slate-400" />
    </a>
  );
};

const TierBadge = ({ skill }) => {
  const t = SKILL_META[skill]?.tier;
  if (t === 'core') return <Badge tone="red">Interview-critical</Badge>;
  if (t === 'stack') return <Badge tone="blue">Stack depth</Badge>;
  return <Badge tone="slate">Tooling</Badge>;
};

function GapCard({ icon: I, tone, title, hint, skills, empty }) {
  const iconTone = tone === 'red' ? 'text-red-600' : 'text-amber-500';
  return (
    <Card className="p-5 min-w-0">
      <h2 className="font-medium mb-1 flex items-center gap-2"><I size={16} className={iconTone} />{title}</h2>
      <p className="text-xs text-slate-400 mb-3">{hint}</p>
      {skills.length === 0 ? <p className="text-sm text-slate-400">{empty}</p> : (
        <ul className="space-y-3">
          {skills.map((s) => (
            <li key={s} className="rounded-lg border border-slate-200/80 bg-slate-50 p-3">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-sm font-semibold text-slate-800 min-w-0 truncate">{s}</span>
                <span className="shrink-0"><TierBadge skill={s} /></span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(SKILL_META[s]?.resources || [{ label: `${s} docs`, url: `https://www.google.com/search?q=${encodeURIComponent(s + ' documentation tutorial')}` }]).map((r) => (
                  <a key={r.url} href={r.url} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-white border border-slate-200 text-indigo-600 hover:border-indigo-400 transition-colors">
                    {r.label}<ExternalLink size={11} />
                  </a>
                ))}
              </div>
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
  const [ui, setUi] = useState({ weeks: 4, hours: 8, done: {}, bar: true });
  const [loaded, setLoaded] = useState(false);
  const [sel, setSel] = useState(null); // { node?, phase }
  const [focus, setFocus] = useState(null); // { key, n } — stage-pill click → canvas glide

  // Timeline + hours + ticked nodes persist per browser (done[] keyed by company).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(UIKEY);
      if (raw) {
        const v = JSON.parse(raw);
        setUi((u) => ({ ...u, ...v, done: v?.done && typeof v.done === 'object' ? v.done : {}, bar: v?.bar !== false }));
      }
    } catch {}
    setLoaded(true);
  }, []);
  useEffect(() => { if (loaded) { try { localStorage.setItem(UIKEY, JSON.stringify(ui)); } catch {} } }, [ui, loaded]);

  // Dashboard "Open" jumps straight to that company's plan.
  useEffect(() => {
    if (roadmapTarget && companies.some((x) => x.id === roadmapTarget)) {
      setId(roadmapTarget);
      setRoadmapTarget?.(null);
    }
  }, [roadmapTarget, companies, setRoadmapTarget]);

  // Escape closes the resources drawer.
  useEffect(() => {
    if (!sel) return;
    const onKey = (e) => { if (e.key === 'Escape') setSel(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sel]);

  const weeks = WEEKS.some((w) => w.w === ui.weeks) ? ui.weeks : 4;
  const hours = Math.max(1, Math.min(60, Number(ui.hours) || 8));
  const pace = paceOf(hours);

  const c = companies.find((x) => x.id === id) || companies[0] || null;
  const e = profile && c ? evaluate(profile, c) : null;
  const gaps = e ? categorizeGaps(e.missing, companies) : { critical: [], nice: [] };
  const plan = useMemo(
    () => (e && c ? buildRoadmap({ critical: gaps.critical, nice: gaps.nice, company: c, profile, weeks, hours }) : { phases: [], total: 0 }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [c?.id, gaps.critical.join('|'), gaps.nice.join('|'), weeks, hours, profile]
  );

  if (!profile) return (<><Title t="Skill-Gap Roadmap" s="" /><NoProfile go={go} /></>);
  if (!companies.length) return (<><Title t="Skill-Gap Roadmap" s="" /><Card><Empty text="No companies to compare against." /></Card></>);

  const doneMap = (ui.done && ui.done[c.id]) || {};
  const isDone = (nid) => !!doneMap[nid];
  const countable = plan.phases.flatMap((p) => p.nodes.filter((n) => n.type !== 'note'));
  const doneCount = countable.filter((n) => isDone(n.id)).length;
  const pct = plan.total ? Math.round((doneCount / plan.total) * 100) : 0;
  const stats = plan.phases.map((p) => {
    const cn = p.nodes.filter((n) => n.type !== 'note');
    const d = cn.filter((n) => isDone(n.id)).length;
    return { ...p, count: cn.length, doneN: d, pct: cn.length ? Math.round((d / cn.length) * 100) : 0 };
  });
  const currentIdx = stats.findIndex((p) => p.pct < 100);
  const isSaved = (roadmaps || []).some((r) => r.id === c.id);
  const ringColor = e.skillPct >= 70 ? '#10b981' : e.skillPct >= 40 ? '#f59e0b' : '#ef4444';

  const setUiField = (patch) => setUi((u) => ({ ...u, ...patch }));
  const toggleNode = (nid) => setUi((u) => {
    const dm = { ...((u.done && u.done[c.id]) || {}) };
    if (dm[nid]) delete dm[nid]; else dm[nid] = true;
    return { ...u, done: { ...u.done, [c.id]: dm } };
  });
  const toggleStage = (ph) => setUi((u) => {
    const dm = { ...((u.done && u.done[c.id]) || {}) };
    const ids = ph.nodes.filter((n) => n.type !== 'note').map((n) => n.id);
    const all = ids.length > 0 && ids.every((x) => dm[x]);
    ids.forEach((x) => { if (all) delete dm[x]; else dm[x] = true; });
    return { ...u, done: { ...u.done, [c.id]: dm } };
  });

  const toggleSave = () => {
    if (isSaved) removeRoadmap(c.id);
    else saveRoadmap({
      id: c.id, name: c.name, role: c.role, savedAt: new Date().toISOString(),
      skillPct: e.skillPct, critical: gaps.critical.length, nice: gaps.nice.length, missing: e.missing,
      weeks, hours, pct, doneCount, total: plan.total,
    });
  };

  const openNode = (ph, node) => setSel({ node, phase: ph });
  const openPhase = (ph) => setSel({ node: null, phase: ph });

  const stat = (label, v, sub) => (
    <div className="min-w-0">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-2xl font-semibold text-slate-900 mt-0.5">{v}</p>
      <p className="text-xs text-slate-400 truncate">{sub}</p>
    </div>
  );

  const selPhase = sel?.phase;
  const selNode = sel?.node;
  const drawerResources = selNode?.resources || selPhase?.resources || [];

  return (
    <>
      <Title t="Skill-Gap Roadmap" s="Your extracted skills vs the target company's requirements — drawn as a tickable, roadmap.sh-style graph you can print or save." />

      {/* Sticky overall progress pill */}
      {ui.bar && (
        <div className="sticky top-0 z-30 flex justify-center py-3 print:hidden">
          <div className="flex items-center gap-3 rounded-full bg-slate-900 text-white pl-4 pr-1.5 py-1.5 text-xs shadow-lg">
            <span className="font-bold">{pct}%</span>
            <span className="w-24 sm:w-44 h-1.5 rounded-full bg-slate-700 overflow-hidden">
              <span className="block h-full bg-blue-500 transition-all duration-500" style={{ width: `${pct}%` }} />
            </span>
            <span className="text-slate-300 whitespace-nowrap">{doneCount} of {plan.total} done</span>
            <button onClick={() => setUiField({ bar: false })} aria-label="Hide progress bar"
              className="w-6 h-6 rounded-full hover:bg-slate-700 flex items-center justify-center"><X size={13} /></button>
          </div>
        </div>
      )}
      {!ui.bar && (
        <button onClick={() => setUiField({ bar: true })}
          className="fixed bottom-5 right-5 z-30 rounded-full bg-slate-900 text-white text-xs font-bold px-3.5 py-2 shadow-lg hover:bg-slate-800 print:hidden">
          {pct}% done
        </button>
      )}

      <Card className="p-5 mb-6">
        <div className="flex flex-wrap items-end justify-between gap-4 print:hidden">
          <div className="w-full sm:min-w-[260px]">
            <p className="text-xs font-medium text-slate-500 mb-1">Target company</p>
            <select className={inp + ' w-full sm:max-w-sm'} value={c.id} onChange={(x) => setId(x.target.value)}>
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

        {/* The two questions that size the plan */}
        <div className="mt-4 pt-4 border-t border-slate-100 grid sm:grid-cols-2 gap-5 print:hidden">
          <div>
            <p className="text-xs font-semibold text-slate-600 mb-1.5 flex items-center gap-1.5"><CalendarDays size={13} className="text-indigo-500" />What's your timeline?</p>
            <div className="flex flex-wrap gap-1.5">
              {WEEKS.map((w) => (
                <button key={w.w} onClick={() => setUiField({ weeks: w.w })}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition ${weeks === w.w
                    ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white border-slate-300 text-slate-600 hover:border-slate-400'}`}>
                  {w.label}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-slate-400 mt-1.5">{WEEKS.find((w) => w.w === weeks)?.title} pace — stages regenerate instantly.</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-600 mb-1.5 flex items-center gap-1.5"><Clock size={13} className="text-indigo-500" />How many hours per week can you commit?</p>
            <div className="flex items-center gap-3">
              <input type="number" min="1" max="60" value={hours} onChange={(x) => setUiField({ hours: x.target.value })}
                className={inp + ' w-24'} aria-label="Hours per week" />
              <span className="text-xs text-slate-500">{PACE_NOTE[pace]}</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1.5">Sets the task load and mock/question counts in every stage.</p>
          </div>
        </div>

        <div className="hidden print:block text-sm font-semibold text-slate-800">
          {c.name} — {c.role} · {weeks} weeks · {hours} hrs/week · {pct}% done
        </div>
        {!e.gate && <p className="mt-3 text-sm text-red-600 flex gap-2"><AlertTriangle size={16} />You fail the {!e.cgpaOk ? 'CGPA' : 'branch'} gate for this role ({e.status}).</p>}
      </Card>

      <Card className="p-5 mb-6">
        <div className="flex flex-wrap items-center gap-6">
          <div className="relative w-[96px] h-[96px] shrink-0">
            <svg width="96" height="96" viewBox="0 0 96 96" className="-rotate-90">
              <circle cx="48" cy="48" r="34" fill="none" stroke="#e2e8f0" strokeWidth="9" />
              <circle cx="48" cy="48" r="34" fill="none" stroke={ringColor} strokeWidth="9" strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 34} strokeDashoffset={2 * Math.PI * 34 * (1 - e.skillPct / 100)}
                style={{ transition: 'stroke-dashoffset .6s ease' }} />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-lg font-semibold text-slate-900">{e.skillPct}%</span>
          </div>
          <div className="grid grid-cols-3 gap-5 flex-1 min-w-[240px]">
            {stat('Matched skills', e.matched.length, `of ${c.skills.length} required by ${c.name}`)}
            {stat('Critical core', gaps.critical.length, 'close these first')}
            {stat('Good-to-have', gaps.nice.length, 'close these next')}
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-slate-500 mr-1">You already have:</span>
          {e.matched.length ? e.matched.map((s) => <Badge key={s} tone="green">{s}</Badge>)
            : <span className="text-sm text-slate-400">none of the required skills — start from stage 1.</span>}
        </div>
      </Card>

      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <GapCard icon={Flame} tone="red" title="Critical Core Skills" skills={gaps.critical}
          hint="Interview-critical for this role, or demanded by most listed companies."
          empty="No critical gaps — your fundamentals already cover this role." />
        <GapCard icon={Sparkles} tone="yellow" title="Good-to-Have Skills" skills={gaps.nice}
          hint="Framework depth and tooling that strengthen your profile."
          empty="No extra gaps — everything left is stretch material." />
      </div>

      {/* Stage pills, roadmap.sh style */}
      <div className="flex flex-wrap gap-2 mb-5 print:hidden">
        {stats.map((p, i) => (
          <button key={p.key} onClick={() => setFocus({ key: p.key, n: Date.now() })}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition
              ${p.pct === 100 ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                : i === currentIdx ? 'border-slate-900 bg-slate-900 text-white'
                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400'}`}>
            {p.pct === 100 && <Check size={12} strokeWidth={3} />}
            {p.title}
            <span className="opacity-70">{p.pct}%</span>
          </button>
        ))}
      </div>

      {/* The canvas: fixed-width roadmap with SVG wiring, pan & pinch-zoom */}
      <div className="mb-4">
        <RoadmapGraph
          stages={stats.map((s, i) => ({ ...s, current: i === currentIdx }))}
          isDone={isDone}
          onToggle={(x) => (typeof x === 'string' ? toggleNode(x) : toggleStage(x))}
          onOpenNode={(node, stage) => openNode(stage, node)}
          onOpenStage={openPhase}
          focus={focus}
        />
      </div>

      {/* Resource drawer (roadmap.sh "Resources" panel) */}
      {sel && (
        <>
          <div className="fixed inset-0 bg-slate-900/30 z-40 print:hidden" onClick={() => setSel(null)} />
          <aside className="fixed inset-y-0 right-0 z-50 w-full sm:w-[420px] bg-white border-l-2 border-slate-900 shadow-2xl overflow-y-auto p-5 print:hidden">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Stage {selPhase?.n} · {selPhase?.kicker}
                </p>
                <h2 className="text-lg font-semibold text-slate-900">{selNode ? selNode.label : selPhase?.title}</h2>
              </div>
              <button onClick={() => setSel(null)} aria-label="Close resources"
                className="shrink-0 w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50">
                <X size={16} />
              </button>
            </div>

            {selNode?.desc && <p className="text-sm text-slate-600 mb-4">{selNode.desc}</p>}
            {selNode?.type === 'note' && <p className="text-sm text-slate-600 mb-4">{selNode.text}</p>}
            {!selNode && selPhase?.goal && <p className="text-sm text-slate-600 mb-4">{selPhase.goal}</p>}

            {!selNode && selPhase && (
              <div className="mb-5">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">In this stage</h3>
                <ul className="space-y-1.5">
                  {selPhase.nodes.filter((n) => n.type !== 'note').map((n) => (
                    <li key={n.id}>
                      <button onClick={() => toggleNode(n.id)} className="flex items-center gap-2 w-full text-left text-sm text-slate-700 hover:text-slate-900">
                        <span className={`w-4 h-4 shrink-0 rounded-full border-2 flex items-center justify-center ${isDone(n.id) ? 'bg-violet-600 border-violet-600' : 'border-slate-300'}`}>
                          {isDone(n.id) && <Check size={10} strokeWidth={3} className="text-white" />}
                        </span>
                        <span className={isDone(n.id) ? 'line-through text-slate-400' : ''}>{n.label}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {drawerResources.length > 0 && (
              <>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Free resources</h3>
                <div className="space-y-2">{drawerResources.map((r) => <ResLink key={r.url} r={r} />)}</div>
              </>
            )}
            {drawerResources.length === 0 && !selNode && (
              <p className="text-sm text-slate-400">No curated links for this stage — tasks and notes carry it.</p>
            )}
          </aside>
        </>
      )}
    </>
  );
}
