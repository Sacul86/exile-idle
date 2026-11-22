import { newState, simulate, refreshStats } from '../js/game.js';
import { PASSIVES } from '../js/data.js';
import { computeStats, passivePointsTotal, passivePointsSpent } from '../js/stats.js';
import { upgradeCost, canUpgrade } from '../js/items.js';
const hours = +process.argv[2] || 6, spend = process.argv[3] !== 'nospend';
const s = newState();
const order = ['brutality','vitality','swift','ironskin','warding','precision','ruthless','phase','renewal','elemental'];
for (let m = 0; m < hours * 60; m += 5) {
  simulate(s, 300);
  if (spend) {
    let free = passivePointsTotal(s.level) - passivePointsSpent(s), i = 0;
    while (free > 0 && i < 200) { const p = PASSIVES.find(x=>x.id===order[i%order.length]); if ((s.passives[p.id]||0) < p.max) { s.passives[p.id]=(s.passives[p.id]||0)+1; free--; } i++; }
    // upgrade cheapest gear
    for (let k=0;k<20;k++){ let best=null,bc=null; for (const it of Object.values(s.gear)) { if(!it||!canUpgrade(it)) continue; const c=upgradeCost(it); if(c.gold<=s.gold&&c.shards<=s.shards&&(!bc||c.gold<bc.gold)){best=it;bc=c;} } if(!best)break; s.gold-=bc.gold;s.shards-=bc.shards;best.upgrade++; s.pushBlocked=false; }
    refreshStats(s);
  }
  if (m % 30 === 0) { const st = computeStats(s); console.log(`t=${(m/60).toFixed(1)}h stage=${s.stage} max=${s.maxStage} lvl=${s.level} deaths=${s.deaths} dps=${st.dps.toFixed(0)} life=${st.maxLife.toFixed(0)} res=${st.resist.toFixed(0)} ev=${(st.evadeChance*100).toFixed(0)}% arm=${(st.armourRed*100).toFixed(0)}% gold=${s.gold.toFixed(0)} shards=${s.shards} bag=${s.bag.length} blocked=${s.pushBlocked}`); }
}
