// One-tap optimisers: best gear, skills, class passives and pet.
import { computeStats, targetSlot } from './stats.js';
import { SKILL_BY_ID, skillsFor, skillSlots, skillEffective, skillMods, MILESTONES } from './skills.js';
import { ASCENDANCY, ASC_LEVELS } from './classdata.js';
import { PETS, PET_BY_ID } from './pets.js';
import { charOf, refreshStats, autoAllocate, partyReady } from './game.js';

const powerOf = (state, i, gear) => computeStats(charOf(state, i), gear).power;

// ---- Gear: repeatedly move the biggest upgrade from the bag onto whichever hero gains most ----
export function equipBest(state, heroes = [0, 1, 2]) {
  let moves = 0;
  for (let pass = 0; pass < 12; pass++) {
    let best = null;
    for (const i of heroes) {
      const h = state.heroes[i];
      if (!h.cls) continue;
      const base = powerOf(state, i, h.gear);
      for (const item of state.bag) {
        const slot = targetSlot(charOf(state, i), item);
        const gain = powerOf(state, i, { ...h.gear, [slot]: item }) / base - 1;
        if (gain > 0.001 && (!best || gain > best.gain)) best = { i, item, slot, gain };
      }
    }
    if (!best) break;
    const h = state.heroes[best.i];
    const old = h.gear[best.slot];
    state.bag = state.bag.filter((b) => b !== best.item);
    h.gear[best.slot] = best.item;
    if (old) state.bag.unshift(old);
    moves++;
  }
  if (moves) { state.pushBlocked = false; refreshStats(state); }
  return moves;
}

// ---- Skills: score each unlocked skill for the hero's role ----
function skillScore(state, i, sk) {
  const h = state.heroes[i];
  const st = state.combat.heroes[i].stats;
  const ef = skillEffective(sk, h.skills.ranks[sk.id] || 1, h.skills.mods[sk.id]);
  const cd = Math.max(0.5, ef.cooldown * (1 - st.cdr / 100));
  const p = ef.power * (1 + st.skillPow / 100);
  const hit = (st.physMin + st.physMax + st.eleMin + st.eleMax) / 2 || 1;
  const eleShare = (st.eleMin + st.eleMax) / 2 / hit;
  const eleF = sk.ele ? 1 + eleShare * 0.5 : 1;
  const role = st.role;
  const W = role === 'dps' ? { off: 1, def: 0.15, heal: 0.1 } : role === 'tank' ? { off: 0.35, def: 1, heal: 0.3 } : { off: 0.25, def: 0.5, heal: 1.6 };
  let off = 0, def = 0, heal = 0;
  const perAttack = 1 / Math.max(0.2, st.aps);        // express value relative to basic attacks
  if (sk.kind === 'hit') off = (p * ef.hits * ef.casts * eleF / cd) * perAttack + (ef.expose ? ef.expose * ef.exposeDur / cd : 0);
  if (sk.kind === 'freeze') { off = (p * ef.casts / cd) * perAttack; def = ef.duration / cd * 1.2; }
  if (sk.kind === 'buff') {
    const b = sk.buffs || { [sk.stat]: 1 };
    const scale = sk.buffs ? p : 1;
    const dur = ef.duration / cd;
    for (const [k, v] of Object.entries(b)) {
      const val = (sk.buffs ? v * scale : p) * dur;
      if (k === 'dmg' || k === 'aps') off += val;
      if (k === 'dr' || k === 'evade') def += val * 1.5;
      if (k === 'leech') def += val * 0.05;
    }
  }
  if (sk.kind === 'shield') def = p * ef.duration / cd * (sk.party ? 2.5 : 1);
  if (sk.kind === 'heal') heal = p / cd * (sk.party ? 3 : 1) * 4;
  if (ef.heal) heal += ef.heal / cd * 3;
  return W.off * off + W.def * def + W.heal * heal + (sk.cls ? 0.02 : 0);
}

export function bestSkills(state, heroes = [0, 1, 2]) {
  let changed = 0;
  for (const i of heroes) {
    const h = state.heroes[i];
    if (!h.cls) continue;
    const slots = skillSlots(state.level);
    const owned = skillsFor(h.cls).filter((sk) => h.skills.ranks[sk.id]);
    // pick any pending upgrade choices first (higher-scoring option wins)
    for (const sk of owned) {
      const rank = h.skills.ranks[sk.id];
      const picks = h.skills.mods[sk.id] || (h.skills.mods[sk.id] = []);
      MILESTONES.forEach((m, k) => {
        if (rank < m || picks[k] != null) return;
        let bestO = 0, bestV = -1;
        skillMods(sk)[k].forEach((_, o) => {
          picks[k] = o;
          const v = skillScore(state, i, sk);
          if (v > bestV) { bestV = v; bestO = o; }
        });
        picks[k] = bestO; changed++;
      });
    }
    const ranked = owned.map((sk) => ({ id: sk.id, v: skillScore(state, i, sk) })).sort((a, b) => b.v - a.v);
    const bar = ranked.slice(0, slots).map((r) => r.id);
    const before = h.skills.bar.slice(0, slots).join();
    h.skills.bar = bar;
    if (bar.join() !== before) changed++;
  }
  if (changed) refreshStats(state);
  return changed;
}

// ---- Class passives: try both options at each unlocked level, keep the stronger ----
export function bestAscendancy(state, heroes = [0, 1, 2], includeChosen = false) {
  let changed = 0;
  for (const i of heroes) {
    const h = state.heroes[i];
    if (!h.cls) continue;
    ASC_LEVELS.forEach((lv, k) => {
      if (state.level < lv || (!includeChosen && h.asc[k] != null)) return;
      let bestO = 0, bestP = -1;
      ASCENDANCY[h.cls][k].forEach((_, o) => {
        h.asc[k] = o;
        const p = powerOf(state, i, h.gear);
        if (p > bestP) { bestP = p; bestO = o; }
      });
      h.asc[k] = bestO; changed++;
    });
  }
  if (changed) refreshStats(state);
  return changed;
}

// ---- Pet: the one that raises total party power the most ----
export function bestPet(state) {
  const owned = Object.keys(state.pets.owned).filter((id) => PET_BY_ID[id]);
  if (!owned.length) return null;
  const was = state.pets.active;
  let best = was, bestP = -1;
  for (const id of owned) {
    state.pets.active = id;
    let p = state.heroes.reduce((a, h, i) => a + (h.cls ? powerOf(state, i, h.gear) : 0), 0);
    if (PET_BY_ID[id].revive) p *= 1.04; // value the free revive a little
    p *= 1 + (state.pets.owned[id] || 1) * 0.002; // pet attack scales with level
    if (p > bestP) { bestP = p; best = id; }
  }
  state.pets.active = best;
  refreshStats(state);
  return best !== was ? best : null;
}

// ---- Everything at once ----
export function optimiseAll(state, heroes = [0, 1, 2]) {
  if (!partyReady(state)) return null;
  const r = { gear: 0, tree: 0, asc: 0, skills: 0, pet: null };
  r.asc = bestAscendancy(state, heroes);
  for (const i of heroes) r.tree += autoAllocate(state, i);
  r.gear = equipBest(state, heroes);
  r.skills = bestSkills(state, heroes);
  r.pet = bestPet(state);
  return r;
}
