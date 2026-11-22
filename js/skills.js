// Active skills: auto-cast on cooldown. Unlock by level, rank up with shards.
import { S } from './data.js';

// kind: hit (damage burst), buff, heal, shield, freeze
export const SKILLS = [
  { id: 'cleave',   name: 'Cleave',         icon: '🌀', unlock: 1,  cd: 4,  kind: 'hit',    power: 2.5, desc: 'Deal {p}% of your hit damage.' },
  { id: 'fireball', name: 'Fireball',       icon: '☄️', unlock: 5,  cd: 5,  kind: 'hit',    power: 3.2, ele: true, desc: 'Deal {p}% of your hit damage. Double effect from Elemental damage.' },
  { id: 'warcry',   name: 'War Cry',        icon: '📯', unlock: 10, cd: 15, kind: 'buff',   stat: 'dmg', power: 0.35, dur: 6, desc: '+{p}% more Damage for {d}s.' },
  { id: 'bloodrite',name: 'Blood Rite',     icon: '💉', unlock: 15, cd: 12, kind: 'heal',   power: 0.3, desc: 'Heal {p}% of max Life when below 60% Life.' },
  { id: 'molten',   name: 'Molten Shell',   icon: '🔶', unlock: 20, cd: 18, kind: 'shield', power: 0.35, dur: 8, desc: 'Absorb damage equal to {p}% of max Life for {d}s.' },
  { id: 'flurry',   name: 'Blade Flurry',   icon: '🗡️', unlock: 25, cd: 8,  kind: 'hit',    power: 0.75, hits: 6, desc: '6 rapid hits of {p}% hit damage.' },
  { id: 'frostnova',name: 'Frost Nova',     icon: '❄️', unlock: 30, cd: 14, kind: 'freeze', power: 1.5, dur: 2.5, desc: 'Deal {p}% hit damage and Freeze the enemy for {d}s.' },
  { id: 'haste',    name: 'Haste',          icon: '⚡', unlock: 40, cd: 16, kind: 'buff',   stat: 'aps', power: 0.4, dur: 6, desc: '+{p}% Attack Speed for {d}s.' },
  { id: 'meteor',   name: 'Meteor',         icon: '🌠', unlock: 60, cd: 15, kind: 'hit',    power: 9, ele: true, desc: 'Deal {p}% of your hit damage. Double effect from Elemental damage.' },
  { id: 'undying',  name: 'Undying Rage',   icon: '😤', unlock: 80, cd: 30, kind: 'buff',   stat: 'dmg', power: 1.0, dur: 5, desc: '+{p}% more Damage for {d}s.' },
];
export const SKILL_BY_ID = Object.fromEntries(SKILLS.map((s) => [s.id, s]));
export const MAX_SKILL_RANK = 20;
export const skillSlots = (level) => (level >= 50 ? 4 : level >= 20 ? 3 : 2);

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

export const unlockedSkills = (level) => SKILLS.filter((s) => level >= s.unlock);
