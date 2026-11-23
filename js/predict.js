// Predict how a vault / raid would go by simulating it headlessly on a copy of the party.
import { startRun, tick, partyReady } from './game.js';

const cache = new Map();
export const powerKey = (state) => `${state.level}:${Math.round(Math.log(Math.max(1, state.combat.party.power)) * 30)}`;

export const RATINGS = {
  trivial: { label: 'Too easy', cls: 'r-trivial', icon: '😴' },
  easy:    { label: 'Easy',     cls: 'r-easy',    icon: '🟢' },
  fair:    { label: 'Fair',     cls: 'r-fair',    icon: '🟡' },
  hard:    { label: 'Hard',     cls: 'r-hard',    icon: '🟠' },
  deadly:  { label: 'Too hard', cls: 'r-deadly',  icon: '🔴' },
};

export function rate(win, timeFrac, downs) {
  if (!win) return 'deadly';
  let r = timeFrac < 0.2 ? 'trivial' : timeFrac < 0.45 ? 'easy' : timeFrac < 0.75 ? 'fair' : 'hard';
  if (downs >= 2) r = { trivial: 'easy', easy: 'fair', fair: 'hard', hard: 'hard' }[r];
  return r;
}

export function simulateRun(state, kind, tier) {
  if (!partyReady(state)) return null;
  const { combat, ...rest } = state;
  const c = JSON.parse(JSON.stringify(rest));
  c.combat = null; c.run = null; c.keys = 1; c.sigils = 1; c.settings = { ...c.settings, autoEquip: false, autoSalvage: 5 };
  c.lootLog = []; c.bag = [];
  c.dungeonsCleared = { ...c.dungeonsCleared, [tier]: 1 }; c.maxStage = Math.max(c.maxStage, tier * 10 + 1);
  if (startRun(c, kind, tier)) return null;
  const ev = [];
  const limit = c.run.timeLimit;
  let res = null;
  for (let t = 0; t < limit + 2 && !res; t += 0.2) {
    const run = c.run;
    tick(c, 0.2, ev);
    for (const e of ev) if (e.t === 'runEnd') res = { win: e.success, time: e.run.time, limit, downs: e.run.downs || 0 };
    ev.length = 0;
    if (!c.run && !res) res = { win: false, time: run.time, limit, downs: run.downs || 0 };
  }
  res = res || { win: false, time: limit, limit, downs: 0 };
  res.rating = rate(res.win, res.time / limit, res.downs);
  return res;
}

export function predict(state, kind, tier, compute = true) {
  const key = `${kind}:${tier}:${powerKey(state)}`;
  if (cache.has(key)) return cache.get(key);
  if (!compute) return null;
  const r = simulateRun(state, kind, tier);
  if (r) cache.set(key, r);
  if (cache.size > 300) cache.delete(cache.keys().next().value);
  return r;
}
