// Core game engine: state, combat ticks, loot handling, progression.
import { S, SLOTS, MONSTERS_PER_STAGE, isBossStage, zoneFor, RARITIES } from './data.js';
import { generateItem, salvageValue } from './items.js';
import { computeStats, monsterFor, evaluateItem, xpToNext, evadeChance, armourReduction } from './stats.js';

export const SAVE_KEY = 'exile-idle-save-v1';
export const BAG_SIZE = 60;

export function newState() {
  const gear = Object.fromEntries(SLOTS.map((s) => [s.id, null]));
  const st = {
    version: 1,
    level: 1, xp: 0, gold: 0, shards: 0,
    stage: 1, maxStage: 1, kills: 0, totalKills: 0, deaths: 0,
    gear, bag: [], passives: {},
    settings: { autoAdvance: true, autoEquip: true, autoSalvage: 2, speed: 1 },
    pushBlocked: false,
    lastSave: Date.now(),
    combat: null,
    lootLog: [],
  };
  // Starter weapon
  st.gear.weapon = generateItem(1, { type: 'weapon', rarity: 0 });
  st.gear.weapon.isNew = false;
  return st;
}

export function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    const base = newState();
    return { ...base, ...s, settings: { ...base.settings, ...s.settings } };
  } catch { return null; }
}

export function save(state) {
  state.lastSave = Date.now();
  const { combat, ...rest } = state;
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(rest)); } catch {}
}

// ---------- Combat ----------
function spawn(state) {
  const elite = !isBossStage(state.stage) && Math.random() < 0.1;
  const zone = zoneFor(state.stage);
  const m = monsterFor(state.stage, elite);
  m.icon = m.boss ? zone.boss : zone.monsters[Math.floor(Math.random() * zone.monsters.length)];
  m.name = m.boss ? zone.bossName : (elite ? 'Elite ' : '') + 'Monster';
  m.timer = m.interval * 0.8;
  return m;
}

export function ensureCombat(state) {
  if (!state.combat) {
    const stats = computeStats(state);
    state.combat = { hp: stats.maxLife, monster: spawn(state), pTimer: 0, stats, respawn: 0 };
  }
  return state.combat;
}

export function refreshStats(state) {
  const c = ensureCombat(state);
  const old = c.stats.maxLife;
  c.stats = computeStats(state);
  if (old > 0) c.hp = Math.min(c.stats.maxLife, c.hp * (c.stats.maxLife / old));
}

const rr = (a, b) => a + Math.random() * (b - a);

export function tick(state, dt, ev) {
  const c = ensureCombat(state);
  const st = c.stats;
  if (c.respawn > 0) {
    c.respawn -= dt;
    if (c.respawn <= 0) { c.hp = st.maxLife; c.monster = spawn(state); }
    return;
  }
  const m = c.monster;
  // regen
  c.hp = Math.min(st.maxLife, c.hp + st.regen * dt);

  // player attacks
  c.pTimer += dt;
  const interval = 1 / st.aps;
  while (c.pTimer >= interval && m.hp > 0) {
    c.pTimer -= interval;
    let dmg = rr(st.physMin, st.physMax) + rr(st.eleMin, st.eleMax);
    const crit = Math.random() * 100 < st.crit;
    if (crit) dmg *= st.critMulti / 100;
    m.hp -= dmg;
    c.hp = Math.min(st.maxLife, c.hp + st.lifeOnHit + dmg * st.leech / 100);
    ev && ev.push({ t: 'hit', dmg, crit, who: 'm' });
  }
  if (m.hp <= 0) { onKill(state, m, ev); return; }

  // monster attacks
  m.timer += dt;
  while (m.timer >= m.interval) {
    m.timer -= m.interval;
    if (Math.random() < evadeChance(st.evasion, m.acc)) { ev && ev.push({ t: 'evade' }); continue; }
    if (Math.random() * 100 < st.block) { ev && ev.push({ t: 'block' }); continue; }
    const raw = m.dmg * rr(0.8, 1.2);
    const phys = raw * m.physShare, ele = raw - phys;
    const dmg = phys * (1 - armourReduction(st.armour, phys)) + ele * (1 - st.resist / 100);
    c.hp -= dmg;
    ev && ev.push({ t: 'hit', dmg, who: 'p' });
    if (c.hp <= 0) { onDeath(state, ev); return; }
  }
}

function onDeath(state, ev) {
  const c = state.combat;
  state.deaths++;
  c.hp = 0;
  c.respawn = 2;
  state.kills = 0;
  if (state.stage > 1) state.stage -= 1;
  state.pushBlocked = true; // stop pushing until you get stronger
  refreshStats(state);
  ev && ev.push({ t: 'death' });
}

function onKill(state, m, ev) {
  const c = state.combat;
  const st = c.stats;
  state.kills++; state.totalKills++;
  const mult = m.boss ? 6 : m.elite ? 2.5 : 1;
  // XP with penalty when over-levelled
  const diff = state.level - state.stage;
  const pen = diff > 5 ? Math.max(0.05, 1 - (diff - 5) * 0.12) : 1;
  const xp = 3 * S(state.stage) * mult * (1 + st.xpGain / 100) * pen;
  const gold = 1.2 * S(state.stage) * mult * (1 + st.goldFind / 100) * rr(0.8, 1.2);
  state.gold += gold;
  gainXp(state, xp, ev);
  // heal a little on kill
  c.hp = Math.min(c.stats.maxLife, c.hp + c.stats.maxLife * 0.05);
  ev && ev.push({ t: 'kill', xp, gold, boss: m.boss });

  // drops
  let drops = 0;
  if (m.boss) drops = 3;
  else if (m.elite) drops = 1 + (Math.random() < 0.4 ? 1 : 0);
  else if (Math.random() < 0.3) drops = 1;
  for (let i = 0; i < drops; i++) {
    const ilvl = state.stage + (m.boss ? 2 : 0);
    const item = generateItem(ilvl, { rarityPct: st.rarity, rarityBonus: m.boss ? 150 : m.elite ? 50 : 0 });
    handleLoot(state, item, ev);
  }

  // stage progress
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
    need = xpToNext(state.level);
    refreshStats(state);
  }
}

export function logLoot(state, item, action) {
  state.lootLog.unshift({ name: item.name, rarity: item.rarity, ilvl: item.ilvl, action, type: item.type });
  if (state.lootLog.length > 30) state.lootLog.length = 30;
}

export function handleLoot(state, item, ev) {
  const s = state.settings;
  if (s.autoEquip) {
    const { slot, gain } = evaluateItem(state, item, state.combat.stats.power);
    if (gain > 0.001) {
      const old = state.gear[slot];
      equip(state, item, slot);
      logLoot(state, item, 'equipped');
      ev && ev.push({ t: 'equip', item, gain });
      if (old) stash(state, old, ev);
      return;
    }
  }
  stash(state, item, ev);
}

function stash(state, item, ev) {
  if (!item.locked && item.rarity <= state.settings.autoSalvage - 1) {
    salvage(state, item);
    logLoot(state, item, 'salvaged');
    return;
  }
  if (state.bag.length >= BAG_SIZE) {
    // salvage the lowest-value unlocked item to make room
    let worstI = -1, worst = Infinity;
    state.bag.forEach((b, i) => { if (!b.locked) { const v = b.rarity * 1000 + b.ilvl; if (v < worst) { worst = v; worstI = i; } } });
    const incomingV = item.rarity * 1000 + item.ilvl;
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

export function equip(state, item, slot) {
  slot = slot || (item.type === 'ring' ? (state.gear.ring1 ? 'ring2' : 'ring1') : item.type);
  state.gear[slot] = item;
  state.pushBlocked = false;
  refreshStats(state);
}

export function equipFromBag(state, uid, slot) {
  const i = state.bag.findIndex((b) => b.uid === uid);
  if (i < 0) return;
  const item = state.bag.splice(i, 1)[0];
  if (item.type === 'ring' && !slot) {
    slot = !state.gear.ring1 ? 'ring1' : !state.gear.ring2 ? 'ring2' : 'ring1';
  }
  slot = slot || item.type;
  const old = state.gear[slot];
  equip(state, item, slot);
  if (old) state.bag.unshift(old);
}

export function unequip(state, slot) {
  const it = state.gear[slot];
  if (!it || slot === 'weapon' && false) return;
  state.gear[slot] = null;
  state.bag.unshift(it);
  refreshStats(state);
}

// Run the game headlessly for `seconds` (offline progress / tests)
export function simulate(state, seconds, dt = 0.2) {
  const before = { gold: state.gold, xp: state.xp, level: state.level, shards: state.shards, maxStage: state.maxStage, kills: state.totalKills };
  const ev = [];
  let equips = 0;
  ensureCombat(state);
  for (let t = 0; t < seconds; t += dt) {
    tick(state, dt, ev);
    for (const e of ev) if (e.t === 'equip') equips++;
    ev.length = 0;
  }
  return {
    gold: state.gold - before.gold, shards: state.shards - before.shards,
    levels: state.level - before.level, stages: state.maxStage - before.maxStage,
    kills: state.totalKills - before.kills, equips,
  };
}

export { RARITIES };
