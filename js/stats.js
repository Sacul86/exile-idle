import { S, SLOTS, resistPenalty, physShare, isBossStage } from './data.js';
import { treeBonuses, ROLES, CLASS_BY_ID } from './tree.js';
import { classBonuses, isClassWeapon, WEAPON_MASTERY } from './classdata.js';
import { itemStats } from './items.js';

export const RESIST_CAP = 75;
// Monsters outscale gear slightly, so tiers/crafting/passives matter.
export let MONSTER_EXP = +(globalThis.process?.env?.MEXP || 1.5);
const PARTY_HP = +(globalThis.process?.env?.PHP || 2.8);
const PARTY_DMG = +(globalThis.process?.env?.PDMG || 2.3);

// Monster template for a stage (used for both combat and gear scoring)
export function monsterFor(stage, elite = false, kind = null) {
  const boss = kind ? kind !== 'normal' : isBossStage(stage);
  const s = Math.pow(S(stage), MONSTER_EXP);
  // Party tuning: three heroes deal more damage, the tank and healer soak more
  let hp = 60 * s * PARTY_HP, dmg = 4.5 * s * PARTY_DMG, interval = 1.3;
  // Ease the first few stages so the opening feels snappy
  const ease = Math.min(1, 0.4 + stage * 0.06);
  hp *= ease; dmg *= ease;
  if (boss) { hp *= 9; dmg *= 1.7; interval = 1.5; }
  else if (elite) { hp *= 2.5; dmg *= 1.3; }
  return { hp, maxHp: hp, dmg, interval, boss, elite, acc: 40 * S(stage), physShare: physShare(stage) };
}

export const combatLevel = (state) => (state.run ? state.run.level : state.stage);

export function computeStats(state, gear = state.gear) {
  const t = {};
  const add = (k, v) => { t[k] = (t[k] || 0) + v; };
  for (const slot of SLOTS) {
    const it = gear[slot.id];
    if (!it) continue;
    for (const [k, v] of Object.entries(itemStats(it))) add(k, v);
  }
  const tb = treeBonuses(state);
  for (const [k, v] of Object.entries(tb.stats)) add(k, v);
  for (const [k, v] of Object.entries(classBonuses(state, gear))) add(k, v);
  const role = (CLASS_BY_ID[state.cls] || {}).role || 'dps';
  for (const [k, v] of Object.entries(ROLES[role].bonus)) add(k, v);
  if (state.petBonus) for (const [k, v] of Object.entries(state.petBonus)) add(k, v);
  const ks = tb.keystones;
  const g = (k) => t[k] || 0;
  const hasWeapon = !!gear.weapon;
  const incDmg = g('incAll');
  let more = 1, eleMore = 1;
  if (ks.has('resolute')) more *= 1.45;
  if (ks.has('glass')) more *= 1.6;
  if (ks.has('overload')) eleMore *= 1.3;
  if (ks.has('lifebloom')) more *= 0.7;
  more *= 1 + g('moreDmg') / 100;
  const mastery = isClassWeapon(state, gear.weapon);
  if (mastery) more *= 1 + WEAPON_MASTERY;
  const convert = ks.has('overload') ? 1 : Math.min(1, g('convert'));
  const physMinRaw = (hasWeapon ? g('w_physMin') : 2) + g('addPhysMin');
  const physMaxRaw = (hasWeapon ? g('w_physMax') : 4) + g('addPhysMax');
  const physMult = (1 + (g('incPhys') + incDmg) / 100) * more;
  const eleMult = (1 + (g('incEle') + incDmg) / 100) * more * eleMore;
  let armour = 10 + g('armour'), evasion = 10 + g('evasion');
  let incArm = g('incArmour'), incEva = g('incEvasion');
  if (ks.has('ironRefl')) { armour += evasion; incArm += incEva + 20; evasion = 0; incEva = 0; }
  let armMore = 1, evaMore = 1;
  if (ks.has('acrobatics')) { evaMore = 1.3; armMore = 0.5; }
  const st = {
    keystones: ks,
    role,
    mastery,
    healMult: (1 + g('incHeal') / 100) * (1 + g('healMore') / 100) * (ks.has('lifebloom') ? 1.6 : 1),
    dr: Math.min(0.6, g('dr') / 100),
    cdr: Math.min(60, g('cdr')),
    skillPow: g('skillPow'),
    physMin: physMinRaw * (1 - convert) * physMult,
    physMax: physMaxRaw * (1 - convert) * physMult,
    eleMin: (g('addEleMin') + physMinRaw * convert) * eleMult,
    eleMax: (g('addEleMax') + physMaxRaw * convert) * eleMult,
    aps: Math.min(8, (hasWeapon ? g('w_aps') : 1.2) * (1 + g('aps') / 100)),
    crit: ks.has('resolute') ? 0 : Math.min(95, (hasWeapon ? g('w_crit') : 5) * (1 + g('critChance') / 100)),
    critMulti: 150 + g('critMulti') + (ks.has('assassin') ? 120 : 0),
    nonCritMult: ks.has('assassin') ? 0.6 : 1,
    maxLife: (50 + 14 * (state.level - 1) + g('life')) * (1 + g('incLife') / 100) * (ks.has('glass') ? 0.5 : 1),
    armour: armour * (1 + incArm / 100) * armMore,
    evasion: evasion * (1 + incEva / 100) * evaMore,
    evadeCap: Math.min(0.9, (ks.has('acrobatics') ? 0.85 : 0.7) + g('evadeCap') / 100),
    resistCap: Math.min(90, RESIST_CAP + (ks.has('bulwark') ? 10 : 0) + g('maxRes')),
    resistRaw: g('resist'),
    block: gear.offhand ? Math.min(60, g('block')) : 0,
    lifeOnHit: g('lifeOnHit'),
    lifeOnHitPct: g('lifeOnHitPct'),
    leech: Math.min(30, g('leech') * (ks.has('vaalPact') ? 3 : 1)),
    goldFind: g('goldFind'),
    rarity: g('rarity'),
    xpGain: g('xpGain'),
  };
  st.regen = ks.has('vaalPact') ? 0 : g('regen') + st.maxLife * (g('regenPct') + (ks.has('bulwark') ? 1 : 0)) / 100;
  st.resist = Math.min(st.resistCap, st.resistRaw - resistPenalty(combatLevel(state)));
  const avgHit = (st.physMin + st.physMax) / 2 + (st.eleMin + st.eleMax) / 2;
  st.avgHit = avgHit;
  const cc = st.crit / 100;
  st.dps = avgHit * st.aps * ((1 - cc) * st.nonCritMult + cc * st.critMulti / 100);

  // Defensive picture against the current stage
  const mon = monsterFor(combatLevel(state), false, 'normal');
  st.evadeChance = evadeChance(st.evasion, mon.acc, st.evadeCap);
  st.armourRed = armourReduction(st.armour, mon.dmg);
  const resRed = st.resist / 100;
  const taken = (1 - st.evadeChance) * (1 - st.block / 100) *
    (mon.physShare * (1 - st.armourRed) + (1 - mon.physShare) * (1 - resRed));
  st.damageTakenMult = Math.max(0.02, taken * (1 - st.dr));
  st.ehp = st.maxLife / st.damageTakenMult;
  const sustain = st.regen + (st.lifeOnHit + st.maxLife * st.lifeOnHitPct / 100) * st.aps + st.dps * st.leech / 100;
  st.sustain = sustain;
  // Power: geometric mean of offence and (sustain-adjusted) defence
  const ehpS = st.ehp + (sustain * 8) / st.damageTakenMult;
  const util = 1 + st.goldFind * 0.0005 + st.rarity * 0.001 + st.xpGain * 0.001;
  const skillF = (1 + st.skillPow / 100 * 0.35) * (1 + st.cdr / 100 * 0.3);
  // Healing throughput: healers convert their hits into heals
  st.hps = st.avgHit * st.aps * 0.8 * st.healMult;
  // Role-weighted power: tanks value defence, DPS value damage, healers value healing
  const off = st.dps * skillF;
  if (role === 'tank') st.power = Math.pow(off, 0.3) * Math.pow(ehpS, 0.7) * util;
  else if (role === 'healer') st.power = Math.pow(st.hps * skillF, 0.6) * Math.pow(ehpS, 0.4) * util;
  else st.power = Math.pow(off, 0.7) * Math.pow(ehpS, 0.3) * util;
  return st;
}

export const evadeChance = (ev, acc, cap = 0.7) => Math.min(cap, ev / (ev + acc * 2.5));
export const armourReduction = (armour, hit) => Math.min(0.9, armour / (armour + 8 * hit));

// Which slot would an item go into, and what would it replace?
export function targetSlot(state, item) {
  if (item.type !== 'ring') return item.type;
  const r1 = state.gear.ring1, r2 = state.gear.ring2;
  if (!r1) return 'ring1';
  if (!r2) return 'ring2';
  // replace whichever ring gives the better result
  const a = powerWith(state, 'ring1', item), b = powerWith(state, 'ring2', item);
  return a >= b ? 'ring1' : 'ring2';
}

export function powerWith(state, slot, item) {
  const gear = { ...state.gear, [slot]: item };
  return computeStats(state, gear).power;
}

// Returns { slot, gain } where gain is fractional power change
export function evaluateItem(state, item, basePower) {
  const slot = targetSlot(state, item);
  const base = basePower ?? computeStats(state).power;
  const p = powerWith(state, slot, item);
  return { slot, gain: p / base - 1 };
}

export const xpToNext = (level) => Math.ceil(22 * S(level) * (1 + level * 0.06));
