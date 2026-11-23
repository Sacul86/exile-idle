// All static game content for Pocket Realm.

export type HeroId = 'knight' | 'ranger' | 'mage' | 'cleric' | 'rogue' | 'barbarian';
export type SkillId = 'mining' | 'woodcutting' | 'fishing' | 'foraging' | 'smithing' | 'cooking' | 'alchemy';
export type GatherSkill = 'mining' | 'woodcutting' | 'fishing' | 'foraging';
export type Slot = 'weapon' | 'armor' | 'trinket';

export interface HeroDef {
  id: HeroId; name: string; title: string; sprite: string; weapon: string; role: string;
  dps: number; hp: number; costBase: number; recruit: number; recruitStage: number;
  ability: { name: string; cd: number; desc: string; kind: 'burst' | 'heal' | 'shield' | 'rage' | 'volley' | 'crit' };
  crit: number; color: string;
}
export const HEROES: HeroDef[] = [
  { id: 'knight', name: 'Sir Donald', title: 'Knight', sprite: 'hero_knight', weapon: 'wk', role: 'Tank — draws enemy attacks and takes 40% less damage', dps: 4, hp: 60, costBase: 8, recruit: 0, recruitStage: 1,
    ability: { name: 'Shield Wall', cd: 14, desc: 'Party takes 60% less damage for 5s', kind: 'shield' }, crit: 5, color: '#7ab0ff' },
  { id: 'ranger', name: 'Joseph', title: 'Ranger', sprite: 'hero_ranger', weapon: 'wr', role: 'Steady ranged damage', dps: 9, hp: 30, costBase: 40, recruit: 150, recruitStage: 3,
    ability: { name: 'Volley', cd: 10, desc: '5 arrows, each 120% damage', kind: 'volley' }, crit: 10, color: '#7ad07a' },
  { id: 'cleric', name: 'Mennas', title: 'Cleric', sprite: 'hero_cleric', weapon: 'wc', role: 'Heals the party', dps: 3, hp: 40, costBase: 120, recruit: 900, recruitStage: 6,
    ability: { name: 'Sanctuary', cd: 9, desc: 'Heals the whole party for 35% life', kind: 'heal' }, crit: 5, color: '#ffe9a0' },
  { id: 'mage', name: 'Maggie', title: 'Mage', sprite: 'hero_mage', weapon: 'wm', role: 'Huge fire bursts', dps: 18, hp: 24, costBase: 600, recruit: 6000, recruitStage: 11,
    ability: { name: 'Fireball', cd: 8, desc: 'Deals 600% damage', kind: 'burst' }, crit: 5, color: '#ff8a3a' },
  { id: 'rogue', name: 'Sonja', title: 'Rogue', sprite: 'hero_rogue', weapon: 'wo', role: 'Critical hits', dps: 30, hp: 30, costBase: 4000, recruit: 50000, recruitStage: 18,
    ability: { name: 'Backstab', cd: 7, desc: 'A guaranteed 5x critical strike', kind: 'crit' }, crit: 30, color: '#c08bff' },
  { id: 'barbarian', name: 'Rupert', title: 'Barbarian', sprite: 'hero_barbarian', weapon: 'wb', role: 'Brutal melee', dps: 70, hp: 70, costBase: 30000, recruit: 400000, recruitStage: 26,
    ability: { name: 'Rage', cd: 16, desc: 'Triple damage for 6s', kind: 'rage' }, crit: 10, color: '#ff5a4a' },
];
export const HERO = Object.fromEntries(HEROES.map((h) => [h.id, h])) as Record<HeroId, HeroDef>;
export const MAX_FIGHTERS = 4;

export interface Biome { name: string; floor: string; wall: string; decor: string[]; monsters: string[]; boss: string; bossName: string; music: string; tint: number; sky: number }
export const BIOMES: Biome[] = [
  { name: 'Greenwood', floor: 'f_grass', wall: 'w_brick', decor: ['d_tree', 'd_flower', 'd_bush'], monsters: ['m_rat', 'm_jackal', 'm_bat', 'm_kobold', 'm_adder', 'm_bullfrog'], boss: 'b_bear', bossName: 'Old Grizzle', music: 'theme_plain', tint: 0xffffff, sky: 0x6fa8dc },
  { name: 'Mushroom Hollow', floor: 'f_moss', wall: 'w_lair', decor: ['d_fungus', 'd_bush'], monsters: ['m_mushroom', 'm_shambler', 'm_deathcap', 'm_jelly', 'm_slime'], boss: 'b_treant', bossName: 'The Rotwood', music: 'theme_swamp', tint: 0xffffff, sky: 0x4a6a3a },
  { name: 'Goblin Warrens', floor: 'f_orc', wall: 'w_orc', decor: ['d_deadtree'], monsters: ['m_goblin', 'm_hobgoblin', 'm_gnoll', 'm_gnollshaman', 'm_brigand'], boss: 'b_ogre', bossName: 'Gorg & Grub', music: 'theme_lost_village', tint: 0xffffff, sky: 0x5a4a32 },
  { name: 'Sunken Crypt', floor: 'f_crypt', wall: 'w_crypt', decor: ['d_deadtree'], monsters: ['m_ghoul', 'm_mummy', 'm_skeleton', 'm_ghost', 'm_skull'], boss: 'b_lich', bossName: 'The Pale Lich', music: 'theme_dream', tint: 0xffffff, sky: 0x2a2a3a },
  { name: 'Frost Peaks', floor: 'f_frozen', wall: 'w_ice', decor: ['d_tree'], monsters: ['m_rimedrake', 'm_frostwraith', 'm_icedevil', 'm_whiteimp', 'm_polarbear'], boss: 'b_icedragon', bossName: 'Rimefang', music: 'theme_dream', tint: 0xdfefff, sky: 0xb8d8f0 },
  { name: 'Ember Caves', floor: 'f_volcanic', wall: 'w_scorched', decor: ['d_deadtree'], monsters: ['m_firebat', 'm_firecrab', 'm_fireelem', 'm_salamander', 'm_hellhound'], boss: 'b_firedragon', bossName: 'Cinderwing', music: 'theme_lost_village', tint: 0xffffff, sky: 0x3a1a10 },
  { name: 'Drowned Depths', floor: 'f_swamp', wall: 'w_water', decor: ['d_mangrove'], monsters: ['m_eel', 'm_jellyfish', 'm_octopode', 'm_swampworm', 'm_rockfish'], boss: 'b_kraken', bossName: 'The Deep Maw', music: 'theme_swamp', tint: 0xffffff, sky: 0x10304a },
  { name: 'Infernal Gate', floor: 'f_infernal', wall: 'w_hell', decor: ['d_deadtree'], monsters: ['m_reddevil', 'm_hellion', 'm_executioner', 'm_rakshasa', 'm_crimsonimp'], boss: 'b_balrug', bossName: 'Balgrath', music: 'theme_lost_village', tint: 0xffffff, sky: 0x2a0808 },
  { name: 'Starfall Ruins', floor: 'f_crystal', wall: 'w_crystal', decor: ['d_fungus'], monsters: ['m_uglything', 'm_nameless', 'm_tentacled', 'm_brain', 'm_unseen'], boss: 'b_orbguardian', bossName: 'The Watcher', music: 'theme_dream', tint: 0xffffff, sky: 0x1a0a2a },
  { name: 'Celestial Spire', floor: 'f_marble', wall: 'w_marble', decor: ['d_flower'], monsters: ['m_angel', 'm_cherub', 'm_daeva', 'm_apis', 'm_ophan'], boss: 'b_seraph', bossName: 'Seraph Auriel', music: 'theme_plain', tint: 0xffffff, sky: 0xf0e6c8 },
];
export const STAGES_PER_BIOME = 10;
export const KILLS_PER_STAGE = 10;
export const BOSS_EVERY = 5;
export const BOSS_TIME = 30;
export const biomeOf = (stage: number) => BIOMES[Math.floor((stage - 1) / STAGES_PER_BIOME) % BIOMES.length];
export const cycleOf = (stage: number) => Math.floor((stage - 1) / (STAGES_PER_BIOME * BIOMES.length));
export const MONSTER_NAMES: Record<string, string> = {
  m_rat: 'Rat', m_jackal: 'Jackal', m_bat: 'Bat', m_kobold: 'Kobold', m_adder: 'Adder', m_bullfrog: 'Bullfrog', m_mushroom: 'Walking Shroom', m_shambler: 'Shambler', m_deathcap: 'Deathcap',
  m_jelly: 'Jelly', m_slime: 'Slime', m_goblin: 'Goblin', m_hobgoblin: 'Hobgoblin', m_gnoll: 'Gnoll', m_gnollshaman: 'Gnoll Shaman', m_brigand: 'Brigand', m_ghoul: 'Ghoul', m_mummy: 'Mummy',
  m_skeleton: 'Skeleton', m_ghost: 'Ghost', m_skull: 'Cursed Skull', m_rimedrake: 'Rime Drake', m_frostwraith: 'Frost Wraith', m_icedevil: 'Ice Devil', m_whiteimp: 'White Imp', m_polarbear: 'Polar Bear',
  m_firebat: 'Fire Bat', m_firecrab: 'Fire Crab', m_fireelem: 'Fire Elemental', m_salamander: 'Salamander', m_hellhound: 'Hellhound', m_eel: 'Shock Eel', m_jellyfish: 'Jellyfish', m_octopode: 'Octopode',
  m_swampworm: 'Bog Worm', m_rockfish: 'Rockfish', m_reddevil: 'Red Devil', m_hellion: 'Hellion', m_executioner: 'Executioner', m_rakshasa: 'Rakshasa', m_crimsonimp: 'Crimson Imp', m_uglything: 'Ugly Thing',
  m_nameless: 'Nameless Horror', m_tentacled: 'Tentacled Thing', m_brain: 'Floating Brain', m_unseen: 'Unseen Horror', m_angel: 'Angel', m_cherub: 'Cherub', m_daeva: 'Daeva', m_apis: 'Apis', m_ophan: 'Ophan',
};

// ---------------- items ----------------
export const RARITIES = [
  { name: 'Common', color: '#c8c8c8', mult: 1, salvage: 1 },
  { name: 'Uncommon', color: '#5cd06b', mult: 1.6, salvage: 3 },
  { name: 'Rare', color: '#5b9cff', mult: 2.6, salvage: 8 },
  { name: 'Epic', color: '#c070ff', mult: 4.2, salvage: 25 },
  { name: 'Legendary', color: '#ffa024', mult: 7, salvage: 80 },
];
export const TIER_NAMES = ['Bronze', 'Iron', 'Mithril', 'Adamant', 'Runic'];
export const SLOT_NAMES: Record<Slot, string> = { weapon: 'Weapon', armor: 'Armour', trinket: 'Trinket' };
export const WEAPON_NAMES: Record<HeroId, string[]> = {
  knight: ['Shortsword', 'Longsword', 'Scimitar', 'Greatsword', 'Demon Blade'], ranger: ['Shortbow', 'Hunting Bow', 'Orcish Bow', 'Longbow', 'Starbow'],
  mage: ['Oak Staff', 'Runed Staff', 'Fire Staff', 'Frost Staff', 'Archstaff'], cleric: ['Mace', 'Morningstar', 'Warhammer', 'Eveningstar', 'Holy Maul'],
  rogue: ['Dagger', 'Athame', 'Rapier', 'Duelist Rapier', 'Demon Whip'], barbarian: ['Broad Axe', 'Battle Axe', 'Executioner', 'Bardiche', 'Spiked Club'],
};
export const ARMOR_NAMES = ['Leather Armour', 'Chainmail', 'Plate Armour', 'Crystal Plate', 'Dragonscale'];
export const TRINKET_NAMES = ['Bronze Ring', 'Citrine Amulet', 'Emerald Ring', 'Diamond Amulet', 'Ruby Band'];

// ---------------- skills ----------------
export interface Node { name: string; level: number; time: number; xp: number; icon: string }
const node = (name: string, level: number, time: number, xp: number, icon: string): Node => ({ name, level, time, xp, icon });
export const GATHER: Record<GatherSkill, { name: string; icon: string; verb: string; nodes: Node[] }> = {
  mining: { name: 'Mining', icon: 'sk_mining', verb: 'Mining', nodes: [node('Copper Ore', 1, 3, 8, 'ore0'), node('Iron Ore', 15, 4, 18, 'ore1'), node('Mithril Ore', 30, 5, 35, 'ore2'), node('Adamant Ore', 50, 6, 60, 'ore3'), node('Runite Ore', 70, 8, 110, 'ore4')] },
  woodcutting: { name: 'Woodcutting', icon: 'sk_wood', verb: 'Chopping', nodes: [node('Oak Logs', 1, 3, 8, 'log0'), node('Willow Logs', 15, 4, 18, 'log1'), node('Mangrove Logs', 30, 5, 35, 'log2'), node('Yew Logs', 50, 6, 60, 'log3'), node('Elder Logs', 70, 8, 110, 'log4')] },
  fishing: { name: 'Fishing', icon: 'sk_fishing', verb: 'Fishing', nodes: [node('Rockfish', 1, 3, 8, 'fish0'), node('Sludgefish', 15, 4, 18, 'fish1'), node('Shock Eel', 30, 5, 35, 'fish2'), node('Moon Jelly', 50, 6, 60, 'fish3'), node('Octopode', 70, 8, 110, 'fish4')] },
  foraging: { name: 'Foraging', icon: 'sk_foraging', verb: 'Foraging', nodes: [node('Greenleaf', 1, 3, 8, 'herb0'), node('Bloodvine', 15, 4, 18, 'herb1'), node('Moonfern', 30, 5, 35, 'herb2'), node('Starbloom', 50, 6, 60, 'herb3'), node('Sacred Lotus', 70, 8, 110, 'herb4')] },
};
export const GATHER_KEYS = Object.keys(GATHER) as GatherSkill[];
export const RES_KEY: Record<GatherSkill, string> = { mining: 'ore', woodcutting: 'log', fishing: 'fish', foraging: 'herb' };
export const CRAFT_SKILLS = { smithing: { name: 'Smithing', icon: 'sk_smithing' }, cooking: { name: 'Cooking', icon: 'sk_cooking' }, alchemy: { name: 'Alchemy', icon: 'sk_alchemy' } };
export const SKILL_NAMES: Record<SkillId, string> = { mining: 'Mining', woodcutting: 'Woodcutting', fishing: 'Fishing', foraging: 'Foraging', smithing: 'Smithing', cooking: 'Cooking', alchemy: 'Alchemy' };
export const SKILL_ICONS: Record<SkillId, string> = { mining: 'sk_mining', woodcutting: 'sk_wood', fishing: 'sk_fishing', foraging: 'sk_foraging', smithing: 'sk_smithing', cooking: 'sk_cooking', alchemy: 'sk_alchemy' };
// RuneScape-style curve, capped at 99
export const XP_TABLE: number[] = (() => { const t = [0, 0]; let pts = 0; for (let l = 1; l < 99; l++) { pts += Math.floor(l + 300 * Math.pow(2, l / 7)); t.push(Math.floor(pts / 4)); } return t; })();
export const levelFromXp = (xp: number) => { let l = 1; while (l < 99 && xp >= XP_TABLE[l + 1]) l++; return l; };

export const FOODS = [
  { name: 'Bread', heal: 0.15, icon: 'food0', level: 1 }, { name: 'Hearty Stew', heal: 0.22, icon: 'food1', level: 15 }, { name: 'Smoked Eel', heal: 0.3, icon: 'food2', level: 30 },
  { name: 'Feast Pie', heal: 0.4, icon: 'food3', level: 50 }, { name: 'Ambrosia Honey', heal: 0.55, icon: 'food4', level: 70 },
];
export const POTIONS = [
  { id: 'might', name: 'Potion of Might', desc: '2x party damage', icon: 'pot0', level: 1, mins: 10 },
  { id: 'haste', name: 'Potion of Haste', desc: '1.5x attack and gather speed', icon: 'pot1', level: 15, mins: 10 },
  { id: 'wisdom', name: 'Potion of Wisdom', desc: '2x skill XP', icon: 'pot2', level: 30, mins: 15 },
  { id: 'fortune', name: 'Potion of Fortune', desc: '2x gold and drop chance', icon: 'pot3', level: 50, mins: 10 },
  { id: 'titan', name: 'Titan Draught', desc: '3x party damage and life', icon: 'pot4', level: 70, mins: 5 },
];
export type PotionId = 'might' | 'haste' | 'wisdom' | 'fortune' | 'titan';

// ---------------- pets ----------------
export interface PetDef { id: string; name: string; sprite: string; from: string; chance: number; bonus: string; stat: string; value: number }
export const PETS: PetDef[] = [
  { id: 'cat', name: 'Natasha the Cat', sprite: 'pet_cat', from: 'mining', chance: 1 / 900, bonus: '+15% gold', stat: 'gold', value: 0.15 },
  { id: 'raven', name: 'Quill the Raven', sprite: 'pet_raven', from: 'woodcutting', chance: 1 / 900, bonus: '+10% drop chance', stat: 'drop', value: 0.1 },
  { id: 'turtle', name: 'Shelby', sprite: 'pet_turtle', from: 'fishing', chance: 1 / 900, bonus: '+15% party life', stat: 'hp', value: 0.15 },
  { id: 'frog', name: 'Blinky', sprite: 'pet_frog', from: 'foraging', chance: 1 / 900, bonus: '+10% gather speed', stat: 'gather', value: 0.1 },
  { id: 'spider', name: 'Itsy', sprite: 'pet_spider', from: 'smithing', chance: 1 / 250, bonus: '+10% crafting double chance', stat: 'double', value: 0.1 },
  { id: 'yak', name: 'Big Yak', sprite: 'pet_yak', from: 'cooking', chance: 1 / 250, bonus: '+20% food healing', stat: 'food', value: 0.2 },
  { id: 'wisp', name: 'Flicker', sprite: 'pet_wisp', from: 'alchemy', chance: 1 / 250, bonus: '+25% potion duration', stat: 'potion', value: 0.25 },
  { id: 'wolf', name: 'Fang', sprite: 'pet_wolf', from: 'boss', chance: 1 / 60, bonus: '+15% damage', stat: 'dmg', value: 0.15 },
  { id: 'drake', name: 'Smoulder', sprite: 'pet_drake', from: 'boss', chance: 1 / 120, bonus: '+5s boss timer', stat: 'bosstime', value: 5 },
  { id: 'hippogriff', name: 'Skyhoof', sprite: 'pet_hippogriff', from: 'kills', chance: 1 / 20000, bonus: '+25% damage', stat: 'dmg', value: 0.25 },
  { id: 'butterfly', name: 'Flutter', sprite: 'pet_butterfly', from: 'taps', chance: 1 / 4000, bonus: '+50% tap damage', stat: 'tap', value: 0.5 },
  { id: 'cherub', name: 'Pip', sprite: 'pet_cherub', from: 'ascend', chance: 1, bonus: '+10% souls', stat: 'souls', value: 0.1 },
];

// ---------------- ascension ----------------
export const ASCEND_STAGE = 40;
export interface SoulUp { id: string; name: string; desc: (r: number) => string; max: number; cost: (r: number) => number; icon: string }
export const SOUL_TREE: SoulUp[] = [
  { id: 'might', name: 'Eternal Might', desc: (r) => `+${r * 50}% damage`, max: 999, cost: (r) => 1 + Math.floor(r / 2), icon: 'sk_fighting' },
  { id: 'vigor', name: 'Eternal Vigor', desc: (r) => `+${r * 50}% party life`, max: 999, cost: (r) => 1 + Math.floor(r / 2), icon: 'hero_knight' },
  { id: 'greed', name: 'Midas Touch', desc: (r) => `+${r * 40}% gold`, max: 999, cost: (r) => 1 + Math.floor(r / 2), icon: 'gold3' },
  { id: 'headstart', name: 'Head Start', desc: (r) => `Start each ascension at stage ${1 + r * 5}`, max: 20, cost: (r) => 2 + r * 2, icon: 'ui_scroll0' },
  { id: 'time', name: 'Patience', desc: (r) => `Boss timer +${r * 3}s`, max: 10, cost: (r) => 2 + r, icon: 'ui_crystal' },
  { id: 'tap', name: 'Quick Fingers', desc: (r) => `+${r * 50}% tap damage`, max: 50, cost: (r) => r + 1, icon: 'pet_butterfly' },
  { id: 'skills', name: 'Craftsman', desc: (r) => `+${r * 10}% gather speed and skill XP`, max: 30, cost: (r) => 2 + r, icon: 'sk_smithing' },
  { id: 'loot', name: 'Treasure Hunter', desc: (r) => `+${r * 10}% drop chance`, max: 30, cost: (r) => 2 + r, icon: 'ui_chest' },
  { id: 'offline', name: 'Dreamwalker', desc: (r) => `Offline cap ${12 + r * 2}h`, max: 12, cost: (r) => 3 + r, icon: 'ui_book' },
];
export const soulsFor = (maxStage: number) => (maxStage < ASCEND_STAGE ? 0 : Math.floor(Math.pow(maxStage - ASCEND_STAGE + 10, 2) / 8));

// ---------------- achievements & quests ----------------
export interface Ach { id: string; name: string; desc: string; check: (s: any) => boolean; reward: string; bonus: { stat: string; value: number } }
const A = (id: string, name: string, desc: string, check: (s: any) => boolean, stat = 'dmg', value = 0.03): Ach => ({ id, name, desc, check, reward: stat === 'dmg' ? `+${value * 100}% damage` : stat === 'gold' ? `+${value * 100}% gold` : `+${value * 100}% ${stat}`, bonus: { stat, value } });
export const ACHIEVEMENTS: Ach[] = [
  A('s10', 'First Steps', 'Reach stage 10', (s) => s.maxStage >= 10), A('s25', 'Adventurer', 'Reach stage 25', (s) => s.maxStage >= 25), A('s50', 'Veteran', 'Reach stage 50', (s) => s.maxStage >= 50, 'dmg', 0.05),
  A('s75', 'Champion', 'Reach stage 75', (s) => s.maxStage >= 75, 'dmg', 0.06), A('s100', 'Realm Walker', 'Reach stage 100', (s) => s.maxStage >= 100, 'dmg', 0.1), A('s150', 'Beyond', 'Reach stage 150', (s) => s.maxStage >= 150, 'dmg', 0.15),
  A('k100', 'Pest Control', 'Defeat 100 monsters', (s) => s.stats.kills >= 100, 'gold', 0.03), A('k1k', 'Slayer', 'Defeat 1,000 monsters', (s) => s.stats.kills >= 1000, 'gold', 0.05), A('k10k', 'Exterminator', 'Defeat 10,000 monsters', (s) => s.stats.kills >= 10000, 'gold', 0.1),
  A('b10', 'Boss Hunter', 'Defeat 10 bosses', (s) => s.stats.bosses >= 10), A('b50', 'Boss Breaker', 'Defeat 50 bosses', (s) => s.stats.bosses >= 50, 'dmg', 0.05),
  A('party4', 'Full Party', 'Recruit 4 heroes', (s) => Object.keys(s.heroes).length >= 4, 'dmg', 0.05), A('party6', 'Legendary Band', 'Recruit all 6 heroes', (s) => Object.keys(s.heroes).length >= 6, 'dmg', 0.1),
  A('lv100', 'Centurion', 'Get a hero to level 100', (s) => Object.values(s.heroes).some((h: any) => h.level >= 100), 'dmg', 0.05),
  A('rare', 'Shiny', 'Find a Rare item', (s) => s.stats.bestRarity >= 2, 'drop', 0.05), A('epic', 'Ooh, Purple', 'Find an Epic item', (s) => s.stats.bestRarity >= 3, 'drop', 0.05), A('leg', 'Legend Has It', 'Find a Legendary item', (s) => s.stats.bestRarity >= 4, 'drop', 0.1),
  A('mine30', 'Miner', 'Mining level 30', (s) => s.skillLv.mining >= 30, 'gather', 0.05), A('wood30', 'Lumberjack', 'Woodcutting level 30', (s) => s.skillLv.woodcutting >= 30, 'gather', 0.05),
  A('fish30', 'Angler', 'Fishing level 30', (s) => s.skillLv.fishing >= 30, 'gather', 0.05), A('forage30', 'Herbalist', 'Foraging level 30', (s) => s.skillLv.foraging >= 30, 'gather', 0.05),
  A('smith30', 'Blacksmith', 'Smithing level 30', (s) => s.skillLv.smithing >= 30, 'dmg', 0.05), A('cook30', 'Chef', 'Cooking level 30', (s) => s.skillLv.cooking >= 30, 'hp', 0.05), A('alch30', 'Alchemist', 'Alchemy level 30', (s) => s.skillLv.alchemy >= 30, 'dmg', 0.05),
  A('total200', 'Jack of All Trades', 'Total skill level 200', (s) => Object.values(s.skillLv).reduce((a: number, b: any) => a + b, 0) >= 200, 'gather', 0.1),
  A('pet1', 'Best Friend', 'Find a pet', (s) => Object.keys(s.pets).length >= 1, 'dmg', 0.05), A('pet5', 'Menagerie', 'Find 5 pets', (s) => Object.keys(s.pets).length >= 5, 'dmg', 0.1),
  A('asc1', 'Reborn', 'Ascend once', (s) => s.ascensions >= 1, 'dmg', 0.1), A('asc5', 'Eternal', 'Ascend 5 times', (s) => s.ascensions >= 5, 'dmg', 0.2),
  A('tap1k', 'Clicky', 'Tap 1,000 times', (s) => s.stats.taps >= 1000, 'tap', 0.25), A('frenzy10', 'Frenzied', 'Trigger Frenzy 10 times', (s) => s.stats.frenzies >= 10, 'tap', 0.25),
];

export interface Quest { text: string; check: (s: any) => boolean; gold: (s: any) => number; tab?: string }
export const QUESTS: Quest[] = [
  { text: 'Level up Sir Donald to level 5', check: (s) => s.heroes.knight?.level >= 5, gold: () => 40, tab: 'party' },
  { text: 'Tap the monster 20 times', check: (s) => s.stats.taps >= 20, gold: () => 60, tab: 'battle' },
  { text: 'Reach stage 3', check: (s) => s.maxStage >= 3, gold: () => 100 },
  { text: 'Recruit Joseph the Ranger', check: (s) => !!s.heroes.ranger, gold: () => 150, tab: 'party' },
  { text: 'Defeat your first boss (stage 5)', check: (s) => s.stats.bosses >= 1, gold: () => 400 },
  { text: 'Mine some ore: send a spare hero to Copper in the Skills tab', check: (s) => s.skillXp.mining > 0, gold: () => 300, tab: 'skills' },
  { text: 'Recruit Mennas the Cleric', check: (s) => !!s.heroes.cleric, gold: () => 900, tab: 'party' },
  { text: 'Equip an item on any hero', check: (s) => s.stats.equips >= 1, gold: () => 500, tab: 'gear' },
  { text: 'Craft something at the forge', check: (s) => s.skillXp.smithing > 0, gold: () => 1500, tab: 'craft' },
  { text: 'Reach stage 15', check: (s) => s.maxStage >= 15, gold: (s) => 4000 },
  { text: 'Recruit Maggie the Mage', check: (s) => !!s.heroes.mage, gold: () => 6000, tab: 'party' },
  { text: 'Cook some food for the party', check: (s) => s.skillXp.cooking > 0, gold: () => 5000, tab: 'craft' },
  { text: 'Brew a potion and drink it', check: (s) => s.stats.potions >= 1, gold: () => 8000, tab: 'craft' },
  { text: 'Reach stage 25', check: (s) => s.maxStage >= 25, gold: () => 60000 },
  { text: 'Get any hero to level 50', check: (s) => Object.values(s.heroes).some((h: any) => h.level >= 50), gold: () => 80000, tab: 'party' },
  { text: 'Recruit Sonja the Rogue', check: (s) => !!s.heroes.rogue, gold: () => 100000, tab: 'party' },
  { text: 'Reach stage 40 to unlock Ascension', check: (s) => s.maxStage >= 40, gold: () => 2e6 },
  { text: 'Ascend for your first Souls', check: (s) => s.ascensions >= 1, gold: () => 0, tab: 'ascend' },
  { text: 'Reach stage 60', check: (s) => s.maxStage >= 60, gold: () => 1e9 },
  { text: 'Reach stage 100 — the Celestial Spire', check: (s) => s.maxStage >= 100, gold: () => 1e14 },
];
