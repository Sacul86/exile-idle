// Delve & Loot engine: town <-> dungeon dives, positional auto-combat, bag/death risk, banking, economy, offline.
import { S, FLOORS_PER_DUNGEON, PACKS_PER_FLOOR, DUNGEONS, dungeonOf, MONSTER_NAMES, ELITE_MODS, SPELLS, SPELL_KEYS, spellSlots, spellPower, spellUpCost,
  TRAINING, TRAIN_KEYS, trainCost, POTION, SLOTS, OFFLINE_CAP_H, LOOKS } from './data.js';
import { makeItem, heroStats, itemValue, itemPower, upgradeCost, mergeKey, mergeItems, armorReduction, UPGRADE_MAX } from './items.js';

export const SAVE_KEY = 'delve-loot-save-v1';
export const STASH_CAP = 60;
const ENV = globalThis.process?.env || {};
const T = { MH: +(ENV.MH || 10), HE: +(ENV.HE || 2.1), MD: +(ENV.MD || 3), DE: +(ENV.DE || 1.85), XP: +(ENV.XPK || 6) };
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const hash = (s) => { let h = 7; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };

// ---------------- state ----------------
export function newState(look = 'paladin') {
  return {
    v: 1, look, picked: false, level: 1, xp: 0, gold: 0, stash: [], gear: { weapon: makeItem(1, { base: 'sword', rarity: 0 }) }, potions: 3,
    spells: { fireball: 1 }, slots: ['fireball'], training: Object.fromEntries(TRAIN_KEYS.map((k) => [k, 0])), deepest: 0, run: null,
    rules: { autoDive: true, start: 'best', retreatFull: true, retreatLow: true, retreatHp: 30, stopFloor: 0, potionAt: 45, autoSell: 1, autoEquip: true, autoBuy: true, autoDodge: true },
    settings: { zoom: 'mid', speed: 1, dmgNums: 'all', shake: true, effects: 'full', text: 'm', colorSafe: false },
    totals: { dives: 0, deaths: 0, kills: 0, sold: 0, merged: 0, bestHaul: 0, goldEarned: 0 }, lastSeen: Date.now(), lastDive: null,
  };
}
export function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY); if (!raw) return null;
    const s = JSON.parse(raw), d = newState(s.look);
    for (const k of Object.keys(d)) if (s[k] === undefined) s[k] = d[k];
    for (const k of ['rules', 'settings', 'totals', 'training']) s[k] = { ...d[k], ...s[k] };
    // a dive in progress is banked on load (offline handles the time away)
    if (s.run) { s.gold += s.run.bagGold; for (const it of s.run.bag) s.stash.push(it); s.run = null; }
    return s;
  } catch (e) { console.warn(e); return null; }
}
export function save(state) {
  state.lastSeen = Date.now();
  const { combat, _st, input, ...rest } = state;
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(rest)); } catch (e) { console.warn(e); }
}
export function stats(state) { if (!state._st || state._dirty) { state._st = heroStats(state); state._dirty = false; } return state._st; }
export const dirty = (state) => { state._dirty = true; };
export const xpToNext = (l) => Math.round(40 * Math.pow(l, 1.6) * Math.pow(1.04, l));
export function gainXp(state, n) {
  state.xp += n; const ups = [];
  while (state.xp >= xpToNext(state.level)) { state.xp -= xpToNext(state.level); state.level++; ups.push(state.level); }
  if (ups.length) dirty(state);
  return ups;
}

// checkpoints: floor 1 and every 5th floor (1, 6, 11, ...) you have reached
export const checkpoints = (state) => { const out = [1]; for (let f = 6; f <= state.deepest; f += 5) out.push(f); return out; };
export const bestCheckpoint = (state) => { const c = checkpoints(state); return c[c.length - 1]; };
export const potionPrice = (state) => POTION.price(state.deepest);

// ---------------- town actions ----------------
export function sell(state, it) {
  if (it.locked) return 0;
  state.stash = state.stash.filter((x) => x.id !== it.id);
  const v = itemValue(it, state.training.haggle);
  state.gold += v; state.totals.sold++; state.totals.goldEarned += v; return v;
}
export function sellBelow(state, rarity) { let g = 0, n = 0; for (const it of [...state.stash]) if (it.rarity < rarity && !it.locked) { g += sell(state, it); n++; } return { g, n }; }
export function equip(state, it) {
  const old = state.gear[it.slot];
  state.stash = state.stash.filter((x) => x.id !== it.id);
  state.gear[it.slot] = it; it.isNew = false;
  if (old) state.stash.unshift(old);
  dirty(state);
}
export function upgrade(state, it) {
  if (it.up >= UPGRADE_MAX) return false;
  const c = upgradeCost(it); if (state.gold < c) return false;
  state.gold -= c; it.up++; dirty(state); return true;
}
export function mergeGroups(state) {
  const groups = {};
  for (const it of state.stash) if (!it.locked && it.rarity < 4) (groups[mergeKey(it)] = groups[mergeKey(it)] || []).push(it);
  return Object.values(groups).filter((g) => g.length >= 3);
}
export function merge(state, key) {
  const g = state.stash.filter((it) => mergeKey(it) === key && !it.locked && it.rarity < 4).sort((a, b) => a.ilvl - b.ilvl).slice(0, 3);
  if (g.length < 3) return null;
  const ids = new Set(g.map((x) => x.id));
  state.stash = state.stash.filter((x) => !ids.has(x.id));
  const it = mergeItems(g); state.stash.unshift(it); state.totals.merged++;
  return it;
}
export function mergeAll(state) { let n = 0, out = []; for (let guard = 0; guard < 50; guard++) { const g = mergeGroups(state)[0]; if (!g) break; out.push(merge(state, mergeKey(g[0]))); n++; } return out; }
export function buyPotions(state, n) {
  const st = stats(state); const room = st.belt - state.potions; n = Math.min(n, room);
  const p = potionPrice(state); n = Math.min(n, Math.floor(state.gold / p));
  if (n <= 0) return 0; state.gold -= n * p; state.potions += n; return n;
}
export function learnSpell(state, k) {
  if (state.spells[k]) return false;
  if (state.gold < SPELLS[k].learn) return false;
  state.gold -= SPELLS[k].learn; state.spells[k] = 1;
  if (state.slots.length < spellSlots(state.level)) state.slots.push(k);
  return true;
}
export function levelSpell(state, k) { const l = state.spells[k]; if (!l) return false; const c = spellUpCost(k, l); if (state.gold < c) return false; state.gold -= c; state.spells[k]++; return true; }
export function toggleSlot(state, k) {
  if (state.slots.includes(k)) state.slots = state.slots.filter((x) => x !== k);
  else if (state.spells[k] && state.slots.length < spellSlots(state.level)) state.slots.push(k);
}
export function train(state, k) { const c = trainCost(k, state.training[k]); if (state.gold < c) return false; state.gold -= c; state.training[k]++; dirty(state); return true; }
export function bestUpgrades(state) {
  // equip any better stash items
  let n = 0;
  for (let pass = 0; pass < 2; pass++) for (const sl of SLOTS) {
    let best = null, bp = 0;
    for (const it of state.stash) if (it.slot === sl) { const d = itemPower(state, it); if (d > bp) { bp = d; best = it; } }
    if (best) { equip(state, best); n++; }
  }
  return n;
}
// "Smart spend": merges, equips, upgrades gear and trains wherever it raises Power most per gold
export function smartSpend(state) {
  mergeAll(state); bestUpgrades(state);
  buyPotions(state, 99);
  let n = 0;
  for (let guard = 0; guard < 200; guard++) {
    const base = stats(state).power;
    const c = [];
    for (const sl of SLOTS) { const it = state.gear[sl]; if (it && it.up < UPGRADE_MAX) c.push({ cost: upgradeCost(it), run: () => it.up++, undo: () => it.up-- }); }
    for (const k of ['str', 'vit', 'agi']) c.push({ cost: trainCost(k, state.training[k]), run: () => state.training[k]++, undo: () => state.training[k]-- });
    let best = null, bv = 0;
    for (const x of c) { if (x.cost > state.gold) continue; x.run(); dirty(state); const g = stats(state).power / base - 1; x.undo(); dirty(state); const v = g / (x.cost / Math.max(1, state.gold)); if (g > 0 && v > bv) { bv = v; best = x; } }
    if (!best) break;
    state.gold -= best.cost; best.run(); dirty(state); n++;
  }
  return n;
}

// ---------------- dives ----------------
export function startDive(state, floor) {
  if (state.run) return false;
  floor = floor || (state.rules.start === 'best' ? bestCheckpoint(state) : 1);
  state.run = { start: floor, floor, pack: 0, bag: [], bagGold: 0, kills: 0, t: 0, xp: 0, lost: null, ending: 0 };
  state.totals.dives++;
  const c = combatOf(state);
  c.hero.hp = c.st.hp; c.hero.shield = 0; c.hero.dots = []; c.hero.cds = {}; c.hero.dead = 0; c.enemies = []; c.zones = []; c.pause = 0.6;
  ev(c, { t: 'floor', floor, start: true });
  return true;
}
// retreat: bank everything you're carrying
export function retreat(state, why = 'retreat') {
  const r = state.run; if (!r) return null;
  const c = combatOf(state);
  const res = { why, floors: r.floor - r.start + (why === 'death' ? 0 : 1), from: r.start, to: r.floor, kills: r.kills, gold: r.bagGold, items: [], lost: r.lost, t: r.t, equipped: 0, sold: 0, soldGold: 0 };
  state.gold += r.bagGold; state.totals.goldEarned += r.bagGold;
  for (const it of r.bag) {
    if (state.rules.autoEquip && itemPower(state, it) > 0) { equip(state, it); res.equipped++; res.items.push({ it, res: 'equipped' }); continue; }
    if (it.rarity < state.rules.autoSell && !it.locked) { state.stash.push(it); const v = sell(state, it); res.sold++; res.soldGold += v; res.items.push({ it, res: 'sold' }); continue; }
    state.stash.unshift(it); res.items.push({ it, res: 'stash' });
  }
  if (state.rules.autoEquip) res.equipped += bestUpgrades(state);
  // stash overflow: sell the cheapest
  while (state.stash.length > STASH_CAP) { const v = state.stash.filter((x) => !x.locked).sort((a, b) => itemValue(a) - itemValue(b))[0]; if (!v) break; res.soldGold += sell(state, v); res.sold++; }
  if (state.rules.autoBuy) res.potions = buyPotions(state, 99);
  const haul = res.gold + res.soldGold;
  if (haul > state.totals.bestHaul) state.totals.bestHaul = haul;
  state.lastDive = { ...res, items: res.items.map((x) => ({ name: x.it.base, rarity: x.it.rarity, res: x.res })) };
  state.run = null; c.enemies = []; c.zones = []; c.townT = 3; c.hero.hp = c.st.hp; c.hero.dead = 0; c.hero.x = 0; c.hero.z = 0;
  dirty(state);
  ev(c, { t: 'town', res });
  return res;
}

// ---------------- combat ----------------
export function combatOf(state) {
  if (!state.combat) {
    const st = stats(state);
    state.combat = { st, t: 0, hero: { hp: st.hp, shield: 0, x: 0, z: 0, face: 0, moving: false, atk: 0, cds: {}, gcd: 0, dots: [], dead: 0, buffs: [] }, enemies: [], zones: [], dir: 0, pause: 0.5, events: [], townT: 3 };
  }
  return state.combat;
}
const ev = (c, e) => { if (c.events.length < 200) c.events.push(e); };
function refresh(state, c) { const old = c.st; c.st = stats(state); if (old && old.hp) c.hero.hp = Math.min(c.st.hp, c.hero.hp * c.st.hp / old.hp); }

function makeEnemy(floor, o = {}) {
  const s = S(floor);
  const art = o.art || ['monsters', 'skeleton'];
  const mods = o.mods || [];
  let hp = T.MH * Math.pow(s, T.HE), dmg = T.MD * Math.pow(s, T.DE), aspd = 0.85 + (hash(art[1]) % 4) * 0.08, speed = 2.6;
  if (o.boss) { hp *= 14; dmg *= 2.4; aspd = 0.75; speed = 1.9; }
  if (mods.length) { hp *= 2.5; dmg *= 1.35; }
  if (mods.includes('tough')) hp *= 2;
  if (mods.includes('fast')) { aspd *= 1.5; speed *= 1.4; }
  if (o.mult) { hp *= o.mult; dmg *= Math.sqrt(o.mult); }
  return {
    id: Math.random().toString(36).slice(2), name: o.name || MONSTER_NAMES[art[1]] || 'Monster', art, lvl: floor, hp, maxHp: hp, dmg, aspd, atk: rand(0, 0.5), speed,
    boss: !!o.boss, elite: mods.length > 0, mods, mech: o.mech || (mods.length ? ['slam'] : []), phaseNames: o.phaseNames || [], phase: 0, tele: null,
    mechT: { slam: 4, breath: 5, adds: 7, storm: 7, ultimate: 4 }, st: {}, frozen: 0, age: 0,
  };
}
const RANGED_MON = new Set(['skelmage', 'banshee', 'wisp', 'siren', 'cultist', 'imp', 'angel']);
function spawnPack(state, c) {
  const r = state.run, f = r.floor, d = DUNGEONS[dungeonOf(f)];
  const last = r.pack === PACKS_PER_FLOOR - 1;
  let list;
  if (last && f % FLOORS_PER_DUNGEON === 0) {
    list = [makeEnemy(f + 1, { boss: true, art: ['bosses', d.bossArt], name: d.boss, mech: d.mech, phaseNames: ['', 'Wounded', 'Enraged', 'Desperate'] })];
  } else {
    const n = Math.min(5, 2 + Math.floor(Math.random() * 2) + (f > 20 ? 1 : 0));
    list = Array.from({ length: n }, () => makeEnemy(f, { art: ['monsters', pick(d.monsters)] }));
    if ((last && f % 5 === 0) || Math.random() < 0.08) { const keys = Object.keys(ELITE_MODS); const e = makeEnemy(f, { art: ['monsters', pick(d.monsters)], mods: [pick(keys)] }); list.push(e); }
  }
  c.enemies = list; c.zones = [];
  place(c, list);
  if (list[0].boss) ev(c, { t: 'wave', boss: true });
}
function place(c, list, o = {}) {
  const h = c.hero, around = o.around ?? Math.random() < 0.4;
  if (!o.near) c.dir += rand(-0.8, 0.8);
  const cx = h.x + Math.cos(c.dir) * 9, cz = h.z + Math.sin(c.dir) * 9;
  list.forEach((e, i) => {
    if (e.x !== undefined) return;
    if (o.near) { const a = rand(0, 6.28); e.x = o.near.x + Math.cos(a) * 2.2; e.z = o.near.z + Math.sin(a) * 2.2; }
    else if (e.boss || !around) { e.x = cx + (e.boss ? 0 : rand(-2.5, 2.5)); e.z = cz + (e.boss ? 0 : rand(-2.5, 2.5)); }
    else { const a = (i / list.length) * 6.28 + rand(-0.4, 0.4), d = rand(7, 9.5); e.x = h.x + Math.cos(a) * d; e.z = h.z + Math.sin(a) * d; }
    e.r = e.boss ? 1.3 : e.elite ? 0.7 : 0.5;
    e.range = e.boss ? 2.2 : RANGED_MON.has(e.art[1]) ? 5.5 : 1.1;
    e.face = Math.atan2(h.z - e.z, h.x - e.x);
  });
}
const distHE = (c, e) => Math.hypot(e.x - c.hero.x, e.z - c.hero.z);
const inRange = (c, e, extra = 0) => distHE(c, e) - e.r <= c.st.range + 0.3 + extra;
function target(c) {
  const alive = c.enemies.filter((e) => e.hp > 0); if (!alive.length) return null;
  const h = c.hero, cur = h.tgtId && alive.find((e) => e.id === h.tgtId);
  if (cur && c.t < (h.tgtUntil || 0)) return cur;
  let t = alive.reduce((a, b) => (distHE(c, b) < distHE(c, a) ? b : a));
  if (cur && distHE(c, t) > distHE(c, cur) - 1) t = cur;
  h.tgtId = t.id; h.tgtUntil = c.t + 1.5; return t;
}

export function tick(state, dt) {
  const c = combatOf(state);
  if (state._dirty) refresh(state, c);
  c.t += dt;
  const h = c.hero, st = c.st, r = state.run;
  // town: auto-dive after a short pause
  if (!r) {
    h.hp = st.hp; h.moving = false;
    if (state.rules.autoDive && state.picked !== false) { c.townT -= dt; if (c.townT <= 0) startDive(state); }
    return;
  }
  r.t += dt;
  if (h.dead > 0) { h.dead -= dt; if (h.dead <= 0) retreat(state, 'death'); return; }
  const alive = c.enemies.filter((e) => e.hp > 0);
  if (!alive.length) {
    if (c.pause > 0) { c.pause -= dt; h.hp = Math.min(st.hp, h.hp + st.hp * 0.03 * dt); h.moving = false; return; }
    spawnPack(state, c); c.pause = 0.6; return;
  }
  c.zones = c.zones.filter((z) => c.enemies.some((e) => e.id === z.owner && e.hp > 0 && e.tele));
  move(state, c, dt, alive);
  // potions & regen
  h.hp = Math.min(st.hp, h.hp + st.hp * 0.004 * dt);
  h.potT = Math.max(0, (h.potT || 0) - dt);
  if (h.hp < st.hp * state.rules.potionAt / 100 && state.potions > 0 && h.potT <= 0) { state.potions--; h.potT = 2; heal(c, st.hp * st.potionHeal / 100, 'potion'); }
  h.dots = h.dots.filter((d) => (d.t -= dt) > 0);
  for (const d of h.dots) hurt(state, c, d.dps * dt, null, true);
  if (h.dead > 0) return;
  // smart retreat: low life with no potions left
  if (state.rules.retreatLow && state.potions <= 0 && h.hp < st.hp * state.rules.retreatHp / 100) { ev(c, { t: 'flee' }); retreat(state, 'low'); return; }
  // spells
  for (const k of Object.keys(h.cds)) h.cds[k] = Math.max(0, h.cds[k] - dt);
  h.gcd = Math.max(0, h.gcd - dt);
  if (h.gcd <= 0) for (const k of state.slots) {
    if ((h.cds[k] || 0) > 0) continue;
    const sp = SPELLS[k], lvl = state.spells[k] || 1, pw = spellPower(lvl) * st.spell;
    const t = target(c);
    let go = false;
    if (sp.heal) go = h.hp < st.hp * 0.5;
    else if (sp.shield) go = h.hp < st.hp * 0.75 || c.zones.length > 0;
    else if (sp.radius) go = alive.filter((e) => distHE(c, e) < sp.radius + e.r).length >= (alive.length > 1 ? 2 : 1);
    else go = t && distHE(c, t) - t.r < 7.5;
    if (!go) continue;
    h.cds[k] = sp.cd; h.gcd = 0.4;
    ev(c, { t: 'cast', id: k, role: sp.role, elem: sp.elem });
    if (sp.heal) heal(c, st.hp * sp.heal / 100 * pw, k);
    if (sp.shield) h.shield = Math.max(h.shield, st.hp * sp.shield / 100 * pw);
    const ids = [];
    if (sp.radius) for (const e of alive) if (distHE(c, e) < sp.radius + e.r) { for (let i = 0; i < (sp.hits || 1); i++) hit(state, c, e, sp.coef * pw, sp.elem); if (sp.freeze && e.hp > 0) { e.frozen = e.boss ? 0.5 : sp.freeze; } ids.push(e.id); }
    if (sp.chains) { let cur = t, done = new Set(); for (let i = 0; i < sp.chains && cur; i++) { hit(state, c, cur, sp.coef * pw, sp.elem); done.add(cur.id); ids.push(cur.id); cur = alive.filter((e) => e.hp > 0 && !done.has(e.id)).sort((a, b) => Math.hypot(a.x - cur.x, a.z - cur.z) - Math.hypot(b.x - cur.x, b.z - cur.z))[0]; } }
    if (k === 'fireball' && t) { hit(state, c, t, sp.coef * pw, 'fire'); if (t.hp > 0) t.st.burn = { t: 4, dps: st.attack * 0.4 * pw }; ids.push(t.id); }
    ev(c, { t: 'skillHit', id: k, role: sp.role, elem: sp.elem, ids });
    break;
  }
  // basic attack
  h.atk = Math.min(1.2, h.atk + dt * st.speed);
  const bt = target(c);
  if (h.atk >= 1 && bt && inRange(c, bt)) { h.atk -= 1; ev(c, { t: 'swing', id: bt.id }); hit(state, c, bt, 1, 'phys', true); }
  // enemies
  for (const e of c.enemies) {
    if (e.hp <= 0) continue;
    e.age += dt;
    if (e.st.burn) { e.st.burn.t -= dt; dealRaw(state, c, e, e.st.burn.dps * dt, 'fire', true); if (e.st.burn && e.st.burn.t <= 0) delete e.st.burn; if (e.hp <= 0) continue; }
    if (e.frozen > 0) { e.frozen -= dt; continue; }
    if (e.boss || e.mech.length) mechanics(state, c, e, dt);
    if (e.tele) continue;
    if (distHE(c, e) - e.r - 0.4 > e.range + 0.3) { e.atk = Math.min(e.atk, 0.6); continue; }
    e.atk += dt * e.aspd * (e.enraged ? 1.5 : 1);
    if (e.atk >= 1) {
      e.atk -= 1;
      const d = hurt(state, c, e.dmg * (e.enraged ? 1.5 : 1) * rand(0.85, 1.15), e);
      if (e.mods.includes('vampiric')) e.hp = Math.min(e.maxHp, e.hp + d * 2);
      ev(c, { t: 'eatk', id: e.id });
      if (h.dead > 0 || !state.run) return;
    }
  }
  if (!c.enemies.some((e) => e.hp > 0)) packCleared(state, c);
}

function move(state, c, dt, alive) {
  const h = c.hero, inp = state.input, R = c.st.range;
  let dx = 0, dz = 0;
  if (inp && (inp.x || inp.z)) { dx = inp.x; dz = inp.z; h.chasing = false; }
  else {
    const zone = state.rules.autoDodge !== false && c.zones.find((z) => Math.hypot(h.x - z.x, h.z - z.z) < z.r + 0.5);
    if (zone) { dx = h.x - zone.x; dz = h.z - zone.z; if (Math.abs(dx) + Math.abs(dz) < 0.01) dx = 1; }
    else {
      const t = target(c);
      if (t) {
        let kite = h.kiteId && alive.find((e) => e.id === h.kiteId);
        if (kite && distHE(c, kite) - kite.r >= 4.5) { h.kiteId = null; h.kiteCd = c.t + 3.5; kite = null; }
        if (!kite && R > 4 && c.t > (h.kiteCd || 0)) { kite = alive.find((e) => (e.boss || e.elite) && !e.tele && e.range < 3 && distHE(c, e) - e.r < 1.6); if (kite) h.kiteId = kite.id; }
        if (kite) { dx = h.x - kite.x; dz = h.z - kite.z; h.chasing = false; }
        else {
          const g = distHE(c, t) - t.r;
          if (g > R * 0.95) h.chasing = true; else if (g <= R * 0.7) h.chasing = false;
          if (h.chasing) { dx = t.x - h.x; dz = t.z - h.z; } else h.face = Math.atan2(t.z - h.z, t.x - h.x);
        }
      }
    }
  }
  const l = Math.hypot(dx, dz);
  h.moving = l > 0.01;
  if (h.moving) { const sp = 4.4 * dt * Math.min(1, l); h.x += (dx / l) * sp; h.z += (dz / l) * sp; h.face = Math.atan2(dz, dx); }
  const melee = alive.filter((e) => e.range < 3 && !(e.frozen > 0) && !e.tele);
  if (melee.length) {
    const ang = melee.map((e) => Math.atan2(e.z - h.z, e.x - h.x));
    const mean = Math.atan2(ang.reduce((a, b) => a + Math.sin(b), 0), ang.reduce((a, b) => a + Math.cos(b), 0));
    const order = melee.map((e, i) => [e, ((ang[i] - mean + Math.PI * 3) % (Math.PI * 2)) - Math.PI]).sort((a, b) => a[1] - b[1]);
    const gap = Math.min((Math.PI * 2) / order.length, 0.85);
    order.forEach(([e], i) => { e.slotA = mean + (i - (order.length - 1) / 2) * gap; });
  }
  for (const e of alive) {
    e.moving = false;
    if (e.frozen > 0 || e.tele) continue;
    const d = distHE(c, e) || 0.01;
    e.face = Math.atan2(h.z - e.z, h.x - e.x);
    const sp = e.speed * dt;
    let tx, tz;
    if (e.range >= 3) {
      e.strafeT = (e.strafeT || 0) - dt;
      if (e.strafeT <= 0) { e.strafeT = rand(1.5, 3); e.strafe = Math.random() < 0.5 ? -1 : 1; }
      const want = d < 3.5 ? 4.6 : d > e.range + e.r + 0.4 ? e.range : d;
      const a = Math.atan2(e.z - h.z, e.x - h.x) + (want === d ? e.strafe * 0.35 * dt : 0);
      tx = h.x + Math.cos(a) * want; tz = h.z + Math.sin(a) * want;
    } else {
      const rr = e.range + e.r + 0.3;
      if (d > rr + 2.5) { tx = h.x; tz = h.z; } else { tx = h.x + Math.cos(e.slotA ?? 0) * rr; tz = h.z + Math.sin(e.slotA ?? 0) * rr; }
    }
    const mx = tx - e.x, mz = tz - e.z, ml = Math.hypot(mx, mz);
    if (ml > (e.moving0 ? 0.08 : 0.3)) { const k = Math.min(sp, ml); e.x += (mx / ml) * k; e.z += (mz / ml) * k; e.moving = true; }
    e.moving0 = e.moving;
  }
  for (let i = 0; i < alive.length; i++) for (let j = i + 1; j < alive.length; j++) {
    const a = alive[i], b = alive[j], ddx = b.x - a.x, ddz = b.z - a.z, d = Math.hypot(ddx, ddz) || 0.01, min = a.r + b.r;
    if (d < min) { const p = (min - d) / 2 / d; a.x -= ddx * p; a.z -= ddz * p; b.x += ddx * p; b.z += ddz * p; }
  }
  for (const e of alive) { const ddx = e.x - h.x, ddz = e.z - h.z, d = Math.hypot(ddx, ddz) || 0.01, min = e.r + 0.45; if (d < min) { e.x += (ddx / d) * (min - d); e.z += (ddz / d) * (min - d); } }
}

function hit(state, c, e, coef, elem, basic = false) {
  const st = c.st;
  const crit = Math.random() * 100 < st.crit;
  let dmg = st.attack * coef * (crit ? 1 + st.critDmg / 100 : 1) * rand(0.92, 1.08);
  if (e.frozen > 0) dmg *= 1.2;
  const d = dealRaw(state, c, e, dmg, elem, false, crit);
  if (st.lifesteal) heal(c, d * st.lifesteal / 100, null, true);
  if (crit && !e.boss && e.hp > 0) { const dd = distHE(c, e) || 1; e.x += ((e.x - c.hero.x) / dd) * 0.35; e.z += ((e.z - c.hero.z) / dd) * 0.35; }
  return d;
}
function dealRaw(state, c, e, dmg, elem, dot, crit) {
  if (e.hp <= 0) return 0;
  const d = Math.min(e.hp, dmg); e.hp -= dmg;
  if (!dot || Math.random() < 0.15) ev(c, { t: 'hit', id: e.id, dmg, crit, elem, dot });
  if (e.hp <= 0) kill(state, c, e);
  return d;
}
function heal(c, n, src, quiet) { const h = c.hero, b = h.hp; h.hp = Math.min(c.st.hp, h.hp + n); if (!quiet && h.hp > b) ev(c, { t: 'heal', n: h.hp - b, src }); }
function hurt(state, c, raw, src, dot) {
  const h = c.hero, st = c.st;
  if (!dot && h.dodgeNext && src?.tele) { h.dodgeNext = false; ev(c, { t: 'dodge' }); return 0; }
  let d = raw * (1 - armorReduction(st.armor, src?.lvl || st.lv));
  if (h.shield > 0) { const a = Math.min(h.shield, d); h.shield -= a; d -= a; }
  h.hp -= d;
  if (!dot) ev(c, { t: 'hurt', dmg: d, big: !!src?.tele });
  if (h.hp <= 0) die(state, c);
  return d;
}
function die(state, c) {
  const h = c.hero, r = state.run;
  h.hp = 0; h.dead = 2.5; state.totals.deaths++;
  // lose half of what you're carrying
  const lostItems = [];
  const keep = [];
  for (const it of r.bag) (Math.random() < 0.5 ? lostItems : keep).push(it);
  const lostGold = Math.floor(r.bagGold / 2);
  r.bag = keep; r.bagGold -= lostGold;
  r.lost = { items: lostItems.length, gold: lostGold, best: lostItems.reduce((m, x) => Math.max(m, x.rarity), -1) };
  ev(c, { t: 'death', lost: r.lost });
}
function kill(state, c, e) {
  const r = state.run, st = c.st;
  r.kills++; state.totals.kills++;
  ev(c, { t: 'kill', id: e.id, boss: e.boss });
  if (e.mods.includes('explosive')) hurt(state, c, e.dmg * 1.8, null);
  const ups = gainXp(state, T.XP * Math.pow(S(e.lvl), 1.1) * (e.boss ? 10 : e.elite ? 3 : 1));
  if (ups.length) { ev(c, { t: 'level', ups }); refresh(state, c); }
  const gold = Math.round(1.5 * S(e.lvl) * (e.boss ? 15 : e.elite ? 4 : 1) * rand(0.7, 1.3) * (1 + st.gold / 100));
  r.bagGold += gold;
  const drops = e.boss ? 3 : e.elite ? 1 : Math.random() < 0.22 * (1 + state.training.loot * 0.03) ? 1 : 0;
  for (let i = 0; i < drops; i++) {
    const it = makeItem(e.lvl, { find: st.find + (e.boss ? 150 : e.elite ? 60 : 0) });
    if (r.bag.length < st.bag) { r.bag.push(it); ev(c, { t: 'loot', rarity: it.rarity, name: it.base, id: e.id }); }
    else {
      // bag full: keep the more valuable item
      const worst = r.bag.reduce((a, b) => (itemValue(b) < itemValue(a) ? b : a));
      if (itemValue(it) > itemValue(worst)) { r.bag[r.bag.indexOf(worst)] = it; ev(c, { t: 'loot', rarity: it.rarity, name: it.base, id: e.id, swap: true }); }
      else ev(c, { t: 'bagFull' });
    }
  }
}
function packCleared(state, c) {
  const r = state.run;
  r.pack++; c.pause = 0.8;
  if (r.pack < PACKS_PER_FLOOR) return;
  // floor done
  r.pack = 0;
  if (r.floor > state.deepest) state.deepest = r.floor;
  const st = c.st;
  if (state.rules.stopFloor && r.floor >= state.rules.stopFloor) { retreat(state, 'stop'); return; }
  if (state.rules.retreatFull && r.bag.length >= st.bag) { retreat(state, 'full'); return; }
  r.floor++;
  c.pause = 1.2; c.hero.hp = Math.min(st.hp, c.hero.hp + st.hp * 0.1);
  ev(c, { t: 'floor', floor: r.floor, newDungeon: (r.floor - 1) % FLOORS_PER_DUNGEON === 0 });
}

// ---------------- boss & elite mechanics (telegraphed red zones you can step out of) ----------------
const PHASES = [1, 0.7, 0.4, 0.15];
function mechanics(state, c, e, dt) {
  const h = c.hero;
  if (e.boss) {
    let ph = 0; PHASES.forEach((p, i) => { if (e.hp / e.maxHp <= p) ph = i; });
    if (ph !== e.phase) { e.phase = ph; ev(c, { t: 'phase', id: e.id, name: e.phaseNames[ph] || `Phase ${ph + 1}`, n: ph + 1 }); }
    if (e.age > 120 && !e.hardEnrage) { e.hardEnrage = true; e.dmg *= 3; ev(c, { t: 'phase', id: e.id, name: 'Hard Enrage', n: 9 }); }
  }
  const active = e.boss ? e.mech.slice(0, e.phase + 1) : e.mech;
  if (active.includes('enrage')) e.enraged = true;
  if (e.tele) {
    e.tele.t -= dt;
    if (e.tele.t <= 0) {
      const t = e.tele; e.tele = null;
      ev(c, { t: 'teleHit', id: e.id, kind: t.kind, zones: t.zones });
      if (!t.zones.some((z) => Math.hypot(h.x - z.x, h.z - z.z) <= z.r + 0.2)) { ev(c, { t: 'avoided' }); return; }
      hurt(state, c, e.dmg * t.mult, { ...e, tele: true });
      if (t.kind === 'breath' || t.kind === 'storm') h.dots.push({ t: 3, dps: e.dmg * 0.35 });
    }
    return;
  }
  for (const m of active) {
    if (m === 'enrage') continue;
    e.mechT[m] -= dt;
    if (e.mechT[m] > 0) continue;
    switch (m) {
      case 'slam': if (!e.boss && distHE(c, e) - e.r > e.range + 1) { e.mechT.slam = 1; break; } e.mechT.slam = e.boss ? 8 : rand(6, 9); e.tele = e.boss ? { kind: 'slam', name: 'Crushing Slam', t: 1.6, total: 1.6, mult: 3.2 } : { kind: 'slam', name: 'Heavy Strike', t: 1.0, total: 1.0, mult: 2, small: true }; break;
      case 'breath': e.mechT.breath = 9; e.tele = { kind: 'breath', name: 'Fire Breath', t: 1.8, total: 1.8, mult: 2.4 }; break;
      case 'storm': e.mechT.storm = 11; e.tele = { kind: 'storm', name: 'Firestorm', t: 1.5, total: 1.5, mult: 1.5 }; break;
      case 'ultimate': e.mechT.ultimate = 13; e.tele = { kind: 'ultimate', name: 'Annihilation', t: 2.6, total: 2.6, mult: 6 }; break;
      case 'adds': e.mechT.adds = 12; if (c.enemies.filter((x) => x.hp > 0).length < 5) { const d = DUNGEONS[dungeonOf(state.run.floor)]; for (let i = 0; i < 2; i++) c.enemies.push(makeEnemy(e.lvl - 1, { art: ['monsters', pick(d.monsters)], mult: 0.6 })); place(c, c.enemies, { near: e }); ev(c, { t: 'summon' }); } break;
    }
    if (e.tele) {
      const T2 = e.tele;
      if (T2.kind === 'slam') T2.zones = [{ x: h.x, z: h.z, r: T2.small ? 1.5 : 2.6 }];
      else if (T2.kind === 'breath') T2.zones = [{ x: (h.x + e.x) / 2 + (h.x - e.x) * 0.25, z: (h.z + e.z) / 2 + (h.z - e.z) * 0.25, r: 3.4 }];
      else if (T2.kind === 'storm') T2.zones = [{ x: h.x, z: h.z, r: 1.9 }, ...[0, 1, 2].map(() => ({ x: h.x + rand(-4, 4), z: h.z + rand(-4, 4), r: 1.9 }))];
      else T2.zones = [{ x: e.x, z: e.z, r: 8.5 }];
      for (const z of T2.zones) { z.owner = e.id; z.tele = T2; z.kind = T2.kind; c.zones.push(z); }
      ev(c, { t: 'tele', id: e.id, name: T2.name, small: !!T2.small });
      break;
    }
  }
}

// ---------------- offline: sample real dives, then scale ----------------
export function simulateOffline(state, seconds) {
  const secs = Math.min(seconds, OFFLINE_CAP_H * 3600);
  if (secs < 60 || !state.rules.autoDive) return null;
  const clone = JSON.parse(JSON.stringify({ ...state, combat: null, _st: null, run: null }));
  clone._dirty = true;
  clone.rules = { ...clone.rules, autoEquip: false, autoBuy: true, autoSell: 0 };
  const g0 = clone.gold, k0 = clone.totals.kills, d0 = clone.totals.deaths, x0 = totalXp(clone), deep0 = clone.deepest;
  const stash0 = clone.stash.length;
  const SAMPLE = 240;
  for (let t = 0; t < SAMPLE; t += 0.1) tick(clone, 0.1);
  if (clone.run) retreat(clone, 'stop');
  const k = secs / SAMPLE;
  const items = Math.min(40, Math.round((clone.stash.length - stash0 + (clone.totals.sold - state.totals.sold)) * k));
  const rep = { secs, capped: seconds > OFFLINE_CAP_H * 3600, from: bestCheckpoint(state), deepest: Math.max(state.deepest, clone.deepest), kills: Math.round((clone.totals.kills - k0) * k),
    gold: Math.round((clone.gold - g0) * k), xp: Math.round((totalXp(clone) - x0) * k), deaths: Math.round((clone.totals.deaths - d0) * k), dives: 0, items, levels: 0, equipped: 0, sold: 0 };
  state.gold += Math.max(0, rep.gold); state.totals.kills += rep.kills; state.totals.deaths += rep.deaths;
  const l0 = state.level; gainXp(state, rep.xp); rep.levels = state.level - l0;
  // depth only advances as far as the sample actually got
  state.deepest = Math.max(state.deepest, Math.min(clone.deepest, deep0 + Math.ceil((clone.deepest - deep0) * Math.min(k, 3))));
  rep.deepest = state.deepest;
  const st = stats(state);
  for (let i = 0; i < items; i++) {
    const it = makeItem(rand(bestCheckpoint(state), Math.max(bestCheckpoint(state), clone.deepest)), { find: st.find });
    if (state.rules.autoEquip && itemPower(state, it) > 0) { equip(state, it); rep.equipped++; }
    else if (it.rarity < state.rules.autoSell) { state.stash.push(it); sell(state, it); rep.sold++; }
    else state.stash.unshift(it);
  }
  while (state.stash.length > STASH_CAP) { const v = state.stash.filter((x) => !x.locked).sort((a, b) => itemValue(a) - itemValue(b))[0]; if (!v) break; sell(state, v); rep.sold++; }
  if (state.rules.autoBuy) buyPotions(state, 99);
  dirty(state);
  return rep;
}
function totalXp(s) { let t = s.xp; for (let l = 1; l < s.level; l++) t += xpToNext(l); return t; }
export { itemValue, upgradeCost, UPGRADE_MAX, LOOKS };
