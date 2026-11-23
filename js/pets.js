// Pets: collectable companions. One active pet fights and buffs the whole party.
export const PETS = [
  { id: 'drake',   name: 'Ember Drake',    art: 'drake',   desc: 'Party deals more damage',            bonus: (l) => ({ moreDmg: 4 + l * 0.6 }) },
  { id: 'phoenix', name: 'Phoenix Chick',  art: 'phoenix', desc: 'Revives a fallen hero (60s cooldown)', bonus: (l) => ({ incLife: 3 + l * 0.4 }), revive: true },
  { id: 'wolf',    name: 'Spirit Wolf',    art: 'wolf',    desc: 'Party attacks faster',                bonus: (l) => ({ aps: 3 + l * 0.35 }) },
  { id: 'golem',   name: 'Pebble Golem',   art: 'golem',   desc: 'Party gains Armour and Life',         bonus: (l) => ({ incArmour: 8 + l, incLife: 3 + l * 0.3 }) },
  { id: 'fox',     name: 'Ninetail Fox',   art: 'fox',     desc: 'Party deals more Elemental damage',   bonus: (l) => ({ incEle: 8 + l * 0.9 }) },
  { id: 'owl',     name: 'Arcane Owl',     art: 'owl',     desc: 'Faster skills and more experience',   bonus: (l) => ({ cdr: 2 + l * 0.25, xpGain: 5 + l * 0.5 }) },
  { id: 'slime',   name: 'Crowned Slime',  art: 'slime',   desc: 'Find more gold',                      bonus: (l) => ({ goldFind: 15 + l * 1.5 }) },
  { id: 'cat',     name: 'Shadow Cat',     art: 'cat',     desc: 'Party crits more often',              bonus: (l) => ({ critChance: 10 + l * 1.2 }) },
  { id: 'griffin', name: 'Golden Griffin', art: 'griffin', desc: 'Find rarer items',                    bonus: (l) => ({ rarity: 10 + l * 1.2 }) },
];
export const PET_BY_ID = Object.fromEntries(PETS.map((p) => [p.id, p]));
export const PET_MAX_LEVEL = 30;
export const petUpgradeCost = (level) => ({ shards: Math.ceil(25 * Math.pow(level, 1.5)), gold: Math.ceil(200 * Math.pow(1.12, level)) });
// Pet attack: a share of the party's average hit, growing with level
export const petAttackMult = (level) => 0.35 + level * 0.025;

export function petBonus(state) {
  const id = state.pets && state.pets.active;
  if (!id || !PET_BY_ID[id]) return null;
  const lvl = state.pets.owned[id] || 1;
  const b = PET_BY_ID[id].bonus(lvl);
  return Object.fromEntries(Object.entries(b).map(([k, v]) => [k, +v.toFixed(2)]));
}

export const STAT_LABEL = {
  moreDmg: '% more Damage', incLife: '% increased Life', aps: '% Attack Speed', incArmour: '% Armour',
  incEle: '% Elemental Damage', cdr: '% faster skills', xpGain: '% Experience', goldFind: '% Gold Found',
  critChance: '% Crit Chance', rarity: '% Item Rarity',
};
export const bonusText = (b) => Object.entries(b).map(([k, v]) => `+${+v.toFixed(1)}${STAT_LABEL[k] || ' ' + k}`).join(', ');

// ---- World boss invasions ----
// Two daily windows (local time), like a morning and evening invasion.
export const INVASION_WINDOWS = [{ start: 12, end: 13, name: 'Midday Invasion' }, { start: 20, end: 21, name: 'Evening Invasion' }];
export const INVASION_TIME = 90;
export const WORLD_BOSSES = [
  { id: 'dragon', name: 'Ancient Dragon', art: 'dragon', bg: 'lair' },
  { id: 'demon', name: 'Demon Lord', art: 'demonlord', bg: 'hellfire' },
];

export function invasionStatus(state, now = new Date()) {
  const day = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
  const h = now.getHours() + now.getMinutes() / 60;
  for (const w of INVASION_WINDOWS) {
    if (h >= w.start && h < w.end) {
      const key = `${day}@${w.start}`;
      const used = (state.invasion && state.invasion.used === key);
      const left = (w.end - h) * 3600;
      return { open: true, used, key, window: w, secondsLeft: left };
    }
  }
  // next window
  let next = INVASION_WINDOWS.find((w) => h < w.start);
  let secs;
  if (next) secs = (next.start - h) * 3600;
  else { next = INVASION_WINDOWS[0]; secs = (24 - h + next.start) * 3600; }
  return { open: false, window: next, secondsUntil: secs };
}
export const worldBossToday = (now = new Date()) => WORLD_BOSSES[Math.floor(now.getTime() / 86400000) % WORLD_BOSSES.length];

// Reward tier from the share of the boss's reference HP you chewed through
export function invasionReward(pct) {
  const emblems = Math.round(20 + Math.min(pct, 3) * 120);
  if (pct >= 1) return { emblems, boxes: { 3: 1, 2: 1 }, tier: 'S' };
  if (pct >= 0.6) return { emblems, boxes: { 3: 1 }, tier: 'A' };
  if (pct >= 0.3) return { emblems, boxes: { 2: 1 }, tier: 'B' };
  if (pct >= 0.1) return { emblems, boxes: { 1: 2 }, tier: 'C' };
  return { emblems, boxes: { 1: 1 }, tier: 'D' };
}

export const BOX_INFO = {
  1: { name: 'Box I', icon: '📦', desc: '3 items, Rare or better' },
  2: { name: 'Box II', icon: '🎁', desc: '2 items, Epic or better; 50% chance of a set piece; 10% pet egg' },
  3: { name: 'Box III', icon: '💎', desc: 'A Legendary or better item, a set piece, 25% Mythic, 30% pet egg' },
};
export const SHOP = [
  { id: 'egg', name: 'Pet Egg', icon: '🥚', cost: 150, desc: 'Hatches a random pet (duplicates level it up)' },
  { id: 'box2', name: 'Box II', icon: '🎁', cost: 120, desc: BOX_INFO[2].desc },
  { id: 'box3', name: 'Box III', icon: '💎', cost: 320, desc: BOX_INFO[3].desc },
  { id: 'key', name: 'Dungeon Key', icon: '🗝️', cost: 40, desc: 'Enter any unlocked dungeon' },
  { id: 'sigil', name: 'Raid Sigil', icon: '🔱', cost: 110, desc: 'Enter any unlocked raid' },
  { id: 'horn', name: 'Invasion Horn', icon: '📯', cost: 200, desc: 'Summon the world boss outside an invasion window' },
];
