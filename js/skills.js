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
};
export const skillMods = (sk) => MODS[sk.kind];
export const respecModCost = (rank) => ({ shards: Math.ceil(30 * rank), gold: 0 });

// Combined effect of rank + chosen modifiers
export function skillEffective(sk, rank, picks = []) {
  const e = { pow: 0, cd: 0, dur: 0, durFlat: 0, critm: 0, leech: 0, twice: 0, expose: 0, exposeDur: 0, heal: 0, thresh: 0.6, dmgBuff: 0, shield: 0, shieldDmg: 0, brittle: 0, bossFull: 0 };
  MILESTONES.forEach((m, i) => {
    const pick = picks[i];
    if (pick == null || rank < m) return;
    const mod = MODS[sk.kind][i][pick];
    for (const [k, v] of Object.entries(mod.e)) {
      if (k === 'thresh') e.thresh = v; else e[k] += v;
    }
  });
  return {
    ...e,
    power: skillPower(sk, rank) * (1 + e.pow),
    cooldown: skillCd(sk, rank) * (1 - Math.min(0.6, e.cd)),
    duration: (sk.dur || 0) * (1 + e.dur) + e.durFlat,
    hits: (sk.hits || 1),
    casts: 1 + e.twice,
  };
}

export function skillDescFull(sk, rank, picks) {
  const ef = skillEffective(sk, rank, picks);
  const p = Math.round(ef.power * 100);
  return sk.desc.replace('{p}', p).replace('{d}', +ef.duration.toFixed(1)) + ` Cooldown ${ef.cooldown.toFixed(1)}s.`;
}
