'use client';
// Single client boundary for the whole app, so the auth check starts once on any route
// (including /login and /signup) instead of per-page. Kept in its own file because
// app/layout.js is a server component and cannot hold this state itself.

import { AppProvider } from '@/context/AppContext';
import { AuthProvider } from '@/components/AuthToken';

export default function Providers({ children }) {
  return (
    <AppProvider>
      <AuthProvider>{children}</AuthProvider>
    </AppProvider>
  );
}
