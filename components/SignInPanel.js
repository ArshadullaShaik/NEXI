'use client';
// The body of both /login and /signup.
//
// Google is the only provider, so both routes run the same single button — the difference is
// framing, not mechanism. A returning student is told "pick up where you left off"; a new one
// is walked through the three things that actually happen after they press it, because the
// honest answer to "what does signing in do?" is "not much until you upload a resume", and
// saying so up front is better than a support ticket later.

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from './AuthToken';
import { useApp } from '@/context/AppContext';
import { Card } from './ui';
import { Loader2, LogOut, ArrowRight, ShieldAlert, Target, CheckCircle2, Sparkles, Cloud, MessagesSquare } from 'lucide-react';

/** The official Google "G" mark, at the exact colours Google brand guidelines require. */
function GoogleG({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" className="shrink-0">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

const SIGNUP_STEPS = [
  { icon: Cloud, t: 'Your saved resumes move with you', d: 'Anything parsed on this device is re-filed under your account, so a new laptop is not a fresh start.' },
  { icon: Sparkles, t: 'Matching and roadmaps get a profile', d: 'We pre-fill your name from Google. Add your CGPA and branch once and every company match updates itself.' },
  { icon: MessagesSquare, t: 'You can share and ask', d: 'Post the interview you actually sat, then ask the AI what seniors were asked — answers are cited.' },
];

/** mode: 'signin' | 'signup' */
export default function SignInPanel({ mode = 'signin' }) {
  const { user, ready, configured, error, signIn, signOut } = useAuth();
  const { profile, setProfile } = useApp();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const isSignup = mode === 'signup';

  async function handle() {
    setBusy(true);
    try {
      const u = await signIn();
      if (!u) return; // user closed the picker — stay put, no error to show
      // First Google sign-in: seed the profile name so the matcher has something to work
      // with. Only when there isn't one already — never clobber a parsed resume.
      if (!profile) setProfile({ name: u.displayName || '' });
      router.push('/');
    } catch {
      /* message is already in `error`; the button re-enables in finally */
    } finally { setBusy(false); }
  }

  // --- Not configured: say so instead of offering a button that cannot work ----------
  if (ready && !configured) {
    return (
      <Shell mode={mode}>
        <Card className="p-7">
          <div className="h-10 w-10 rounded-xl bg-amber-50 text-amber-500 grid place-items-center mb-4">
            <ShieldAlert size={20} />
          </div>
          <h1 className="text-lg font-semibold text-slate-900">Sign-in isn’t set up yet</h1>
          <p className="text-sm text-slate-600 mt-2 leading-relaxed">
            This deployment has no Firebase project attached, so there are no accounts to sign in to.
            <b className="text-slate-800"> The app works fully without one</b> — resumes, roadmaps and
            deadlines all run on this device.
          </p>
          <p className="text-sm text-slate-600 mt-3 leading-relaxed">
            To switch it on, add the <code className="bg-slate-100 px-1.5 py-0.5 rounded text-[13px] font-mono">NEXT_PUBLIC_FIREBASE_*</code>{' '}
            variables from <code className="bg-slate-100 px-1.5 py-0.5 rounded text-[13px] font-mono">.env.example</code>{' '}
            and restart the dev server.
          </p>
          <Link href="/" className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:underline">
            Continue without an account <ArrowRight size={14} />
          </Link>
        </Card>
      </Shell>
    );
  }

  // --- Already signed in: don't show a form, just let them through --------------------
  if (user) {
    const name = user.displayName || user.email;
    return (
      <Shell mode={mode}>
        <Card className="p-7 text-center">
          {user.photoURL
            ? <img src={user.photoURL} alt="" className="mx-auto h-16 w-16 rounded-full border border-slate-200" />
            : <span className="mx-auto h-16 w-16 rounded-full bg-indigo-100 text-indigo-700 text-xl font-semibold grid place-items-center">
                {name.slice(0, 1).toUpperCase()}
              </span>}
          <h1 className="mt-4 text-lg font-semibold text-slate-900">You’re already signed in</h1>
          <p className="text-sm text-slate-500 mt-1">{user.email}</p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            <Link href="/" className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg">
              Go to the app <ArrowRight size={15} />
            </Link>
            <button type="button" onClick={signOut}
              className="inline-flex items-center gap-1.5 border border-slate-300 bg-white text-sm font-medium text-slate-600 px-3.5 py-2.5 rounded-lg hover:bg-slate-50">
              <LogOut size={15} /> Sign out
            </button>
          </div>
        </Card>
      </Shell>
    );
  }

  // --- The actual sign-in -------------------------------------------------------------
  // While the auth check is still running the button says "Checking…" and shows a spinner at
  // full opacity. The previous version just greyed the whole thing out with disabled:opacity-60,
  // which faded the coloured Google mark into mush and read as a broken button.
  const pending = !ready;
  return (
    <Shell mode={mode}>
      <Card className="p-7 sm:p-8">
        <h1 className="text-xl font-semibold text-slate-900 tracking-tight">
          {isSignup ? 'Create your account' : 'Welcome back'}
        </h1>
        <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">
          {isSignup
            ? 'One button, no password to remember. We only ever read your name and email.'
            : 'Pick up your saved resumes, roadmaps and shared experiences.'}
        </p>

        <button
          type="button" onClick={handle} disabled={busy || pending}
          className="mt-6 w-full inline-flex items-center justify-center gap-3 h-11 px-4 rounded-lg border border-slate-300 bg-white
                     text-[15px] font-medium text-slate-700 shadow-sm
                     hover:bg-slate-50 hover:border-slate-400 active:bg-slate-100
                     focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2
                     disabled:cursor-wait disabled:bg-slate-50 disabled:text-slate-500"
        >
          {busy || pending
            ? <Loader2 size={20} className="animate-spin text-slate-400" />
            : <GoogleG size={20} />}
          {busy ? 'Opening Google…' : pending ? 'Checking sign-in…' : 'Continue with Google'}
        </button>

        {/* role=alert so a failed attempt is announced, not just coloured red */}
        {error && (
          <p role="alert" className="mt-3.5 text-sm text-red-600 leading-snug flex gap-2 bg-red-50 border border-red-100 rounded-lg px-3 py-2.5">
            <ShieldAlert size={16} className="shrink-0 mt-0.5" />{error}
          </p>
        )}

        {isSignup && (
          <ul className="mt-7 space-y-3.5 pt-6 border-t border-slate-100">
            {SIGNUP_STEPS.map(({ icon: I, t, d }) => (
              <li key={t} className="flex gap-3">
                <span className="shrink-0 h-8 w-8 rounded-lg bg-indigo-50 text-indigo-600 grid place-items-center"><I size={16} /></span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-slate-800">{t}</span>
                  <span className="block text-[13px] text-slate-500 leading-relaxed">{d}</span>
                </span>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-6 pt-5 border-t border-slate-100 text-sm text-slate-500">
          {isSignup ? 'Already have an account?' : 'New here?'}{' '}
          <Link href={isSignup ? '/login' : '/signup'} className="font-medium text-indigo-600 hover:underline">
            {isSignup ? 'Sign in instead' : 'Create an account'}
          </Link>
        </p>

        <p className="mt-3.5 text-xs text-slate-400 leading-relaxed">
          You can keep using the app without signing in — it just won’t sync across devices.
        </p>
      </Card>
    </Shell>
  );
}

/**
 * Two-column shell: brand on the left from `md` up, form on the right.
 *
 * The brand panel is a gradient with a soft glow rather than a flat slab, and the column split
 * is slightly wider than half — the previous 50/50 left a wide band of empty grey next to a
 * narrow card, which is what made the page read as unfinished.
 */
function Shell({ mode, children }) {
  const isSignup = mode === 'signup';
  return (
    <div className="min-h-screen bg-slate-50 md:grid md:grid-cols-[1.1fr_1fr]">
      {/* Brand panel. Decorative, so it is hidden from AT and from small screens. */}
      <div aria-hidden="true" className="relative hidden md:flex flex-col justify-between overflow-hidden bg-slate-900 p-10 xl:p-14">
        {/* One soft indigo bloom, so the panel has depth instead of reading as flat black. */}
        <div className="pointer-events-none absolute -left-24 -top-24 h-96 w-96 rounded-full bg-indigo-600/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -right-16 h-96 w-96 rounded-full bg-indigo-500/10 blur-3xl" />

        <div className="relative flex items-center gap-2.5 text-white font-semibold">
          <span className="h-9 w-9 rounded-xl bg-indigo-500/15 text-indigo-300 grid place-items-center">
            <Target size={19} />
          </span>
          Placement Copilot
        </div>

        <div className="relative max-w-md">
          <h2 className="text-[1.75rem] xl:text-3xl font-semibold text-white leading-[1.25] tracking-tight">
            Everything you need before the interview, from the people who just went through it.
          </h2>
          <ul className="mt-7 space-y-3.5 text-[15px] text-slate-300">
            {['Match your resume against real company requirements',
              'Get a week-by-week skill-gap roadmap you can tick off',
              'Read what seniors were actually asked, then ask the AI about it'].map((t) => (
              <li key={t} className="flex gap-3">
                <CheckCircle2 size={17} className="text-indigo-400 shrink-0 mt-0.5" />{t}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-slate-500">
          {isSignup ? 'No password, no email confirmation to chase.' : 'Built for one college placement season at a time.'}
        </p>
      </div>

      {/* <main id="main"> is not decoration: it is the target the layout's skip link points
          at, and the only main landmark on this page. Without it the skip link is a dead
          href and screen-reader users have no landmark to jump to. */}
      <main id="main" className="flex flex-col justify-center px-4 py-10 sm:px-8">
        <div className="md:hidden flex items-center justify-center gap-2 text-slate-900 font-semibold mb-7">
          <span className="h-8 w-8 rounded-lg bg-indigo-50 text-indigo-600 grid place-items-center">
            <Target size={17} />
          </span>
          Placement Copilot
        </div>
        <div className="w-full max-w-[26rem] mx-auto">{children}</div>
      </main>
    </div>
  );
}
