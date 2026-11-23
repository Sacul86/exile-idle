// Class identity: weapons, armour sets, and ascendancy passives.

// Weapon types each class is proficient with (30% more damage)
export const CLASS_WEAPONS = {
  witch: ['Wand', 'Staff'],
  shadow: ['Dagger', 'Claw'],
  ranger: ['Bow', 'Claw'],
  duelist: ['Sword'],
  marauder: ['Axe', 'Mace'],
  templar: ['Sceptre', 'Mace'],
  druid: ['Staff', 'Sceptre'],
};
export const WEAPON_MASTERY = 0.3;

// ---- Armour sets: 5 pieces, bonuses at 2 / 3 / 5 equipped ----
export const SET_SLOTS = ['helm', 'chest', 'gloves', 'boots', 'amulet'];
const PIECE_WORDS = { helm: 'Crown', chest: 'Vestments', gloves: 'Grasp', boots: 'Treads', amulet: 'Sigil' };
export const SETS = {
  witch:    { name: 'Regalia of the Storm',   prefix: 'Stormcaller', cls: 'witch',
    bonuses: { 2: { incEle: 30 }, 3: { resist: 10, incLife: 15 }, 5: { moreDmg: 30, cdr: 15 } },
    text: { 2: '+30% increased Elemental Damage', 3: '+10% Elemental Resistance, +15% increased Life', 5: '30% more Damage, skills recharge 15% faster' } },
  shadow:   { name: "Nightblade's Garb",       prefix: 'Nightblade', cls: 'shadow',
    bonuses: { 2: { critChance: 40 }, 3: { critMulti: 40 }, 5: { moreDmg: 30, aps: 8 } },
    text: { 2: '+40% increased Critical Strike Chance', 3: '+40% to Critical Strike Multiplier', 5: '30% more Damage, +8% Attack Speed' } },
  ranger:   { name: "Windrunner's Kit",        prefix: 'Windrunner', cls: 'ranger',
    bonuses: { 2: { aps: 12 }, 3: { incEvasion: 40 }, 5: { moreDmg: 25, evadeCap: 5 } },
    text: { 2: '+12% increased Attack Speed', 3: '+40% increased Evasion', 5: '25% more Damage, +5% maximum Evade chance' } },
  duelist:  { name: "Gladiator's Panoply",     prefix: 'Gladiator', cls: 'duelist',
    bonuses: { 2: { block: 6 }, 3: { incArmour: 30, leech: 1 }, 5: { dr: 15, moreDmg: 15 } },
    text: { 2: '+6% Chance to Block', 3: '+30% Armour, 1% Life Leech', 5: 'Take 15% less damage, 15% more Damage' } },
  marauder: { name: "Warlord's Plate",         prefix: 'Warlord', cls: 'marauder',
    bonuses: { 2: { incLife: 20 }, 3: { incArmour: 40 }, 5: { dr: 15, regenPct: 1 } },
    text: { 2: '+20% increased Life', 3: '+40% increased Armour', 5: 'Take 15% less damage, Regenerate 1% Life per second' } },
  templar:  { name: "Crusader's Vestments",    prefix: 'Crusader', cls: 'templar',
    bonuses: { 2: { incHeal: 20, resist: 5 }, 3: { incArmour: 30, incLife: 10 }, 5: { healMore: 30, maxRes: 5 } },
    text: { 2: '+20% Healing, +5% Resistance', 3: '+30% Armour, +10% Life', 5: '30% more Healing, +5% maximum Resistance' } },
  druid:    { name: "Grove Warden's Mantle",   prefix: 'Grovewarden', cls: 'druid',
    bonuses: { 2: { incHeal: 25 }, 3: { incLife: 15, regenPct: 0.5 }, 5: { healMore: 30, cdr: 15 } },
    text: { 2: '+25% increased Healing', 3: '+15% Life, Regenerate 0.5% Life/s', 5: '30% more Healing, skills recharge 15% faster' } },
};
export const setPieceName = (setId, type) => `${SETS[setId].prefix} ${PIECE_WORDS[type]}`;

// Equipped set pieces per set
export function setCounts(gear) {
  const counts = {};
  for (const it of Object.values(gear)) if (it && it.set) counts[it.set] = (counts[it.set] || 0) + 1;
  return counts;
}

// ---- Ascendancy: at levels 15 / 40 / 75 choose 1 of 2 ----
export const ASC_LEVELS = [15, 40, 75];
const P = (name, desc, e) => ({ name, desc, e });
export const ASCENDANCY = {
  witch: [
    [P('Pyromancer', '+35% increased Elemental Damage', { incEle: 35 }), P('Arcanist', 'Skills deal 25% more damage / effect', { skillPow: 25 })],
    [P('Spellward', '+20% Life, +10% Elemental Resistance', { incLife: 20, resist: 10 }), P('Chronomancer', 'Skills recharge 20% faster', { cdr: 20 })],
    [P('Archmage', '25% more Damage', { moreDmg: 25 }), P('Eternal', '+5% max Resistance, Regenerate 1% Life/s', { maxRes: 5, regenPct: 1 })],
  ],
  shadow: [
    [P('Cutthroat', '+50% to Critical Strike Multiplier', { critMulti: 50 }), P('Nightstalker', '+30% Evasion, +6% Attack Speed', { incEvasion: 30, aps: 6 })],
    [P('Trapper', 'Skills recharge 20% faster', { cdr: 20 }), P('Venomist', '1.5% Life Leech, +20% Crit Chance', { leech: 1.5, critChance: 20 })],
    [P('Executioner', '25% more Damage', { moreDmg: 25 }), P('Phantom', '+8% maximum Evade chance', { evadeCap: 8 })],
  ],
  ranger: [
    [P('Sharpeye', '+12% increased Attack Speed', { aps: 12 }), P('Wayfinder', 'Regenerate 1% Life/s, +10% Life', { regenPct: 1, incLife: 10 })],
    [P('Skirmisher', '+40% increased Evasion', { incEvasion: 40 }), P('Sniper', '+40% Crit Chance, +20% Crit Multiplier', { critChance: 40, critMulti: 20 })],
    [P('Windstorm', '25% more Damage', { moreDmg: 25 }), P('Ghost', '+8% maximum Evade chance', { evadeCap: 8 })],
  ],
  druid: [
    [P('Bloomcaller', '+30% increased Healing', { incHeal: 30 }), P('Stormwarden', '+30% Elemental Damage, +10% Attack Speed', { incEle: 30, aps: 10 })],
    [P('Grove Ward', '+20% Life, +20% Armour', { incLife: 20, incArmour: 20 }), P('Seasons', 'Skills recharge 20% faster', { cdr: 20 })],
    [P('Avatar of Life', '30% more Healing', { healMore: 30 }), P('Wildheart', '25% more Damage', { moreDmg: 25 })],
  ],
  duelist: [
    [P('Shieldmaster', '+10% Chance to Block', { block: 10 }), P('Bladeleech', '2% Life Leech, +15% Physical Damage', { leech: 2, incPhys: 15 })],
    [P('Arena Veteran', 'Take 10% less damage', { dr: 10 }), P('Swordsman', '+10% Attack Speed, +20% Physical Damage', { aps: 10, incPhys: 20 })],
    [P('Champion', '+25% Life, Regenerate 2% Life/s', { incLife: 25, regenPct: 2 }), P('Warlord', '25% more Damage', { moreDmg: 25 })],
  ],
  marauder: [
    [P('Ironclad', '+40% increased Armour', { incArmour: 40 }), P('Battle Rage', '+25% Physical Damage, +5% Attack Speed', { incPhys: 25, aps: 5 })],
    [P('Chieftain', '+25% Elemental Damage, +10% Resistance', { incEle: 25, resist: 10 }), P('Bloodlust', '1% Life Leech, +15% Life', { leech: 1, incLife: 15 })],
    [P('Colossus', 'Take 12% less damage, +20% Life', { dr: 12, incLife: 20 }), P('Titan', '25% more Damage', { moreDmg: 25 })],
  ],
  templar: [
    [P('Lightbringer', '+30% increased Healing', { incHeal: 30 }), P('Inquisitor', '+30% Elemental Damage, +20% Crit Chance', { incEle: 30, critChance: 20 })],
    [P('Sanctuary', 'Skills recharge 20% faster', { cdr: 20 }), P('Paladin', '+10% Block, +8% Resistance', { block: 10, resist: 8 })],
    [P('Saint', '30% more Healing', { healMore: 30 }), P('Sanctified', '+5% max Resistance, Regenerate 1.5% Life/s', { maxRes: 5, regenPct: 1.5 })],
  ],
};
export const ascRespecCost = (level) => Math.ceil(200 * Math.pow(1.04, level) * (1 + level * 0.1));

// Combined bonus stats from sets + ascendancy + weapon mastery (flat stat map)
export function classBonuses(state, gear) {
  const out = {};
  const add = (s) => { for (const [k, v] of Object.entries(s)) out[k] = (out[k] || 0) + v; };
  // sets
  const counts = setCounts(gear);
  for (const [id, n] of Object.entries(counts)) {
    const set = SETS[id];
    for (const t of [2, 3, 5]) if (n >= t) add(set.bonuses[t]);
  }
  // ascendancy
  const asc = ASCENDANCY[state.cls];
  if (asc) (state.asc || []).forEach((pick, i) => {
    if (pick == null || state.level < ASC_LEVELS[i]) return;
    add(asc[i][pick].e);
  });
  return out;
}

export const isClassWeapon = (state, item) => !!(item && item.type === 'weapon' && (CLASS_WEAPONS[state.cls] || []).includes(item.kind));
