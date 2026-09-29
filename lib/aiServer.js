// Server-only Gemini helper: experience review on ingest + RAG answers for juniors.
//
// This is the sibling of lib/aiParse.js, which runs in the browser for camera resume
// scans. Everything here uses the server-only GEMINI_API_KEY so the key is never
// shipped in the client bundle.

import 'server-only';
import { geminiModelChain, GEMINI_BASE_URL } from './geminiModels';

const BASE = GEMINI_BASE_URL;
const KEY = () => process.env.GEMINI_API_KEY || '';

// Same fallback chain idea as lib/aiParse.js: a 404/"not found" moves to the next model
// so the feature keeps working as Google renames or retires models. The chain itself lives
// in lib/geminiModels.js so the browser and server copies can never drift apart.
const MODELS = geminiModelChain;


export const aiConfigured = () => Boolean(KEY());

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

/**
 * One generateContent call. Only a "model not found" is retried up the chain —
 * auth/quota/safety errors are real and re-running them just wastes quota.
 */
async function callGemini({ model, contents, tools, jsonMode = true }) {
  const res = await fetch(`${BASE()}/v1beta/models/${model}:generateContent?key=${encodeURIComponent(KEY())}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents,
      ...(tools ? { tools } : {}),
      generationConfig: {
        temperature: jsonMode ? 0.2 : 0.4,
        ...(jsonMode ? { responseMimeType: 'application/json' } : {}),
      },
    }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = body?.error?.message || `HTTP ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    // A retired/renamed model is worth retrying on the next entry in the chain.
    err.retryable = res.status === 404 || /not found|has not been found|no longer available/i.test(msg);
    // A quota or auth failure will fail identically on every model, so retrying is pointless
    // and the caller needs to know it is a plan/billing problem, not a transient blip.
    if (res.status === 429 || res.status === 403) {
      err.quota = res.status === 429;
      err.retryable = false;
    }
    throw err;
  }

  const cand = body?.candidates?.[0];
  const text = (cand?.content?.parts || []).map((p) => p.text || '').join('');
  if (!text) throw new Error('The AI returned an empty response.');
  return { text, model, grounding: cand?.groundingMetadata || null };
}

async function withModelFallback(fn) {
  if (!aiConfigured()) throw new Error('GEMINI_API_KEY is not set on the server (see .env.example).');
  let lastErr = null;
  for (const model of MODELS()) {
    try { return await fn(model); } catch (e) {
      lastErr = e;
      if (!e?.retryable) {
        if (e?.quota) {
          const q = new Error(
            'The Gemini API quota is exhausted for this key. Check billing/limits at ' +
              'https://ai.google.dev/gemini-api/docs/rate-limits'
          );
          q.quota = true;
          throw q;
        }
        throw e;
      }
    }
  }
  throw lastErr || new Error('AI call failed.');
}

const arr = (v, max = 12) =>
  (Array.isArray(v) ? v : []).map((x) => String(x || '').trim()).filter(Boolean).slice(0, max);

const str = (v, max = 4000) => (typeof v === 'string' ? v.trim() : '').slice(0, max);

// ---------------------------------------------------------------------------
// 1. Review on submit
// ---------------------------------------------------------------------------

const SKILL_VOCAB = 'React, Node.js, Python, Java, JavaScript, TypeScript, C++, SQL, MongoDB, AWS, ' +
  'Docker, Kubernetes, Git, DSA, System Design, Machine Learning, Next.js, Django, Spring Boot, TensorFlow, Linux';

const REVIEW_PROMPT = `You moderate placement experiences submitted by students for a college placement portal.

Read the submission and reply with ONLY a JSON object shaped exactly like:
{
  "summary": "3-5 sentence rewrite: clear, specific, useful to a junior preparing for this company",
  "topics": ["up to 8 short lowercase TOPIC tags describing the subject matter, e.g. arrays, hashing, sql, rounds, system-design. Topic tags must NOT be the company name, the role, or the batch year — those are already stored as separate fields."],
  "questions": ["interview questions actually asked, as written, up to 10"],
  "skills": ["skill names that came up, matching this vocabulary where possible: ${SKILL_VOCAB}"],
  "quality": 0.0,
  "flags": []
}

Rules:
- summary: preserve concrete facts (question topics, difficulty, how many rounds, what they asked
  about, outcomes). Never invent a question, a result, or a salary the student did not write.
- quality: a number between 0 and 1, how substantive this is. Under 0.25 means "too short to help anyone".
  Output a decimal in the 0-1 range only — never 4.5 or 8, those are not valid.
- flags: only use these exact strings, and only when they truly apply:
  "spam", "abusive", "off-topic", "too-short", "personal-data".
  Do not flag a submission merely for being informal or poorly written.
- personal-data: set it if the text contains a phone number, email, address, or a roll number
  that looks like an identifier. It still gets published, but is queued for admin review.
- Never return markdown, commentary, or a code fence.`;

/**
 * Cheap pre-flight check run BEFORE spending a Gemini call.
 *
 * A submission that is obviously too thin, obviously spam, or a duplicate never reaches the
 * model, which is what keeps the app inside a free-tier quota. Returns a reason string when
 * the entry should be held for a human instead of reviewed, or null when it is worth a call.
 */
export function prefilter(sub, { duplicate = false } = {}) {
  const raw = String(sub.raw || '');
  const text = raw.toLowerCase();

  if (duplicate) return 'duplicate';
  if (raw.length < 220) return 'too-short';

  // Keyword spam signals. Deliberately narrow — a placement post can legitimately be blunt.
  const spam = /(buy\s+(cheap|fast)|free\s+money|crypto\s+profit|seo\s+backlink|work\s+from\s+home\s+now)/i;
  if (spam.test(text)) return 'spam';

  // A wall of links is a link farm, not an experience write-up.
  const links = (raw.match(/https?:\/\//g) || []).length;
  if (links >= 4) return 'link-farm';

  // Low unique-word ratio means pasted boilerplate rather than a personal account.
  const words = raw.split(/\s+/).filter((w) => w.length > 2);
  if (words.length > 40) {
    const unique = new Set(words.map((w) => w.toLowerCase()));
    if (unique.size / words.length < 0.35) return 'repetitive';
  }
  return null;
}

/**
 * Reviews a raw submission, returning the elaborated fields plus a publish decision.
 * A malformed model reply is reported as `ok: false` rather than thrown, so the
 * submission is still stored (unreviewed) instead of being lost.
 */
export async function reviewExperience(sub) {
  const payload = [
    `Company: ${sub.company}`,
    `Role: ${sub.role}`,
    `Round: ${sub.round}`,
    `Batch year: ${sub.batchYear || 'unknown'}`,
    '',
    '--- student submission ---',
    sub.raw,
  ].join('\n');

  const { text, model } = await withModelFallback((m) =>
    callGemini({
      model: m,
      contents: [{ role: 'user', parts: [{ text: REVIEW_PROMPT + '\n\n' + payload }] }],
    })
  );

  const json = extractJson(text);
  if (!json) {
    return { ok: false, model, review: null, reason: 'The reviewer reply was not valid JSON.' };
  }

  // Models are inconsistent about the quality scale — observed returning both 0-1 (0.86)
  // and 0-10 (4.5) for the same prompt. A value > 1 is a 0-10 score, so rescale it rather
  // than clamping, which would silently turn every good submission into a 1.0.
  const rawQ = Number(json.quality);
  let quality = Number.isFinite(rawQ) ? (rawQ > 1 ? rawQ / 10 : rawQ) : 0;
  if (quality < 0 || quality > 1) quality = 0; // nonsense (e.g. -3, 42) -> treat as unknown
  quality = Math.round(quality * 100) / 100;

  const flags = arr(json.flags, 5).map((f) => f.toLowerCase());
  // Too thin to help anyone, or actively harmful -> hold for an admin instead of publishing.
  const blocked = quality < 0.25 || flags.includes('spam') || flags.includes('abusive');

  return {
    ok: true,
    model,
    review: {
      summary: str(json.summary, 1200) || str(sub.raw, 600),
      topics: arr(json.topics, 8).map((t) => t.toLowerCase()),
      questions: arr(json.questions, 10),
      skills: arr(json.skills, 12),
      quality,
      flags,
      status: blocked ? 'flagged' : 'published',
    },
  };
}

// ---------------------------------------------------------------------------
// 2. Ask AI (RAG over experiences, with web fallback)
// ---------------------------------------------------------------------------

const SEARCH_TOOL = [{ google_search: {} }];

function contextBlock(exps) {
  return exps
    .map(
      (e, i) =>
        `[${i + 1}] ${e.company} - ${e.role} (${e.round}, batch ${e.batchYear || '?'})\n` +
        `Summary: ${e.summary || e.raw}\n` +
        (e.questions?.length ? `Questions asked: ${e.questions.join(' | ')}\n` : '')
    )
    .join('\n\n');
}

const ANSWER_PROMPT = (ctx, q) => `You help college students prepare for placements using real experiences shared by seniors.

Here are experiences submitted by students:
${ctx || '(none matched)'}

Question: ${q}

Rules:
- Answer using ONLY the experiences above. Cite them as [1], [2] inline after each claim.
- If they do not cover the question, say exactly what is not covered and what the student
  should find out themselves. Do not fill the gap with general knowledge.
- Be concrete and short. Bullet points beat paragraphs. No preamble.`;

/**
 * Answers a junior's question.
 *
 * `experiences` are already filtered + ranked by the caller. When retrieval is too thin
 * to answer from, we let Gemini search the web instead and report that clearly so the UI
 * can warn the reader the answer is not from real students.
 *
 * @returns {{answer: string, grounded: boolean, sources: Array<{title: string, uri: string}>,
 *            usedExperiences: Array<{id: string, company: string, role: string, round: string}>,
 *            model: string}}
 */
export async function answerQuestion({ question, experiences = [], company, role, round }) {
  const q = str(question, 500);
  if (!q) throw new Error('Ask a question first.');

  // One good experience is not enough to generalise from, so under 2 we let the model search.
  const allowWeb = experiences.length < 2;
  const scope = [company, role, round].filter(Boolean).join(' · ');

  const { text, model, grounding } = await withModelFallback((m) =>
    callGemini({
      model: m,
      tools: allowWeb ? SEARCH_TOOL : undefined,
      jsonMode: false,
      contents: [
        {
          role: 'user',
          parts: [
            {
              text:
                `${ANSWER_PROMPT(contextBlock(experiences), q)}\n\n` +
                (scope ? `Current filter: ${scope}\n` : '') +
                (allowWeb
                  ? 'The experiences above are too thin to answer this. Search the web for real, ' +
                    'current information, answer from it, and list the sources you used.'
                  : 'Do not search the web. Answer from the experiences or say what is missing.'),
            },
          ],
        },
      ],
    })
  );

  // The grounding metadata comes back on this same response, so discovering the sources
  // costs no extra call.
  const sources = [];
  for (const c of grounding?.groundingChunks || []) {
    const uri = c?.web?.uri;
    if (!uri || sources.some((s) => s.uri === uri)) continue;
    sources.push({ title: c?.web?.title || uri.replace(/^https?:\/\//, '').split('/')[0], uri });
  }

  return {
    answer: text.trim(),
    grounded: !allowWeb,
    sources: sources.slice(0, 8),
    usedExperiences: experiences.map((e) => ({ id: e.id, company: e.company, role: e.role, round: e.round })),
    model,
  };
}
