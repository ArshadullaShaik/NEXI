'use client';
import { useState } from 'react';
import Sidebar, { NAV } from '@/components/Sidebar';
import Dashboard from '@/components/Dashboard';
import ResumeMatcher from '@/components/ResumeMatcher';
import Roadmap from '@/components/Roadmap';
import DeadlineTracker from '@/components/DeadlineTracker';
import Interview from '@/components/Interview';
import Admin from '@/components/Admin';
import { useApp } from '@/context/AppContext';

const VIEWS = { dashboard: Dashboard, resume: ResumeMatcher, roadmap: Roadmap, deadlines: DeadlineTracker, interview: Interview, admin: Admin };

export default function Home() {
  const [tab, setTab] = useState('dashboard');
  const { ready } = useApp();
  const View = VIEWS[tab];
  return (
    <div className="min-h-screen md:flex">
      <Sidebar tab={tab} setTab={setTab} />
      <main className="flex-1 p-4 md:p-8 max-w-6xl w-full mx-auto print:p-0">
        {ready ? <View go={setTab} /> : <p className="text-slate-400 text-sm">Loading…</p>}
      </main>
    </div>
  );
}
