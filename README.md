# Placement Copilot

Placement-readiness app for a single college placement season. Match your resume against real
company requirements, get a week-by-week skill-gap roadmap, track deadlines with calendar sync,
run a voice mock interview, and read what seniors were actually asked.

```bash
npm install
npm run dev        # app on http://localhost:3000
npm run backend    # optional: mock-interview service on :3001
```

## It works with no configuration

Everything except shared experiences runs on `localStorage` with no keys, no accounts and no
network. Copy `.env.example` to `.env.local` and fill in only what you want to turn on:

| Feature | Needs | Without it |
|---|---|---|
| Dashboard, Resume, Roadmap, Deadlines | nothing | fully working |
| Mock Interview | `npm run backend` running | tab explains the backend is down |
| Sign-in (`/login`, `/signup`) | `NEXT_PUBLIC_FIREBASE_*` | pages explain it, app keeps working |
| Share Experience | Firebase + `GEMINI_API_KEY` + `ADMIN_UIDS` | the page explains what to add |

The company list comes from `lib/seedData.js` and is stored per device. If it is ever emptied,
the affected tabs offer to restore the samples.

## Sign-in

Google is the only provider, so `/login` and `/signup` are the same single button with different
framing. Setup: Firebase console → enable Authentication → Google, then copy the web app config
into `NEXT_PUBLIC_FIREBASE_API_KEY` / `_AUTH_DOMAIN` / `_PROJECT_ID` / `_APP_ID`.

Sign-in is **not** a gate. The app is fully usable signed out; an account is what lets a student
file an experience under their own name, and what keys the saved-resume library to an email so it
comes back on another device.

## Shared experiences

A student posts the interview they actually sat. A Gemini reviewer rewrites it so a junior can
use it, extracts the questions asked, tags topics, scores how substantive it is, and flags spam.
Clean submissions publish immediately; anything suspicious waits for a human in the in-app review
queue. Juniors then ask questions, and the AI answers from real submissions only — or says
plainly that it cannot, and is allowed to search the web with the answer visibly labelled as
**not** from students.

Endpoints (all under `app/api/`):

| Route | Method | Purpose |
|---|---|---|
| `/api/experiences` | GET | published list, filtered + ranked |
| `/api/experiences` | POST | submit, then review (in-app form or Google Form webhook) |
| `/api/experiences/[id]` | PATCH / DELETE | author edit (resets to pending) / author or admin delete |
| `/api/experiences/ask` | POST | retrieval + cited answer, 30-minute cache, 429 handling |
| `/api/admin/experiences` | GET / PATCH | review queue; publish, flag or delete |

The Google Form intake path is first-class: `google-apps-script/experiences.gs` POSTs to the same
`/api/experiences` endpoint with `INGEST_SECRET`, so there is exactly one validation + review path.

### Things that will bite you

1. **Await the review.** A fire-and-forget promise is frozen the instant the response flushes on a
   serverless host, which strands the entry in `pending` forever. The route awaits it.
2. **Run `prefilter()` before spending a Gemini call.** It is the quota guard. Skip it and one
   bored student exhausts the daily free-tier allowance.
3. **Rescale `quality`, don't clamp it.** Models return 0–1 and 0–10 for the same prompt. A value
   `> 1` is a 0–10 score, so divide by 10. Clamping would make every good submission score 1.0 and
   silently disable moderation.
4. **Only retry 404s.** A retired model is worth trying next. A 429 or 403 fails identically on
   every model — surface it as a quota error instead of re-running.
5. **The model list rots.** `lib/geminiModels.js` holds one shared chain for the browser and the
   server. Verify with `GET /v1beta/models` and override with `NEXT_PUBLIC_GEMINI_MODEL`.
6. **Firebase Admin init must stay lazy.** It happens inside `firestore()`, not at module load, or
   `next build` fails on any machine without credentials. The `'server-only'` imports at the top of
   `lib/firebase/admin.js`, `lib/aiServer.js` and `lib/apiAuth.js` are there for the same reason.
7. **Unescape the private key.** Env vars store it with literal `\n`; `admin.js` replaces them.
8. **`authorUid` never crosses the wire.** `toPublic()` strips it and emits a `mine` boolean.
   Ownership is decided server-side against the verified caller.
9. **`grounded: false` must be visible in the UI.** Below 2 matches the model is switched to web
   search. An answer that quietly blends web results into "what seniors told me" is a lie.

## Deploying

Vercel works as-is. Set `GEMINI_API_KEY`, the three `FIREBASE_*` server vars (private key with
literal `\n` escapes), `INGEST_SECRET` and `ADMIN_UIDS` in project settings. `.env.local` holds a
full database credential and is gitignored — never commit it.

The Apps Script webhook is a separate deploy: paste `experiences.gs` into a script bound to your
Form, edit `CONFIG` and `FIELD_MAPPING` at the top, and add an on-submit trigger plus a
10-minute `drainQueue` trigger, because Apps Script → your server is not transactional.
