'use client';
import { useState } from 'react';
import { Trash2, Plus, Database, RotateCcw, CheckCircle2, Radio } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { Card, Title, Empty, inp } from './ui';

const blank = { name: '', role: '', minCgpa: '', branches: '', skills: '', deadline: '' };
const list = (s) => s.split(',').map((x) => x.trim()).filter(Boolean);

export default function Admin() {
  const { companies, addCompany, deleteCompany, resetToDemo } = useApp();
  const [f, setF] = useState(blank);
  const [err, setErr] = useState('');
  const [flash, setFlash] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = (e) => {
    e.preventDefault();
    const cg = parseFloat(f.minCgpa);
    if (!f.name.trim() || !f.role.trim()) return setErr('Company name and role are required.');
    if (isNaN(cg) || cg < 0 || cg > 10) return setErr('CGPA cutoff must be between 0 and 10.');
    if (!list(f.branches).length) return setErr('List at least one allowed branch (or type "Any").');
    if (!list(f.skills).length) return setErr('Add at least one required skill.');
    if (!f.deadline) return setErr('Pick an application deadline.');
    const deadline = new Date(f.deadline);
    if (isNaN(deadline.getTime())) return setErr('Deadline is not a valid date.');
    if (companies.some((c) => c.name.toLowerCase() === f.name.trim().toLowerCase() && c.role.toLowerCase() === f.role.trim().toLowerCase()))
      return setErr('That company/role pair already exists in the feed.');
    addCompany({
      name: f.name.trim(), role: f.role.trim(), minCgpa: cg,
      branches: list(f.branches).map((b) => (/^any$/i.test(b) ? 'Any' : b)),
      skills: list(f.skills), deadline: deadline.toISOString(),
    });
    setF(blank); setErr('');
    setFlash(`${f.name.trim()} added — live in every open tab.`);
    setTimeout(() => setFlash(''), 3500);
  };

  const reset = () => {
    if (!confirm('Clear the current data in localStorage and reload the 10-company demo dataset?')) return;
    resetToDemo();
    setErr(''); setF(blank);
    setFlash('Demo data restored — all tabs re-synced.');
    setTimeout(() => setFlash(''), 3500);
  };

  return (
    <>
      <Title t="Admin Data Feed" s="Coordinator entry. Skill names must match the resume parser's vocabulary exactly (e.g. Node.js, not NodeJS) or matches silently fail." />

      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <p className="inline-flex items-center gap-2 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-100 px-3 py-1.5 rounded-full">
          <Radio size={13} /> Live sync on — {companies.length} companies broadcast to all open tabs
        </p>
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 border border-slate-300 hover:border-slate-400 hover:bg-slate-50 text-slate-700 text-sm font-medium px-4 py-2 rounded-lg"
        >
          <RotateCcw size={15} /> Reset to Demo Data
        </button>
      </div>

      {flash && (
        <p className="mb-4 inline-flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
          <CheckCircle2 size={15} /> {flash}
        </p>
      )}

      <Card className="p-5 mb-6">
        <h2 className="text-sm font-semibold text-slate-800 mb-1">Insert a company</h2>
        <p className="text-xs text-slate-500 mb-4">Comma-separate branches and skills. Deadline is the last date to apply.</p>
        <form onSubmit={submit} className="grid sm:grid-cols-2 gap-3">
          <input className={inp} placeholder="Company Name" value={f.name} onChange={set('name')} />
          <input className={inp} placeholder="Role" value={f.role} onChange={set('role')} />
          <input className={inp} type="number" step="0.1" min="0" max="10" placeholder="CGPA Cutoff (0–10)" value={f.minCgpa} onChange={set('minCgpa')} />
          <input className={inp} placeholder="Allowed Branches, comma-separated (e.g. CSE, IT, ECE)" value={f.branches} onChange={set('branches')} />
          <input className={inp} placeholder="Required Skills, comma-separated (e.g. Java, DSA, SQL)" value={f.skills} onChange={set('skills')} />
          <input className={inp} type="datetime-local" value={f.deadline} onChange={set('deadline')} />
          {err && <p className="sm:col-span-2 text-sm text-red-600">{err}</p>}
          <div className="sm:col-span-2">
            <button className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg">
              <Plus size={16} /> Add company
            </button>
          </div>
        </form>
      </Card>

      <Card className="overflow-x-auto">
        {companies.length === 0 ? <Empty icon={Database} text="Database is empty. Add a company above, or hit Reset to Demo Data." /> : (
          <table className="w-full text-sm"><thead className="text-left text-slate-500 border-b border-slate-100"><tr>
            {['Company', 'Role', 'CGPA', 'Branches', 'Skills', 'Deadline', ''].map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">{companies.map((c) => (
              <tr key={c.id}><td className="px-4 py-3 font-medium">{c.name}</td><td className="px-4 py-3">{c.role}</td><td className="px-4 py-3">{c.minCgpa}</td>
                <td className="px-4 py-3">{c.branches.join(', ')}</td><td className="px-4 py-3">{c.skills.join(', ')}</td>
                <td className="px-4 py-3 whitespace-nowrap">{new Date(c.deadline).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</td>
                <td className="px-4 py-3"><button onClick={() => deleteCompany(c.id)} className="text-red-600 hover:bg-red-50 p-1.5 rounded-lg inline-flex items-center gap-1 text-xs"><Trash2 size={14} />Delete</button></td></tr>))}</tbody></table>)}
      </Card>
    </>
  );
}
