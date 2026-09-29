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
    // Phone/tablet: sticky top bar with a horizontally scrollable tab strip.
    // Desktop (md+): sticky left rail, unchanged.
    <aside className="sticky top-0 z-40 bg-slate-900 text-slate-300 shrink-0 md:w-60 md:min-h-screen md:top-0 md:h-screen print:hidden">
      <div className="hidden md:flex items-center gap-2 px-5 py-5 text-white font-semibold"><Target size={20} className="text-indigo-400" />Placement Copilot</div>

      <div className="relative md:static">
        <nav className="no-sb flex md:flex-col gap-1 p-2 overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
          <span className="flex md:hidden shrink-0 items-center gap-1.5 pr-2.5 mr-1 text-white font-semibold text-sm border-r border-slate-700"><Target size={16} className="text-indigo-400" />Copilot</span>
          {NAV.map(({ id, label, icon: I }) => (
            <button key={id} onClick={() => setTab(id)} aria-current={tab === id ? 'page' : undefined}
              className={`flex shrink-0 items-center gap-2 px-3 py-2.5 md:py-2 rounded-lg text-sm whitespace-nowrap text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${tab === id ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800'}`}>
              <I size={16} />{label}
            </button>
          ))}
        </nav>
        {/* edge fade so it is obvious the tab strip scrolls sideways on small screens */}
        <span aria-hidden="true" className="md:hidden pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-slate-900 via-slate-900/80 to-transparent" />
      </div>
    </aside>
  );
}
