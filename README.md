# Exile Idle: Party of Legends

A mobile-first auto-battle loot RPG that mixes Path of Exile-style character building with Whoa Adventure-style party play. Hand-painted art, a party of three heroes, pets, world bosses, vaults and raids.

**Play:** https://sacul86.github.io/exile-idle/. On your phone, use *Add to Home Screen* to install it like an app.

## The party
- **Tank, Healer, DPS.** Monsters attack your tank. Boss slams hit everyone, so your healer has to keep up. If the whole party goes down you drop back a stage.
- **7 classes:** Warrior and Gladiator (tanks), Templar and Druid (healers), Mage, Assassin and Ranger (DPS).
- Each hero has their **own gear, passive tree, skills and class passives**. Every drop goes to whichever hero it helps most.

## Character building
- **Passive tree:** 249 nodes in a web of wheels, loops, bridges between classes and an outer ring, with 9 rule-changing keystones (Unwavering Strike, Iron Hide, Wind Dancer, Death's Mark, Elemental Conversion, Divine Bulwark, Lifebloom, Blood Pact, Glass Cannon). Points are capped late game, so you have to commit to a build.
- **Class passives:** pick 1 of 2 at levels 15, 40 and 75.
- **Skills:** generic and class skills that cast themselves, ranked up to R20, with a choice of 2 upgrades at ranks 5, 10 and 15.
- **Weapon mastery:** 30% more damage with your class's weapons.
- **Armour sets:** a 5-piece set per class with 2/3/5-piece bonuses.
- **Gear:** 10 slots, 6 rarities, item levels, T7–T1 affix tiers, +25 upgrades, reroll and promote crafting, and **12 Mythic uniques** with special powers.

## One-tap optimising
- **⚡ Optimise party / hero:** spends tree points, picks open class passives, equips the best gear from the bag, sets the best skill bar (and open skill-upgrade choices) and switches to the best pet.
- Separate buttons for **Equip best**, **Best skills**, **Best passives** and **Best pet**.
- Optional **Auto-optimise on level-up** setting (Stats tab).

## Content
- 10 zones with painted backgrounds, 30+ monsters and 10 zone bosses (they enrage and slam).
- **Vaults** (timed dungeons) and 3-phase **raids**.
- **World boss invasions** twice a day (12:00 and 20:00 local time): deal as much damage as you can in 90s and earn emblems and Box I/II/III by rank. **Invasion Horns** let you fight outside those times.
- **Emblem shop:** pet eggs, boxes, keys, sigils, horns.
- **Pets:** 9 collectable companions that fight alongside you and buff the party (the Phoenix revives fallen heroes). Level them up with shards.
- Offline progress (up to 8h), installable PWA, save export/import.

## Art pipeline
Art is AI-generated as sprite sheets, then cut up and background-keyed by `tools/art_pipeline.py`. A GitHub Action (`.github/workflows/art.yml`) runs it whenever `art/sources.json` changes.

## Dev
- `python3 -m http.server 8000` to play locally.
- `node tools/sim.js 3 marauder templar witch` simulates 3 hours of that party for balance checks.
