// Passive skill tree + classes. The tree is a ring of seven class sectors,
// connected by an inner ring, bridge notables and an outer ring.

// Party roles
export const ROLES = {
  tank:   { name: 'Tank',   icon: '🛡️', desc: 'Enemies attack the tank. +40% Life, +30% Armour and Evasion.', bonus: { incLife: 40, incArmour: 30, incEvasion: 30 } },
  healer: { name: 'Healer', icon: '✚',  desc: 'Heals the most injured ally whenever someone is hurt, otherwise attacks.', bonus: {} },
  dps:    { name: 'DPS',    icon: '⚔️', desc: 'Damage dealer. 20% more Damage.', bonus: { moreDmg: 20 } },
};
export const ROLE_ORDER = ['tank', 'healer', 'dps'];

const N_CLS = 7;
const ang = (i) => -90 + i * (360 / N_CLS);
export const CLASSES = [
  { id: 'witch',    name: 'Mage',      role: 'dps',    icon: '🧙', attr: 'INT',     angle: ang(0), color: '#5b8cff',
    desc: 'Elemental caster. Converts some physical damage to elemental.',
    bonus: { incEle: 20, convert: 0.25, resist: 5 } },
  { id: 'shadow',   name: 'Assassin',  role: 'dps',    icon: '🥷', attr: 'DEX/INT', angle: ang(1), color: '#b46bff',
    desc: 'Critical strike specialist with poisoned blades.',
    bonus: { critChance: 60, critMulti: 40, incPhys: 20, aps: 5 } },
  { id: 'ranger',   name: 'Ranger',    role: 'dps',    icon: '🏹', attr: 'DEX',     angle: ang(2), color: '#5cc46b',
    desc: 'Fast and evasive archer.',
    bonus: { aps: 20, incEvasion: 25, critChance: 25, incPhys: 35 } },
  { id: 'druid',    name: 'Druid',     role: 'healer', icon: '🌿', attr: 'INT/DEX', angle: ang(3), color: '#8fd14f',
    desc: 'Nature healer: mends the party over time and roots enemies.',
    bonus: { incHeal: 20, regenPct: 0.5, incEle: 10 } },
  { id: 'duelist',  name: 'Gladiator', role: 'tank',   icon: '🤺', attr: 'STR/DEX', angle: ang(4), color: '#e0a040',
    desc: 'Shield-bearing tank who blocks, dodges and leeches.',
    bonus: { block: 8, incArmour: 15, leech: 0.5 } },
  { id: 'marauder', name: 'Warrior',   role: 'tank',   icon: '🪓', attr: 'STR',     angle: ang(5), color: '#d0453a',
    desc: 'Armoured tank with a huge life pool.',
    bonus: { incLife: 25, incArmour: 20, regenPct: 0.5 } },
  { id: 'templar',  name: 'Templar',   role: 'healer', icon: '⚜️', attr: 'STR/INT', angle: ang(6), color: '#f2d64b',
    desc: 'Holy healer: big party heals, shields and resistances.',
    bonus: { incHeal: 25, resist: 8, incLife: 8 } },
];
export const CLASS_BY_ID = Object.fromEntries(CLASSES.map((c) => [c.id, c]));

export const STAT_TEXT = {
  incPhys: (v) => `+${v}% increased Physical Damage`,
  incHeal: (v) => `+${v}% increased Healing`,
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
  resolute:   { name: 'Unwavering Strike',  icon: '🗿', lines: ['Your hits can never Critically Strike', '45% more Damage'] },
  ironRefl:   { name: 'Iron Hide',          icon: '🛡️', lines: ['All Evasion is converted to Armour', '20% increased Armour'] },
  acrobatics: { name: 'Wind Dancer',        icon: '🤸', lines: ['Maximum chance to Evade is 85%', '30% more Evasion', '50% less Armour'] },
  assassin:   { name: "Death's Mark",       icon: '🎯', lines: ['+120% to Critical Strike Multiplier', 'Non-critical hits deal 40% less Damage'] },
  overload:   { name: 'Elemental Conversion', icon: '⚡', lines: ['100% of Physical converted to Elemental', '30% more Elemental Damage'] },
  bulwark:    { name: 'Divine Bulwark',     icon: '✨', lines: ['+10% to maximum Elemental Resistance', 'Regenerate 1% of Life per second'] },
  vaalPact:   { name: 'Blood Pact',         icon: '🩸', lines: ['Life Leech is tripled', 'You have no Life Regeneration'] },
  glass:      { name: 'Glass Cannon',       icon: '💎', lines: ['50% less maximum Life', '60% more Damage'] },
  lifebloom:  { name: 'Lifebloom',          icon: '🌸', lines: ['Your heals are 60% stronger', 'You deal 30% less Damage'] },
};

// Per-class themes: [left wheel, spine (keystone), right wheel]. Each has two notables.
const BRANCHES = {
  witch: [
    { small: { incEle: 5 }, notable: ['Arcane Potency', { incEle: 18, critChance: 15 }], notable2: ['Elemental Mastery', { incEle: 15, incAll: 6 }] },
    { small: { resist: 3 }, notable: ['Elemental Ward', { resist: 10, incLife: 6 }], notable2: ['Prismatic Skin', { resist: 8, incLife: 5, incEle: 6 }], keystone: 'overload' },
    { small: { regenPct: 0.12 }, notable: ['Soul Siphon', { regenPct: 0.5, incLife: 8 }], notable2: ['Fountain of Life', { regenPct: 0.6, incLife: 4 }] },
  ],
  shadow: [
    { small: { incEle: 3, critChance: 4 }, notable: ['Toxic Edge', { incEle: 15, critMulti: 10 }], notable2: ['Venom Strike', { incEle: 12, critChance: 12 }] },
    { small: { critMulti: 4 }, notable: ['Deadly Precision', { critMulti: 18, critChance: 15 }], notable2: ['Executioner', { critMulti: 25 }], keystone: 'assassin' },
    { small: { critChance: 7 }, notable: ['Assassinate', { critChance: 30, aps: 4 }], notable2: ['Shadow Dance', { critChance: 20, incEvasion: 10 }] },
  ],
  ranger: [
    { small: { critChance: 5, aps: 1 }, notable: ['Eagle Eye', { critChance: 25, critMulti: 10 }], notable2: ['Marksman', { critChance: 20, critMulti: 12 }] },
    { small: { incEvasion: 7 }, notable: ['Fleet Footed', { incEvasion: 25, aps: 4 }], notable2: ['Wind Walker', { incEvasion: 20, aps: 5 }], keystone: 'acrobatics' },
    { small: { aps: 2 }, notable: ['Rapid Assault', { aps: 8, incPhys: 8 }], notable2: ['Quickdraw', { aps: 10 }] },
  ],
  druid: [
    { small: { incHeal: 6 }, notable: ['Verdant Bloom', { incHeal: 20, regenPct: 0.3 }], notable2: ['Wild Growth', { incHeal: 15, incLife: 6 }] },
    { small: { incLife: 3, regenPct: 0.1 }, notable: ['Heart of the Grove', { incLife: 10, regenPct: 0.5 }], notable2: ['Ancient Bark', { incArmour: 20, incLife: 6 }], keystone: 'lifebloom' },
    { small: { incEle: 4 }, notable: ['Nature\'s Wrath', { incEle: 15, aps: 4 }], notable2: ['Thorn Lash', { incEle: 12, critChance: 12 }] },
  ],
  duelist: [
    { small: { incPhys: 4, aps: 1 }, notable: ['Blade Dancer', { incPhys: 12, aps: 6 }], notable2: ['Swordmaster', { incPhys: 15, aps: 4 }] },
    { small: { incArmour: 5, incEvasion: 5 }, notable: ['Duellist\'s Guard', { incArmour: 15, incEvasion: 15, block: 4 }], notable2: ['Steel Dancer', { incArmour: 12, incEvasion: 12, incLife: 4 }], keystone: 'ironRefl' },
    { small: { leech: 0.25 }, notable: ['Bloodthirst', { leech: 1, incPhys: 10 }], notable2: ['Crimson Dance', { leech: 1.2, aps: 3 }] },
  ],
  marauder: [
    { small: { incArmour: 7 }, notable: ['Iron Skin', { incArmour: 25, resist: 6 }], notable2: ['Juggernaut', { incArmour: 20, incLife: 5 }] },
    { small: { incPhys: 5 }, notable: ['Brute Force', { incPhys: 18, incAll: 6 }], notable2: ['Skull Cracker', { incPhys: 20, critMulti: 10 }], keystone: 'resolute' },
    { small: { incLife: 3 }, notable: ['Thick Skin', { incLife: 10, regenPct: 0.3 }], notable2: ['Bloodline', { incLife: 12 }] },
  ],
  templar: [
    { small: { incHeal: 4, resist: 1 }, notable: ['Sanctuary', { incHeal: 15, resist: 6, incLife: 4 }], notable2: ['Holy Ward', { incHeal: 12, resist: 8 }] },
    { small: { incEle: 3, incArmour: 4 }, notable: ['Holy Might', { incEle: 12, incArmour: 15 }], notable2: ['Righteous Fire', { incEle: 15, regenPct: 0.3 }], keystone: 'bulwark' },
    { small: { block: 1 }, notable: ['Bastion', { block: 6, incArmour: 15 }], notable2: ['Shield Wall', { block: 5, incLife: 6 }] },
  ],
};
const INNER_UTIL = [{ goldFind: 6 }, { rarity: 5 }, { xpGain: 4 }];
// Bridge notables between sector i and i+1, linking their wheels mid-tree
const BRIDGE_NOTABLES = [
  ['Arcane Assassin', { incEle: 10, critChance: 15 }],   // mage-assassin
  ['Hunter\'s Gambit', { critChance: 15, aps: 5 }],      // assassin-ranger
  ['Wild Hunt', { aps: 5, incHeal: 8, incEvasion: 10 }], // ranger-druid
  ['Barkskin', { incArmour: 15, incHeal: 8, incLife: 5 }], // druid-gladiator
  ['Gladiator\'s Will', { incPhys: 12, incLife: 6 }],    // gladiator-warrior
  ['Unbreakable', { incArmour: 20, incLife: 8 }],        // warrior-templar
  ['Divine Fury', { incEle: 12, resist: 6 }],            // templar-mage
];
// Skills granted by tree nodes (left spur, right spur) per class sector
export const TREE_SKILLS = {
  witch: ['arcanecomet', 'manastorm'], shadow: ['deathblossom', 'shadowclone'], ranger: ['volley', 'focusaura'],
  druid: ['wildbloom', 'thornwall'], duelist: ['bladestorm', 'parry'], marauder: ['earthshatter', 'bloodrage'],
  templar: ['judgement', 'sanctuary'],
};
export const SOCKET_RADIUS = 150;
// Extra keystones on the outer ring between sectors
const OUTER_KEYSTONES = { 4: 'vaalPact', 0: 'glass' };

const merge = (a, b) => {
  const o = { ...a };
  for (const [k, v] of Object.entries(b)) o[k] = +((o[k] || 0) + v).toFixed(2);
  return o;
};
const quarter = (s) => Object.fromEntries(Object.entries(s).map(([k, v]) => [k, +(v * 0.25).toFixed(3)]));
const halve = (s) => Object.fromEntries(Object.entries(s).map(([k, v]) => [k, +(v * 0.6).toFixed(2)]));

// Layout: each class owns a 60° sector containing
//   a fan of 3 entry nodes, two "wheels" (ring of 6 + notable centre) with
//   several entrances, a spine with a notable, an outer arc that ties it all
//   together, side spurs with notables, and a notable cluster guarding the keystone.
// Sectors are joined by an inner ring, bridge notables between wheels, and an outer ring.
function buildTree() {
  const nodes = {};
  const edges = [];
  const rad = (d) => (d * Math.PI) / 180;
  const A = 360 / CLASSES.length / 60, R = 1.2; // angular / radial spread
  const pos = (ang, r) => ({ x: +(Math.cos(rad(ang)) * r * R).toFixed(1), y: +(Math.sin(rad(ang)) * r * R).toFixed(1) });
  const add = (id, n) => { nodes[id] = { id, ...n, adj: [] }; return id; };
  const link = (a, b) => {
    if (nodes[a].adj.includes(b)) return;
    nodes[a].adj.push(b); nodes[b].adj.push(a); edges.push([a, b]);
  };
  const small = (id, stats, cls, p) => add(id, { kind: 'small', stats, cls, ...p });
  const notable = (id, [name, stats], cls, p) => add(id, { kind: 'notable', name, stats, cls, ...p });
  const nearest = (ids, p) => ids.reduce((best, id) => {
    const d = Math.hypot(nodes[id].x - p.x, nodes[id].y - p.y);
    return d < best.d ? { id, d } : best;
  }, { id: null, d: Infinity }).id;

  const wheels = {}; // `${cls}_${0|2}` -> ring ids
  CLASSES.forEach((c) => {
    const th = c.angle, B = BRANCHES[c.id], id = (k) => `${c.id}_${k}`;
    const start = add(`start_${c.id}`, { kind: 'start', cls: c.id, name: c.name, icon: c.icon, stats: quarter(c.bonus), ...pos(th, 90) });
    // entry fan
    const f = [0, 1, 2].map((i) => small(id(`f${i}`), B[i].small, c.id, pos(th + (i - 1) * 15 * A, 150)));
    f.forEach((n) => link(start, n));
    link(f[0], f[1]); link(f[1], f[2]);
    // wheels
    [0, 2].forEach((bi) => {
      const ctr = pos(th + (bi - 1) * 15 * A, 255);
      const centre = notable(id(`w${bi}c`), B[bi].notable, c.id, ctr);
      const ring = [];
      for (let k = 0; k < 6; k++) {
        const a = rad(k * 60 + th);
        ring.push(small(id(`w${bi}_${k}`), B[bi].small, c.id, { x: +(ctr.x + Math.cos(a) * 42).toFixed(1), y: +(ctr.y + Math.sin(a) * 42).toFixed(1) }));
      }
      ring.forEach((n, k) => link(n, ring[(k + 1) % 6]));
      // centre reachable from the innermost and outermost ring nodes
      link(centre, ring[3]); link(centre, ring[0]);
      link(f[bi], nearest(ring, nodes[f[bi]]));
      wheels[`${c.id}_${bi}`] = ring;
    });
    // spine
    const s1 = small(id('s1'), B[1].small, c.id, pos(th, 212));
    const s2 = notable(id('s2'), B[1].notable, c.id, pos(th, 292));
    link(f[1], s1); link(s1, s2);
    link(s1, nearest(wheels[`${c.id}_0`], nodes[s1])); link(s1, nearest(wheels[`${c.id}_2`], nodes[s1]));
    // outer arc
    const arcTheme = [0, 0, 1, 2, 2];
    const arc = [-22, -11, 0, 11, 22].map((d, i) => small(id(`a${i}`), arcTheme[i] === 1 ? B[1].small : halve(merge(B[arcTheme[i]].small, B[1].small)), c.id, pos(th + d * A, 350)));
    arc.forEach((n, i) => i && link(arc[i - 1], n));
    link(s2, arc[2]);
    link(nearest(wheels[`${c.id}_0`], nodes[arc[1]]), arc[1]);
    link(nearest(wheels[`${c.id}_2`], nodes[arc[3]]), arc[3]);
    // side spur notables, each leading to a tree skill and a stone socket
    const sp0 = notable(id('sp0'), B[0].notable2, c.id, pos(th - 25 * A, 405));
    const sp2 = notable(id('sp2'), B[2].notable2, c.id, pos(th + 25 * A, 405));
    link(arc[0], sp0); link(arc[4], sp2);
    TREE_SKILLS[c.id].forEach((skId, k) => {
      const side = k === 0 ? -1 : 1, from = k === 0 ? sp0 : sp2;
      const sn = add(id(`skill${k}`), { kind: 'skill', skill: skId, stats: {}, cls: c.id, ...pos(th + side * 21 * A, 485) });
      link(from, sn);
      const so = add(id(`socket${k}`), { kind: 'socket', stats: {}, cls: c.id, ...pos(th + side * 12 * A, 455) });
      link(from, so);
    });
    // keystone cluster
    const na = small(id('ka'), B[1].small, c.id, pos(th - 7 * A, 398));
    const nb = small(id('kb'), B[1].small, c.id, pos(th + 7 * A, 398));
    const nt = notable(id('kn'), B[1].notable2, c.id, pos(th, 432));
    link(arc[2], na); link(arc[2], nb); link(na, nt); link(nb, nt);
    const ks = B[1].keystone;
    link(nt, add(`ks_${ks}`, { kind: 'keystone', keystone: ks, name: KEYSTONES[ks].name, icon: KEYSTONES[ks].icon, stats: {}, cls: c.id, ...pos(th, 485) }));
  });

  CLASSES.forEach((c, ci) => {
    const n = CLASSES[(ci + 1) % CLASSES.length];
    const th = c.angle;
    // inner ring between class starts
    const i1 = small(`inner_${ci}_0`, INNER_UTIL[ci % 3], null, pos(th + 20 * A, 112));
    const i2 = small(`inner_${ci}_1`, INNER_UTIL[(ci + 1) % 3], null, pos(th + 40 * A, 112));
    link(`start_${c.id}`, i1); link(i1, i2); link(i2, `start_${n.id}`);
    // bridge notable between this sector's right wheel and the next sector's left wheel
    const bp = pos(th + 30 * A, 312);
    const br = notable(`bridge_${ci}`, BRIDGE_NOTABLES[ci], null, bp);
    link(br, nearest(wheels[`${c.id}_2`], bp));
    link(br, nearest(wheels[`${n.id}_0`], bp));
    // outer ring
    const stats = halve(merge(BRANCHES[c.id][2].small, BRANCHES[n.id][0].small));
    const o = small(`outer_${ci}`, stats, null, pos(th + 30 * A, 362));
    link(`${c.id}_a4`, o); link(o, `${n.id}_a0`);
    const ks = OUTER_KEYSTONES[ci];
    if (ks) {
      const k1 = small(`outer_${ci}_k`, stats, null, pos(th + 30 * A, 425));
      link(o, k1);
      link(k1, add(`ks_${ks}`, { kind: 'keystone', keystone: ks, name: KEYSTONES[ks].name, icon: KEYSTONES[ks].icon, stats: {}, ...pos(th + 30 * A, 480) }));
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

// Tree skills a character has allocated
export const treeSkillIds = (ch) => (ch.tree || []).map((id) => NODES[id]).filter((n) => n && n.kind === 'skill').map((n) => n.skill);
export const socketsInReach = (socketId) => Object.values(NODES).filter((n) => n.kind === 'skill' && Math.hypot(n.x - NODES[socketId].x, n.y - NODES[socketId].y) <= SOCKET_RADIUS).map((n) => n.id);

export function nodeLines(n, own = false) {
  if (n.kind === 'skill') return ['Grants a skill when allocated'];
  if (n.kind === 'socket') return ['Socket a 💎 stone here', 'Boosts tree skills within its radius'];
  if (n.kind === 'keystone') return KEYSTONES[n.keystone].lines;
  if (n.kind === 'start' && own) return [CLASS_BY_ID[n.cls].desc, ...Object.entries(CLASS_BY_ID[n.cls].bonus).map(([k, v]) => STAT_TEXT[k](v))];
  return Object.entries(n.stats).map(([k, v]) => STAT_TEXT[k](v));
}

export const refundCost = (level) => Math.ceil(8 * Math.pow(1.04, level) * (1 + level * 0.1));
export const resetCost = (level) => refundCost(level) * 15;
