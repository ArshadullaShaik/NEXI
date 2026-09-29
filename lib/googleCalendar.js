// Google Sign-In (Gmail) + Google Calendar, straight from the browser.
//
// Uses Google Identity Services' token flow, so there is no server and no client
// secret: everything runs with a public OAuth "Web application" client id.
//
//   1. NEXT_PUBLIC_GOOGLE_CLIENT_ID  (Google Cloud Console → APIs & Services →
//      Credentials → OAuth client ID → Web application) and add this origin to
//      "Authorized JavaScript origins" (http://localhost:3000 locally).
//   2. Restart the dev server — NEXT_PUBLIC_* is baked in at build time.
//
// Flow used by the Deadline Tracker: sign in with Gmail first, then request the
// Calendar scope (incremental consent, so the second popup only asks for Calendar).

const GIS_SRC = 'https://accounts.google.com/gsi/client';
export const CLIENT_ID = (process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '').trim();
export const MAIL_SCOPE = 'openid email profile';
export const CAL_SCOPE = 'https://www.googleapis.com/auth/calendar.events';

let gisPromise = null;
const loadGis = () => {
  if (typeof window === 'undefined') return Promise.reject(new Error('browser only'));
  if (window.google?.accounts?.oauth2) return Promise.resolve(window.google);
  if (gisPromise) return gisPromise;
  gisPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = GIS_SRC;
    s.async = true;
    s.onload = () => (window.google?.accounts?.oauth2 ? resolve(window.google) : reject(new Error('Google sign-in failed to initialise')));
    s.onerror = () => { gisPromise = null; reject(new Error('Could not load Google sign-in (blocked or offline)')); };
    document.head.appendChild(s);
  });
  return gisPromise;
};

// requestToken('openid email profile', '') does a silent refresh when the user
// already granted the scope; omit `prompt` inside a click for the consent popup.
export const requestToken = async (scope, prompt) => {
  if (!CLIENT_ID) throw new Error('missing-client-id');
  const google = await loadGis();
  return new Promise((resolve, reject) => {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope,
      callback: (r) => (r?.access_token ? resolve(r.access_token) : reject(new Error(r?.error || 'access_denied'))),
      error_callback: (e) => reject(new Error(e?.type || 'popup_closed')),
    });
    client.requestAccessToken(prompt === undefined ? {} : { prompt });
  });
};

// Best-effort revocation on disconnect (clears the grant server-side).
export const revokeToken = (token) => {
  try { window.google?.accounts?.oauth2?.revoke(token, () => {}); } catch {}
};

export const fetchEmail = async (token) => {
  const r = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(`Google profile lookup failed (${r.status})`);
  const j = await r.json();
  if (!j.email) throw new Error('Google account has no email');
  return j.email;
};

// Full profile (name + avatar + email) for the account menu / saved resumes.
export const fetchProfile = async (token) => {
  const r = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(`Google profile lookup failed (${r.status})`);
  const j = await r.json();
  if (!j.email) throw new Error('Google account has no email');
  return { email: j.email, name: j.name || j.email, picture: j.picture || '' };
};

// Calendar event for one application deadline: a 30-minute block at the deadline
// with a 1-day and a 2-hour popup reminder.
export const buildEvent = (c, status = 'Not Applied') => {
  const start = new Date(c.deadline);
  if (Number.isNaN(start.getTime())) throw new Error('Invalid deadline');
  return {
    summary: `${c.name} · ${c.role} — application deadline`,
    description: `${c.role} application deadline at ${c.name}.\nTracked in Placement Copilot — status: ${status}.`,
    start: { dateTime: start.toISOString() },
    end: { dateTime: new Date(start.getTime() + 30 * 60000).toISOString() },
    reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 60 * 24 }, { method: 'popup', minutes: 60 * 2 }] },
  };
};

export const createDeadlineEvent = async (token, c, status) => {
  const r = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(buildEvent(c, status)),
  });
  if (!r.ok) throw new Error(`Calendar rejected the event (${r.status})`);
  const j = await r.json();
  return { id: j.id, htmlLink: j.htmlLink };
};

// --- Zero-setup fallback (no OAuth client id required) -----------------------
// Google's Calendar sign-in: when signed out it shows the "choose an account"
// list, when signed in it goes straight to the user's Calendar.
export const calendarLoginUrl = () =>
  `https://accounts.google.com/ServiceLogin?service=cl&continue=${encodeURIComponent('https://calendar.google.com/calendar/u/0/r')}`;

// Google Calendar's prefilled-event page. Routed through Calendar's sign-in:
// signed-in users pass straight through to the event (one "Save" click), and
// signed-out users get Google's account chooser first, landing on the event
// afterwards. The account choice always happens on Google's side.
const gcalStamp = (iso) => iso.replace(/\.\d+/, '').replace(/[-:]/g, '');
export const templateUrl = (c, status = 'Not Applied') => {
  const ev = buildEvent(c, status);
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: ev.summary,
    dates: `${gcalStamp(ev.start.dateTime)}/${gcalStamp(ev.end.dateTime)}`,
    details: ev.description,
    crm: 'AVAILABLE',
  });
  const template = `https://calendar.google.com/calendar/render?${params.toString()}`;
  return `https://accounts.google.com/ServiceLogin?service=cl&continue=${encodeURIComponent(template)}`;
};
