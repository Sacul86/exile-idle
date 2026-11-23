// Core game engine: party of three heroes (tank / healer / DPS), combat, loot,
// campaign / dungeon / raid / world-boss progression, pets.
import { S, SLOTS, MONSTERS_PER_STAGE, isBossStage, zoneFor, ZONES, RARITIES, STAGES_PER_ZONE } from './data.js';
import { generateItem, salvageValue } from './items.js';
import { SETS } from './classdata.js';
import { NODES, pathTo, treePointsFree, allocatedSet, CLASS_BY_ID, ROLE_ORDER } from './tree.js';
import { SKILL_BY_ID, skillSlots, unlockedSkills, skillEffective } from './skills.js';
import { PETS, PET_BY_ID, SHOP, petBonus, petAttackMult, INVASION_TIME, worldBossToday, invasionStatus, invasionReward } from './pets.js';
import { computeStats, monsterFor, xpToNext, evadeChance, armourReduction, targetSlot, combatLevel } from './stats.js';

export const SAVE_KEY = 'exile-idle-save-v1';
export const BAG_SIZE = 80;
export const DEFAULT_CLASS = { tank: 'marauder', healer: 'templar', dps: 'witch' };
const TREE_VERSION = 3;

const emptyGear = () => Object.fromEntries(SLOTS.map((s) => [s.id, null]));
export function newHero(role, cls = null) {
  const gear = emptyGear();
  gear.weapon = generateItem(1, { type: 'weapon', rarity: 0, cls });
  gear.weapon.isNew = false;
  if (role === 'tank') { gear.offhand = generateItem(1, { type: 'offhand', rarity: 0 }); gear.offhand.isNew = false; }
  return { role, cls, gear, tree: [], asc: [], skills: { ranks: { cleave: 1 }, bar: ['cleave'], mods: {} } };
}

export function newState() {
  return {
    version: 3, treeVersion: TREE_VERSION,
    level: 1, xp: 0, gold: 0, shards: 0, keys: 0, sigils: 0, emblems: 0, horns: 0, eggs: 0,
    boxes: { 1: 0, 2: 0, 3: 0 },
    stage: 1, maxStage: 1, kills: 0, totalKills: 0, deaths: 0,
    heroes: ROLE_ORDER.map((r) => newHero(r, null)),
    bag: [],
    pets: { owned: { wolf: 1 }, active: 'wolf' },
    invasion: { used: null, best: 0 },
    bossesBeaten: {}, dungeonsCleared: {}, raidsCleared: {},
    run: null,
    settings: { autoAdvance: true, autoEquip: true, autoSalvage: 2, autoOptimise: false, speed: 1 },
    pushBlocked: false,
    lastSave: Date.now(),
    combat: null,
    lootLog: [],
    ui: { hero: 2 },
  };
}

// A hero as seen by the stat engine: hero fields + party-wide context
export function charOf(state, i) {
  const h = state.heroes[i];
  return { ...h, level: state.level, stage: state.stage, run: state.run, petBonus: petBonus(state) };
}
export const partyReady = (state) => state.heroes.every((h) => h.cls);

export function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    const base = newState();
    const st = { ...base, ...s, settings: { ...base.settings, ...s.settings }, boxes: { ...base.boxes, ...(s.boxes || {}) } };
    if (!s.heroes) {
      // v2 single hero -> joins the party in its role
      const role = (CLASS_BY_ID[s.cls] || {}).role || 'dps';
      const hero = { role, cls: s.cls || null, gear: s.gear || emptyGear(), tree: [], asc: s.asc || [], skills: s.skills || base.heroes[0].skills };
      hero.skills.mods = hero.skills.mods || {};
      st.heroes = ROLE_ORDER.map((r) => (r === role ? hero : newHero(r, null)));
      st.ui = { hero: ROLE_ORDER.indexOf(role) };
      st.migrated = true;
      for (const k of ['cls', 'gear', 'tree', 'asc', 'skills', 'passives']) delete st[k];
    }
    if (s.treeVersion !== TREE_VERSION) {
      st.treeReset = st.heroes.some((h) => h.tree && h.tree.length) || !!s.tree;
      st.heroes.forEach((h) => { h.tree = []; });
      st.treeVersion = TREE_VERSION;
    }
    st.heroes.forEach((h) => { h.tree = (h.tree || []).filter((id) => NODES[id]); h.asc = h.asc || []; h.skills.mods = h.skills.mods || {}; });
    st.pets = st.pets || base.pets;
    st.invasion = st.invasion || base.invasion;
    st.ui = st.ui || base.ui;
    if (st.run && st.run.kind === 'invasion') st.run = null;
    syncSkills(st);
    return st;
  } catch (e) { console.warn(e); return null; }
}

export function save(state) {
  state.lastSave = Date.now();
  const { combat, ...rest } = state;
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(rest)); } catch {}
}

// ---------- Dungeons, raids, invasions ----------
export const DUNGEON = { rooms: 5, perRoom: 6, timeLimit: 150 };
export const RAID = { timeLimit: 180 };
export const dungeonLevel = (tier) => tier * STAGES_PER_ZONE + 5;
export const raidLevel = (tier) => tier * STAGES_PER_ZONE + 8;
export const dungeonName = (tier) => `Vaults of the ${ZONES[(tier - 1) % ZONES.length].name}`;
export const raidName = (tier) => `Sanctum of ${ZONES[(tier - 1) % ZONES.length].bossName.replace(/^The /, '')}`;
export const dungeonTiers = (state) => Math.floor((state.maxStage - 1) / STAGES_PER_ZONE);
export const raidUnlocked = (state, tier) => (state.dungeonsCleared[tier] || 0) > 0;

export function startRun(state, kind, tier) {
  if (state.run) return 'Already in a run';
  if (!partyReady(state)) return 'Choose a class for every hero first';
  if (kind === 'dungeon') {
    if (state.keys < 1) return 'You need a 🗝️ Dungeon Key';
    if (tier < 1 || tier > dungeonTiers(state)) return 'Locked';
    state.keys--;
    state.run = { kind, tier, level: dungeonLevel(tier), room: 1, roomKills: 0, time: 0, timeLimit: DUNGEON.timeLimit };
  } else if (kind === 'raid') {
    if (state.sigils < 1) return 'You need a 🔱 Raid Sigil';
    if (!raidUnlocked(state, tier)) return 'Clear this tier\'s dungeon first';
    state.sigils--;
    state.run = { kind, tier, level: raidLevel(tier), time: 0, timeLimit: RAID.timeLimit, phase: 1 };
  } else if (kind === 'invasion') {
    const st = invasionStatus(state);
    const useHorn = !(st.open && !st.used);
    if (useHorn && state.horns < 1) return st.open ? 'Already fought this invasion. Use an 📯 Invasion Horn.' : 'No invasion right now. Use an 📯 Invasion Horn.';
    if (useHorn) state.horns--; else state.invasion.used = st.key;
    const wb = worldBossToday();
    state.run = { kind, boss: wb.id, name: wb.name, level: Math.max(10, state.maxStage), time: 0, timeLimit: INVASION_TIME, damage: 0 };
  }
  state.combat = null;
  ensureCombat(state);
  return null;
}

export function abandonRun(state, ev) {
  if (state.run && state.run.kind === 'invasion') return finishInvasion(state, ev);
  endRun(state, false, ev, 'Abandoned');
}

function endRun(state, success, ev, reason, extra = {}) {
  const run = state.run;
  state.run = null;
  state.combat = null;
  ensureCombat(state);
  ev && ev.push({ t: 'runEnd', run, success, reason, ...extra });
}

function finishInvasion(state, ev) {
  const run = state.run;
  const pct = run.damage / run.refHp;
  const rw = invasionReward(pct);
  state.emblems += rw.emblems;
  for (const [k, n] of Object.entries(rw.boxes)) state.boxes[k] = (state.boxes[k] || 0) + n;
  state.invasion.best = Math.max(state.invasion.best || 0, run.damage);
  endRun(state, true, ev, `Rank ${rw.tier}: +🏅${rw.emblems} ${Object.entries(rw.boxes).map(([k, n]) => `+${n} Box ${'I'.repeat(+k)}`).join(' ')}`, { reward: rw, damage: run.damage });
}

// ---------- Combat ----------
function spawn(state) {
  const run = state.run;
  const lvl = combatLevel(state);
  const zone = zoneFor(Math.max(1, run && run.tier ? run.tier * STAGES_PER_ZONE : state.stage));
  let m;
  if (run && run.kind === 'invasion') {
    m = monsterFor(lvl, false, 'raid');
    run.refHp = m.hp * 14;                 // reward reference
    m.hp = m.maxHp = m.hp * 1000;          // effectively unkillable: you score damage
    m.dmg *= 1.1;
    m.raid = true; m.world = true; m.art = run.boss === 'dragon' ? 'dragon' : 'demonlord'; m.name = run.name;
    m.slamEvery = 5; m.enrageAt = 60;
  } else if (run && run.kind === 'raid') {
    m = monsterFor(lvl, false, 'raid');
    m.hp = m.maxHp = m.hp * 7;
    m.dmg *= 1.15;
    m.raid = true; m.art = zone.bossArt; m.name = `${zone.bossName}, Ascended`;
    m.slamEvery = 5; m.enrageAt = 120;
  } else if (run && run.kind === 'dungeon' && run.room > DUNGEON.rooms) {
    m = monsterFor(lvl, false, 'boss');
    m.hp = m.maxHp = m.hp * 1.5;
    m.art = 'warden'; m.name = `Vault Warden`;
    m.slamEvery = 6; m.enrageAt = 35;
  } else if (!run && isBossStage(state.stage)) {
    m = monsterFor(lvl, false, 'boss');
    m.art = zone.bossArt; m.name = zone.bossName;
    m.slamEvery = 7; m.enrageAt = 30;
  } else {
    const elite = Math.random() < (run ? 0.3 : 0.1);
    m = monsterFor(lvl, elite, 'normal');
    const pool = run ? ['dknight', 'imp', 'wraith', 'hound', 'cultist'] : zone.monsters;
    m.art = pool[Math.floor(Math.random() * pool.length)];
    m.name = elite ? 'Elite' : 'Monster';
  }
  m.icon = zone.icon || '👹';
  m.timer = m.interval * 0.8;
  m.age = 0; m.slamTimer = 0;
  return m;
}

const heroCombat = (stats) => ({ hp: stats.maxLife, stats, pTimer: Math.random() * 0.3, cds: {}, buffs: {}, shield: null, dead: 0 });

export function ensureCombat(state) {
  if (!state.combat) {
    const hs = state.heroes.map((_, i) => heroCombat(computeStats(charOf(state, i))));
    state.combat = { heroes: hs, monster: spawn(state), wipe: 0, petTimer: 0, phoenixCd: 0 };
    summarise(state);
  }
  return state.combat;
}

function summarise(state) {
  const c = state.combat;
  const st = c.heroes.map((h) => h.stats);
  c.party = {
    dps: st.reduce((a, s) => a + (s.role === 'healer' ? s.dps * 0.6 : s.dps), 0),
    hps: st.filter((s) => s.role === 'healer').reduce((a, s) => a + s.hps, 0),
    tankEhp: (st.find((s) => s.role === 'tank') || st[0]).ehp,
    power: st.reduce((a, s) => a + s.power, 0),
    goldFind: Math.max(...st.map((s) => s.goldFind)),
    rarity: Math.max(...st.map((s) => s.rarity)),
    xpGain: Math.max(...st.map((s) => s.xpGain)),
  };
}

export function refreshStats(state) {
  const c = ensureCombat(state);
  c.heroes.forEach((h, i) => {
    const old = h.stats.maxLife;
    h.stats = computeStats(charOf(state, i));
    if (old > 0 && !h.dead) h.hp = Math.min(h.stats.maxLife, h.hp * (h.stats.maxLife / old));
  });
  summarise(state);
}

const rr = (a, b) => a + Math.random() * (b - a);
export const enrageMult = (m) => (m.enrageAt && m.age > m.enrageAt ? 1 + (m.age - m.enrageAt) * 0.08 : 1);
const alive = (c) => c.heroes.filter((h) => !h.dead);
function lowestAlly(c) {
  let best = null, r = 2;
  c.heroes.forEach((h, i) => { if (!h.dead) { const k = h.hp / h.stats.maxLife; if (k < r) { r = k; best = i; } } });
  return { i: best, ratio: r };
}

export function tick(state, dt, ev) {
  const c = ensureCombat(state);
  const run = state.run;
  if (run) {
    run.time += dt;
    if (run.time >= run.timeLimit) {
      if (run.kind === 'invasion') return finishInvasion(state, ev);
      return endRun(state, false, ev, 'Out of time');
    }
  }
  if (c.wipe > 0) {
    c.wipe -= dt;
    if (c.wipe <= 0) { c.heroes.forEach((h) => { h.dead = 0; h.hp = h.stats.maxLife; h.shield = null; h.buffs = {}; }); c.monster = spawn(state); }
    return;
  }
  const m = c.monster;
  c.phoenixCd = Math.max(0, c.phoenixCd - dt);
  if (m.expose) { m.expose.t -= dt; if (m.expose.t <= 0) m.expose = null; }

  // revive timers, regen, buffs
  c.heroes.forEach((h, i) => {
    if (h.dead) {
      h.dead -= dt;
      if (h.dead <= 0) { h.dead = 0; h.hp = h.stats.maxLife * 0.5; ev && ev.push({ t: 'revive', i }); }
      return;
    }
    for (const k of Object.keys(h.buffs)) { h.buffs[k].t -= dt; if (h.buffs[k].t <= 0) delete h.buffs[k]; }
    if (h.shield) { h.shield.t -= dt; if (h.shield.t <= 0 || h.shield.v <= 0) h.shield = null; }
    const hot = h.buffs.hot ? h.stats.maxLife * h.buffs.hot.v : 0;
    h.hp = Math.min(h.stats.maxLife, h.hp + (h.stats.regen + hot) * dt);
  });

  const healAlly = (src, target, amount) => {
    const t = c.heroes[target];
    if (!t || t.dead) return;
    const before = t.hp;
    t.hp = Math.min(t.stats.maxLife, t.hp + amount);
    ev && t.hp > before && ev.push({ t: 'heal', i: target, src, amount: t.hp - before });
  };

  // ---- heroes act ----
  c.heroes.forEach((h, i) => {
    if (h.dead || m.hp <= 0) return;
    const st = h.stats;
    const dmgBuff = 1 + (h.buffs.dmg ? h.buffs.dmg.v : 0) + (h.shield && h.shield.dmg ? h.shield.dmg : 0);
    const apsBuff = 1 + (h.buffs.aps ? h.buffs.aps.v : 0);
    const strike = (mult, eleBoost = 1, critBonus = 0, leechBonus = 0, forceCrit = false) => {
      const exposeMult = 1 + (m.expose ? m.expose.v : 0) + (m.frozen > 0 && m.brittle ? m.brittle : 0);
      let dmg = (rr(st.physMin, st.physMax) + rr(st.eleMin, st.eleMax) * eleBoost) * mult * dmgBuff * exposeMult;
      const crit = forceCrit || Math.random() * 100 < st.crit;
      dmg *= crit ? (st.critMulti + critBonus) / 100 : st.nonCritMult;
      m.hp -= dmg;
      if (run && run.kind === 'invasion') run.damage += dmg;
      const leechNow = st.leech + leechBonus + (h.buffs.leech ? h.buffs.leech.v : 0);
      h.hp = Math.min(st.maxLife, h.hp + st.lifeOnHit + st.maxLife * st.lifeOnHitPct / 100 + dmg * leechNow / 100);
      ev && ev.push({ t: 'hit', dmg, crit, who: 'm', src: i });
    };
    // basic attack, or heal if a healer sees an injured ally
    h.pTimer += dt;
    const interval = 1 / (st.aps * apsBuff);
    while (h.pTimer >= interval && m.hp > 0) {
      h.pTimer -= interval;
      if (st.role === 'healer') {
        const low = lowestAlly(c);
        if (low.ratio < 0.85) { healAlly(i, low.i, (st.avgHit * 0.8 * st.healMult) * rr(0.9, 1.1)); continue; }
        strike(0.6);
      } else strike(1);
    }
    // skills
    const hero = state.heroes[i];
    const bar = hero.skills.bar.slice(0, skillSlots(state.level));
    const cdMult = 1 - st.cdr / 100;
    for (const id of bar) {
      if (!id || m.hp <= 0) continue;
      const sk = SKILL_BY_ID[id];
      if (!sk) continue;
      const rank = hero.skills.ranks[id] || 1;
      const ef = skillEffective(sk, rank, hero.skills.mods[id]);
      h.cds[id] = (h.cds[id] ?? ef.cooldown * cdMult * 0.5) - dt;
      if (h.cds[id] > 0) continue;
      const p = ef.power * (1 + st.skillPow / 100);
      const healBoost = st.healMult;
      if (sk.kind === 'heal') {
        const low = lowestAlly(c);
        if (sk.party) {
          if (low.ratio > Math.max(ef.thresh, 0.75)) { h.cds[id] = 0; continue; }
          c.heroes.forEach((a, j) => { if (!a.dead) { healAlly(i, j, a.stats.maxLife * p * healBoost); if (sk.regen) a.buffs.hot = { v: sk.regen * healBoost, t: ef.duration }; } });
        } else {
          if (low.ratio > ef.thresh) { h.cds[id] = 0; continue; }
          healAlly(i, low.i, c.heroes[low.i].stats.maxLife * p * healBoost);
        }
        if (ef.dmgBuff) h.buffs.dmg = { v: Math.max(ef.dmgBuff, h.buffs.dmg ? h.buffs.dmg.v : 0), t: 4 };
        if (ef.shield) c.heroes.forEach((a) => { if (!a.dead) a.shield = { v: a.stats.maxLife * ef.shield, t: 6, dmg: 0 }; });
      } else if (sk.kind === 'hit') {
        for (let n = 0; n < ef.casts; n++) for (let k = 0; k < ef.hits; k++) strike(p, sk.ele ? 1.5 : 1, ef.critm, ef.leech, ef.alwaysCrit);
        if (ef.expose) m.expose = { v: ef.expose, t: ef.exposeDur };
      } else if (sk.kind === 'freeze') {
        for (let n = 0; n < ef.casts; n++) strike(p);
        m.frozen = ef.duration * (m.boss && !ef.bossFull ? 0.5 : 1) * (m.world ? 0.4 : 1);
        m.brittle = ef.brittle;
        m.stunned = !!sk.stun;
      } else if (sk.kind === 'shield') {
        const targets = sk.party ? c.heroes.filter((a) => !a.dead) : [h];
        targets.forEach((a) => { a.shield = { v: a.stats.maxLife * p * (sk.party ? healBoost : 1), t: ef.duration, dmg: ef.shieldDmg }; });
      } else if (sk.kind === 'buff') {
        if (sk.buffs) for (const [k, v] of Object.entries(sk.buffs)) h.buffs[k] = { v: v * p, t: ef.duration };
        else h.buffs[sk.stat] = { v: p, t: ef.duration };
      }
      if (ef.heal) healAlly(i, i, st.maxLife * ef.heal);
      h.cds[id] = ef.cooldown * cdMult;
      ev && ev.push({ t: 'skill', id, src: i });
    }
  });

  // ---- pet ----
  const pet = state.pets.active;
  if (pet && m.hp > 0) {
    c.petTimer += dt;
    if (c.petTimer >= 2) {
      c.petTimer = 0;
      const lvl = state.pets.owned[pet] || 1;
      const avg = c.heroes.reduce((a, h) => a + h.stats.avgHit, 0) / c.heroes.length;
      const dmg = avg * petAttackMult(lvl) * rr(0.9, 1.1);
      m.hp -= dmg;
      if (run && run.kind === 'invasion') run.damage += dmg;
      ev && ev.push({ t: 'petHit', dmg });
    }
  }
  if (m.hp <= 0) { onKill(state, m, ev); return; }

  // raid phases
  if (m.raid && !m.world && run) {
    const ratio = m.hp / m.maxHp;
    const phase = ratio > 0.66 ? 1 : ratio > 0.33 ? 2 : 3;
    if (phase !== run.phase) {
      run.phase = phase;
      if (phase === 2) { m.interval *= 0.7; m.physShare = 0.3; }
      if (phase === 3) { m.dmg *= 1.35; m.slamEvery = 3.5; }
      ev && ev.push({ t: 'phase', phase });
    }
  }

  // ---- monster attacks: the tank holds aggro, slams hit everyone ----
  m.age += dt;
  if (m.frozen > 0) { m.frozen -= dt; return; }
  const enr = enrageMult(m);
  const hitHero = (i, raw, isSlam) => {
    const h = c.heroes[i], st = h.stats;
    const evade = Math.min(0.9, evadeChance(st.evasion, m.acc, st.evadeCap) + (h.buffs.evade ? h.buffs.evade.v : 0));
    if (Math.random() < evade) { ev && ev.push({ t: 'evade', i }); return; }
    if (Math.random() * 100 < st.block) { ev && ev.push({ t: 'block', i }); return; }
    const phys = raw * m.physShare, ele = raw - phys;
    let dmg = phys * (1 - armourReduction(st.armour, phys)) + ele * (1 - st.resist / 100);
    dmg *= (1 - st.dr) * (1 - (h.buffs.dr ? h.buffs.dr.v : 0));
    if (h.shield) { const a = Math.min(h.shield.v, dmg); h.shield.v -= a; dmg -= a; }
    h.hp -= dmg;
    ev && ev.push({ t: 'hit', dmg, who: 'p', i, slam: isSlam });
    if (h.hp <= 0) heroDown(state, i, ev);
  };
  const target = () => {
    const tank = c.heroes.findIndex((h) => h.stats.role === 'tank' && !h.dead);
    if (tank >= 0) return tank;
    const al = c.heroes.map((h, i) => (h.dead ? -1 : i)).filter((i) => i >= 0);
    return al[Math.floor(Math.random() * al.length)];
  };
  if (m.slamEvery) {
    m.slamTimer += dt;
    if (m.slamTimer >= m.slamEvery) {
      m.slamTimer = 0;
      ev && ev.push({ t: 'slam' });
      const raw = m.dmg * 1.6 * enr * rr(0.9, 1.1);
      for (let i = 0; i < c.heroes.length; i++) {
        if (state.combat !== c || c.wipe > 0) return;
        if (!c.heroes[i].dead) hitHero(i, raw, true);
      }
      if (state.combat !== c || c.wipe > 0) return;
    }
  }
  m.timer += dt;
  while (m.timer >= m.interval && c.wipe <= 0 && state.combat === c) {
    m.timer -= m.interval;
    const t = target();
    if (t == null) break;
    hitHero(t, m.dmg * enr * rr(0.8, 1.2), false);
  }
}

function heroDown(state, i, ev) {
  const c = state.combat;
  const h = c.heroes[i];
  const pet = PET_BY_ID[state.pets.active];
  if (pet && pet.revive && c.phoenixCd <= 0) {
    c.phoenixCd = 60; h.hp = h.stats.maxLife * 0.4;
    ev && ev.push({ t: 'phoenix', i });
    return;
  }
  h.hp = 0; h.dead = 10; h.shield = null; h.buffs = {};
  ev && ev.push({ t: 'heroDown', i });
  if (alive(c).length === 0) wipe(state, ev);
}

function wipe(state, ev) {
  const c = state.combat;
  state.deaths++;
  if (state.run) {
    if (state.run.kind === 'invasion') return finishInvasion(state, ev);
    return endRun(state, false, ev, 'Your party was defeated');
  }
  c.wipe = 2.5;
  state.kills = 0;
  if (state.stage > 1) state.stage -= 1;
  state.pushBlocked = true;
  refreshStats(state);
  ev && ev.push({ t: 'death' });
}

function dropItems(state, n, ilvl, rarityBonus, minRarity, ev, setChance = 0) {
  const p = state.combat.party;
  const classes = state.heroes.map((h) => h.cls).filter(Boolean);
  for (let i = 0; i < n; i++) {
    const cls = classes[Math.floor(Math.random() * classes.length)];
    if (setChance && Math.random() < setChance) {
      const ids = Object.keys(SETS);
      const setId = Math.random() < 0.7 && cls ? cls : ids[Math.floor(Math.random() * ids.length)];
      handleLoot(state, generateItem(ilvl, { set: setId }), ev);
      continue;
    }
    let item = generateItem(ilvl, { rarityPct: p.rarity, rarityBonus, cls });
    if (item.rarity < minRarity) item = generateItem(ilvl, { type: item.type, rarity: minRarity, cls });
    handleLoot(state, item, ev);
  }
}

function maybeEgg(state, chance, ev) {
  if (Math.random() < chance) { state.eggs++; ev && ev.push({ t: 'egg' }); }
}

function onKill(state, m, ev) {
  const c = state.combat;
  const run = state.run;
  const lvl = combatLevel(state);
  const p = c.party;
  if (!run) state.kills++;
  state.totalKills++;
  const mult = m.raid ? 40 : m.boss ? 6 : m.elite ? 2.5 : 1;
  const runMult = run ? 1.5 : 1;
  const diff = state.level - lvl;
  const pen = diff > 5 ? Math.max(0.05, 1 - (diff - 5) * 0.12) : 1;
  gainXp(state, 3 * S(lvl) * mult * runMult * (1 + p.xpGain / 100) * pen, ev);
  state.gold += 1.2 * S(lvl) * mult * runMult * (1 + p.goldFind / 100) * rr(0.8, 1.2);
  c.heroes.forEach((h) => { if (!h.dead) h.hp = Math.min(h.stats.maxLife, h.hp + h.stats.maxLife * 0.05); });
  ev && ev.push({ t: 'kill', boss: m.boss });

  if (run && run.kind === 'invasion') return finishInvasion(state, ev); // (practically never)
  if (m.raid) {
    dropItems(state, 1, lvl + 3, 0, 4, ev);
    if (Math.random() < 0.1 + run.tier * 0.005) dropItems(state, 1, lvl + 3, 0, 5, ev);
    dropItems(state, 3, lvl + 3, 300, 3, ev, 0.5);
    maybeEgg(state, 0.3, ev);
    const shards = Math.ceil(150 * (1 + run.tier));
    state.shards += shards;
    state.raidsCleared[run.tier] = (state.raidsCleared[run.tier] || 0) + 1;
    state.keys += 1; state.horns += 1;
    endRun(state, true, ev, `+💠${shards} +🗝️1 +📯1`);
    return;
  }
  if (run && run.kind === 'dungeon') {
    if (m.boss) {
      dropItems(state, 4, lvl + 2, 300, 2, ev, 0.25);
      maybeEgg(state, 0.1, ev);
      const first = !state.dungeonsCleared[run.tier];
      const sigil = first || Math.random() < 0.35;
      if (sigil) state.sigils++;
      const shards = Math.ceil(40 * (1 + run.tier));
      state.shards += shards;
      state.dungeonsCleared[run.tier] = (state.dungeonsCleared[run.tier] || 0) + 1;
      endRun(state, true, ev, `+💠${shards}${sigil ? ' +🔱 Raid Sigil' : ''}`);
      return;
    }
    if (m.elite || Math.random() < 0.45) dropItems(state, 1, lvl, 100, 0, ev);
    run.roomKills++;
    if (run.roomKills >= DUNGEON.perRoom) { run.room++; run.roomKills = 0; ev && ev.push({ t: 'room', room: run.room }); }
    c.monster = spawn(state);
    return;
  }

  // campaign
  let drops = 0;
  if (m.boss) drops = 3;
  else if (m.elite) drops = 1 + (Math.random() < 0.4 ? 1 : 0);
  else if (Math.random() < 0.3) drops = 1;
  dropItems(state, drops, state.stage + (m.boss ? 2 : 0), m.boss ? 150 : m.elite ? 50 : 0, 0, ev, m.boss && state.stage >= 20 ? 0.12 : 0);
  if (m.boss) {
    const zi = state.stage / STAGES_PER_ZONE;
    const first = !state.bossesBeaten[zi];
    state.bossesBeaten[zi] = (state.bossesBeaten[zi] || 0) + 1;
    if (first || Math.random() < 0.35) { state.keys++; ev && ev.push({ t: 'key', first }); }
    maybeEgg(state, first ? 0.5 : 0.04, ev);
  }
  const needed = isBossStage(state.stage) ? 1 : MONSTERS_PER_STAGE;
  if (state.kills >= needed) {
    state.kills = 0;
    if (state.settings.autoAdvance && !state.pushBlocked) {
      state.stage++;
      if (state.stage > state.maxStage) state.maxStage = state.stage;
      refreshStats(state);
      ev && ev.push({ t: 'stage', stage: state.stage });
    }
  }
  c.monster = spawn(state);
}

export function gainXp(state, xp, ev) {
  state.xp += xp;
  let need = xpToNext(state.level);
  while (state.xp >= need) {
    state.xp -= need;
    state.level++;
    state.pushBlocked = false;
    ev && ev.push({ t: 'level', level: state.level });
    for (const f of syncSkills(state)) ev && ev.push({ t: 'skillUnlock', sk: f.sk, hero: f.hero });
    need = xpToNext(state.level);
    refreshStats(state);
  }
}

// Unlock skills for every hero and fill empty bar slots. Returns newly unlocked.
export function syncSkills(state) {
  const fresh = [];
  state.heroes.forEach((h, hi) => {
    if (!h.cls) return;
    for (const sk of unlockedSkills(state.level, h.cls)) {
      if (!h.skills.ranks[sk.id]) { h.skills.ranks[sk.id] = 1; fresh.push({ sk, hero: hi }); placeSkill(state, h, sk); }
    }
    // remove skills that no longer exist or belong to another class
    h.skills.bar = h.skills.bar.map((id) => (id && SKILL_BY_ID[id] && (!SKILL_BY_ID[id].cls || SKILL_BY_ID[id].cls === h.cls) ? id : null));
  });
  return fresh;
}
function placeSkill(state, h, sk) {
  const bar = h.skills.bar, slots = skillSlots(state.level);
  for (let i = 0; i < slots; i++) if (!bar[i]) { bar[i] = sk.id; return; }
  if (sk.cls) for (let i = slots - 1; i >= 0; i--) if (!SKILL_BY_ID[bar[i]] || !SKILL_BY_ID[bar[i]].cls) { bar[i] = sk.id; return; }
}

// ---------- Tree auto-allocation (per hero) ----------
export function autoAllocate(state, hi, maxPoints = Infinity) {
  const h = state.heroes[hi];
  if (!h.cls) return 0;
  let spent = 0;
  while (spent < maxPoints) {
    const ch = charOf(state, hi);
    if (treePointsFree(ch) <= 0) break;
    const base = computeStats(ch).power;
    const set = allocatedSet(ch);
    let best = null, bestScore = 0;
    for (const id of Object.keys(NODES)) {
      if (set.has(id)) continue;
      const path = pathTo(ch, id);
      if (!path.length || path.length > 4 || path.length > treePointsFree(ch)) continue;
      const p = computeStats({ ...ch, tree: [...h.tree, ...path] }).power;
      const score = (p / base - 1) / path.length;
      if (score > bestScore) { bestScore = score; best = path; }
    }
    if (!best) break;
    h.tree.push(best[0]);
    spent++;
  }
  if (spent && state.combat) refreshStats(state);
  return spent;
}

// ---------- Loot ----------
export function logLoot(state, item, action, hero) {
  state.lootLog.unshift({ name: item.name, rarity: item.rarity, ilvl: item.ilvl, action, type: item.type, set: !!item.set, hero });
  if (state.lootLog.length > 30) state.lootLog.length = 30;
}

// Which hero benefits most from an item?
export function bestHeroFor(state, item, skip = -1) {
  let best = { hero: -1, gain: 0, slot: null };
  state.heroes.forEach((h, i) => {
    if (i === skip || !h.cls) return;
    const ch = charOf(state, i);
    const slot = targetSlot(ch, item);
    const base = state.combat ? state.combat.heroes[i].stats.power : computeStats(ch).power;
    const p = computeStats(ch, { ...h.gear, [slot]: item }).power;
    const gain = p / base - 1;
    if (gain > best.gain) best = { hero: i, gain, slot };
  });
  return best;
}

export function handleLoot(state, item, ev, depth = 0) {
  if (state.settings.autoEquip && partyReady(state)) {
    const b = bestHeroFor(state, item);
    if (b.hero >= 0 && b.gain > 0.001) {
      const h = state.heroes[b.hero];
      const old = h.gear[b.slot];
      h.gear[b.slot] = item;
      state.pushBlocked = false;
      refreshStats(state);
      logLoot(state, item, 'equipped', b.hero);
      ev && ev.push({ t: 'equip', item, gain: b.gain, hero: b.hero });
      if (old) { if (depth < 1) handleLoot(state, old, ev, depth + 1); else stash(state, old, ev); }
      return;
    }
  }
  stash(state, item, ev);
}

function stash(state, item, ev) {
  if (!item.locked && item.rarity <= state.settings.autoSalvage - 1 && !item.set && !item.mythic) {
    salvage(state, item);
    logLoot(state, item, 'salvaged');
    return;
  }
  if (state.bag.length >= BAG_SIZE) {
    let worstI = -1, worst = Infinity;
    state.bag.forEach((b, i) => { if (!b.locked) { const v = b.rarity * 1000 + b.ilvl + (b.set ? 2500 : 0); if (v < worst) { worst = v; worstI = i; } } });
    const incomingV = item.rarity * 1000 + item.ilvl + (item.set ? 2500 : 0);
    if (worstI < 0 || worst > incomingV) { salvage(state, item); logLoot(state, item, 'salvaged'); return; }
    salvage(state, state.bag.splice(worstI, 1)[0]);
  }
  state.bag.unshift(item);
  logLoot(state, item, 'looted');
  ev && ev.push({ t: 'loot', item });
}

export function salvage(state, item) {
  const v = salvageValue(item);
  state.shards += v.shards;
  state.gold += v.gold;
  return v;
}

export function equipFromBag(state, uid, hi, slot) {
  const i = state.bag.findIndex((b) => b.uid === uid);
  if (i < 0) return;
  const h = state.heroes[hi];
  const item = state.bag.splice(i, 1)[0];
  if (item.type === 'ring' && !slot) slot = !h.gear.ring1 ? 'ring1' : !h.gear.ring2 ? 'ring2' : targetSlot(charOf(state, hi), item);
  slot = slot || item.type;
  const old = h.gear[slot];
  h.gear[slot] = item;
  state.pushBlocked = false;
  if (old) state.bag.unshift(old);
  refreshStats(state);
}

export function unequip(state, hi, slot) {
  const h = state.heroes[hi];
  const it = h.gear[slot];
  if (!it) return;
  h.gear[slot] = null;
  state.bag.unshift(it);
  refreshStats(state);
}

// ---------- Pets, boxes, emblem shop ----------
export function hatchEgg(state) {
  if (state.eggs < 1) return null;
  state.eggs--;
  const pet = PETS[Math.floor(Math.random() * PETS.length)];
  const had = state.pets.owned[pet.id];
  state.pets.owned[pet.id] = had ? Math.min(30, had + 1) : 1;
  if (!state.pets.active) state.pets.active = pet.id;
  refreshStats(state);
  return { pet, dup: !!had };
}

export function openBox(state, tier, ev) {
  if (!state.boxes[tier]) return null;
  state.boxes[tier]--;
  const lvl = Math.max(5, state.maxStage);
  const extras = [];
  const mark = state.lootLog[0];
  const evs = ev || [];
  if (tier == 1) dropItems(state, 3, lvl, 100, 2, evs);
  if (tier == 2) { dropItems(state, 2, lvl, 200, 3, evs, 0.5); if (Math.random() < 0.1) { state.eggs++; extras.push('🥚 Pet Egg'); } }
  if (tier == 3) {
    dropItems(state, 1, lvl + 2, 0, Math.random() < 0.25 ? 5 : 4, evs);
    dropItems(state, 1, lvl + 2, 0, 3, evs, 1);
    if (Math.random() < 0.3) { state.eggs++; extras.push('🥚 Pet Egg'); }
  }
  const items = [];
  for (const l of state.lootLog) { if (l === mark) break; items.push(l); }
  return { items, extras };
}

export function buyShop(state, id) {
  const it = SHOP.find((s) => s.id === id);
  if (!it || state.emblems < it.cost) return false;
  state.emblems -= it.cost;
  if (id === 'egg') state.eggs++;
  if (id === 'box2') state.boxes[2]++;
  if (id === 'box3') state.boxes[3]++;
  if (id === 'key') state.keys++;
  if (id === 'sigil') state.sigils++;
  if (id === 'horn') state.horns++;
  return true;
}

// ---------- Headless simulation (offline progress / balance) ----------
export function simulate(state, seconds, dt = 0.2) {
  const before = { gold: state.gold, level: state.level, shards: state.shards, maxStage: state.maxStage, kills: state.totalKills };
  const ev = [];
  let equips = 0, runsWon = 0, runsLost = 0;
  if (!partyReady(state)) return { gold: 0, shards: 0, levels: 0, stages: 0, kills: 0, equips: 0, runsWon, runsLost };
  ensureCombat(state);
  for (let t = 0; t < seconds; t += dt) {
    tick(state, dt, ev);
    for (const e of ev) {
      if (e.t === 'equip') equips++;
      if (e.t === 'runEnd') e.success ? runsWon++ : runsLost++;
    }
    ev.length = 0;
  }
  return {
    gold: state.gold - before.gold, shards: state.shards - before.shards,
    levels: state.level - before.level, stages: state.maxStage - before.maxStage,
    kills: state.totalKills - before.kills, equips, runsWon, runsLost,
  };
}

export { RARITIES };
