// Static game data: rarities, slots, bases, affixes, passives, zones.

// Shared power curve. Monsters and gear both scale off this so that
// percentage modifiers, crafting and passives are what push you forward.
export const S = (l) => (1 + 0.1 * l) * Math.pow(1.04, l);

export const RARITIES = [
  { id: 0, name: 'Common',    color: '#c8c8c8', affixes: [0, 0], maxUpgrade: 5,  shards: 1,   weight: 52,  minStage: 1 },
  { id: 1, name: 'Magic',     color: '#6b8cff', affixes: [1, 2], maxUpgrade: 8,  shards: 3,   weight: 30,  minStage: 1 },
  { id: 2, name: 'Rare',      color: '#f2d64b', affixes: [3, 4], maxUpgrade: 12, shards: 8,   weight: 13,  minStage: 3 },
  { id: 3, name: 'Epic',      color: '#b46bff', affixes: [4, 5], maxUpgrade: 15, shards: 20,  weight: 4,   minStage: 8 },
  { id: 4, name: 'Legendary', color: '#ff8a2b', affixes: [6, 6], maxUpgrade: 20, shards: 60,  weight: 0.9, minStage: 15 },
  { id: 5, name: 'Mythic',    color: '#ff3b5c', affixes: [6, 6], maxUpgrade: 25, shards: 200, weight: 0.12, minStage: 40 },
];

// Minimum affix tier index (0 = T7 worst ... 6 = T1 best) forced by rarity.
export const RARITY_TIER_FLOOR = [0, 0, 0, 1, 3, 5];

export const SLOTS = [
  { id: 'weapon',  name: 'Weapon',   type: 'weapon' },
  { id: 'offhand', name: 'Off-hand', type: 'offhand' },
  { id: 'helm',    name: 'Helmet',   type: 'helm' },
  { id: 'chest',   name: 'Chest',    type: 'chest' },
  { id: 'gloves',  name: 'Gloves',   type: 'gloves' },
  { id: 'boots',   name: 'Boots',    type: 'boots' },
  { id: 'belt',    name: 'Belt',     type: 'belt' },
  { id: 'amulet',  name: 'Amulet',   type: 'amulet' },
  { id: 'ring1',   name: 'Ring',     type: 'ring' },
  { id: 'ring2',   name: 'Ring',     type: 'ring' },
];
export const ITEM_TYPES = ['weapon', 'offhand', 'helm', 'chest', 'gloves', 'boots', 'belt', 'amulet', 'ring'];
export const TYPE_ICONS = {
  weapon: '🗡️', offhand: '🛡️', helm: '⛑️', chest: '🥋', gloves: '🧤',
  boots: '🥾', belt: '🎗️', amulet: '📿', ring: '💍',
};

// Base item tiers unlock with item level. Higher base = stronger implicit.
export const BASE_ILVLS = [1, 12, 25, 40, 60, 80, 100, 130];
export const WEAPON_KINDS = {
  Dagger: { dmg: 0.75, aps: 1.55, crit: 7.5, names: ['Shiv', 'Dirk', 'Stiletto', 'Kris', 'Fang Dagger', 'Void Dagger', 'Eclipse Dagger', 'Oblivion Edge'] },
  Sword:  { dmg: 1.0,  aps: 1.3,  crit: 5,   names: ['Rusted Sword', 'Iron Blade', 'Broadsword', 'War Sword', 'Ancient Blade', 'Eternal Sword', 'Exalted Blade', 'Godforged Sword'] },
  Axe:    { dmg: 1.3,  aps: 1.1,  crit: 5,   names: ['Hatchet', 'Cleaver', 'Battle Axe', 'Reaver Axe', 'Butcher Axe', 'Despot Axe', 'Titan Axe', 'Worldsplitter'] },
  Mace:   { dmg: 1.2,  aps: 1.15, crit: 4,   names: ['Club', 'Spiked Club', 'Flanged Mace', 'Ornate Mace', 'Dragon Mace', 'Behemoth Mace', 'Colossus Mace', 'Starfall Maul'] },
};
export const BASE_NAMES = {
  offhand: ['Plank Shield', 'Buckler', 'Kite Shield', 'Tower Shield', 'Ancestral Shield', 'Titanium Shield', 'Aegis', 'Bulwark of Ages'],
  helm:    { armour: ['Iron Hat', 'Cone Helmet', 'Barbute', 'Close Helmet', 'Gladiator Helm', 'Royal Burgonet', 'Eternal Burgonet', 'Crown of Ages'],
             evasion: ['Leather Cap', 'Tricorne', 'Leather Hood', 'Wolf Pelt', 'Hunter Hood', 'Lion Pelt', 'Shadow Cowl', 'Veil of Night'] },
  chest:   { armour: ['Plate Vest', 'Chestplate', 'Copper Plate', 'War Plate', 'Gladiator Plate', 'Astral Plate', 'Glorious Plate', 'Titan Carapace'],
             evasion: ['Shabby Jerkin', 'Leather Vest', 'Buckskin Tunic', 'Wild Leather', 'Sun Leather', 'Assassin Garb', 'Zodiac Leather', 'Phantom Shroud'] },
  gloves:  { armour: ['Iron Gauntlets', 'Plated Gauntlets', 'Bronze Gauntlets', 'Steel Gauntlets', 'Ancient Gauntlets', 'Titan Gauntlets', 'Spiked Gauntlets', 'Fists of Ruin'],
             evasion: ['Rawhide Gloves', 'Goathide Gloves', 'Deerskin Gloves', 'Eelskin Gloves', 'Sharkskin Gloves', 'Slink Gloves', 'Gripped Gloves', 'Wraith Grips'] },
  boots:   { armour: ['Iron Greaves', 'Steel Greaves', 'Plated Greaves', 'Reinforced Greaves', 'Antique Greaves', 'Titan Greaves', 'Vaal Greaves', 'Stride of Kings'],
             evasion: ['Rawhide Boots', 'Goathide Boots', 'Deerskin Boots', 'Nubuck Boots', 'Eelskin Boots', 'Sharkskin Boots', 'Slink Boots', 'Windwalkers'] },
  belt:    ['Rustic Sash', 'Chain Belt', 'Leather Belt', 'Heavy Belt', 'Cloth Belt', 'Studded Belt', 'Vanguard Belt', 'Belt of Giants'],
  amulet:  ['Paua Amulet', 'Coral Amulet', 'Amber Amulet', 'Jade Amulet', 'Lapis Amulet', 'Onyx Amulet', 'Marble Amulet', 'Star Amulet'],
  ring:    ['Iron Ring', 'Coral Ring', 'Paua Ring', 'Gold Ring', 'Ruby Ring', 'Diamond Ring', 'Prismatic Ring', 'Ring of Eternity'],
};
export const SLOT_DEF_MULT = { helm: 1.0, chest: 1.7, gloves: 0.8, boots: 0.8, offhand: 1.3 };

// Affix tiers: T7 (index 0) .. T1 (index 6). Unlock item levels and multipliers.
export const TIER_ILVL = [1, 8, 18, 30, 45, 65, 85];
export const TIER_MULT = [0.5, 0.62, 0.75, 0.87, 1.0, 1.15, 1.32];

// kind: flat (scales with S(ilvl)), pct (fixed by tier), range (min-max, scales)
export const AFFIXES = [
  // Prefixes
  { id: 'addPhys',   type: 'prefix', kind: 'range', base: [1.2, 2.4], text: 'Adds {a}–{b} Physical Damage',       slots: ['weapon', 'gloves', 'ring', 'amulet'], weaponMult: 1.8 },
  { id: 'addEle',    type: 'prefix', kind: 'range', base: [0.8, 2.6], text: 'Adds {a}–{b} Elemental Damage',      slots: ['weapon', 'gloves', 'ring', 'amulet'], weaponMult: 1.8 },
  { id: 'incPhys',   type: 'prefix', kind: 'pct',   base: 30,  text: '+{v}% increased Physical Damage',               slots: ['weapon', 'amulet', 'offhand'], weaponMult: 1.6 },
  { id: 'incEle',    type: 'prefix', kind: 'pct',   base: 30,  text: '+{v}% increased Elemental Damage',              slots: ['weapon', 'amulet', 'ring', 'offhand'], weaponMult: 1.6 },
  { id: 'life',      type: 'prefix', kind: 'flat',  base: 12,  text: '+{v} to maximum Life',                          slots: ['offhand', 'helm', 'chest', 'gloves', 'boots', 'belt', 'amulet', 'ring'] },
  { id: 'armour',    type: 'prefix', kind: 'flat',  base: 22,  text: '+{v} to Armour',                                slots: ['offhand', 'helm', 'chest', 'gloves', 'boots', 'belt'] },
  { id: 'evasion',   type: 'prefix', kind: 'flat',  base: 22,  text: '+{v} to Evasion',                               slots: ['offhand', 'helm', 'chest', 'gloves', 'boots', 'belt'] },
  { id: 'incLife',   type: 'prefix', kind: 'pct',   base: 8,   text: '+{v}% increased maximum Life',                  slots: ['chest', 'belt', 'amulet'] },
  // Suffixes
  { id: 'aps',       type: 'suffix', kind: 'pct',   base: 8,   text: '+{v}% increased Attack Speed',                  slots: ['weapon', 'gloves', 'ring', 'amulet'], weaponMult: 1.5 },
  { id: 'critChance',type: 'suffix', kind: 'pct',   base: 25,  text: '+{v}% increased Critical Strike Chance',        slots: ['weapon', 'amulet', 'helm', 'ring'] },
  { id: 'critMulti', type: 'suffix', kind: 'pct',   base: 20,  text: '+{v}% to Critical Strike Multiplier',           slots: ['weapon', 'amulet', 'ring', 'gloves'] },
  { id: 'resist',    type: 'suffix', kind: 'pct',   base: 11,  text: '+{v}% to Elemental Resistance',                 slots: ['offhand', 'helm', 'chest', 'gloves', 'boots', 'belt', 'amulet', 'ring'] },
  { id: 'regen',     type: 'suffix', kind: 'flat',  base: 0.8, text: 'Regenerate {v} Life per second',                slots: ['chest', 'belt', 'ring', 'amulet', 'helm'] },
  { id: 'lifeOnHit', type: 'suffix', kind: 'flat',  base: 1.0, text: 'Gain {v} Life per Hit',                         slots: ['weapon', 'gloves', 'ring'] },
  { id: 'leech',     type: 'suffix', kind: 'pct',   base: 1.0, text: '{v}% of Damage Leeched as Life',               slots: ['weapon', 'gloves', 'amulet'], decimals: 1 },
  { id: 'block',     type: 'suffix', kind: 'pct',   base: 5,   text: '+{v}% Chance to Block',                         slots: ['offhand'] },
  { id: 'goldFind',  type: 'suffix', kind: 'pct',   base: 15,  text: '+{v}% increased Gold Found',                    slots: ['helm', 'ring', 'amulet', 'boots'] },
  { id: 'rarity',    type: 'suffix', kind: 'pct',   base: 10,  text: '+{v}% increased Item Rarity',                   slots: ['helm', 'ring', 'amulet', 'boots'] },
  { id: 'xpGain',    type: 'suffix', kind: 'pct',   base: 6,   text: '+{v}% increased Experience Gain',               slots: ['amulet', 'helm'] },
];
export const AFFIX_BY_ID = Object.fromEntries(AFFIXES.map((a) => [a.id, a]));

export const ZONES = [
  { name: 'The Twilight Strand', monsters: ['🧟', '🦀', '🐍'], boss: '🧟‍♂️', bossName: 'Hillock' },
  { name: 'The Ledge',           monsters: ['🦇', '🐗', '🕷️'], boss: '🦂', bossName: 'Brutus' },
  { name: 'Prisoner\'s Gate',    monsters: ['💀', '🐺', '🦎'], boss: '👹', bossName: 'Merveil' },
  { name: 'The Crossroads',      monsters: ['🐊', '🦂', '🧌'], boss: '🐉', bossName: 'Vaal Oversoul' },
  { name: 'Chamber of Sins',     monsters: ['👻', '🦑', '🐙'], boss: '😈', bossName: 'Piety' },
  { name: 'The Ancient Pyramid', monsters: ['🧞', '🐫', '🦅'], boss: '🗿', bossName: 'Dominus' },
  { name: 'The Cathedral',       monsters: ['🦴', '🕸️', '🧛'], boss: '🧙‍♂️', bossName: 'Malachai' },
  { name: 'The Blood Aqueduct',  monsters: ['🩸', '🦈', '🐲'], boss: '🐍', bossName: 'Arakaali' },
  { name: 'The Harbour Bridge',  monsters: ['🌊', '🐋', '🦞'], boss: '🦑', bossName: 'Doedre' },
  { name: 'The Sceptre of God',  monsters: ['⚡', '🔥', '❄️'], boss: '🌟', bossName: 'Kitava' },
];
export const STAGES_PER_ZONE = 10;
export const MONSTERS_PER_STAGE = 10;
export const zoneFor = (stage) => ZONES[Math.floor((stage - 1) / STAGES_PER_ZONE) % ZONES.length];
export const zoneIndex = (stage) => Math.floor((stage - 1) / STAGES_PER_ZONE);
export const isBossStage = (stage) => stage % STAGES_PER_ZONE === 0;
// PoE-style resistance penalty as you go deeper
export const resistPenalty = (stage) => Math.min(60, Math.floor(zoneIndex(stage) / 2) * 10);
// Share of monster damage that is physical (rest elemental)
export const physShare = (stage) => Math.max(0.35, 0.8 - zoneIndex(stage) * 0.05);
