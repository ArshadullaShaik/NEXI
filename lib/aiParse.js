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
const KEY = () => process.env.NEXT_PUBLIC_GEMINI_API_KEY || '';

// Tried in order; a 404/"model not found" moves to the next one so the app keeps
// working as Google renames or retires models.
const MODELS = () => {
  const first = process.env.NEXT_PUBLIC_GEMINI_MODEL;
  const chain = [first, 'gemini-3-flash', 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];
  return [...new Set(chain.filter(Boolean))];
};

export const aiConfigured = () => Boolean(KEY());

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
  const res = await fetch(`${BASE()}/v1beta/models/${model}:generateContent?key=${encodeURIComponent(KEY())}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = body?.error?.message || `HTTP ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    err.retryable = res.status === 404 || /not found|has not been found/i.test(msg);
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
    throw new Error('No API key yet: add NEXT_PUBLIC_GEMINI_API_KEY to .env.local and restart the dev server.');
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
  for (const model of MODELS()) {
    try {
      const text = await callModel(model, payload);
      const json = extractJson(text);
      if (!json) throw new Error('The AI reply was not valid JSON. Try the photo again.');
      return normalise(json);
    } catch (e) {
      lastErr = e;
      if (!e?.retryable) throw e; // auth / quota / bad image: no point trying other models
    }
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
