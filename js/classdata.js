// Class identity: weapons, armour sets, and ascendancy passives.

// Weapon types each class is proficient with (30% more damage)
export const CLASS_WEAPONS = {
  witch: ['Wand', 'Staff'],
  shadow: ['Dagger', 'Claw'],
  ranger: ['Bow'],
  duelist: ['Sword'],
  marauder: ['Axe', 'Mace'],
  templar: ['Sceptre', 'Mace'],
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
    bonuses: { 2: { incPhys: 25 }, 3: { leech: 1.5, block: 6 }, 5: { moreDmg: 30, incLife: 10 } },
    text: { 2: '+25% increased Physical Damage', 3: '1.5% Life Leech, +6% Block', 5: '30% more Damage, +10% increased Life' } },
  marauder: { name: "Warlord's Plate",         prefix: 'Warlord', cls: 'marauder',
    bonuses: { 2: { incLife: 20 }, 3: { incArmour: 40 }, 5: { moreDmg: 25, regenPct: 1 } },
    text: { 2: '+20% increased Life', 3: '+40% increased Armour', 5: '25% more Damage, Regenerate 1% Life per second' } },
  templar:  { name: "Crusader's Vestments",    prefix: 'Crusader', cls: 'templar',
    bonuses: { 2: { resist: 8 }, 3: { incEle: 30, incArmour: 30 }, 5: { moreDmg: 25, maxRes: 5 } },
    text: { 2: '+8% Elemental Resistance', 3: '+30% Elemental Damage, +30% Armour', 5: '25% more Damage, +5% maximum Resistance' } },
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
export const ASCENDANCY = {
  witch: [
    [{ name: 'Elementalist', desc: '+35% increased Elemental Damage', e: { incEle: 35 } },
     { name: 'Occultist', desc: 'Skills deal 25% more damage / effect', e: { skillPow: 25 } }],
    [{ name: 'Arcane Barrier', desc: '+20% Life, +10% Elemental Resistance', e: { incLife: 20, resist: 10 } },
     { name: 'Mana Surge', desc: 'Skills recharge 20% faster', e: { cdr: 20 } }],
    [{ name: 'Archmage', desc: '25% more Damage', e: { moreDmg: 25 } },
     { name: 'Eternal Ward', desc: '+5% max Resistance, Regenerate 1% Life/s', e: { maxRes: 5, regenPct: 1 } }],
  ],
  shadow: [
    [{ name: 'Assassin', desc: '+50% to Critical Strike Multiplier', e: { critMulti: 50 } },
     { name: 'Trickster', desc: '+30% Evasion, +6% Attack Speed', e: { incEvasion: 30, aps: 6 } }],
    [{ name: 'Saboteur', desc: 'Skills recharge 20% faster', e: { cdr: 20 } },
     { name: 'Venomist', desc: '1.5% Life Leech, +20% Crit Chance', e: { leech: 1.5, critChance: 20 } }],
    [{ name: 'Executioner', desc: '25% more Damage', e: { moreDmg: 25 } },
     { name: 'Phantom', desc: '+8% maximum Evade chance', e: { evadeCap: 8 } }],
  ],
  ranger: [
    [{ name: 'Deadeye', desc: '+12% increased Attack Speed', e: { aps: 12 } },
     { name: 'Pathfinder', desc: 'Regenerate 1% Life/s, +10% Life', e: { regenPct: 1, incLife: 10 } }],
    [{ name: 'Raider', desc: '+40% increased Evasion', e: { incEvasion: 40 } },
     { name: 'Sharpshooter', desc: '+40% Crit Chance, +20% Crit Multiplier', e: { critChance: 40, critMulti: 20 } }],
    [{ name: 'Windstorm', desc: '25% more Damage', e: { moreDmg: 25 } },
     { name: 'Ghost', desc: '+8% maximum Evade chance', e: { evadeCap: 8 } }],
  ],
  duelist: [
    [{ name: 'Slayer', desc: '2% Life Leech, +15% Physical Damage', e: { leech: 2, incPhys: 15 } },
     { name: 'Champion', desc: '+20% Armour, +15% Life', e: { incArmour: 20, incLife: 15 } }],
    [{ name: 'Gladiator', desc: '+15% Chance to Block', e: { block: 15 } },
     { name: 'Duellist', desc: '+10% Attack Speed, +20% Physical Damage', e: { aps: 10, incPhys: 20 } }],
    [{ name: 'Warlord', desc: '25% more Damage', e: { moreDmg: 25 } },
     { name: 'Unyielding', desc: '+25% Life, Regenerate 2% Life/s', e: { incLife: 25, regenPct: 2 } }],
  ],
  marauder: [
    [{ name: 'Juggernaut', desc: '+40% increased Armour', e: { incArmour: 40 } },
     { name: 'Berserker', desc: '+25% Physical Damage, +5% Attack Speed', e: { incPhys: 25, aps: 5 } }],
    [{ name: 'Chieftain', desc: '+25% Elemental Damage, +10% Resistance', e: { incEle: 25, resist: 10 } },
     { name: 'Bloodlust', desc: '1% Life Leech, +15% Life', e: { leech: 1, incLife: 15 } }],
    [{ name: 'Titan', desc: '25% more Damage', e: { moreDmg: 25 } },
     { name: 'Unstoppable', desc: '+30% Life, +5% max Resistance', e: { incLife: 30, maxRes: 5 } }],
  ],
  templar: [
    [{ name: 'Inquisitor', desc: '+30% Elemental Damage, +20% Crit Chance', e: { incEle: 30, critChance: 20 } },
     { name: 'Guardian', desc: '+20% Life, +20% Armour', e: { incLife: 20, incArmour: 20 } }],
    [{ name: 'Hierophant', desc: 'Skills recharge 20% faster', e: { cdr: 20 } },
     { name: 'Paladin', desc: '+10% Block, +8% Resistance', e: { block: 10, resist: 8 } }],
    [{ name: 'Divine Avatar', desc: '25% more Damage', e: { moreDmg: 25 } },
     { name: 'Sanctified', desc: '+5% max Resistance, Regenerate 1.5% Life/s', e: { maxRes: 5, regenPct: 1.5 } }],
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
