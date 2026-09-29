'use client';
// Client-side resume text extraction: .pdf via pdfjs-dist, .txt/.md via FileReader.
// Nothing leaves the browser — the parsed text is handed straight to the app context.

// pdf.js uses Promise.withResolvers (Chrome 119+, Safari 17.4+, Firefox 121+).
if (typeof Promise !== 'undefined' && typeof Promise.withResolvers !== 'function') {
  Promise.withResolvers = function withResolvers() {
    let resolve, reject;
    const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
    return { promise, resolve, reject };
  };
}

let pdfjsPromise = null;
async function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const pdfjs = await import('pdfjs-dist');
      // The worker ships as a static file (see scripts/copy-pdf-worker.js) so pdf.js
      // can spawn it — or fall back to its main-thread mode — from a plain URL.
      pdfjs.GlobalWorkerOptions.workerSrc = `${process.env.NEXT_PUBLIC_BASE_PATH || ''}/pdf.worker.min.mjs`;
      return pdfjs;
    })();
  }
  try {
    return await pdfjsPromise;
  } catch (e) {
    pdfjsPromise = null; // let the next attempt retry a transient failure
    throw e;
  }
}

/** Strips PDF weirdness/newlines so the regex layer sees clean text. */
function tidy(text) {
  return String(text || '')
    .replace(/\u0000/g, '')
    .replace(/[ \t\u00a0]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[^\S\n]+$/gm, '')
    .trim();
}

export async function extractPdfText(data) {
  const pdfjs = await loadPdfjs();
  const doc = await pdfjs.getDocument({ data, isEvalSupported: false, verbosity: 0 }).promise;
  try {
    const pages = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      let out = '';
      let line = '';
      for (const item of content.items) {
        const s = item.str ?? '';
        if (line && s && !/\s$/.test(line) && !/^\s/.test(s)) line += ' ';
        line += s;
        if (item.hasEOL) { out += line + '\n'; line = ''; }
      }
      out += line;
      pages.push(out);
      page.cleanup();
    }
    return tidy(pages.join('\n'));
  } finally {
    await doc.destroy().catch(() => {});
  }
}

/**
 * Reads a resume File (.pdf or plain text) and returns its text.
 * @returns {Promise<{text: string, source: string}>}
 */
export async function extractResumeText(file) {
  if (!file) throw new Error('No file selected.');
  const name = file.name || 'resume';
  const lower = name.toLowerCase();
  const isPdf = lower.endsWith('.pdf') || file.type === 'application/pdf';

  if (isPdf) {
    const buf = await file.arrayBuffer();
    if (!buf.byteLength) throw new Error(`"${name}" is empty.`);
    const text = await extractPdfText(buf);
    if (!text) throw new Error(`No selectable text found in "${name}". Scanned/image-only PDFs need the text pasted below.`);
    return { text, source: name };
  }

  const looksText = /\.(txt|text|md|markdown|rtf|csv|json)$/.test(lower) || /^text\//.test(file.type || '');
  if (looksText) {
    const raw = await file.text();
    const text = tidy(raw);
    if (!text) throw new Error(`"${name}" has no readable text.`);
    return { text, source: name };
  }

  throw new Error(`Unsupported file "${name}". Upload a .pdf or .txt resume, or paste the text below.`);
}
