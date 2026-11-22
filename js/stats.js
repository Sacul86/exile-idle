import { S, PASSIVES, SLOTS, resistPenalty, physShare, isBossStage } from './data.js';
import { itemStats } from './items.js';

export const RESIST_CAP = 75;
// Monsters outscale gear slightly, so tiers/crafting/passives matter.
export let MONSTER_EXP = +(globalThis.process?.env?.MEXP || 1.3);

// Monster template for a stage (used for both combat and gear scoring)
export function monsterFor(stage, elite = false) {
  const boss = isBossStage(stage);
  const s = Math.pow(S(stage), MONSTER_EXP);
  let hp = 32 * s, dmg = 4.5 * s, interval = 1.3;
  // Ease the first few stages so the opening feels snappy
  const ease = Math.min(1, 0.4 + stage * 0.06);
  hp *= ease; dmg *= ease;
  if (boss) { hp *= 9; dmg *= 1.7; interval = 1.5; }
  else if (elite) { hp *= 2.5; dmg *= 1.3; }
  return { hp, maxHp: hp, dmg, interval, boss, elite, acc: 40 * S(stage), physShare: physShare(stage) };
}

export function computeStats(state, gear = state.gear) {
  const t = {};
  const add = (k, v) => { t[k] = (t[k] || 0) + v; };
  for (const slot of SLOTS) {
    const it = gear[slot.id];
    if (!it) continue;
    for (const [k, v] of Object.entries(itemStats(it))) add(k, v);
  }
  for (const p of PASSIVES) {
    const r = state.passives[p.id] || 0;
    if (r) add(p.stat, r * p.per);
  }
  const g = (k) => t[k] || 0;
  const hasWeapon = !!gear.weapon;
  const incDmg = g('incAll');
  const physMin = (hasWeapon ? g('w_physMin') : 2) + g('addPhysMin');
  const physMax = (hasWeapon ? g('w_physMax') : 4) + g('addPhysMax');
  const physMult = 1 + (g('incPhys') + incDmg) / 100;
  const eleMult = 1 + (g('incEle') + incDmg) / 100;
  const st = {
    physMin: physMin * physMult,
    physMax: physMax * physMult,
    eleMin: g('addEleMin') * eleMult,
    eleMax: g('addEleMax') * eleMult,
    aps: Math.min(8, (hasWeapon ? g('w_aps') : 1.2) * (1 + g('aps') / 100)),
    crit: Math.min(95, (hasWeapon ? g('w_crit') : 5) * (1 + g('critChance') / 100)),
    critMulti: 150 + g('critMulti'),
    maxLife: (50 + 14 * (state.level - 1) + g('life')) * (1 + g('incLife') / 100),
    armour: (10 + g('armour')) * (1 + g('incArmour') / 100),
    evasion: (10 + g('evasion')) * (1 + g('incEvasion') / 100),
    resistRaw: g('resist'),
    block: gear.offhand ? Math.min(60, g('block')) : 0,
    lifeOnHit: g('lifeOnHit'),
    leech: Math.min(20, g('leech')),
    goldFind: g('goldFind'),
    rarity: g('rarity'),
    xpGain: g('xpGain'),
  };
  st.regen = g('regen') + st.maxLife * g('regenPct') / 100;
  st.resist = Math.min(RESIST_CAP, st.resistRaw - resistPenalty(state.stage));
  const avgHit = (st.physMin + st.physMax) / 2 + (st.eleMin + st.eleMax) / 2;
  st.avgHit = avgHit;
  st.dps = avgHit * st.aps * (1 + (st.crit / 100) * (st.critMulti / 100 - 1));

  // Defensive picture against the current stage
  const mon = monsterFor(state.stage);
  st.evadeChance = evadeChance(st.evasion, mon.acc);
  st.armourRed = armourReduction(st.armour, mon.dmg);
  const resRed = st.resist / 100;
  const taken = (1 - st.evadeChance) * (1 - st.block / 100) *
    (mon.physShare * (1 - st.armourRed) + (1 - mon.physShare) * (1 - resRed));
  st.damageTakenMult = Math.max(0.02, taken);
  st.ehp = st.maxLife / st.damageTakenMult;
  const sustain = st.regen + st.lifeOnHit * st.aps + st.dps * st.leech / 100;
  st.sustain = sustain;
  // Power: geometric mean of offence and (sustain-adjusted) defence
  const ehpS = st.ehp + (sustain * 8) / st.damageTakenMult;
  const util = 1 + st.goldFind * 0.0005 + st.rarity * 0.001 + st.xpGain * 0.001;
  st.power = Math.sqrt(st.dps * ehpS) * util;
  return st;
}

export const evadeChance = (ev, acc) => Math.min(0.7, ev / (ev + acc * 2.5));
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
export const passivePointsTotal = (level) => level - 1;
export const passivePointsSpent = (state) => Object.values(state.passives).reduce((a, b) => a + b, 0);
