// Player-facing systems: state, economy, loot handling, upgrades, crafting, companions, ascension.
import { S, CLASSES, ATTR_KEYS, LEVEL_CAP, SLOTS, RARITIES, MATERIALS, MAT_KEYS, GEMS, GEM_KEYS, RUNES, RUNE_MAX, runeCraftCost, runeSlots, INSCR_SLOTS, COMPANIONS, COMP_KEYS, EVOLUTIONS,
  RECIPES, WORLD_TIERS, ASC_PERKS, UNLOCKS, unlocked, TALENT_STATS, specOf, REGIONS, MAX_STAGE, DUNGEON_KEYS, UNIQUES } from './data.js';
import { generateItem, salvageValue, enhanceCost, refineCost, enchantCost, awakenItemCost, canAwaken, ENHANCE_MAX, REFINE_MAX, ENCHANT_MAX, makeInscription, newId } from './items.js';
import { computeStats, xpToNext, masteryXp, talentPointsTotal, talentPointsSpent, talentFree, talentMax, talentRowOpen, attrPointsTotal, attrPointsSpent, unlockedSlots } from './stats.js';
import { SKILLS, skillsForRole, SKILL_MAX, skillUpgradeCost, awakenCost } from './skills.js';

export const SAVE_KEY = 'eternal-ascent-save-v1';
export const BAG_CAP = 60;

export function newState(cls = 'warrior') {
  const s = {
    v: 1, cls, spec: null, level: 1, xp: 0, mastery: 0, masteryXp: 0,
    attrs: Object.fromEntries(ATTR_KEYS.map((k) => [k, 0])), talents: {}, skills: {}, skillRanks: {}, awakenedSkills: {},
    gear: {}, bag: [], gold: 0, mats: Object.fromEntries(MAT_KEYS.map((k) => [k, 0])), gems: {},
    runes: {}, runesEquipped: [null, null, null], inscriptions: [], inscribed: Array(INSCR_SLOTS).fill(null),
    companions: { owned: { wolf: true }, levels: { wolf: 1 }, active: 'wolf', passive: [null, null] },
    stage: 1, maxStage: 1, autoAdvance: true, retryIn: 0, worldTier: 0, maxWorldTier: 0, bossesBeaten: {},
    ascensions: 0, ascPoints: 0, ascPerks: {},
    dungeonTier: Object.fromEntries(DUNGEON_KEYS.map((k) => [k, 1])), towerBest: 0, towerClaimed: 0, riftLevel: 1, riftBest: 0, rushBest: 0,
    rules: { heal: 50, ult: 'boss', target: 'lowest', aoeMin: 2, saveDef: true, autoDodge: true },
    filters: { salvageBelow: 1, keepUniques: true, keepAffixes: [], autoEquip: true },
    settings: { view: '3d', zoom: 'mid', speed: 1, dmgNums: 'all', shake: true, sound: false, effects: 'full', text: 'm', colorSafe: false, autoOptimise: false },
    run: null, lastSeen: Date.now(), totals: { kills: 0, bosses: 0, deaths: 0, items: 0, time: 0 }, autoRepeat: true,
  };
  autoSkills(s);
  return s;
}

export function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    const d = newState(s.cls);
    for (const k of Object.keys(d)) if (s[k] === undefined) s[k] = d[k];
    for (const k of ['rules', 'filters', 'settings', 'totals', 'mats', 'dungeonTier']) s[k] = { ...d[k], ...s[k] };
    s.run = null;
    return s;
  } catch (e) { console.warn('load failed', e); return null; }
}
export function save(state) {
  state.lastSeen = Date.now();
  const { combat, _st, input, ...rest } = state;
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(rest)); } catch (e) { console.warn('save failed', e); }
}

// ---------- economy ----------
export const canAfford = (state, cost) => Object.entries(cost).every(([k, v]) => (k === 'gold' ? state.gold : state.mats[k] || 0) >= v);
export function pay(state, cost) {
  if (!canAfford(state, cost)) return false;
  for (const [k, v] of Object.entries(cost)) { if (k === 'gold') state.gold -= v; else state.mats[k] -= v; }
  return true;
}
export function gain(state, rewards) {
  for (const [k, v] of Object.entries(rewards)) {
    if (!v) continue;
    if (k === 'gold') state.gold += v; else if (MATERIALS[k]) state.mats[k] = (state.mats[k] || 0) + v;
  }
}
export const costText = (cost) => Object.entries(cost).filter(([, v]) => v).map(([k, v]) => `${k === 'gold' ? '🪙' : MATERIALS[k].icon}${fmtN(v)}`).join(' ');
const fmtN = (n) => (n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e4 ? Math.round(n / 1e3) + 'K' : Math.round(n).toString());

export function stats(state) {
  if (!state._st || state._stDirty) { state._st = computeStats(state); state._stDirty = false; }
  return state._st;
}
export const dirty = (state) => { state._stDirty = true; };

// ---------- levels, attributes ----------
export function gainXp(state, n) {
  const st = stats(state);
  state._xpg = (state._xpg || 0) + n;
  n *= 1 + st.xp / 100;
  const ups = [];
  if (state.level >= LEVEL_CAP) {
    state.masteryXp += n;
    while (state.masteryXp >= masteryXp(state.mastery)) { state.masteryXp -= masteryXp(state.mastery); state.mastery++; ups.push('mastery'); }
  } else {
    state.xp += n;
    while (state.level < LEVEL_CAP && state.xp >= xpToNext(state.level)) {
      state.xp -= xpToNext(state.level); state.level++; ups.push(state.level);
      const u = UNLOCKS.find((x) => x.lvl === state.level);
      if (u) ups.push(u);
    }
    if (state.level >= LEVEL_CAP) state.xp = 0;
  }
  if (ups.length) { autoAttrs(state); autoTalents(state); autoSkills(state); dirty(state); }
  return ups;
}
const ATTR_PRIO = { warrior: { str: 0.55, vit: 0.3, dex: 0.1, wis: 0.05 }, mage: { int: 0.55, vit: 0.25, wis: 0.15, dex: 0.05 }, ranger: { dex: 0.5, str: 0.2, vit: 0.25, wis: 0.05 },
  warlock: { int: 0.55, vit: 0.3, wis: 0.15 }, paladin: { str: 0.5, vit: 0.35, wis: 0.15 } };
export function autoAttrs(state) {
  let free = attrPointsTotal(state) - attrPointsSpent(state);
  if (free <= 0) return;
  const pr = ATTR_PRIO[state.cls];
  const total = attrPointsTotal(state);
  while (free > 0) {
    // give the point to the attribute furthest below its target share
    let best = null, gap = -1e9;
    for (const [k, w] of Object.entries(pr)) { const g = w * total - (state.attrs[k] || 0); if (g > gap) { gap = g; best = k; } }
    state.attrs[best]++; free--;
  }
}
export function resetAttrs(state) { for (const k of ATTR_KEYS) state.attrs[k] = 0; dirty(state); }

// ---------- spec & talents ----------
export const respecCost = (state) => (state.level < 30 && !state.ascensions ? 0 : Math.round(20 * S(state.level)));
export function chooseSpec(state, id) {
  if (!unlocked(state, 'spec')) return false;
  if (state.spec && state.spec !== id && !pay(state, { gold: respecCost(state) })) return false;
  state.spec = id; dirty(state); autoTalents(state, true); return true;
}
export function addTalent(state, tree, idx) {
  if (!unlocked(state, 'talents')) return false;
  if (talentPointsTotal(state) - talentPointsSpent(state) <= 0) return false;
  const arr = state.talents[tree] || (state.talents[tree] = [0, 0, 0, 0, 0, 0]);
  if (arr[idx] >= talentMax(state, tree) || !talentRowOpen(state, tree, idx)) return false;
  arr[idx]++; dirty(state); return true;
}
export function resetTalents(state) {
  if (!pay(state, { gold: respecCost(state) })) return false;
  state.talents = {}; dirty(state); return true;
}
// fill the spec tree first (damage rows before defence), then the other trees
export function autoTalents(state, force = false) {
  if (!unlocked(state, 'talents') || (!state.settings?.autoTalents && !force && state.manualTalents)) return;
  const spec = specOf(state);
  const trees = CLASSES[state.cls].trees.map((t) => t.id).sort((a, b) => (b === spec?.tree) - (a === spec?.tree));
  let guard = 200;
  while (talentPointsTotal(state) - talentPointsSpent(state) > 0 && guard-- > 0) {
    let done = false;
    for (const t of trees) {
      const order = [4, 0, 2, 3, 1, 5];
      for (const i of order) if (addTalent(state, t, i)) { done = true; break; }
      if (done) break;
    }
    if (!done) break;
  }
}

// ---------- skills ----------
export function setSkill(state, role, id) {
  if (!unlockedSlots(state).includes(role)) return false;
  const sk = SKILLS[id];
  if (!sk || sk.role !== role || sk.cls !== state.cls) return false;
  state.skills[role] = id; state.skillRanks[id] = state.skillRanks[id] || 1; dirty(state); return true;
}
export function autoSkills(state) {
  for (const role of unlockedSlots(state)) {
    if (state.skills[role]) continue;
    const spec = specOf(state);
    const opts = skillsForRole(state.cls, role);
    const pick = opts.find((s) => s.tree === spec?.tree) || opts[0];
    setSkill(state, role, pick.id);
  }
}
export function upgradeSkill(state, id) {
  const r = state.skillRanks[id] || 1;
  if (r >= SKILL_MAX || !pay(state, skillUpgradeCost(r))) return false;
  state.skillRanks[id] = r + 1; dirty(state); return true;
}
export function awakenSkill(state, id) {
  if (!unlocked(state, 'awakening') || (state.skillRanks[id] || 1) < 10 || state.awakenedSkills[id]) return false;
  if (!pay(state, awakenCost())) return false;
  state.awakenedSkills[id] = true; dirty(state); return true;
}

// ---------- gear ----------
export function itemPowerDelta(state, it, slot) {
  slot = slot || bestSlot(state, it);
  const base = stats(state).power;
  const g = { ...state.gear, [slot]: it };
  return computeStats(state, g).power - base;
}
export function bestSlot(state, it) {
  if (it.slot !== 'ring1') return it.slot;
  const a = state.gear.ring1, b = state.gear.ring2;
  if (!a) return 'ring1';
  if (!b) return 'ring2';
  return computeStats(state, { ...state.gear, ring1: it }).power >= computeStats(state, { ...state.gear, ring2: it }).power ? 'ring1' : 'ring2';
}
export function equip(state, it, slot) {
  slot = slot || bestSlot(state, it);
  const old = state.gear[slot];
  state.bag = state.bag.filter((x) => x.id !== it.id);
  state.gear[slot] = it; it.isNew = false;
  if (old) state.bag.unshift(old);
  trimBag(state);
  dirty(state);
}
export function trimBag(state) {
  while (state.bag.length > BAG_CAP) {
    let victims = state.bag.filter((x) => !keepByFilter(state, x));
    if (!victims.length) victims = state.bag.filter((x) => !x.locked);
    if (!victims.length) break;
    victims.sort((a, b) => a.rarity - b.rarity || a.ilvl - b.ilvl);
    salvage(state, victims[0]);
  }
}
export function unequip(state, slot) { const it = state.gear[slot]; if (!it) return; delete state.gear[slot]; state.bag.unshift(it); dirty(state); }
export function salvage(state, it) {
  if (it.locked) return null;
  state.bag = state.bag.filter((x) => x.id !== it.id);
  for (const g of it.sockets) if (g) state.gems[g] = (state.gems[g] || 0) + 1;
  const v = salvageValue(it); gain(state, v); return v;
}
const keepByFilter = (state, it) => it.locked || (state.filters.keepUniques && it.unique) || it.affixes.some((a) => state.filters.keepAffixes.includes(a.key));
// returns 'equipped' | 'bag' | 'salvaged'
export function handleLoot(state, it) {
  state.totals.items++;
  if (state.filters.autoEquip && itemPowerDelta(state, it) > 0) { equip(state, it); return 'equipped'; }
  if (it.rarity < state.filters.salvageBelow && !keepByFilter(state, it)) { salvage(state, it); return 'salvaged'; }
  state.bag.unshift(it);
  trimBag(state);
  return 'bag';
}
export function salvageAll(state, maxRarity) {
  let n = 0;
  for (const it of [...state.bag]) if (it.rarity <= maxRarity && !keepByFilter(state, it)) { salvage(state, it); n++; }
  return n;
}
export function enhance(state, it) { if (it.enhance >= ENHANCE_MAX || !pay(state, enhanceCost(it))) return false; it.enhance++; dirty(state); return true; }
export function refine(state, it) { if (it.refine >= REFINE_MAX || !pay(state, refineCost(it))) return false; it.refine++; dirty(state); return true; }
const ENCHANTS = ['phys', 'magic', 'crit', 'critDmg', 'aspd', 'hpPct', 'boss', 'resist', 'cdr', 'ele'];
export function enchant(state, it) {
  if (it.enchant && it.enchant.rank >= ENCHANT_MAX) return false;
  if (!pay(state, enchantCost(it))) return false;
  if (!it.enchant) {
    // choose the enchant that helps this hero most
    let best = null, bp = -1;
    for (const k of ENCHANTS) { it.enchant = { key: k, rank: 1 }; const p = computeStats(state, { ...state.gear, [it.slot === 'ring1' ? slotOf(state, it) || 'ring1' : it.slot]: it }).power; if (p > bp) { bp = p; best = k; } }
    it.enchant = { key: best, rank: 1 };
  } else it.enchant.rank++;
  dirty(state); return true;
}
const slotOf = (state, it) => SLOTS.find((s) => state.gear[s] === it);
export function awakenItem(state, it) { if (!unlocked(state, 'awakening') || !canAwaken(it) || !pay(state, awakenItemCost(it))) return false; it.awakened = true; dirty(state); return true; }
export function socketGem(state, it, idx, gem) {
  if (!unlocked(state, 'gems') || idx >= it.sockets.length || !(state.gems[gem] > 0)) return false;
  if (it.sockets[idx]) state.gems[it.sockets[idx]] = (state.gems[it.sockets[idx]] || 0) + 1;
  state.gems[gem]--; it.sockets[idx] = gem; dirty(state); return true;
}
export function unsocket(state, it, idx) { const g = it.sockets[idx]; if (!g) return; state.gems[g] = (state.gems[g] || 0) + 1; it.sockets[idx] = null; dirty(state); }
export const gemCombineCost = (tier) => ({ gold: Math.round(80 * Math.pow(4, tier)) });
export function combineGems(state, type, tier) {
  const k = type + tier;
  if (tier >= 5 || (state.gems[k] || 0) < 3 || !pay(state, gemCombineCost(tier))) return false;
  state.gems[k] -= 3; state.gems[type + (tier + 1)] = (state.gems[type + (tier + 1)] || 0) + 1; return true;
}
export function combineAllGems(state) {
  let n = 0;
  for (let t = 0; t < 5; t++) for (const g of GEM_KEYS) while ((state.gems[g + t] || 0) >= 3 && combineGems(state, g, t)) n++;
  return n;
}

// ---------- runes & inscriptions ----------
export function upgradeRune(state, key) {
  const r = state.runes[key] || 0;
  if (!unlocked(state, 'gems') || r >= RUNE_MAX || !pay(state, runeCraftCost(r + 1))) return false;
  state.runes[key] = r + 1; dirty(state);
  if (r === 0) { const free = state.runesEquipped.findIndex((x, i) => !x && i < runeSlots(state)); if (free >= 0) state.runesEquipped[free] = key; }
  return true;
}
export function equipRune(state, idx, key) {
  if (idx >= runeSlots(state)) return false;
  state.runesEquipped = state.runesEquipped.map((x) => (x === key ? null : x));
  state.runesEquipped[idx] = key; dirty(state); return true;
}
export function inscribe(state, idx, ins) {
  if (!unlocked(state, 'inscriptions')) return false;
  const old = state.inscribed[idx];
  state.inscriptions = state.inscriptions.filter((x) => x.id !== ins.id);
  if (old) state.inscriptions.push(old);
  state.inscribed[idx] = ins; dirty(state); return true;
}
export function uninscribe(state, idx) { const o = state.inscribed[idx]; if (!o) return; state.inscriptions.push(o); state.inscribed[idx] = null; dirty(state); }
export function addInscription(state, ins) {
  state.inscriptions.push(ins);
  if (state.inscriptions.length > 40) { state.inscriptions.sort((a, b) => b.v - a.v); state.inscriptions.length = 40; }
}

// ---------- companions ----------
export function unlockCompanion(state, id) {
  if (state.companions.owned[id]) return false;
  state.companions.owned[id] = true; state.companions.levels[id] = 1; dirty(state); return true;
}
export function companionCost(state, id) {
  const l = state.companions.levels[id] || 1;
  const c = { gold: Math.round(40 * Math.pow(l, 2.1) * (1 + l / 10)) };
  const evo = EVOLUTIONS.find((e) => e.lvl === l + 1);
  if (evo) c.essence = Math.max(1, Math.floor(evo.lvl / 5));
  return c;
}
export const COMP_MAX = 80;
export function levelCompanion(state, id) {
  if (!state.companions.owned[id] || (state.companions.levels[id] || 1) >= COMP_MAX || !pay(state, companionCost(state, id))) return false;
  state.companions.levels[id]++; dirty(state); return true;
}
export const passiveSlots = (state) => (unlocked(state, 'pet3') ? 2 : unlocked(state, 'slot3') ? 1 : 0);
export function setCompanion(state, id, where) {
  const c = state.companions;
  if (!c.owned[id]) return false;
  c.passive = c.passive.map((x) => (x === id ? null : x));
  if (c.active === id) c.active = null;
  if (where === 'active') { if (c.active) { const f = c.passive.findIndex((x, i) => !x && i < passiveSlots(state)); if (f >= 0) c.passive[f] = c.active; } c.active = id; }
  else if (where < passiveSlots(state)) c.passive[where] = id;
  dirty(state); return true;
}

// ---------- crafting ----------
export function craft(state, recipeId, slot) {
  const r = RECIPES.find((x) => x.id === recipeId);
  if (!r || state.level < r.lvl || !pay(state, r.cost)) return null;
  const ilvl = Math.max(r.lvl, state.level) + WORLD_TIERS[state.worldTier].ilvl;
  if (r.gem) { const t = GEM_KEYS[Math.floor(Math.random() * GEM_KEYS.length)]; state.gems[t + '0'] = (state.gems[t + '0'] || 0) + 1; return { gem: t + '0' }; }
  if (r.inscription) { const ins = makeInscription(ilvl); addInscription(state, ins); return { ins }; }
  const it = generateItem(ilvl, { slot: r.slot || slot, cls: state.cls, rarity: r.rarity, unique: r.unique, bonus: r.bonus, name: r.pick ? undefined : r.name, forceLeg: true });
  state.bag.unshift(it);
  return { item: it };
}

// ---------- world tiers & ascension ----------
export const canAscend = (state) => state.level >= LEVEL_CAP && state.bossesBeaten[REGIONS.length - 1];
export const ascensionPoints = (state) => 3 + state.maxWorldTier * 2 + Math.floor(state.towerBest / 10) + Math.floor(state.mastery / 10);
export function ascend(state) {
  if (!canAscend(state)) return false;
  state.ascPoints += ascensionPoints(state);
  state.ascensions++;
  state.level = 1; state.xp = 0; state.stage = 1; state.maxStage = 1; state.worldTier = 0; state.bossesBeaten = {};
  resetAttrs(state); state.talents = {}; autoAttrs(state);
  dirty(state); return true;
}
export function buyPerk(state, p) { if (state.ascPoints <= 0) return false; state.ascPoints--; state.ascPerks[p] = (state.ascPerks[p] || 0) + 1; dirty(state); autoTalents(state); return true; }

// ---------- next goal (always show something useful) ----------
export function nextGoals(state) {
  const g = [];
  const st = stats(state);
  const nextUnlock = UNLOCKS.find((u) => u.lvl > state.level);
  if (state.level >= 10 && !state.spec) g.push({ text: 'Choose your specialisation', tab: 'character' });
  const freeT = talentFree(state);
  if (unlocked(state, 'talents') && freeT > 0) g.push({ text: `Spend ${freeT} talent point${freeT > 1 ? 's' : ''}`, tab: 'character' });
  const better = state.bag.find((it) => itemPowerDelta(state, it) > 0);
  if (better) g.push({ text: `Equip ${better.name} (upgrade)`, tab: 'equipment' });
  const empty = unlockedSlots(state).filter((r) => !state.skills[r]);
  if (empty.length) g.push({ text: `Fill your ${empty[0]} skill slot`, tab: 'skills' });
  if (unlocked(state, 'gems') && GEM_KEYS.some((t) => [0, 1, 2, 3, 4].some((i) => (state.gems[t + i] || 0) >= 3))) g.push({ text: 'Combine 3 gems into a higher tier', tab: 'equipment' });
  const weapon = state.gear.main;
  if (weapon && weapon.enhance < ENHANCE_MAX && canAfford(state, enhanceCost(weapon))) g.push({ text: `Enhance your weapon to +${weapon.enhance + 1}`, tab: 'equipment' });
  const ns = state.maxStage;
  if (ns <= MAX_STAGE && !state.bossesBeaten[Math.floor((ns - 1) / 10)]) g.push({ text: `Clear stage ${Math.ceil(ns / 10)}-${((ns - 1) % 10) + 1}${ns % 10 === 0 ? ' and beat the region boss' : ''}`, tab: 'battle' });
  if (nextUnlock) g.push({ text: `Reach level ${nextUnlock.lvl}: ${nextUnlock.text}`, tab: 'character' });
  if (canAscend(state)) g.push({ text: 'Ascend for permanent power', tab: 'character' });
  if (state.bossesBeaten[REGIONS.length - 1] && state.maxWorldTier < WORLD_TIERS.length - 1) g.push({ text: `Unlock World Tier ${WORLD_TIERS[state.maxWorldTier + 1].name}`, tab: 'activities' });
  if (!g.length) g.push({ text: `Climb the Endless Tower past floor ${state.towerBest}`, tab: 'activities' });
  return g;
}
export { RARITIES, UNIQUES, COMPANIONS, COMP_KEYS, GEMS, RUNES };
