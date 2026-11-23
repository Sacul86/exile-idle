// Items and hero stats (pure).
import { S, SLOTS, BASES, BASE_KEYS, SLOT_BASE, RARITIES, RARITY_WEIGHTS, AFFIXES, AFFIX_KEYS, UPGRADE_MAX, LOOKS } from './data.js';

let uid = Date.now() % 1e7;
export const newId = () => (++uid).toString(36);
const pick = (a) => a[Math.floor(Math.random() * a.length)];

export function rollRarity(floor, find = 0) {
  const w = RARITY_WEIGHTS.map((x, i) => x * Math.pow(1 + floor / 70, i) * (i ? 1 + find / 100 : 1));
  let r = Math.random() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < w.length; i++) { r -= w[i]; if (r <= 0) return i; }
  return 0;
}
export function makeItem(ilvl, o = {}) {
  const base = o.base || pick(BASE_KEYS);
  const rarity = o.rarity ?? rollRarity(ilvl, o.find || 0);
  const affixes = [];
  const pool = [...AFFIX_KEYS];
  for (let i = 0; i < RARITIES[rarity].affixes; i++) {
    const k = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
    const a = AFFIXES[k];
    affixes.push({ k, v: +(a.r[0] + Math.random() * (a.r[1] - a.r[0])).toFixed(1) });
  }
  return { id: newId(), base, slot: BASES[base].slot, ilvl: Math.max(1, Math.round(ilvl)), rarity, affixes, up: 0, locked: false, isNew: true };
}
export function itemStats(it) {
  const b = BASES[it.base], R = RARITIES[it.rarity], s = S(it.ilvl), up = 1 + 0.1 * it.up;
  const out = {};
  for (const [k, v] of Object.entries(b.s)) {
    if (k === 'attack' || k === 'hp' || k === 'armor') out[k] = v * SLOT_BASE[k] * s * R.mult * up;
    else out[k] = v * (1 + it.rarity * 0.25);
  }
  for (const a of it.affixes) out[a.k] = (out[a.k] || 0) + a.v * (1 + it.up * 0.05);
  return out;
}
export const itemName = (it) => `${it.rarity >= 4 ? 'Legendary ' : it.rarity === 3 ? 'Epic ' : it.rarity === 2 ? 'Rare ' : it.rarity === 1 ? 'Fine ' : ''}${BASES[it.base].name}${it.up ? ` +${it.up}` : ''}`;
export const itemValue = (it, haggle = 0) => Math.round(3 * S(it.ilvl) * RARITIES[it.rarity].value * (1 + 0.2 * it.up) * (1 + haggle * 0.06));
export const upgradeCost = (it) => Math.round(8 * S(it.ilvl) * Math.sqrt(RARITIES[it.rarity].value) * Math.pow(it.up + 1, 1.6));
export const mergeKey = (it) => `${it.base}|${it.rarity}`;
export function mergeItems(items) {
  const [a] = items;
  const it = makeItem(Math.max(...items.map((x) => x.ilvl)), { base: a.base, rarity: Math.min(RARITIES.length - 1, a.rarity + 1) });
  it.up = Math.max(...items.map((x) => x.up));
  return it;
}

export const armorReduction = (armor, lvl) => Math.min(0.75, armor / (armor + 20 * Math.pow(S(lvl), 1.15)));
export function heroStats(state, gear = state.gear) {
  const L = state.level, T = state.training, look = LOOKS[state.look] || LOOKS.paladin, m = look.mods;
  const add = {};
  for (const sl of SLOTS) { const it = gear[sl]; if (!it) continue; for (const [k, v] of Object.entries(itemStats(it))) add[k] = (add[k] || 0) + v; }
  const attack = (2 + S(L)) * 1 + (add.attack || 0);
  const hp = 60 + 10 * S(L) + (add.hp || 0);
  const armor = 2 * S(L) + (add.armor || 0);
  const st = {
    lv: L, range: look.range,
    attack: attack * (1 + ((add.attackPct || 0) + T.str * 6 + (m.dmgPct || 0)) / 100),
    hp: hp * (1 + ((add.hpPct || 0) + T.vit * 7 + (m.hpPct || 0)) / 100),
    armor: armor * (1 + ((add.armorPct || 0) + (m.armorPct || 0)) / 100),
    speed: Math.max(0.4, 1 + ((add.speed || 0) + T.agi * 3 + (m.speedPct || 0)) / 100),
    crit: Math.min(60, 5 + (add.crit || 0) + T.agi * 0.5), critDmg: 60,
    lifesteal: add.lifesteal || 0,
    gold: (add.gold || 0) + T.haggle * 4, find: (add.find || 0) + T.loot * 3,
    bag: 12 + T.loot * 2, potionHeal: 35 + T.alch * 4, belt: 5 + Math.floor(T.alch / 2),
    spell: 1 + (m.spellPct || 0) / 100, haggle: T.haggle,
  };
  const dps = st.attack * st.speed * (1 + st.crit / 100 * st.critDmg / 100);
  st.power = Math.round(Math.sqrt(dps * st.hp * (1 + st.armor / (20 * Math.pow(S(L), 1.15)))));
  return st;
}
export const itemPower = (state, it) => heroStats(state, { ...state.gear, [it.slot]: it }).power - heroStats(state).power;
export { UPGRADE_MAX };
