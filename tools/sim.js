// Headless balance sim: node tools/sim.js [class] [hours]
import { newState } from '../js/systems.js';
import { tick, startRun, leaveRun } from '../js/game.js';
import { optimiseAll } from '../js/optimize.js';
import { stats } from '../js/systems.js';
import { REGIONS, MAX_STAGE, S } from '../js/data.js';

const cls = process.argv[2] || 'warrior';
const hours = +(process.argv[3] || 6);
const s = newState(cls);
const DT = 0.1;
let t = 0, nextOpt = 0, nextLog = 0, nextAct = 1800;
const log = [];
const t0 = Date.now();
while (t < hours * 3600) {
  tick(s, DT); t += DT;
  if (s.level >= 10 && !s.spec) s.spec = Object.values({ warrior: 'berserker', mage: 'pyromancer', ranger: 'deadeye', warlock: 'necromancer', paladin: 'templar' })[0] && ({ warrior: 'berserker', mage: 'pyromancer', ranger: 'deadeye', warlock: 'necromancer', paladin: 'templar' })[cls];
  if (t >= nextOpt) { optimiseAll(s); nextOpt = t + 120; }
  if (s.run?.done) { if (s.run.kind === 'dungeon' && s.run.win && process.env.VERBOSE) console.log('  dungeon', s.run.key, s.run.tier, s.run.win); leaveRun(s); }
  if (t >= nextAct && !s.run) {
    nextAct = t + 1800;
    if (s.level >= 30) startRun(s, 'dungeon', 'forge', s.dungeonTier.forge);
    else if (s.level >= 15) startRun(s, 'caverns');
  }
  if (t >= nextLog) {
    nextLog = t + (+process.env.LOGEVERY || 1800);
    const st = stats(s);
    const dps = st.attack * (1 + st.typePct / 100) * st.more * st.aspd * (1 + st.crit / 100 * st.critDmg / 100);
    log.push(`dps/S ${(dps / S(s.level)).toFixed(1)} hp/S ${(st.hp / S(s.level)).toFixed(0)} arm ${(st.armour/S(s.level)).toFixed(0)} | ${(t / 3600).toFixed(1)}h L${s.level} stage ${Math.ceil(s.stage / 10)}-${((s.stage - 1) % 10) + 1} (max ${s.maxStage}) pow ${st.power} hp ${Math.round(st.hp)} atk ${Math.round(st.attack)} deaths ${s.totals.deaths} kills ${s.totals.kills} gold ${Math.round(s.gold)} bag ${s.bag.length} tower ${s.towerBest}`);
  }
}
console.log(cls, log.join('\n'), `\n(${((Date.now() - t0) / 1000).toFixed(1)}s real)`);
if (process.env.DUMP) { const { combat, _st, ...rest } = s; (await import('fs')).writeFileSync(process.env.DUMP, JSON.stringify(rest)); }
