// Active skills: auto-cast on cooldown. Unlock by level, class, or the passive tree.
import { S } from './data.js';

// kind: hit, buff, heal, shield, freeze (freeze/stun), debuff (curse), aura (always-on party buff)
// tags: phys fire cold lightning poison holy nature shadow
// applies: statuses on the enemy  { burn, bleed (fraction of the hit dealt per second), poison (stacks),
//          chill (s), shock / ruin (extra damage taken), weaken (less damage dealt), expose }
// vs: bonus damage against a status { burn: 1.5 } = +150% vs Burning
export const STATUS = {
  burn: { name: 'Burn', icon: '🔥', color: '#ff7a2b', desc: 'fire damage over time' },
  bleed: { name: 'Bleed', icon: '🩸', color: '#d0392f', desc: 'physical damage over time' },
  poison: { name: 'Poison', icon: '☠️', color: '#7ad04a', desc: 'stacking damage over time' },
  chill: { name: 'Chill', icon: '🧊', color: '#9ad8ff', desc: 'enemy attacks 30% slower' },
  shock: { name: 'Shock', icon: '⚡', color: '#ffe36b', desc: 'enemy takes more damage' },
  ruin: { name: 'Ruin', icon: '💀', color: '#b46bff', desc: 'enemy takes more damage' },
  weaken: { name: 'Weaken', icon: '🥀', color: '#c8a0ff', desc: 'enemy deals less damage' },
};
export const TAG_INFO = {
  phys: { name: 'Physical', icon: '⚔️', color: '#d8c8a8' }, fire: { name: 'Fire', icon: '🔥', color: '#ff7a2b' },
  cold: { name: 'Cold', icon: '❄️', color: '#9ad8ff' }, lightning: { name: 'Lightning', icon: '⚡', color: '#ffe36b' },
  poison: { name: 'Poison', icon: '☠️', color: '#7ad04a' }, holy: { name: 'Holy', icon: '✨', color: '#fff3b0' },
  nature: { name: 'Nature', icon: '🌿', color: '#8fd14f' }, shadow: { name: 'Shadow', icon: '🌑', color: '#b46bff' },
};

const K = (o) => o;
export const SKILLS = [
  // ---- Generic skills (any class), by unlock level ----
  K({ id: 'cleave', name: 'Cleave', icon: '🌀', unlock: 1, cd: 4, kind: 'hit', power: 2.5, tags: ['phys'], desc: 'Deal {p}% of your hit damage.' }),
  K({ id: 'heavystrike', name: 'Heavy Strike', icon: '🔨', unlock: 1, cd: 3.5, kind: 'hit', power: 2, tags: ['phys'], applies: { bleed: 0.3 }, desc: 'Deal {p}% hit damage.' }),
  K({ id: 'icespear', name: 'Ice Spear', icon: '🧊', unlock: 3, cd: 4, kind: 'hit', power: 2.3, ele: true, tags: ['cold'], applies: { chill: 3 }, fx: 'frostnova', desc: 'Deal {p}% hit damage.' }),
  K({ id: 'fireball', name: 'Fireball', icon: '☄️', unlock: 5, cd: 5, kind: 'hit', power: 3, ele: true, tags: ['fire'], applies: { burn: 0.3 }, desc: 'Deal {p}% hit damage.' }),
  K({ id: 'mend', name: 'Mending Light', icon: '💚', unlock: 6, cd: 7, kind: 'heal', power: 0.22, tags: ['holy'], desc: 'Heal the most injured ally for {p}% of their max Life when below 60% Life.' }),
  K({ id: 'spark', name: 'Spark', icon: '✴️', unlock: 7, cd: 5, kind: 'hit', power: 0.6, hits: 4, ele: true, tags: ['lightning'], applies: { shock: 0.15 }, fx: 'arc', desc: '4 sparks of {p}% hit damage.' }),
  K({ id: 'poisonblade', name: 'Venom Blade', icon: '🗡️', unlock: 8, cd: 4, kind: 'hit', power: 1.3, tags: ['poison', 'phys'], applies: { poison: 3 }, desc: 'Deal {p}% hit damage.' }),
  K({ id: 'provoke', name: 'Provoke', icon: '😤', unlock: 9, cd: 12, kind: 'debuff', power: 1, dur: 6, tags: ['phys'], applies: { weaken: 0.2 }, selfBuff: { dr: 0.2 }, desc: 'Taunt the enemy. You take 20% less damage for {d}s.' }),
  K({ id: 'warcry', name: 'War Cry', icon: '📯', unlock: 10, cd: 15, kind: 'buff', stat: 'dmg', power: 0.35, dur: 6, tags: ['phys'], desc: '+{p}% more Damage for {d}s.' }),
  K({ id: 'rend', name: 'Rend', icon: '🩸', unlock: 12, cd: 6, kind: 'hit', power: 1.5, tags: ['phys'], applies: { bleed: 0.7 }, desc: 'Deal {p}% hit damage.' }),
  K({ id: 'enfeeble', name: 'Enfeeble', icon: '🥀', unlock: 14, cd: 14, kind: 'debuff', power: 1, dur: 6, tags: ['shadow'], applies: { weaken: 0.3 }, desc: 'Curse the enemy for {d}s.' }),
  K({ id: 'bloodrite', name: 'Blood Rite', icon: '💉', unlock: 15, cd: 12, kind: 'heal', power: 0.3, tags: ['phys'], desc: 'Heal the most injured ally for {p}% of their max Life when below 60% Life.' }),
  K({ id: 'groundslam', name: 'Ground Slam', icon: '💥', unlock: 16, cd: 7, kind: 'freeze', power: 1.6, dur: 1.2, stun: true, tags: ['phys'], fx: 'quake', desc: 'Deal {p}% hit damage and Stun for {d}s.' }),
  K({ id: 'combust', name: 'Combust', icon: '💥', unlock: 18, cd: 7, kind: 'hit', power: 1.5, ele: true, tags: ['fire'], vs: { burn: 1.5 }, consume: 'burn', fx: 'fireball', desc: 'Deal {p}% hit damage and detonate Burn for its remaining damage.' }),
  K({ id: 'molten', name: 'Molten Shell', icon: '🔶', unlock: 20, cd: 18, kind: 'shield', power: 0.35, dur: 8, tags: ['fire'], desc: 'Absorb damage equal to {p}% of max Life for {d}s.' }),
  K({ id: 'shatter', name: 'Shatter', icon: '🔷', unlock: 22, cd: 8, kind: 'hit', power: 2, ele: true, tags: ['cold'], vs: { chill: 2 }, fx: 'frostnova', desc: 'Deal {p}% hit damage.' }),
  K({ id: 'furyaura', name: 'Aura of Fury', icon: '🔴', unlock: 24, kind: 'aura', power: 1, aura: { moreDmg: 10 }, tags: ['phys'], desc: 'While slotted, the party deals {a}% more Damage.' }),
  K({ id: 'flurry', name: 'Blade Flurry', icon: '🌪️', unlock: 25, cd: 8, kind: 'hit', power: 0.75, hits: 6, tags: ['phys'], applies: { bleed: 0.12 }, desc: '6 rapid hits of {p}% hit damage.' }),
  K({ id: 'emberaura', name: 'Aura of Embers', icon: '🟠', unlock: 27, kind: 'aura', power: 1, aura: { incEle: 25 }, tags: ['fire'], desc: 'While slotted, the party has +{a}% Elemental Damage.' }),
  K({ id: 'chainlightning', name: 'Chain Lightning', icon: '⛓️', unlock: 28, cd: 6, kind: 'hit', power: 0.7, hits: 5, ele: true, tags: ['lightning'], applies: { shock: 0.1 }, vs: { shock: 0.5 }, fx: 'arc', desc: '5 chained hits of {p}% hit damage.' }),
  K({ id: 'frostnova', name: 'Frost Nova', icon: '❄️', unlock: 30, cd: 14, kind: 'freeze', power: 1.5, dur: 2.5, tags: ['cold'], applies: { chill: 5 }, desc: 'Deal {p}% hit damage and Freeze the enemy for {d}s.' }),
  K({ id: 'ruin', name: 'Hex of Ruin', icon: '💀', unlock: 31, cd: 14, kind: 'debuff', power: 1, dur: 6, tags: ['shadow'], applies: { ruin: 0.25 }, desc: 'Curse the enemy for {d}s.' }),
  K({ id: 'stoneaura', name: 'Aura of Stone', icon: '🟤', unlock: 32, kind: 'aura', power: 1, aura: { incArmour: 30, incLife: 8 }, tags: ['phys'], desc: 'While slotted, the party has +{a}% Armour and more Life.' }),
  K({ id: 'venomburst', name: 'Venom Burst', icon: '🟢', unlock: 33, cd: 7, kind: 'hit', power: 1, tags: ['poison'], applies: { poison: 2 }, perPoison: 0.25, desc: 'Deal {p}% hit damage, +25% per Poison stack.' }),
  K({ id: 'renew', name: 'Renew', icon: '🌱', unlock: 36, cd: 10, kind: 'heal', party: true, power: 0.1, regen: 0.03, dur: 6, tags: ['nature'], desc: 'Heal the party for {p}% of max Life, then 3% per second for {d}s.' }),
  K({ id: 'lacerate', name: 'Lacerate', icon: '🔪', unlock: 38, cd: 6, kind: 'hit', power: 1, hits: 3, tags: ['phys'], vs: { bleed: 1 }, desc: '3 hits of {p}% hit damage.' }),
  K({ id: 'haste', name: 'Haste', icon: '⚡', unlock: 40, cd: 16, kind: 'buff', stat: 'aps', power: 0.4, dur: 6, tags: ['lightning'], desc: '+{p}% Attack Speed for {d}s.' }),
  K({ id: 'windaura', name: 'Aura of Wind', icon: '🌬️', unlock: 42, kind: 'aura', power: 1, aura: { aps: 8 }, tags: ['nature'], desc: 'While slotted, the party has +{a}% Attack Speed.' }),
  K({ id: 'berserk', name: 'Berserk', icon: '😡', unlock: 45, cd: 20, kind: 'buff', buffs: { dmg: 0.5, aps: 0.25 }, power: 1, dur: 6, tags: ['phys'], desc: '+{m}% more Damage and +{a}% Attack Speed for {d}s.' }),
  K({ id: 'barrier', name: 'Barrier', icon: '🫧', unlock: 48, cd: 16, kind: 'shield', party: true, power: 0.25, dur: 6, tags: ['holy'], desc: 'Shield the party for {p}% of max Life for {d}s.' }),
  K({ id: 'blizzard', name: 'Blizzard', icon: '🌨️', unlock: 50, cd: 12, kind: 'hit', power: 0.5, hits: 8, ele: true, tags: ['cold'], applies: { chill: 4 }, fx: 'storm', desc: '8 icy shards of {p}% hit damage.' }),
  K({ id: 'firestorm', name: 'Firestorm', icon: '🔥', unlock: 55, cd: 14, kind: 'hit', power: 0.45, hits: 10, ele: true, tags: ['fire'], applies: { burn: 0.1 }, fx: 'storm', desc: '10 fire bolts of {p}% hit damage.' }),
  K({ id: 'renewalaura', name: 'Aura of Renewal', icon: '💗', unlock: 58, kind: 'aura', power: 1, aura: { regenPct: 0.8 }, tags: ['nature'], desc: 'While slotted, the party regenerates {a}% Life per second.' }),
  K({ id: 'meteor', name: 'Meteor', icon: '🌠', unlock: 60, cd: 15, kind: 'hit', power: 8, ele: true, tags: ['fire'], applies: { burn: 0.5 }, desc: 'Deal {p}% hit damage.' }),
  K({ id: 'thunderclap', name: 'Thunderclap', icon: '🌩️', unlock: 65, cd: 15, kind: 'hit', power: 5, ele: true, tags: ['lightning'], applies: { shock: 0.2 }, vs: { shock: 0.4 }, fx: 'storm', desc: 'Deal {p}% hit damage.' }),
  K({ id: 'plague', name: 'Plague', icon: '🦠', unlock: 70, cd: 16, kind: 'hit', power: 0.5, tags: ['poison'], applies: { poison: 10 }, fx: 'smoke', desc: 'Deal {p}% hit damage.' }),
  K({ id: 'execute', name: 'Execute', icon: '⚰️', unlock: 75, cd: 10, kind: 'hit', power: 3, tags: ['phys'], lowHp: 3, fx: 'shadowstrike', desc: 'Deal {p}% hit damage, +300% if the enemy is below 30% Life.' }),
  K({ id: 'undying', name: 'Undying Rage', icon: '🔥', unlock: 80, cd: 30, kind: 'buff', stat: 'dmg', power: 1.0, dur: 5, tags: ['phys'], desc: '+{p}% more Damage for {d}s.' }),
  K({ id: 'rally', name: 'Rallying Shout', icon: '🚩', unlock: 85, cd: 20, kind: 'buff', party: true, stat: 'dmg', power: 0.3, dur: 6, tags: ['holy'], fx: 'warcry', desc: 'The whole party deals +{p}% more Damage for {d}s.' }),

  // ---- Class skills ----
  K({ id: 'arc', cls: 'witch', name: 'Arc', icon: '🌩️', unlock: 12, cd: 5, kind: 'hit', power: 1.3, hits: 3, ele: true, tags: ['lightning'], applies: { shock: 0.15 }, fx: 'arc', desc: 'Lightning chains for 3 hits of {p}% hit damage.' }),
  K({ id: 'storm', cls: 'witch', name: 'Elemental Storm', icon: '🌪️', unlock: 35, cd: 14, kind: 'hit', power: 0.9, hits: 8, ele: true, tags: ['lightning', 'cold'], applies: { shock: 0.1, chill: 3 }, fx: 'storm', desc: 'A storm strikes 8 times for {p}% hit damage.' }),
  K({ id: 'shadowstrike', cls: 'shadow', name: 'Shadow Strike', icon: '🗡️', unlock: 12, cd: 6, kind: 'hit', power: 5, alwaysCrit: 1, tags: ['shadow', 'phys'], applies: { poison: 2 }, fx: 'shadow', desc: 'Teleport behind the enemy for {p}% hit damage. Always a Critical Strike.' }),
  K({ id: 'smoke', cls: 'shadow', name: 'Smoke Bomb', icon: '💨', unlock: 35, cd: 16, kind: 'buff', buffs: { evade: 0.25, dmg: 0.2 }, power: 1, dur: 5, tags: ['shadow'], desc: '+{e}% chance to Evade and +{m}% more Damage for {d}s.' }),
  K({ id: 'rain', cls: 'ranger', name: 'Rain of Arrows', icon: '🏹', unlock: 12, cd: 7, kind: 'hit', power: 1.2, hits: 7, tags: ['phys'], applies: { bleed: 0.05 }, fx: 'rain', desc: 'Arrows rain down: 7 hits of {p}% hit damage.' }),
  K({ id: 'mark', cls: 'ranger', name: "Hunter's Mark", icon: '🎯', unlock: 35, cd: 12, kind: 'hit', power: 2.5, baseExpose: 0.3, exposeDur: 6, tags: ['phys'], fx: 'mark', desc: 'Deal {p}% hit damage and mark the enemy: it takes 30% more damage for 6s.' }),
  K({ id: 'riposte', cls: 'duelist', name: 'Riposte', icon: '⚔️', unlock: 12, cd: 6, kind: 'hit', power: 3, baseHeal: 0.06, tags: ['phys'], applies: { bleed: 0.3 }, fx: 'riposte', desc: 'Counter for {p}% hit damage and heal 6% of max Life.' }),
  K({ id: 'bloodrush', cls: 'duelist', name: 'Blood Rush', icon: '🩸', unlock: 35, cd: 18, kind: 'buff', buffs: { leech: 4, aps: 0.25 }, power: 1, dur: 6, tags: ['phys'], desc: '+{l}% Life Leech and +{a}% Attack Speed for {d}s.' }),
  K({ id: 'quake', cls: 'marauder', name: 'Earthquake', icon: '🌋', unlock: 12, cd: 12, kind: 'freeze', power: 4, dur: 1.5, stun: true, tags: ['phys'], applies: { weaken: 0.15 }, fx: 'quake', desc: 'Slam the ground for {p}% hit damage and Stun for {d}s.' }),
  K({ id: 'unbreakable', cls: 'marauder', name: 'Unbreakable', icon: '🪨', unlock: 35, cd: 18, kind: 'buff', buffs: { dr: 0.4 }, power: 1, dur: 6, tags: ['phys'], desc: 'Take {r}% less damage for {d}s.' }),
  K({ id: 'holylight', cls: 'templar', name: 'Holy Light', icon: '✨', unlock: 12, cd: 9, kind: 'heal', party: true, power: 0.25, tags: ['holy'], desc: 'Heal the whole party for {p}% of their max Life.' }),
  K({ id: 'divshield', cls: 'templar', name: 'Divine Shield', icon: '🛡️', unlock: 35, cd: 20, kind: 'shield', party: true, power: 0.4, dur: 6, tags: ['holy'], desc: 'Shield the whole party for {p}% of their max Life for {d}s.' }),
  K({ id: 'rejuv', cls: 'druid', name: 'Rejuvenation', icon: '🌱', unlock: 12, cd: 8, kind: 'heal', party: true, power: 0.15, regen: 0.04, dur: 6, tags: ['nature'], desc: 'Heal the party for {p}% of max Life, then 4% per second for {d}s.' }),
  K({ id: 'entangle', cls: 'druid', name: 'Entangle', icon: '🌿', unlock: 35, cd: 12, kind: 'freeze', power: 1.5, dur: 2.5, stun: true, tags: ['nature'], applies: { poison: 3 }, fx: 'quake', desc: 'Thorny roots deal {p}% hit damage and hold the enemy for {d}s.' }),

  // ---- Tree skills: unlocked by allocating their node on the passive tree ----
  K({ id: 'arcanecomet', tree: true, name: 'Arcane Comet', icon: '☄️', cd: 11, kind: 'hit', power: 7, ele: true, tags: ['fire', 'cold'], applies: { burn: 0.4, chill: 3 }, fx: 'meteor', desc: 'Call down a comet for {p}% hit damage.' }),
  K({ id: 'manastorm', tree: true, name: 'Mana Storm', icon: '🌀', cd: 14, kind: 'hit', power: 0.45, hits: 12, ele: true, tags: ['lightning'], applies: { shock: 0.2 }, fx: 'storm', desc: '12 arcane bolts of {p}% hit damage.' }),
  K({ id: 'deathblossom', tree: true, name: 'Death Blossom', icon: '🌸', cd: 14, kind: 'hit', power: 1, tags: ['poison', 'shadow'], applies: { poison: 15 }, fx: 'smoke', desc: 'Deal {p}% hit damage.' }),
  K({ id: 'shadowclone', tree: true, name: 'Shadow Clone', icon: '👥', cd: 22, kind: 'buff', buffs: { dmg: 0.4, aps: 0.3 }, power: 1, dur: 8, tags: ['shadow'], desc: '+{m}% more Damage and +{a}% Attack Speed for {d}s.' }),
  K({ id: 'volley', tree: true, name: 'Volley', icon: '🎯', cd: 10, kind: 'hit', power: 0.7, hits: 10, tags: ['phys'], applies: { bleed: 0.05 }, fx: 'rain', desc: '10 arrows of {p}% hit damage.' }),
  K({ id: 'focusaura', tree: true, name: 'Aura of Focus', icon: '👁️', kind: 'aura', power: 1, aura: { critChance: 40, critMulti: 20 }, tags: ['phys'], desc: 'While slotted, the party has +{a}% Crit Chance and more Crit Multiplier.' }),
  K({ id: 'wildbloom', tree: true, name: 'Wild Bloom', icon: '🌺', cd: 14, kind: 'heal', party: true, power: 0.3, regen: 0.04, dur: 6, tags: ['nature'], desc: 'Heal the party for {p}% of max Life, then 4% per second for {d}s.' }),
  K({ id: 'thornwall', tree: true, name: 'Thornwall', icon: '🌵', cd: 16, kind: 'shield', party: true, power: 0.3, dur: 6, tags: ['nature'], applies: { weaken: 0.2 }, desc: 'Shield the party for {p}% of max Life for {d}s.' }),
  K({ id: 'bladestorm', tree: true, name: 'Bladestorm', icon: '⚔️', cd: 12, kind: 'hit', power: 0.8, hits: 8, tags: ['phys'], applies: { bleed: 0.2 }, fx: 'flurry', desc: '8 whirling hits of {p}% hit damage.' }),
  K({ id: 'parry', tree: true, name: 'Perfect Parry', icon: '🤺', cd: 14, kind: 'buff', buffs: { dr: 0.5, dmg: 0.2 }, power: 1, dur: 4, tags: ['phys'], desc: 'Take {r}% less damage and deal +{m}% more for {d}s.' }),
  K({ id: 'earthshatter', tree: true, name: 'Earthshatter', icon: '🪨', cd: 16, kind: 'freeze', power: 6, dur: 2, stun: true, tags: ['phys'], applies: { weaken: 0.2 }, fx: 'quake', desc: 'Deal {p}% hit damage and Stun for {d}s.' }),
  K({ id: 'bloodrage', tree: true, name: 'Bloodrage', icon: '💢', cd: 22, kind: 'buff', buffs: { dmg: 0.5, leech: 3 }, power: 1, dur: 8, tags: ['phys'], desc: '+{m}% more Damage and +{l}% Life Leech for {d}s.' }),
  K({ id: 'judgement', tree: true, name: 'Judgement', icon: '⚖️', cd: 12, kind: 'hit', power: 5, ele: true, partyHeal: 0.1, tags: ['holy'], fx: 'smite', desc: 'Deal {p}% hit damage and heal the party for 10% of max Life.' }),
  K({ id: 'sanctuary', tree: true, name: 'Sanctuary', icon: '⛪', cd: 20, kind: 'buff', party: true, buffs: { dr: 0.3 }, power: 1, dur: 6, tags: ['holy'], desc: 'The whole party takes {r}% less damage for {d}s.' }),
];
export const SKILL_BY_ID = Object.fromEntries(SKILLS.map((s) => [s.id, s]));
export const MAX_SKILL_RANK = 20;
export const SKILL_SLOTS = 8;
export const skillSlots = () => SKILL_SLOTS;

// Human-readable synergy lines for a skill
export function synergyLines(sk) {
  const out = [];
  for (const [k, v] of Object.entries(sk.applies || {})) {
    const st = STATUS[k];
    if (k === 'burn' || k === 'bleed') out.push(`Applies ${st.icon} ${st.name} (${Math.round(v * 100)}% of the hit per second)`);
    else if (k === 'poison') out.push(`Applies ${v} ${st.icon} Poison stack${v > 1 ? 's' : ''}`);
    else if (k === 'chill') out.push(`Applies ${st.icon} Chill for ${v}s (enemy attacks 30% slower)`);
    else if (k === 'shock' || k === 'ruin') out.push(`Applies ${st.icon} ${st.name}: enemy takes ${Math.round(v * 100)}% more damage`);
    else if (k === 'weaken') out.push(`Applies ${st.icon} Weaken: enemy deals ${Math.round(v * 100)}% less damage`);
  }
  for (const [k, v] of Object.entries(sk.vs || {})) out.push(`+${Math.round(v * 100)}% damage vs ${STATUS[k].icon} ${STATUS[k].name === 'Chill' ? 'Chilled or Frozen' : STATUS[k].name + (k === 'bleed' ? 'ing' : k === 'burn' ? 'ing' : 'ed')} enemies`);
  if (sk.consume) out.push(`Consumes ${STATUS[sk.consume].icon} ${STATUS[sk.consume].name}`);
  if (sk.ele) out.push('Extra effect from Elemental damage');
  if (sk.tree) out.push('🌳 Tree skill');
  return out;
}

// Each rank: +10% effect, and -2% cooldown
export const rankMult = (rank) => 1 + 0.1 * (rank - 1);
export const skillCd = (sk, rank) => sk.cd * Math.max(0.6, 1 - 0.02 * (rank - 1));
export const skillPower = (sk, rank) => sk.power * rankMult(rank);
export const skillUpgradeCost = (rank, level) => ({
  shards: Math.ceil(20 * Math.pow(rank, 1.6)),
  gold: Math.ceil(30 * S(Math.max(1, level)) * rank),
});

export function skillDesc(sk, rank) {
  const p = skillPower(sk, rank);
  const pct = sk.kind === 'hit' || sk.kind === 'freeze' || sk.kind === 'heal' || sk.kind === 'shield' || sk.kind === 'buff' ? Math.round(p * 100) : p;
  return sk.desc.replace('{p}', pct).replace('{d}', sk.dur) + ` Cooldown ${skillCd(sk, rank).toFixed(1)}s.`;
}

export const unlockedSkills = (level, cls) => SKILLS.filter((s) => !s.tree && level >= s.unlock && (!s.cls || s.cls === cls));
export const skillsFor = (cls) => SKILLS.filter((s) => !s.cls || s.cls === cls);

// ---- Skill upgrades: at ranks 5, 10 and 15 choose one of two modifiers ----
export const MILESTONES = [5, 10, 15];
const MODS = {
  hit: [
    [{ id: 'pow', name: 'Added Power', desc: '+40% damage', e: { pow: 0.4 } },
     { id: 'cd', name: 'Faster Casting', desc: '25% shorter cooldown', e: { cd: 0.25 } }],
    [{ id: 'critm', name: 'Brutal Crits', desc: '+75% Crit Multiplier for this skill', e: { critm: 75 } },
     { id: 'siphon', name: 'Siphon', desc: 'Heal for 10% of the damage dealt', e: { leech: 10 } }],
    [{ id: 'echo', name: 'Echo', desc: 'Casts twice', e: { twice: 1 } },
     { id: 'expose', name: 'Expose', desc: 'Enemy takes 25% more damage from you for 5s', e: { expose: 0.25, exposeDur: 5 } }],
  ],
  buff: [
    [{ id: 'empower', name: 'Empower', desc: '+40% effect', e: { pow: 0.4 } },
     { id: 'extend', name: 'Extend', desc: '+60% duration', e: { dur: 0.6 } }],
    [{ id: 'cd', name: 'Swift Recovery', desc: '25% shorter cooldown', e: { cd: 0.25 } },
     { id: 'rally', name: 'Rally', desc: 'Also heals 15% of max Life', e: { heal: 0.15 } }],
    [{ id: 'overcharge', name: 'Overcharge', desc: '+60% effect', e: { pow: 0.6 } },
     { id: 'perma', name: 'Permanence', desc: '+100% duration', e: { dur: 1 } }],
  ],
  heal: [
    [{ id: 'greater', name: 'Greater Heal', desc: '+40% healing', e: { pow: 0.4 } },
     { id: 'cd', name: 'Quick Hands', desc: '25% shorter cooldown', e: { cd: 0.25 } }],
    [{ id: 'early', name: 'Early Trigger', desc: 'Triggers below 80% Life instead of 60%', e: { thresh: 0.8 } },
     { id: 'retaliate', name: 'Retaliation', desc: '+30% more Damage for 4s after healing', e: { dmgBuff: 0.3 } }],
    [{ id: 'overheal', name: 'Overheal', desc: 'Also grants a shield of 20% max Life', e: { shield: 0.2 } },
     { id: 'secondwind', name: 'Second Wind', desc: '40% shorter cooldown', e: { cd: 0.4 } }],
  ],
  shield: [
    [{ id: 'thick', name: 'Thick Shell', desc: '+40% absorb', e: { pow: 0.4 } },
     { id: 'extend', name: 'Lasting Shell', desc: '+60% duration', e: { dur: 0.6 } }],
    [{ id: 'cd', name: 'Quick Shell', desc: '25% shorter cooldown', e: { cd: 0.25 } },
     { id: 'fury', name: 'Molten Fury', desc: '+25% more Damage while shielded', e: { shieldDmg: 0.25 } }],
    [{ id: 'bastion', name: 'Bastion', desc: '+60% absorb', e: { pow: 0.6 } },
     { id: 'phoenix', name: 'Phoenix', desc: 'Also heals 15% of max Life', e: { heal: 0.15 } }],
  ],
  freeze: [
    [{ id: 'deep', name: 'Deep Freeze', desc: '+1.5s Freeze duration', e: { durFlat: 1.5 } },
     { id: 'shatter', name: 'Shatter', desc: '+60% damage', e: { pow: 0.6 } }],
    [{ id: 'cd', name: 'Cold Snap', desc: '25% shorter cooldown', e: { cd: 0.25 } },
     { id: 'brittle', name: 'Brittle', desc: 'Frozen enemies take 30% more damage from you', e: { brittle: 0.3 } }],
    [{ id: 'echo', name: 'Glacial Echo', desc: 'Casts twice', e: { twice: 1 } },
     { id: 'perma', name: 'Permafrost', desc: 'Bosses are frozen for the full duration', e: { bossFull: 1 } }],
  ],
  debuff: [
    [{ id: 'pow', name: 'Deep Curse', desc: '+40% curse strength', e: { pow: 0.4 } },
     { id: 'cd', name: 'Quick Hex', desc: '25% shorter cooldown', e: { cd: 0.25 } }],
    [{ id: 'dur', name: 'Lingering', desc: '+60% duration', e: { dur: 0.6 } },
     { id: 'hit', name: 'Hexblast', desc: 'Also deals 150% hit damage', e: { hitAlso: 1.5 } }],
    [{ id: 'pow2', name: 'Doom', desc: '+60% curse strength', e: { pow: 0.6 } },
     { id: 'cd2', name: 'Swift Hex', desc: '40% shorter cooldown', e: { cd: 0.4 } }],
  ],
  aura: [
    [{ id: 'pow', name: 'Potency', desc: '+30% aura effect', e: { pow: 0.3 } },
     { id: 'life', name: 'Vigour', desc: '+20% effect and party +5% Life', e: { pow: 0.2, auraLife: 5 } }],
    [{ id: 'pow2', name: 'Resonance', desc: '+30% aura effect', e: { pow: 0.3 } },
     { id: 'regen', name: 'Wellspring', desc: '+20% effect and party regen 0.3%/s', e: { pow: 0.2, auraRegen: 0.3 } }],
    [{ id: 'pow3', name: 'Dominion', desc: '+40% aura effect', e: { pow: 0.4 } },
     { id: 'res', name: 'Warding', desc: '+25% effect and party +5% Resistance', e: { pow: 0.25, auraRes: 5 } }],
  ],
};
export const skillMods = (sk) => MODS[sk.kind];
export const respecModCost = (rank) => ({ shards: Math.ceil(30 * rank), gold: 0 });

// Combined effect of rank + chosen modifiers
export function skillEffective(sk, rank, picks = []) {
  const e = { pow: 0, cd: 0, dur: 0, durFlat: 0, critm: 0, leech: 0, twice: 0, expose: 0, exposeDur: 0, heal: 0, thresh: 0.6, dmgBuff: 0, shield: 0, shieldDmg: 0, brittle: 0, bossFull: 0, hitAlso: 0, auraLife: 0, auraRegen: 0, auraRes: 0 };
  MILESTONES.forEach((m, i) => {
    const pick = picks[i];
    if (pick == null || rank < m) return;
    const mod = MODS[sk.kind][i][pick];
    for (const [k, v] of Object.entries(mod.e)) {
      if (k === 'thresh') e.thresh = v; else e[k] += v;
    }
  });
  e.heal += sk.baseHeal || 0;
  if (sk.baseExpose) { e.expose += sk.baseExpose; e.exposeDur = Math.max(e.exposeDur, sk.exposeDur); }
  return {
    ...e,
    alwaysCrit: !!sk.alwaysCrit,
    power: skillPower(sk, rank) * (1 + e.pow),
    cooldown: (sk.cd ? skillCd(sk, rank) : 0) * (1 - Math.min(0.6, e.cd)),
    rankMult: rankMult(rank) * (1 + e.pow),
    duration: (sk.dur || 0) * (1 + e.dur) + e.durFlat,
    hits: (sk.hits || 1),
    casts: 1 + e.twice,
  };
}

export function skillDescFull(sk, rank, picks) {
  const ef = skillEffective(sk, rank, picks);
  const p = Math.round(ef.power * 100);
  const b = sk.buffs || {};
  const pct = (v) => Math.round(v * ef.power * 100);
  const aMain = sk.aura ? +(Object.values(sk.aura)[0] * ef.power).toFixed(1) : 0;
  return sk.desc.replace('{p}', p).replace('{d}', +ef.duration.toFixed(1)).replace('{a}', aMain)
    .replace('{e}', pct(b.evade || 0)).replace('{m}', pct(b.dmg || 0)).replace('{a}', pct(b.aps || 0)).replace('{l}', +((b.leech || 0) * ef.power).toFixed(1)).replace('{r}', pct(b.dr || 0))
    + (sk.kind === 'aura' ? ' Always active.' : ` Cooldown ${ef.cooldown.toFixed(1)}s.`);
}
