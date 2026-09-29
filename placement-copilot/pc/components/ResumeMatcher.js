'use client';
import { useEffect, useRef, useState } from 'react';
import { UploadCloud, Sparkles, Loader2, FileUp, X, Plus, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { parseResume, evaluate, SKILLS } from '@/lib/logic';
import { extractResumeText } from '@/lib/extractText';
import { Card, Title, Badge, Empty, inp, statusTone } from './ui';

const MIN_CHARS = 30;
const ACCEPT = '.pdf,.txt,.text,.md,.markdown,.rtf,.csv';

export default function ResumeMatcher() {
  const { profile, setProfile, companies } = useApp();
  const [text, setText] = useState('');
  const [drag, setDrag] = useState(false);
  const [err, setErr] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [newSkill, setNewSkill] = useState('');
  const fileRef = useRef(null);
  const sigRef = useRef(null); // signature of the last auto-parsed profile

  // Live parse: every text change (typing or file load) is pushed into the global
  // context, so the Company Matcher table re-scores immediately. Debounced so we
  // do not re-parse on every keystroke.
  useEffect(() => {
    if (text.trim().length < MIN_CHARS) return;
    const t = setTimeout(() => apply(parseResume(text), false), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  function apply(parsed, force) {
    const sig = JSON.stringify(parsed);
    if (!force && sigRef.current === sig) return;
    sigRef.current = sig;
    setErr('');
    setProfile(parsed);
  }

  async function onFile(f) {
    if (!f) return;
    setErr(''); setNote(''); setBusy(true);
    try {
      const { text: extracted, source } = await extractResumeText(f);
      if (extracted.trim().length < MIN_CHARS) {
        throw new Error(`Too little text in "${source}" to parse. If it is a scanned PDF, paste the text below instead.`);
      }
      setText(extracted);           // kicks off the live parse via the effect above
      apply(parseResume(extracted), true);
      setNote(`Loaded ${source} — ${extracted.length.toLocaleString()} characters extracted in your browser.`);
    } catch (e) {
      setErr(e?.message || 'Could not read that file.');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  const onDrop = (e) => {
    e.preventDefault(); setDrag(false);
    onFile(e.dataTransfer.files?.[0]);
  };
  const parseNow = () => {
    if (text.trim().length < MIN_CHARS) return setErr('Paste or upload more resume text (at least a few lines).');
    apply(parseResume(text), true);
    setNote('Profile updated from the text below.');
  };
  const edit = (k, v) => setProfile({ ...profile, [k]: v });
  const addSkill = () => {
    const s = newSkill.trim();
    if (!s) return;
    if (!profile.skills.some((x) => x.toLowerCase() === s.toLowerCase())) edit('skills', [...profile.skills, s]);
    setNewSkill('');
  };
  const dropSkill = (s) => edit('skills', profile.skills.filter((x) => x !== s));

  const rows = profile ? companies.map((c) => ({ c, e: evaluate(profile, c) })) : [];
  const eligibleCount = rows.filter((r) => r.e.eligible).length;

  return (
    <>
      <Title t="Resume Parser & Matcher" s="Drop a .pdf or .txt resume (or paste the text). CGPA, branch and skills are extracted in your browser and pushed straight into the Company Matcher." />

      <Card className="p-5 mb-6 space-y-4">
        <div onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={onDrop}
          className={`border-2 border-dashed rounded-xl py-8 text-center text-sm transition-colors ${drag ? 'border-indigo-500 bg-indigo-50' : 'border-slate-300 text-slate-500'}`}>
          {busy ? <Loader2 className="mx-auto mb-2 text-indigo-500 animate-spin" /> : <UploadCloud className="mx-auto mb-2 text-slate-400" />}
          {busy ? 'Extracting text from your file…' : 'Drop a .pdf or .txt resume here, or paste it below'}
          <div className="mt-3">
            <button type="button" onClick={() => fileRef.current?.click()} disabled={busy}
              className="inline-flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-800 disabled:opacity-50">
              <FileUp size={16} />Browse files
            </button>
            <span className="text-slate-300 mx-2">·</span>
            <span className="text-xs text-slate-400">PDF is parsed with pdf.js, entirely on your machine</span>
          </div>
          <input ref={fileRef} type="file" accept={ACCEPT} className="hidden"
            onChange={(e) => onFile(e.target.files?.[0])} />
        </div>

        <textarea className={inp + ' h-40 font-mono'} value={text} onChange={(e) => setText(e.target.value)}
          placeholder={'Asha Rao\nB.Tech Computer Science, CGPA: 8.2/10\nSkills: React, Node.js, Python, SQL, Git'} />

        {note && <p className="text-sm text-emerald-600 flex items-center gap-1.5"><CheckCircle2 size={14} />{note}</p>}
        {err && <p className="text-sm text-red-600 flex items-center gap-1.5"><AlertTriangle size={14} />{err}</p>}

        <div className="flex items-center gap-3">
          <button onClick={parseNow} disabled={busy}
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50">
            <Sparkles size={16} />Parse Resume
          </button>
          <span className="text-xs text-slate-400">Parsing also runs automatically as you type or upload.</span>
        </div>
      </Card>

      {profile && (<>
        <Card className="p-5 mb-6">
          <h2 className="font-medium mb-1">Extracted profile <span className="text-xs font-normal text-slate-400">(editable — the matcher re-runs on every change)</span></h2>
          <p className="text-xs text-slate-400 mb-3">4.0-scale GPAs are converted to the 0-10 scale used by the company cutoffs.</p>
          <div className="grid sm:grid-cols-3 gap-3 mb-3">
            <label className="text-xs text-slate-500">Name<input className={inp} value={profile.name} onChange={(e) => edit('name', e.target.value)} /></label>
            <label className="text-xs text-slate-500">CGPA (0–10)<input className={inp} type="number" step="0.01" min="0" max="10" value={profile.cgpa ?? ''} onChange={(e) => edit('cgpa', e.target.value === '' ? null : parseFloat(e.target.value))} /></label>
            <label className="text-xs text-slate-500">Branch (CSE, IT, ECE…)<input className={inp} value={profile.branch} onChange={(e) => edit('branch', e.target.value)} /></label>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {profile.skills.map((s) => (
              <span key={s} className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full text-xs font-medium">
                {s}
                <button type="button" onClick={() => dropSkill(s)} aria-label={`Remove ${s}`} className="text-indigo-400 hover:text-indigo-700"><X size={12} /></button>
              </span>
            ))}
            {!profile.skills.length && <span className="text-sm text-slate-400 mr-2">No known skills detected.</span>}
            <span className="inline-flex items-center gap-1">
              <input list="master-skills" className={inp + ' w-40 !py-1'} placeholder="Add skill" value={newSkill}
                onChange={(e) => setNewSkill(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSkill(); } }} />
              <button type="button" onClick={addSkill} className="p-1.5 rounded-lg border border-slate-300 text-slate-500 hover:text-indigo-600 hover:border-indigo-400"><Plus size={14} /></button>
            </span>
            <datalist id="master-skills">{SKILLS.map((s) => <option key={s} value={s} />)}</datalist>
          </div>
        </Card>

        <Card className="overflow-x-auto">
          <div className="flex items-baseline justify-between gap-4 p-5 pb-3">
            <h2 className="font-medium">Company Matcher</h2>
            <p className="text-xs text-slate-500">{eligibleCount} of {companies.length} companies eligible (gates + ≥70% skills)</p>
          </div>
          {companies.length === 0 ? <Empty text="No companies in the database. Add some in Admin Data Feed." /> : (
            <table className="w-full text-sm"><thead className="text-left text-slate-500 border-y border-slate-100"><tr>
              {['Company', 'Role', 'Min CGPA', 'Match', 'Missing skills', 'Status'].map((h) => <th key={h} className="px-5 py-2 font-medium">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-slate-100">{rows.map(({ c, e }) => (
                <tr key={c.id}>
                  <td className="px-5 py-3 font-medium">{c.name}</td>
                  <td className="px-5 py-3">{c.role}</td>
                  <td className="px-5 py-3">{c.minCgpa}</td>
                  <td className="px-5 py-3 w-44"><div className="h-2 bg-slate-100 rounded-full"><div className={`h-2 rounded-full ${e.skillPct >= 70 ? 'bg-indigo-500' : 'bg-amber-400'}`} style={{ width: e.skillPct + '%' }} /></div><span className="text-xs text-slate-500">{e.skillPct}% match</span></td>
                  <td className="px-5 py-3">{e.missing.length
                    ? <span className="flex flex-wrap gap-1">{e.missing.map((s) => <Badge key={s} tone="red">{s}</Badge>)}</span>
                    : <span className="text-xs text-emerald-600 inline-flex items-center gap-1"><CheckCircle2 size={13} />None</span>}</td>
                  <td className="px-5 py-3">
                    <Badge tone={statusTone[e.status]}>{e.status}</Badge>
                    <p className="text-xs text-slate-400 mt-1 max-w-[16rem] whitespace-normal">{e.reason}</p>
                  </td>
                </tr>))}</tbody></table>)}
        </Card>
      </>)}
    </>
  );
}
