// Core game engine: state, combat ticks, loot, campaign / dungeon / raid progression.
import { S, SLOTS, MONSTERS_PER_STAGE, isBossStage, zoneFor, ZONES, RARITIES, STAGES_PER_ZONE } from './data.js';
import { generateItem, salvageValue } from './items.js';
import { NODES, isAllocatable, pathTo, treePointsFree, allocatedSet } from './tree.js';
import { SKILL_BY_ID, skillSlots, unlockedSkills, skillEffective } from './skills.js';
import { computeStats, monsterFor, evaluateItem, xpToNext, evadeChance, armourReduction, combatLevel } from './stats.js';

export const SAVE_KEY = 'exile-idle-save-v1';
export const BAG_SIZE = 60;

export function newState() {
  const gear = Object.fromEntries(SLOTS.map((s) => [s.id, null]));
  const st = {
    version: 2, treeVersion: 2,
    level: 1, xp: 0, gold: 0, shards: 0, keys: 0, sigils: 0,
    stage: 1, maxStage: 1, kills: 0, totalKills: 0, deaths: 0,
    gear, bag: [], cls: null, tree: [],
    skills: { ranks: { cleave: 1 }, bar: ['cleave'], mods: {} },
    bossesBeaten: {}, dungeonsCleared: {}, raidsCleared: {},
    run: null,
    settings: { autoAdvance: true, autoEquip: true, autoSalvage: 2, speed: 1 },
    pushBlocked: false,
    lastSave: Date.now(),
    combat: null,
    lootLog: [],
  };
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
    const st = { ...base, ...s, settings: { ...base.settings, ...s.settings } };
    st.skills = s.skills || base.skills;
    st.skills.mods = st.skills.mods || {};
    syncSkills(st);
    if (s.treeVersion !== 2) { st.tree = []; st.treeVersion = 2; st.treeReset = (s.tree || []).length > 0; }
    st.tree = st.tree.filter((id) => NODES[id]);
    delete st.passives; // v1 passives replaced by the skill tree (points refund automatically)
    if (!s.gear) st.gear = base.gear;
    return st;
  } catch { return null; }
}

export function save(state) {
  state.lastSave = Date.now();
  const { combat, ...rest } = state;
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(rest)); } catch {}
}

// ---------- Dungeons & raids ----------
export const DUNGEON = { rooms: 5, perRoom: 6, timeLimit: 150 };
export const RAID = { timeLimit: 180 };
export const dungeonLevel = (tier) => tier * STAGES_PER_ZONE + 5;
export const raidLevel = (tier) => tier * STAGES_PER_ZONE + 8;
export const dungeonName = (tier) => `${ZONES[(tier - 1) % ZONES.length].name.replace('The ', '')} Depths`;
export const raidName = (tier) => `${ZONES[(tier - 1) % ZONES.length].bossName}'s Sanctum`;
// Dungeon tier N unlocks by beating zone N's boss; raid tier N by clearing dungeon N
export const dungeonTiers = (state) => Math.floor((state.maxStage - 1) / STAGES_PER_ZONE);
export const raidUnlocked = (state, tier) => (state.dungeonsCleared[tier] || 0) > 0;

export function startRun(state, kind, tier) {
  if (state.run) return 'Already in a run';
  if (kind === 'dungeon') {
    if (state.keys < 1) return 'You need a 🗝️ Dungeon Key';
    if (tier < 1 || tier > dungeonTiers(state)) return 'Locked';
    state.keys--;
    state.run = { kind, tier, level: dungeonLevel(tier), room: 1, roomKills: 0, time: 0, timeLimit: DUNGEON.timeLimit };
  } else {
    if (state.sigils < 1) return 'You need a 🔱 Raid Sigil';
    if (!raidUnlocked(state, tier)) return 'Clear this tier\'s dungeon first';
    state.sigils--;
    state.run = { kind, tier, level: raidLevel(tier), time: 0, timeLimit: RAID.timeLimit, phase: 1 };
  }
  state.combat = null;
  ensureCombat(state);
  return null;
}

export function abandonRun(state, ev) { endRun(state, false, ev, 'Abandoned'); }

function endRun(state, success, ev, reason) {
  const run = state.run;
  state.run = null;
  state.combat = null;
  ensureCombat(state);
  ev && ev.push({ t: 'runEnd', run, success, reason });
}

// ---------- Combat ----------
function spawn(state) {
  const run = state.run;
  const lvl = combatLevel(state);
  const zone = zoneFor(Math.max(1, run ? run.tier * STAGES_PER_ZONE : state.stage));
  let m;
  if (run && run.kind === 'raid') {
    m = monsterFor(lvl, false, 'raid');
    m.hp = m.maxHp = m.hp * 7; // ~60x a normal monster
    m.dmg *= 1.15;
    m.raid = true; m.icon = zone.boss; m.name = `${zone.bossName}, Ascended`;
    m.slamEvery = 5; m.enrageAt = 120;
  } else if (run && run.kind === 'dungeon' && run.room > DUNGEON.rooms) {
    m = monsterFor(lvl, false, 'boss');
    m.hp = m.maxHp = m.hp * 1.5;
    m.icon = zone.boss; m.name = `Warden of ${zone.name.replace('The ', '')}`;
    m.slamEvery = 6; m.enrageAt = 35;
  } else if (!run && isBossStage(state.stage)) {
    m = monsterFor(lvl, false, 'boss');
    m.icon = zone.boss; m.name = zone.bossName;
    m.slamEvery = 7; m.enrageAt = 30;
  } else {
    const elite = Math.random() < (run ? 0.3 : 0.1);
    m = monsterFor(lvl, elite, 'normal');
    m.icon = zone.monsters[Math.floor(Math.random() * zone.monsters.length)];
    m.name = elite ? 'Elite' : 'Monster';
  }
  m.timer = m.interval * 0.8;
  m.age = 0; m.slamTimer = 0;
  return m;
}

export function ensureCombat(state) {
  if (!state.combat) {
    const stats = computeStats(state);
    state.combat = { hp: stats.maxLife, monster: spawn(state), pTimer: 0, stats, respawn: 0, cds: {}, buffs: {}, shield: null };
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

// Boss enrage: damage ramps up 8% per second after enrageAt
export const enrageMult = (m) => (m.enrageAt && m.age > m.enrageAt ? 1 + (m.age - m.enrageAt) * 0.08 : 1);

export function tick(state, dt, ev) {
  const c = ensureCombat(state);
  const st = c.stats;
  const run = state.run;
  if (run) {
    run.time += dt;
    if (run.time >= run.timeLimit) { endRun(state, false, ev, 'Out of time'); return; }
  }
  if (c.respawn > 0) {
    c.respawn -= dt;
    if (c.respawn <= 0) { c.hp = st.maxLife; c.monster = spawn(state); }
    return;
  }
  const m = c.monster;
  c.hp = Math.min(st.maxLife, c.hp + st.regen * dt);

  // buffs
  for (const k of Object.keys(c.buffs)) { c.buffs[k].t -= dt; if (c.buffs[k].t <= 0) delete c.buffs[k]; }
  if (c.shield) { c.shield.t -= dt; if (c.shield.t <= 0 || c.shield.v <= 0) c.shield = null; }
  const dmgBuff = 1 + (c.buffs.dmg ? c.buffs.dmg.v : 0) + (c.shield && c.shield.dmg ? c.shield.dmg : 0);
  const apsBuff = 1 + (c.buffs.aps ? c.buffs.aps.v : 0);
  if (m.expose) { m.expose.t -= dt; if (m.expose.t <= 0) m.expose = null; }
  const strike = (mult, eleBoost = 1, critBonus = 0, leechBonus = 0) => {
    const exposeMult = 1 + (m.expose ? m.expose.v : 0) + (m.frozen > 0 && m.brittle ? m.brittle : 0);
    let dmg = (rr(st.physMin, st.physMax) + rr(st.eleMin, st.eleMax) * eleBoost) * mult * dmgBuff * exposeMult;
    const crit = Math.random() * 100 < st.crit;
    dmg *= crit ? (st.critMulti + critBonus) / 100 : st.nonCritMult;
    m.hp -= dmg;
    c.hp = Math.min(st.maxLife, c.hp + st.lifeOnHit + dmg * (st.leech + leechBonus) / 100);
    ev && ev.push({ t: 'hit', dmg, crit, who: 'm' });
  };

  // player attacks
  c.pTimer += dt;
  const interval = 1 / (st.aps * apsBuff);
  while (c.pTimer >= interval && m.hp > 0) { c.pTimer -= interval; strike(1); }

  // active skills (auto-cast)
  const bar = state.skills.bar.slice(0, skillSlots(state.level));
  for (const id of bar) {
    if (!id || m.hp <= 0) continue;
    const sk = SKILL_BY_ID[id], rank = state.skills.ranks[id] || 1;
    const ef = skillEffective(sk, rank, state.skills.mods[id]);
    c.cds[id] = (c.cds[id] ?? ef.cooldown * 0.5) - dt;
    if (c.cds[id] > 0) continue;
    const p = ef.power;
    if (sk.kind === 'heal') {
      if (c.hp > st.maxLife * ef.thresh) { c.cds[id] = 0; continue; }
      c.hp = Math.min(st.maxLife, c.hp + st.maxLife * p);
      if (ef.dmgBuff) c.buffs.dmg = { v: Math.max(ef.dmgBuff, c.buffs.dmg ? c.buffs.dmg.v : 0), t: 4 };
      if (ef.shield) c.shield = { v: st.maxLife * ef.shield, t: 6, dmg: 0 };
    } else if (sk.kind === 'hit') {
      for (let n = 0; n < ef.casts; n++) for (let i = 0; i < ef.hits; i++) strike(p, sk.ele ? 2 : 1, ef.critm, ef.leech);
      if (ef.expose) m.expose = { v: ef.expose, t: ef.exposeDur };
    } else if (sk.kind === 'freeze') {
      for (let n = 0; n < ef.casts; n++) strike(p);
      m.frozen = ef.duration * (m.boss && !ef.bossFull ? 0.5 : 1);
      m.brittle = ef.brittle;
    } else if (sk.kind === 'shield') {
      c.shield = { v: st.maxLife * p, t: ef.duration, dmg: ef.shieldDmg };
    } else if (sk.kind === 'buff') {
      c.buffs[sk.stat] = { v: p, t: ef.duration };
    }
    if (ef.heal) c.hp = Math.min(st.maxLife, c.hp + st.maxLife * ef.heal);
    c.cds[id] = ef.cooldown;
    ev && ev.push({ t: 'skill', id });
  }
  if (m.hp <= 0) { onKill(state, m, ev); return; }

  // raid phases
  if (m.raid) {
    const ratio = m.hp / m.maxHp;
    const phase = ratio > 0.66 ? 1 : ratio > 0.33 ? 2 : 3;
    if (phase !== run.phase) {
      run.phase = phase;
      if (phase === 2) { m.interval *= 0.7; m.physShare = 0.3; }
      if (phase === 3) { m.dmg *= 1.35; m.slamEvery = 3.5; }
      ev && ev.push({ t: 'phase', phase });
    }
  }

  // monster attacks
  m.age += dt;
  if (m.frozen > 0) { m.frozen -= dt; return; }
  const enr = enrageMult(m);
  const hitPlayer = (raw, isSlam) => {
    if (Math.random() < evadeChance(st.evasion, m.acc, st.evadeCap)) { ev && ev.push({ t: 'evade' }); return false; }
    if (Math.random() * 100 < st.block) { ev && ev.push({ t: 'block' }); return false; }
    const phys = raw * m.physShare, ele = raw - phys;
    let dmg = phys * (1 - armourReduction(st.armour, phys)) + ele * (1 - st.resist / 100);
    if (c.shield) { const a = Math.min(c.shield.v, dmg); c.shield.v -= a; dmg -= a; }
    c.hp -= dmg;
    ev && ev.push({ t: 'hit', dmg, who: 'p', slam: isSlam });
    if (c.hp <= 0) { onDeath(state, ev); return true; }
    return false;
  };
  if (m.slamEvery) {
    m.slamTimer += dt;
    if (m.slamTimer >= m.slamEvery) {
      m.slamTimer = 0;
      ev && ev.push({ t: 'slam' });
      if (hitPlayer(m.dmg * 2.6 * enr * rr(0.9, 1.1), true)) return;
    }
  }
  m.timer += dt;
  while (m.timer >= m.interval) {
    m.timer -= m.interval;
    if (hitPlayer(m.dmg * enr * rr(0.8, 1.2), false)) return;
  }
}

function onDeath(state, ev) {
  const c = state.combat;
  state.deaths++;
  if (state.run) { endRun(state, false, ev, 'You died'); return; }
  c.hp = 0;
  c.respawn = 2;
  state.kills = 0;
  if (state.stage > 1) state.stage -= 1;
  state.pushBlocked = true;
  refreshStats(state);
  ev && ev.push({ t: 'death' });
}

function dropItems(state, n, ilvl, rarityBonus, minRarity, ev) {
  const st = state.combat.stats;
  for (let i = 0; i < n; i++) {
    let item = generateItem(ilvl, { rarityPct: st.rarity, rarityBonus });
    if (item.rarity < minRarity) item = generateItem(ilvl, { type: item.type, rarity: minRarity });
    handleLoot(state, item, ev);
  }
}

function onKill(state, m, ev) {
  const c = state.combat;
  const st = c.stats;
  const run = state.run;
  const lvl = combatLevel(state);
  if (!run) state.kills++;
  state.totalKills++;
  const mult = m.raid ? 40 : m.boss ? 6 : m.elite ? 2.5 : 1;
  const runMult = run ? 1.5 : 1;
  const diff = state.level - lvl;
  const pen = diff > 5 ? Math.max(0.05, 1 - (diff - 5) * 0.12) : 1;
  const xp = 3 * S(lvl) * mult * runMult * (1 + st.xpGain / 100) * pen;
  const gold = 1.2 * S(lvl) * mult * runMult * (1 + st.goldFind / 100) * rr(0.8, 1.2);
  state.gold += gold;
  gainXp(state, xp, ev);
  c.hp = Math.min(c.stats.maxLife, c.hp + c.stats.maxLife * 0.05);
  ev && ev.push({ t: 'kill', xp, gold, boss: m.boss });

  // ---- Raid boss ----
  if (m.raid) {
    dropItems(state, 1, lvl + 3, 0, 4, ev);                                        // 1 guaranteed Legendary+
    if (Math.random() < 0.1 + run.tier * 0.005) dropItems(state, 1, lvl + 3, 0, 5, ev); // Mythic chance
    dropItems(state, 3, lvl + 3, 300, 3, ev);                                      // 3 Epic+
    const shards = Math.ceil(150 * (1 + run.tier));
    state.shards += shards;
    state.raidsCleared[run.tier] = (state.raidsCleared[run.tier] || 0) + 1;
    state.keys += 1;
    endRun(state, true, ev, `+💠${shards} +🗝️1`);
    return;
  }
  // ---- Dungeon ----
  if (run && run.kind === 'dungeon') {
    if (m.boss) {
      dropItems(state, 4, lvl + 2, 300, 2, ev);                                    // 4 items, Rare+
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

  // ---- Campaign ----
  let drops = 0;
  if (m.boss) drops = 3;
  else if (m.elite) drops = 1 + (Math.random() < 0.4 ? 1 : 0);
  else if (Math.random() < 0.3) drops = 1;
  dropItems(state, drops, state.stage + (m.boss ? 2 : 0), m.boss ? 150 : m.elite ? 50 : 0, 0, ev);
  if (m.boss) {
    const zi = state.stage / STAGES_PER_ZONE;
    const first = !state.bossesBeaten[zi];
    state.bossesBeaten[zi] = (state.bossesBeaten[zi] || 0) + 1;
    if (first || Math.random() < 0.35) { state.keys++; ev && ev.push({ t: 'key', first }); }
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
    for (const sk of syncSkills(state)) ev && ev.push({ t: 'skillUnlock', sk });
    need = xpToNext(state.level);
    refreshStats(state);
  }
}

// Unlock skills for the current level and fill empty bar slots. Returns newly unlocked.
export function syncSkills(state) {
  const fresh = [];
  for (const sk of unlockedSkills(state.level)) {
    if (!state.skills.ranks[sk.id]) { state.skills.ranks[sk.id] = 1; fresh.push(sk); }
  }
  const slots = skillSlots(state.level);
  for (const sk of fresh) {
    const bar = state.skills.bar;
    for (let i = 0; i < slots; i++) if (!bar[i]) { bar[i] = sk.id; break; }
  }
  return fresh;
}

// Greedy allocator: picks the path (up to 4 nodes) with the best power gain per point.
export function autoAllocate(state, maxPoints = Infinity) {
  let spent = 0;
  while (treePointsFree(state) > 0 && spent < maxPoints) {
    const base = computeStats(state).power;
    const set = allocatedSet(state);
    let best = null, bestScore = 0;
    for (const id of Object.keys(NODES)) {
      if (set.has(id)) continue;
      const path = pathTo(state, id);
      if (!path.length || path.length > 4 || path.length > treePointsFree(state)) continue;
      const p = computeStats({ ...state, tree: [...state.tree, ...path] }).power;
      const score = (p / base - 1) / path.length;
      if (score > bestScore) { bestScore = score; best = path; }
    }
    if (!best) break;
    state.tree.push(best[0]);
    spent++;
  }
  if (spent) refreshStats(state);
  return spent;
}

export function logLoot(state, item, action) {
  state.lootLog.unshift({ name: item.name, rarity: item.rarity, ilvl: item.ilvl, action, type: item.type });
  if (state.lootLog.length > 30) state.lootLog.length = 30;
}

export function handleLoot(state, item, ev) {
  if (state.settings.autoEquip) {
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
  if (item.type === 'ring' && !slot) slot = !state.gear.ring1 ? 'ring1' : !state.gear.ring2 ? 'ring2' : 'ring1';
  slot = slot || item.type;
  const old = state.gear[slot];
  equip(state, item, slot);
  if (old) state.bag.unshift(old);
}

export function unequip(state, slot) {
  const it = state.gear[slot];
  if (!it) return;
  state.gear[slot] = null;
  state.bag.unshift(it);
  refreshStats(state);
}

// Run the game headlessly for `seconds` (offline progress / tests)
export function simulate(state, seconds, dt = 0.2) {
  const before = { gold: state.gold, level: state.level, shards: state.shards, maxStage: state.maxStage, kills: state.totalKills, keys: state.keys };
  const ev = [];
  let equips = 0, runsWon = 0, runsLost = 0;
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
    kills: state.totalKills - before.kills, equips, keys: state.keys - before.keys, runsWon, runsLost,
  };
}

export { RARITIES };
