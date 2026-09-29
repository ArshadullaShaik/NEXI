'use client';
// Last line of defence for the whole app.
//
// Without this, any render-time throw unmounts the entire React tree and the user gets a
// blank white page with no way back — which is exactly what a stray `e.target.value` in
// components/Interview.js did: the whole app died the moment that tab was opened, and
// nothing on screen said why.
//
// `reset()` re-mounts the children, so a transient failure is recoverable in place, and the
// technical detail is kept behind a disclosure for whoever has to report it.

import { useEffect } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

export default function Error({ error, reset }) {
  useEffect(() => {
    console.error('[app error]', error);
  }, [error]);

  return (
    <div className="min-h-screen grid place-items-center px-4 py-10">
      <div className="max-w-md w-full text-center">
        <AlertTriangle size={32} className="mx-auto mb-3 text-amber-500" />
        <h1 className="text-lg font-semibold text-slate-900">Something broke on this screen</h1>
        <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">
          The rest of the app is fine — your profile, resumes and roadmaps are untouched. Try again,
          and if it keeps happening, copy the detail below into a bug report.
        </p>
        <button type="button" onClick={reset}
          className="mt-4 inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg">
          <RotateCcw size={15} /> Try again
        </button>
        <details className="mt-5 text-left">
          <summary className="text-xs text-slate-400 cursor-pointer">Technical detail</summary>
          <pre className="mt-2 text-[11px] text-slate-500 bg-slate-100 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-words">
            {error?.message || String(error)}
          </pre>
        </details>
      </div>
    </div>
  );
}
