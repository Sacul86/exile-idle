// Hero stat computation (pure). Everything that modifies the hero funnels through here.
import { S, CLASSES, ATTR_KEYS, ATTR_PER_LEVEL, SLOTS, TALENT_STATS, TALENT_VAL, specOf, COMPANIONS, evoOf, RUNES, INSCR_TAGS, ASC_PERKS, unlocked, LEVEL_CAP } from './data.js';
import { itemStats } from './items.js';
import { SKILLS } from './skills.js';

export const ELEMS = ['fire', 'cold', 'lightning', 'arcane', 'shadow', 'holy', 'poison'];
export const armourK = (mlvl) => 25 * Math.pow(S(mlvl), 1.6);
export const armourReduction = (armour, mlvl) => Math.min(0.8, armour / (armour + armourK(mlvl)));
export const xpToNext = (lvl) => Math.round(60 * Math.pow(lvl, 1.45) * Math.pow(1.045, lvl));
export const masteryXp = (m) => xpToNext(LEVEL_CAP) * (1 + m * 0.05);

export function talentPointsTotal(state) {
  const fromLevel = Math.max(0, state.level - 24);
  return fromLevel + Math.floor((state.mastery || 0) / 5) + (state.ascPerks?.mastery || 0);
}
export const talentPointsSpent = (state) => Object.values(state.talents || {}).reduce((s, arr) => s + arr.reduce((a, b) => a + b, 0), 0);
export const talentMax = (state, tree) => (specOf(state)?.tree === tree ? 5 : 3);
export const talentRowOpen = (state, tree, idx) => (state.talents[tree] || []).reduce((a, b) => a + b, 0) >= Math.floor(idx / 2) * 3;

export const attrPointsTotal = (state) => (state.level - 1) * ATTR_PER_LEVEL;
export const attrPointsSpent = (state) => ATTR_KEYS.reduce((s, k) => s + (state.attrs[k] || 0), 0);

export function companionBonus(state, extra = 0) {
  const out = {};
  const c = state.companions;
  if (!c) return out;
  const spec = specOf(state);
  const full = spec?.id === 'beastmaster' && state.level >= 40;
  const ids = [c.active, ...(c.passive || [])].filter(Boolean);
  ids.forEach((id, i) => {
    const d = COMPANIONS[id], lvl = c.levels[id] || 1;
    const k = (d.base + d.per * (lvl - 1)) * evoOf(lvl).mult * (i === 0 || full ? 1 : 0.5) * (1 + extra / 100);
    out[d.stat] = (out[d.stat] || 0) + k;
    if (d.stat2) out[d.stat2] = (out[d.stat2] || 0) + k * (d.stat2 === 'critDmg' ? 4 : 1);
  });
  return out;
}

export function inscriptionSets(state) {
  const counts = {};
  for (const ins of state.inscribed || []) if (ins) counts[ins.tag] = (counts[ins.tag] || 0) + 1;
  return counts;
}

// gearMap: slot -> item (defaults to state.gear)
export function computeStats(state, gearMap = state.gear, run = state.run) {
  const cls = CLASSES[state.cls];
  const add = {};
  const flags = new Set();
  const A = (k, v) => { if (v) add[k] = (add[k] || 0) + v; };
  // gear
  let uniques = [];
  for (const slot of SLOTS) {
    const it = gearMap[slot];
    if (!it) continue;
    for (const [k, v] of Object.entries(itemStats(it))) A(k, v);
    if (it.unique) uniques.push(it.unique);
  }
  uniques.forEach((u) => flags.add(u));
  // spec
  const spec = specOf(state);
  if (spec) {
    for (const [k, v] of Object.entries(spec.t1)) A(k, v);
    if (state.level >= 40 || state.ascensions) for (const [k, v] of Object.entries(spec.t2)) A(k, v);
  }
  // talents
  const treeDmg = {};
  for (const t of cls.trees) {
    const ranks = state.talents[t.id] || [];
    TALENT_STATS[t.id].forEach((st, i) => {
      const r = ranks[i] || 0;
      if (!r) return;
      if (st === 'treeDmg') treeDmg[t.id] = (treeDmg[t.id] || 0) + r * TALENT_VAL.treeDmg;
      else A(st, r * TALENT_VAL[st]);
    });
  }
  if (spec) treeDmg[spec.tree] = (treeDmg[spec.tree] || 0) + 20;
  // companions
  for (const [k, v] of Object.entries(companionBonus(state, add.petBonus || 0))) A(k, v);
  // runes
  let furyAspd = 0;
  for (const r of state.runesEquipped || []) {
    if (!r) continue;
    const rank = state.runes[r] || 0;
    if (!rank) continue;
    const d = RUNES[r];
    for (const [k, v] of Object.entries(d.stat(rank))) A(k, v);
    if (d.flag) flags.add(d.flag);
    if (d.fury) furyAspd += d.fury(rank);
  }
  // inscriptions
  for (const ins of state.inscribed || []) if (ins) A(ins.stat, ins.v);
  for (const [tag, n] of Object.entries(inscriptionSets(state))) {
    for (const [need, m] of Object.entries(INSCR_TAGS[tag].sets)) if (n >= +need) for (const [k, v] of Object.entries(m)) { if (v === 1 && !['leech'].includes(k)) flags.add(k); else A(k, v); }
  }
  // ascension perks + mastery
  for (const [p, r] of Object.entries(state.ascPerks || {})) if (ASC_PERKS[p].stat) for (const [k, v] of Object.entries(ASC_PERKS[p].stat)) A(k, v * r);
  const mastery = state.mastery || 0;
  A('more', mastery * 0.5); A('hpPct', mastery * 0.5);
  // run modifiers (rifts)
  const rm = run?.mods || {};
  A('crit', rm.heroCrit); A('cdr', rm.heroCdr); A('leech', rm.heroLeech);
  for (const f of ['burnExplode', 'freezeChance', 'critChain', 'smite']) if (add[f]) { flags.add(f); }

  // attributes
  const at = {};
  for (const k of ATTR_KEYS) at[k] = 10 + cls.grow[k] * (state.level - 1) + (state.attrs[k] || 0) + (add[k] || 0) + (add.allAttr || 0);

  const lv = state.level;
  const hpBase = 100 + 20 * S(lv) + (add.hp || 0);
  const hp = hpBase * (1 + ((add.hpPct || 0) + at.vit * 0.6) / 100);
  const armour = (5 * S(lv) + (add.armour || 0)) * (1 + ((add.armourPct || 0) + at.vit * 0.3) / 100);
  const attack = (2 + 1.5 * S(lv) + (add.attack || 0)) * (1 + (add.attackPct || 0) / 100);
  const typePct = cls.dmg === 'phys' ? (add.phys || 0) + at.str * 0.6 : (add.magic || 0) + at.int * 0.6;
  const elem = {};
  for (const e of ELEMS) elem[e] = (add[e] || 0) + (e !== 'poison' ? add.ele || 0 : 0);
  elem.phys = 0; elem.nature = add.ele || 0;
  const aspd = 1.0 * (1 + ((add.aspd || 0) + at.dex * 0.15) / 100);
  const crit = Math.min(75, 5 + (add.crit || 0) + at.dex * 0.04);
  const critDmg = 50 + (add.critDmg || 0);
  const cdr = Math.min(50, (add.cdr || 0) + at.wis * 0.12);
  const resist = Math.min(75, (add.resist || 0) * (rm.halfRes ? 0.5 : 1));
  const st = {
    lv, attrs: at, hp, armour, attack, typePct, elem, aspd, crit, critDmg, cdr, resist,
    leech: add.leech || 0, boss: add.boss || 0, elite: add.elite || 0, dr: Math.min(60, add.dr || 0),
    regen: 8 * (1 + ((add.regen || 0) + at.wis * 0.5) / 100), hpRegen: (add.hpRegen || 0),
    gold: add.gold || 0, mf: add.mf || 0, xp: add.xp || 0, more: 1 + (add.more || 0) / 100,
    burnDmg: add.burnDmg || 0, poisonDmg: add.poisonDmg || 0, bleedDmg: add.bleedDmg || 0, chillDur: add.chillDur || 0,
    frozenTaken: add.frozenTaken || 0, buffDur: add.buffDur || 0, frenzy: add.frenzy || 0, thorns: add.thorns || 0,
    petDmg: add.petDmg || 0, poisonCrit: add.poisonCrit || 0, minionDmg: add.minionDmg || 0, minionMax: Math.floor(add.minionMax || 0),
    execute: add.execute || 0, killHeal: add.killHeal || 0, healPct: add.healPct || 0, vulnPct: 15 + (add.vulnPct || 0),
    shieldPct: add.shieldPct || 0, freezeChance: add.freezeChance || 0, doubleCast: add.doubleCast || 0, furyAspd, healEvery: add.healEvery || 0, treeDmg, flags,
  };
  st.power = powerOf(state, st);
  return st;
}

// a single comparable number: geometric blend of damage and toughness
export function powerOf(state, st) {
  const skillElems = Object.values(state.skills || {}).filter(Boolean).map((id) => SKILLS[id]?.elem).filter(Boolean);
  const avgElem = skillElems.length ? skillElems.reduce((s, e) => s + (st.elem[e] || 0), 0) / skillElems.length : 0;
  const treeAvg = Object.values(st.treeDmg).reduce((a, b) => a + b, 0) / 3;
  const dps = st.attack * (1 + (st.typePct + avgElem + treeAvg) / 100) * st.more * st.aspd * (1 + (st.crit / 100) * (st.critDmg / 100)) * (1 + st.boss / 300) * (1 + st.cdr / 150);
  const red = armourReduction(st.armour, st.lv);
  const ehp = st.hp / (1 - red * 0.6) / (1 - (st.resist / 100) * 0.4) / (1 - st.dr / 100) * (1 + st.leech / 20);
  return Math.round(Math.pow(dps, 0.55) * Math.pow(ehp, 0.45));
}
export const unlockedSlots = (state) => ['primary', 'defensive', 'aoe', 'secondary', 'utility', 'ultimate'].filter((r, i) => state.ascensions || state.level >= [1, 5, 20, 30, 40, 50][i]);
export { unlocked };
export function talentCapacity(state) {
  const cls = CLASSES[state.cls];
  return cls.trees.reduce((s, t) => s + 6 * talentMax(state, t.id) - (state.talents[t.id] || []).reduce((a, b) => a + b, 0), 0);
}
export const talentFree = (state) => Math.max(0, Math.min(talentPointsTotal(state) - talentPointsSpent(state), talentCapacity(state)));
