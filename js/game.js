// Combat engine: solo hero vs packs, skills with automation rules, statuses, elites, multi-phase bosses,
// stage progression, activities, rewards and offline progress. Pure logic, no DOM.
import { S, REGIONS, STAGES_PER_REGION, WAVES_PER_STAGE, stageLevel, regionOf, MAX_STAGE, MONSTER_NAMES, ELITE_MODS, ELITE_KEYS, WORLD_TIERS, DUNGEONS, RIFT_MODS,
  GEM_KEYS, COMPANIONS, evoOf, LEVEL_CAP, OFFLINE_CAP_H, unlocked, CLASSES, INSCR_KEYS } from './data.js';
import { generateItem, makeInscription } from './items.js';
import { SKILLS, skillEff, STATUS } from './skills.js';
import { armourReduction, unlockedSlots } from './stats.js';
import { stats, gainXp, gain, handleLoot, unlockCompanion, addInscription, dirty } from './systems.js';

const ENV = globalThis.process?.env || {};
const T = { MHP: +(ENV.MHP || 8), HEXP: +(ENV.HEXP || 2.35), MDMG: +(ENV.MDMG || 4.5), DEXP: +(ENV.DEXP || 1.6), XP: +(ENV.XPK || 4), GOLD: 3 };
export const TUNE = T;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const BASIC_ELEM = { warrior: 'phys', mage: 'arcane', ranger: 'phys', warlock: 'shadow', paladin: 'holy' };
const COST = { primary: 8, defensive: 12, aoe: 18, secondary: 22, utility: 18, ultimate: 40 };
const ROLE_ORDER = ['defensive', 'ultimate', 'utility', 'secondary', 'aoe', 'primary'];
const hash = (s) => { let h = 7; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
const RES_ELEMS = ['fire', 'cold', 'lightning', 'arcane', 'shadow', 'holy', 'poison'];

// ---------------- positions ----------------
const RANGED_MON = new Set(['skelmage', 'banshee', 'wisp', 'siren', 'cultist', 'harpy', 'imp', 'angel']);
const HERO_RANGE = { warrior: 1.7, paladin: 1.7, ranger: 7, mage: 7, warlock: 6.5 };
export const heroRange = (state) => HERO_RANGE[state.cls] || 2;
export const HERO_SPEED = 4.2;
const distHE = (c, e) => Math.hypot(e.x - c.hero.x, e.z - c.hero.z);
const inRange = (state, c, e, extra = 0) => distHE(c, e) - e.r <= heroRange(state) + 0.3 + extra;
// packs arrive either ahead of you along the path (you run to them) or from all sides
export function place(c, list, o = {}) {
  const h = c.hero;
  const around = o.around ?? Math.random() < 0.45;
  if (!o.near) c.dir = (c.dir || 0) + rand(-0.8, 0.8);
  const cx = h.x + Math.cos(c.dir) * 9, cz = h.z + Math.sin(c.dir) * 9;
  list.forEach((e, i) => {
    if (e.x !== undefined) return;
    if (o.near) { const a = rand(0, 6.28); e.x = o.near.x + Math.cos(a) * 2.2; e.z = o.near.z + Math.sin(a) * 2.2; }
    else if (e.boss || e.vault || !around) { e.x = cx + (e.boss || e.vault ? 0 : rand(-2.5, 2.5)); e.z = cz + (e.boss || e.vault ? 0 : rand(-2.5, 2.5)); }
    else { const a = (i / list.length) * 6.28 + rand(-0.4, 0.4), d = rand(7, 9.5); e.x = h.x + Math.cos(a) * d; e.z = h.z + Math.sin(a) * d; }
    e.r = e.boss ? 1.3 : e.elite ? 0.7 : 0.5;
    e.range = e.boss ? 2.2 : RANGED_MON.has(e.art[1]) ? 5.5 : 1.1;
    e.speed = e.vault ? 0 : e.boss ? 1.9 : 2.6;
    e.face = Math.atan2(h.z - e.z, h.x - e.x);
  });
}
function moveStep(state, c, dt, alive) {
  const h = c.hero, inp = state.input;
  let dx = 0, dz = 0;
  h.moving = false; h.manual = false;
  if (inp && (inp.x || inp.z)) { dx = inp.x; dz = inp.z; h.manual = true; }
  else {
    const zone = state.rules.autoDodge !== false && c.zones.find((z) => Math.hypot(h.x - z.x, h.z - z.z) < z.r + 0.5);
    if (zone) { dx = h.x - zone.x; dz = h.z - zone.z; if (Math.abs(dx) + Math.abs(dz) < 0.01) dx = 1; }
    else {
      const t = target(state, c);
      if (t) {
        const g = distHE(c, t) - t.r;
        const close = heroRange(state) > 4 && c.enemies.find((e) => e.hp > 0 && (e.boss || e.elite) && !e.tele && distHE(c, e) - e.r < 2);
        if (close) { dx = h.x - close.x; dz = h.z - close.z; }   // ranged heroes back off from big melee threats
        else if (g > heroRange(state) * 0.9) { dx = t.x - h.x; dz = t.z - h.z; } else h.face = Math.atan2(t.z - h.z, t.x - h.x);
      }
    }
  }
  const l = Math.hypot(dx, dz);
  if (l > 0.01) { const sp = HERO_SPEED * dt * Math.min(1, l); h.x += (dx / l) * sp; h.z += (dz / l) * sp; h.face = Math.atan2(dz, dx); h.moving = true; }
  for (const e of alive) {
    e.moving = false;
    if (e.frozen > 0 || e.tele || !e.speed) continue;
    const d = distHE(c, e) || 0.01;
    e.face = Math.atan2(h.z - e.z, h.x - e.x);
    if (d - e.r - 0.4 > e.range) { const s = e.speed * (e.st.chill ? 0.6 : 1) * dt; e.x += ((h.x - e.x) / d) * s; e.z += ((h.z - e.z) / d) * s; e.moving = true; }
  }
  for (let i = 0; i < alive.length; i++) for (let j = i + 1; j < alive.length; j++) {
    const a = alive[i], b = alive[j], ddx = b.x - a.x, ddz = b.z - a.z, d = Math.hypot(ddx, ddz) || 0.01, min = a.r + b.r;
    if (d < min) { const p = (min - d) / 2 / d; if (a.speed) { a.x -= ddx * p; a.z -= ddz * p; } if (b.speed) { b.x += ddx * p; b.z += ddz * p; } }
  }
  for (const e of alive) { const ddx = h.x - e.x, ddz = h.z - e.z, d = Math.hypot(ddx, ddz) || 0.01, min = e.r + 0.4; if (d < min) { h.x += (ddx / d) * (min - d); h.z += (ddz / d) * (min - d); } }
}

export const ascMult = (state) => Math.pow(2, state.ascensions || 0);

// ---------------- enemies ----------------
export function makeEnemy(state, lvl, o = {}) {
  const tier = WORLD_TIERS[state.worldTier];
  const m = (o.tierMult ?? tier.mult) * ascMult(state) * (o.mult || 1);
  const sl = S(lvl);
  const art = o.art || ['monsters', 'skeleton'];
  const h = hash(art[1]);
  const res = { phys: 0.05 + (h % 4) * 0.05 };
  const strong = RES_ELEMS[h % 7], weak = RES_ELEMS[(h >> 3) % 7];
  res[strong] = 0.3; if (weak !== strong) res[weak] = -0.25;
  let hp = T.MHP * Math.pow(sl, T.HEXP) * m, dmg = T.MDMG * Math.pow(sl, T.DEXP) * Math.pow(m, 0.85), aspd = 0.8 + (h % 5) * 0.08;
  const mods = o.mods || [];
  if (o.boss) { hp *= o.raidBoss ? 26 : 16; dmg *= 2.6; aspd = 0.7; }
  if (mods.length) { hp *= 2.6; dmg *= 1.4; }
  if (mods.includes('tough')) hp *= 2;
  if (mods.includes('frenzied')) aspd *= 1.6;
  if (o.rm) { hp *= o.rm.hp || 1; dmg *= o.rm.dmg || 1; aspd *= o.rm.aspd || 1; }
  return {
    id: Math.random().toString(36).slice(2), name: o.name || MONSTER_NAMES[art[1]] || 'Monster', art, lvl, hp, maxHp: hp, dmg, aspd, atk: rand(0, 0.6),
    res, mods, boss: !!o.boss, elite: mods.length > 0, mech: o.mech || [], phaseNames: o.phaseNames || [], phase: 0, tele: null, mechT: { slam: 4, breath: 5, adds: 6, storm: 7, shield: 9, ultimate: 3 },
    shieldT: 0, st: {}, frozen: 0, summonT: 6, age: 0, xp: (o.boss ? 12 : mods.length ? 3 : 1), gold: (o.boss ? 15 : mods.length ? 3 : 1),
  };
}

function regionPack(state, stage, waveIdx, rm) {
  const r = REGIONS[regionOf(stage)];
  const lvl = stageLevel(stage);
  const bossStage = stage % STAGES_PER_REGION === 0;
  if (bossStage && waveIdx === WAVES_PER_STAGE - 1) {
    const b = r.boss;
    return [makeEnemy(state, lvl + 2, { boss: true, art: b.art, name: b.name, mech: b.mech, phaseNames: b.phaseNames })];
  }
  const n = stage < 3 ? 1 + (waveIdx > 1 ? 1 : 0) : 2 + (Math.random() < 0.5 ? 1 : 0) + (rm?.pack || 0);
  return Array.from({ length: n }, () => {
    const id = pick(r.monsters);
    const mods = (rm?.allElite || Math.random() < 0.07 + Math.min(0.08, stage / 1000)) ? rollMods(stage) : [];
    return makeEnemy(state, lvl, { art: ['monsters', id], mods, rm });
  });
}
const rollMods = (lvl) => { const n = lvl > 40 ? 2 : 1; const out = []; while (out.length < n) { const k = pick(ELITE_KEYS); if (!out.includes(k)) out.push(k); } return out; };

// ---------------- combat state ----------------
export function newCombat(state) {
  const st = stats(state);
  return {
    st, t: 0, hero: { hp: st.hp, shield: 0, res: 50, cds: {}, gcd: 0, buffs: [], dodge: 0, atk: 0, dead: 0, dots: [], hits: 0, soul: [], minions: [], petT: 1, smiteT: 4, phoenixT: 5, corrupt: 0, castFlash: null, x: 0, z: 0, face: 0, moving: false },
    enemies: [], zones: [], dir: 0, wave: 0, waves: WAVES_PER_STAGE, pause: 0.6, events: [], kills: 0, failed: false,
  };
}
export function ensureCombat(state) {
  if (!state.combat) state.combat = newCombat(state);
  return state.combat;
}
export function refreshStats(state) {
  const c = ensureCombat(state);
  const old = c.st;
  c.st = stats(state);
  if (old && old.hp) c.hero.hp = Math.min(c.st.hp, c.hero.hp * (c.st.hp / old.hp));
}
const ev = (c, e) => { if (c.events.length < 200) c.events.push(e); };

// ---------------- stage flow ----------------
export function setStage(state, stage) {
  state.stage = Math.max(1, Math.min(stage, state.maxStage, MAX_STAGE));
  const c = ensureCombat(state); c.enemies = []; c.wave = 0; c.pause = 0.5;
}
function spawnWave(state, c) {
  const r = state.run;
  c.zones = [];
  if (r) { c.enemies = runPack(state, r, c.wave); place(c, c.enemies); return; }
  c.waves = WAVES_PER_STAGE;
  c.enemies = regionPack(state, state.stage, c.wave);
  place(c, c.enemies);
  ev(c, { t: 'wave', wave: c.wave, boss: c.enemies.some((e) => e.boss) });
}

// ---------------- activities ----------------
export function runLevel(state, kind, key, tier) {
  const hl = Math.min(state.level, LEVEL_CAP);
  switch (kind) {
    case 'dungeon': return 25 + tier * 5;
    case 'caverns': return Math.max(5, hl);
    case 'bossrush': return Math.max(10, hl);
    case 'vault': return Math.max(5, hl);
    case 'tower': return Math.round(3 + tier * 1.1);
    case 'rift': return Math.max(40, hl) + tier * 2;
  }
  return hl;
}
export function startRun(state, kind, key = null, tier = 1) {
  if (state.run) return false;
  const run = { kind, key, tier, lvl: runLevel(state, kind, key, tier), wave: 0, t: 0, kills: 0, loot: [], mats: {}, gold: 0, gems: [], ins: [], done: false, res: null };
  if (kind === 'dungeon') run.waves = (DUNGEONS[key].mech === 'waves' ? 7 : 5) + 1;
  if (kind === 'caverns') run.waves = 6;
  if (kind === 'vault') { run.waves = 1; run.timeLimit = 45; }
  if (kind === 'tower') { run.waves = 999; run.floor = tier; }
  if (kind === 'bossrush') { run.bosses = Object.keys(state.bossesBeaten).map(Number).sort((a, b) => a - b); run.waves = run.bosses.length; if (!run.waves) return false; }
  if (kind === 'rift') {
    run.waves = 7; const n = 2 + (tier > 10 ? 1 : 0); run.modList = [];
    const pool = [...RIFT_MODS];
    while (run.modList.length < n) { const m = pool.splice(Math.floor(Math.random() * pool.length), 1)[0]; run.modList.push(m); }
    run.mods = Object.assign({}, ...run.modList.map((m) => m.m));
  }
  state.run = run;
  dirty(state);
  const c = ensureCombat(state);
  refreshStats(state);
  c.enemies = []; c.wave = 0; c.pause = 0.8; c.waves = run.waves; c.hero.hp = c.st.hp; c.hero.cds = {}; c.hero.dots = []; c.hero.corrupt = 0;
  ev(c, { t: 'runStart', kind, key });
  return true;
}
function runPack(state, r, w) {
  const L = r.lvl;
  const tm = WORLD_TIERS[state.worldTier].mult;
  if (r.kind === 'dungeon') {
    const d = DUNGEONS[r.key];
    if (w === r.waves - 1) return [makeEnemy(state, L + 2, { boss: true, art: d.boss, name: d.bossName, mech: d.mech === 'breath' ? ['breath', 'storm', 'enrage', 'ultimate'] : ['slam', 'adds', 'enrage', 'ultimate'], phaseNames: ['Guardian', 'Awakened', 'Enraged', 'Final Stand'] })];
    return Array.from({ length: 3 }, () => makeEnemy(state, L, { art: ['monsters', pick(d.monsters)], mods: Math.random() < 0.15 ? rollMods(L) : [] }));
  }
  if (r.kind === 'caverns') return Array.from({ length: 2 + (w % 2) }, () => makeEnemy(state, L, { art: ['monsters', pick(['sungolem', 'rockgolem', 'wisp'])], name: 'Crystal Golem', mult: 1.2 }));
  if (r.kind === 'vault') { const e = makeEnemy(state, L, { art: ['monsters', 'sungolem'], name: 'Treasure Golem', mult: 60 }); e.dmg *= 0.02; e.vault = true; e.maxHp = e.hp; return [e]; }
  if (r.kind === 'bossrush') { const ri = r.bosses[w]; const b = REGIONS[ri].boss; return [makeEnemy(state, Math.max(L, stageLevel((ri + 1) * 10)), { boss: true, art: b.art, name: b.name, mech: b.mech, phaseNames: b.phaseNames, mult: 0.8 })]; }
  if (r.kind === 'tower') {
    const f = r.floor; const lvl = Math.round(3 + f * 1.1);
    if (f % 5 === 0) { const ri = Math.min(9, Math.floor(f / 10) % 10); const b = REGIONS[ri].boss; return [makeEnemy(state, lvl, { boss: true, art: b.art, name: `${b.name} (Floor ${f})`, mech: b.mech, phaseNames: b.phaseNames, tierMult: 1 })]; }
    const reg = REGIONS[Math.min(9, Math.floor(f / 8) % 10)];
    return Array.from({ length: 3 }, () => makeEnemy(state, lvl, { art: ['monsters', pick(reg.monsters)], tierMult: 1, mods: Math.random() < 0.15 ? rollMods(lvl) : [] }));
  }
  if (r.kind === 'rift') {
    const reg = REGIONS[(r.tier + w) % 10];
    if (w === r.waves - 1) { const b = REGIONS[r.tier % 10].boss; return [makeEnemy(state, L + 2, { boss: true, art: b.art, name: `Rift ${b.name}`, mech: b.mech, phaseNames: b.phaseNames, rm: r.mods })]; }
    return Array.from({ length: 3 + (r.mods.pack || 0) }, () => makeEnemy(state, L, { art: ['monsters', pick(reg.monsters)], rm: r.mods, mods: r.mods.allElite || Math.random() < 0.2 ? rollMods(L) : [] }));
  }
  return [makeEnemy(state, L, { tierMult: tm })];
}

function finishRun(state, c, win) {
  const r = state.run;
  r.done = true; r.win = win;
  const L = r.lvl + WORLD_TIERS[state.worldTier].ilvl;
  const mf = stats(state).mf + WORLD_TIERS[state.worldTier].mf;
  const ancient = WORLD_TIERS[state.worldTier].ancient;
  const addItem = (opts) => { const it = generateItem(L, { cls: state.cls, mf, ancient, ...opts }); r.loot.push({ it, res: handleLoot(state, it) }); };
  const addMats = (m) => { gain(state, m); for (const [k, v] of Object.entries(m)) r.mats[k] = (r.mats[k] || 0) + v; };
  if (r.kind === 'dungeon') {
    const d = DUNGEONS[r.key];
    if (win) {
      const n = 4 + Math.floor(r.tier / 4);
      for (let i = 0; i < n; i++) addItem({ slot: d.slots ? pick(d.slots) : undefined, minRarity: 2, forceLeg: r.key === 'lair' && Math.random() < 0.3 });
      addMats({ dust: 6 + r.tier, [L >= 50 ? 'mythril' : 'iron']: 4 + r.tier, ...(d.mats ? { [d.mats[0]]: 3 + Math.floor(r.tier / 2) } : {}) });
      if (r.tier >= (state.dungeonTier[r.key] || 1)) state.dungeonTier[r.key] = r.tier + 1;
    }
  } else if (r.kind === 'caverns') {
    if (win) {
      const tierMax = Math.min(3, Math.floor(r.lvl / 25));
      for (let i = 0; i < 4; i++) { const g = pick(GEM_KEYS) + Math.floor(Math.random() * (tierMax + 1)); state.gems[g] = (state.gems[g] || 0) + 1; r.gems.push(g); }
      addMats({ iron: 8, mythril: r.lvl >= 40 ? 6 : 0, dust: 12 });
    }
  } else if (r.kind === 'bossrush') {
    const n = c.bossKills || 0;
    addMats({ essence: n * 2, cores: r.lvl >= 60 ? Math.floor(n / 3) : 0 });
    if (unlocked(state, 'inscriptions')) for (let i = 0; i < Math.ceil(n / 3); i++) { const ins = makeInscription(L); addInscription(state, ins); r.ins.push(ins); }
    state.rushBest = Math.max(state.rushBest, n);
  } else if (r.kind === 'vault') {
    const e = c.vaultHp;
    const frac = e ? Math.min(1, 1 - e.hp / e.maxHp) : 0;
    const g = Math.round(T.GOLD * S(r.lvl) * 260 * (0.2 + frac) * (1 + stats(state).gold / 100));
    state.gold += g; r.gold += g;
  } else if (r.kind === 'tower') {
    const best = r.floor - 1;
    if (best > state.towerBest) state.towerBest = best;
    while (state.towerClaimed + 10 <= state.towerBest) {
      state.towerClaimed += 10;
      const f = state.towerClaimed;
      addMats({ essence: 3 + f / 5, cores: f >= 30 ? Math.floor(f / 15) : 0, mythril: f / 2 });
      addItem({ minRarity: 3, forceLeg: f >= 40 });
      if (f >= 30) unlockCompanion(state, 'phoenix');
    }
  } else if (r.kind === 'rift') {
    if (win) {
      const n = 3 + r.modList.reduce((s, m) => s + Math.max(0, m.w), 0);
      for (let i = 0; i < n; i++) addItem({ minRarity: 2 });
      addMats({ void: 3 + r.tier, dust: 8 });
      if (unlocked(state, 'inscriptions')) { const ins = makeInscription(L); addInscription(state, ins); r.ins.push(ins); }
      if (r.tier >= state.riftLevel) state.riftLevel = r.tier + 1;
      state.riftBest = Math.max(state.riftBest, r.tier);
    }
  }
  ev(c, { t: 'runEnd', win, run: r });
}
export function leaveRun(state) {
  const c = ensureCombat(state);
  state.run = null; dirty(state); refreshStats(state);
  c.enemies = []; c.wave = 0; c.pause = 0.6; c.hero.hp = c.st.hp; c.hero.dots = [];
}

// ---------------- the tick ----------------
export function tick(state, dt) {
  const c = ensureCombat(state);
  if (state._stDirty) refreshStats(state);
  c.t += dt;
  state.totals.time += dt;
  const h = c.hero, st = c.st, r = state.run;
  if (r?.done) return;
  if (r) {
    r.t += dt;
    if (r.timeLimit && r.t >= r.timeLimit) { finishRun(state, c, true); return; }
  }
  // hero death
  if (h.dead > 0) {
    h.dead -= dt;
    if (h.dead <= 0) { h.hp = st.hp; h.shield = 0; h.dots = []; h.corrupt = 0; c.pause = 0.4; c.enemies = []; c.wave = 0; }
    return;
  }
  // wave flow
  const alive = c.enemies.filter((e) => e.hp > 0);
  if (!alive.length) {
    if (c.pause > 0) { c.pause -= dt; regenHero(state, c, dt * 3); return; }
    spawnWave(state, c);
    c.pause = 0.5;
    return;
  }
  if (alive.some((e) => e.x === undefined)) place(c, alive.filter((e) => e.x === undefined), { near: c.hero, around: true });
  c.zones = c.zones.filter((z) => c.enemies.some((e) => e.id === z.owner && e.hp > 0 && e.tele));
  moveStep(state, c, dt, alive);
  // buffs
  const B = { more: 0, aspd: 0, crit: 0, critDmg: 0, leech: 0, dr: 0, thorns: 0, petDmg: 0, fire: 0, hpRegenPct: 0 };
  h.buffs = h.buffs.filter((b) => (b.t -= dt) > 0);
  for (const b of h.buffs) for (const [k, v] of Object.entries(b.s)) B[k] = (B[k] || 0) + v;
  const soulN = h.soul.filter((t) => t > c.t).length; h.soul = h.soul.filter((t) => t > c.t);
  B.more += soulN * 3;
  c.B = B;
  regenHero(state, c, dt);
  // dungeon mechanics on the hero
  if (r?.kind === 'dungeon') {
    const m = DUNGEONS[r.key].mech;
    if (m === 'burn') damageHero(state, c, alive[0].dmg * 0.15 * dt, 'fire', null, true);
    if (m === 'corrupt') { h.corrupt += dt * 0.02; damageHero(state, c, alive[0].dmg * h.corrupt * dt, 'shadow', null, true); }
  }
  // hero dots
  h.dots = h.dots.filter((d) => (d.t -= dt) > 0);
  for (const d of h.dots) damageHero(state, c, d.dps * dt, d.elem, null, true);
  if (h.dead > 0) return;

  // ---- skills (automation rules) ----
  for (const role of Object.keys(h.cds)) h.cds[role] = Math.max(0, h.cds[role] - dt * (1 + (r?.mods?.heroCdr || 0) / 100));
  h.gcd = Math.max(0, h.gcd - dt);
  h.res = Math.min(100, h.res + st.regen * dt);
  if (h.gcd <= 0) {
    for (const role of ROLE_ORDER) {
      const id = state.skills[role];
      if (!id || !unlockedSlots(state).includes(role) || (h.cds[role] || 0) > 0) continue;
      const sk = skillEff(SKILLS[id], state.skillRanks[id] || 1, !!state.awakenedSkills[id]);
      if (h.res < COST[role]) continue;
      if (!wantCast(state, c, role, sk, alive)) continue;
      h.res -= COST[role];
      h.cds[role] = sk.cd * (1 - st.cdr / 100);
      castSkill(state, c, role, sk, alive);
      if (st.doubleCast && Math.random() * 100 < st.doubleCast && role !== 'defensive') castSkill(state, c, role, sk, c.enemies.filter((e) => e.hp > 0), true);
      h.gcd = 0.35;
      break;
    }
  }
  // ---- basic attack ----
  let aspd = st.aspd * (1 + B.aspd / 100);
  if (h.hp < st.hp * 0.5) aspd *= 1 + st.furyAspd / 100;
  if (r?.kind === 'dungeon' && DUNGEONS[r.key].mech === 'chill') aspd *= 0.75;
  h.atk = Math.min(1.2, h.atk + dt * aspd);
  const btgt = target(state, c);
  if (h.atk >= 1 && btgt && inRange(state, c, btgt)) {
    h.atk -= 1;
    const tgt = btgt;
    ev(c, { t: 'swing', id: tgt.id });
    {
      h.hits++;
      const fifth = st.flags.has('fifth') && h.hits % 5 === 0;
      const elem = BASIC_ELEM[state.cls];
      hit(state, c, tgt, fifth ? 3 : 1, elem, { basic: true, st: st.flags.has('ignite') ? 'burn' : null });
      h.res = Math.min(100, h.res + 4);
      if (st.flags.has('chain')) { const o = c.enemies.find((e) => e.hp > 0 && e !== tgt); if (o) hit(state, c, o, 0.5, elem, { basic: true, noProc: true }); }
      if (st.flags.has('blaze') && Math.random() < 0.15) { ev(c, { t: 'blaze' }); for (const e of c.enemies.filter((x) => x.hp > 0)) hit(state, c, e, 1.2, 'fire', { noProc: true }); }
    }
  }
  // ---- companion ----
  const comp = state.companions.active;
  if (comp) {
    h.petT -= dt;
    if (h.petT <= 0) {
      h.petT = 1.6;
      const tgt = target(state, c);
      const lvl = state.companions.levels[comp] || 1;
      if (tgt) { hit(state, c, tgt, 0.35 * evoOf(lvl).mult * (1 + lvl * 0.02) * (1 + (st.petDmg + B.petDmg) / 100), COMPANIONS[comp].stat === 'ele' ? 'fire' : 'phys', { pet: true, noProc: true }); ev(c, { t: 'pet' }); }
    }
  }
  if (st.healEvery) { h.phoenixT -= dt; if (h.phoenixT <= 0) { h.phoenixT = 5; heal(state, c, st.hp * st.healEvery / 100, 'phoenix'); } }
  if (st.flags.has('smite')) { h.smiteT -= dt; if (h.smiteT <= 0) { h.smiteT = 4; ev(c, { t: 'smite' }); for (const e of c.enemies.filter((x) => x.hp > 0)) hit(state, c, e, 0.8, 'holy', { noProc: true }); } }
  // ---- minions ----
  h.minions = h.minions.filter((m) => (m.t -= dt) > 0);
  for (const m of h.minions) {
    m.at -= dt;
    if (m.at > 0) continue;
    m.at = m.kind === 'infernal' ? 1.5 : 1.2;
    const coef = { skeleton: 0.3, demon: 1.1, infernal: 1.6 }[m.kind] * (1 + st.minionDmg / 100);
    if (m.kind === 'infernal') { for (const e of c.enemies.filter((x) => x.hp > 0)) hit(state, c, e, coef, 'fire', { minion: true, noProc: true }); }
    else { const tg = target(state, c); if (tg) hit(state, c, tg, coef, m.kind === 'demon' ? 'fire' : 'shadow', { minion: true, noProc: true }); }
  }

  // ---- enemies ----
  for (const e of c.enemies) {
    if (e.hp <= 0) continue;
    e.age += dt;
    // statuses
    for (const [k, s] of Object.entries(e.st)) {
      s.t -= dt;
      if (s.dps) dealRaw(state, c, e, s.dps * (k === 'poison' ? s.n : 1) * dt, k === 'bleed' ? 'phys' : k === 'burn' ? 'fire' : 'poison', true);
      if (s.t <= 0) delete e.st[k];
    }
    if (e.hp <= 0) continue;
    if (e.mods.includes('regen')) e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.02 * dt);
    if (e.mods.includes('summoner')) { e.summonT -= dt; if (e.summonT <= 0 && c.enemies.length < 6) { e.summonT = 7; c.enemies.push(makeEnemy(state, e.lvl, { art: ['monsters', 'skeleton'], name: 'Summoned Skeleton', mult: 0.3 })); place(c, c.enemies, { near: e }); ev(c, { t: 'summon' }); } }
    if (e.frozen > 0) { e.frozen -= dt; continue; }
    if (e.boss) bossMechanics(state, c, e, dt);
    if (e.tele) continue;
    let rate = e.aspd * (e.st.chill ? 0.65 : 1) * (e.enraged ? 1.5 : 1);
    if (distHE(c, e) - e.r - 0.4 > e.range + 0.3) { e.atk = Math.min(e.atk, 0.6); continue; }
    e.atk += dt * rate;
    if (e.atk >= 1) {
      e.atk -= 1;
      let dmg = e.dmg * (e.st.weaken ? 0.75 : 1) * (e.enraged ? 1.5 : 1) * rand(0.85, 1.15);
      const elem = e.boss || hash(e.art[1]) % 3 === 0 ? pick(['fire', 'cold', 'lightning', 'shadow']) : 'phys';
      damageHero(state, c, dmg, elem, e);
      if (e.mods.includes('venomous')) h.dots.push({ t: 4, dps: e.dmg * 0.15, elem: 'poison' });
      ev(c, { t: 'eatk', id: e.id });
      if (h.dead > 0) return;
    }
  }
  // wave cleared?
  if (!c.enemies.some((e) => e.hp > 0)) waveCleared(state, c);
}

function wantCast(state, c, role, sk, alive) {
  const h = c.hero, st = c.st, R = state.rules;
  const t0 = target(state, c);
  if ((role === 'primary' || role === 'secondary') && sk.coef && !(t0 && inRange(state, c, t0, 0.5))) return false;
  if ((role === 'aoe' || role === 'ultimate') && sk.coef && !(t0 && inRange(state, c, t0, 2.5))) return false;
  const hpk = h.hp / st.hp;
  const boss = alive.some((e) => e.boss), elite = alive.some((e) => e.elite);
  const tele = alive.some((e) => e.tele && e.tele.t < 0.9);
  if (role === 'defensive') {
    const mitigates = sk.dodge || sk.dr || sk.shield;
    if (R.saveDef && mitigates && tele) return true;
    if (sk.heal && hpk * 100 < R.heal) return true;
    if (mitigates && !R.saveDef && hpk * 100 < R.heal) return true;
    return mitigates && hpk * 100 < R.heal * 0.5;
  }
  if (role === 'ultimate') return R.ult === 'always' || boss || (R.ult === 'elite' && elite);
  if (role === 'aoe') return alive.length >= R.aoeMin || (alive.length === 1 && !state.skills.primary);
  if (role === 'utility') {
    if (sk.summon) return h.minions.filter((m) => m.kind === sk.summon).length < 1;
    return true;
  }
  return true;
}

function castSkill(state, c, role, sk, alive, echo = false) {
  const h = c.hero, st = c.st;
  const durMult = 1 + st.buffDur / 100;
  ev(c, { t: 'cast', id: sk.id, role, elem: sk.elem, echo });
  if (sk.heal) heal(state, c, st.hp * sk.heal / 100 * (1 + st.healPct / 100), sk.id);
  if (sk.shield) h.shield = Math.max(h.shield, st.hp * sk.shield / 100 * (1 + st.shieldPct / 100));
  if (sk.dr) h.buffs.push({ s: { dr: sk.dr }, t: sk.dur || 5, src: sk.id });
  if (sk.dodge) h.dodge = 1;
  if (sk.buff) h.buffs.push({ s: sk.buff, t: (sk.dur || 8) * durMult, src: sk.id });
  if (sk.reset) for (const k of Object.keys(h.cds)) if (k !== role) h.cds[k] *= sk.reset;
  if (sk.summon) {
    const max = (sk.n || 1) + (sk.summon === 'skeleton' ? st.minionMax : 0);
    h.minions = h.minions.filter((m) => m.kind !== sk.summon);
    for (let i = 0; i < max; i++) h.minions.push({ kind: sk.summon, t: sk.dur * durMult, at: 0.3 + i * 0.2 });
  }
  if (sk.debuff) for (const e of alive) { applyStatus(state, c, e, sk.debuff, 0); if (sk.debuff2) applyStatus(state, c, e, sk.debuff2, 0); }
  if (!sk.coef) return;
  const t0 = target(state, c);
  const targets = !t0 ? [] : sk.aoe ? alive.filter((e) => (role === 'ultimate' ? distHE(c, e) < 11 : Math.hypot(e.x - t0.x, e.z - t0.z) < 4.5)) : [t0];
  ev(c, { t: 'skillHit', id: sk.id, role, elem: sk.elem, ids: targets.map((e) => e.id) });
  for (const e of targets) {
    for (let i = 0; i < sk.hits; i++) {
      if (e.hp <= 0) break;
      const ultBoss = role === 'ultimate' && e.boss && st.flags.has('ultBoss') ? 1.8 : 1;
      const dealt = hit(state, c, e, sk.coef * ultBoss, sk.elem, { skill: sk, tree: sk.tree, critBonus: sk.critBonus, execute: sk.execute, scaleArmour: sk.scaleArmour, st: sk.st, stCh: sk.stCh, stacks: sk.stacks });
      if (sk.leechHit) heal(state, c, dealt * sk.leechHit / 100, null, true);
    }
  }
  if (sk.pet && state.companions.active) { const t = target(state, c); if (t) hit(state, c, t, 1.2 * (1 + st.petDmg / 100), 'phys', { pet: true, noProc: true }); }
  if (sk.minion) for (const m of h.minions) { const t = target(state, c); if (t) hit(state, c, t, 0.3 * (1 + st.minionDmg / 100), 'shadow', { minion: true, noProc: true }); }
  if (sk.minionBoost) for (const m of h.minions) m.t += 2;
}

function target(state, c) {
  const alive = c.enemies.filter((e) => e.hp > 0);
  if (!alive.length) return null;
  switch (state.rules.target) {
    case 'highest': return alive.reduce((a, b) => (b.hp > a.hp ? b : a));
    case 'elite': return alive.find((e) => e.boss || e.elite) || alive.reduce((a, b) => (b.hp < a.hp ? b : a));
    case 'first': return alive[0];
    default: return alive.reduce((a, b) => (b.hp < a.hp ? b : a));
  }
}

// outgoing damage with every multiplier
function hit(state, c, e, coef, elem, o = {}) {
  const st = c.st, B = c.B || {}, h = c.hero;
  let base = st.attack * coef;
  if (o.scaleArmour) base += st.armour * 0.12 * coef;
  let inc = st.typePct + (st.elem[elem] || 0) + (o.tree ? st.treeDmg[o.tree] || 0 : 0) + (elem === 'fire' ? B.fire || 0 : 0) + (o.skill ? 0 : 0);
  let mult = (1 + inc / 100) * st.more * (1 + (B.more || 0) / 100);
  if (h.hp < st.hp * 0.5) mult *= 1 + st.frenzy / 100;
  if (e.boss) mult *= 1 + st.boss / 100; else if (e.elite) mult *= 1 + st.elite / 100;
  if (e.st.vuln) mult *= 1 + st.vulnPct / 100;
  if (e.st.shock) mult *= 1.2;
  if (e.frozen > 0 && st.frozenTaken) mult *= 1 + st.frozenTaken / 100;
  if (e.hp < e.maxHp * 0.3) mult *= 1 + (st.execute + (o.execute || 0)) / 100;
  const critCh = st.crit + (B.crit || 0) + (o.critBonus || 0);
  const crit = Math.random() * 100 < critCh;
  if (crit) mult *= 1 + (st.critDmg + (B.critDmg || 0) + (e.st.poison ? st.poisonCrit : 0)) / 100;
  if (e.shieldT > 0) mult *= 0.1;
  const dmg = base * mult * (1 - (e.res[elem] || 0)) * rand(0.92, 1.08);
  const dealt = dealRaw(state, c, e, dmg, elem, false, crit, o);
  // statuses
  if (o.st && (!o.stCh || Math.random() < o.stCh)) applyStatus(state, c, e, o.st, dmg, o.stacks || 1);
  if (!o.noProc) {
    if (st.freezeChance && Math.random() * 100 < st.freezeChance) applyStatus(state, c, e, 'freeze', dmg);
    if (crit && st.flags.has('critHeal')) heal(state, c, st.hp * 0.015, null, true);
    if (crit && st.flags.has('critChain')) for (const o2 of c.enemies.filter((x) => x.hp > 0 && x !== e)) dealRaw(state, c, o2, dmg * 0.3, 'lightning', false, false, { chain: true });
  }
  const leech = st.leech + (B.leech || 0);
  if (leech) heal(state, c, dealt * leech / 100, null, true);
  return dealt;
}
function applyStatus(state, c, e, k, dmg, stacks = 1) {
  const st = c.st;
  const d = STATUS[k];
  if (k === 'freeze') { e.frozen = Math.max(e.frozen, e.boss ? 0.5 : d.dur); ev(c, { t: 'status', id: e.id, k }); return; }
  const cur = e.st[k];
  const dur = d.dur * (k === 'chill' ? 1 + st.chillDur / 100 : 1);
  if (k === 'burn') e.st.burn = { t: dur, dps: Math.max(cur?.dps || 0, dmg * 0.3 * (1 + st.burnDmg / 100)) };
  else if (k === 'bleed') e.st.bleed = { t: dur, dps: Math.max(cur?.dps || 0, dmg * 0.25 * (1 + st.bleedDmg / 100)) };
  else if (k === 'poison') e.st.poison = { t: dur, dps: Math.max(cur?.dps || 0, dmg * 0.07 * (1 + st.poisonDmg / 100)), n: Math.min(10, (cur?.n || 0) + stacks) };
  else e.st[k] = { t: dur };
  if (!cur) ev(c, { t: 'status', id: e.id, k });
}
function dealRaw(state, c, e, dmg, elem, dot, crit, o = {}) {
  if (e.hp <= 0) return 0;
  const d = Math.min(e.hp, dmg);
  e.hp -= dmg;
  if (!dot || Math.random() < 0.15) ev(c, { t: 'hit', id: e.id, dmg, crit, elem, dot, pet: o.pet, minion: o.minion });
  if (e.hp <= 0) kill(state, c, e);
  return d;
}
function heal(state, c, n, src, quiet) {
  const h = c.hero;
  const before = h.hp;
  h.hp = Math.min(c.st.hp, h.hp + n);
  if (!quiet && h.hp - before > 0) ev(c, { t: 'heal', n: h.hp - before, src });
}
function regenHero(state, c, dt) {
  const st = c.st, h = c.hero;
  const pct = st.hpRegen + (c.B?.hpRegenPct || 0) + 0.5;
  h.hp = Math.min(st.hp, h.hp + st.hp * pct / 100 * dt);
}
function damageHero(state, c, raw, elem, src, dot) {
  const h = c.hero, st = c.st;
  if (!dot && h.dodge && src?.tele) { h.dodge = 0; ev(c, { t: 'dodge' }); return; }
  let d = raw;
  const lvl = src?.lvl || st.lv;
  if (elem === 'phys') d *= 1 - armourReduction(st.armour, lvl);
  else d *= 1 - st.resist / 100;
  d *= 1 - Math.min(80, st.dr + (c.B?.dr || 0)) / 100;
  if (st.flags.has('laststand') && h.hp < st.hp * 0.3) d *= 0.7;
  if (h.shield > 0) { const a = Math.min(h.shield, d); h.shield -= a; d -= a; }
  h.hp -= d;
  if (!dot) ev(c, { t: 'hurt', dmg: d, big: !!src?.tele });
  const thorns = st.thorns + (c.B?.thorns || 0);
  if (src && thorns && src.hp > 0) dealRaw(state, c, src, raw * thorns / 100, 'phys', true);
  if (h.hp <= 0) heroDied(state, c);
}
function heroDied(state, c) {
  const h = c.hero;
  h.hp = 0; h.dead = 3; h.buffs = []; h.minions = []; h.shield = 0;
  state.totals.deaths++;
  ev(c, { t: 'death' });
  if (state.run) { finishRun(state, c, false); return; }
  // farm the previous stage, retry later
  if (state.stage > 1) { state.stage--; state.retryIn = 12; }
}

function kill(state, c, e) {
  const st = c.st, h = c.hero, r = state.run;
  c.kills++; state.totals.kills++;
  ev(c, { t: 'kill', id: e.id, boss: e.boss });
  if (st.flags.has('killCdr')) for (const k of Object.keys(h.cds)) h.cds[k] = Math.max(0, h.cds[k] - 1);
  if (st.flags.has('soul')) { h.soul.push(c.t + 10); if (h.soul.length > 10) h.soul.shift(); }
  if (st.killHeal) heal(state, c, st.hp * st.killHeal / 100, null, true);
  if (e.st.burn && st.flags.has('burnExplode')) { ev(c, { t: 'explode', id: e.id }); for (const o of c.enemies.filter((x) => x.hp > 0)) dealRaw(state, c, o, e.maxHp * 0.25, 'fire', false); }
  if (e.mods.includes('explosive')) damageHero(state, c, e.dmg * 2, 'fire', null);
  if (e.vault) { c.vaultHp = e; return; }
  if (e.boss) { state.totals.bosses++; c.bossKills = (c.bossKills || 0) + 1; }
  // rewards
  const L = e.lvl;
  const xp = T.XP * Math.pow(S(L), 1.25) * e.xp * (r ? 1.5 : 1);
  const ups = gainXp(state, xp);
  if (ups.length) { ev(c, { t: 'level', ups }); refreshStats(state); h.hp = c.st.hp; }
  const gold = Math.round(T.GOLD * S(L) * e.gold * rand(0.8, 1.2) * (1 + st.gold / 100));
  state.gold += gold;
  if (r) r.gold += gold;
  if (r && ['dungeon', 'caverns', 'rift', 'bossrush', 'tower'].includes(r.kind)) { r.kills++; return; }
  // region loot
  const tier = WORLD_TIERS[state.worldTier];
  const ilvl = L + tier.ilvl;
  const ch = e.boss ? 1 : e.elite ? 0.4 : 0.07;
  const reg = REGIONS[regionOf(state.stage)];
  if (Math.random() < ch) {
    const n = e.boss ? 2 + (state.stage % 10 === 0 ? 1 : 0) : 1;
    for (let i = 0; i < n; i++) {
      const it = generateItem(ilvl, { cls: state.cls, mf: st.mf + tier.mf, ancient: tier.ancient, minRarity: e.boss ? 2 : e.elite ? 1 : 0 });
      const res = handleLoot(state, it);
      ev(c, { t: 'loot', rarity: it.rarity, res, name: it.name });
    }
  }
  if (Math.random() < (e.boss ? 1 : 0.12)) { const m = {}; for (const k of reg.mats) m[k] = e.boss ? 4 : 1; gain(state, m); }
  if (Math.random() < 0.04) gain(state, { dust: 1 });
  if (unlocked(state, 'gems') && Math.random() < (e.boss ? 0.5 : 0.006)) { const g = pick(GEM_KEYS) + '0'; state.gems[g] = (state.gems[g] || 0) + 1; ev(c, { t: 'gem', g }); }
  if (e.boss) {
    const ri = regionOf(state.stage);
    gain(state, { essence: 2 + Math.floor(ri / 2), cores: L >= 60 ? 1 : 0 });
    if (state.stage % 10 === 0 && !state.bossesBeaten[ri]) {
      state.bossesBeaten[ri] = true;
      const unlocks = { 1: 'golem', 2: 'raven', 5: 'dragon', 6: 'shadowbeast' };
      if (unlocks[ri] && unlockCompanion(state, unlocks[ri])) ev(c, { t: 'companion', id: unlocks[ri] });
      if (ri === REGIONS.length - 1 && state.worldTier >= state.maxWorldTier && state.maxWorldTier < WORLD_TIERS.length - 1) { state.maxWorldTier = state.worldTier + 1; ev(c, { t: 'worldTier', tier: state.maxWorldTier }); }
    }
    if (unlocked(state, 'inscriptions') && Math.random() < 0.35) addInscription(state, makeInscription(ilvl));
  }
}

function waveCleared(state, c) {
  const r = state.run;
  c.wave++;
  c.pause = 0.7;
  if (r) {
    r.wave = c.wave;
    if (r.kind === 'tower') { r.floor++; if (r.floor > 999) finishRun(state, c, true); c.hero.hp = Math.min(c.st.hp, c.hero.hp + c.st.hp * 0.25); return; }
    if (c.wave >= r.waves) finishRun(state, c, true);
    return;
  }
  if (c.wave >= WAVES_PER_STAGE) {
    c.wave = 0;
    ev(c, { t: 'stageClear', stage: state.stage });
    if (state.retryIn > 0) state.retryIn--;
    if (state.autoAdvance && state.retryIn <= 0) {
      if (state.stage === state.maxStage && state.maxStage < MAX_STAGE) state.maxStage++;
      if (state.stage < state.maxStage) state.stage++;
    }
  }
}

// ---------------- boss mechanics ----------------
const PHASES = [1, 0.7, 0.4, 0.15];
function bossMechanics(state, c, e, dt) {
  const k = e.hp / e.maxHp;
  let ph = 0; PHASES.forEach((p, i) => { if (k <= p) ph = i; });
  if (ph !== e.phase) { e.phase = ph; ev(c, { t: 'phase', id: e.id, name: e.phaseNames[ph] || `Phase ${ph + 1}`, n: ph + 1 }); }
  const active = e.mech.slice(0, ph + 1);
  if (active.includes('enrage')) e.enraged = true;
  if (e.shieldT > 0) e.shieldT -= dt;
  if (e.age > 120 && !e.hardEnrage) { e.hardEnrage = true; e.dmg *= 3; ev(c, { t: 'phase', id: e.id, name: 'Hard Enrage', n: 9 }); }
  // telegraphs resolve
  if (e.tele) {
    e.tele.t -= dt;
    if (e.tele.t <= 0) {
      const t = e.tele; e.tele = null;
      ev(c, { t: 'teleHit', id: e.id, kind: t.kind, zones: t.zones });
      const h = c.hero;
      if (!(t.zones || []).some((z) => Math.hypot(h.x - z.x, h.z - z.z) <= z.r + 0.2)) { ev(c, { t: 'avoided' }); return; }
      const fake = { ...e, tele: true };
      if (t.kind === 'storm') { damageHero(state, c, e.dmg * 1.5, 'fire', fake); c.hero.dots.push({ t: 4, dps: e.dmg * 0.5, elem: 'fire' }); return; }
      damageHero(state, c, e.dmg * t.mult, t.kind === 'breath' ? 'fire' : t.kind === 'ultimate' ? 'shadow' : 'phys', fake);
      if (t.kind === 'breath') c.hero.dots.push({ t: 3, dps: e.dmg * 0.4, elem: 'fire' });
    }
    return;
  }
  for (const m of active) {
    if (m === 'enrage') continue;
    e.mechT[m] -= dt;
    if (e.mechT[m] > 0) continue;
    switch (m) {
      case 'slam': e.mechT.slam = 8; e.tele = { kind: 'slam', name: 'Crushing Slam', t: 1.6, total: 1.6, mult: 3.5 }; break;
      case 'breath': e.mechT.breath = 9; e.tele = { kind: 'breath', name: 'Fire Breath', t: 1.8, total: 1.8, mult: 2.5 }; break;
      case 'storm': e.mechT.storm = 11; e.tele = { kind: 'storm', name: e.art[1] === 'icesovereign' ? 'Blizzard' : 'Firestorm', t: 1.5, total: 1.5, mult: 1.5 }; break;
      case 'ultimate': e.mechT.ultimate = 13; e.tele = { kind: 'ultimate', name: e.phaseNames[3] || 'Annihilation', t: 2.6, total: 2.6, mult: 7 }; break;
      case 'adds': e.mechT.adds = 12; if (c.enemies.filter((x) => x.hp > 0).length < 5) { for (let i = 0; i < 2; i++) c.enemies.push(makeEnemy(state, e.lvl, { art: ['monsters', pick(REGIONS[regionOf(state.stage)].monsters)], mult: 0.6 })); place(c, c.enemies, { near: e }); ev(c, { t: 'summon' }); } break;
      case 'shield': e.mechT.shield = 14; e.shieldT = 3; ev(c, { t: 'bossShield', id: e.id }); break;
    }
    if (e.tele) {
      const h = c.hero, T = e.tele;
      if (T.kind === 'slam') T.zones = [{ x: h.x, z: h.z, r: 2.6 }];
      else if (T.kind === 'breath') T.zones = [{ x: (h.x + e.x) / 2 + (h.x - e.x) * 0.25, z: (h.z + e.z) / 2 + (h.z - e.z) * 0.25, r: 3.4 }];
      else if (T.kind === 'storm') T.zones = [{ x: h.x, z: h.z, r: 1.9 }, ...[0, 1, 2].map(() => ({ x: h.x + rand(-4, 4), z: h.z + rand(-4, 4), r: 1.9 }))];
      else T.zones = [{ x: e.x, z: e.z, r: 8.5 }];
      for (const z of T.zones) { z.owner = e.id; z.tele = T; z.kind = T.kind; c.zones.push(z); }
      ev(c, { t: 'tele', id: e.id, name: T.name });
      break;
    }
  }
}

// ---------------- offline progress ----------------
export function simulateOffline(state, seconds) {
  const secs = Math.min(seconds, OFFLINE_CAP_H * 3600);
  if (secs < 60) return null;
  // measure a real 90s sample on a clone, then extrapolate
  const clone = JSON.parse(JSON.stringify({ ...state, combat: null, _st: null }));
  clone._stDirty = true; clone.run = null; clone.autoAdvance = false; clone.filters = { ...clone.filters, autoEquip: false, salvageBelow: 99, keepUniques: false, keepAffixes: [] };
  const g0 = clone.gold, k0 = clone.totals.kills, items0 = clone.totals.items;
  clone._xpg = 0;
  const mats0 = { ...clone.mats };
  const SAMPLE = 90;
  for (let t = 0; t < SAMPLE; t += 0.1) tick(clone, 0.1);
  const k = secs / SAMPLE;
  const kills = Math.round((clone.totals.kills - k0) * k);
  const gold = Math.round((clone.gold - g0) * k);
  const xp = clone._xpg * k;
  const mats = {};
  for (const m of Object.keys(clone.mats)) { const d = (clone.mats[m] - mats0[m]) * k; if (d > 0) mats[m] = Math.floor(d); }
  const itemN = Math.min(40, Math.round((clone.totals.items - items0) * k));
  const report = { secs, capped: seconds > OFFLINE_CAP_H * 3600, stage: state.stage, region: REGIONS[regionOf(state.stage)].name, kills, gold, xp: Math.round(xp), mats, levels: 0, equipped: 0, kept: 0, salvaged: 0, deaths: clone.totals.deaths - state.totals.deaths };
  const lvl0 = state.level;
  state.gold += gold; gain(state, mats); gainXp(state, xp);
  report.levels = state.level - lvl0;
  state.totals.kills += kills;
  const tier = WORLD_TIERS[state.worldTier];
  for (let i = 0; i < itemN; i++) {
    const it = generateItem(stageLevel(state.stage) + tier.ilvl, { cls: state.cls, mf: stats(state).mf + tier.mf, ancient: tier.ancient });
    const res = handleLoot(state, it);
    report[res === 'equipped' ? 'equipped' : res === 'bag' ? 'kept' : 'salvaged']++;
  }
  dirty(state);
  return report;
}
export { stats };
