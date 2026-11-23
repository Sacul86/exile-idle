import {
  S, RARITIES, RARITY_TIER_FLOOR, ITEM_TYPES, BASE_ILVLS, WEAPON_KINDS, BASE_NAMES,
  SLOT_DEF_MULT, TIER_ILVL, TIER_MULT, AFFIXES, AFFIX_BY_ID, MYTHICS, MYTHIC_BY_ID,
} from './data.js';
import { CLASS_WEAPONS, SETS, SET_SLOTS, setPieceName } from './classdata.js';

let uidCounter = Date.now() % 1e9;
export const uid = () => (++uidCounter).toString(36);

const rand = (a, b) => a + Math.random() * (b - a);
const randInt = (a, b) => Math.floor(rand(a, b + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

function weightedPick(entries) {
  const total = entries.reduce((s, e) => s + e.w, 0);
  let r = Math.random() * total;
  for (const e of entries) { if ((r -= e.w) <= 0) return e.v; }
  return entries[entries.length - 1].v;
}

export function rollRarity(stage, rarityPct = 0, bonus = 0) {
  const mult = 1 + (rarityPct + bonus) / 100;
  const entries = RARITIES.filter((r) => stage >= r.minStage).map((r) => ({
    v: r.id,
    // Higher rarities benefit more from item rarity, like PoE.
    w: r.id === 0 ? r.weight : r.weight * Math.pow(mult, 0.6 + r.id * 0.25),
  }));
  return weightedPick(entries);
}

function baseIndexFor(ilvl) {
  let idx = 0;
  BASE_ILVLS.forEach((lv, i) => { if (ilvl >= lv) idx = i; });
  // Sometimes drop the previous base for variety
  if (idx > 0 && Math.random() < 0.3) idx -= 1;
  return idx;
}

function maxTierFor(ilvl) {
  let t = 0;
  TIER_ILVL.forEach((lv, i) => { if (ilvl >= lv) t = i; });
  return t;
}

function rollTier(ilvl, rarity) {
  const maxT = maxTierFor(ilvl);
  const floor = Math.min(maxT, RARITY_TIER_FLOOR[rarity]);
  // Weighted toward lower tiers; best tiers are rare
  const entries = [];
  for (let t = floor; t <= maxT; t++) entries.push({ v: t, w: Math.pow(0.62, maxT - t) * (t === maxT ? 0.6 : 1) + 0.0001 });
  if (rarity >= 5) return maxT;
  return weightedPick(entries);
}

export function rollAffix(def, ilvl, type, rarity, forcedTier) {
  const tier = forcedTier ?? rollTier(ilvl, rarity);
  const m = TIER_MULT[tier] * (def.slots.includes('weapon') && type === 'weapon' && def.weaponMult ? def.weaponMult : 1);
  const q = rand(0.85, 1.0);
  const a = { id: def.id, tier };
  if (def.kind === 'range') {
    const s = S(ilvl) * m;
    a.min = Math.max(1, def.base[0] * s * q);
    a.max = Math.max(a.min + 1, def.base[1] * s * q);
  } else if (def.kind === 'flat') {
    a.v = def.base * S(ilvl) * m * q;
  } else {
    a.v = def.base * m * q;
  }
  return a;
}

function rollAffixes(type, ilvl, rarity, count) {
  const pool = AFFIXES.filter((a) => a.slots.includes(type));
  const chosen = [];
  let prefixes = 0, suffixes = 0;
  const avail = [...pool];
  while (chosen.length < count && avail.length) {
    const i = Math.floor(Math.random() * avail.length);
    const def = avail.splice(i, 1)[0];
    if (def.type === 'prefix' && prefixes >= 3) continue;
    if (def.type === 'suffix' && suffixes >= 3) continue;
    def.type === 'prefix' ? prefixes++ : suffixes++;
    chosen.push(rollAffix(def, ilvl, type, rarity));
  }
  // Legendary: guarantee one affix at the best tier available
  if (rarity === 4 && chosen.length) {
    const best = maxTierFor(ilvl);
    const i = Math.floor(Math.random() * chosen.length);
    chosen[i] = rollAffix(AFFIX_BY_ID[chosen[i].id], ilvl, type, rarity, best);
  }
  return chosen;
}

function rollImplicit(type, ilvl, baseIdx, kindName) {
  const bm = 1 + 0.1 * baseIdx;
  const s = S(ilvl) * bm;
  const q = rand(0.9, 1.0);
  switch (type) {
    case 'weapon': {
      const k = WEAPON_KINDS[kindName];
      return { physMin: 2.5 * s * k.dmg * q, physMax: 5 * s * k.dmg * q, aps: k.aps, crit: k.crit, ...(k.imp || {}) };
    }
    case 'offhand':
      return { armour: 16 * s * SLOT_DEF_MULT.offhand * q, block: 15 + baseIdx * 1.5 };
    case 'helm': case 'chest': case 'gloves': case 'boots':
      return null; // filled by caller depending on defence type
    case 'belt':
      return { life: 10 * s * q };
    case 'amulet':
      return { incAll: 6 + baseIdx * 1.5 };
    case 'ring':
      return { resist: 5 + baseIdx };
    default:
      return {};
  }
}

export function generateItem(ilvl, opts = {}) {
  if (opts.set) return generateSetItem(ilvl, opts.set, opts.type);
  if (opts.mythic && MYTHIC_BY_ID[opts.mythic]) {
    const m = MYTHIC_BY_ID[opts.mythic];
    const it = generateItem(ilvl, { ...opts, mythic: null, type: m.type, rarity: 5 });
    it.mythic = m.id; it.name = m.name;
    return it;
  }
  const type = opts.type || pick(ITEM_TYPES);
  const rarity = opts.rarity ?? rollRarity(ilvl, opts.rarityPct || 0, opts.rarityBonus || 0);
  const baseIdx = baseIndexFor(ilvl);
  let name, implicit, kind, defType;
  if (type === 'weapon') {
    const clsKinds = CLASS_WEAPONS[opts.cls];
    kind = clsKinds && Math.random() < 0.5 ? pick(clsKinds) : pick(Object.keys(WEAPON_KINDS));
    name = WEAPON_KINDS[kind].names[baseIdx];
    implicit = rollImplicit(type, ilvl, baseIdx, kind);
  } else if (['helm', 'chest', 'gloves', 'boots'].includes(type)) {
    defType = Math.random() < 0.5 ? 'armour' : 'evasion';
    name = BASE_NAMES[type][defType][baseIdx];
    const v = 16 * S(ilvl) * (1 + 0.1 * baseIdx) * SLOT_DEF_MULT[type] * rand(0.9, 1);
    implicit = { [defType]: v };
  } else {
    name = BASE_NAMES[type][baseIdx];
    implicit = rollImplicit(type, ilvl, baseIdx);
  }
  const [lo, hi] = RARITIES[rarity].affixes;
  const affixes = rollAffixes(type, ilvl, rarity, randInt(lo, hi));
  const item = {
    uid: uid(), type, name, kind, defType, rarity, ilvl, baseIdx, implicit, affixes,
    upgrade: 0, locked: false, isNew: true,
  };
  if (rarity === 5 && !opts.noMythic) {
    const pool = MYTHICS.filter((m) => m.type === type);
    if (pool.length) { const m = pick(pool); item.mythic = m.id; item.baseName = name; item.name = m.name; }
  }
  return item;
}

// Set items: Epic-grade with 4 mods, a fixed name and membership of a class set
export function generateSetItem(ilvl, setId, type) {
  type = type && SET_SLOTS.includes(type) ? type : pick(SET_SLOTS);
  const it = generateItem(ilvl, { type, rarity: 3 });
  it.affixes = rollAffixes(type, ilvl, 3, 4);
  it.baseName = it.name;
  it.name = setPieceName(setId, type);
  it.set = setId;
  return it;
}

// Multiplier from +N upgrade level
export const upgradeMult = (item) => 1 + 0.07 * (item.upgrade || 0);

// Flatten an item into a stat contribution map
export function itemStats(item) {
  const m = upgradeMult(item);
  const out = {};
  const add = (k, v) => { out[k] = (out[k] || 0) + v; };
  const imp = item.implicit || {};
  for (const [k, v] of Object.entries(imp)) {
    if (item.type === 'weapon' && (k === 'aps' || k === 'crit')) add('w_' + k, v); // weapon base values, not scaled
    else if (k === 'block' || k === 'lifeOnHitPct') add(k, v);
    else if (k === 'physMin' || k === 'physMax') add('w_' + k, v * m);
    else add(k, v * m);
  }
  if (item.mythic && MYTHIC_BY_ID[item.mythic]) {
    for (const [k, v] of Object.entries(MYTHIC_BY_ID[item.mythic].power)) add(k, v);
  }
  for (const a of item.affixes) {
    if (a.min != null) {
      add(a.id + 'Min', a.min * m);
      add(a.id + 'Max', a.max * m);
    } else {
      const def = AFFIX_BY_ID[a.id];
      // percent stats get a gentler upgrade boost so they don't run away
      const mult = def.kind === 'pct' ? 1 + (m - 1) * 0.5 : m;
      add(a.id, a.v * mult);
    }
  }
  return out;
}

export const fmt = (n) => {
  if (n == null || isNaN(n)) return '0';
  const abs = Math.abs(n);
  if (abs < 10) return (Math.round(n * 10) / 10).toString();
  if (abs < 1e4) return Math.round(n).toString();
  const units = ['K', 'M', 'B', 'T', 'Qa', 'Qi'];
  let u = -1, v = n;
  while (Math.abs(v) >= 1000 && u < units.length - 1) { v /= 1000; u++; }
  return (Math.abs(v) < 100 ? v.toFixed(1) : Math.round(v)) + units[u];
};

const tierLabel = (t) => 'T' + (7 - t);

export function describeAffix(a, item) {
  const def = AFFIX_BY_ID[a.id];
  const m = upgradeMult(item);
  const pm = def.kind === 'pct' ? 1 + (m - 1) * 0.5 : m;
  let text = def.text;
  if (a.min != null) text = text.replace('{a}', fmt(a.min * m)).replace('{b}', fmt(a.max * m));
  else {
    const v = a.v * pm;
    text = text.replace('{v}', def.decimals ? v.toFixed(def.decimals) : fmt(v));
  }
  return { text, tier: tierLabel(a.tier), tierIdx: a.tier, type: def.type };
}

export function describeImplicit(item) {
  const m = upgradeMult(item);
  const imp = item.implicit || {};
  const lines = [];
  if (imp.physMin != null) {
    lines.push(`Physical Damage: ${fmt(imp.physMin * m)}–${fmt(imp.physMax * m)}`);
    lines.push(`Attacks per Second: ${imp.aps.toFixed(2)}`);
    lines.push(`Critical Strike Chance: ${imp.crit.toFixed(1)}%`);
  }
  if (imp.armour != null) lines.push(`Armour: ${fmt(imp.armour * m)}`);
  if (imp.evasion != null) lines.push(`Evasion: ${fmt(imp.evasion * m)}`);
  if (imp.block != null && item.type === 'offhand') lines.push(`Chance to Block: ${imp.block.toFixed(1)}%`);
  if (imp.life != null) lines.push(`+${fmt(imp.life * m)} to maximum Life`);
  if (item.type === 'weapon') {
    if (imp.incEle != null) lines.push(`+${fmt(imp.incEle * m)}% increased Elemental Damage`);
    if (imp.critMulti != null) lines.push(`+${fmt(imp.critMulti * m)}% to Crit Multiplier`);
    if (imp.lifeOnHitPct != null) lines.push(`Gain ${imp.lifeOnHitPct}% of Life per Hit`);
    if (imp.incArmour != null) lines.push(`+${fmt(imp.incArmour * m)}% increased Armour`);
    if (imp.block != null && !imp.armour) lines.push(`+${imp.block}% Chance to Block`);
  }
  if (imp.incAll != null) lines.push(`+${fmt(imp.incAll * m)}% increased Damage`);
  if (imp.resist != null) lines.push(`+${fmt(imp.resist * m)}% to Elemental Resistance`);
  return lines;
}

// ---- Crafting / economy ----
export function salvageValue(item) {
  const r = RARITIES[item.rarity];
  return {
    shards: Math.ceil(r.shards * (1 + item.ilvl / 20) * (1 + (item.upgrade || 0) * 0.3)),
    gold: Math.ceil(2 * S(item.ilvl) * (1 + item.rarity)),
  };
}

export function upgradeCost(item) {
  const n = item.upgrade || 0;
  return {
    gold: Math.ceil(25 * S(item.ilvl) * Math.pow(n + 1, 1.6)),
    shards: Math.ceil((n + 1) * 3 * (1 + item.rarity * 0.5) * (1 + item.ilvl / 40)),
  };
}
export const canUpgrade = (item) => (item.upgrade || 0) < RARITIES[item.rarity].maxUpgrade;

export function rerollCost(item) {
  return { gold: Math.ceil(15 * S(item.ilvl)), shards: Math.ceil(12 * (item.rarity + 1) * (1 + item.ilvl / 30)) };
}
export function rerollItem(item) {
  const [lo, hi] = RARITIES[item.rarity].affixes;
  item.affixes = rollAffixes(item.type, item.ilvl, item.rarity, randInt(lo, hi));
}

export const canPromote = (item) => item.rarity < 4;
export function promoteCost(item) {
  return { gold: Math.ceil(120 * S(item.ilvl) * (item.rarity + 1)), shards: Math.ceil(40 * Math.pow(item.rarity + 1, 2) * (1 + item.ilvl / 40)) };
}
export function promoteItem(item) {
  item.rarity += 1;
  const [lo] = RARITIES[item.rarity].affixes;
  const prefixes = item.affixes.filter((a) => AFFIX_BY_ID[a.id].type === 'prefix').length;
  const suffixes = item.affixes.length - prefixes;
  const have = new Set(item.affixes.map((a) => a.id));
  const pool = AFFIXES.filter((a) => a.slots.includes(item.type) && !have.has(a.id) &&
    ((a.type === 'prefix' && prefixes < 3) || (a.type === 'suffix' && suffixes < 3)));
  let p = prefixes, s = suffixes;
  while (item.affixes.length < lo && pool.length) {
    const def = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
    if (def.type === 'prefix' && p >= 3) continue;
    if (def.type === 'suffix' && s >= 3) continue;
    def.type === 'prefix' ? p++ : s++;
    item.affixes.push(rollAffix(def, item.ilvl, item.type, item.rarity));
  }
}
