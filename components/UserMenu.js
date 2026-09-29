'use client';
// Header account control.
//
// Deliberately a link, not a popup: with one sign-in method there is nothing to put in a
// dropdown, and a real /login route is shareable, bookmarkable and works with the browser's
// back button. The previous version of this file opened a Google consent popup in place,
// which left signed-out users with a dead "Sign in" button whenever the OAuth client id was
// missing — the notice now points at a page that can explain or fix the situation.

import Link from 'next/link';
import { useState } from 'react';
import { LogOut, UserPlus, Loader2, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/components/AuthToken';
import { useAccount } from '@/lib/account';

function GoogleG() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true" className="shrink-0">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

const btn = 'inline-flex items-center gap-2 h-9 px-3.5 rounded-full border border-slate-300 bg-white text-sm font-medium shadow-sm transition-colors disabled:opacity-60';

export default function UserMenu() {
  const { ready: authReady, user, configured, error, signOut } = useAuth();
  const { ready: libReady, resumes } = useAccount();
  const [busy, setBusy] = useState(false);

  if (!authReady || !libReady) {
    return <div className="h-9 w-40 rounded-full bg-slate-200 animate-pulse" aria-hidden="true" />;
  }

  if (!user) {
    // No Firebase on this machine: don't advertise a sign-in that cannot work.
    if (!configured) {
      return (
        <Link href="/signup" className={`${btn} text-slate-500 border-dashed`} title="Sign-in is not configured on this deployment">
          <ShieldAlert size={15} className="text-amber-500" />
          <span className="hidden sm:inline">Sign-in not set up</span>
          <span className="sm:hidden">Accounts</span>
        </Link>
      );
    }
    return (
      <div className="flex items-center gap-2">
        <Link href="/signup" className={`${btn} hidden sm:inline-flex text-slate-600`}>
          <UserPlus size={15} />Create account
        </Link>
        <Link href="/login" className={`${btn} text-slate-700`}>
          <GoogleG />Sign in
        </Link>
      </div>
    );
  }

  const name = user.displayName || user.email;
  return (
    <div className="flex items-center gap-2">
      <div className="hidden sm:flex items-center gap-2.5">
        <div className="text-right leading-tight">
          <p className="text-sm font-medium text-slate-700 max-w-[11rem] truncate">{name}</p>
          <p className="text-[11px] text-slate-400">
            {resumes.length} saved resume{resumes.length === 1 ? '' : 's'}
            {user.emailVerified ? ' · synced' : ''}
          </p>
        </div>
        {user.photoURL
          ? <img src={user.photoURL} alt="" className="h-8 w-8 rounded-full object-cover border border-slate-200" />
          : <span className="h-8 w-8 rounded-full bg-indigo-100 text-indigo-700 text-xs font-semibold grid place-items-center">
              {name.slice(0, 1).toUpperCase()}
            </span>}
      </div>
      {user.photoURL && <img src={user.photoURL} alt="" className="sm:hidden h-8 w-8 rounded-full object-cover border border-slate-200" />}
      <button type="button" disabled={busy} onClick={async () => { setBusy(true); await signOut(); setBusy(false); }} className={`${btn} !px-3 text-xs text-slate-600`}>
        {busy ? <Loader2 size={14} className="animate-spin" /> : <LogOut size={14} />}
        <span className="hidden sm:inline">Sign out</span>
        <span className="sm:hidden sr-only">Sign out</span>
      </button>
      {error && <p role="alert" className="text-xs text-red-600 max-w-[14rem]">{error}</p>}
    </div>
  );
}
