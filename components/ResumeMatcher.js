'use client';
import { useEffect, useRef, useState } from 'react';
import { UploadCloud, Sparkles, Loader2, FileUp, X, Plus, CheckCircle2, AlertTriangle, Camera, RotateCcw, Share2, Trash2 } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { parseResume, evaluate, SKILLS } from '@/lib/logic';
import { extractResumeText } from '@/lib/extractText';
import { aiConfigured, parseResumeWithAI, mergeAiProfile, getAiKey, setAiKey } from '@/lib/aiParse';
import { useAccount } from '@/lib/account';
import { Card, Title, Badge, Empty, inp } from './ui';

const MIN_CHARS = 30;
const ACCEPT = '.pdf,.txt,.text,.md,.markdown,.rtf,.csv';

export default function ResumeMatcher() {
  const { profile, setProfile, companies } = useApp();
  const { ready: accountReady, user, resumes, saveResume, deleteResume, shareResume } = useAccount();
  const [text, setText] = useState('');
  const [drag, setDrag] = useState(false);
  const [err, setErr] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState('');
  const [newSkill, setNewSkill] = useState('');
  const [camOpen, setCamOpen] = useState(false);
  const [camErr, setCamErr] = useState('');
  const [aiKey, setAiKey] = useState('');
  const [shot, setShot] = useState(''); // last camera capture, shown as a thumbnail
  const fileRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const sigRef = useRef(null);   // signature of the last auto-parsed profile
  const aiTextRef = useRef(null); // exact text the AI transcribed (don't re-parse over it)

  // Live parse: every text change (typing or file load) is pushed into the global
  // context, so the Company Matcher table re-scores immediately. Debounced so we
  // do not re-parse on every keystroke. Text that came straight from the AI is
  // left alone until the student edits it.
  useEffect(() => {
    if (aiTextRef.current === text) return;
    if (text.trim().length < MIN_CHARS) return;
    const t = setTimeout(() => apply(parseResume(text), false), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  // Stop the camera when the component goes away.
  useEffect(() => () => stopCam(), []); // eslint-disable-next-line react-hooks/exhaustive-deps

  // Pipe the live camera feed into the preview <video> once the modal opens.
  useEffect(() => {
    if (!camOpen) return;
    const v = videoRef.current;
    if (v && streamRef.current && v.srcObject !== streamRef.current) {
      v.srcObject = streamRef.current;
      v.play?.().catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camOpen]);

  function apply(parsed, force) {
    const sig = JSON.stringify(parsed);
    if (!force && sigRef.current === sig) return;
    sigRef.current = sig;
    setErr('');
    setProfile(parsed);
  }

  async function onFile(f) {
    if (!f) return;
    setErr(''); setNote(''); setBusy(true); setBusyLabel('Extracting text from your file…');
    try {
      const { text: extracted, source } = await extractResumeText(f);
      if (extracted.trim().length < MIN_CHARS) {
        throw new Error(`Too little text in "${source}" to parse. If it is a scanned PDF, paste the text below or scan it with your camera.`);
      }
      aiTextRef.current = null;
      setText(extracted);           // kicks off the live parse via the effect above
      const parsed = parseResume(extracted);
      apply(parsed, true);
      saveResume({ text: extracted, profile: parsed, label: source, source: 'file' });
      setNote(`Loaded ${source} — ${extracted.length.toLocaleString()} characters extracted in your browser and saved to your library.`);
    } catch (e) {
      setErr(e?.message || 'Could not read that file.');
    } finally {
      setBusy(false); setBusyLabel('');
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  /* ---------------- camera → AI ---------------- */

  function stopCam() {
    streamRef.current?.getTracks?.().forEach((t) => t.stop());
    streamRef.current = null;
  }

  async function openCamera() {
    setErr(''); setNote(''); setCamErr('');
    if (!navigator.mediaDevices?.getUserMedia) {
      setErr('This browser cannot open the camera (it needs HTTPS or localhost). Upload a photo with “Browse files” instead.');
      return;
    }
    try { setAiKey(getAiKey()); } catch { setAiKey(''); }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 } }, audio: false,
      });
      streamRef.current = stream;
      setCamOpen(true);
    } catch (e) {
      setErr(e?.name === 'NotAllowedError'
        ? 'Camera permission was denied — allow camera access in your browser and try again.'
        : `Could not start the camera: ${e?.message || 'unknown error'}.`);
    }
  }

  function closeCamera() {
    setCamOpen(false); setCamErr('');
    stopCam();
  }

  function capture() {
    const v = videoRef.current;
    if (!v || !v.videoWidth) { setCamErr('The camera is still starting — give it a second and capture again.'); return; }
    if (!aiConfigured()) { setCamErr('Paste your AI key above to enable scanning.'); return; }
    const scale = Math.min(1, 1600 / v.videoWidth);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(v.videoWidth * scale);
    canvas.height = Math.round(v.videoHeight * scale);
    canvas.getContext('2d').drawImage(v, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    closeCamera();
    runAiParse(dataUrl);
  }

  async function runAiParse(dataUrl) {
    setShot(dataUrl);
    setBusy(true); setBusyLabel('Reading your photo with the AI…');
    setErr(''); setNote('');
    try {
      const b64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
      const ai = await parseResumeWithAI({ imageBase64: b64, mimeType: 'image/jpeg' });
      const parsed = mergeAiProfile(ai);
      if (ai.rawText && ai.rawText.trim().length >= MIN_CHARS) {
        aiTextRef.current = ai.rawText;
        setText(ai.rawText);   // shows the transcription; the effect won't overwrite the AI profile
      }
      apply(parsed, true);
      if (ai.rawText && ai.rawText.trim().length >= MIN_CHARS) {
        saveResume({ text: ai.rawText, profile: parsed, label: `Camera scan — ${parsed.name || 'resume'}`, source: 'camera' });
      }
      const bits = [];
      if (parsed.cgpa != null) bits.push(`CGPA ${parsed.cgpa}`);
      if (parsed.branch) bits.push(parsed.branch);
      bits.push(`${parsed.skills.length} skill${parsed.skills.length === 1 ? '' : 's'}`);
      setNote(`AI read your photo — ${bits.join(' · ')}${ai.rawText ? ` · ${ai.rawText.length.toLocaleString()} characters transcribed` : ''} · saved to your library.`);
    } catch (e) {
      setErr(e?.message || 'The AI could not read that photo.');
    } finally {
      setBusy(false); setBusyLabel('');
    }
  }

  const onDrop = (e) => {
    e.preventDefault(); setDrag(false);
    onFile(e.dataTransfer.files?.[0]);
  };
  const parseNow = () => {
    if (text.trim().length < MIN_CHARS) return setErr('Paste or upload more resume text (at least a few lines).');
    aiTextRef.current = null;
    const parsed = parseResume(text);
    apply(parsed, true);
    saveResume({ text, profile: parsed, label: parsed.name || 'Pasted resume', source: 'text' });
    setNote('Profile updated from the text below, and saved to your library.');
  };
  const resetAll = () => {
    setText('');
    aiTextRef.current = null;
    sigRef.current = null;
    setShot(''); setNewSkill(''); setErr('');
    setProfile(null);
    setNote('Profile cleared — nothing is being matched right now. Saved resumes are untouched; press “Use” on one to bring it back.');
  };
  const useSaved = (r) => {
    setErr(''); setShot('');
    aiTextRef.current = r.text;   // stop the live parser from overwriting the stored snapshot
    setText(r.text);
    apply(r.profile || parseResume(r.text), true);
    setNote(`Loaded "${r.label}" — ${r.text.length.toLocaleString()} characters from your saved library.`);
  };
  const onShare = async (r) => {
    setErr('');
    try {
      const res = await shareResume({ label: r.label, text: r.text });
      if (res === 'shared') setNote(`Share sheet opened for "${r.label}" — pick the app or person to send it to.`);
      else if (res === 'cancelled') setNote('');
      else if (res?.startsWith('downloaded:')) setNote(`This browser can't share, so ${res.slice(11)} was downloaded instead — send that file.`);
    } catch (e) {
      setErr(`Could not share "${r.label}": ${e?.message || 'unknown error'}`);
    }
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
      <Title t="Resume Parser & Matcher" s="Drop a .pdf or .txt resume, paste the text, or scan a printed resume with your camera — CGPA, branch and skills are extracted (AI-assisted when scanning) and pushed straight into the Company Matcher." />

      <Card className="p-4 sm:p-5 mb-6 space-y-4">
        <div onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={onDrop}
          className={`border-2 border-dashed rounded-xl py-6 sm:py-8 px-3 text-center text-sm transition-colors ${drag ? 'border-indigo-500 bg-indigo-50' : 'border-slate-300 text-slate-500'}`}>
          {busy ? <Loader2 className="mx-auto mb-2 text-indigo-500 animate-spin" /> : <UploadCloud className="mx-auto mb-2 text-slate-400" />}
          <span className="block max-w-sm mx-auto">{busy ? (busyLabel || 'Working…') : 'Drop a .pdf or .txt resume here, take a photo of a printed one, or paste it below'}</span>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
            <button type="button" onClick={() => fileRef.current?.click()} disabled={busy}
              className="inline-flex items-center gap-2 min-h-[44px] px-2 text-sm font-medium text-indigo-600 hover:text-indigo-800 disabled:opacity-50">
              <FileUp size={16} />Browse files
            </button>
            <button type="button" onClick={openCamera} disabled={busy}
              className="inline-flex items-center gap-2 min-h-[44px] px-2 text-sm font-medium text-indigo-600 hover:text-indigo-800 disabled:opacity-50">
              <Camera size={16} />Scan with camera
            </button>
          </div>
          <p className="mt-1 text-xs text-slate-400 max-w-sm mx-auto">PDF and text files are parsed on your machine; camera scans are read by the AI.</p>
          <input ref={fileRef} type="file" accept={ACCEPT} className="hidden"
            onChange={(e) => onFile(e.target.files?.[0])} />
        </div>

        <textarea className={inp + ' h-40 sm:h-44 font-mono'} value={text} onChange={(e) => setText(e.target.value)}
          placeholder={'Asha Rao\nB.Tech Computer Science, CGPA: 8.2/10\nSkills: React, Node.js, Python, SQL, Git'} />

        {(note || shot) && (
          <div className="flex items-start gap-3">
            {shot && <img src={shot} alt="Captured resume" className="h-16 w-12 shrink-0 object-cover rounded border border-slate-200 bg-slate-50" />}
            {note && <p className="text-sm text-emerald-600 break-words flex items-start gap-1.5"><CheckCircle2 size={14} className="mt-0.5 shrink-0" />{note}</p>}
          </div>
        )}
        {err && <p className="text-sm text-red-600 break-words flex items-start gap-1.5"><AlertTriangle size={14} className="mt-0.5 shrink-0" />{err}</p>}

        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex gap-2">
            <button onClick={parseNow} disabled={busy}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-3 sm:py-2 rounded-lg disabled:opacity-50 min-h-[44px]">
              <Sparkles size={16} />Parse Resume
            </button>
            <button type="button" onClick={resetAll}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 border border-slate-300 text-slate-600 hover:bg-slate-50 text-sm font-medium px-4 py-3 sm:py-2 rounded-lg min-h-[44px]">
              <RotateCcw size={15} />Reset
            </button>
          </div>
          <span className="text-xs text-slate-400 sm:text-left text-center">Parsing also runs automatically as you type or upload. Reset clears the current parse only — saved resumes stay.</span>
        </div>
      </Card>

      {accountReady && (
        <Card className="p-4 sm:p-5 mb-6">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 mb-1">
            <h2 className="font-medium">Your saved resumes</h2>
            <p className="text-xs text-slate-400">{user ? `Saved to ${user.email}` : 'Saved on this device · sign in with Google to use them anywhere'}</p>
          </div>
          {!resumes.length ? (
            <p className="text-sm text-slate-400 leading-relaxed">
              Nothing saved yet. Uploads, camera scans and <b>Parse Resume</b> all land here automatically — then press <b>Use</b> to load one back or <b>Share</b> to send the file to someone.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {resumes.map((r) => (
                <li key={r.id} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{r.label}</p>
                    <p className="text-xs text-slate-400 truncate">
                      {new Date(r.savedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                      {r.profile?.name ? ` · ${r.profile.name}` : ''}
                      {r.profile?.cgpa != null ? ` · CGPA ${r.profile.cgpa}` : ''}
                      {` · ${r.profile?.skills?.length || 0} skills`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button type="button" onClick={() => useSaved(r)}
                      className="px-3 py-2 min-h-[40px] rounded-lg text-xs font-medium text-indigo-600 hover:bg-indigo-50">Use</button>
                    <button type="button" onClick={() => onShare(r)} aria-label={`Share ${r.label}`}
                      className="p-2.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-slate-50"><Share2 size={15} /></button>
                    <button type="button" onClick={() => deleteResume(r.id)} aria-label={`Delete ${r.label}`}
                      className="p-2.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-slate-50"><Trash2 size={15} /></button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {profile && (<>
        <Card className="p-4 sm:p-5 mb-6">
          <h2 className="font-medium mb-1">Extracted profile <span className="text-xs font-normal text-slate-400">(editable — the matcher re-runs on every change)</span></h2>
          <p className="text-xs text-slate-400 mb-3">4.0-scale GPAs are converted to the 0-10 scale used by the company cutoffs.</p>
          <div className="grid sm:grid-cols-3 gap-3 mb-3">
            <label className="text-xs text-slate-500">Name<input className={inp} value={profile.name} onChange={(e) => edit('name', e.target.value)} /></label>
            <label className="text-xs text-slate-500">CGPA (0–10)<input className={inp} type="number" step="0.01" min="0" max="10" inputMode="decimal" value={profile.cgpa ?? ''} onChange={(e) => edit('cgpa', e.target.value === '' ? null : parseFloat(e.target.value))} /></label>
            <label className="text-xs text-slate-500">Branch (CSE, IT, ECE…)<input className={inp} value={profile.branch} onChange={(e) => edit('branch', e.target.value)} /></label>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {profile.skills.map((s) => (
              <span key={s} className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 px-2 py-1 sm:py-0.5 rounded-full text-xs font-medium">
                {s}
                <button type="button" onClick={() => dropSkill(s)} aria-label={`Remove ${s}`} className="p-2 -m-1 text-indigo-400 hover:text-indigo-700"><X size={12} /></button>
              </span>
            ))}
            {!profile.skills.length && <span className="text-sm text-slate-400 mr-2">No known skills detected.</span>}
            <span className="inline-flex items-center gap-1">
              <input list="master-skills" className={inp + ' w-32 sm:w-40 !py-2 sm:!py-1'} placeholder="Add skill" value={newSkill}
                onChange={(e) => setNewSkill(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSkill(); } }} />
              <button type="button" onClick={addSkill} aria-label="Add skill" className="p-2.5 sm:p-1.5 rounded-lg border border-slate-300 text-slate-500 hover:text-indigo-600 hover:border-indigo-400"><Plus size={14} /></button>
            </span>
            <datalist id="master-skills">{SKILLS.map((s) => <option key={s} value={s} />)}</datalist>
          </div>
        </Card>

        <Card>
          {/* Header sits outside the scroll area so it never scrolls away with the table */}
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 p-4 sm:p-5 pb-3">
            <h2 className="font-medium">Company Matcher</h2>
            <p className="text-xs text-slate-500">{eligibleCount} of {companies.length} companies eligible (gates + ≥70% skills)</p>
          </div>
          {companies.length === 0 ? <Empty text="No companies in the database. Add some in Admin Data Feed." /> : (<>
            {/* Phone / small tablets: one card per company — no sideways table scrolling */}
            <div className="lg:hidden border-t border-slate-100 divide-y divide-slate-100">
              {rows.map(({ c, e }) => (
                <div key={c.id} className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{c.name}</p>
                      <p className="text-xs text-slate-500">{c.role}</p>
                    </div>
                    <Badge tone={e.eligible ? 'green' : 'red'}>{e.eligible ? 'Eligible' : 'Ineligible'}</Badge>
                  </div>
                  <p className="text-xs text-slate-400">{e.reason}</p>
                  <div className="flex items-center gap-2">
                    <div className="h-2 flex-1 bg-slate-100 rounded-full"><div className={`h-2 rounded-full ${e.skillPct >= 70 ? 'bg-indigo-500' : 'bg-amber-400'}`} style={{ width: e.skillPct + '%' }} /></div>
                    <span className="text-xs text-slate-500 shrink-0">{e.skillPct}% match</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge tone="slate">Min CGPA {c.minCgpa}</Badge>
                    {e.missing.length
                      ? e.missing.map((s) => <Badge key={s} tone="red">{s}</Badge>)
                      : <span className="text-xs text-emerald-600 inline-flex items-center gap-1"><CheckCircle2 size={13} />All required skills</span>}
                  </div>
                </div>
              ))}
            </div>

            {/* Laptop / wide screens: real table, scrolling inside the card only */}
            <div className="hidden lg:block overflow-x-auto border-t border-slate-100">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="text-left text-slate-500 border-b border-slate-100"><tr>
                  {['Company', 'Role', 'Min CGPA', 'Match', 'Missing skills', 'Status'].map((h) => <th key={h} className="px-4 lg:px-5 py-2 font-medium whitespace-nowrap">{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-slate-100">{rows.map(({ c, e }) => (
                  <tr key={c.id}>
                    <td className="px-4 lg:px-5 py-3 font-medium whitespace-nowrap">{c.name}</td>
                    <td className="px-4 lg:px-5 py-3 whitespace-nowrap">{c.role}</td>
                    <td className="px-4 lg:px-5 py-3">{c.minCgpa}</td>
                    <td className="px-4 lg:px-5 py-3 w-44"><div className="h-2 bg-slate-100 rounded-full"><div className={`h-2 rounded-full ${e.skillPct >= 70 ? 'bg-indigo-500' : 'bg-amber-400'}`} style={{ width: e.skillPct + '%' }} /></div><span className="text-xs text-slate-500">{e.skillPct}% match</span></td>
                    <td className="px-4 lg:px-5 py-3 min-w-[12rem]">{e.missing.length
                      ? <span className="flex flex-wrap gap-1">{e.missing.map((s) => <Badge key={s} tone="red">{s}</Badge>)}</span>
                      : <span className="text-xs text-emerald-600 inline-flex items-center gap-1"><CheckCircle2 size={13} />None</span>}</td>
                    <td className="px-4 lg:px-5 py-3 min-w-[14rem]">
                      <Badge tone={e.eligible ? 'green' : 'red'}>{e.eligible ? 'Eligible' : 'Ineligible'}</Badge>
                      <p className="text-xs text-slate-400 mt-1 whitespace-normal">{e.reason}</p>
                    </td>
                  </tr>))}</tbody>
              </table>
            </div>
          </>)}
        </Card>
      </>)}

      {camOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3 sm:p-4" role="dialog" aria-modal="true" aria-label="Scan resume with camera">
          <div className="w-full max-w-lg max-h-[94vh] overflow-y-auto rounded-2xl bg-white p-4 shadow-xl space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-sm">Scan a printed resume</h3>
              <button type="button" onClick={closeCamera} aria-label="Close camera" className="p-2 -m-1 text-slate-400 hover:text-slate-700"><X size={18} /></button>
            </div>
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-48 sm:h-72 rounded-xl bg-black object-cover" />
            {!aiConfigured() && (
              <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-3 space-y-2">
                <p className="text-xs text-slate-600">Paste your AI key to enable scanning. It's saved on this device only.</p>
                <div className="flex gap-2">
                  <input type="password" value={aiKey} onChange={(e) => setAiKey(e.target.value)}
                    placeholder="AI key" aria-label="AI key"
                    className={inp + ' flex-1 min-w-0 text-sm'} />
                  <button type="button" onClick={() => { setAiKey(aiKey); setCamErr(''); }}
                    className="shrink-0 text-sm font-medium px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white min-h-[44px]">Save key</button>
                </div>
              </div>
            )}
            {camErr && <p className="text-sm text-red-600 break-words flex items-start gap-1.5"><AlertTriangle size={14} className="mt-0.5 shrink-0" />{camErr}</p>}
            <p className="text-xs text-slate-500">Fill the frame with the page, hold steady in good light, then capture. The photo is sent to the AI, which transcribes it and fills your profile.</p>
            <div className="flex flex-col-reverse sm:flex-row sm:items-center gap-2">
              <button type="button" onClick={closeCamera}
                className="w-full sm:w-auto text-sm px-4 py-3 sm:py-2 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 min-h-[44px] text-center">Cancel</button>
              <button type="button" onClick={capture}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 text-sm font-medium px-4 py-3 sm:py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white min-h-[44px]">
                <Camera size={16} />Capture &amp; parse
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
