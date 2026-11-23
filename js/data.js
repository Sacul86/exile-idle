// Delve & Loot: static data. One hero, dungeon dives, a bag you can lose, a town to sell in.
export const S = (l) => (1 + 0.1 * l) * Math.pow(1.04, l);   // shared power curve (floor / item level)
export const OFFLINE_CAP_H = 12;
export const FLOORS_PER_DUNGEON = 10;
export const PACKS_PER_FLOOR = 3;

// Hero look also sets fighting style (scene3d HERO keys: warrior, paladin, ranger, mage)
export const LOOKS = {
  paladin: { name: 'Knight', icon: '🛡️', range: 1.7, desc: 'Sword and shield. +25% life, +25% armour.', mods: { hpPct: 25, armorPct: 25 } },
  warrior: { name: 'Barbarian', icon: '🪓', range: 1.7, desc: 'Big axe. +20% damage.', mods: { dmgPct: 20 } },
  ranger: { name: 'Ranger', icon: '🏹', range: 6.5, desc: 'Crossbow from range. +15% attack speed.', mods: { speedPct: 15 } },
  mage: { name: 'Mage', icon: '🔮', range: 6.5, desc: 'Staff from range. +30% spell power.', mods: { spellPct: 30 } },
};

export const SLOTS = ['weapon', 'helmet', 'armour', 'boots', 'ring', 'amulet'];
export const SLOT_INFO = { weapon: { name: 'Weapon', icon: '🗡️' }, helmet: { name: 'Helmet', icon: '⛑️' }, armour: { name: 'Armour', icon: '🥋' }, boots: { name: 'Boots', icon: '🥾' }, ring: { name: 'Ring', icon: '💍' }, amulet: { name: 'Amulet', icon: '📿' } };

// item bases: stats are multipliers on the slot's base numbers at the item's level
export const BASES = {
  sword: { slot: 'weapon', name: 'Sword', icon: '🗡️', s: { attack: 1, crit: 2 } },
  axe: { slot: 'weapon', name: 'Axe', icon: '🪓', s: { attack: 1.2, speed: -5 } },
  dagger: { slot: 'weapon', name: 'Dagger', icon: '🔪', s: { attack: 0.8, speed: 15, crit: 5 } },
  mace: { slot: 'weapon', name: 'Mace', icon: '🔨', s: { attack: 1.1, hp: 0.3 } },
  cap: { slot: 'helmet', name: 'Leather Cap', icon: '🧢', s: { hp: 0.8, armor: 0.6, speed: 3 } },
  helm: { slot: 'helmet', name: 'Iron Helm', icon: '⛑️', s: { hp: 1, armor: 1 } },
  tunic: { slot: 'armour', name: 'Tunic', icon: '👕', s: { hp: 1.6, armor: 0.8, speed: 4 } },
  mail: { slot: 'armour', name: 'Chainmail', icon: '🥋', s: { hp: 2, armor: 1.4 } },
  plate: { slot: 'armour', name: 'Plate Armour', icon: '🛡️', s: { hp: 2.4, armor: 2, speed: -4 } },
  boots: { slot: 'boots', name: 'Boots', icon: '🥾', s: { hp: 0.8, armor: 0.6, speed: 4 } },
  greaves: { slot: 'boots', name: 'Greaves', icon: '🦿', s: { hp: 1, armor: 1 } },
  ring: { slot: 'ring', name: 'Ring', icon: '💍', s: { attack: 0.3, crit: 4 } },
  band: { slot: 'ring', name: 'Band', icon: '⭕', s: { attack: 0.2, lifesteal: 1.5 } },
  amulet: { slot: 'amulet', name: 'Amulet', icon: '📿', s: { hp: 0.8, gold: 10 } },
  charm: { slot: 'amulet', name: 'Lucky Charm', icon: '🍀', s: { hp: 0.5, find: 8 } },
};
export const BASE_KEYS = Object.keys(BASES);
export const SLOT_BASE = { attack: 6, hp: 14, armor: 3 };   // multiplied by S(ilvl)

export const RARITIES = [
  { name: 'Common', color: '#c8c8c8', mult: 1, value: 1, affixes: 0 },
  { name: 'Uncommon', color: '#5cc46b', mult: 1.5, value: 2.5, affixes: 1 },
  { name: 'Rare', color: '#6b8cff', mult: 2.2, value: 7, affixes: 2 },
  { name: 'Epic', color: '#b46bff', mult: 3.2, value: 20, affixes: 3 },
  { name: 'Legendary', color: '#ff8a2b', mult: 4.6, value: 60, affixes: 3 },
];
export const RARITY_WEIGHTS = [70, 22, 6.5, 1.3, 0.2];
export const AFFIXES = {
  attackPct: { name: 'damage', r: [6, 14] },
  hpPct: { name: 'life', r: [6, 14] },
  armorPct: { name: 'armour', r: [8, 18] },
  crit: { name: 'crit chance', r: [2, 5] },
  speed: { name: 'attack speed', r: [4, 9] },
  lifesteal: { name: 'life steal', r: [0.5, 1.5] },
  gold: { name: 'gold found', r: [6, 15] },
  find: { name: 'item find', r: [4, 10] },
};
export const AFFIX_KEYS = Object.keys(AFFIXES);
export const UPGRADE_MAX = 10;

// Spells: bought in town, levelled with gold, auto-cast in the dungeon
export const SPELLS = {
  fireball: { name: 'Fireball', icon: '🔥', elem: 'fire', role: 'secondary', cd: 6, coef: 3.2, learn: 150, text: 'Big fire hit on one enemy, sets it burning' },
  heal: { name: 'Heal', icon: '💚', elem: 'nature', role: 'defensive', cd: 14, heal: 28, learn: 300, text: 'Heals 28% of your life when you drop below half' },
  frostnova: { name: 'Frost Nova', icon: '❄️', elem: 'cold', role: 'aoe', cd: 10, coef: 1.3, radius: 4.5, freeze: 1.6, learn: 700, text: 'Hits everything near you and freezes it' },
  lightning: { name: 'Chain Lightning', icon: '⚡', elem: 'lightning', role: 'primary', cd: 7, coef: 1.7, chains: 4, learn: 1600, text: 'Jumps between up to 4 enemies' },
  shield: { name: 'Stone Shield', icon: '🪨', elem: 'arcane', role: 'defensive', cd: 16, shield: 35, learn: 3500, text: 'Absorbs damage worth 35% of your life' },
  whirlwind: { name: 'Whirlwind', icon: '🌪️', elem: 'phys', role: 'aoe', cd: 9, coef: 1.1, hits: 3, radius: 3.2, learn: 8000, text: 'Spin attack: 3 hits on everything close' },
};
export const SPELL_KEYS = Object.keys(SPELLS);
export const spellSlots = (lvl) => 2 + (lvl >= 15 ? 1 : 0) + (lvl >= 35 ? 1 : 0);
export const spellPower = (lvl) => 1 + 0.18 * (lvl - 1);
export const spellUpCost = (key, lvl) => Math.round(SPELLS[key].learn * 0.6 * Math.pow(1.55, lvl));

export const TRAINING = {
  str: { name: 'Strength', icon: '💪', base: 40, text: (l) => `+${l * 6}% damage` },
  vit: { name: 'Vitality', icon: '❤️', base: 40, text: (l) => `+${l * 7}% life` },
  agi: { name: 'Agility', icon: '💨', base: 70, text: (l) => `+${l * 3}% attack speed, +${(l * 0.5).toFixed(1)}% crit` },
  loot: { name: 'Looting', icon: '🎒', base: 90, text: (l) => `+${l * 2} bag slots, +${l * 3}% item drops` },
  haggle: { name: 'Haggling', icon: '🪙', base: 80, text: (l) => `+${l * 6}% sell value, +${l * 4}% gold drops` },
  alch: { name: 'Alchemy', icon: '⚗️', base: 70, text: (l) => `+${l * 4}% potion healing, +${Math.floor(l / 2)} potion belt` },
};
export const TRAIN_KEYS = Object.keys(TRAINING);
export const trainCost = (key, lvl) => Math.round(TRAINING[key].base * Math.pow(1.42, lvl));

export const POTION = { heal: 35, belt: 5, price: (deepest) => Math.round(8 * S(Math.max(1, deepest))) };

// Dungeons are 10-floor bands of one endless descent. Reaching a dungeon unlocks its entrance as a checkpoint.
const D = (name, theme, monsters, boss, bossArt, mech) => ({ name, theme, monsters, boss, bossArt, mech });
export const DUNGEONS = [
  D('Mossy Woods', 'crossroads', ['bandit', 'spider', 'direwolf', 'myconid', 'treant'], 'Forest Warden', 'thornmother', ['slam', 'adds']),
  D('Bone Crypt', 'necropolis', ['skeleton', 'zombie', 'ghoul', 'skelmage', 'wraith'], 'Bone King', 'lich', ['slam', 'adds', 'storm']),
  D('Iron Mines', 'ironhold', ['magmagolem', 'imp', 'dknight', 'bandit', 'ratman'], 'Forge Tyrant', 'forgetyrant', ['slam', 'storm', 'enrage']),
  D('Frozen Halls', 'frostfall', ['frostwolf', 'yeti', 'wisp', 'wraith'], 'Ice Sovereign', 'icesovereign', ['slam', 'storm', 'ultimate']),
  D('Ash Caverns', 'hellfire', ['imp', 'scorpion', 'magmagolem', 'cultist'], 'Ashen Dragon', 'dragon', ['breath', 'storm', 'enrage']),
  D('Shadow Keep', 'prison', ['wraith', 'cultist', 'bat', 'banshee', 'dknight'], 'Shadow Lord', 'shadowlord', ['slam', 'adds', 'ultimate']),
  D('Sunken Temple', 'harbour', ['fishman', 'crabknight', 'siren', 'leech'], 'Abyssal Horror', 'kraken', ['adds', 'storm', 'enrage']),
  D('The Void', 'rift', ['flesh', 'wisp', 'skelmage', 'wraith'], 'Void Titan', 'voidtitan', ['slam', 'storm', 'ultimate']),
  D('Fallen Spire', 'spire', ['angel', 'dknight', 'cultist', 'sungolem'], 'The Eternal One', 'eternalone', ['slam', 'adds', 'enrage', 'ultimate']),
  D('The Endless Abyss', 'tower', ['skeleton', 'dknight', 'wraith', 'skelmage', 'yeti', 'demonlord'], 'Abyss Warden', 'rockgolem', ['slam', 'storm', 'adds', 'ultimate']),
];
// floors past the last band keep going in the Abyss
export const dungeonOf = (floor) => Math.min(DUNGEONS.length - 1, Math.floor((floor - 1) / FLOORS_PER_DUNGEON));
export const MONSTER_NAMES = {
  treant: 'Bark Treant', direwolf: 'Dire Wolf', spider: 'Giant Spider', myconid: 'Myconid', bandit: 'Bandit', skeleton: 'Skeleton', zombie: 'Zombie', ghoul: 'Ghoul',
  wraith: 'Wraith', banshee: 'Banshee', skelmage: 'Bone Mage', magmagolem: 'Magma Golem', imp: 'Imp', dknight: 'Iron Knight', ratman: 'Ratman', frostwolf: 'Frost Wolf',
  yeti: 'Yeti', wisp: 'Wisp', scorpion: 'Ash Scorpion', cultist: 'Cultist', bat: 'Dusk Bat', fishman: 'Deep One', crabknight: 'Crab Knight', siren: 'Siren',
  leech: 'Leech', flesh: 'Void Spawn', angel: 'Fallen Angel', sungolem: 'Sun Golem', demonlord: 'Demon',
};
export const ELITE_MODS = { tough: '🪨', fast: '💨', vampiric: '🩸', explosive: '💥' };
