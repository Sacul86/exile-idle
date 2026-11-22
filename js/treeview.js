// Interactive passive tree: SVG with drag-to-pan, pinch/wheel zoom, tap to select.
import { TREE, NODES, CLASS_BY_ID, allocatedSet, isAllocatable, pathTo } from './tree.js';

const view = { k: 0.9, tx: null, ty: null };
let selected = null;

export const getSelected = () => selected;
export const setSelected = (id) => { selected = id; };

export function renderTreeSvg(svgWrap, state, onSelect) {
  const w = svgWrap.clientWidth || 360;
  const h = svgWrap.clientHeight || 420;
  if (view.tx == null) {
    const start = NODES[`start_${state.cls}`];
    view.tx = w / 2 - (start ? start.x * 1.4 : 0) * view.k;
    view.ty = h / 2 - (start ? start.y * 1.4 : 0) * view.k;
  }
  const set = allocatedSet(state);
  const path = selected && !set.has(selected) ? new Set(pathTo(state, selected)) : new Set();
  const clsColor = (id) => (CLASS_BY_ID[NODES[id].cls] || {}).color || '#9a8b75';
  const S = 1.4; // spread factor
  let edges = '';
  for (const [a, b] of TREE.edges) {
    const A = NODES[a], B = NODES[b];
    const on = set.has(a) && set.has(b);
    const pv = (path.has(a) || set.has(a)) && (path.has(b) || set.has(b)) && !on;
    edges += `<line x1="${A.x * S}" y1="${A.y * S}" x2="${B.x * S}" y2="${B.y * S}" class="e ${on ? 'on' : pv ? 'pv' : ''}"/>`;
  }
  let nodes = '';
  for (const n of Object.values(NODES)) {
    const on = set.has(n.id);
    const avail = !on && isAllocatable(state, n.id, set);
    const pv = path.has(n.id);
    const r = n.kind === 'keystone' ? 22 : n.kind === 'start' ? 24 : n.kind === 'notable' ? 15 : 9;
    const cls = ['n', n.kind, on ? 'on' : '', avail ? 'av' : '', pv ? 'pv' : '', selected === n.id ? 'sel' : ''].join(' ');
    nodes += `<g class="${cls}" data-node="${n.id}" transform="translate(${n.x * S},${n.y * S})">
      <circle r="${r + 14}" class="hit"/>
      <circle r="${r}" style="--c:${clsColor(n.id)}"/>
      ${n.icon ? `<text dy="0.35em" font-size="${r}">${n.icon}</text>` : ''}
    </g>`;
  }
  svgWrap.innerHTML = `<svg width="100%" height="100%"><g id="tree-g" transform="translate(${view.tx},${view.ty}) scale(${view.k})">${edges}${nodes}</g></svg>`;
  attach(svgWrap, onSelect);
}

function apply(svgWrap) {
  const g = svgWrap.querySelector('#tree-g');
  if (g) g.setAttribute('transform', `translate(${view.tx},${view.ty}) scale(${view.k})`);
}

export function zoom(svgWrap, f) {
  const w = svgWrap.clientWidth, h = svgWrap.clientHeight;
  zoomAt(w / 2, h / 2, f);
  apply(svgWrap);
}
function zoomAt(cx, cy, f) {
  const k2 = Math.max(0.25, Math.min(3, view.k * f));
  f = k2 / view.k;
  view.tx = cx - (cx - view.tx) * f;
  view.ty = cy - (cy - view.ty) * f;
  view.k = k2;
}
export function centerOn(svgWrap, id) {
  const n = NODES[id];
  if (!n) return;
  view.tx = svgWrap.clientWidth / 2 - n.x * 1.4 * view.k;
  view.ty = svgWrap.clientHeight / 2 - n.y * 1.4 * view.k;
  apply(svgWrap);
}

function attach(svgWrap, onSelect) {
  if (svgWrap._attached) return;
  svgWrap._attached = true;
  const pts = new Map();
  let moved = 0, pinch = null, downTarget = null;
  svgWrap.addEventListener('pointerdown', (e) => {
    svgWrap.setPointerCapture?.(e.pointerId);
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 1) { moved = 0; downTarget = e.target.closest('[data-node]'); }
    if (pts.size === 2) {
      const [a, b] = [...pts.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) };
    }
  });
  svgWrap.addEventListener('pointermove', (e) => {
    const p = pts.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (pts.size === 1) {
      moved += Math.abs(dx) + Math.abs(dy);
      view.tx += dx; view.ty += dy;
    } else if (pts.size === 2 && pinch) {
      const [a, b] = [...pts.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const rect = svgWrap.getBoundingClientRect();
      zoomAt((a.x + b.x) / 2 - rect.left, (a.y + b.y) / 2 - rect.top, d / pinch.d);
      pinch.d = d; moved = 999;
    }
    apply(svgWrap);
  });
  const up = (e) => {
    if (!pts.has(e.pointerId)) return;
    pts.delete(e.pointerId);
    if (pts.size < 2) pinch = null;
    if (pts.size === 0 && moved < 10) {
      const t = downTarget || document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-node]');
      onSelect(t ? t.dataset.node : null);
    }
  };
  svgWrap.addEventListener('pointerup', up);
  svgWrap.addEventListener('pointercancel', up);
  svgWrap.addEventListener('wheel', (e) => {
    e.preventDefault();
    const rect = svgWrap.getBoundingClientRect();
    zoomAt(e.clientX - rect.left, e.clientY - rect.top, e.deltaY < 0 ? 1.15 : 1 / 1.15);
    apply(svgWrap);
  }, { passive: false });
}

export function resetView() { view.tx = null; view.ty = null; view.k = 0.9; selected = null; }
