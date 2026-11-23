// One-tap optimiser: best gear, skills, gems, runes, inscriptions, companions, then spends resources
// on whatever raises Power the most per cost.
import { SLOTS, GEM_KEYS, GEMS, RUNE_KEYS, runeSlots, COMP_KEYS, CLASSES, specOf, unlocked, INSCR_SLOTS } from './data.js';
import { computeStats, unlockedSlots } from './stats.js';
import { enhanceCost, ENHANCE_MAX, refineCost, REFINE_MAX } from './items.js';
import { SKILLS, skillsForRole, skillEff, skillUpgradeCost, SKILL_MAX } from './skills.js';
import { stats, dirty, equip, canAfford, pay, combineAllGems, setCompanion, passiveSlots, companionCost, COMP_MAX, upgradeSkill, autoTalents, autoAttrs, socketGem, unsocket, inscribe, uninscribe, levelCompanion } from './systems.js';

const P = (state, g = state.gear) => computeStats(state, g).power;

export function equipBest(state) {
  let changed = 0;
  for (let pass = 0; pass < 2; pass++) {
    for (const slot of SLOTS) {
      const type = slot === 'ring2' ? 'ring1' : slot;
      let best = null, bp = P(state);
      for (const it of state.bag) {
        if (it.slot !== type) continue;
        const p = P(state, { ...state.gear, [slot]: it });
        if (p > bp) { bp = p; best = it; }
      }
      if (best) { equip(state, best, slot); changed++; }
    }
  }
  return changed;
}

export function skillScore(state, sk) {
  const st = stats(state);
  const e = skillEff(sk, state.skillRanks[sk.id] || 1, !!state.awakenedSkills[sk.id]);
  const mult = 1 + ((st.treeDmg[sk.tree] || 0) + (st.elem[sk.elem] || 0)) / 100;
  let v = (e.coef * e.hits * (e.aoe ? 2.2 : 1) * mult) / e.cd;
  if (sk.st) v *= sk.st === 'poison' || sk.st === 'burn' || sk.st === 'bleed' ? 1.35 : 1.15;
  if (e.heal) v += e.heal / e.cd * 0.08 * (1 + st.healPct / 100);
  if (e.shield) v += e.shield / e.cd * 0.07 * (1 + st.shieldPct / 100);
  if (sk.dr) v += sk.dr * sk.dur / e.cd * 0.01;
  if (sk.dodge) v += 0.6;
  if (sk.buff) v += Object.entries(sk.buff).reduce((s, [k, x]) => s + x * (k === 'more' ? 1 : k === 'aspd' ? 0.8 : k === 'petDmg' ? (state.companions.active ? 0.15 : 0) : 0.4), 0) * (sk.dur || 8) / e.cd / 100;
  if (sk.debuff) v += (sk.debuff === 'vuln' ? 0.5 : 0.3);
  if (sk.summon) v += ({ skeleton: 0.3 * (1 + st.minionMax / 3), demon: 1.1, infernal: 1.6 }[sk.summon]) * (sk.n || 1) * (1 + st.minionDmg / 100) * 0.4;
  if (sk.reset) v += 0.5;
  if (sk.execute) v *= 1.1;
  if (specOf(state)?.tree === sk.tree) v *= 1.15;
  return v;
}
export function bestSkills(state) {
  let n = 0;
  for (const role of unlockedSlots(state)) {
    const opts = skillsForRole(state.cls, role);
    const best = opts.reduce((a, b) => (skillScore(state, b) > skillScore(state, a) ? b : a));
    if (state.skills[role] !== best.id) { state.skills[role] = best.id; state.skillRanks[best.id] = state.skillRanks[best.id] || 1; n++; }
  }
  dirty(state);
  return n;
}

export function bestGems(state) {
  if (!unlocked(state, 'gems')) return 0;
  combineAllGems(state);
  let n = 0;
  for (const slot of SLOTS) {
    const it = state.gear[slot];
    if (!it) continue;
    for (let i = 0; i < it.sockets.length; i++) {
      // try every owned gem (and the current one) in this socket
      const cur = it.sockets[i];
      let bestG = cur, bp = P(state);
      const owned = Object.keys(state.gems).filter((g) => state.gems[g] > 0);
      for (const g of owned) {
        it.sockets[i] = g;
        const p = P(state);
        if (p > bp) { bp = p; bestG = g; }
      }
      it.sockets[i] = cur;
      if (bestG !== cur) { if (cur) unsocket(state, it, i); socketGem(state, it, i, bestG); n++; }
    }
  }
  return n;
}

export function bestRunes(state) {
  const slots = runeSlots(state);
  const owned = RUNE_KEYS.filter((k) => state.runes[k] > 0);
  const chosen = [];
  for (let i = 0; i < slots; i++) {
    let best = null, bp = -1;
    for (const k of owned) {
      if (chosen.includes(k)) continue;
      state.runesEquipped = [...chosen, k];
      const p = P(state); if (p > bp) { bp = p; best = k; }
    }
    if (best) chosen.push(best);
  }
  state.runesEquipped = [...chosen, null, null, null].slice(0, 3);
  dirty(state);
}

export function bestInscriptions(state) {
  if (!unlocked(state, 'inscriptions')) return;
  for (let i = 0; i < INSCR_SLOTS; i++) uninscribe(state, i);
  for (let i = 0; i < INSCR_SLOTS; i++) {
    let best = null, bp = P(state);
    for (const ins of state.inscriptions) {
      state.inscribed[i] = ins;
      const p = P(state);
      if (p > bp) { bp = p; best = ins; }
    }
    state.inscribed[i] = null;
    if (best) inscribe(state, i, best);
  }
  // second pass: swap for set bonuses
  for (let i = 0; i < INSCR_SLOTS; i++) {
    const cur = state.inscribed[i];
    let best = null, bp = P(state);
    for (const ins of state.inscriptions) { state.inscribed[i] = ins; const p = P(state); if (p > bp) { bp = p; best = ins; } }
    state.inscribed[i] = cur;
    if (best) inscribe(state, i, best);
  }
}

export function bestCompanions(state) {
  const owned = COMP_KEYS.filter((k) => state.companions.owned[k]);
  const c = state.companions;
  const order = [];
  for (let i = 0; i < 1 + passiveSlots(state); i++) {
    let best = null, bp = -1;
    for (const id of owned) {
      if (order.includes(id)) continue;
      const saved = { active: c.active, passive: [...c.passive] };
      if (i === 0) { c.active = id; c.passive = [null, null]; } else { c.active = order[0]; c.passive = [order[1] || null, null]; c.passive[i - 1] = id; }
      const p = P(state); if (p > bp) { bp = p; best = id; }
      c.active = saved.active; c.passive = saved.passive;
    }
    if (best) order.push(best);
  }
  c.active = order[0] || null; c.passive = [order[1] || null, order[2] || null];
  dirty(state);
}

// greedy spend: best power gain per fraction of current gold
export function spendResources(state) {
  let spent = 0;
  for (let guard = 0; guard < 300; guard++) {
    const base = P(state);
    const cands = [];
    for (const slot of SLOTS) {
      const it = state.gear[slot];
      if (!it) continue;
      if (it.enhance < ENHANCE_MAX) cands.push({ cost: enhanceCost(it), run: () => { it.enhance++; }, undo: () => { it.enhance--; } });
      if (it.refine < REFINE_MAX) cands.push({ cost: refineCost(it), run: () => { it.refine++; }, undo: () => { it.refine--; } });
    }
    for (const role of unlockedSlots(state)) {
      const id = state.skills[role]; if (!id) continue;
      const r = state.skillRanks[id] || 1;
      if (r < SKILL_MAX) cands.push({ cost: skillUpgradeCost(r), skill: id, gainEst: 0.04 * (role === 'primary' || role === 'secondary' ? 1.2 : role === 'ultimate' ? 0.8 : 0.5) });
    }
    for (const id of COMP_KEYS) {
      if (!state.companions.owned[id] || ![state.companions.active, ...state.companions.passive].includes(id)) continue;
      if ((state.companions.levels[id] || 1) < COMP_MAX) cands.push({ cost: companionCost(state, id), run: () => { state.companions.levels[id]++; }, undo: () => { state.companions.levels[id]--; } });
    }
    let best = null, bv = 0;
    for (const cd of cands) {
      if (!canAfford(state, cd.cost)) continue;
      let gainK;
      if (cd.skill) gainK = cd.gainEst;
      else { cd.run(); gainK = P(state) / base - 1; cd.undo(); }
      const frac = (cd.cost.gold || 0) / Math.max(1, state.gold) + Object.entries(cd.cost).filter(([k]) => k !== 'gold').reduce((s, [k, v]) => s + v / Math.max(1, state.mats[k] || 0), 0) * 0.5;
      const v = gainK / Math.max(0.001, frac);
      if (gainK > 0 && v > bv) { bv = v; best = cd; }
    }
    if (!best) break;
    if (best.skill) upgradeSkill(state, best.skill);
    else { pay(state, best.cost); best.run(); }
    dirty(state);
    spent++;
  }
  return spent;
}

export function optimiseAll(state) {
  const before = stats(state).power;
  autoAttrs(state); autoTalents(state, true);
  bestCompanions(state);
  const gear = equipBest(state);
  bestSkills(state);
  bestGems(state);
  bestRunes(state);
  bestInscriptions(state);
  const spent = spendResources(state);
  bestSkills(state);
  dirty(state);
  const after = stats(state).power;
  return { before, after, gear, spent };
}
