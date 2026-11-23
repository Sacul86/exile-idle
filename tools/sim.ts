// Headless balance sim: npx tsx tools/sim.ts [hours] [taps/sec]
import * as E from '../app/src/core/engine';
import { HEROES, HeroId, GATHER_KEYS } from '../app/src/data/content';

const hours = +(process.argv[2] || 6), tps = +(process.argv[3] || 0);
const s = E.newGame(); s.started = true;
const rt = E.newRuntime();
let t = 0, nextAi = 0, nextLog = 0, lastMax = 0, lastMaxT = 0;
const every = +(process.env.LOG || 1800);
const out: string[] = [];
function ai() {
  // recruit
  for (const h of HEROES) if (!s.heroes[h.id] && E.recruit(s, h.id)) {}
  // extra heroes gather (one per skill), weakest fighters stay fighting
  const ids = Object.keys(s.heroes) as HeroId[];
  const prio = (id: HeroId) => (id === 'knight' ? 1e300 : id === 'cleric' ? 1e299 : E.heroDps(s, id));
  const fightOrder = [...ids].sort((a, b) => prio(b) - prio(a));
  ids.forEach((id) => { const want = fightOrder.indexOf(id) < 4 ? 'fight' : GATHER_KEYS[(fightOrder.indexOf(id) - 4) % 4]; if (s.heroes[id]!.job !== want) { if (want !== 'fight') E.setJob(s, id, want as any, 0); else { s.heroes[id]!.job = 'idle'; E.setJob(s, id, 'fight'); } } });
  for (const id of ids) { const h = s.heroes[id]!; if (h.job !== 'fight' && h.job !== 'idle') { let best = 0; E.GATHER_KEYS; for (let n = 0; n < 5; n++) if (s.skillLv[h.job as 'mining'] >= [1, 15, 30, 50, 70][n]) best = n; h.node = best; } }
  // spend gold: best dps gain per gold
  for (let guard = 0; guard < 400; guard++) {
    let best: HeroId | null = null, bv = 0;
    for (const id of ids) {
      if (s.heroes[id]!.job !== 'fight') continue;
      const c = E.levelCost(id, s.heroes[id]!.level);
      if (c > s.gold) continue;
      const before = E.heroDps(s, id); s.heroes[id]!.level++; const after = E.heroDps(s, id); s.heroes[id]!.level--;
      const v = (after - before) / c; if (v > bv) { bv = v; best = id; }
    }
    if (!best) break;
    E.levelUp(s, best, 1);
  }
  // crafting
  for (let tier = 4; tier >= 0; tier--) { while (E.canCraft(s, 'cook', tier) && s.mats['food' + tier] < 50) E.cook(s, null, tier); }
  for (let tier = 4; tier >= 0; tier--) { if (E.canCraft(s, 'smith', tier)) E.smith(s, null, tier, (['weapon', 'armor', 'trinket'] as const)[Math.floor(Math.random() * 3)], E.fighters(s)[0]); }
  for (let tier = 4; tier >= 0; tier--) { while (E.canCraft(s, 'brew', tier) && s.mats['pot' + tier] < 5) E.brew(s, null, tier); }
  if (!s.buffs.might && s.mats.pot0 > 0) E.drink(s, 0);
  E.equipBest(s);
  // ascend when stuck for 25 minutes
  if (s.runMax > lastMax) { lastMax = s.runMax; lastMaxT = t; }
  if (E.canAscend(s) && t - lastMaxT > 1500) {
    E.ascend(s, rt); lastMax = 0; lastMaxT = t;
    for (let g = 0; g < 50; g++) { const order = ['might', 'greed', 'vigor', 'headstart', 'time', 'skills', 'loot']; let any = false; for (const id of order) if (E.buySoul(s, id)) any = true; if (!any) break; }
  }
}
let tapAcc = 0;
while (t < hours * 3600) {
  E.tick(s, rt, 0.1); t += 0.1; rt.events.length = 0;
  if (tps) { tapAcc += tps * 0.1; while (tapAcc >= 1) { tapAcc--; E.tap(s, rt); } }
  if (t >= nextAi) { nextAi = t + 2; ai(); }
  if (t >= nextLog) {
    nextLog = t + every;
    const lv = (Object.keys(s.heroes) as HeroId[]).map((id) => `${id[0]}${s.heroes[id]!.level}`).join(' ');
    out.push(`${(t / 3600).toFixed(1)}h stage ${s.stage} (run ${s.runMax}, best ${s.maxStage}) asc ${s.ascensions} souls ${s.souls} gold ${E.fmt(s.gold)} dps ${E.fmt(E.partyDps(s))} heroes ${lv} wipes ${s.stats.wipes} bosses ${s.stats.bosses} items>=rare ${s.stats.bestRarity} skills ${Object.values(s.skillLv).join('/')} pets ${Object.keys(s.pets).length} quest ${s.quest}`);
  }
}
console.log(out.join('\n'));
if (process.env.DUMP) { s.lastSeen = Date.now() - 3 * 3600 * 1000; s.started = true; (await import('fs')).writeFileSync(process.env.DUMP, JSON.stringify(s)); }
