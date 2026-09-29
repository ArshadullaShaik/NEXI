// Smoke-test the Gemini resume reader with the real key from .env.local.
// Usage: node scripts/check-gemini.mjs
// Prints the model walk + the final error/success, without dumping the key.

import { readFileSync } from 'node:fs';

const env = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
const key = (env.match(/^NEXT_PUBLIC_GEMINI_API_KEY=(.*)$/m)?.[1] || '').trim();
if (!key) { console.error('No NEXT_PUBLIC_GEMINI_API_KEY in .env.local'); process.exit(1); }

const MODELS = ['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.5-flash',
  'gemini-3.1-flash-lite', 'gemini-flash-latest', 'gemini-2.5-flash', 'gemini-2.0-flash'];

// 1x1 PNG — a real image part, so this exercises the same payload shape as a scan.
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const payload = {
  contents: [{ parts: [{ inline_data: { mime_type: 'image/png', data: PNG } }, { text: 'Reply with only: {}' }] }],
  generationConfig: { temperature: 0.1, maxOutputTokens: 32 },
};

for (const model of MODELS) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 25000);
  const t0 = Date.now();
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify(payload),
      signal: ctl.signal,
    });
    const body = await res.json().catch(() => ({}));
    const secs = ((Date.now() - t0) / 1000).toFixed(1);
    if (res.ok) {
      console.log(`OK   ${model} (${secs}s) ->`, JSON.stringify(body?.candidates?.[0]?.content?.parts?.[0]?.text || '').slice(0, 80));
      process.exit(0);
    }
    const msg = body?.error?.message || `HTTP ${res.status}`;
    const retryable = res.status === 404 || res.status === 503 ||
      /not found|no longer available|high demand|overloaded|try again later/i.test(msg);
    console.log(`fail ${model} (${secs}s) HTTP ${res.status} retryable=${retryable} :: ${msg.slice(0, 110)}`);
    if (!retryable) { console.log('\n=> Non-retryable: the app would stop here with this message.'); process.exit(1); }
  } catch (e) {
    console.log(`fail ${model} :: ${e.name === 'AbortError' ? 'timeout (25s)' : e.message}`);
  } finally {
    clearTimeout(timer);
  }
}
console.log('\n=> Every model failed as "retryable" — the app shows the friendly "service busy, try again" message.');
