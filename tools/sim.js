// Headless balance sim: plays a build automatically and prints progression.
// usage: node tools/sim.js [hours] [class] [nospend]
import { newState, simulate, refreshStats, autoAllocate, startRun, dungeonTiers, raidUnlocked } from '../js/game.js';
import { computeStats } from '../js/stats.js';
import { upgradeCost, canUpgrade } from '../js/items.js';
import { skillUpgradeCost, MAX_SKILL_RANK, skillSlots } from '../js/skills.js';
const hours = +process.argv[2] || 6, cls = process.argv[3] || 'marauder', spend = process.argv[4] !== 'nospend';
const s = newState();
s.cls = cls; refreshStats(s);
let runs = { dw: 0, dl: 0, rw: 0, rl: 0 };
for (let m = 0; m < hours * 60; m += 5) {
  const r = simulate(s, 300);
  if (spend) {
    autoAllocate(s);
    for (let k = 0; k < 30; k++) {
      let best = null, bc = null;
      for (const it of Object.values(s.gear)) { if (!it || !canUpgrade(it)) continue; const c = upgradeCost(it); if (c.gold <= s.gold && c.shards <= s.shards && (!bc || c.gold < bc.gold)) { best = it; bc = c; } }
      if (!best) break; s.gold -= bc.gold; s.shards -= bc.shards; best.upgrade++; s.pushBlocked = false;
    }
    for (const id of s.skills.bar.slice(0, skillSlots(s.level))) {
      const rk = s.skills.ranks[id]; if (!id || rk >= MAX_SKILL_RANK) continue;
      const c = skillUpgradeCost(rk, s.level); if (c.gold <= s.gold && c.shards <= s.shards) { s.gold -= c.gold; s.shards -= c.shards; s.skills.ranks[id]++; }
    }
    refreshStats(s);
    // endgame: raid if possible else dungeon at highest tier
    if (!s.run) {
      const t = dungeonTiers(s);
      if (s.sigils > 0 && t > 0) { let rt = t; while (rt > 0 && !raidUnlocked(s, rt)) rt--; if (rt) startRun(s, 'raid', rt); }
      else if (s.keys > 0 && t > 0) startRun(s, 'dungeon', Math.max(1, t - 1));
    }
  }
  if (m % 30 === 0) { const st = computeStats(s); console.log(`t=${(m / 60).toFixed(1)}h stage=${s.stage} max=${s.maxStage} lvl=${s.level} pts=${s.tree.length} deaths=${s.deaths} dps=${st.dps.toFixed(0)} life=${st.maxLife.toFixed(0)} res=${st.resist.toFixed(0)} keys=${s.keys} sig=${s.sigils} dung=${JSON.stringify(s.dungeonsCleared)} raid=${JSON.stringify(s.raidsCleared)} ks=${[...st.keystones].join(',')}`); }
}
