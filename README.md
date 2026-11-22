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
- **6 classes:** Witch, Shadow, Ranger, Duelist, Marauder, Templar. Each has its own bonuses and starting spot on the tree.
- **Passive tree:** 214 nodes in a PoE-style web: wheels you can enter from several sides, loops, bridge notables between classes and an outer ring. It has 36 notables and **8 keystones** that change the rules (Resolute Technique, Iron Reflexes, Acrobatics, Assassin's Mark, Elemental Overload, Divine Bulwark, Vaal Pact, Glass Cannon). Drag/pinch to navigate, tap to allocate a whole path, refund single nodes. Points are capped late game (1/level to 100, then 1 per 4 levels), so you have to commit to a build. There's an *Auto* button if you'd rather not plan.
- **Active skills:** 10 skills (strikes, Fireball, War Cry, Blood Rite, Molten Shell, Blade Flurry, Frost Nova, Haste, Meteor, Undying Rage) that cast themselves on cooldown. Unlock by level, slot 2–4 in your bar, rank up to R20 with shards. At ranks 5, 10 and 15 each skill offers a choice of two upgrades (e.g. Echo vs Expose, Brittle vs Cold Snap), so the same skill can be built different ways.
- **Bosses:** zone bosses every 10 stages enrage after 30s and slam for heavy damage. They drop 🗝️ dungeon keys.
- **Dungeons:** timed runs (5 rooms + a Warden boss, 150s). Rare+ loot, shards, and 🔱 raid sigils.
- **Raids:** a 3-phase boss in 180s, with a guaranteed Legendary, Epic+ drops and a chance at Mythic.
- **Death pushes you back** a stage and you farm until you get stronger (level, upgrade, or passive point) before pushing again.
- **Offline progress:** up to 8 hours, fully simulated.
- Installable PWA that works offline. Saves to the device, with export/import.

## Run locally
Any static server works:
```
python3 -m http.server 8000
```
## Balance sim
`node tools/sim.js 8 marauder` simulates 8 hours of a Marauder (auto tree, upgrades, skills, dungeons, raids) and prints progression.
