// Item generation, stats and upgrade costs (pure).
import { S, SLOTS, SLOT_INFO, RARITIES, RARITY_WEIGHTS, AFFIXES, AFFIX, attrScale, UNIQUES, UNIQUE_KEYS, CLASSES, STAT_NAMES, PCT_STATS, GEMS, gemValue, INSCR_TAGS, INSCR_KEYS } from './data.js';

let uid = Date.now() % 1e7;
export const newId = () => (++uid).toString(36);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const wpick = (list, wf) => { const tot = list.reduce((s, x) => s + wf(x), 0); let r = Math.random() * tot; for (const x of list) { r -= wf(x); if (r <= 0) return x; } return list[list.length - 1]; };

const BASE_NAMES = {
  off: null, helmet: ['Helm', 'Greathelm', 'Hood', 'Crown', 'Visage'], chest: ['Hauberk', 'Breastplate', 'Robe', 'Brigandine', 'Cuirass'],
  gloves: ['Gauntlets', 'Grips', 'Handwraps', 'Bracers'], legs: ['Greaves', 'Legplates', 'Leggings', 'Tassets'], boots: ['Sabatons', 'Treads', 'Boots', 'Striders'],
  belt: ['Girdle', 'Sash', 'Warbelt', 'Cord'], ring1: ['Band', 'Signet', 'Loop', 'Ring'], necklace: ['Choker', 'Chain', 'Torc', 'Pendant'], amulet: ['Talisman', 'Charm', 'Idol', 'Sigil'],
};
const PREFIX = ['Worn', 'Sturdy', 'Fine', 'Grand', 'Exalted', 'Mythic', 'Ancient'];
const OFF_KIND = { warrior: 'shield', paladin: 'shield', mage: 'focus', warlock: 'focus', ranger: 'quiver' };

// implicit stats per slot (before rarity/enhance multipliers)
export function implicit(slot, ilvl, cls) {
  const s = S(ilvl);
  switch (slot) {
    case 'main': return { attack: 5 * s };
    case 'off': return OFF_KIND[cls] === 'shield' ? { armour: 6 * s, hp: 5 * s } : OFF_KIND[cls] === 'quiver' ? { attack: 1.2 * s, crit: 3 } : { attack: 1 * s, hp: 4 * s };
    case 'helmet': return { hp: 8 * s, armour: 4 * s };
    case 'chest': return { hp: 14 * s, armour: 7 * s };
    case 'gloves': return { hp: 4 * s, armour: 3 * s, attack: 0.4 * s };
    case 'legs': return { hp: 10 * s, armour: 5 * s };
    case 'boots': return { hp: 6 * s, armour: 3 * s };
    case 'belt': return { hp: 9 * s };
    case 'ring1': return { attack: 0.7 * s };
    case 'necklace': return { critDmg: 10, hp: 3 * s };
    case 'amulet': return { allAttr: 3 * attrScale(ilvl) };
  }
  return {};
}
const pctScale = (ilvl) => 0.6 + ilvl / 100;
export function affixValue(key, ilvl, q) {
  const a = AFFIX[key];
  const base = a.r[0] + (a.r[1] - a.r[0]) * q;
  if (a.flat) return base * S(ilvl);
  if (a.attr) return base * attrScale(ilvl);
  return base * pctScale(ilvl);
}

export function rollRarity(mf = 0, ilvl = 1, opts = {}) {
  const w = RARITY_WEIGHTS.map((x, i) => (i === 0 ? x : x * (1 + (mf / 100) * (0.5 + i * 0.3))));
  if (ilvl < 60 && !opts.forceLeg) { w[4] = 0; w[5] = 0; w[6] = 0; }
  if (ilvl < 70) w[5] = 0;
  if (!opts.ancient) w[6] = 0;
  if (opts.minRarity) for (let i = 0; i < opts.minRarity; i++) w[i] = 0;
  return wpick([0, 1, 2, 3, 4, 5, 6], (i) => w[i]);
}

export function generateItem(ilvl, opts = {}) {
  const slot = opts.slot || pick(SLOTS.filter((s) => s !== 'ring2'));
  const type = slot === 'ring2' ? 'ring1' : slot;
  const cls = opts.cls || 'warrior';
  const rarity = opts.rarity ?? rollRarity(opts.mf || 0, ilvl, opts);
  const R = RARITIES[rarity];
  const pool = AFFIXES.filter((a) => !(type === 'main' && a.key === 'armour'));
  const affixes = [];
  const used = new Set();
  for (let i = 0; i < R.affixes; i++) {
    const a = wpick(pool.filter((x) => !used.has(x.key)), (x) => x.w);
    used.add(a.key);
    affixes.push({ key: a.key, q: 0.35 + Math.random() * 0.65 });
  }
  let unique = null;
  if (R.unique) unique = opts.unique || pick(UNIQUE_KEYS);
  let name;
  if (type === 'main') name = pick(CLASSES[cls].weapon);
  else if (type === 'off') name = CLASSES[cls].off;
  else name = pick(BASE_NAMES[type]);
  name = opts.name || (unique ? `${name} ${UNIQUES[unique].name}` : `${PREFIX[rarity]} ${name}`);
  return {
    id: newId(), slot: type, ilvl, rarity, name, cls, affixes, unique, bonus: opts.bonus || null,
    enhance: 0, refine: 0, enchant: null, sockets: Array(R.sockets).fill(null), awakened: false, locked: false, isNew: true,
  };
}

// full stat map for an item
export function itemStats(it) {
  const R = RARITIES[it.rarity];
  const mult = R.mult * (1 + 0.06 * it.enhance) * (it.awakened ? 1.25 : 1);
  const out = {};
  const add = (k, v) => { out[k] = (out[k] || 0) + v; };
  for (const [k, v] of Object.entries(implicit(it.slot, it.ilvl, it.cls))) add(k, v * mult);
  for (const a of it.affixes) add(a.key, affixValue(a.key, it.ilvl, Math.min(1, a.q + it.refine * 0.06)) * mult);
  if (it.enchant) add(it.enchant.key, affixValue(it.enchant.key, it.ilvl, 0.6) * (1 + 0.25 * (it.enchant.rank - 1)) * mult);
  if (it.bonus) for (const [k, v] of Object.entries(it.bonus)) add(k, v);
  if (it.unique && UNIQUES[it.unique].stat) for (const [k, v] of Object.entries(UNIQUES[it.unique].stat)) add(k, v);
  for (const g of it.sockets) if (g) { const t = g.slice(0, -1), tier = +g.slice(-1); add(GEMS[t].stat, gemValue(t, tier)); if (GEMS[t].stat2) add(GEMS[t].stat2, gemValue(t, tier)); }
  return out;
}

export function fmt(n) {
  if (n === undefined || n === null || isNaN(n)) return '0';
  if (Math.abs(n) < 1000) return (Math.abs(n) < 10 && n % 1 ? n.toFixed(1) : Math.round(n)).toString();
  const u = ['K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx'];
  let i = -1; while (Math.abs(n) >= 1000 && i < u.length - 1) { n /= 1000; i++; }
  return (Math.abs(n) < 100 ? n.toFixed(1) : Math.round(n)) + u[i];
}
export function statLine(k, v) {
  const name = STAT_NAMES[k] || k;
  if (PCT_STATS.has(k)) return `+${v < 10 ? v.toFixed(1) : Math.round(v)}% ${name}`;
  return `+${fmt(v)} ${name}`;
}

// ---- upgrade costs (nothing here destroys items) ----
const matFor = (ilvl) => (ilvl >= 50 ? 'mythril' : 'iron');
export const ENHANCE_MAX = 15;
export function enhanceCost(it) {
  const n = it.enhance + 1;
  return { gold: Math.round(25 * S(it.ilvl) * Math.pow(n, 1.6) * (1 + it.rarity * 0.3)), [matFor(it.ilvl)]: Math.ceil(n * 1.5) };
}
export const REFINE_MAX = 5;
export const refineCost = (it) => ({ dust: 6 * (it.refine + 1) * (1 + it.rarity), gold: Math.round(10 * S(it.ilvl) * (it.refine + 1)) });
export const ENCHANT_MAX = 5;
export const enchantCost = (it) => ({ dust: 10 * ((it.enchant ? it.enchant.rank : 0) + 1) * (1 + it.rarity * 0.5) | 0, gold: Math.round(15 * S(it.ilvl)) });
export const awakenItemCost = (it) => ({ essence: 8 + it.rarity * 3, cores: 4 + it.rarity });
export const canAwaken = (it) => it.rarity >= 4 && it.enhance >= ENHANCE_MAX && !it.awakened;
export function salvageValue(it) {
  const out = { dust: 1 + it.rarity * 2 + Math.floor(it.enhance / 3), gold: Math.round(2 * S(it.ilvl) * (1 + it.rarity)) };
  if (it.rarity <= 2) out[matFor(it.ilvl)] = 1 + Math.floor(it.rarity / 2);
  if (it.rarity >= 3) out.mythril = it.rarity - 1;
  if (it.rarity >= 4) out.cores = [0, 0, 0, 0, 1, 2, 4][it.rarity];
  if (it.rarity >= 5) out.essence = it.rarity - 3;
  return out;
}

export function makeInscription(ilvl, tag) {
  tag = tag || pick(INSCR_KEYS);
  const tier = Math.min(5, Math.floor(ilvl / 20));
  const st = INSCR_TAGS[tag].stat;
  const v = (st === 'leech' ? 0.6 : 5) * (1 + ilvl / 50) * (0.8 + Math.random() * 0.4);
  return { id: newId(), tag, tier, stat: st, v };
}
