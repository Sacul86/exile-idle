// Headless balance sim for Delve & Loot: node tools/sim.js [look] [hours]
import { newState, tick, stats, smartSpend, learnSpell, levelSpell, sellBelow } from '../js/game.js';
import { SPELL_KEYS } from '../js/data.js';

const look = process.argv[2] || 'paladin', hours = +(process.argv[3] || 6);
const s = newState(look); s.picked = true;
let t = 0, nextLog = 0, lastTownSpend = -1;
const every = +(process.env.LOGEVERY || 1800);
const out = [];
const t0 = Date.now();
while (t < hours * 3600) {
  tick(s, 0.1); t += 0.1;
  if (!s.run && s.totals.dives !== lastTownSpend) {
    lastTownSpend = s.totals.dives;
    sellBelow(s, 2);
    for (const k of SPELL_KEYS) learnSpell(s, k);
    smartSpend(s);
    for (const k of s.slots) levelSpell(s, k);
  }
  if (t >= nextLog) {
    nextLog = t + every;
    const st = stats(s), ld = s.lastDive;
    out.push(`${(t / 3600).toFixed(1)}h L${s.level} deepest ${s.deepest} last ${ld ? ld.from + '->' + ld.to + ' (' + ld.why + ')' : '-'} pow ${st.power} gold ${s.gold} dives ${s.totals.dives} deaths ${s.totals.deaths} kills ${s.totals.kills} stash ${s.stash.length} pots ${s.potions} spells ${Object.keys(s.spells).length} train ${Object.values(s.training).join('/')}`);
  }
}
console.log(look + '\n' + out.join('\n') + `\n(${((Date.now() - t0) / 1000).toFixed(1)}s)`);
if (process.env.DUMP) { const { combat, _st, ...rest } = s; (await import('fs')).writeFileSync(process.env.DUMP, JSON.stringify(rest)); }
