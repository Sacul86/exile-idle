// Headless balance sim for the party game.
// usage: node tools/sim.js [hours] [tankCls] [healerCls] [dpsCls]
import { newState, newHero, simulate, refreshStats, autoAllocate, startRun, dungeonTiers, raidUnlocked, hatchEgg, openBox } from '../js/game.js';
import { upgradeCost, canUpgrade } from '../js/items.js';
import { skillUpgradeCost, MAX_SKILL_RANK, skillSlots } from '../js/skills.js';
import { petUpgradeCost } from '../js/pets.js';
import { optimiseAll } from '../js/optimize.js';
const [hours = 3, tank = 'marauder', healer = 'templar', dps = 'witch'] = process.argv.slice(2);
const s = newState();
s.heroes = [newHero('tank', tank), newHero('healer', healer), newHero('dps', dps)];
refreshStats(s);
for (let m = 0; m < hours * 60; m += 5) {
  simulate(s, 300);
  optimiseAll(s);
  refreshStats(s);
  if (!s.run) {
    const t = dungeonTiers(s);
    if (s.sigils > 0 && t > 0) { let rt = t; while (rt > 0 && !raidUnlocked(s, rt)) rt--; if (rt) startRun(s, 'raid', rt); }
    else if (s.keys > 0 && t > 0) startRun(s, 'dungeon', Math.max(1, t - 1));
  }
  if (m % 30 === 0) {
    const p = s.combat.party;
    console.log(`t=${(m / 60).toFixed(1)}h stage=${s.stage} max=${s.maxStage} lvl=${s.level} deaths=${s.deaths} dps=${p.dps.toFixed(0)} hps=${p.hps.toFixed(0)} tankEhp=${p.tankEhp.toFixed(0)} keys=${s.keys} dung=${Object.keys(s.dungeonsCleared).length} raid=${Object.keys(s.raidsCleared).length} pets=${Object.keys(s.pets.owned).length}`);
  }
}
