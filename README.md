# Eternal Ascent

A single-player, solo-hero fantasy auto-battler for phones (portrait PWA). Play at https://sacul86.github.io/exile-idle/

No pay-to-win, no energy, no loot boxes, no guilds, no required events or login streaks. Every activity can be repeated any time.

## What's in it
- **5 classes × 3 specs**: Warrior (Berserker, Warlord, Guardian), Mage (Pyromancer, Frostweaver, Arcanist), Ranger (Deadeye, Beastmaster, Shadowhunter), Warlock (Necromancer, Soul Reaper, Demonologist), Paladin (Templar, Inquisitor, Crusader). Cheap respec, free before level 30.
- **Attributes** (STR, INT, DEX, VIT, WIS) with free resets; **3 talent trees per class**.
- **6 skill slots** (Primary, Defensive, AoE, Secondary, Utility, Ultimate) from 90 skills, with ranks and Awakening, plus **automation rules** (heal threshold, ultimate usage, target priority, AoE count, save defensives for telegraphs).
- **12 gear slots, 7 rarities** (Common to Ancient), unique affixes, and non-destructive upgrades: Enhance, Refine, Enchant, Socket, Awaken. Loot comparisons, locks, filters and auto-salvage rules.
- **Gems** (6 types, 6 tiers, combine 3→1), **runes**, **6 inscription slots** with set bonuses.
- **Companions**: 1 active + 2 passive, levelling and evolving.
- **10 regions × 10 stages**, elites with modifiers, multi-phase region bosses with readable telegraphs.
- **Activities**: Equipment Dungeons (5 themed dungeons targeting gear slots), Crystal Caverns, Boss Rush, Treasure Vault, Endless Tower, Rift Challenges.
- **Crafting** with materials and recipes (e.g. Dragonbane).
- **Endgame**: Mastery after level 80, World Tiers (Normal to Apocalypse), Ascension with permanent perks.
- **Offline progress** up to 12h, with a report showing what was simulated.
- **Accessibility**: combat speed, damage-number density, screen shake, effects, sound, text size, colour-safe statuses.

## Dev
Vanilla JS ES modules, no build step. Serve the folder (`python3 -m http.server`).
`node tools/sim.js <class> <hours>` runs a headless balance sim. Art sheets are listed in `art/sources.json` and processed by the GitHub Action in `.github/workflows/art.yml`.
