// Keeps public/pdf.worker.min.mjs in sync with the installed pdfjs-dist version.
// Runs on `npm install`; the committed copy means the app also works if scripts are skipped.
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'node_modules', 'pdfjs-dist', 'build', 'pdf.worker.min.mjs');
const destDir = path.join(__dirname, '..', 'public');
const dest = path.join(destDir, 'pdf.worker.min.mjs');

try {
  if (!fs.existsSync(src)) {
    console.warn('[copy-pdf-worker] pdfjs-dist not installed, skipping.');
    process.exit(0);
  }
  fs.mkdirSync(destDir, { recursive: true });
  fs.copyFileSync(src, dest);
  console.log('[copy-pdf-worker] wrote ' + path.relative(process.cwd(), dest));
} catch (e) {
  console.warn('[copy-pdf-worker] skipped: ' + e.message);
}
