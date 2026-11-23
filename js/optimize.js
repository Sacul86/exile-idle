// One-tap optimisers: best gear, skills, class passives and pet.
import { computeStats, targetSlot } from './stats.js';
import { SKILL_BY_ID, skillsFor, skillSlots, skillEffective, skillMods, MILESTONES, skillUpgradeCost, MAX_SKILL_RANK } from './skills.js';
import { upgradeCost, canUpgrade } from './items.js';
import { petUpgradeCost, PET_MAX_LEVEL } from './pets.js';
import { ASCENDANCY, ASC_LEVELS } from './classdata.js';
import { PETS, PET_BY_ID } from './pets.js';
import { charOf, refreshStats, autoAllocate, partyReady, hatchEgg, openBox, syncSkills, availableSkills } from './game.js';
import { NODES, socketsInReach } from './tree.js';

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

// ---- Skills: score each available skill for the hero's role, with party synergies ----
// ctx: { statuses: Set of statuses the party applies, auras: Set of aura ids already taken }
function skillScore(state, i, sk, ctx) {
  const h = state.heroes[i];
  const st = state.combat.heroes[i].stats;
  const ef = skillEffective(sk, h.skills.ranks[sk.id] || 1, h.skills.mods[sk.id]);
  const boost = (state.combat.heroes[i].boost || {})[sk.id] || 1;
  const cd = Math.max(0.5, (ef.cooldown || 1) * (1 - st.cdr / 100));
  const p = ef.power * (1 + st.skillPow / 100) * boost;
  const hit = (st.physMin + st.physMax + st.eleMin + st.eleMax) / 2 || 1;
  const eleShare = (st.eleMin + st.eleMax) / 2 / hit;
  const eleF = sk.ele ? 1 + eleShare * 0.5 : 1;
  const role = st.role;
  const W = role === 'dps' ? { off: 1, def: 0.15, heal: 0.1 } : role === 'tank' ? { off: 0.4, def: 1, heal: 0.3 } : { off: 0.3, def: 0.5, heal: 1.6 };
  const PARTY = 2.5; // party-wide effects count for roughly the whole party's damage
  const perAttack = 1 / Math.max(0.2, st.aps);
  let off = 0, def = 0, heal = 0;
  const uptime = (d) => Math.min(1, d / cd);
  if (sk.kind === 'hit' || sk.kind === 'freeze') {
    let mult = 1;
    for (const [k, v] of Object.entries(sk.vs || {})) if (ctx.statuses.has(k) || (k === 'chill' && ctx.statuses.has('freeze'))) mult += v * 0.85;
    if (sk.perPoison && ctx.statuses.has('poison')) mult += 1.5;
    if (sk.lowHp) mult += sk.lowHp * 0.25;
    if (sk.consume && ctx.statuses.has(sk.consume)) mult += 0.8;
    off += (p * ef.hits * ef.casts * eleF * mult / cd) * perAttack;
    if (ef.expose) off += ef.expose * uptime(ef.exposeDur) * PARTY;
    if (sk.kind === 'freeze') def += uptime(ef.duration) * 1.4;
    if (sk.partyHeal) heal += sk.partyHeal / cd * 6;
  }
  // statuses this skill applies
  const ap = sk.applies || {};
  const hits = (ef.hits || 1) * (ef.casts || 1);
  if (ap.burn) off += ap.burn * 4 * ef.rankMult * Math.min(1, 4 / cd) * perAttack * 1.2;
  if (ap.bleed) off += ap.bleed * 5 * ef.rankMult * Math.min(1, 5 / cd) * perAttack * 1.2;
  if (ap.poison) off += ap.poison * hits * 0.06 * 5 * Math.min(1, 5 / cd) * perAttack * 1.2;
  const dDur = sk.kind === 'debuff' ? ef.duration : 4;
  if (ap.shock && !ctx.statuses.has('shock')) off += ap.shock * uptime(4) * PARTY;
  if (ap.ruin && !ctx.statuses.has('ruin')) off += ap.ruin * ef.rankMult * uptime(dDur) * PARTY;
  if (ap.weaken && !ctx.statuses.has('weaken')) def += ap.weaken * uptime(dDur) * PARTY * 1.5;
  if (ap.chill && !ctx.statuses.has('chill')) def += 0.3 * Math.min(1, ap.chill / cd) * PARTY;
  if (sk.selfBuff) def += (sk.selfBuff.dr || 0) * uptime(ef.duration) * 1.5;
  if (sk.kind === 'buff') {
    const b = sk.buffs || { [sk.stat]: 1 };
    const scale = sk.party ? PARTY : 1;
    for (const [k, v] of Object.entries(b)) {
      const val = (sk.buffs ? v * p : p) * uptime(ef.duration) * scale;
      if (k === 'dmg' || k === 'aps') off += val;
      if (k === 'dr' || k === 'evade') def += val * 1.5;
      if (k === 'leech') def += val * 0.05;
    }
  }
  if (sk.kind === 'aura') {
    if (ctx.auras.has(sk.id)) return -1; // another hero already provides it
    const a = sk.aura, f = ef.power * boost;
    off += ((a.moreDmg || 0) / 100 + (a.incEle || 0) / 100 * 0.4 + (a.aps || 0) / 100 + (a.critChance || 0) / 100 * 0.15 + (a.critMulti || 0) / 100 * 0.2) * f * PARTY;
    def += ((a.incArmour || 0) / 100 * 0.3 + (a.incLife || 0) / 100 + (a.regenPct || 0) * 0.15) * f * PARTY;
  }
  if (sk.kind === 'shield') def += p * uptime(ef.duration) * (sk.party ? PARTY : 1);
  if (sk.kind === 'heal') heal += p / cd * (sk.party ? 3 : 1) * 4 + (sk.regen ? sk.regen * ef.duration / cd * 3 : 0);
  if (ef.heal) heal += ef.heal / cd * 3;
  return W.off * off + W.def * def + W.heal * heal + (sk.cls || sk.tree ? 0.02 : 0);
}

function statusesOf(sk) {
  const out = Object.keys(sk.applies || {});
  if (sk.kind === 'freeze') out.push('freeze');
  return out;
}

export function bestSkills(state, heroes = [0, 1, 2]) {
  let changed = 0;
  syncSkills(state);
  // pending upgrade choices first
  for (const i of heroes) {
    const h = state.heroes[i];
    if (!h.cls) continue;
    for (const sk of availableSkills(state, i)) {
      const rank = h.skills.ranks[sk.id];
      if (!rank) continue;
      const picks = h.skills.mods[sk.id] || (h.skills.mods[sk.id] = []);
      MILESTONES.forEach((m, k) => {
        if (rank < m || picks[k] != null) return;
        let bestO = 0, bestV = -Infinity;
        skillMods(sk)[k].forEach((_, o) => {
          picks[k] = o;
          const v = skillScore(state, i, sk, { statuses: new Set(), auras: new Set() });
          if (v > bestV) { bestV = v; bestO = o; }
        });
        picks[k] = bestO; changed++;
      });
    }
  }
  // greedy, party-aware: fill slots one at a time, round-robin, so heroes build on each other's statuses
  const slots = skillSlots();
  const others = new Set(heroes.length < 3 ? [0, 1, 2].filter((x) => !heroes.includes(x)) : []);
  const ctx = { statuses: new Set(), auras: new Set() };
  for (const o of others) for (const id of state.heroes[o].skills.bar) { const sk = SKILL_BY_ID[id]; if (!sk) continue; statusesOf(sk).forEach((x) => ctx.statuses.add(x)); if (sk.kind === 'aura') ctx.auras.add(id); }
  const picks = Object.fromEntries(heroes.map((i) => [i, []]));
  const pool = Object.fromEntries(heroes.map((i) => [i, state.heroes[i].cls ? availableSkills(state, i).filter((sk) => state.heroes[i].skills.ranks[sk.id]) : []]));
  for (let round = 0; round < slots; round++) {
    for (const i of heroes) {
      let best = null, bestV = 0;
      for (const sk of pool[i]) {
        if (picks[i].includes(sk.id)) continue;
        const v = skillScore(state, i, sk, ctx);
        if (v > bestV) { bestV = v; best = sk; }
      }
      if (!best) continue;
      picks[i].push(best.id);
      statusesOf(best).forEach((x) => ctx.statuses.add(x));
      if (best.kind === 'aura') ctx.auras.add(best.id);
    }
  }
  for (const i of heroes) {
    const h = state.heroes[i];
    if (!h.cls) continue;
    const before = h.skills.bar.join();
    h.skills.bar = picks[i];
    if (picks[i].join() !== before) changed++;
  }
  if (changed) refreshStats(state);
  return changed;
}

// ---- Stones: put the strongest stones where they boost the most ----
export function bestStones(state, heroes = [0, 1, 2]) {
  // unsocket everything for these heroes, then greedily place
  for (const i of heroes) state.heroes[i].sockets = {};
  const used = new Set(state.heroes.flatMap((h) => Object.values(h.sockets || {})));
  let placed = 0;
  for (let pass = 0; pass < 20; pass++) {
    let best = null;
    for (const i of heroes) {
      const h = state.heroes[i];
      if (!h.cls) continue;
      const tree = new Set(h.tree);
      const bar = h.skills.bar.filter(Boolean).map((id) => SKILL_BY_ID[id]).filter(Boolean);
      for (const sock of h.tree.filter((id) => NODES[id] && NODES[id].kind === 'socket' && !h.sockets[id])) {
        const near = socketsInReach(sock).filter((n) => tree.has(n)).map((n) => SKILL_BY_ID[NODES[n].skill]);
        for (const stone of state.stones) {
          if (used.has(stone.uid)) continue;
          const match = (sk) => stone.tag === 'any' || (sk.tags || []).includes(stone.tag);
          let v = 0;
          for (const sk of near) v += (bar.includes(sk) ? 1 : 0.2) * stone.power * (match(sk) ? 2 : 1);
          for (const sk of bar) if (match(sk)) v += stone.power / 3;
          if (v > 0 && (!best || v > best.v)) best = { v, i, sock, stone };
        }
      }
    }
    if (!best) break;
    state.heroes[best.i].sockets[best.sock] = best.stone.uid;
    used.add(best.stone.uid);
    placed++;
  }
  refreshStats(state);
  return placed;
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

// ---- Spend gold & shards: always buy the upgrade with the most power per cost ----
export function spendResources(state, heroes = [0, 1, 2], maxSteps = 400) {
  const done = { gear: 0, skills: 0, pet: 0 };
  const partyPower = () => state.heroes.reduce((a, h, i) => a + (h.cls ? powerOf(state, i, h.gear) : 0), 0);
  for (let step = 0; step < maxSteps; step++) {
    const total = partyPower();
    const price = (c) => c.gold / Math.max(1, state.gold) + c.shards / Math.max(1, state.shards); // relative scarcity
    const afford = (c) => c.gold <= state.gold && c.shards <= state.shards;
    let best = null;
    const consider = (gain, c, apply, kind) => {
      if (gain <= 0 || !afford(c)) return;
      const v = gain / Math.max(1e-6, price(c));
      if (!best || v > best.v) best = { v, c, apply, kind };
    };
    for (const i of heroes) {
      const h = state.heroes[i];
      if (!h.cls) continue;
      const base = powerOf(state, i, h.gear);
      // gear +1
      for (const it of Object.values(h.gear)) {
        if (!it || !canUpgrade(it)) continue;
        it.upgrade++;
        const p = powerOf(state, i, h.gear);
        it.upgrade--;
        consider((p - base) / total, upgradeCost(it), () => { it.upgrade++; }, 'gear');
      }
      // skill ranks for skills on the bar (each rank: +10% effect, -2% cooldown)
      const bar = h.skills.bar.slice(0, skillSlots(state.level)).filter(Boolean);
      for (const id of bar) {
        const rank = h.skills.ranks[id];
        if (!rank || rank >= MAX_SKILL_RANK) continue;
        const est = base * (0.09 / Math.max(1, bar.length)) * (MILESTONES.includes(rank + 1) ? 1.5 : 1);
        consider(est / total, skillUpgradeCost(rank, state.level), () => { h.skills.ranks[id]++; }, 'skills');
      }
    }
    // active pet level
    const pid = state.pets.active;
    const pl = pid && state.pets.owned[pid];
    if (pl && pl < PET_MAX_LEVEL) {
      state.pets.owned[pid]++;
      const p = partyPower() * (1 + (pl + 1) * 0.002);
      state.pets.owned[pid]--;
      consider((p - total * (1 + pl * 0.002)) / total, petUpgradeCost(pl), () => { state.pets.owned[pid]++; }, 'pet');
    }
    if (!best) break;
    state.gold -= best.c.gold; state.shards -= best.c.shards;
    best.apply();
    done[best.kind]++;
  }
  if (done.gear + done.skills + done.pet) { state.pushBlocked = false; refreshStats(state); }
  return done;
}

// ---- Everything at once ----
export function optimiseAll(state, heroes = [0, 1, 2], opts = { spend: true }) {
  if (!partyReady(state)) return null;
  const r = { gear: 0, tree: 0, asc: 0, skills: 0, pet: null, hatched: 0, boxes: 0, spent: null };
  while (state.eggs > 0 && hatchEgg(state)) r.hatched++;
  for (const t of [1, 2, 3]) while (state.boxes[t] > 0) { openBox(state, t); r.boxes++; }
  r.pet = bestPet(state);
  r.asc = bestAscendancy(state, heroes);
  for (const i of heroes) r.tree += autoAllocate(state, i);
  syncSkills(state);
  r.gear = equipBest(state, heroes);
  r.skills = bestSkills(state, heroes);
  r.stones = bestStones(state, heroes);
  if (opts.spend) r.spent = spendResources(state, heroes);
  bestSkills(state, heroes); // re-pick with the new ranks
  return r;
}

export function describeResult(r) {
  if (!r) return '';
  const s = r.spent || {};
  return [
    r.hatched && `${r.hatched} egg${r.hatched > 1 ? 's' : ''} hatched`,
    r.boxes && `${r.boxes} box${r.boxes > 1 ? 'es' : ''} opened`,
    r.gear && `${r.gear} item${r.gear > 1 ? 's' : ''} equipped`,
    s.gear && `${s.gear} gear upgrades`,
    s.skills && `${s.skills} skill ranks`,
    s.pet && `pet +${s.pet} lv`,
    r.tree && `${r.tree} tree pts`,
    r.asc && `${r.asc} passives`,
    r.stones && `${r.stones} stone${r.stones > 1 ? 's' : ''} socketed`,
    r.skills && 'skill bar set',
  ].filter(Boolean).join(' · ');
}
