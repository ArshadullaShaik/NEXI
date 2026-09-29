// Pure helpers for filtering and ranking shared experiences. No I/O here so both the
// list endpoint and the AI answer endpoint rank identically.

import { SKILLS } from './logic';

export const ROUNDS = ['OA', 'Interview 1', 'Interview 2', 'Final', 'Group Discussion', 'Other'];

/** Cheap English stopwords — enough to keep "what was the DSA round like" from matching "the". */
const STOP = new Set(
  ('a an and are as at be but by can did do does for from had has have how i if in into is it its of ' +
   'on or so than that the their then there these they this to was were what when where which who will ' +
   'with would you your about any get got just like me my not out please tell').split(' ')
);

const tokens = (s) =>
  String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9+#.\s]/g, ' ')
    .split(/\s+/)
    .map((t) => t.replace(/^\.+|\.+$/g, ''))
    .filter((t) => t.length > 1 && !STOP.has(t));

const norm = (s) => String(s || '').toLowerCase().trim();

/** Matches a company filter loosely: "Google" should also hit "google.com" or "Google India". */
export function companyMatches(entryCompany, filter) {
  const f = norm(filter);
  if (!f) return true;
  const c = norm(entryCompany);
  return c === f || c.includes(f) || f.includes(c);
}

/**
 * Scores an experience against a free-text question.
 * Weighted: title-ish fields (topics, questions) count more than the prose summary.
 */
export function scoreExperience(exp, queryTokens) {
  if (!queryTokens.length) return 0;
  const sets = {
    topics: new Set((exp.topics || []).map(norm)),
    questions: (exp.questions || []).map(norm),
    skills: new Set((exp.skills || []).map(norm)),
    text: norm(`${exp.summary || ''} ${exp.raw || ''}`),
  };

  let score = 0;
  for (const t of queryTokens) {
    if (sets.topics.has(t)) score += 4;
    if (sets.skills.has(t)) score += 3;
    if (sets.questions.some((q) => q.includes(t))) score += 3;
    if (sets.text.includes(t)) score += 1;
  }
  return score;
}

/** Keeps only skills from the master vocabulary, so badges line up with the rest of the app. */
export function normaliseSkills(list) {
  const known = new Map(SKILLS.map((s) => [norm(s), s]));
  const out = [];
  for (const raw of Array.isArray(list) ? list : []) {
    const hit = known.get(norm(raw)) || known.get(norm(raw).replace(/[.\s]/g, ''));
    if (hit && !out.includes(hit)) out.push(hit);
  }
  return out;
}

/** Filters then ranks. Returns at most `limit` entries, best first. */
export function rankExperiences(all, { company, role, round, q, limit = 8 } = {}) {
  const qTokens = tokens(q);
  const filtered = (all || []).filter((e) => {
    if (e.status && e.status !== 'published') return false;
    if (!companyMatches(e.company, company)) return false;
    if (role && !norm(e.role).includes(norm(role))) return false;
    if (round && norm(e.round) !== norm(round)) return false;
    return true;
  });

  const scored = filtered.map((e) => ({ ...e, _score: scoreExperience(e, qTokens) }));
  // With no query, order by recency instead of a meaningless zero score.
  if (!qTokens.length) {
    return scored
      .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0))
      .slice(0, limit);
  }
  return scored.filter((e) => e._score > 0).sort((a, b) => b._score - a._score).slice(0, limit);
}

/** Milliseconds for a Firestore Timestamp, a `{seconds}` JSON blob, an ISO string or a Date. */
function millis(ts) {
  if (ts == null) return null;
  if (typeof ts === 'number') return ts;
  if (typeof ts === 'string') { const n = Date.parse(ts); return Number.isNaN(n) ? null : n; }
  if (typeof ts?.toMillis === 'function') return ts.toMillis();          // live Timestamp
  if (typeof ts?.seconds === 'number') return ts.seconds * 1000;          // JSON-serialised Timestamp
  if (ts instanceof Date) return ts.getTime();
  return null;
}

/**
 * Flattens a document into something `JSON.stringify` renders as a usable date.
 *
 * A Firestore `Timestamp` serialises to `{type, seconds, nanoseconds}`, and `new Date(…)`
 * on that object is an Invalid Date — so an un-normalised doc renders the literal text
 * "Invalid Date" under every shared experience. Converting once, here, keeps Firestore's
 * types on the server and leaves the browser with an ISO string.
 */
export function normaliseDates(doc) {
  if (!doc || typeof doc !== 'object') return doc;
  const out = { ...doc };
  for (const k of ['createdAt', 'updatedAt', 'reviewedAt']) {
    if (out[k] == null) continue;
    const ms = millis(out[k]);
    if (ms != null) out[k] = new Date(ms).toISOString();
  }
  return out;
}

/**
 * Strips internal fields before a document crosses the wire.
 * `authorUid` never leaves the server; the browser only learns whether the row is its own
 * via the `mine` boolean, which is what gates the delete button.
 */
export function toPublic(doc, uid = null) {
  const { authorUid, _score, ...rest } = normaliseDates(doc);
  return { ...rest, id: doc.id, mine: Boolean(uid) && authorUid === uid };
}
