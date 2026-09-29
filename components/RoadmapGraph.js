'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Plus, Minus, Maximize2, Minimize2, Frame, Lightbulb, ExternalLink } from 'lucide-react';

// ---- canvas geometry (all px, so wiring is exact — no measuring/relayout) -----
const CW = 1120;                 // canvas width
const CX = CW / 2;               // spine x
const SPINE_W = 220, BR_W = 240; // node widths
const BH = 60, NOTE_H = 88;      // node heights
const BAN_W = 400, BAN_H = 96;   // stage banner
// Board width must fit three columns plus both branch gaps with margin:
// spine 220 + 2×(branch 240 + gap 26) + 2×margin 32 = 1096 → round to 1120.
const ROW_GAP = 46, STAGE_GAP = 68, PAD_T = 40, PAD_B = 70;
// Branch columns hug the spine: a short connector reads as connected, a long
// one reads as a line to nowhere.
const BR_GAP = 26;                        // horizontal gap between spine edge and branch
const LEFT_X = CX - SPINE_W / 2 - BR_GAP - BR_W;
const RIGHT_X = CX + SPINE_W / 2 + BR_GAP;
const CENTER_X = CX - SPINE_W / 2;

// Split a stage's nodes into rows: skills (or tasks when a stage has none) run
// down the spine, tasks/notes fan off left and right like roadmap.sh branches.
function rowsFor(nodes) {
  const rows = [];
  const hasSkill = nodes.some((n) => n.type === 'skill');
  let cursor = 'left';
  const place = (n) => {
    const last = rows[rows.length - 1];
    const other = cursor === 'left' ? 'right' : 'left';
    if (last && last[cursor] === undefined) last[cursor] = n;
    else if (last && last[other] === undefined) last[other] = n;
    else rows.push({ [cursor]: n });
    cursor = other;
  };
  for (const n of nodes) {
    if (n.type === 'skill' || (!hasSkill && n.type === 'task')) rows.push({ center: n });
    else place(n);
  }
  return rows;
}

// Horizontal S-curve used for every branch wire.
const curve = (x1, y1, x2, y2) => {
  const dx = Math.max(28, Math.abs(x2 - x1) * 0.5);
  const s = x2 < x1 ? -1 : 1;
  return `M ${x1} ${y1} C ${x1 + dx * s} ${y1}, ${x2 - dx * s} ${y2}, ${x2} ${y2}`;
};

function layout(stages) {
  const boxes = [], wires = [], stageTop = {};
  let y = PAD_T;
  for (const st of stages) {
    stageTop[st.key] = y;
    boxes.push({ type: 'banner', stage: st, id: `b:${st.key}`, x: CX - BAN_W / 2, y, w: BAN_W, h: BAN_H });
    const spineTop = y + BAN_H;          // the spine starts under the stage banner
    const branches = [];
    let spineBottom = spineTop;
    y += BAN_H + ROW_GAP;
    for (const row of rowsFor(st.nodes)) {
      const hs = [BH];
      if (row.center) hs.push(BH);
      if (row.left) hs.push(row.left.type === 'note' ? NOTE_H : BH);
      if (row.right) hs.push(row.right.type === 'note' ? NOTE_H : BH);
      const rowH = Math.max(...hs);
      const put = (n, x, w) => {
        const h = n.type === 'note' ? NOTE_H : BH;
        const top = y + (rowH - h) / 2;
        boxes.push({ type: 'node', node: n, stage: st, id: n.id, x, y: top, w, h });
        return { x, y: top, w, h };
      };
      const c = row.center ? put(row.center, CENTER_X, SPINE_W) : null;
      const l = row.left ? put(row.left, LEFT_X, BR_W) : null;
      const r = row.right ? put(row.right, RIGHT_X, BR_W) : null;

      if (c) {
        // Branch wires leave the spine box's own edges, so node → node is obvious.
        const my = c.y + c.h / 2;
        if (l) branches.push({ type: 'branch', d: curve(c.x, my, l.x + l.w, l.y + l.h / 2) });
        if (r) branches.push({ type: 'branch', d: curve(c.x + c.w, my, r.x, r.y + r.h / 2) });
      } else {
        // No spine box on this row: tee the branch(es) off the spine itself at
        // this row's midpoint, so the wire keeps going instead of stopping in
        // mid-air.
        const my = y + rowH / 2;
        if (l) branches.push({ type: 'branch', d: curve(CX, my, l.x + l.w, l.y + l.h / 2) });
        if (r) branches.push({ type: 'branch', d: curve(CX, my, r.x, r.y + r.h / 2) });
        if (l || r) branches.push({ type: 'tee', x: CX, y: my });
      }
      spineBottom = Math.max(spineBottom, y + rowH);
      y += rowH + ROW_GAP;
    }
    // One unbroken spine per stage, drawn behind the boxes (they paint over it),
    // so consecutive topics read as a single connected chain.
    wires.push({ type: 'spine', d: `M ${CX} ${spineTop} L ${CX} ${spineBottom}` });
    wires.push(...branches);
    y += STAGE_GAP - ROW_GAP;
  }
  return { boxes, wires, height: y + PAD_B - ROW_GAP, stageTop };
}

const clamp2 = 'clamp2', clamp1 = 'clamp1', clamp3 = 'clamp3';

function GraphNode({ b, isDone, onToggle, onOpen }) {
  const n = b.node;
  const style = { left: b.x, top: b.y, width: b.w, height: b.h };
  const done = isDone(n.id);

  if (n.type === 'note') {
    return (
      <div style={style} className="absolute rounded-md border border-slate-300 bg-white px-2.5 py-1.5 overflow-hidden shadow-sm">
        <p className={`flex gap-1 text-[10px] leading-[1.35] text-slate-600 ${clamp3}`}>
          <Lightbulb size={11} className="shrink-0 mt-0.5 text-amber-500" />{n.text}
        </p>
        {n.link && (
          <a href={n.link.url} target="_blank" rel="noopener noreferrer"
            className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-600 hover:underline">
            {n.link.label}<ExternalLink size={9} />
          </a>
        )}
      </div>
    );
  }

  const center = b.x === CENTER_X;
  const toggle = (e) => { e.stopPropagation(); onToggle(n.id); };
  return (
    <button type="button" style={style} onClick={() => onOpen(n, b.stage)}
      className={`absolute rounded-md border px-2.5 py-1.5 pr-6 overflow-hidden text-left transition-shadow duration-150
        ${center ? 'bg-amber-300 border-slate-900 hover:shadow-[3px_3px_0_rgba(15,23,42,.3)]'
          : 'bg-amber-100 border-slate-700 hover:shadow-[3px_3px_0_rgba(15,23,42,.25)]'}
        ${done ? 'shadow-none' : ''}`}>
      <span className={`block text-[11.5px] font-semibold leading-[1.3] ${clamp2} ${done ? 'line-through text-slate-500' : 'text-slate-900'}`}>
        {center ? n.label : <><span className="text-slate-500 mr-1">▸</span>{n.label}</>}
      </span>
      {n.resources?.length
        ? <span className={`block text-[9.5px] leading-tight mt-0.5 ${clamp1} ${done ? 'text-slate-400' : 'text-slate-600'}`}>{n.resources.length} resource{n.resources.length > 1 ? 's' : ''} →</span>
        : n.desc ? <span className={`block text-[9.5px] leading-tight mt-0.5 ${clamp1} ${done ? 'text-slate-400' : 'text-slate-600'}`}>{n.desc}</span> : null}
      {/* generous hit area around a tiny dot */}
      <span role="checkbox" aria-checked={!!done} aria-label={done ? `Mark ${n.label} not done` : `Mark ${n.label} done`} tabIndex={0} onClick={toggle}
        onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); toggle(ev); } }}
        className="absolute right-1 top-1/2 -translate-y-1/2 -m-2 p-2 cursor-pointer rounded-full">
        <span className={`w-4 h-4 rounded-full border flex items-center justify-center transition
          ${done ? 'bg-violet-600 border-violet-600' : 'bg-white border-slate-400 hover:border-violet-500'}`}>
          {done && <Check size={10} strokeWidth={4} className="text-white" />}
        </span>
      </span>
    </button>
  );
}

function StageBanner({ b, onOpen, onToggle }) {
  const st = b.stage;
  const style = { left: b.x, top: b.y, width: b.w, height: b.h };
  const done = st.pct === 100;
  const toggle = (e) => { e.stopPropagation(); onToggle(st); };
  return (
    <button type="button" style={style} onClick={() => onOpen(st)}
      className={`absolute rounded-lg border-2 px-3 py-2 pr-11 text-left overflow-hidden transition-shadow duration-150 hover:shadow-[4px_4px_0_rgba(15,23,42,.3)]
        ${done ? 'bg-emerald-50 border-emerald-500' : st.current ? 'bg-amber-300 border-slate-900' : 'bg-white border-slate-900'}`}>
      <span className={`block text-[9px] font-bold uppercase tracking-[.12em] ${done ? 'text-emerald-600' : 'text-slate-500'}`}>
        Stage {st.n} · {st.kicker}
      </span>
      <span className={`block text-[13.5px] font-bold text-slate-900 leading-tight ${done ? 'line-through text-slate-400' : ''}`}>{st.title}</span>
      <span className={`block text-[10px] leading-snug mt-0.5 text-slate-600 ${clamp2}`}>{st.goal}</span>
      <span role="checkbox" aria-checked={done} aria-label={done ? `Mark stage ${st.n} not done` : `Mark stage ${st.n} done`} tabIndex={0} onClick={toggle}
        onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); toggle(ev); } }}
        className={`absolute right-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full border-2 flex items-center justify-center text-[10px] font-bold transition
          ${done ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white border-slate-400 text-slate-500 hover:border-violet-500'}`}>
        {done ? <Check size={15} strokeWidth={3} /> : `${st.pct}%`}
      </span>
    </button>
  );
}

// Zoomable / pannable canvas viewport. Works with touch (pinch + drag), mouse
// (drag + ctrl/⌘-scroll) and +/−/fit buttons; prints at fixed scale.
export default function RoadmapGraph({ stages, isDone, onToggle, onOpenNode, onOpenStage, focus }) {
  const boxRef = useRef(null), stageRef = useRef(null), zRef = useRef(null);
  const tf = useRef({ z: 0.3, x: 0, y: 0 });
  const touched = useRef(false);
  const ptrs = useRef(new Map());
  const pinch = useRef(null);
  const dragged = useRef(false);
  const captured = useRef(null);          // pointerId currently captured (only mid-drag)
  const [full, setFull] = useState(false); // real fullscreen, or the CSS fallback overlay

  const lay = useMemo(() => layout(stages), [stages]);

  const apply = () => {
    const t = tf.current;
    if (stageRef.current) stageRef.current.style.transform = `translate(${t.x}px, ${t.y}px) scale(${t.z})`;
    if (zRef.current) zRef.current.textContent = `${Math.round(t.z * 100)}%`;
  };
  const fit = () => {
    const b = boxRef.current; if (!b) return;
    const t = tf.current;
    t.z = Math.min(1, (b.clientWidth - 24) / CW);
    t.x = (b.clientWidth - CW * t.z) / 2;
    t.y = 14;
    apply();
  };
  const zoomAt = (f, p) => {
    const b = boxRef.current; if (!b) return;
    const r = b.getBoundingClientRect();
    const px = p.x - r.left, py = p.y - r.top;
    const t = tf.current;
    const nz = Math.min(2.5, Math.max(0.15, t.z * f));
    const k = nz / t.z;
    t.x = px - (px - t.x) * k;
    t.y = py - (py - t.y) * k;
    t.z = nz;
    apply();
  };
  const zoomButtons = (f) => {
    const r = boxRef.current?.getBoundingClientRect(); if (!r) return;
    touched.current = true;
    zoomAt(f, { x: r.left + r.width / 2, y: r.top + r.height / 2 });
  };
  const panTo = (key) => {
    const top = lay.stageTop[key]; const b = boxRef.current;
    if (top == null || !b) return;
    const t = tf.current;
    t.z = Math.max(t.z, Math.min(1, (b.clientWidth - 24) / CW));
    t.x = b.clientWidth / 2 - CX * t.z;
    t.y = 24 - top * t.z;
    if (stageRef.current) stageRef.current.style.transition = 'transform .45s ease';
    apply();
    setTimeout(() => { if (stageRef.current) stageRef.current.style.transition = ''; }, 500);
  };

  // ---- fullscreen ------------------------------------------------------------
  // Uses the Fullscreen API where it exists (desktop, Android) and falls back to
  // a fixed, viewport-filling overlay where it doesn't (iOS Safari).
  const enterFull = async () => {
    const el = boxRef.current;
    try {
      if (el?.requestFullscreen) {
        // Some environments (iOS Safari, embedded/automated views) resolve the
        // promise without ever engaging — don't wait on it, and don't trust it.
        await Promise.race([
          Promise.resolve(el.requestFullscreen()).catch(() => {}),
          new Promise((r) => setTimeout(r, 400)),
        ]);
        if (document.fullscreenElement === el) return;
      }
    } catch {}
    setFull(true);   // CSS overlay fallback: still fills the whole screen
  };
  const exitFull = async () => {
    try { if (document.fullscreenElement) await document.exitFullscreen(); } catch {}
    setFull(false);
  };
  useEffect(() => {
    const onChange = () => {
      const on = document.fullscreenElement === boxRef.current;
      setFull(on);
      if (on) { touched.current = false; fit(); }   // refit for the bigger board
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!full) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // Escape leaves the CSS fallback; the real API handles Escape itself.
    const onKey = (e) => { if (e.key === 'Escape' && !document.fullscreenElement) setFull(false); };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, [full]);

  // Initial fit + refit on viewport resize until the user takes over.
  useEffect(() => {
    fit();
    const ro = new ResizeObserver(() => { if (!touched.current) fit(); });
    if (boxRef.current) ro.observe(boxRef.current);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Wheel: ctrl/⌘-scroll (and trackpad pinch) always zooms; horizontal scroll
  // always pans the board; plain vertical wheel pans only once the board has
  // been clicked (focused) — otherwise the page scrolls as usual.
  useEffect(() => {
    const el = boxRef.current; if (!el) return;
    const onWheel = (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        touched.current = true;
        zoomAt(Math.exp(-e.deltaY * 0.0035), { x: e.clientX, y: e.clientY });
        return;
      }
      if (e.deltaX) {
        e.preventDefault();
        touched.current = true;
        tf.current.x -= e.deltaX;
        apply();
      }
      if (document.activeElement === el) {
        e.preventDefault();
        touched.current = true;
        tf.current.y -= e.deltaY;
        apply();
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Stage-pill click → glide the canvas to that stage.
  useEffect(() => { if (focus?.key) panTo(focus.key); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [focus?.n]);

  // Keyboard: arrows pan (shift = further), +/− zoom, 0 refits.
  const onKeyDown = (e) => {
    const t = tf.current;
    const step = e.shiftKey ? 220 : 80;
    const pan = (dx, dy) => { touched.current = true; t.x += dx; t.y += dy; apply(); e.preventDefault(); };
    switch (e.key) {
      case 'ArrowLeft': return pan(step, 0);
      case 'ArrowRight': return pan(-step, 0);
      case 'ArrowUp': return pan(0, step);
      case 'ArrowDown': return pan(0, -step);
      case '+': case '=': zoomButtons(1.25); return e.preventDefault();
      case '-': case '_': zoomButtons(0.8); return e.preventDefault();
      case '0': touched.current = false; fit(); return e.preventDefault();
      default: return;
    }
  };

  const onPointerDown = (e) => {
    // Zoom/fit buttons keep their own clicks — never treat them as a pan.
    if (e.target instanceof Element && e.target.closest('.rm-controls')) return;
    if (e.button !== 0 && e.button !== 1) return;
    if (e.button === 1) e.preventDefault(); // middle-drag pans instead of autoscroll
    e.currentTarget.focus?.({ preventScroll: true });
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY, ox: e.clientX, oy: e.clientY });
    dragged.current = false;
    if (ptrs.current.size === 2) {
      const [a, b] = [...ptrs.current.values()];
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
    }
  };
  const onPointerMove = (e) => {
    const m = ptrs.current;
    const p = m.get(e.pointerId);
    if (!p) return;
    const prev = { x: p.x, y: p.y };
    m.set(e.pointerId, { ...p, x: e.clientX, y: e.clientY });

    // A press travels <8px → it's a click, not a drag. Only real drags capture
    // the pointer (capture would retarget the click to this container and kill
    // node/checkbox/zoom-button clicks) and only they get suppressed afterwards.
    if (Math.hypot(e.clientX - p.ox, e.clientY - p.oy) > 8) {
      dragged.current = true;
      if (m.size === 1 && captured.current == null) {
        try { e.currentTarget.setPointerCapture(e.pointerId); captured.current = e.pointerId; } catch {}
      }
    }

    if (m.size === 1) {
      if (!dragged.current) return;          // not a drag yet — leave the click intact
      touched.current = true;
      const t = tf.current;
      t.x += e.clientX - prev.x;
      t.y += e.clientY - prev.y;
      apply();
    } else if (m.size === 2 && pinch.current) {
      dragged.current = true;                // two fingers are never a click
      touched.current = true;
      const [a, b] = [...m.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      zoomAt(dist / pinch.current.dist, mid);
      const t = tf.current;
      t.x += mid.x - pinch.current.mid.x;
      t.y += mid.y - pinch.current.mid.y;
      apply();
      pinch.current = { dist, mid };
    }
  };
  const onPointerEnd = (e) => {
    ptrs.current.delete(e.pointerId);
    if (captured.current === e.pointerId) {
      try { e.currentTarget.releasePointerCapture?.(e.pointerId); } catch {}
      captured.current = null;
    }
    if (ptrs.current.size < 2) pinch.current = null;
  };
  // Suppress the click that follows a drag so panning never opens a node.
  // Always clear the flag: a stale one would swallow later real clicks.
  const onClickCapture = (e) => {
    if (dragged.current) { e.stopPropagation(); e.preventDefault(); }
    dragged.current = false;
  };

  // Double-click zooms in — but only on empty canvas, never on a box or link
  // (those already use clicks for resources / tick).
  const onDoubleClick = (e) => {
    if (e.target instanceof Element && e.target.closest('button, a')) return;
    touched.current = true;
    zoomAt(1.45, { x: e.clientX, y: e.clientY });
  };

  const btn = 'w-8 h-8 rounded-md border border-slate-300 bg-white/95 shadow-sm flex items-center justify-center text-slate-600 hover:text-slate-900 hover:border-slate-500 transition';

  return (
    <div ref={boxRef} tabIndex={0}
      className={`rm-viewport overflow-hidden bg-white touch-none select-none cursor-grab active:cursor-grabbing focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400
        ${full ? 'fixed inset-0 z-50 w-screen h-[100dvh] rounded-none border-0'
          : 'relative rounded-xl border border-slate-300 h-[70vh] min-h-[420px] md:h-[660px]'}`}
      onPointerDown={onPointerDown} onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd} onPointerCancel={onPointerEnd} onClickCapture={onClickCapture}
      onDoubleClick={onDoubleClick} onKeyDown={onKeyDown}>

      <div ref={stageRef} className="rm-stage absolute left-0 top-0 origin-top-left will-change-transform"
        style={{ width: CW, height: lay.height }}>
        {/* dot-grid canvas background */}
        <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(#e2e8f0 1px, transparent 1px)', backgroundSize: '24px 24px' }} />

        {/* wires first so every box paints above them */}
        <svg width={CW} height={lay.height} className="absolute inset-0 pointer-events-none">
          {lay.wires.map((w, i) => (
            w.type === 'tee'
              // small dot where a branch leaves a spine segment
              ? <circle key={i} cx={w.x} cy={w.y} r={3.5} fill="#93c5fd" />
              : <path key={i} d={w.d} fill="none"
                stroke={w.type === 'spine' ? '#2563eb' : '#93c5fd'}
                strokeWidth={w.type === 'spine' ? 2.5 : 1.6}
                strokeDasharray={w.type === 'spine' ? undefined : '1 7'}
                strokeLinecap="round" />
          ))}
        </svg>

        {/* legend */}
        <div className="absolute rounded-lg border border-slate-300 bg-white/95 px-3 py-2 space-y-1 shadow-sm"
          style={{ left: LEFT_X, top: PAD_T, width: 252 }}>
          <p className="text-[9px] font-bold uppercase tracking-[.12em] text-slate-500">How to read</p>
          <p className="flex items-center gap-2 text-[10px] text-slate-600">
            <span className="w-3.5 h-3.5 rounded-full bg-violet-600 inline-flex items-center justify-center"><Check size={9} strokeWidth={4} className="text-white" /></span>
            Done — ticked off
          </p>
          <p className="flex items-center gap-2 text-[10px] text-slate-600">
            <span className="w-3.5 h-3.5 rounded-full border border-slate-400 bg-white inline-block" />Not started — click a box for resources
          </p>
          <p className="flex items-center gap-2 text-[10px] text-slate-600">
            <span className="w-3.5 h-3 rounded-sm bg-amber-300 border border-slate-900 inline-block" />Topic to learn
          </p>
        </div>

        {lay.boxes.map((b) => (b.type === 'banner'
          ? <StageBanner key={b.id} b={b} onOpen={onOpenStage} onToggle={onToggle} />
          : <GraphNode key={b.id} b={b} isDone={isDone} onToggle={onToggle} onOpen={onOpenNode} />))}
      </div>

      {/* controls */}
      <div className="rm-controls absolute bottom-3 right-3 z-10 flex flex-col items-center gap-1.5 print:hidden">
        <button className={btn} onClick={() => (full ? exitFull() : enterFull())}
          aria-label={full ? 'Exit fullscreen' : 'Enter fullscreen'} title={full ? 'Exit fullscreen' : 'View fullscreen'}>
          {full ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        </button>
        <button className={btn} onClick={() => zoomButtons(1.25)} aria-label="Zoom in" title="Zoom in"><Plus size={15} /></button>
        <span ref={zRef} className="text-[10px] font-semibold text-slate-500 bg-white/90 border border-slate-200 rounded px-1.5 py-0.5">30%</span>
        <button className={btn} onClick={() => zoomButtons(0.8)} aria-label="Zoom out" title="Zoom out"><Minus size={15} /></button>
        <button className={btn} onClick={() => { touched.current = false; fit(); }} aria-label="Fit to view" title="Fit to view"><Frame size={14} /></button>
      </div>
      <div className="rm-controls absolute bottom-3 left-3 z-10 text-[10px] text-slate-500 bg-white/90 border border-slate-200 rounded-full px-2.5 py-1 print:hidden">
        <span className="sm:hidden">Drag to pan · pinch to zoom</span>
        <span className="hidden sm:inline">Drag or arrow keys to pan · + − 0 to zoom · ctrl-scroll to zoom</span>
      </div>
    </div>
  );
}
