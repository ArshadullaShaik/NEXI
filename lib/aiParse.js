// AI-assisted resume parsing (Google Gemini vision).
//
// Used by the "Scan with camera" flow: a photo of a paper resume is sent to the
// Gemini API, which returns structured JSON (name, CGPA, branch, skills) plus the
// plain text it could read. Everything else (regex parsing, pdf.js) stays offline,
// so the app still works fully without a key.
//
// Configuration (all optional, read at runtime so the UI can explain what's missing):
//   NEXT_PUBLIC_GEMINI_API_KEY   your Google AI Studio key
//   NEXT_PUBLIC_GEMINI_MODEL     model to try first (default: newest known)
//   NEXT_PUBLIC_GEMINI_BASE_URL  override for testing/mocking the endpoint

import { SKILLS, detectSkills, parseResume } from './logic';

const BASE = () => process.env.NEXT_PUBLIC_GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com';
const KEY = () => {
  if (process.env.NEXT_PUBLIC_GEMINI_API_KEY) return process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  // On-page fallback: a key pasted into the camera window is stored on this
  // device and works immediately — no dev server restart needed.
  try { return localStorage.getItem('prc:gemini_key') || ''; } catch { return ''; }
};

// Tried in order; a 404 / "model not found" / "high demand" moves to the next one
// so the app keeps working as Google renames, retires or throttles models.
// Keep this list in sync with GET /v1beta/models — Gemini 2.5/2.0 flash are
// closed to new API keys, so 3.x has to lead.
const MODELS = () => {
  const first = process.env.NEXT_PUBLIC_GEMINI_MODEL;
  const chain = [first, 'gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.5-flash',
    'gemini-3.1-flash-lite', 'gemini-flash-latest', 'gemini-2.5-flash', 'gemini-2.0-flash'];
  return [...new Set(chain.filter(Boolean))];
};

export const aiConfigured = () => Boolean(KEY());

// On-page key field support (camera window): read/store the device-local key.
export const getAiKey = () => {
  try { return localStorage.getItem('prc:gemini_key') || ''; } catch { return ''; }
};
export const setAiKey = (k) => {
  try { k.trim() ? localStorage.setItem('prc:gemini_key', k.trim()) : localStorage.removeItem('prc:gemini_key'); } catch { /* ignore */ }
};

function prompt() {
  return [
    'You are a resume parser for a college placement portal.',
    'Read this resume image and reply with ONLY a JSON object (no markdown, no commentary) shaped exactly like:',
    '{',
    '  "name": "full name or null",',
    '  "cgpa": <number on a 0-10 scale or null>,',
    '  "branch": "short branch code like CSE, IT, ECE, EEE, MECH, CE, AI, ML or null",',
    '  "skills": ["skill names as written, deduplicated"],',
    '  "rawText": "all readable resume text, line breaks preserved"',
    '}',
    'Rules:',
    '- cgpa must be normalised to a 0-10 scale: a 4.0-scale GPA (e.g. 3.8) becomes 9.5,',
    '  a percentage (e.g. 82%) becomes 8.2, an X/10 CGPA is used as-is. Anything else is null.',
    '  Never guess a CGPA that is not written on the resume.',
    '- branch: expand wording like "Computer Science and Engineering" to CSE,',
    '  "Electronics and Communication" to ECE, "Information Technology" to IT,',
    '  "Mechanical" to MECH, "Civil" to CE, "Artificial Intelligence" to AI.',
    `- skills: include the important ones; prefer these names when they match: ${SKILLS.join(', ')}.`,
    '  Ignore soft skills (team player, communication) and coursework labels.',
    '- rawText: transcribe everything you can read (contact block optional). If a word is',
    '  ambiguous, keep the closest guess rather than omitting the line.',
  ].join('\n');
}

function extractJson(s) {
  if (!s) return null;
  const cleaned = s.replace(/```(?:json)?/gi, '').trim();
  try { return JSON.parse(cleaned); } catch { /* fall through */ }
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try { return JSON.parse(cleaned.slice(start, end + 1)); } catch { /* fall through */ }
  }
  return null;
}

async function callModel(model, payload) {
  const key = KEY();
  // Gemini 3.x can queue for 30s+ under load; without a timeout the upload UI
  // would sit on "reading…" forever. Abort, and let the caller try the next model.
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 25000);
  let res;
  try {
    res = await fetch(`${BASE()}/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify(payload),
      signal: ctl.signal,
    });
  } catch (e) {
    const err = new Error(e?.name === 'AbortError'
      ? `${model} took too long to answer — trying the next model.`
      : 'Could not reach the Gemini API. Check your connection.');
    err.retryable = true;
    throw err;
  } finally {
    clearTimeout(timer);
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = body?.error?.message || `HTTP ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    // Retryable = "this model won't work", not "your request is wrong": an unknown
    // or retired model name, or a model that's momentarily overloaded. Auth
    // failures and quota errors are NOT retryable — another model won't help.
    err.retryable = res.status === 404 || res.status === 503 ||
      /not found|no longer available|high demand|overloaded|try again later/i.test(msg);
    // Turn the two most common non-retryable failures into something actionable.
    if (res.status === 429 || /quota|rate limit|billing|RESOURCE_EXHAUSTED/i.test(msg)) {
      err.message = 'Gemini quota is exhausted for this key (free tier is 20 requests/day). ' +
        'Wait for the quota to reset, or paste a different API key in the camera window.';
    } else if (res.status === 401 || res.status === 403 || /api key not valid|permission/i.test(msg)) {
      err.message = 'The Gemini API key was rejected. Paste a valid key in the camera window.';
    }
    throw err;
  }
  const cand = body?.candidates?.[0];
  const parts = cand?.content?.parts || [];
  const text = parts.map((p) => p.text || '').join('');
  if (!text) {
    if (cand?.finishReason === 'SAFETY') throw new Error('The AI refused to read this image (safety filter).');
    throw new Error('The AI returned an empty response. Try a clearer, better-lit photo.');
  }
  return text;
}

/**
 * Send an image (base64, no data: prefix) of a resume to Gemini and get back
 * `{ name, cgpa, branch, skills, rawText }`.
 */
export async function parseResumeWithAI({ imageBase64, mimeType = 'image/jpeg' }) {
  if (!aiConfigured()) {
    throw new Error('AI scanning is unavailable right now — upload the file with “Browse files” or paste the text instead.');
  }
  const payload = {
    contents: [{
      parts: [
        { inline_data: { mime_type: mimeType, data: imageBase64 } },
        { text: prompt() },
      ],
    }],
    generationConfig: { temperature: 0.1, responseMimeType: 'application/json' },
  };

  let lastErr = null;
  const tried = [];
  for (const model of MODELS()) {
    try {
      const text = await callModel(model, payload);
      const json = extractJson(text);
      if (!json) {
        const bad = new Error('The AI reply was not valid JSON. Try a clearer, better-lit photo.');
        bad.retryable = false;
        throw bad;
      }
      return normalise(json);
    } catch (e) {
      lastErr = e;
      if (!e?.retryable) throw e; // auth / quota / bad image: no point trying other models
      tried.push(model);
    }
  }
  // Every model failed the same way — say so plainly instead of leaking the last
  // raw API message (which is often just a 404 with no explanation).
  if (tried.length === MODELS().length) {
    const err = new Error(
      `Could not reach a working Gemini model (tried ${tried.slice(0, 3).join(', ')}…). ` +
      'The service may be busy — try again in a minute, or paste the resume text instead.'
    );
    err.status = lastErr?.status;
    throw err;
  }
  throw lastErr || new Error('AI parsing failed.');
}

function str(v) {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

function normalise(json) {
  let cgpa = typeof json.cgpa === 'number' ? json.cgpa : parseFloat(json.cgpa);
  if (!Number.isFinite(cgpa) || cgpa <= 0 || cgpa > 10) cgpa = null;
  if (cgpa !== null) cgpa = Math.round(cgpa * 100) / 100;

  const rawText = str(json.rawText) || '';
  const aiSkills = Array.isArray(json.skills) ? json.skills.filter((s) => typeof s === 'string' && s.trim()) : [];

  // Merge: whatever the AI saw, cross-checked against the master list so the
  // matcher compares like with like, plus anything readable in the transcribed text.
  const seen = new Set();
  const skills = [];
  for (const s of [...aiSkills.map((s) => s.trim()), ...detectSkills(rawText)]) {
    const k = s.toLowerCase();
    if (s && !seen.has(k)) { seen.add(k); skills.push(s); }
  }

  return { name: str(json.name), cgpa, branch: str(json.branch), skills, rawText };
}

/** Merge an AI result with the offline regex parser (regex fills anything the AI missed). */
export function mergeAiProfile(ai) {
  const fallback = ai.rawText ? parseResume(ai.rawText) : null;
  return {
    name: ai.name || fallback?.name || 'Student',
    cgpa: ai.cgpa ?? fallback?.cgpa ?? null,
    branch: ai.branch || fallback?.branch || 'CSE',
    skills: ai.skills.length ? ai.skills : (fallback?.skills || []),
  };
}
