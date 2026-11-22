# Exile Idle

A mobile-first auto-battle loot RPG inspired by Path of Exile. Your Exile fights, loots and equips upgrades on its own; you make the build decisions.

**Play:** https://sacul86.github.io/exile-idle/ (after GitHub Pages is on). On your phone, use *Add to Home Screen* to install it like an app.

## What's in it
- **Auto battle** through endless stages: 10 per zone, a boss every 10th stage, elite monsters, and a PoE-style resistance penalty as you go deeper.
- **Auto loot / auto equip:** every drop is scored against your current build (DPS × effective HP against the stage you're on) and equipped if it's better. Rings compare against your weaker ring.
- **Auto salvage** filter for low-rarity junk, turning it into 💠 shards and gold.
- **Gear:** 10 slots (weapon, off-hand, helmet, chest, gloves, boots, belt, amulet, 2 rings).
- **Rarity tiers:** Common, Magic, Rare, Epic, Legendary, Mythic.
- **Item level** controls the base type (8 tiers per slot) and which affix tiers can roll (T7–T1).
- **Gear levels:** upgrade items +1 at a time (max +5 Common up to +25 Mythic).
- **Stats:** 19 prefix/suffix mods: flat/% physical and elemental damage, attack speed, crit, life, armour, evasion, resistances, regen, life on hit, leech, block, gold find, item rarity, XP.
- **Crafting:** Upgrade, Reroll mods, Promote rarity (up to Legendary), Salvage, Lock.
- **Passive skills:** 1 point per level across 13 nodes.
- **Death pushes you back** a stage and you farm until you get stronger (level, upgrade, or passive point) before pushing again.
- **Offline progress:** up to 8 hours, fully simulated.
- Installable PWA that works offline. Saves to the device, with export/import.

## Run locally
Any static server works:
```
python3 -m http.server 8000
```
## Balance sim
`node tools/sim.js 8` simulates 8 hours of play headlessly and prints progression.
