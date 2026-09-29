'use client';
import { useState } from 'react';
import { LogOut } from 'lucide-react';
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

export default function AccountMenu() {
  const { ready, user, resumes, googleReady, signIn, signOut } = useAccount();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  if (!ready) return <div className="h-9 w-40 rounded-lg bg-slate-100 animate-pulse" aria-hidden="true" />;

  async function handleSignIn() {
    if (!googleReady) {
      setMsg({ tone: 'warn', text: 'Google sign-in isn’t available right now — you can keep using the app and your resumes stay saved on this device.' });
      return;
    }
    setBusy(true); setMsg(null);
    try {
      const u = await signIn();
      setMsg({ tone: 'ok', text: `Signed in as ${u.email} — your saved resumes are now attached to this account.` });
    } catch (e) {
      const m = e?.message;
      setMsg({ tone: 'err', text: m === 'access_denied' || m === 'popup_closed'
        ? 'Sign-in cancelled.'
        : m === 'missing-client-id'
          ? 'Google sign-in isn’t available right now.'
          : `Google sign-in failed: ${m || 'unknown error'}` });
    } finally { setBusy(false); }
  }

  const toneCls = msg?.tone === 'ok' ? 'text-emerald-600'
    : msg?.tone === 'warn' ? 'text-amber-600'
    : 'text-red-600';

  if (!user) {
    return (
      <div className="flex flex-col items-end gap-1">
        <button type="button" onClick={handleSignIn} disabled={busy}
          className="inline-flex items-center gap-2 h-9 px-3.5 rounded-full border border-slate-300 bg-white text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60">
          <GoogleG />{busy ? 'Connecting…' : 'Sign in with Google'}
        </button>
        {msg && <p className={`text-xs text-right max-w-[20rem] leading-snug ${toneCls}`}>{msg.text}</p>}
      </div>
    );
  }

  const count = resumes.length;
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        {user.picture
          ? <img src={user.picture} alt="" className="h-8 w-8 rounded-full object-cover border border-slate-200" />
          : <span className="h-8 w-8 rounded-full bg-indigo-100 text-indigo-700 text-xs font-semibold grid place-items-center">{(user.name || user.email).slice(0, 1).toUpperCase()}</span>}
        <div className="hidden sm:block text-right leading-tight">
          <p className="text-sm font-medium text-slate-700 max-w-[12rem] truncate">{user.name}</p>
          <p className="text-[11px] text-slate-400">{count} saved resume{count === 1 ? '' : 's'}</p>
        </div>
        <button type="button" onClick={() => { signOut(); setMsg(null); }}
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full border border-slate-300 bg-white text-xs font-medium text-slate-600 hover:bg-slate-50">
          <LogOut size={14} />Sign out
        </button>
      </div>
      {msg && <p className={`text-xs text-right max-w-[20rem] leading-snug ${toneCls}`}>{msg.text}</p>}
    </div>
  );
}
