import { FileText } from 'lucide-react';
export const Card = ({ children, className = '' }) => <div className={`bg-white border border-slate-200 rounded-xl shadow-sm ${className}`}>{children}</div>;
export const Title = ({ t, s }) => (<div className="mb-4 sm:mb-6"><h1 className="text-xl sm:text-2xl md:text-3xl font-semibold text-slate-900 leading-tight">{t}</h1><p className="text-[13px] sm:text-sm text-slate-500 mt-1 leading-relaxed">{s}</p></div>);
const T = { green: 'bg-emerald-50 text-emerald-700', red: 'bg-red-50 text-red-700', yellow: 'bg-amber-50 text-amber-700', blue: 'bg-blue-50 text-blue-700', indigo: 'bg-indigo-50 text-indigo-700', orange: 'bg-orange-50 text-orange-700', emerald: 'bg-emerald-100 text-emerald-800', slate: 'bg-slate-100 text-slate-600' };
export const Badge = ({ tone = 'slate', children }) => <span className={`px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${T[tone]}`}>{children}</span>;
export const Empty = ({ text, action, onAction, icon: I = FileText }) => (
  <div className="text-center py-12 text-slate-500"><I className="mx-auto mb-3 text-slate-300" size={36} /><p className="text-sm">{text}</p>
    {action && <button onClick={onAction} className="mt-3 text-sm font-medium text-indigo-600 hover:underline">{action}</button>}</div>
);
export const NoProfile = ({ go }) => <Card><Empty text="No profile yet. Parse your resume so every other tab has something to compare against." action="Go to Resume Parser" onAction={() => go('resume')} /></Card>;
// text-base (16px) on phones stops iOS Safari from zooming the page when an
// input is focused; sm:text-sm tightens it back up on tablets and desktops.
export const inp = 'w-full border border-slate-300 rounded-lg px-3 py-2.5 sm:py-2 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500';
export const statusTone = { Eligible: 'green', 'Skill Gap': 'yellow', 'CGPA Shortfall': 'red', 'Branch Ineligible': 'red', 'CGPA Unknown': 'slate' };
