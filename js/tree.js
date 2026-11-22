// Passive skill tree + classes. The tree is generated as a ring of six
// class sectors (like PoE), connected by an inner and outer ring.

export const CLASSES = [
  { id: 'witch',    name: 'Witch',    icon: '🧙‍♀️', attr: 'INT',     angle: -90, color: '#5b8cff',
    desc: 'Elemental caster. Converts some physical damage to elemental.',
    bonus: { incEle: 20, convert: 0.25, resist: 5 } },
  { id: 'shadow',   name: 'Shadow',   icon: '🥷',   attr: 'DEX/INT', angle: -30, color: '#3fc2b0',
    desc: 'Critical strike specialist.',
    bonus: { critChance: 40, critMulti: 20 } },
  { id: 'ranger',   name: 'Ranger',   icon: '🏹',   attr: 'DEX',     angle: 30,  color: '#5cc46b',
    desc: 'Fast and evasive.',
    bonus: { aps: 10, incEvasion: 25, critChance: 15 } },
  { id: 'duelist',  name: 'Duelist',  icon: '🤺',   attr: 'STR/DEX', angle: 90,  color: '#e0a040',
    desc: 'Physical weapon master with leech.',
    bonus: { incPhys: 15, aps: 5, leech: 0.5 } },
  { id: 'marauder', name: 'Marauder', icon: '🪓',   attr: 'STR',     angle: 150, color: '#d0453a',
    desc: 'Huge life pool and raw physical power.',
    bonus: { incLife: 20, incPhys: 10, regenPct: 0.5 } },
  { id: 'templar',  name: 'Templar',  icon: '⚜️',   attr: 'STR/INT', angle: 210, color: '#c58cff',
    desc: 'Holy hybrid: armour, resistances and elemental damage.',
    bonus: { incEle: 10, incArmour: 15, resist: 8, incLife: 8 } },
];
export const CLASS_BY_ID = Object.fromEntries(CLASSES.map((c) => [c.id, c]));

export const STAT_TEXT = {
  incPhys: (v) => `+${v}% increased Physical Damage`,
  incEle: (v) => `+${v}% increased Elemental Damage`,
  incAll: (v) => `+${v}% increased Damage`,
  aps: (v) => `+${v}% increased Attack Speed`,
  critChance: (v) => `+${v}% increased Critical Strike Chance`,
  critMulti: (v) => `+${v}% to Critical Strike Multiplier`,
  incLife: (v) => `+${v}% increased maximum Life`,
  incArmour: (v) => `+${v}% increased Armour`,
  incEvasion: (v) => `+${v}% increased Evasion`,
  resist: (v) => `+${v}% to Elemental Resistance`,
  regenPct: (v) => `Regenerate ${v}% of Life per second`,
  leech: (v) => `${v}% of Damage Leeched as Life`,
  block: (v) => `+${v}% Chance to Block (with a shield)`,
  convert: (v) => `${Math.round(v * 100)}% of Physical converted to Elemental`,
  goldFind: (v) => `+${v}% increased Gold Found`,
  rarity: (v) => `+${v}% increased Item Rarity`,
  xpGain: (v) => `+${v}% increased Experience Gain`,
};

// Rule-changing keystones
export const KEYSTONES = {
  resolute:   { name: 'Resolute Technique', icon: '🗿', lines: ['Your hits can never Critically Strike', '45% more Damage'] },
  ironRefl:   { name: 'Iron Reflexes',      icon: '🛡️', lines: ['All Evasion is converted to Armour', '20% increased Armour'] },
  acrobatics: { name: 'Acrobatics',         icon: '🤸', lines: ['Maximum chance to Evade is 85%', '30% more Evasion', '50% less Armour'] },
  assassin:   { name: "Assassin's Mark",    icon: '🎯', lines: ['+120% to Critical Strike Multiplier', 'Non-critical hits deal 40% less Damage'] },
  overload:   { name: 'Elemental Overload', icon: '⚡', lines: ['100% of Physical converted to Elemental', '30% more Elemental Damage'] },
  bulwark:    { name: 'Divine Bulwark',     icon: '✨', lines: ['+10% to maximum Elemental Resistance', 'Regenerate 1% of Life per second'] },
  vaalPact:   { name: 'Vaal Pact',          icon: '🩸', lines: ['Life Leech is tripled', 'You have no Life Regeneration'] },
  glass:      { name: 'Glass Cannon',       icon: '💎', lines: ['50% less maximum Life', '60% more Damage'] },
};

// Per-class branches: [left, middle(keystone), right]
const BRANCHES = {
  witch: [
    { small: { incEle: 6 }, notable: ['Arcane Potency', { incEle: 20, critChance: 15 }] },
    { small: { resist: 3 }, notable: ['Elemental Ward', { resist: 10, incLife: 6 }], keystone: 'overload' },
    { small: { regenPct: 0.15 }, notable: ['Soul Siphon', { regenPct: 0.5, incLife: 8 }] },
  ],
  shadow: [
    { small: { incEle: 4, critChance: 4 }, notable: ['Toxic Edge', { incEle: 15, critMulti: 10 }] },
    { small: { critMulti: 5 }, notable: ['Deadly Precision', { critMulti: 20, critChance: 15 }], keystone: 'assassin' },
    { small: { critChance: 8 }, notable: ['Assassinate', { critChance: 30, aps: 4 }] },
  ],
  ranger: [
    { small: { critChance: 6, aps: 1 }, notable: ['Eagle Eye', { critChance: 25, critMulti: 10 }] },
    { small: { incEvasion: 8 }, notable: ['Fleet Footed', { incEvasion: 25, aps: 4 }], keystone: 'acrobatics' },
    { small: { aps: 2 }, notable: ['Rapid Assault', { aps: 8, incPhys: 8 }] },
  ],
  duelist: [
    { small: { incPhys: 4, aps: 1 }, notable: ['Blade Dancer', { incPhys: 12, aps: 6 }] },
    { small: { incArmour: 5, incEvasion: 5 }, notable: ['Duellist\'s Guard', { incArmour: 15, incEvasion: 15, block: 4 }], keystone: 'ironRefl' },
    { small: { leech: 0.3 }, notable: ['Bloodthirst', { leech: 1, incPhys: 10 }] },
  ],
  marauder: [
    { small: { incArmour: 8 }, notable: ['Iron Skin', { incArmour: 25, resist: 6 }] },
    { small: { incPhys: 6 }, notable: ['Brute Force', { incPhys: 18, incAll: 6 }], keystone: 'resolute' },
    { small: { incLife: 4 }, notable: ['Thick Skin', { incLife: 10, regenPct: 0.3 }] },
  ],
  templar: [
    { small: { resist: 2, incLife: 2 }, notable: ['Sanctuary', { resist: 8, incLife: 8 }] },
    { small: { incEle: 3, incArmour: 4 }, notable: ['Holy Might', { incEle: 12, incArmour: 15 }], keystone: 'bulwark' },
    { small: { block: 1 }, notable: ['Bastion', { block: 6, incArmour: 15 }] },
  ],
};
const INNER_UTIL = [{ goldFind: 6 }, { rarity: 5 }, { xpGain: 4 }];
// Outer-ring notables between sector i and i+1 (indexed by first sector)
const OUTER_NOTABLES = [
  ['Arcane Assassin', { incEle: 10, critChance: 15 }],   // witch-shadow
  ['Hunter\'s Gambit', { critChance: 15, aps: 5 }],      // shadow-ranger
  ['Wind Blade', { aps: 6, incPhys: 10 }],               // ranger-duelist
  ['Gladiator', { incPhys: 12, incLife: 6 }],            // duelist-marauder
  ['Unbreakable', { incArmour: 20, incLife: 8 }],        // marauder-templar
  ['Divine Fury', { incEle: 12, resist: 6 }],            // templar-witch
];
// Extra keystones on spurs off the outer ring
const OUTER_KEYSTONES = { 3: 'vaalPact', 0: 'glass' };

const merge = (a, b) => {
  const o = { ...a };
  for (const [k, v] of Object.entries(b)) o[k] = +((o[k] || 0) + v).toFixed(2);
  return o;
};
const quarter = (s) => Object.fromEntries(Object.entries(s).map(([k, v]) => [k, +(v * 0.25).toFixed(3)]));
const halve = (s) => Object.fromEntries(Object.entries(s).map(([k, v]) => [k, +(v * 0.6).toFixed(2)]));

function buildTree() {
  const nodes = {};
  const edges = [];
  const rad = (d) => (d * Math.PI) / 180;
  const pos = (ang, r) => ({ x: +(Math.cos(rad(ang)) * r).toFixed(1), y: +(Math.sin(rad(ang)) * r).toFixed(1) });
  const add = (id, n) => { nodes[id] = { id, ...n, adj: [] }; return id; };
  const link = (a, b) => { nodes[a].adj.push(b); nodes[b].adj.push(a); edges.push([a, b]); };

  const RADII = [150, 195, 240, 290, 335, 380];
  CLASSES.forEach((c, ci) => {
    const start = add(`start_${c.id}`, { kind: 'start', cls: c.id, name: c.name, icon: c.icon, stats: quarter(c.bonus), ...pos(c.angle, 90) });
    BRANCHES[c.id].forEach((b, bi) => {
      const ang = c.angle + (bi - 1) * 18;
      let prev = start;
      RADII.forEach((r, ri) => {
        const id = `${c.id}_${bi}_${ri}`;
        const notable = ri === 3;
        add(id, notable
          ? { kind: 'notable', name: b.notable[0], stats: b.notable[1], cls: c.id, ...pos(ang, r) }
          : { kind: 'small', stats: b.small, cls: c.id, ...pos(ang, r) });
        link(prev, id);
        prev = id;
      });
      if (b.keystone) {
        const k = add(`ks_${b.keystone}`, { kind: 'keystone', keystone: b.keystone, name: KEYSTONES[b.keystone].name, icon: KEYSTONES[b.keystone].icon, stats: {}, cls: c.id, ...pos(ang, 440) });
        link(prev, k);
      }
    });
  });
  // Inner ring between class starts
  CLASSES.forEach((c, ci) => {
    const n = CLASSES[(ci + 1) % CLASSES.length];
    const a = `start_${c.id}`, b = `start_${n.id}`;
    const i1 = add(`inner_${ci}_0`, { kind: 'small', stats: INNER_UTIL[ci % 3], ...pos(c.angle + 20, 112) });
    const i2 = add(`inner_${ci}_1`, { kind: 'small', stats: INNER_UTIL[(ci + 1) % 3], ...pos(c.angle + 40, 112) });
    link(a, i1); link(i1, i2); link(i2, b);
  });
  // Outer ring between neighbouring sectors' outer branch ends
  CLASSES.forEach((c, ci) => {
    const n = CLASSES[(ci + 1) % CLASSES.length];
    const from = `${c.id}_2_5`, to = `${n.id}_0_5`;
    const sA = BRANCHES[c.id][2].small, sB = BRANCHES[n.id][0].small;
    const o1 = add(`outer_${ci}_0`, { kind: 'small', stats: halve(merge(sA, sB)), ...pos(c.angle + 26, 395) });
    const [nm, st] = OUTER_NOTABLES[ci];
    const o2 = add(`outer_${ci}_1`, { kind: 'notable', name: nm, stats: st, ...pos(c.angle + 30, 405) });
    const o3 = add(`outer_${ci}_2`, { kind: 'small', stats: halve(merge(sA, sB)), ...pos(c.angle + 34, 395) });
    link(from, o1); link(o1, o2); link(o2, o3); link(o3, to);
    const ks = OUTER_KEYSTONES[ci];
    if (ks) {
      const k = add(`ks_${ks}`, { kind: 'keystone', keystone: ks, name: KEYSTONES[ks].name, icon: KEYSTONES[ks].icon, stats: {}, ...pos(c.angle + 30, 465) });
      link(o2, k);
    }
  });
  return { nodes, edges };
}

export const TREE = buildTree();
export const NODES = TREE.nodes;

// Points: 1 per level to 100, then 1 per 4 levels (forces build choices)
export const treePointsTotal = (level) => Math.min(level - 1, 99) + Math.floor(Math.max(0, level - 100) / 4);
export const treePointsSpent = (state) => (state.tree || []).length;
export const treePointsFree = (state) => treePointsTotal(state.level) - treePointsSpent(state);

export function allocatedSet(state) {
  const s = new Set(state.tree || []);
  if (state.cls) s.add(`start_${state.cls}`);
  return s;
}

// Can this node be allocated right now (adjacent to something you have)?
export function isAllocatable(state, id, set = allocatedSet(state)) {
  const n = NODES[id];
  if (!n || set.has(id)) return false;
  return n.adj.some((a) => set.has(a));
}

// Shortest path of unallocated nodes from your tree to `id` (inclusive)
export function pathTo(state, id) {
  const set = allocatedSet(state);
  if (set.has(id)) return [];
  const prev = new Map();
  const q = [...set];
  const seen = new Set(set);
  while (q.length) {
    const cur = q.shift();
    for (const nb of NODES[cur].adj) {
      if (seen.has(nb)) continue;
      seen.add(nb); prev.set(nb, cur); q.push(nb);
      if (nb === id) {
        const path = [];
        let p = id;
        while (p && !set.has(p)) { path.unshift(p); p = prev.get(p); }
        return path;
      }
    }
  }
  return [];
}

// Refunding a node must not disconnect any other allocated node
export function canRefund(state, id) {
  const set = allocatedSet(state);
  if (!set.has(id) || id === `start_${state.cls}`) return false;
  set.delete(id);
  const root = `start_${state.cls}`;
  const seen = new Set([root]);
  const q = [root];
  while (q.length) {
    const cur = q.shift();
    for (const nb of NODES[cur].adj) if (set.has(nb) && !seen.has(nb)) { seen.add(nb); q.push(nb); }
  }
  return seen.size === set.size;
}

// Total stat bonuses + keystone flags from class and tree
export function treeBonuses(state) {
  const out = {};
  const ks = new Set();
  const add = (s) => { for (const [k, v] of Object.entries(s)) out[k] = (out[k] || 0) + v; };
  const cls = CLASS_BY_ID[state.cls];
  if (cls) add(cls.bonus);
  for (const id of state.tree || []) {
    const n = NODES[id];
    if (!n) continue;
    add(n.stats);
    if (n.keystone) ks.add(n.keystone);
  }
  return { stats: out, keystones: ks };
}

export function nodeLines(n, own = false) {
  if (n.kind === 'keystone') return KEYSTONES[n.keystone].lines;
  if (n.kind === 'start' && own) return [CLASS_BY_ID[n.cls].desc, ...Object.entries(CLASS_BY_ID[n.cls].bonus).map(([k, v]) => STAT_TEXT[k](v))];
  return Object.entries(n.stats).map(([k, v]) => STAT_TEXT[k](v));
}

export const refundCost = (level) => Math.ceil(8 * Math.pow(1.04, level) * (1 + level * 0.1));
export const resetCost = (level) => refundCost(level) * 15;
