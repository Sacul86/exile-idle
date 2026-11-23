# Delve & Loot

An idle dungeon-diving loot game for phones (portrait PWA), inspired by the Loot Hunters loop. Play at https://sacul86.github.io/exile-idle/

**The loop:** your hero dives floor by floor and auto-fights. Loot fills a limited bag. Die and you drop half of what you're carrying; return to town and you bank it all. Sell, merge 3 of an item into a higher rarity, upgrade gear, buy potions and spells, train, then dive deeper.

- One hero, four looks/fighting styles (Knight, Barbarian, Ranger, Mage)
- 10 dungeons as 10-floor bands of one endless descent, checkpoints every 5 floors, a boss every 10th floor
- Bag + death penalty, smart retreat rules, auto-dive, auto-sell/equip/refill
- Town: potions, 6 spells (auto-cast), 6 trainings, stash and selling
- Forge: merge 3→1 up a rarity, +10 upgrades
- Isometric 3D battles (three.js + KayKit CC0 models) with a drag-anywhere joystick and dodgeable boss telegraphs
- 12h offline progress with a report

## Dev
Vanilla JS ES modules, no build step. `node tools/sim.js <paladin|warrior|ranger|mage> <hours>` runs a headless balance sim.

## Credits
3D characters and scenery: KayKit by Kay Lousberg (CC0) — `assets/3d/KAYKIT-LICENSE.txt`. Rendering: three.js (MIT), bundled in `vendor/`.
