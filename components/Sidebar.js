'use client';
import { LayoutDashboard, FileText, Route, CalendarClock, MessagesSquare, Database, Target } from 'lucide-react';
export const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'resume', label: 'Resume & Matcher', icon: FileText },
  { id: 'roadmap', label: 'Skill-Gap Roadmap', icon: Route },
  { id: 'deadlines', label: 'Deadline Tracker', icon: CalendarClock },
  { id: 'interview', label: 'Mock Interview', icon: MessagesSquare },
  { id: 'admin', label: 'Admin Data Feed', icon: Database },
];
export default function Sidebar({ tab, setTab }) {
  return (
    <aside className="md:w-60 md:min-h-screen bg-slate-900 text-slate-300 md:sticky md:top-0 md:h-screen shrink-0 print:hidden">
      <div className="hidden md:flex items-center gap-2 px-5 py-5 text-white font-semibold"><Target size={20} className="text-indigo-400" />Placement Copilot</div>
      <nav className="flex md:flex-col gap-1 p-2 overflow-x-auto">
        {NAV.map(({ id, label, icon: I }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm whitespace-nowrap text-left transition-colors ${tab === id ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800'}`}>
            <I size={16} />{label}
          </button>
        ))}
      </nav>
    </aside>
  );
}
