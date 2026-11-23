// Eternal Ascent: static game data. Pure data + tiny helpers, no DOM.

export const S = (l) => (1 + 0.1 * l) * Math.pow(1.04, l);   // power curve shared by gear and monsters
export const LEVEL_CAP = 80;
export const OFFLINE_CAP_H = 12;

export const ATTRS = {
  str: { name: 'Strength', icon: '💪', desc: '+0.6% physical damage per point' },
  int: { name: 'Intelligence', icon: '🧠', desc: '+0.6% magic damage per point' },
  dex: { name: 'Dexterity', icon: '🎯', desc: '+0.04% crit chance and +0.15% attack speed per point' },
  vit: { name: 'Vitality', icon: '❤️', desc: '+0.6% life and +0.3% armour per point' },
  wis: { name: 'Wisdom', icon: '📘', desc: '+0.12% cooldown reduction and +0.5% resource regen per point' },
};
export const ATTR_KEYS = Object.keys(ATTRS);
export const ATTR_PER_LEVEL = 5;

// Unlock milestones from the design doc
export const UNLOCKS = [
  { lvl: 5, key: 'slot2', text: '2nd skill slot (Defensive)' },
  { lvl: 10, key: 'spec', text: 'Choose your specialisation' },
  { lvl: 15, key: 'gems', text: 'Gems, sockets and runes' },
  { lvl: 20, key: 'slot3', text: '3rd skill slot (AoE) + 1st passive companion' },
  { lvl: 25, key: 'talents', text: 'Passive talent trees' },
  { lvl: 30, key: 'dungeons', text: 'Dungeons + 4th skill slot (Secondary)' },
  { lvl: 35, key: 'inscriptions', text: 'Inscriptions' },
  { lvl: 40, key: 'spec2', text: 'Specialisation tier 2 + 5th skill slot (Utility)' },
  { lvl: 45, key: 'pet3', text: '2nd passive companion' },
  { lvl: 50, key: 'ultimate', text: 'Ultimate skill slot' },
  { lvl: 60, key: 'legendary', text: 'Legendary gear drops + crafting' },
  { lvl: 70, key: 'awakening', text: 'Awakening (gear + skill evolutions)' },
  { lvl: 80, key: 'endgame', text: 'Endgame: Mastery, World Tiers, Ascension' },
];
export const unlocked = (state, key) => {
  if (state.ascensions > 0 && key !== 'endgame') return true;   // ascended heroes keep their unlocks
  const u = UNLOCKS.find((x) => x.key === key);
  return !u || state.level >= u.lvl;
};

// ---------------- classes & specs ----------------
export const CLASSES = {
  warrior: { name: 'Warrior', icon: '⚔️', art: 'marauder', color: '#d0563a', dmg: 'phys', res: 'Rage', weapon: ['Greatsword', 'Battleaxe', 'Warhammer'], off: 'Shield',
    grow: { str: 3, int: 0, dex: 1, vit: 3, wis: 1 },
    trees: [{ id: 'fury', name: 'Fury', icon: '🩸' }, { id: 'command', name: 'Command', icon: '📯' }, { id: 'bulwark', name: 'Defence', icon: '🛡️' }],
    specs: [
      { id: 'berserker', tree: 'fury', name: 'Berserker', desc: 'Relentless attack speed and life steal.', t1: { aspd: 15, leech: 1 }, t2: { frenzy: 30, aspd: 10 }, t2txt: 'Frenzy: +30% damage below 50% life' },
      { id: 'warlord', tree: 'command', name: 'Warlord', desc: 'Battle shouts and crushing crits.', t1: { critDmg: 30, buffDur: 30 }, t2: { more: 15, crit: 5 }, t2txt: '+15% more damage, +5% crit chance' },
      { id: 'guardian', tree: 'bulwark', name: 'Guardian', desc: 'An immovable wall that hits back.', t1: { hpPct: 30, armourPct: 30 }, t2: { dr: 15, thorns: 25 }, t2txt: '15% damage reduction, reflect 25% of damage taken' },
    ] },
  mage: { name: 'Mage', icon: '🔮', art: 'witch', color: '#6b8cff', dmg: 'magic', res: 'Mana', weapon: ['Staff', 'Wand', 'Rod'], off: 'Orb',
    grow: { str: 0, int: 4, dex: 1, vit: 2, wis: 2 },
    trees: [{ id: 'fire', name: 'Fire', icon: '🔥' }, { id: 'ice', name: 'Ice', icon: '❄️' }, { id: 'arcane', name: 'Arcane', icon: '✨' }],
    specs: [
      { id: 'pyromancer', tree: 'fire', name: 'Pyromancer', desc: 'Burns everything; burns spread.', t1: { fire: 25, burnDmg: 30 }, t2: { burnExplode: 1, fire: 15 }, t2txt: 'Burning enemies explode on death' },
      { id: 'frostweaver', tree: 'ice', name: 'Frostweaver', desc: 'Chills, freezes and shatters.', t1: { cold: 25, chillDur: 40 }, t2: { frozenTaken: 30, dr: 8 }, t2txt: 'Frozen enemies take +30% damage' },
      { id: 'arcanist', tree: 'arcane', name: 'Arcanist', desc: 'Cooldowns melt away; spells echo.', t1: { cdr: 10, regen: 30 }, t2: { doubleCast: 15, arcane: 15 }, t2txt: '15% chance to cast skills twice' },
    ] },
  ranger: { name: 'Ranger', icon: '🏹', art: 'ranger', color: '#5cc46b', dmg: 'phys', res: 'Focus', weapon: ['Longbow', 'Recurve Bow', 'Crossbow'], off: 'Quiver',
    grow: { str: 1, int: 0, dex: 4, vit: 2, wis: 1 },
    trees: [{ id: 'marks', name: 'Marksman', icon: '🎯' }, { id: 'beast', name: 'Beast', icon: '🐺' }, { id: 'shade', name: 'Shadow', icon: '🌑' }],
    specs: [
      { id: 'deadeye', tree: 'marks', name: 'Deadeye', desc: 'Critical strikes that end fights.', t1: { crit: 8, critDmg: 25 }, t2: { critDmg: 50 }, t2txt: '+50% critical damage' },
      { id: 'beastmaster', tree: 'beast', name: 'Beastmaster', desc: 'Fights alongside empowered companions.', t1: { petDmg: 100, hpPct: 10 }, t2: { petFull: 1, petDmg: 100 }, t2txt: 'Passive companions give their full bonus' },
      { id: 'shadowhunter', tree: 'shade', name: 'Shadowhunter', desc: 'Poisons, traps and ambushes.', t1: { poisonDmg: 40, shadow: 20 }, t2: { poisonCrit: 50 }, t2txt: 'Poisoned enemies take +50% crit damage' },
    ] },
  warlock: { name: 'Warlock', icon: '💀', art: 'warlock', color: '#9b59d0', dmg: 'magic', res: 'Souls', weapon: ['Scythe', 'Bone Staff', 'Grimoire Staff'], off: 'Tome',
    grow: { str: 0, int: 4, dex: 0, vit: 3, wis: 2 },
    trees: [{ id: 'death', name: 'Death', icon: '☠️' }, { id: 'soul', name: 'Soul', icon: '👻' }, { id: 'demon', name: 'Demon', icon: '😈' }],
    specs: [
      { id: 'necromancer', tree: 'death', name: 'Necromancer', desc: 'Commands an army of skeletal minions.', t1: { minionDmg: 50, minionMax: 1 }, t2: { minionDmg: 60, minionMax: 2 }, t2txt: '+2 max minions, +60% minion damage' },
      { id: 'soulreaper', tree: 'soul', name: 'Soul Reaper', desc: 'Drains life; executes the weak.', t1: { leech: 2, execute: 30 }, t2: { killHeal: 5, shadow: 20 }, t2txt: 'Kills heal 5% life' },
      { id: 'demonologist', tree: 'demon', name: 'Demonologist', desc: 'Binds a demon and burns with hellfire.', t1: { fire: 15, minionDmg: 40 }, t2: { minionDmg: 80, burnDmg: 30 }, t2txt: 'Demon minion +80% damage, burns +30%' },
    ] },
  paladin: { name: 'Paladin', icon: '✝️', art: 'paladin', color: '#f2d64b', dmg: 'phys', res: 'Faith', weapon: ['Warhammer', 'Holy Mace', 'Longsword'], off: 'Tower Shield',
    grow: { str: 3, int: 1, dex: 0, vit: 3, wis: 2 },
    trees: [{ id: 'holy', name: 'Holy', icon: '☀️' }, { id: 'judge', name: 'Judgement', icon: '⚖️' }, { id: 'zeal', name: 'Crusade', icon: '🚩' }],
    specs: [
      { id: 'templar', tree: 'holy', name: 'Templar', desc: 'Holy fire and powerful heals.', t1: { holy: 25, healPct: 20 }, t2: { healPct: 50, holy: 15 }, t2txt: 'Heals +50%' },
      { id: 'inquisitor', tree: 'judge', name: 'Inquisitor', desc: 'Judges foes so they take more damage.', t1: { vulnPct: 20, crit: 4 }, t2: { more: 20 }, t2txt: 'Judged enemies take +20% more damage' },
      { id: 'crusader', tree: 'zeal', name: 'Crusader', desc: 'Shields, auras and steady pressure.', t1: { shieldPct: 30, hpPct: 15 }, t2: { dr: 10, more: 10 }, t2txt: '10% damage reduction, +10% more damage' },
    ] },
};
export const CLASS_KEYS = Object.keys(CLASSES);
export const specOf = (state) => state.spec ? CLASSES[state.cls].specs.find((s) => s.id === state.spec) : null;

// Talents: each of the 3 trees has 6 talents. Rows need 3 points per row already spent in that tree.
// Your spec's tree allows rank 5; the other trees rank 3.
export const TALENT_STATS = {
  fury: ['aspd', 'leech', 'phys', 'critDmg', 'treeDmg', 'frenzy'],
  command: ['buffDur', 'critDmg', 'crit', 'phys', 'treeDmg', 'cdr'],
  bulwark: ['hpPct', 'armourPct', 'resist', 'dr', 'treeDmg', 'thorns'],
  fire: ['fire', 'burnDmg', 'crit', 'magic', 'treeDmg', 'cdr'],
  ice: ['cold', 'chillDur', 'hpPct', 'magic', 'treeDmg', 'frozenTaken'],
  arcane: ['arcane', 'cdr', 'regen', 'magic', 'treeDmg', 'critDmg'],
  marks: ['crit', 'critDmg', 'aspd', 'phys', 'treeDmg', 'boss'],
  beast: ['petDmg', 'hpPct', 'aspd', 'phys', 'treeDmg', 'petBonus'],
  shade: ['poisonDmg', 'shadow', 'crit', 'aspd', 'treeDmg', 'poisonCrit'],
  death: ['minionDmg', 'shadow', 'hpPct', 'magic', 'treeDmg', 'minionMax'],
  soul: ['leech', 'shadow', 'execute', 'magic', 'treeDmg', 'killHeal'],
  demon: ['minionDmg', 'fire', 'burnDmg', 'magic', 'treeDmg', 'resist'],
  holy: ['holy', 'healPct', 'hpPct', 'magic', 'treeDmg', 'regen'],
  judge: ['vulnPct', 'crit', 'critDmg', 'phys', 'treeDmg', 'boss'],
  zeal: ['shieldPct', 'armourPct', 'hpPct', 'phys', 'treeDmg', 'dr'],
};
export const TALENT_VAL = { aspd: 3, leech: 0.4, phys: 5, magic: 5, critDmg: 8, crit: 1.2, cdr: 1.5, treeDmg: 6, frenzy: 5, buffDur: 8, hpPct: 4, armourPct: 6, resist: 3, dr: 1.5, thorns: 5,
  fire: 5, cold: 5, arcane: 5, shadow: 5, holy: 5, burnDmg: 8, chillDur: 8, frozenTaken: 5, regen: 6, boss: 5, petDmg: 15, petBonus: 6, poisonDmg: 8, poisonCrit: 8,
  minionDmg: 10, minionMax: 0.2, execute: 6, killHeal: 0.8, healPct: 6, vulnPct: 4, shieldPct: 6 };

export const STAT_NAMES = {
  hp: 'Life', armour: 'Armour', attack: 'Attack', aspd: 'Attack speed', crit: 'Crit chance', critDmg: 'Crit damage', phys: 'Physical damage', magic: 'Magic damage',
  fire: 'Fire damage', cold: 'Cold damage', lightning: 'Lightning damage', arcane: 'Arcane damage', shadow: 'Shadow damage', holy: 'Holy damage', poison: 'Poison damage',
  cdr: 'Cooldown reduction', leech: 'Life steal', boss: 'Boss damage', elite: 'Elite damage', resist: 'All resistances', dr: 'Damage reduction', regen: 'Resource regen',
  hpRegen: 'Life regen', gold: 'Gold find', mf: 'Rarity find', xp: 'Experience', hpPct: 'Life', armourPct: 'Armour', attackPct: 'Attack', more: 'More damage',
  str: 'Strength', int: 'Intelligence', dex: 'Dexterity', vit: 'Vitality', wis: 'Wisdom', allAttr: 'All attributes', ele: 'Elemental damage',
  burnDmg: 'Burn damage', poisonDmg: 'Poison damage', bleedDmg: 'Bleed damage', chillDur: 'Chill duration', frozenTaken: 'Damage vs frozen', buffDur: 'Buff duration',
  treeDmg: 'Tree skill damage', frenzy: 'Damage below 50% life', thorns: 'Damage reflected', petDmg: 'Companion damage', petBonus: 'Companion bonus', poisonCrit: 'Crit damage vs poisoned',
  minionDmg: 'Minion damage', minionMax: 'Max minions', execute: 'Damage vs low-life', killHeal: 'Life on kill', healPct: 'Healing', vulnPct: 'Judgement', shieldPct: 'Shield strength',
  skillDmg: 'Skill damage', doubleCast: 'Double cast chance',
};
export const PCT_STATS = new Set(Object.keys(STAT_NAMES).filter((k) => !['hp', 'armour', 'attack', 'str', 'int', 'dex', 'vit', 'wis', 'allAttr', 'minionMax'].includes(k)));

// ---------------- items ----------------
export const SLOTS = ['main', 'off', 'helmet', 'chest', 'gloves', 'legs', 'boots', 'belt', 'ring1', 'ring2', 'necklace', 'amulet'];
export const SLOT_INFO = {
  main: { name: 'Main-hand', icon: '🗡️' }, off: { name: 'Off-hand', icon: '🛡️' }, helmet: { name: 'Helmet', icon: '⛑️' }, chest: { name: 'Chest', icon: '🥋' },
  gloves: { name: 'Gloves', icon: '🧤' }, legs: { name: 'Legs', icon: '👖' }, boots: { name: 'Boots', icon: '🥾' }, belt: { name: 'Belt', icon: '🎗️' },
  ring1: { name: 'Ring', icon: '💍' }, ring2: { name: 'Ring', icon: '💍' }, necklace: { name: 'Necklace', icon: '📿' }, amulet: { name: 'Amulet', icon: '🧿' },
};
export const itemSlotType = (slot) => (slot === 'ring2' ? 'ring1' : slot);
export const RARITIES = [
  { name: 'Common', color: '#c8c8c8', affixes: 1, mult: 1.0, sockets: 0 },
  { name: 'Uncommon', color: '#5cc46b', affixes: 2, mult: 1.1, sockets: 0 },
  { name: 'Rare', color: '#6b8cff', affixes: 3, mult: 1.25, sockets: 1 },
  { name: 'Epic', color: '#b46bff', affixes: 4, mult: 1.45, sockets: 1 },
  { name: 'Legendary', color: '#ff8a2b', affixes: 4, mult: 1.7, sockets: 2, unique: true },
  { name: 'Mythic', color: '#ff3b5c', affixes: 5, mult: 2.0, sockets: 2, unique: true },
  { name: 'Ancient', color: '#4de8d8', affixes: 6, mult: 2.5, sockets: 3, unique: true },
];
export const RARITY_WEIGHTS = [560, 270, 120, 38, 8, 1.6, 0.25];

// Affixes. flat: value scales with S(ilvl). range = [min,max] at T1 roll before rarity.
export const AFFIXES = [
  { key: 'hp', flat: true, r: [10, 18], w: 10 },
  { key: 'armour', flat: true, r: [4, 8], w: 7 },
  { key: 'attack', flat: true, r: [0.8, 1.6], w: 8 },
  { key: 'str', attr: true, r: [2, 4], w: 4 }, { key: 'int', attr: true, r: [2, 4], w: 4 }, { key: 'dex', attr: true, r: [2, 4], w: 4 },
  { key: 'vit', attr: true, r: [2, 4], w: 4 }, { key: 'wis', attr: true, r: [2, 4], w: 3 },
  { key: 'phys', r: [6, 14], w: 6 }, { key: 'magic', r: [6, 14], w: 6 },
  { key: 'ele', r: [5, 12], w: 4 },
  { key: 'aspd', r: [3, 8], w: 5 }, { key: 'crit', r: [1.5, 4], w: 5 }, { key: 'critDmg', r: [8, 20], w: 5 },
  { key: 'cdr', r: [2, 5], w: 3 }, { key: 'leech', r: [0.4, 1.2], w: 3 }, { key: 'boss', r: [6, 15], w: 3 }, { key: 'elite', r: [6, 15], w: 2 },
  { key: 'resist', r: [4, 10], w: 5 }, { key: 'hpPct', r: [3, 8], w: 4 }, { key: 'armourPct', r: [5, 12], w: 3 },
  { key: 'hpRegen', r: [0.3, 0.8], w: 2 }, { key: 'regen', r: [6, 15], w: 2 },
  { key: 'gold', r: [5, 15], w: 2 }, { key: 'mf', r: [4, 10], w: 2 }, { key: 'xp', r: [3, 8], w: 1 },
];
export const AFFIX = Object.fromEntries(AFFIXES.map((a) => [a.key, a]));
export const attrScale = (ilvl) => 1 + ilvl * 0.18;

// Unique affixes on Legendary+ items (rolled one per item)
export const UNIQUES = {
  fifth: { name: 'of the Fifth Strike', text: 'Every 5th attack deals 300% damage' },
  blaze: { name: 'of Wildfire', text: 'Hits have a 15% chance to cause a fire explosion (120% damage to all enemies)' },
  critHeal: { name: 'of the Vampire', text: 'Critical strikes heal 1.5% of max life' },
  killCdr: { name: 'of Momentum', text: 'Kills reduce all cooldowns by 1s' },
  ultBoss: { name: 'of the Kingslayer', text: 'Your ultimate deals +80% damage to bosses' },
  poisonCrit: { name: 'of Venomstrike', text: 'Poisoned enemies take +50% critical damage', stat: { poisonCrit: 50 } },
  chain: { name: 'of Arcing', text: 'Attacks chain to another enemy for 50% damage' },
  thorns: { name: 'of Thorns', text: 'Reflect 30% of damage taken', stat: { thorns: 30 } },
  laststand: { name: 'of Last Stand', text: 'Below 30% life take 30% less damage' },
  execute: { name: 'of the Executioner', text: '+60% damage to enemies below 30% life', stat: { execute: 60 } },
  doubleCast: { name: 'of Echoes', text: '15% chance for skills to cast twice', stat: { doubleCast: 15 } },
  soul: { name: 'of Soul Harvest', text: 'Kills grant +3% damage for 10s (stacks 10)' },
};
export const UNIQUE_KEYS = Object.keys(UNIQUES);

// ---------------- gems, runes, inscriptions ----------------
export const GEMS = {
  ruby: { name: 'Ruby', icon: '🔴', stat: 'attackPct', base: 4, color: '#ff4a4a' },
  sapphire: { name: 'Sapphire', icon: '🔵', stat: 'critDmg', base: 8, color: '#4a7aff' },
  emerald: { name: 'Emerald', icon: '🟢', stat: 'crit', base: 1.5, color: '#3fd06a' },
  topaz: { name: 'Topaz', icon: '🟡', stat: 'aspd', base: 2.5, color: '#ffd04a' },
  amethyst: { name: 'Amethyst', icon: '🟣', stat: 'magic', base: 5, color: '#b46bff' },
  diamond: { name: 'Diamond', icon: '⚪', stat: 'hpPct', base: 3, stat2: 'armourPct', color: '#e8f4ff' },
};
export const GEM_KEYS = Object.keys(GEMS);
export const GEM_TIERS = ['Chipped', 'Flawed', 'Regular', 'Flawless', 'Perfect', 'Radiant'];
export const GEM_TIER_MULT = [1, 2, 3.5, 5.5, 8, 11.5];
export const gemValue = (type, tier) => GEMS[type].base * GEM_TIER_MULT[tier];

export const RUNES = {
  flame: { name: 'Rune of Flame', icon: '🔥', text: (r) => `+${r * 6}% fire damage, attacks ignite enemies`, stat: (r) => ({ fire: r * 6 }), flag: 'ignite' },
  blood: { name: 'Rune of Blood', icon: '🩸', text: (r) => `+${(r * 0.5).toFixed(1)}% life steal`, stat: (r) => ({ leech: r * 0.5 }) },
  fury: { name: 'Rune of Fury', icon: '💢', text: (r) => `+${r * 6}% attack speed below 50% life`, stat: () => ({}), fury: (r) => r * 6 },
  destruction: { name: 'Rune of Destruction', icon: '💥', text: (r) => `+${r * 8}% boss damage`, stat: (r) => ({ boss: r * 8 }) },
  eternity: { name: 'Rune of Eternity', icon: '♾️', text: (r) => `+${r * 2}% cooldown reduction`, stat: (r) => ({ cdr: r * 2 }) },
};
export const RUNE_KEYS = Object.keys(RUNES);
export const RUNE_MAX = 10;
export const runeSlots = (state) => (state.level >= 60 || state.ascensions ? 3 : state.level >= 15 ? 2 : 0);

export const INSCR_TAGS = {
  ember: { name: 'Ember', icon: '🔥', color: '#ff7a3a', stat: 'fire', sets: { 2: { fire: 15 }, 4: { burnDmg: 40 }, 6: { burnExplode: 1 } }, txt: ['+15% fire damage', 'Burns deal +40% damage', 'Burning enemies explode on death'] },
  frost: { name: 'Frost', icon: '❄️', color: '#7ad0ff', stat: 'cold', sets: { 2: { cold: 15 }, 4: { frozenTaken: 25 }, 6: { freezeChance: 10 } }, txt: ['+15% cold damage', 'Frozen enemies take +25% damage', 'Hits have 10% chance to freeze'] },
  storm: { name: 'Storm', icon: '⚡', color: '#ffe36b', stat: 'lightning', sets: { 2: { lightning: 15 }, 4: { aspd: 10 }, 6: { critChain: 1 } }, txt: ['+15% lightning damage', '+10% attack speed', 'Crits chain lightning to all enemies'] },
  blood: { name: 'Blood', icon: '🩸', color: '#d0392f', stat: 'leech', sets: { 2: { leech: 1 }, 4: { bleedDmg: 40 }, 6: { frenzy: 25 } }, txt: ['+1% life steal', 'Bleeds deal +40% damage', '+25% damage below 50% life'] },
  shadow: { name: 'Shadow', icon: '🌑', color: '#9b59d0', stat: 'shadow', sets: { 2: { shadow: 15 }, 4: { poisonDmg: 40 }, 6: { poisonCrit: 50 } }, txt: ['+15% shadow damage', 'Poison deals +40% damage', 'Poisoned enemies take +50% crit damage'] },
  holy: { name: 'Holy', icon: '☀️', color: '#f2d64b', stat: 'holy', sets: { 2: { holy: 15 }, 4: { healPct: 30 }, 6: { smite: 1 } }, txt: ['+15% holy damage', 'Heals +30%', 'Every 4s a holy smite hits all enemies'] },
};
export const INSCR_KEYS = Object.keys(INSCR_TAGS);
export const INSCR_SLOTS = 6;

// ---------------- companions ----------------
export const COMPANIONS = {
  wolf: { name: 'Wolf', art: ['pets', 'wolf'], stat: 'aspd', base: 5, per: 0.4, text: 'Attack speed', unlock: 'Starter companion' },
  golem: { name: 'Golem', art: ['pets', 'golem'], stat: 'armourPct', base: 8, per: 0.6, stat2: 'hpPct', text: 'Armour and life', unlock: 'Defeat the Stone Colossus (Forgotten Vale)' },
  raven: { name: 'Raven', art: ['pets', 'owl'], stat: 'crit', base: 2, per: 0.12, stat2: 'critDmg', text: 'Crit chance and crit damage', unlock: 'Defeat the Bone King (Dreadmoor)' },
  dragon: { name: 'Baby Dragon', art: ['pets', 'drake'], stat: 'ele', base: 8, per: 0.6, text: 'Elemental damage', unlock: 'Defeat the Ashen Dragon (Ashlands)' },
  shadowbeast: { name: 'Shadow Beast', art: ['monsters', 'hound'], stat: 'boss', base: 10, per: 0.7, text: 'Boss damage', unlock: 'Defeat the Shadow Lord (Shadowreach)' },
  phoenix: { name: 'Phoenix', art: ['pets', 'phoenix'], stat: 'healEvery', base: 3, per: 0.08, text: 'Heals % max life every 5s', unlock: 'Reach Endless Tower floor 30' },
};
export const COMP_KEYS = Object.keys(COMPANIONS);
export const EVOLUTIONS = [{ lvl: 1, name: 'Young', mult: 1 }, { lvl: 10, name: 'Grown', mult: 1.3 }, { lvl: 25, name: 'Elder', mult: 1.7 }, { lvl: 50, name: 'Mythic', mult: 2.3 }];
export const evoOf = (lvl) => { let e = EVOLUTIONS[0]; for (const x of EVOLUTIONS) if (lvl >= x.lvl) e = x; return e; };

// ---------------- materials & crafting ----------------
export const MATERIALS = {
  iron: { name: 'Iron Ore', icon: '⛏️', src: 'Regions 1-5 monsters, salvaging Common-Rare gear, Crystal Caverns' },
  mythril: { name: 'Mythril', icon: '🔷', src: 'Regions 5-10 monsters, Crystal Caverns, salvaging Epic+' },
  scales: { name: 'Dragon Scales', icon: '🐉', src: "Ashlands, Dragon's Lair dungeon, the Ashen Dragon" },
  essence: { name: 'Ancient Essence', icon: '🌟', src: 'Region bosses, Boss Rush, Endless Tower milestones' },
  void: { name: 'Void Crystals', icon: '🌀', src: 'The Void, Rift Challenges, Abyssal Depths dungeon' },
  dust: { name: 'Enchantment Dust', icon: '✨', src: 'Salvaging any gear, Crystal Caverns' },
  cores: { name: 'Legendary Cores', icon: '🔶', src: 'Salvaging Legendary+, region bosses (lvl 60+), Tower milestones' },
};
export const MAT_KEYS = Object.keys(MATERIALS);

export const RECIPES = [
  { id: 'dragonbane', name: 'Dragonbane', lvl: 60, slot: 'main', rarity: 4, unique: 'blaze', bonus: { boss: 25 }, cost: { mythril: 50, scales: 20, cores: 10, gold: 5000 }, text: 'Legendary weapon: fire explosions, +25% boss damage' },
  { id: 'aegis', name: 'Frostheart Aegis', lvl: 60, slot: 'off', rarity: 4, unique: 'laststand', bonus: { resist: 15 }, cost: { mythril: 40, cores: 8, dust: 60, gold: 4000 }, text: 'Legendary off-hand: Last Stand, +15% resistances' },
  { id: 'voidwalkers', name: 'Voidwalker Treads', lvl: 65, slot: 'boots', rarity: 4, unique: 'killCdr', bonus: { aspd: 10 }, cost: { void: 30, mythril: 30, cores: 8, gold: 6000 }, text: 'Legendary boots: kills reduce cooldowns' },
  { id: 'crown', name: 'Crown of the Eternal', lvl: 80, slot: 'helmet', rarity: 5, unique: 'ultBoss', bonus: { more: 10 }, cost: { essence: 40, void: 40, cores: 20, gold: 25000 }, text: 'Mythic helmet: ultimate +80% vs bosses, +10% more damage' },
  { id: 'rareSlot', name: 'Forge a Rare item', lvl: 1, rarity: 2, pick: true, cost: { iron: 15, dust: 5 }, text: 'Rare item of your level for the slot you choose' },
  { id: 'epicSlot', name: 'Forge an Epic item', lvl: 30, rarity: 3, pick: true, cost: { mythril: 15, dust: 20 }, text: 'Epic item of your level for the slot you choose' },
  { id: 'legSlot', name: 'Forge a Legendary item', lvl: 60, rarity: 4, pick: true, cost: { mythril: 30, cores: 6, dust: 40 }, text: 'Legendary item with a random unique affix' },
  { id: 'gem', name: 'Cut a random gem', lvl: 15, gem: true, cost: { iron: 10, dust: 8 }, text: 'A Chipped gem of a random type' },
  { id: 'inscr', name: 'Carve an inscription', lvl: 35, inscription: true, cost: { void: 4, dust: 15 }, text: 'A random inscription of your level' },
];
export const runeCraftCost = (rank) => ({ essence: 2 + rank * 2, void: rank >= 4 ? rank - 3 : 0, gold: 300 * rank * rank });

// ---------------- world ----------------
export const STAGES_PER_REGION = 10;
export const WAVES_PER_STAGE = 4;
const boss = (id, name, art, phaseNames, mech) => ({ id, name, art, phaseNames, mech });
export const REGIONS = [
  { name: 'Greenhaven', bg: 'crossroads', mats: ['iron'], monsters: ['treant', 'direwolf', 'spider', 'myconid', 'bandit'], weather: 'fireflies',
    boss: boss('warden', 'Forest Warden', ['bosses', 'thornmother'], ['Rooted', 'Thorn Storm', 'Wild Fury', 'Heart of the Forest'], ['slam', 'adds', 'enrage', 'ultimate']) },
  { name: 'Forgotten Vale', bg: 'stones', mats: ['iron'], monsters: ['harpy', 'ram', 'rockgolem', 'troll', 'serpent'], weather: 'dust',
    boss: boss('colossus', 'Stone Colossus', ['monsters', 'rockgolem'], ['Awakening', 'Avalanche', 'Crumbling Rage', 'Last Stand'], ['slam', 'shield', 'enrage', 'ultimate']) },
  { name: 'Dreadmoor', bg: 'necropolis', mats: ['iron'], monsters: ['zombie', 'skeleton', 'ghoul', 'wraith', 'banshee', 'skelmage'], weather: 'mist',
    boss: boss('boneking', 'Bone King', ['bosses', 'lich'], ['Court of Bones', 'Raise the Dead', 'Death March', 'Bone Throne'], ['slam', 'adds', 'storm', 'ultimate']) },
  { name: 'Ironhold', bg: 'ironhold', mats: ['iron', 'mythril'], monsters: ['magmagolem', 'imp', 'dknight', 'bandit', 'hound'], weather: 'embers',
    boss: boss('forgetyrant', 'Forge Tyrant', ['bosses', 'forgetyrant'], ['Hammerfall', 'Molten Floor', 'Overheat', 'Forge Heart'], ['slam', 'storm', 'enrage', 'ultimate']) },
  { name: 'Frostfall', bg: 'frostfall', mats: ['iron', 'mythril'], monsters: ['frostwolf', 'yeti', 'wisp', 'wraith', 'direwolf'], weather: 'snow',
    boss: boss('icesovereign', 'Ice Sovereign', ['bosses', 'icesovereign'], ['Cold Court', 'Blizzard', 'Frozen Wrath', 'Absolute Zero'], ['slam', 'storm', 'shield', 'ultimate']) },
  { name: 'Ashlands', bg: 'hellfire', mats: ['mythril', 'scales'], monsters: ['imp', 'magmagolem', 'scorpion', 'hound', 'cultist'], weather: 'embers',
    boss: boss('ashendragon', 'Ashen Dragon', ['bosses', 'dragon'], ['Claw and Breath', 'Flight of Fire', 'Enraged', 'Cataclysm'], ['breath', 'storm', 'enrage', 'ultimate']) },
  { name: 'Shadowreach', bg: 'prison', mats: ['mythril'], monsters: ['wraith', 'cultist', 'bat', 'banshee', 'dknight', 'ratman'], weather: 'spores',
    boss: boss('shadowlord', 'Shadow Lord', ['bosses', 'shadowlord'], ['Dusk', 'Shadow Clones', 'Eclipse', 'Endless Night'], ['slam', 'adds', 'enrage', 'ultimate']) },
  { name: 'Sunken Kingdom', bg: 'harbour', mats: ['mythril'], monsters: ['fishman', 'crabknight', 'siren', 'serpent', 'crab', 'leech'], weather: 'rain',
    boss: boss('abyssal', 'Abyssal Horror', ['bosses', 'kraken'], ['Rising Tide', 'Tentacle Storm', 'Drowning Depths', 'Maw of the Abyss'], ['adds', 'storm', 'enrage', 'ultimate']) },
  { name: 'The Void', bg: 'rift', mats: ['mythril', 'void'], monsters: ['flesh', 'wisp', 'leech', 'skelmage', 'wraith'], weather: 'sparkles',
    boss: boss('voidtitan', 'Void Titan', ['bosses', 'voidtitan'], ['Event Horizon', 'Gravity Well', 'Collapse', 'Singularity'], ['slam', 'shield', 'storm', 'ultimate']) },
  { name: 'The Fallen Realm', bg: 'spire', mats: ['mythril', 'void', 'essence'], monsters: ['angel', 'demonlord', 'sungolem', 'dknight', 'cultist'], weather: 'sparkles',
    boss: boss('eternal', 'The Eternal One', ['bosses', 'eternalone'], ['Judgement', 'Fallen Host', 'Wrath Eternal', 'The End of All Things'], ['slam', 'adds', 'enrage', 'ultimate']) },
];
export const MONSTER_NAMES = {
  treant: 'Bark Treant', direwolf: 'Dire Wolf', spider: 'Thicket Spider', myconid: 'Myconid', bandit: 'Bandit', harpy: 'Harpy', ram: 'Rampaging Ram', rockgolem: 'Rock Golem',
  troll: 'Hill Troll', serpent: 'Vale Serpent', zombie: 'Bog Zombie', skeleton: 'Skeleton', ghoul: 'Ghoul', wraith: 'Wraith', banshee: 'Banshee', skelmage: 'Bone Mage',
  magmagolem: 'Magma Golem', imp: 'Forge Imp', dknight: 'Iron Knight', hound: 'Hellhound', frostwolf: 'Frost Wolf', yeti: 'Yeti', wisp: 'Wisp', scorpion: 'Ash Scorpion',
  cultist: 'Cultist', bat: 'Dusk Bat', ratman: 'Ratman', fishman: 'Deep One', crabknight: 'Crab Knight', siren: 'Siren', crab: 'Reef Crab', leech: 'Giant Leech',
  flesh: 'Void Spawn', angel: 'Fallen Angel', demonlord: 'Demon Lord', sungolem: 'Sun Golem',
};
// Monster level of a region stage (1..100 => 1..80)
export const stageLevel = (stage) => Math.max(1, Math.round(1 + (stage - 1) * 0.8));
export const regionOf = (stage) => Math.min(REGIONS.length - 1, Math.floor((stage - 1) / STAGES_PER_REGION));
export const MAX_STAGE = REGIONS.length * STAGES_PER_REGION;

export const ELITE_MODS = {
  tough: { name: 'Tough', icon: '🪨', text: '+100% life' },
  explosive: { name: 'Explosive', icon: '💥', text: 'Explodes on death' },
  venomous: { name: 'Venomous', icon: '🐍', text: 'Hits poison you' },
  regen: { name: 'Regenerating', icon: '💚', text: 'Regenerates 2% life/s' },
  frenzied: { name: 'Frenzied', icon: '💢', text: '+60% attack speed' },
  summoner: { name: 'Summoner', icon: '🪦', text: 'Summons minions' },
};
export const ELITE_KEYS = Object.keys(ELITE_MODS);

export const WORLD_TIERS = [
  { name: 'Normal', mult: 1, ilvl: 0, mf: 0, color: '#c8c8c8' },
  { name: 'Veteran', mult: 6, ilvl: 10, mf: 60, color: '#5cc46b' },
  { name: 'Nightmare', mult: 40, ilvl: 20, mf: 140, color: '#6b8cff' },
  { name: 'Hell', mult: 260, ilvl: 30, mf: 260, color: '#ff8a2b', ancient: true },
  { name: 'Apocalypse', mult: 1800, ilvl: 40, mf: 420, color: '#ff3b5c', ancient: true },
];

// Dungeons (unlock L30) double as the "Equipment Dungeon": each targets gear slots.
export const DUNGEONS = {
  crypt: { name: 'Crypt of Kings', bg: 'dungeon', icon: '⚰️', slots: ['helmet', 'chest', 'legs'], mech: 'waves', text: 'Undead waves: extra packs', monsters: ['skeleton', 'zombie', 'ghoul', 'wraith'], boss: ['bosses', 'lich'], bossName: 'Crypt King' },
  forge: { name: 'Infernal Forge', bg: 'ironhold', icon: '🔥', slots: ['main', 'off'], mech: 'burn', text: 'The floor burns you constantly', monsters: ['magmagolem', 'imp', 'hound'], boss: ['bosses', 'forgetyrant'], bossName: 'Forgemaster' },
  citadel: { name: 'Frozen Citadel', bg: 'frostfall', icon: '🧊', slots: ['gloves', 'boots', 'belt'], mech: 'chill', text: 'Cold slows your attacks by 25%', monsters: ['frostwolf', 'yeti', 'wisp'], boss: ['bosses', 'icesovereign'], bossName: 'Frost Warden' },
  abyss: { name: 'Abyssal Depths', bg: 'harbour', icon: '🌊', slots: ['ring1', 'necklace', 'amulet'], mech: 'corrupt', text: 'Corruption stacks a DoT over time', monsters: ['fishman', 'leech', 'siren', 'flesh'], boss: ['bosses', 'kraken'], bossName: 'Depth Horror', mats: ['void'] },
  lair: { name: "Dragon's Lair", bg: 'lair', icon: '🐉', slots: null, mech: 'breath', text: 'Dragon breath telegraphs; better Legendary odds', monsters: ['imp', 'scorpion', 'magmagolem'], boss: ['bosses', 'dragon'], bossName: 'Elder Wyrm', mats: ['scales'] },
};
export const DUNGEON_KEYS = Object.keys(DUNGEONS);

export const ACTIVITIES = {
  dungeon: { name: 'Equipment Dungeons', icon: '🏰', lvl: 30, text: 'Pick a dungeon to target gear slots. Tiers scale up; no energy, run as often as you like.' },
  caverns: { name: 'Crystal Caverns', icon: '💎', lvl: 15, text: 'Crystal golems drop gems, Iron, Mythril and Enchantment Dust.' },
  bossrush: { name: 'Boss Rush', icon: '👑', lvl: 25, text: 'Fight every region boss you have beaten back to back. Ancient Essence and inscriptions.' },
  vault: { name: 'Treasure Vault', icon: '💰', lvl: 10, text: '45 seconds against the Treasure Golem. Gold for every hit.' },
  tower: { name: 'Endless Tower', icon: '🗼', lvl: 20, text: 'Climb floor by floor. Big rewards every 10 floors.' },
  rift: { name: 'Rift Challenges', icon: '🌀', lvl: 40, text: 'Random modifiers each rift. Harder rifts, better rewards.' },
};
export const RIFT_MODS = [
  { id: 'hp', text: 'Enemies have +80% life', m: { hp: 1.8 }, w: 1 },
  { id: 'dmg', text: 'Enemies deal +50% damage', m: { dmg: 1.5 }, w: 1 },
  { id: 'fast', text: 'Enemies attack 40% faster', m: { aspd: 1.4 }, w: 1 },
  { id: 'packs', text: 'Larger packs', m: { pack: 1 }, w: 1 },
  { id: 'crit', text: 'You have +20% crit chance', m: { heroCrit: 20 }, w: -1 },
  { id: 'cd', text: 'Your cooldowns recover 30% faster', m: { heroCdr: 30 }, w: -1 },
  { id: 'elite', text: 'Every enemy is an elite', m: { allElite: 1 }, w: 2 },
  { id: 'nores', text: 'Your resistances are halved', m: { halfRes: 1 }, w: 1 },
  { id: 'vamp', text: 'You leech +3% of damage', m: { heroLeech: 3 }, w: -1 },
];

export const ASC_PERKS = {
  might: { name: 'Might', icon: '⚔️', text: '+6% damage per rank', stat: { more: 6 } },
  vigor: { name: 'Vigor', icon: '❤️', text: '+6% life per rank', stat: { hpPct: 6 } },
  fortune: { name: 'Fortune', icon: '🍀', text: '+8% gold and +5% rarity find per rank', stat: { gold: 8, mf: 5 } },
  wisdom: { name: 'Insight', icon: '📘', text: '+10% experience per rank', stat: { xp: 10 } },
  mastery: { name: 'Talent', icon: '🌳', text: '+1 talent point per rank', talent: 1 },
};
