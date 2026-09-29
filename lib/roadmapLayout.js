// Roadmap board geometry + layout.
//
// Kept separate from the React component on purpose: this is pure, testable
// geometry, and the board is a FIXED-SIZE canvas — every box has a known width
// and height, so connectors are computed exactly at render time instead of
// being measured after paint (no reflow, no wires that end in mid-air).
//
// Shape follows roadmap.sh: each topic is a box on the central spine, and the
// tasks/notes belonging to that topic stack in a column beside it. Grouping
// them this way (rather than spreading every task into its own row) is what
// keeps connectors short and unambiguous.

// ---- board geometry (px) -----------------------------------------------------
// margin + (branch 240 + gap 48) + spine 220 + (gap 48 + branch 240) + margin.
// Sized to its content so "fit to width" on a phone doesn't shrink it to mush.
export const BR_W = 240, BR_GAP = 48, SPINE_W = 220;
export const CW = 2 * 42 + 2 * (BR_W + BR_GAP) + SPINE_W;   // 880
export const CX = CW / 2;                                    // spine x
export const BH = 60, NOTE_H = 88;                           // node heights
export const BAN_W = 380, BAN_H = 96;                        // stage banner
export const BR_STACK = 12;                                  // gap inside a branch column
export const GROUP_GAP = 40;                                 // gap between topic groups
export const ROW_GAP = 44;                                   // banner → first group
export const STAGE_GAP = 64, PAD_T = 36, PAD_B = 60;

export const LEFT_X = CX - SPINE_W / 2 - BR_GAP - BR_W;
export const RIGHT_X = CX + SPINE_W / 2 + BR_GAP;
export const CENTER_X = CX - SPINE_W / 2;

const hOf = (n) => (n.type === 'note' ? NOTE_H : BH);
const stackH = (list) => (list.length ? list.reduce((a, n) => a + hOf(n) + BR_STACK, -BR_STACK) : 0);

// Group a stage's nodes: every topic starts a group, and the tasks/notes after
// it attach to that group, alternating sides so both columns fill evenly.
function groupsFor(nodes) {
  const hasSkill = nodes.some((n) => n.type === 'skill');
  const groups = [];
  let cur = null;
  for (const n of nodes) {
    const isSpine = n.type === 'skill' || (!hasSkill && n.type === 'task');
    if (isSpine) { cur = { spine: n, left: [], right: [] }; groups.push(cur); }
    else if (cur) (cur.left.length <= cur.right.length ? cur.left : cur.right).push(n);
    else groups.push({ spine: null, left: [n], right: [] });  // stray item before any topic
  }
  return groups;
}

// Horizontal S-curve for branch wires.
const curve = (x1, y1, x2, y2) => {
  const dx = Math.max(30, Math.abs(x2 - x1) * 0.5);
  const s = x2 < x1 ? -1 : 1;
  return `M ${x1} ${y1} C ${x1 + dx * s} ${y1}, ${x2 - dx * s} ${y2}, ${x2} ${y2}`;
};

/**
 * Turn stages into absolutely-positioned boxes + SVG wires.
 * Returns { boxes, wires, height, stageTop }.
 * box:  { type: 'banner'|'node', id, x, y, w, h, node?, stage? }
 * wire: { type: 'spine'|'branch'|'tee', d? , x?, y? }
 */
export function layout(stages) {
  const boxes = [], wires = [], stageTop = {};
  let y = PAD_T;
  for (const st of stages) {
    stageTop[st.key] = y;
    boxes.push({ type: 'banner', stage: st, id: `b:${st.key}`, x: CX - BAN_W / 2, y, w: BAN_W, h: BAN_H });
    const spineTop = y + BAN_H;
    const branches = [];
    let spineBottom = spineTop;
    y += BAN_H + ROW_GAP;

    for (const g of groupsFor(st.nodes)) {
      const lh = stackH(g.left), rh = stackH(g.right);
      const rowH = Math.max(BH, lh, rh);
      const top = y;
      const add = (n, x, yy) => {
        const h = hOf(n);
        boxes.push({ type: 'node', node: n, stage: st, id: n.id, x, y: yy, w: BR_W, h });
        return { x, y: yy, w: BR_W, h };
      };

      if (g.spine) {
        // Topic centred in its row; branches fan out from the topic's own edges.
        const sb = add(g.spine, CENTER_X, top + (rowH - BH) / 2);
        const my = sb.y + sb.h / 2;
        const drop = (list, x, onRight) => {
          let cy = top + (rowH - stackH(list)) / 2;
          for (const n of list) {
            const b = add(n, x, cy);
            const fromX = onRight ? CENTER_X + SPINE_W : CENTER_X;
            const toX = onRight ? b.x : b.x + b.w;
            branches.push({ type: 'branch', d: curve(fromX, my, toX, b.y + b.h / 2) });
            cy += b.h + BR_STACK;
          }
        };
        drop(g.left, LEFT_X, false);
        drop(g.right, RIGHT_X, true);
      } else {
        const my = top + rowH / 2;
        let cy = top + (rowH - lh) / 2;
        for (const n of g.left) {
          const b = add(n, LEFT_X, cy);
          branches.push({ type: 'branch', d: curve(CX, my, b.x + b.w, b.y + b.h / 2) });
          branches.push({ type: 'tee', x: CX, y: my });
          cy += b.h + BR_STACK;
        }
      }
      spineBottom = Math.max(spineBottom, top + rowH);
      y += rowH + GROUP_GAP;
    }

    // One unbroken spine per stage, drawn behind the boxes (they paint over it),
    // so consecutive topics read as a single connected chain.
    wires.push({ type: 'spine', d: `M ${CX} ${spineTop} L ${CX} ${spineBottom}` });
    wires.push(...branches);
    y += STAGE_GAP - GROUP_GAP;
  }
  return { boxes, wires, height: y + PAD_B - GROUP_GAP, stageTop };
}
