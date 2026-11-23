// Packs selected DCSS/RLTiles (CC0) sprites into one atlas for Phaser + a CSS sprite sheet for the UI.
// Usage: node tools/atlas.mjs /path/to/crawl/crawl-ref/source/rltiles
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const SRC = process.argv[2] || '/tmp/dc/crawl/crawl-ref/source/rltiles';
const OUT = 'app/public/sprites';
fs.mkdirSync(OUT, { recursive: true });

// key -> relative path, or 'dir/prefix*' to take the first N matches as key0..keyN-1
const M = {
  // heroes
  hero_knight: 'mon/unique/donald.png', hero_ranger: 'mon/unique/joseph.png', hero_mage: 'mon/unique/maggie.png',
  hero_cleric: 'mon/unique/mennas.png', hero_rogue: 'mon/unique/sonja.png', hero_barbarian: 'mon/unique/rupert.png',
  // biome 1 greenwood
  m_rat: 'mon/animals/rat.png', m_jackal: 'mon/animals/jackal.png', m_bat: 'mon/animals/bat.png', m_kobold: 'mon/humanoids/kobold.png', m_adder: 'mon/animals/adder.png', m_bullfrog: 'mon/animals/bullfrog.png', b_bear: 'mon/animals/black_bear.png',
  // 2 mushroom hollow
  m_mushroom: 'mon/fungi_plants/wandering_mushroom.png', m_shambler: 'mon/fungi_plants/fungal_shambler.png', m_deathcap: 'mon/fungi_plants/deathcap.png', m_jelly: 'mon/amorphous/jelly.png', m_slime: 'mon/amorphous/slime_creature.png', b_treant: 'mon/fungi_plants/treant.png',
  // 3 goblin warrens
  m_goblin: 'mon/humanoids/goblin.png', m_hobgoblin: 'mon/humanoids/hobgoblin.png', m_gnoll: 'mon/humanoids/gnoll.png', m_gnollshaman: 'mon/humanoids/gnoll_shaman.png', m_brigand: 'mon/humanoids/kobold_brigand.png', b_ogre: 'mon/humanoids/two_headed_ogre.png',
  // 4 sunken crypt
  m_ghoul: 'mon/undead/ghoul.png', m_mummy: 'mon/undead/mummy.png', m_skeleton: 'mon/undead/skeletal_warrior.png', m_ghost: 'mon/undead/ghost.png', m_skull: 'mon/undead/curse_skull.png', b_lich: 'mon/undead/lich.png',
  // 5 frost peaks
  m_rimedrake: 'mon/dragons/rime_drake.png', m_frostwraith: 'mon/undead/freezing_wraith.png', m_icedevil: 'mon/demons/ice_devil.png', m_whiteimp: 'mon/demons/white_imp.png', m_polarbear: 'mon/animals/polar_bear.png', b_icedragon: 'mon/dragons/ice_dragon.png',
  // 6 ember caves
  m_firebat: 'mon/animals/fire_bat.png', m_firecrab: 'mon/animals/fire_crab.png', m_fireelem: 'mon/nonliving/fire_elemental.png', m_salamander: 'mon/demihumanoids/salamander.png', m_hellhound: 'mon/animals/hell_hound.png', b_firedragon: 'mon/dragons/fire_dragon.png',
  // 7 drowned depths
  m_eel: 'mon/aquatic/electric_eel.png', m_jellyfish: 'mon/aquatic/jellyfish.png', m_octopode: 'mon/aquatic/octopode.png', m_swampworm: 'mon/aquatic/swamp_worm.png', m_rockfish: 'mon/aquatic/rock_fish.png', b_kraken: 'mon/aquatic/kraken_head.png',
  // 8 infernal gate
  m_reddevil: 'mon/demons/red_devil.png', m_hellion: 'mon/demons/hellion.png', m_executioner: 'mon/demons/executioner.png', m_rakshasa: 'mon/demons/rakshasa.png', m_crimsonimp: 'mon/demons/crimson_imp.png', b_balrug: 'mon/demons/balrug.png',
  // 9 starfall ruins
  m_uglything: 'mon/aberrations/ugly_thing.png', m_nameless: 'mon/aberrations/nameless_horror.png', m_tentacled: 'mon/aberrations/tentacled_monstrosity.png', m_brain: 'mon/aberrations/glowing_orange_brain.png', m_unseen: 'mon/aberrations/unseen_horror.png', b_orbguardian: 'mon/aberrations/orb_guardian.png',
  // 10 celestial spire
  m_angel: 'mon/holy/angel.png', m_cherub: 'mon/holy/cherub.png', m_daeva: 'mon/holy/daeva.png', m_apis: 'mon/holy/apis.png', m_ophan: 'mon/holy/ophan.png', b_seraph: 'mon/holy/seraph.png',
  // floors & walls per biome
  f_grass: 'dngn/floor/grass/grass0*', f_moss: 'dngn/floor/moss*', f_orc: 'dngn/floor/orc*', f_crypt: 'dngn/floor/crypt[0-9]*', f_frozen: 'dngn/floor/frozen*', f_volcanic: 'dngn/floor/volcanic_floor*',
  f_swamp: 'dngn/floor/swamp*', f_infernal: 'dngn/floor/infernal[0-9]*', f_crystal: 'dngn/floor/crystal_floor*', f_marble: 'dngn/floor/white_marble*',
  w_brick: 'dngn/wall/brick_brown-vines*', w_lair: 'dngn/wall/lair*', w_orc: 'dngn/wall/orc*', w_crypt: 'dngn/wall/crypt[0-9]*', w_ice: 'dngn/wall/ice_wall*', w_scorched: 'dngn/wall/stone_wall_scorched*',
  w_water: 'dngn/water/deep_water*', w_hell: 'dngn/wall/hell*', w_crystal: 'dngn/wall/crystal_wall_magenta*', w_marble: 'dngn/wall/marble_wall*',
  d_tree: 'dngn/trees/tree*', d_deadtree: 'dngn/trees/dead_tree_of_woe*', d_mangrove: 'dngn/trees/mangrove*', d_fungus: 'mon/fungi_plants/fungus*', d_flower: 'dngn/decor/flower_patch*', d_bush: 'mon/fungi_plants/bush*',
  // weapons: 5 tiers per hero type
  wk: ['item/weapon/short_sword1.png', 'item/weapon/long_sword1.png', 'item/weapon/scimitar2.png', 'item/weapon/greatsword2.png', 'item/weapon/demon_blade.png'],
  wb: ['item/weapon/broad_axe1.png', 'item/weapon/battle_axe1.png', 'item/weapon/executioner_axe1.png', 'item/weapon/bardiche2.png', 'item/weapon/giant_spiked_club3.png'],
  wr: ['item/weapon/ranged/shortbow1.png', 'item/weapon/ranged/shortbow2.png', 'item/weapon/ranged/orcbow1.png', 'item/weapon/ranged/longbow2.png', 'item/weapon/ranged/longbow3.png'],
  wm: ['item/staff/staff00.png', 'item/staff/staff03.png', 'item/staff/i-staff_fire.png', 'item/staff/i-staff_cold.png', 'item/staff/staff-artefact2.png'],
  wc: ['item/weapon/mace1.png', 'item/weapon/morningstar1.png', 'item/weapon/hammer2.png', 'item/weapon/eveningstar2.png', 'item/weapon/mace_large3.png'],
  wo: ['item/weapon/dagger.png', 'item/weapon/athame1.png', 'item/weapon/rapier1.png', 'item/weapon/rapier3.png', 'item/weapon/demon_whip2.png'],
  ar: ['item/armour/leather_armour1.png', 'item/armour/chain_mail1.png', 'item/armour/plate1.png', 'item/armour/crystal_plate.png', 'item/armour/golden_dragon_armour.png'],
  tr: ['item/ring/bronze.png', 'item/amulet/citrine.png', 'item/ring/emerald.png', 'item/amulet/diamond.png', 'item/ring/gold_red.png'],
  // resources
  ore: ['item/gem/orc_found_whole.png', 'item/gem/dungeon_found_whole.png', 'item/gem/slime_found_whole.png', 'item/gem/vaults_found_whole.png', 'item/gem/zot_found_whole.png'],
  log: ['dngn/trees/tree1.png', 'dngn/trees/tree5.png', 'dngn/trees/mangrove1.png', 'dngn/trees/tree10.png', 'dngn/trees/dead_tree_of_woe2.png'],
  fish: ['mon/aquatic/rock_fish.png', 'mon/aquatic/roaming_sludgefish0.png', 'mon/aquatic/electric_eel.png', 'mon/aquatic/jellyfish.png', 'mon/aquatic/octopode.png'],
  herb: ['mon/fungi_plants/plant_01.png', 'mon/fungi_plants/plant_03.png', 'mon/fungi_plants/plant_05.png', 'mon/fungi_plants/plant_07.png', 'mon/fungi_plants/sacred_lotus.png'],
  food: ['item/food/bread_ration.png', 'item/food/meat_ration.png', 'item/food/sausage.png', 'item/food/pizza.png', 'item/food/honeycomb.png'],
  pot: ['item/potion/i-might.png', 'item/potion/i-haste.png', 'item/potion/i-experience.png', 'item/potion/golden.png', 'item/potion/i-heal-wounds.png'],
  gold: 'item/gold/0*',
  // pets
  pet_cat: 'mon/unique/natasha.png', pet_raven: 'mon/animals/raven.png', pet_frog: 'mon/animals/blink_frog.png', pet_wolf: 'mon/animals/wolf.png', pet_yak: 'mon/animals/yak.png',
  pet_drake: 'mon/dragons/swamp_drake.png', pet_hippogriff: 'mon/animals/hippogriff.png', pet_cherub: 'mon/holy/cherub.png', pet_wisp: 'mon/undead/soul_wisp.png', pet_butterfly: 'mon/animals/butterfly3.png',
  pet_turtle: 'mon/animals/snapping_turtle.png', pet_spider: 'mon/animals/jumping_spider.png',
  // effects & skill icons
  fx_flame: 'effect/flame*', fx_frost: 'effect/frost*', fx_arrow: 'effect/arrow0.png', fx_icicle: 'effect/icicle*', fx_light: 'effect/light_beam*', fx_cloudfire: 'effect/cloud_fire*',
  sk_mining: 'gui/skills/earth_magic.png', sk_wood: 'gui/skills/axes.png', sk_fishing: 'gui/skills/polearms.png', sk_foraging: 'gui/skills/poison_magic.png', sk_smithing: 'gui/skills/forgecraft.png',
  sk_cooking: 'gui/skills/fire_magic.png', sk_alchemy: 'gui/skills/transmutations.png', sk_fighting: 'gui/skills/fighting.png',
  ui_chest: 'item/misc/misc_box_of_beasts.png', ui_soul: 'item/misc/orb_of_zot1.png', ui_scroll: 'item/parchment/parchment*', ui_book: 'item/book/gold.png', ui_crystal: 'item/misc/misc_crystal.png',
};

function glob(pat) {
  const dir = path.join(SRC, path.dirname(pat));
  const base = path.basename(pat);
  const re = new RegExp('^' + base.replace(/\./g, '\\.').replace(/\[0-9\]/g, '[0-9]').replace(/\*/g, '.*') + '$');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith('.png') && re.test(f)).sort((a, b) => a.localeCompare(b, 'en', { numeric: true })).map((f) => path.join(dir, f));
}
const entries = [];
for (const [key, v] of Object.entries(M)) {
  if (Array.isArray(v)) v.forEach((p, i) => entries.push([`${key}${i}`, path.join(SRC, p)]));
  else if (v.includes('*')) glob(v).slice(0, 6).forEach((p, i) => entries.push([`${key}${i}`, p]));
  else entries.push([key, path.join(SRC, v)]);
}
const missing = entries.filter(([, p]) => !fs.existsSync(p));
if (missing.length) console.warn('MISSING', missing.map(([k, p]) => k + ' ' + p.replace(SRC, '')).join('\n'));
const ok = entries.filter(([, p]) => fs.existsSync(p));

// shelf-pack with 2px padding
const metas = await Promise.all(ok.map(async ([k, p]) => { const m = await sharp(p).metadata(); return { k, p, w: m.width, h: m.height }; }));
metas.sort((a, b) => b.h - a.h || b.w - a.w);
const W = 1024, PAD = 2;
let x = PAD, y = PAD, rowH = 0;
for (const m of metas) {
  if (x + m.w + PAD > W) { x = PAD; y += rowH + PAD; rowH = 0; }
  m.x = x; m.y = y; x += m.w + PAD; rowH = Math.max(rowH, m.h);
}
const H = Math.pow(2, Math.ceil(Math.log2(y + rowH + PAD)));
const comp = await Promise.all(metas.map(async (m) => ({ input: await sharp(m.p).ensureAlpha().png().toBuffer(), left: m.x, top: m.y })));
await sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite(comp).png({ compressionLevel: 9, palette: false }).toFile(`${OUT}/atlas.png`);
const frames = {};
for (const m of metas) frames[m.k] = { frame: { x: m.x, y: m.y, w: m.w, h: m.h }, rotated: false, trimmed: false, spriteSourceSize: { x: 0, y: 0, w: m.w, h: m.h }, sourceSize: { w: m.w, h: m.h } };
fs.writeFileSync(`${OUT}/atlas.json`, JSON.stringify({ frames, meta: { image: 'atlas.png', size: { w: W, h: H }, scale: 1 } }));
console.log(`packed ${metas.length} sprites into ${W}x${H}`, Math.round(fs.statSync(`${OUT}/atlas.png`).size / 1024) + 'KB');
