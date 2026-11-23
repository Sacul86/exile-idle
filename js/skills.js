// Skills: 5 classes x 3 trees x 6 slot roles = 90 skills. Data rows + effective-value helpers.
import { CLASSES } from './data.js';

export const SLOT_ROLES = [
  { id: 'primary', name: 'Primary', icon: '🗡️', lvl: 1, desc: 'Main single-target damage' },
  { id: 'defensive', name: 'Defensive', icon: '🛡️', lvl: 5, desc: 'Heal, shield or damage reduction' },
  { id: 'aoe', name: 'Area', icon: '💥', lvl: 20, desc: 'Hits every enemy' },
  { id: 'secondary', name: 'Secondary', icon: '⚔️', lvl: 30, desc: 'Heavy single-target hit' },
  { id: 'utility', name: 'Utility', icon: '✨', lvl: 40, desc: 'Buffs, debuffs and summons' },
  { id: 'ultimate', name: 'Ultimate', icon: '🌟', lvl: 50, desc: 'Huge cooldown, huge effect' },
];
export const ROLE_IDS = SLOT_ROLES.map((r) => r.id);
const DEF = {
  primary: { coef: 2.0, cd: 3 }, secondary: { coef: 4.5, cd: 8 }, aoe: { coef: 1.6, cd: 7, aoe: true },
  defensive: { cd: 15 }, utility: { cd: 18, dur: 8 }, ultimate: { coef: 9, cd: 45, aoe: true },
};
// row: [id, name, role, element, icon, extra]
const ROWS = {
  fury: [
    ['cleave', 'Raging Cleave', 'primary', 'phys', '🪓', { st: 'bleed' }],
    ['bloodlust', 'Bloodlust', 'defensive', 'phys', '🩸', { heal: 18, buff: { leech: 4 }, dur: 6 }],
    ['whirlwind', 'Whirlwind', 'aoe', 'phys', '🌪️', { hits: 3, coef: 0.7, st: 'bleed' }],
    ['rampage', 'Rampage', 'secondary', 'phys', '💢', { coef: 5.2 }],
    ['frenzy', 'Battle Frenzy', 'utility', 'phys', '😤', { buff: { aspd: 40, more: 15 } }],
    ['avatar', 'Avatar of War', 'ultimate', 'phys', '🔱', { coef: 6, buff: { more: 40, aspd: 30 }, dur: 10 }],
  ],
  command: [
    ['strike', 'Commanding Strike', 'primary', 'phys', '⚔️', { st: 'weaken' }],
    ['rally', 'Rallying Cry', 'defensive', 'phys', '📯', { heal: 15, shield: 15 }],
    ['shockwave', 'Shockwave', 'aoe', 'phys', '🌊', { st: 'freeze', stCh: 0.35 }],
    ['execute', 'Execute', 'secondary', 'phys', '🗡️', { coef: 4, execute: 100 }],
    ['warcry', 'War Cry', 'utility', 'phys', '📣', { buff: { crit: 25, critDmg: 40 } }],
    ['banner', 'Banner of Kings', 'ultimate', 'phys', '🚩', { coef: 8, buff: { more: 30 }, dur: 12 }],
  ],
  bulwark: [
    ['shieldbash', 'Shield Bash', 'primary', 'phys', '🛡️', { st: 'freeze', stCh: 0.2, scaleArmour: true }],
    ['ironskin', 'Iron Skin', 'defensive', 'phys', '🪨', { dr: 45, dur: 6 }],
    ['groundslam', 'Ground Slam', 'aoe', 'phys', '💥', { st: 'weaken' }],
    ['retaliate', 'Retaliation', 'secondary', 'phys', '↩️', { coef: 3.5, scaleArmour: true }],
    ['fortify', 'Fortify', 'utility', 'phys', '🏰', { buff: { dr: 25, thorns: 60 }, dur: 10 }],
    ['unbreak', 'Unbreakable', 'ultimate', 'phys', '⛰️', { coef: 6, shield: 60, dr: 30, dur: 8 }],
  ],
  fire: [
    ['fireball', 'Fireball', 'primary', 'fire', '🔥', { st: 'burn' }],
    ['blazeward', 'Blazing Ward', 'defensive', 'fire', '🧱', { shield: 30 }],
    ['flamewave', 'Flame Wave', 'aoe', 'fire', '🌋', { st: 'burn' }],
    ['pyroblast', 'Pyroblast', 'secondary', 'fire', '☄️', { coef: 5.5, st: 'burn' }],
    ['combust', 'Combustion', 'utility', 'fire', '♨️', { buff: { fire: 50, crit: 15 } }],
    ['meteor', 'Meteor Storm', 'ultimate', 'fire', '🌠', { coef: 10, st: 'burn' }],
  ],
  ice: [
    ['frostbolt', 'Frostbolt', 'primary', 'cold', '❄️', { st: 'chill' }],
    ['iceblock', 'Ice Barrier', 'defensive', 'cold', '🧊', { shield: 35, dr: 20, dur: 5 }],
    ['blizzard', 'Blizzard', 'aoe', 'cold', '🌨️', { hits: 4, coef: 0.5, st: 'chill' }],
    ['shatter', 'Glacial Spike', 'secondary', 'cold', '🔹', { coef: 4.5, st: 'freeze', stCh: 0.5 }],
    ['frostnova', 'Frost Nova', 'utility', 'cold', '💠', { debuff: 'freeze', coef: 1 }],
    ['winter', 'Eternal Winter', 'ultimate', 'cold', '🏔️', { coef: 9, st: 'freeze' }],
  ],
  arcane: [
    ['missiles', 'Arcane Missiles', 'primary', 'arcane', '✨', { hits: 3, coef: 0.75 }],
    ['blink', 'Blink', 'defensive', 'arcane', '🌀', { dodge: 1, heal: 12 }],
    ['arcorb', 'Arcane Orb', 'aoe', 'arcane', '🔮', { st: 'shock' }],
    ['arcblast', 'Arcane Blast', 'secondary', 'arcane', '💫', { coef: 5 }],
    ['timewarp', 'Time Warp', 'utility', 'arcane', '⏳', { reset: 0.5, buff: { aspd: 25 } }],
    ['singular', 'Singularity', 'ultimate', 'arcane', '🌌', { coef: 11, st: 'shock' }],
  ],
  marks: [
    ['aimed', 'Aimed Shot', 'primary', 'phys', '🎯', { critBonus: 15 }],
    ['disengage', 'Disengage', 'defensive', 'phys', '🍃', { dodge: 1, buff: { aspd: 20 }, dur: 4 }],
    ['multishot', 'Multishot', 'aoe', 'phys', '🏹', { hits: 2, coef: 0.9 }],
    ['snipe', 'Snipe', 'secondary', 'phys', '🔭', { coef: 5.5, critBonus: 30 }],
    ['eagle', 'Eagle Eye', 'utility', 'phys', '🦅', { buff: { crit: 25, critDmg: 50 } }],
    ['volley', 'Rain of Arrows', 'ultimate', 'phys', '🌧️', { coef: 10, hits: 1 }],
  ],
  beast: [
    ['packstrike', 'Pack Strike', 'primary', 'phys', '🐾', { pet: 1, st: 'bleed' }],
    ['mend', 'Mend Pet', 'defensive', 'nature', '🌿', { heal: 20, shield: 10 }],
    ['stampede', 'Stampede', 'aoe', 'phys', '🦬', { st: 'weaken' }],
    ['maul', 'Maul', 'secondary', 'phys', '🐻', { coef: 4.5, pet: 1, st: 'bleed' }],
    ['bestial', 'Bestial Wrath', 'utility', 'phys', '🐺', { buff: { petDmg: 150, more: 15 } }],
    ['wildhunt', 'Wild Hunt', 'ultimate', 'phys', '🦁', { coef: 9, pet: 1 }],
  ],
  shade: [
    ['venom', 'Venom Arrow', 'primary', 'poison', '🐍', { st: 'poison', stacks: 2 }],
    ['smoke', 'Smoke Bomb', 'defensive', 'shadow', '💨', { dodge: 1, dr: 30, dur: 4 }],
    ['toxic', 'Toxic Cloud', 'aoe', 'poison', '☁️', { hits: 3, coef: 0.5, st: 'poison' }],
    ['ambush', 'Ambush', 'secondary', 'shadow', '🗡️', { coef: 5, critBonus: 25 }],
    ['trap', 'Shadow Trap', 'utility', 'shadow', '🕸️', { debuff: 'vuln', coef: 1.5 }],
    ['deathmark', 'Death Mark', 'ultimate', 'poison', '☠️', { coef: 9, st: 'poison', stacks: 8 }],
  ],
  death: [
    ['bonespear', 'Bone Spear', 'primary', 'shadow', '🦴', { minion: 1 }],
    ['boneshield', 'Bone Armour', 'defensive', 'shadow', '💀', { shield: 30, dr: 15, dur: 6 }],
    ['corpseboom', 'Corpse Explosion', 'aoe', 'shadow', '💥', { coef: 2, minionBoost: 0.2 }],
    ['drain', 'Death Coil', 'secondary', 'shadow', '🌀', { coef: 4, leechHit: 30 }],
    ['raise', 'Raise Dead', 'utility', 'shadow', '🧟', { summon: 'skeleton', n: 3, dur: 20 }],
    ['army', 'Army of the Dead', 'ultimate', 'shadow', '⚰️', { coef: 6, summon: 'skeleton', n: 6, dur: 15 }],
  ],
  soul: [
    ['soulrend', 'Soul Rend', 'primary', 'shadow', '👻', { leechHit: 15 }],
    ['soulward', 'Soul Ward', 'defensive', 'shadow', '🔰', { heal: 25 }],
    ['harvest', 'Soul Harvest', 'aoe', 'shadow', '🌾', { leechHit: 10, st: 'weaken' }],
    ['reap', 'Reap', 'secondary', 'shadow', '⚰️', { coef: 4, execute: 120 }],
    ['curse', 'Curse of Agony', 'utility', 'shadow', '🕯️', { debuff: 'vuln', coef: 1.2, debuff2: 'weaken' }],
    ['ragnarok', 'Soul Cataclysm', 'ultimate', 'shadow', '🌑', { coef: 10, leechHit: 20 }],
  ],
  demon: [
    ['hellbolt', 'Hellfire Bolt', 'primary', 'fire', '🔥', { st: 'burn' }],
    ['pact', 'Demonic Pact', 'defensive', 'fire', '📜', { heal: 15, shield: 20 }],
    ['rain', 'Rain of Fire', 'aoe', 'fire', '🌋', { hits: 3, coef: 0.6, st: 'burn' }],
    ['chaosbolt', 'Chaos Bolt', 'secondary', 'fire', '😈', { coef: 5.5, critBonus: 20 }],
    ['summondemon', 'Summon Felguard', 'utility', 'fire', '👹', { summon: 'demon', n: 1, dur: 18 }],
    ['infernal', 'Summon Infernal', 'ultimate', 'fire', '☄️', { coef: 8, summon: 'infernal', n: 1, dur: 15 }],
  ],
  holy: [
    ['smite', 'Smite', 'primary', 'holy', '☀️', {}],
    ['layhands', 'Lay on Hands', 'defensive', 'holy', '🙏', { heal: 35 }],
    ['consecrate', 'Consecration', 'aoe', 'holy', '✨', { hits: 3, coef: 0.6, heal: 3 }],
    ['holyshock', 'Holy Shock', 'secondary', 'holy', '⚡', { coef: 4.5, heal: 6 }],
    ['blessing', 'Blessing of Might', 'utility', 'holy', '👑', { buff: { more: 25, hpRegenPct: 2 } }],
    ['wrath', 'Divine Wrath', 'ultimate', 'holy', '🌞', { coef: 10, heal: 25 }],
  ],
  judge: [
    ['judgement', 'Judgement', 'primary', 'holy', '⚖️', { st: 'vuln' }],
    ['divshield', 'Divine Shield', 'defensive', 'holy', '🔆', { dodge: 1, dr: 60, dur: 4 }],
    ['hammers', 'Hammer Storm', 'aoe', 'holy', '🔨', { st: 'vuln' }],
    ['verdict', "Templar's Verdict", 'secondary', 'holy', '🗡️', { coef: 5.2 }],
    ['inquest', 'Inquisition', 'utility', 'holy', '🔥', { debuff: 'vuln', coef: 2, buff: { crit: 15 } }],
    ['final', 'Final Reckoning', 'ultimate', 'holy', '⚔️', { coef: 11, st: 'vuln' }],
  ],
  zeal: [
    ['crusade', 'Crusader Strike', 'primary', 'phys', '✝️', { st: 'bleed' }],
    ['aegis', 'Holy Aegis', 'defensive', 'holy', '🛡️', { shield: 40 }],
    ['divstorm', 'Divine Storm', 'aoe', 'holy', '🌪️', { heal: 4 }],
    ['zealot', 'Zealous Charge', 'secondary', 'phys', '🐎', { coef: 4.5, st: 'freeze', stCh: 0.4 }],
    ['aura', 'Devotion Aura', 'utility', 'holy', '💛', { buff: { dr: 15, more: 15 }, dur: 12 }],
    ['crusadeult', 'Holy Crusade', 'ultimate', 'holy', '🚩', { coef: 8, shield: 40 }],
  ],
};

export const SKILLS = {};
for (const [ck, c] of Object.entries(CLASSES)) {
  for (const t of c.trees) {
    for (const [id, name, role, elem, icon, extra] of ROWS[t.id]) {
      SKILLS[id] = { id, name, role, elem, icon, cls: ck, tree: t.id, ...DEF[role], ...extra, lvl: SLOT_ROLES.find((r) => r.id === role).lvl };
    }
  }
}
export const classSkills = (cls) => Object.values(SKILLS).filter((s) => s.cls === cls);
export const skillsForRole = (cls, role) => classSkills(cls).filter((s) => s.role === role);

export const STATUS = {
  burn: { name: 'Burn', icon: '🔥', letter: 'B', color: '#ff7a3a', dur: 4, text: 'Fire damage over time' },
  bleed: { name: 'Bleed', icon: '🩸', letter: 'Bl', color: '#d0392f', dur: 5, text: 'Physical damage over time' },
  poison: { name: 'Poison', icon: '☠️', letter: 'P', color: '#7ad04a', dur: 6, text: 'Stacking damage over time (max 10)' },
  chill: { name: 'Chill', icon: '🧊', letter: 'C', color: '#7ad0ff', dur: 4, text: 'Attacks 35% slower' },
  freeze: { name: 'Freeze', icon: '❄️', letter: 'F', color: '#bfefff', dur: 1.5, text: 'Cannot act' },
  shock: { name: 'Shock', icon: '⚡', letter: 'S', color: '#ffe36b', dur: 4, text: 'Takes 20% more damage' },
  vuln: { name: 'Judged', icon: '⚖️', letter: 'J', color: '#f2d64b', dur: 6, text: 'Takes more damage' },
  weaken: { name: 'Weakened', icon: '🥀', letter: 'W', color: '#b46bff', dur: 6, text: 'Deals 25% less damage' },
};
export const ELEM_ICONS = { phys: '🗡️', fire: '🔥', cold: '❄️', lightning: '⚡', arcane: '✨', shadow: '🌑', holy: '☀️', poison: '☠️', nature: '🌿' };
export const isMagic = (elem) => !['phys', 'poison'].includes(elem) || false;

export const SKILL_MAX = 15;
export const rankMult = (rank) => 1 + 0.14 * (rank - 1);
export function skillEff(sk, rank = 1, awakened = false) {
  const m = rankMult(rank) * (awakened ? 1.5 : 1);
  return {
    ...sk,
    coef: (sk.coef || 0) * m,
    heal: sk.heal ? sk.heal * (1 + 0.04 * (rank - 1)) * (awakened ? 1.3 : 1) : 0,
    shield: sk.shield ? sk.shield * (1 + 0.04 * (rank - 1)) * (awakened ? 1.3 : 1) : 0,
    cd: sk.cd * (awakened ? 0.8 : 1),
    hits: (sk.hits || 1) + (awakened && sk.hits ? 1 : 0),
    stacks: (sk.stacks || 1) + (awakened ? 1 : 0),
    awakened,
  };
}
export const skillUpgradeCost = (rank) => ({ gold: Math.round(60 * Math.pow(rank, 2.6)), dust: rank >= 5 ? (rank - 4) * 3 : 0 });
export const awakenCost = () => ({ essence: 12, cores: 3 });

export function skillText(sk, rank = 1, awakened = false) {
  const e = skillEff(sk, rank, awakened);
  const p = [];
  if (e.coef) p.push(`${Math.round(e.coef * 100)}% ${sk.elem === 'phys' ? 'physical' : sk.elem} damage${e.hits > 1 ? ` x${e.hits} hits` : ''}${e.aoe ? ' to all enemies' : ''}`);
  if (sk.st) p.push(`${sk.stCh ? Math.round(sk.stCh * 100) + '% chance to ' : 'applies '}${STATUS[sk.st].name}${e.stacks > 1 && sk.st === 'poison' ? ` x${e.stacks}` : ''}`);
  if (e.heal) p.push(`heals ${Math.round(e.heal)}% life`);
  if (e.shield) p.push(`shield ${Math.round(e.shield)}% life`);
  if (sk.dr) p.push(`${sk.dr}% damage reduction for ${sk.dur}s`);
  if (sk.dodge) p.push('dodges the next telegraphed attack');
  if (sk.buff) p.push(Object.entries(sk.buff).map(([k, v]) => `+${v}% ${k === 'more' ? 'damage' : k === 'aspd' ? 'attack speed' : k === 'hpRegenPct' ? 'life regen/s' : k === 'petDmg' ? 'companion damage' : k}`).join(', ') + ` for ${sk.dur}s`);
  if (sk.debuff) p.push(`${STATUS[sk.debuff].name}${sk.debuff2 ? ' + ' + STATUS[sk.debuff2].name : ''} on all enemies`);
  if (sk.summon) p.push(`summons ${sk.n} ${sk.summon}${sk.n > 1 ? 's' : ''} for ${sk.dur}s`);
  if (sk.execute) p.push(`+${sk.execute}% vs enemies below 30% life`);
  if (sk.leechHit) p.push(`heals ${sk.leechHit}% of damage dealt`);
  if (sk.critBonus) p.push(`+${sk.critBonus}% crit chance`);
  if (sk.reset) p.push('halves all other cooldowns');
  if (sk.pet) p.push('your companion strikes too');
  if (sk.minion) p.push('minions also attack the target');
  if (sk.scaleArmour) p.push('scales with armour');
  p.push(`${e.cd.toFixed(1).replace('.0', '')}s cooldown`);
  return p.join(' · ');
}
