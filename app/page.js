'use client';
import { useState } from 'react';
import Sidebar from '@/components/Sidebar';
import Dashboard from '@/components/Dashboard';
import ResumeMatcher from '@/components/ResumeMatcher';
import Roadmap from '@/components/Roadmap';
import DeadlineTracker from '@/components/DeadlineTracker';
import Interview from '@/components/Interview';
import ShareExperience from '@/components/ShareExperience';
import UserMenu from '@/components/UserMenu';
import { Empty, Card } from '@/components/ui';
import { FileQuestion } from 'lucide-react';
import { useApp } from '@/context/AppContext';

const VIEWS = {
  dashboard: Dashboard,
  resume: ResumeMatcher,
  roadmap: Roadmap,
  deadlines: DeadlineTracker,
  interview: Interview,
  share: ShareExperience,
};
// Guards against a tab id that no longer exists (a stale bookmark, a renamed nav entry).
// Without this, an unknown id makes `View` undefined and React throws on render.
const FALLBACK = Dashboard;

export default function Home() {
  const [tab, setTab] = useState('dashboard');
  const { ready } = useApp();
  const View = VIEWS[tab] || FALLBACK;
  return (
    <div className="min-h-screen md:flex">
      <Sidebar tab={tab} setTab={setTab} />
      <main id="main" className="flex-1 px-4 py-5 md:px-8 md:py-8 max-w-6xl w-full mx-auto min-w-0 print:p-0">
        <div className="flex justify-end mb-4 print:hidden">
          <UserMenu />
        </div>
        {!ready ? (
          <p className="text-slate-400 text-sm">Loading…</p>
        ) : View === FALLBACK && !VIEWS[tab] ? (
          <Card><Empty icon={FileQuestion} text="That page does not exist." action="Back to Dashboard" onAction={() => setTab('dashboard')} /></Card>
        ) : (
          <View go={setTab} />
        )}
      </main>
    </div>
  );
}
