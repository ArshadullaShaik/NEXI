'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import { seedCompanies } from '@/lib/seedData';

const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);
const KEY = 'prc:v1';
const fresh = () => ({ companies: seedCompanies(), profile: null, statuses: {}, bookmarks: {}, roadmaps: [] });

// Tolerates partially corrupted / legacy payloads so one bad write can't blank the app.
const parse = (raw) => {
  try {
    const v = typeof raw === 'string' ? JSON.parse(raw) : null;
    if (!v || typeof v !== 'object') return fresh();
    return {
      companies: Array.isArray(v.companies) ? v.companies : [],
      profile: v.profile && typeof v.profile === 'object' ? v.profile : null,
      statuses: v.statuses && typeof v.statuses === 'object' ? v.statuses : {},
      // Bookmarked company ids, used by the Deadline Tracker "Bookmarked" filter.
      bookmarks: v.bookmarks && typeof v.bookmarks === 'object' && !Array.isArray(v.bookmarks) ? v.bookmarks : {},
      // Saved skill-gap roadmaps (one entry per company, newest first).
      roadmaps: Array.isArray(v.roadmaps)
        ? v.roadmaps.filter((r) => r && typeof r === 'object' && typeof r.id === 'string').slice(0, 24)
        : [],
    };
  } catch { return fresh(); }
};

export function AppProvider({ children }) {
  const [s, setS] = useState({ companies: [], profile: null, statuses: {}, bookmarks: {}, roadmaps: [] });
  const [ready, setReady] = useState(false);
  // Transient: company id the Dashboard "Open" jumps to. Not persisted.
  const [roadmapTarget, setRoadmapTarget] = useState(null);
  // State, not a ref: with StrictMode's double-invoked effects the ref flips true before the
  // first render, so the persist effect would write the empty shell and hydration would then
  // read that shell back. A state flag only goes true on the re-render that carries real data.
  const [hydrated, setHydrated] = useState(false);

  // Hydrate after mount to avoid SSR/localStorage mismatch.
  useEffect(() => {
    try { const r = localStorage.getItem(KEY); setS(r ? parse(r) : fresh()); } catch { setS(fresh()); }
    setHydrated(true);
    setReady(true);
  }, []);

  // Persist every change (only after hydration so we never clobber stored data with the empty shell).
  useEffect(() => {
    if (!hydrated) return;
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {}
  }, [s, hydrated]);

  // Cross-tab sync: the storage event fires in every *other* tab of this origin the
  // moment localStorage changes here — so Admin edits land elsewhere with no reload.
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key !== null && e.key !== KEY) return; // null = storage.clear()
      setS(e.newValue ? parse(e.newValue) : fresh());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const api = {
    ...s, ready, roadmapTarget, setRoadmapTarget,
    setProfile: (profile) => setS((x) => ({ ...x, profile })),
    addCompany: (c) => setS((x) => ({ ...x, companies: [...x.companies, { ...c, id: 'c' + Date.now() + Math.random().toString(36).slice(2, 6) }] })),
    deleteCompany: (id) => setS((x) => ({ ...x, companies: x.companies.filter((c) => c.id !== id) })),
    setStatus: (id, st) => setS((x) => ({ ...x, statuses: { ...x.statuses, [id]: st } })),
    toggleBookmark: (id) => setS((x) => ({ ...x, bookmarks: { ...x.bookmarks, [id]: !x.bookmarks[id] } })),
    // Saved roadmaps: one slot per company so re-saving refreshes instead of duplicating.
    saveRoadmap: (r) => setS((x) => ({ ...x, roadmaps: [r, ...(x.roadmaps || []).filter((y) => y.id !== r.id)].slice(0, 24) })),
    removeRoadmap: (id) => setS((x) => ({ ...x, roadmaps: (x.roadmaps || []).filter((r) => r.id !== id) })),
    // Demo escape hatch: wipe the stored payload outright, then repopulate from seedData.
    // The removal broadcasts `newValue: null` to other tabs (resetting them too), and the
    // follow-up write from the persist effect delivers the fresh seed dataset to them.
    resetToDemo: () => {
      try { localStorage.removeItem(KEY); } catch {}
      setHydrated(true);
      setS(fresh());
    },
    reset: () => setS(fresh()),
  };
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}
