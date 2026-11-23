# Pocket Realm

An idle pixel RPG for phones. Play it at **https://sacul86.github.io/exile-idle/**

## What's in it
- **Party:** six heroes to recruit. Up to four fight at once; the rest gather resources.
- **Stage combat:** ten kills per stage and a timed boss every five stages. Hold your finger on the battle to strike and charge Frenzy (double damage and gold for 15s).
- **Hero levels:** each hero gets ×3 power every 25 levels.
- **Skills:** Mining, Woodcutting, Fishing and Foraging are gathered by heroes. Smithing (crafts gear), Cooking (makes auto-eaten food) and Alchemy (makes timed buff potions) use what they gather.
- **Loot:** five rarities and three gear slots per hero, with auto-equip, auto-salvage and item locking.
- **Collection:** 12 pets, achievements with permanent bonuses, and a 20-step guided quest line.
- **Ascension:** from stage 40, reset for Souls and spend them on a permanent upgrade tree.
- **Offline progress:** an itemised "welcome back" report when you return.
- **Sound:** synthesised SFX and biome music. Saves locally, with export and import.

## Development
```
npm install
npm run dev        # local dev server
npm run build      # builds into the repo root (served by GitHub Pages)
npm run sim -- 6   # headless 6-hour balance simulation
npm run atlas      # repack the sprite atlas (needs the DCSS rltiles source)
```
Stack: Phaser 3 (battle scene), Preact (UI), TypeScript and Vite. The source is in `app/`. The built game in the repo root is committed, so **run `npm run build` before pushing**.

## Credits
- Pixel art: [Dungeon Crawl Stone Soup](https://github.com/crawl/tiles) / RLTiles, CC0
- Music: [Ninja Adventure](https://pixel-boy.itch.io/ninja-adventure-asset-pack) by Pixel-boy & AAA, CC0
- Font: Pixelify Sans, SIL OFL
- Engine: Phaser (MIT), Preact (MIT); sound effects made with jsfxr (Unlicense)
