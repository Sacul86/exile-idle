// Pocket Realm engine: pure game logic (no rendering). Combat, gathering, crafting, loot, pets,
// achievements, quests, ascension and offline progress.
import {
  HEROES, HERO, HeroId, MAX_FIGHTERS, BIOMES, biomeOf, cycleOf, KILLS_PER_STAGE, BOSS_EVERY, BOSS_TIME, MONSTER_NAMES, RARITIES, Slot,
  GATHER, GatherSkill, GATHER_KEYS, RES_KEY, SkillId, levelFromXp, FOODS, POTIONS, PotionId, PETS, SOUL_TREE, soulsFor, ASCEND_STAGE,
  ACHIEVEMENTS, QUESTS, WEAPON_NAMES, ARMOR_NAMES, TRINKET_NAMES, TIER_NAMES, XP_TABLE,
} from '../data/content';

export const T = { MHP: 10, HPG: 1.55, HPG2: 1.3, KNEE: 50, MDMG: 1.2, DMGG: 1.5, DMGG2: 1.28, GOLD: 0.5, LVLC: 1.075, MILESTONE: 3, DROP: 0.05, RECRUIT: 1 };
const ENV: any = (globalThis as any).process?.env || {};
for (const k of Object.keys(T) as (keyof typeof T)[]) if (ENV['T_' + k]) T[k] = +ENV['T_' + k];
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <X,>(a: X[]) => a[Math.floor(Math.random() * a.length)];

export type Job = 'fight' | 'idle' | GatherSkill;
export interface Item { id: string; slot: Slot; hero: HeroId | null; tier: number; rarity: number; ilvl: number; stat: number; kind?: 'gold' | 'crit' | 'drop'; crafted?: boolean; locked?: boolean; isNew?: boolean }
export interface HeroState { level: number; job: Job; node: number; gear: Partial<Record<Slot, Item>>; hp: number; cd: number; atk: number; prog: number; dead: number }
export interface GameState {
  v: number; gold: number; souls: number; ascensions: number; stage: number; runMax: number; maxStage: number; kills: number; bossT: number; autoAdvance: boolean; retryAt: number;
  heroes: Partial<Record<HeroId, HeroState>>; inventory: Item[]; mats: Record<string, number>; skillXp: Record<SkillId, number>; skillLv: Record<SkillId, number>;
  pets: Record<string, boolean>; ach: Record<string, boolean>; quest: number; soul: Record<string, number>; buffs: Partial<Record<PotionId, number>>; food: number;
  frenzy: number; frenzyT: number; tapAcc: number;
  stats: { kills: number; bosses: number; taps: number; frenzies: number; bestRarity: number; equips: number; potions: number; goldEarned: number; time: number; wipes: number };
  settings: { music: boolean; sfx: boolean; musicVol: number; sfxVol: number; dmgNums: boolean; shake: boolean; autoEquip: boolean; autoSalvage: number; buy: number };
  lastSeen: number; started: boolean;
}
export interface Monster { key: string; name: string; hp: number; maxHp: number; dmg: number; atkT: number; boss: boolean; id: number }
export interface Runtime { monster: Monster | null; events: any[]; spawnT: number; shield: number; rage: number; eatT: number; checkT: number; mid: number; holding: boolean; holdT: number }

const SKILLS: SkillId[] = ['mining', 'woodcutting', 'fishing', 'foraging', 'smithing', 'cooking', 'alchemy'];
export function newGame(): GameState {
  const mats: Record<string, number> = {};
  for (const k of ['ore', 'log', 'fish', 'herb', 'food', 'pot']) for (let i = 0; i < 5; i++) mats[k + i] = 0;
  return {
    v: 1, gold: 0, souls: 0, ascensions: 0, stage: 1, runMax: 1, maxStage: 1, kills: 0, bossT: 0, autoAdvance: true, retryAt: 0,
    heroes: { knight: newHero('fight') }, inventory: [], mats,
    skillXp: Object.fromEntries(SKILLS.map((k) => [k, 0])) as any, skillLv: Object.fromEntries(SKILLS.map((k) => [k, 1])) as any,
    pets: {}, ach: {}, quest: 0, soul: {}, buffs: {}, food: 0, frenzy: 0, frenzyT: 0, tapAcc: 0,
    stats: { kills: 0, bosses: 0, taps: 0, frenzies: 0, bestRarity: -1, equips: 0, potions: 0, goldEarned: 0, time: 0, wipes: 0 },
    settings: { music: true, sfx: true, musicVol: 0.5, sfxVol: 0.6, dmgNums: true, shake: true, autoEquip: true, autoSalvage: 1, buy: 1 },
    lastSeen: Date.now(), started: false,
  };
}
const newHero = (job: Job): HeroState => ({ level: 1, job, node: 0, gear: {}, hp: 1e9, cd: 2, atk: Math.random(), prog: 0, dead: 0 });

// ---------------- numbers ----------------
const curve = (s: number, a: number, b: number) => Math.pow(a, Math.min(s, T.KNEE) - 1) * Math.pow(b, Math.max(0, s - T.KNEE));
export const monsterHp = (s: number) => T.MHP * curve(s, T.HPG, T.HPG2);
export const monsterDmg = (s: number) => T.MDMG * curve(s, T.DMGG, T.DMGG2);
export const goldFor = (s: number) => T.GOLD * curve(s, T.HPG, T.HPG2);
export const isBossStage = (s: number) => s % BOSS_EVERY === 0;
export const levelCost = (id: HeroId, lvl: number) => HERO[id].costBase * Math.pow(T.LVLC, lvl - 1);
export function levelCostN(id: HeroId, lvl: number, n: number) { const r = T.LVLC; return HERO[id].costBase * Math.pow(r, lvl - 1) * (Math.pow(r, n) - 1) / (r - 1); }
export function maxAffordable(id: HeroId, lvl: number, gold: number) { const r = T.LVLC, c = HERO[id].costBase * Math.pow(r, lvl - 1); return Math.max(0, Math.floor(Math.log(gold * (r - 1) / c + 1) / Math.log(r))); }
export const recruitCost = (id: HeroId) => HERO[id].recruit * T.RECRUIT;
const milestone = (l: number) => Math.pow(T.MILESTONE, Math.floor(l / 25));

function bonus(s: GameState, stat: string) {
  let b = 0;
  for (const a of ACHIEVEMENTS) if (s.ach[a.id] && a.bonus.stat === stat) b += a.bonus.value;
  for (const p of PETS) if (s.pets[p.id] && p.stat === stat) b += p.value;
  return b;
}
export function globalDmg(s: GameState, rt?: Runtime) {
  let m = (1 + bonus(s, 'dmg')) * (1 + 0.5 * (s.soul.might || 0));
  if (s.buffs.might) m *= 2;
  if (s.buffs.titan) m *= 3;
  if (s.frenzyT > 0) m *= 2;
  if (rt && rt.rage > 0) m *= 3;
  return m;
}
export const goldMult = (s: GameState) => (1 + bonus(s, 'gold') + trinketSum(s, 'gold') / 100) * (1 + 0.4 * (s.soul.greed || 0)) * (s.buffs.fortune ? 2 : 1) * (s.frenzyT > 0 ? 2 : 1);
export const dropMult = (s: GameState) => (1 + bonus(s, 'drop') + trinketSum(s, 'drop') / 100 + 0.1 * (s.soul.loot || 0)) * (s.buffs.fortune ? 2 : 1);
function trinketSum(s: GameState, kind: string) { let t = 0; for (const h of Object.values(s.heroes)) { const it = h!.gear.trinket; if (it && it.kind === kind) t += it.stat; } return t; }
export function heroDps(s: GameState, id: HeroId, rt?: Runtime) {
  const h = s.heroes[id]!; const d = HERO[id];
  const w = h.gear.weapon ? h.gear.weapon.stat : 0;
  return d.dps * h.level * milestone(h.level) * (1 + w / 100) * globalDmg(s, rt);
}
// DPS gained by buying n levels (n<=0 = max affordable)
export function dpsGain(s: GameState, id: HeroId, n: number) {
  const h = s.heroes[id]; if (!h) return 0;
  const before = heroDps(s, id), l0 = h.level; h.level += n; const after = heroDps(s, id); h.level = l0; return after - before;
}
export function heroMaxHp(s: GameState, id: HeroId) {
  const h = s.heroes[id]!; const d = HERO[id];
  const a = h.gear.armor ? h.gear.armor.stat : 0;
  return d.hp * (1 + 0.6 * h.level) * milestone(h.level) * (1 + a / 100) * (1 + bonus(s, 'hp')) * (1 + 0.5 * (s.soul.vigor || 0)) * (s.buffs.titan ? 3 : 1);
}
export const heroCrit = (s: GameState, id: HeroId) => Math.min(80, HERO[id].crit + (s.heroes[id]!.gear.trinket?.kind === 'crit' ? s.heroes[id]!.gear.trinket!.stat / 5 : 0));
export const fighters = (s: GameState) => (Object.keys(s.heroes) as HeroId[]).filter((id) => s.heroes[id]!.job === 'fight');
export const partyDps = (s: GameState) => fighters(s).reduce((t, id) => t + heroDps(s, id) * (1 + heroCrit(s, id) / 100), 0);
export const tapDamage = (s: GameState) => Math.max(1, partyDps(s) * 0.08 + 1) * (1 + 0.5 * (s.soul.tap || 0) + bonus(s, 'tap'));
export const bossTime = (s: GameState) => BOSS_TIME + 3 * (s.soul.time || 0) + bonus(s, 'bosstime');
export const gatherSpeed = (s: GameState, id: HeroId) => (1 + s.heroes[id]!.level / 150 + 0.1 * (s.soul.skills || 0) + bonus(s, 'gather')) * (s.buffs.haste ? 1.5 : 1);
export const xpMult = (s: GameState) => (s.buffs.wisdom ? 2 : 1) * (1 + 0.1 * (s.soul.skills || 0));
export const power = (s: GameState) => Math.round(partyDps(s));

// ---------------- runtime ----------------
export function newRuntime(): Runtime { return { monster: null, events: [], spawnT: 0.3, shield: 0, rage: 0, eatT: 0, checkT: 0, mid: 0, holding: false, holdT: 0 }; }
const ev = (rt: Runtime, e: any) => { if (rt.events.length < 300) rt.events.push(e); };

function spawn(s: GameState, rt: Runtime) {
  const b = biomeOf(s.stage), boss = isBossStage(s.stage);
  const cyc = cycleOf(s.stage);
  const hp = monsterHp(s.stage) * (boss ? 8 : 1);
  rt.monster = { key: boss ? b.boss : pick(b.monsters), name: boss ? b.bossName : MONSTER_NAMES[pick(b.monsters)] || 'Monster', hp, maxHp: hp, dmg: monsterDmg(s.stage) * (boss ? 2.5 : 1), atkT: 1.2, boss, id: ++rt.mid };
  if (!boss) rt.monster.name = MONSTER_NAMES[rt.monster.key] || 'Monster';
  if (cyc > 0) rt.monster.name = (['', 'Elder ', 'Ancient ', 'Primal ', 'Mythic '][Math.min(4, cyc)] || 'Mythic ') + rt.monster.name;
  if (boss) s.bossT = bossTime(s);
  ev(rt, { t: 'spawn', boss, key: rt.monster.key });
}

export function tick(s: GameState, rt: Runtime, dt: number) {
  s.stats.time += dt;
  for (const k of Object.keys(s.buffs) as PotionId[]) { s.buffs[k]! -= dt; if (s.buffs[k]! <= 0) delete s.buffs[k]; }
  if (s.frenzyT > 0) s.frenzyT -= dt;
  else if (rt.holding) { s.frenzy += dt * 100 / FRENZY_CHARGE; if (s.frenzy >= 100) { s.frenzy = 100; s.frenzyT = FRENZY_TIME; s.stats.frenzies++; ev(rt, { t: 'frenzy' }); } }
  else s.frenzy = Math.max(0, s.frenzy - dt * 12);
  if (rt.holding) { rt.holdT -= dt; if (rt.holdT <= 0) { rt.holdT += 1 / HOLD_RATE; strike(s, rt); } }
  gatherTick(s, rt, dt);
  combatTick(s, rt, dt);
  rt.checkT -= dt;
  if (rt.checkT <= 0) { rt.checkT = 1; checkProgress(s, rt); }
}

function combatTick(s: GameState, rt: Runtime, dt: number) {
  const ids = fighters(s);
  if (rt.shield > 0) rt.shield -= dt;
  if (rt.rage > 0) rt.rage -= dt;
  rt.eatT = Math.max(0, rt.eatT - dt);
  for (const id of ids) {
    const h = s.heroes[id]!, mx = heroMaxHp(s, id);
    if (h.hp > mx) h.hp = mx;
    if (h.dead > 0) { h.dead -= dt; if (h.dead <= 0) { h.hp = mx * 0.5; ev(rt, { t: 'revive', id }); } continue; }
    h.hp = Math.min(mx, h.hp + mx * 0.01 * dt);
  }
  if (!rt.monster) { rt.spawnT -= dt; if (rt.spawnT <= 0) spawn(s, rt); return; }
  const m = rt.monster;
  const alive = ids.filter((id) => s.heroes[id]!.dead <= 0);
  // heroes attack
  const haste = s.buffs.haste ? 1.5 : 1;
  for (const id of alive) {
    const h = s.heroes[id]!;
    h.atk += dt * haste;
    if (h.atk >= 1) {
      h.atk -= 1;
      const crit = Math.random() * 100 < heroCrit(s, id);
      hitMonster(s, rt, heroDps(s, id, rt) * (crit ? 3 : 1) * rand(0.9, 1.1), { hero: id, crit });
      if (!rt.monster) return;
    }
    h.cd -= dt;
    if (h.cd <= 0) { h.cd = HERO[id].ability.cd; ability(s, rt, id); if (!rt.monster) return; }
  }
  // monster attacks
  if (alive.length) {
    m.atkT -= dt;
    if (m.atkT <= 0) {
      m.atkT = m.boss ? 1.1 : 1.4;
      const tgt = alive.includes('knight') ? 'knight' : pick(alive);
      const h = s.heroes[tgt]!;
      let d = m.dmg * rand(0.85, 1.15) * (tgt === 'knight' ? 0.6 : 1) * (rt.shield > 0 ? 0.4 : 1);
      h.hp -= d;
      ev(rt, { t: 'mhit', id: tgt, dmg: d });
      if (h.hp <= 0) { h.hp = 0; h.dead = 8; ev(rt, { t: 'down', id: tgt }); }
      // food
      if (rt.eatT <= 0 && s.mats['food' + s.food] > 0 && alive.some((id) => s.heroes[id]!.hp < heroMaxHp(s, id) * 0.5)) {
        s.mats['food' + s.food]--; rt.eatT = 3;
        const k = FOODS[s.food].heal * (1 + bonus(s, 'food'));
        for (const id of alive) s.heroes[id]!.hp = Math.min(heroMaxHp(s, id), s.heroes[id]!.hp + heroMaxHp(s, id) * k);
        ev(rt, { t: 'eat', food: s.food });
      }
      if (ids.every((id) => s.heroes[id]!.dead > 0)) wipe(s, rt);
    }
  }
  // boss timer
  if (m.boss && rt.monster) {
    s.bossT -= dt;
    if (s.bossT <= 0) bossFail(s, rt);
  }
}

function ability(s: GameState, rt: Runtime, id: HeroId) {
  const k = HERO[id].ability.kind;
  ev(rt, { t: 'ability', id, kind: k });
  const dps = heroDps(s, id, rt);
  if (k === 'burst') hitMonster(s, rt, dps * 6, { hero: id, crit: true, ability: true });
  else if (k === 'volley') { for (let i = 0; i < 5 && rt.monster; i++) hitMonster(s, rt, dps * 1.2, { hero: id, crit: false, ability: true, volley: i }); }
  else if (k === 'crit') hitMonster(s, rt, dps * 5, { hero: id, crit: true, ability: true });
  else if (k === 'heal') { for (const f of fighters(s)) { const h = s.heroes[f]!; if (h.dead <= 0) h.hp = Math.min(heroMaxHp(s, f), h.hp + heroMaxHp(s, f) * 0.35); } }
  else if (k === 'shield') rt.shield = 5;
  else if (k === 'rage') rt.rage = 6;
}

export function hitMonster(s: GameState, rt: Runtime, dmg: number, o: any) {
  const m = rt.monster; if (!m) return;
  m.hp -= dmg;
  ev(rt, { t: 'hit', dmg, ...o });
  if (m.hp <= 0) killMonster(s, rt);
}
// Hold the battle screen: charges Frenzy (FRENZY_CHARGE seconds to fill) and lands HOLD_RATE strikes/s.
export const FRENZY_CHARGE = 6, FRENZY_TIME = 15, HOLD_RATE = 6;
export function setHolding(rt: Runtime, on: boolean) { if (on && !rt.holding) rt.holdT = 0; rt.holding = on; }
export function tap(s: GameState, rt: Runtime) { strike(s, rt); }
function strike(s: GameState, rt: Runtime) {
  s.stats.taps++;
  if (Math.random() < (PETS.find((p) => p.id === 'butterfly')!.chance) && !s.pets.butterfly) givePet(s, rt, 'butterfly');
  if (rt.monster) hitMonster(s, rt, tapDamage(s) * (s.frenzyT > 0 ? 2 : 1), { tap: true, crit: Math.random() < 0.1 });
}

function killMonster(s: GameState, rt: Runtime) {
  const m = rt.monster!; rt.monster = null; rt.spawnT = 0.45;
  s.stats.kills++;
  const g = goldFor(s.stage) * (m.boss ? 12 : 1) * rand(0.9, 1.1) * goldMult(s);
  s.gold += g; s.stats.goldEarned += g;
  ev(rt, { t: 'kill', boss: m.boss, gold: g, key: m.key });
  // loot
  const chance = (m.boss ? 1 : T.DROP) * dropMult(s);
  for (let n = 0; n < (m.boss ? 1 + (Math.random() < 0.3 ? 1 : 0) : 1); n++) if (Math.random() < chance) { const it = makeItem(s, s.stage, { minRarity: m.boss ? 1 : 0 }); gainItem(s, rt, it); }
  if (Math.random() < PETS.find((p) => p.id === 'hippogriff')!.chance) givePet(s, rt, 'hippogriff');
  if (m.boss) {
    s.stats.bosses++;
    for (const p of PETS) if (p.from === 'boss' && !s.pets[p.id] && Math.random() < p.chance) givePet(s, rt, p.id);
    advance(s, rt);
  } else {
    s.kills++;
    if (s.kills >= KILLS_PER_STAGE) {
      s.kills = 0;
      if (!s.autoAdvance && s.retryAt > 0) { s.retryAt--; if (s.retryAt === 0) { s.autoAdvance = true; ev(rt, { t: 'retry' }); } }
      if (s.autoAdvance) advance(s, rt); else ev(rt, { t: 'stageLoop' });
    }
  }
}
function advance(s: GameState, rt: Runtime) {
  s.stage++; s.kills = 0;
  if (s.stage > s.runMax) s.runMax = s.stage;
  if (s.stage > s.maxStage) s.maxStage = s.stage;
  ev(rt, { t: 'stage', stage: s.stage, newBiome: (s.stage - 1) % 10 === 0 });
  for (const id of fighters(s)) { const h = s.heroes[id]!; if (h.dead <= 0) h.hp = Math.min(heroMaxHp(s, id), h.hp + heroMaxHp(s, id) * 0.25); }
}
function bossFail(s: GameState, rt: Runtime) {
  rt.monster = null; rt.spawnT = 1;
  s.stage = Math.max(1, s.stage - 1); s.kills = 0; s.autoAdvance = false; s.retryAt = 2;
  ev(rt, { t: 'bossFail' });
}
function wipe(s: GameState, rt: Runtime) {
  s.stats.wipes++;
  rt.monster = null; rt.spawnT = 2;
  for (const id of fighters(s)) { const h = s.heroes[id]!; h.dead = 0; h.hp = heroMaxHp(s, id); }
  if (s.stage > 1) { s.stage--; s.autoAdvance = false; s.retryAt = 3; }
  s.kills = 0;
  ev(rt, { t: 'wipe' });
}
export function setStage(s: GameState, rt: Runtime, stage: number) {
  s.stage = Math.max(1, Math.min(stage, s.runMax)); s.kills = 0; rt.monster = null; rt.spawnT = 0.3;
}

// ---------------- items ----------------
let iid = Date.now() % 1e7;
export function makeItem(s: GameState, ilvl: number, o: { minRarity?: number; slot?: Slot; hero?: HeroId; rarityBoost?: number; tier?: number; crafted?: boolean } = {}): Item {
  const slot: Slot = o.slot || (Math.random() < 0.4 ? 'weapon' : Math.random() < 0.6 ? 'armor' : 'trinket');
  const recruited = Object.keys(s.heroes) as HeroId[];
  const hero = slot === 'weapon' ? o.hero || pick(recruited) : null;
  const w = [60, 26, 10, 3.4, 0.6].map((x, i) => x * Math.pow(1 + (o.rarityBoost || 0) + ilvl / 120, i));
  let r = Math.random() * w.reduce((a, b) => a + b, 0), rarity = 0;
  for (let i = 0; i < 5; i++) { r -= w[i]; if (r <= 0) { rarity = i; break; } }
  rarity = Math.max(rarity, o.minRarity || 0);
  const tier = o.tier ?? Math.min(4, Math.floor((ilvl - 1) / 20));
  const base = 8 * (1 + ilvl * 0.35) * RARITIES[rarity].mult * (1 + tier * 0.1) * rand(0.85, 1.15) * (o.crafted ? 1.15 : 1);
  const kind = slot === 'trinket' ? pick(['gold', 'crit', 'drop'] as const) : undefined;
  const stat = slot === 'trinket' ? (kind === 'gold' ? base * 0.8 : kind === 'crit' ? Math.min(150, base * 0.6) : Math.min(200, base * 0.5)) : base;
  return { id: (++iid).toString(36), slot, hero, tier, rarity, ilvl, stat: Math.round(stat), kind, crafted: o.crafted, isNew: true };
}
export const itemName = (it: Item) => `${it.slot === 'weapon' ? WEAPON_NAMES[it.hero!][it.tier] : it.slot === 'armor' ? ARMOR_NAMES[it.tier] : TRINKET_NAMES[it.tier]}`;
export const itemIcon = (it: Item) => (it.slot === 'weapon' ? HERO[it.hero!].weapon : it.slot === 'armor' ? 'ar' : 'tr') + it.tier;
export const itemStatText = (it: Item) => it.slot === 'weapon' ? `+${fmt(it.stat)}% damage` : it.slot === 'armor' ? `+${fmt(it.stat)}% life` : it.kind === 'gold' ? `+${fmt(it.stat)}% gold` : it.kind === 'crit' ? `+${(it.stat / 5).toFixed(1)}% crit chance` : `+${fmt(it.stat)}% drop chance`;
export const salvageValue = (s: GameState, it: Item) => Math.round(goldFor(Math.max(1, Math.min(it.ilvl, s.runMax))) * 3 * RARITIES[it.rarity].salvage);
// how much better is this item for a hero (0 if not usable)
export function upgradeFor(s: GameState, it: Item, id: HeroId) {
  if (it.slot === 'weapon' && it.hero !== id) return 0;
  const cur = s.heroes[id]?.gear[it.slot];
  if (!cur) return it.stat + 1;
  if (it.slot === 'trinket' && cur.kind !== it.kind) return cur.kind === 'crit' || it.kind !== 'crit' ? 0 : 0;
  return it.stat - cur.stat;
}
export function bestHeroFor(s: GameState, it: Item): HeroId | null {
  let best: HeroId | null = null, bv = 0;
  for (const id of Object.keys(s.heroes) as HeroId[]) {
    let v = upgradeFor(s, it, id);
    if (s.heroes[id]!.job === 'fight') v *= 1.5;
    if (v > bv) { bv = v; best = id; }
  }
  return best;
}
export function gainItem(s: GameState, rt: Runtime | null, it: Item) {
  if (it.rarity > s.stats.bestRarity) s.stats.bestRarity = it.rarity;
  let res = 'bag';
  const h = s.settings.autoEquip ? bestHeroFor(s, it) : null;
  if (h) { equip(s, h, it); res = 'equipped'; }
  else if (it.rarity < s.settings.autoSalvage) { s.gold += salvageValue(s, it); res = 'salvaged'; }
  else { s.inventory.unshift(it); trimBag(s); }
  if (rt) ev(rt, { t: 'drop', rarity: it.rarity, res, icon: itemIcon(it), name: itemName(it), hero: h });
  return res;
}
export const BAG_CAP = 40;
function trimBag(s: GameState) {
  while (s.inventory.length > BAG_CAP) {
    const v = s.inventory.filter((x) => !x.locked).sort((a, b) => a.rarity - b.rarity || a.stat - b.stat)[0];
    if (!v) break; salvage(s, v);
  }
}
export function equip(s: GameState, id: HeroId, it: Item) {
  const h = s.heroes[id]; if (!h) return;
  if (it.slot === 'weapon' && it.hero !== id) return;
  s.inventory = s.inventory.filter((x) => x.id !== it.id);
  const old = h.gear[it.slot]; h.gear[it.slot] = it; it.isNew = false;
  if (old) { s.inventory.unshift(old); trimBag(s); }
  s.stats.equips++;
}
export function unequip(s: GameState, id: HeroId, slot: Slot) { const h = s.heroes[id]; const it = h?.gear[slot]; if (!it) return; delete h!.gear[slot]; s.inventory.unshift(it); }
export function salvage(s: GameState, it: Item) { if (it.locked) return 0; s.inventory = s.inventory.filter((x) => x.id !== it.id); const g = salvageValue(s, it); s.gold += g; return g; }
export function salvageBelow(s: GameState, rarity: number) { let g = 0, n = 0; for (const it of [...s.inventory]) if (it.rarity < rarity && !it.locked) { g += salvage(s, it); n++; } return { g, n }; }
export function equipBest(s: GameState) {
  let n = 0;
  for (const it of [...s.inventory].sort((a, b) => b.stat - a.stat)) { const h = bestHeroFor(s, it); if (h) { equip(s, h, it); n++; } }
  return n;
}

// ---------------- heroes ----------------
export function levelUp(s: GameState, id: HeroId, n: number) {
  const h = s.heroes[id]; if (!h) return 0;
  if (n <= 0) n = maxAffordable(id, h.level, s.gold);
  if (n <= 0) return 0;
  const c = levelCostN(id, h.level, n);
  if (c > s.gold) return 0;
  s.gold -= c; const before = h.level; h.level += n;
  if (Math.floor(before / 25) !== Math.floor(h.level / 25)) h.hp = heroMaxHp(s, id);
  return n;
}
export function recruit(s: GameState, id: HeroId) {
  if (s.heroes[id] || s.gold < recruitCost(id) || s.maxStage < HERO[id].recruitStage) return false;
  s.gold -= recruitCost(id);
  s.heroes[id] = newHero(fighters(s).length < MAX_FIGHTERS ? 'fight' : 'idle');
  return true;
}
export function setJob(s: GameState, id: HeroId, job: Job, node = 0) {
  const h = s.heroes[id]; if (!h) return false;
  if (job === 'fight' && h.job !== 'fight' && fighters(s).length >= MAX_FIGHTERS) return false;
  h.job = job; h.node = node; h.prog = 0;
  if (job === 'fight') { h.hp = heroMaxHp(s, id); h.dead = 0; }
  return true;
}

// ---------------- skills ----------------
function addXp(s: GameState, rt: Runtime | null, sk: SkillId, xp: number) {
  s.skillXp[sk] += xp * xpMult(s);
  const l = levelFromXp(s.skillXp[sk]);
  if (l > s.skillLv[sk]) { s.skillLv[sk] = l; if (rt) ev(rt, { t: 'skillLevel', skill: sk, level: l }); }
}
export const xpProgress = (s: GameState, sk: SkillId) => { const l = s.skillLv[sk]; if (l >= 99) return 1; return (s.skillXp[sk] - XP_TABLE[l]) / (XP_TABLE[l + 1] - XP_TABLE[l]); };
function givePet(s: GameState, rt: Runtime | null, id: string) { if (s.pets[id]) return; s.pets[id] = true; if (rt) ev(rt, { t: 'pet', id }); }
function gatherTick(s: GameState, rt: Runtime, dt: number) {
  for (const id of Object.keys(s.heroes) as HeroId[]) {
    const h = s.heroes[id]!;
    if (h.job === 'fight' || h.job === 'idle') continue;
    const sk = h.job, nd = GATHER[sk].nodes[h.node];
    if (!nd || s.skillLv[sk] < nd.level) { h.node = 0; continue; }
    h.prog += dt * gatherSpeed(s, id) / nd.time;
    while (h.prog >= 1) {
      h.prog -= 1;
      s.mats[RES_KEY[sk] + h.node]++;
      addXp(s, rt, sk, nd.xp);
      ev(rt, { t: 'gather', id, skill: sk, node: h.node });
      const pet = PETS.find((p) => p.from === sk)!;
      if (!s.pets[pet.id] && Math.random() < pet.chance) givePet(s, rt, pet.id);
    }
  }
}
export const gatherRate = (s: GameState, id: HeroId) => { const h = s.heroes[id]!; if (h.job === 'fight' || h.job === 'idle') return 0; return gatherSpeed(s, id) / GATHER[h.job].nodes[h.node].time; };

// crafting recipes
export const smithCost = (t: number) => ({ ['ore' + t]: 4 + 4 * t, ['log' + t]: 2 + 3 * t });
export const cookCost = (t: number) => ({ ['fish' + t]: 2 });
export const brewCost = (t: number) => ({ ['herb' + t]: 3, ['log' + t]: 1 });
export const craftLevel = (t: number) => [1, 15, 30, 50, 70][t];
const canPay = (s: GameState, c: Record<string, number>) => Object.entries(c).every(([k, v]) => (s.mats[k] || 0) >= v);
const pay = (s: GameState, c: Record<string, number>) => { for (const [k, v] of Object.entries(c)) s.mats[k] -= v; };
export const canCraft = (s: GameState, kind: 'smith' | 'cook' | 'brew', t: number) => s.skillLv[kind === 'smith' ? 'smithing' : kind === 'cook' ? 'cooking' : 'alchemy'] >= craftLevel(t) && canPay(s, kind === 'smith' ? smithCost(t) : kind === 'cook' ? cookCost(t) : brewCost(t));
function rollPet(s: GameState, rt: Runtime | null, sk: SkillId) { const p = PETS.find((x) => x.from === sk); if (p && !s.pets[p.id] && Math.random() < p.chance) givePet(s, rt, p.id); }
export function smith(s: GameState, rt: Runtime | null, t: number, slot: Slot, hero?: HeroId) {
  if (!canCraft(s, 'smith', t)) return null;
  pay(s, smithCost(t));
  addXp(s, rt, 'smithing', 25 * Math.pow(t + 1, 1.6));
  rollPet(s, rt, 'smithing');
  const ilvl = Math.max(5, s.maxStage) + t * 4;
  const it = makeItem(s, ilvl, { slot, hero, tier: t, minRarity: 1, rarityBoost: s.skillLv.smithing / 60, crafted: true });
  gainItem(s, rt, it);
  return it;
}
export function cook(s: GameState, rt: Runtime | null, t: number, n = 1) {
  let made = 0;
  for (let i = 0; i < n && canCraft(s, 'cook', t); i++) { pay(s, cookCost(t)); const dbl = Math.random() < bonus(s, 'double'); s.mats['food' + t] += dbl ? 2 : 1; made++; addXp(s, rt, 'cooking', 12 * Math.pow(t + 1, 1.6)); rollPet(s, rt, 'cooking'); }
  if (made && t > s.food) s.food = t;
  return made;
}
export function brew(s: GameState, rt: Runtime | null, t: number, n = 1) {
  let made = 0;
  for (let i = 0; i < n && canCraft(s, 'brew', t); i++) { pay(s, brewCost(t)); s.mats['pot' + t] += Math.random() < bonus(s, 'double') ? 2 : 1; made++; addXp(s, rt, 'alchemy', 18 * Math.pow(t + 1, 1.6)); rollPet(s, rt, 'alchemy'); }
  return made;
}
export function drink(s: GameState, t: number) {
  if (s.mats['pot' + t] <= 0) return false;
  s.mats['pot' + t]--; s.stats.potions++;
  const p = POTIONS[t]; const id = p.id as PotionId;
  s.buffs[id] = (s.buffs[id] || 0) + p.mins * 60 * (1 + bonus(s, 'potion'));
  return true;
}

// ---------------- progress: achievements, quests ----------------
function checkProgress(s: GameState, rt: Runtime | null) {
  for (const a of ACHIEVEMENTS) if (!s.ach[a.id] && a.check(s)) { s.ach[a.id] = true; if (rt) ev(rt, { t: 'ach', id: a.id }); }
  while (s.quest < QUESTS.length && QUESTS[s.quest].check(s)) {
    const q = QUESTS[s.quest]; const g = q.gold(s); s.gold += g; s.quest++;
    if (rt) ev(rt, { t: 'quest', text: q.text, gold: g });
  }
}

// ---------------- ascension ----------------
export const soulGain = (s: GameState) => Math.floor(soulsFor(s.runMax) * (1 + bonus(s, 'souls')));
export const canAscend = (s: GameState) => s.runMax >= ASCEND_STAGE;
export function ascend(s: GameState, rt: Runtime) {
  if (!canAscend(s)) return 0;
  const g = soulGain(s);
  s.souls += g; s.ascensions++;
  if (!s.pets.cherub) givePet(s, rt, 'cherub');
  s.gold = 0; s.stage = 1 + 5 * (s.soul.headstart || 0); s.runMax = s.stage; s.kills = 0; s.autoAdvance = true; s.retryAt = 0;
  for (const h of Object.values(s.heroes)) { h!.level = 1; h!.hp = 1e9; h!.dead = 0; }
  s.frenzy = 0; s.frenzyT = 0;
  rt.monster = null; rt.spawnT = 0.5;
  ev(rt, { t: 'ascend', souls: g });
  return g;
}
export const soulCost = (id: string, s: GameState) => SOUL_TREE.find((x) => x.id === id)!.cost(s.soul[id] || 0);
export function buySoul(s: GameState, id: string) {
  const u = SOUL_TREE.find((x) => x.id === id)!; const r = s.soul[id] || 0;
  if (r >= u.max || s.souls < u.cost(r)) return false;
  s.souls -= u.cost(r); s.soul[id] = r + 1; return true;
}

// ---------------- offline ----------------
export interface OfflineReport { secs: number; capped: boolean; kills: number; gold: number; items: number; equipped: number; mats: Record<string, number>; xp: Record<string, number>; levels: Record<string, number>; stage: number; pets: string[] }
export const offlineCap = (s: GameState) => (12 + 2 * (s.soul.offline || 0)) * 3600;
export function offline(s: GameState, secs: number): OfflineReport | null {
  const cap = offlineCap(s);
  const t = Math.min(secs, cap);
  if (t < 60) return null;
  const rep: OfflineReport = { secs: t, capped: secs > cap, kills: 0, gold: 0, items: 0, equipped: 0, mats: {}, xp: {}, levels: {}, stage: s.stage, pets: [] };
  // combat: farm the current stage (no advancing while away)
  const dps = partyDps(s);
  const fs = isBossStage(s.stage) ? Math.max(1, s.stage - 1) : s.stage; rep.stage = fs;
  if (dps > 0) {
    const perKill = monsterHp(fs) / dps + 0.45;
    rep.kills = Math.floor(t / perKill);
    rep.gold = goldFor(fs) * rep.kills * goldMult(s);
    s.gold += rep.gold; s.stats.goldEarned += rep.gold; s.stats.kills += rep.kills;
    const drops = Math.min(30, Math.round(rep.kills * T.DROP * dropMult(s)));
    for (let i = 0; i < drops; i++) { const r = gainItem(s, null, makeItem(s, fs)); rep.items++; if (r === 'equipped') rep.equipped++; }
  }
  // gathering is exact
  const lv0 = { ...s.skillLv };
  const petsBefore = new Set(Object.keys(s.pets));
  for (const id of Object.keys(s.heroes) as HeroId[]) {
    const h = s.heroes[id]!; if (h.job === 'fight' || h.job === 'idle') continue;
    const sk = h.job, nd = GATHER[sk].nodes[h.node];
    const n = Math.floor(t * gatherSpeed(s, id) / nd.time);
    const key = RES_KEY[sk] + h.node;
    s.mats[key] += n; rep.mats[key] = (rep.mats[key] || 0) + n;
    const before = s.skillXp[sk]; addXp(s, null, sk, nd.xp * n); rep.xp[sk] = (rep.xp[sk] || 0) + s.skillXp[sk] - before;
    const pet = PETS.find((p) => p.from === sk)!;
    if (!s.pets[pet.id] && Math.random() < 1 - Math.pow(1 - pet.chance, n)) givePet(s, null, pet.id);
  }
  for (const k of Object.keys(s.skillLv) as SkillId[]) if (s.skillLv[k] > lv0[k]) rep.levels[k] = s.skillLv[k] - lv0[k];
  rep.pets = Object.keys(s.pets).filter((p) => !petsBefore.has(p));
  checkProgress(s, null);
  return rep;
}

// ---------------- save ----------------
export const SAVE_KEY = 'pocket-realm-v1';
export function save(s: GameState) { s.lastSeen = Date.now(); try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch (e) { console.warn(e); } }
export function load(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY); if (!raw) return null;
    const s = JSON.parse(raw), d = newGame();
    for (const k of Object.keys(d) as (keyof GameState)[]) if ((s as any)[k] === undefined) (s as any)[k] = (d as any)[k];
    s.settings = { ...d.settings, ...s.settings }; s.stats = { ...d.stats, ...s.stats }; s.mats = { ...d.mats, ...s.mats };
    return s;
  } catch (e) { console.warn(e); return null; }
}

// ---------------- formatting ----------------
const SUF = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];
export function fmt(n: number): string {
  if (!isFinite(n)) return '∞';
  if (Math.abs(n) < 1000) return (Math.abs(n) < 10 && n % 1 ? n.toFixed(1) : Math.round(n).toString());
  const e = Math.floor(Math.log10(Math.abs(n)) / 3);
  if (e < SUF.length) { const v = n / Math.pow(1000, e); return (v < 100 ? v.toFixed(v < 10 ? 2 : 1) : Math.round(v)) + SUF[e]; }
  const ex = Math.floor(Math.log10(Math.abs(n))); return (n / Math.pow(10, ex)).toFixed(2) + 'e' + ex;
}
export const fmtTime = (secs: number) => { const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60); return h ? `${h}h ${m}m` : m ? `${m}m ${Math.floor(secs % 60)}s` : `${Math.floor(secs)}s`; };
export { HEROES, HERO, BIOMES, GATHER_KEYS, SOUL_TREE, POTIONS, FOODS, PETS, ACHIEVEMENTS, QUESTS, TIER_NAMES, RARITIES };
