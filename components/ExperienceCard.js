'use client';
import { useState } from 'react';
import { Badge, Card } from './ui';
import { ChevronDown, MessageSquare, GraduationCap, Trash2 } from 'lucide-react';

/**
 * Dates arrive as ISO strings (the API flattens Firestore Timestamps server-side), but this
 * also accepts a Timestamp or epoch so the card never renders the literal text "Invalid Date".
 */
const when = (ts) => {
  if (!ts) return '';
  const d = ts instanceof Date ? ts
    : typeof ts === 'number' ? new Date(ts)
    : new Date(ts.seconds ? ts.seconds * 1000 : ts);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString([], { dateStyle: 'medium' });
};

export default function ExperienceCard({ exp, onDelete, canDelete }) {
  const [open, setOpen] = useState(false);
  const posted = when(exp.createdAt);

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-medium text-slate-900">{exp.company}</h3>
          <p className="text-sm text-slate-500">
            {exp.role}{exp.batchYear ? ` · batch ${exp.batchYear}` : ''}
            {exp.cgpa != null && ` · CGPA ${exp.cgpa}`}
            {exp.branch && ` · ${exp.branch}`}
          </p>
        </div>
        <Badge tone="indigo">{exp.round}</Badge>
      </div>

      <p className="text-sm text-slate-700 mt-3 whitespace-pre-line">{exp.summary || exp.raw}</p>

      {!!exp.questions?.length && (
        <details className="mt-3 group">
          <summary className="text-xs font-medium text-indigo-600 cursor-pointer inline-flex items-center gap-1 list-none">
            <MessageSquare size={12} /> {exp.questions.length} question{exp.questions.length === 1 ? '' : 's'} asked
          </summary>
          <ul className="mt-2 space-y-1 list-disc pl-5">
            {exp.questions.map((q, i) => <li key={i} className="text-sm text-slate-600">{q}</li>)}
          </ul>
        </details>
      )}

      {!!exp.topics?.length && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {exp.topics.map((t) => <Badge key={t} tone="slate">{t}</Badge>)}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 mt-4 pt-3 border-t border-slate-100">
        <span className="inline-flex items-center gap-1 text-xs text-slate-400">
          <GraduationCap size={12} /> {exp.authorLabel || 'Anonymous senior'}{posted && ` · ${posted}`}
        </span>
        <span className="flex items-center gap-3">
          <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}
            className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-700">
            <ChevronDown size={12} className={open ? 'rotate-180 transition-transform' : 'transition-transform'} />
            {open ? 'Hide original' : 'Read original'}
          </button>
          {canDelete && (
            <button type="button" onClick={onDelete} aria-label={`Delete your ${exp.company} experience`}
              className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-red-600">
              <Trash2 size={12} />Delete
            </button>
          )}
        </span>
      </div>

      {/* The AI rewrite is what's shown above; the original is one click away so a reader
          can check it wasn't invented. Hidden by default to keep the feed scannable. */}
      {open && (
        <div className="mt-3 p-3 rounded-lg bg-slate-50 border border-slate-200">
          <p className="text-[11px] font-medium text-slate-500 mb-1.5">As written by the student</p>
          <p className="text-sm text-slate-600 whitespace-pre-line">{exp.raw}</p>
        </div>
      )}
    </Card>
  );
}
