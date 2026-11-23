// Isometric 3D battle view (three.js + KayKit CC0 models). Pure presentation: reads state.combat,
// writes only state.input (joystick). A 2D overlay canvas draws numbers, bars, statuses and banners.
import * as THREE from '../vendor/three.bundle.js';
import { CLASSES, COMPANIONS, RARITIES } from './data.js';
import { STATUS, SKILLS } from './skills.js';

const ELEM_COL = { phys: 0xf0e6d2, fire: 0xff7a2b, cold: 0x7ad0ff, lightning: 0xffe36b, arcane: 0xc08bff, shadow: 0xa05ae0, holy: 0xffe9a0, poison: 0x7ad04a, nature: 0x6fe07a };
const hex = (n) => '#' + n.toString(16).padStart(6, '0');
const rand = (a, b) => a + Math.random() * (b - a);
const hash2 = (x, z) => { let h = (x * 374761393 + z * 668265263) >>> 0; h = ((h ^ (h >>> 13)) * 1274126177) >>> 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

// hero model per class: file, weapon nodes to keep visible, tint, attack clip
const HERO = {
  warrior: { file: 'barbarian', keep: ['2H_Axe'], atk: ['2H_Melee_Attack_Chop', '2H_Melee_Attack_Slice'], aoe: '2H_Melee_Attack_Spin' },
  paladin: { file: 'knight', keep: ['1H_Sword', 'Badge_Shield'], atk: ['1H_Melee_Attack_Chop', '1H_Melee_Attack_Slice_Diagonal'], aoe: '2H_Melee_Attack_Spin' },
  ranger: { file: 'rogue_hooded', keep: ['2H_Crossbow'], atk: ['2H_Ranged_Shoot'], aoe: '2H_Ranged_Shoot', ranged: true },
  mage: { file: 'mage', keep: ['2H_Staff'], atk: ['Spellcast_Shoot'], aoe: 'Spellcast_Raise', ranged: true },
  warlock: { file: 'mage', keep: ['2H_Staff', 'Spellbook_open'], atk: ['Spellcast_Shoot'], aoe: 'Spellcast_Raise', ranged: true, tint: 0x9a70c8 },
};
// bosses as oversized, recoloured 3D models: [file, tint, visible weapons, extra skeleton weapons]
const BOSS3D = {
  thornmother: ['barbarian', 0x7ac05a, ['2H_Axe']], rockgolem: ['skel_warrior', 0xa8a49a, [], ['Skeleton_Axe', 'Skeleton_Shield_Large_B']],
  lich: ['skel_mage', 0xffd870, [], ['Skeleton_Staff']], forgetyrant: ['barbarian', 0xff7a4a, ['2H_Axe']], icesovereign: ['mage', 0x9adcff, ['2H_Staff']],
  dragon: ['skel_warrior', 0xd0503a, [], ['Skeleton_Axe']], shadowlord: ['knight', 0x6a4a9a, ['2H_Sword']], kraken: ['skel_rogue', 0x40c8b8, [], ['Skeleton_Blade']],
  voidtitan: ['skel_warrior', 0x9a5ae8, [], ['Skeleton_Axe', 'Skeleton_Shield_Large_B']], eternalone: ['knight', 0xffd060, ['2H_Sword']],
  sungolem: ['skel_warrior', 0xffd040, [], ['Skeleton_Shield_Large_B']],
};
const WEAPONISH = /Sword|Axe|Shield|Wand|Staff|Spellbook|Crossbow|Knife|Throwable|Mug/;
// painted monster -> skeleton variant
const BRUTES = new Set(['troll', 'rockgolem', 'yeti', 'magmagolem', 'sungolem', 'treant', 'ram', 'crabknight', 'dknight', 'demonlord', 'flesh']);
const CASTERS = new Set(['skelmage', 'banshee', 'wisp', 'siren', 'cultist', 'harpy', 'imp', 'angel', 'myconid']);
const SNEAKS = new Set(['bandit', 'ratman', 'spider', 'scorpion', 'serpent', 'leech', 'bat', 'ghoul', 'wraith']);
function enemyModel(artId) {
  if (CASTERS.has(artId)) return { file: 'skel_mage', weapon: 'Skeleton_Staff', scale: 1 };
  if (BRUTES.has(artId)) return { file: 'skel_warrior', weapon: 'Skeleton_Axe', shield: 'Skeleton_Shield_Large_B', scale: 1.35 };
  if (SNEAKS.has(artId)) return { file: 'skel_rogue', weapon: 'Skeleton_Blade', scale: 0.95 };
  return { file: 'skel_minion', weapon: 'Skeleton_Blade', shield: 'Skeleton_Shield_Small_A', scale: 1 };
}

// scene themes keyed by the backdrop id the UI already uses
const T = (o) => o;
const THEMES = {
  crossroads: T({ desat: true, floor: 'outdoor:hex_grass', tint: 0x7ab850, ground: 0x5a8a3a, sky: 0x9fc6e0, fog: 0xa8c8a0, sun: 0xfff2d8, props: ['outdoor:tree_single_A', 'outdoor:tree_single_B', 'outdoor:trees_A_medium', 'outdoor:rock_single_A', 'outdoor:rock_single_C', 'outdoor:tent', 'outdoor:fence_wood_straight', 'outdoor:trees_B_large'] }),
  stones: T({ desat: true, floor: 'outdoor:hex_grass', tint: 0xb8a870, ground: 0x8a8050, sky: 0xc8c0a8, fog: 0xc8c0a0, sun: 0xffe8c0, props: ['outdoor:rock_single_A', 'outdoor:rock_single_E', 'outdoor:hill_single_A', 'outdoor:mountain_A', 'outdoor:building_destroyed', 'outdoor:trees_B_large', 'outdoor:wall_straight'] }),
  necropolis: T({ floor: 'spooky:floor_dirt', tint: 0x9aa088, ground: 0x3a3a2a, sky: 0x2a3030, fog: 0x4a5a48, sun: 0xb8d0c0, props: ['spooky:grave_A', 'spooky:grave_B', 'spooky:gravestone', 'spooky:tree_dead_large', 'spooky:coffin', 'spooky:lantern_standing', 'spooky:post_skull', 'spooky:fence_broken', 'spooky:crypt'] }),
  ironhold: T({ floor: 'dungeon:floor_tile_large', tint: 0xc8906a, ground: 0x3a2418, sky: 0x1a0e08, fog: 0x4a2a18, sun: 0xffb070, props: ['dungeon:column', 'dungeon:torch_lit', 'dungeon:barrel_large', 'dungeon:wall_pillar', 'outdoor:crate_A_big'] }),
  frostfall: T({ desat: true, desatProps: true, floor: 'outdoor:hex_grass', tint: 0xe8f2ff, ground: 0xd8e4f0, sky: 0xc8dcf0, fog: 0xd8e6f4, sun: 0xe8f0ff, props: ['outdoor:tree_single_B', 'outdoor:trees_B_large', 'outdoor:rock_single_C', 'outdoor:mountain_A', 'outdoor:rock_single_E'], propTint: 0xcfe0f4 }),
  hellfire: T({ desat: true, floor: 'outdoor:hex_grass', tint: 0x5a3a30, ground: 0x2a1410, sky: 0x2a0c06, fog: 0x5a2010, sun: 0xff9a60, props: ['outdoor:rock_single_A', 'outdoor:rock_single_E', 'spooky:tree_dead_large', 'spooky:tree_dead_medium', 'outdoor:mountain_A', 'spooky:ribcage'], propTint: 0x6a4038 }),
  prison: T({ floor: 'spooky:floor_dirt', tint: 0x6a5a8a, ground: 0x241a30, sky: 0x140c1c, fog: 0x2a1a3a, sun: 0xb8a0ff, props: ['spooky:grave_A', 'spooky:crypt', 'spooky:tree_dead_large', 'spooky:pillar', 'spooky:arch', 'spooky:shrine_candles', 'spooky:lantern_standing'] }),
  harbour: T({ desat: true, floor: 'outdoor:hex_grass', tint: 0xe8d8a8, ground: 0x3a6a7a, sky: 0x8ab8c8, fog: 0x7aa8b8, sun: 0xe0f0ff, props: ['outdoor:waterplant_A', 'outdoor:barrel', 'outdoor:crate_A_big', 'outdoor:rock_single_A', 'outdoor:building_destroyed'], water: true }),
  rift: T({ floor: 'dungeon:floor_tile_large', tint: 0xb59af0, ground: 0x2a1a40, sky: 0x140a24, fog: 0x3a1a5a, sun: 0xe0c8ff, props: ['dungeon:column', 'spooky:arch', 'spooky:pillar', 'outdoor:rock_single_E'], propTint: 0x9a7ad8 }),
  spire: T({ desat: true, floor: 'dungeon:floor_tile_large', tint: 0xf4e6c4, ground: 0x8a7a5a, sky: 0xf0e0c0, fog: 0xf0e4c8, sun: 0xfff4d0, props: ['dungeon:column', 'dungeon:banner_patternA_white', 'spooky:arch', 'spooky:shrine_candles', 'spooky:pillar'] }),
  dungeon: T({ floor: 'dungeon:floor_tile_large', tint: 0xb0a898, ground: 0x2a2620, sky: 0x100c08, fog: 0x2a2018, sun: 0xffd0a0, props: ['dungeon:column', 'dungeon:torch_lit', 'dungeon:barrier', 'spooky:coffin', 'dungeon:banner_red'] }),
  lair: T({ floor: 'dungeon:floor_tile_small_broken_A', tint: 0x9a6048, ground: 0x2a120a, sky: 0x1a0804, fog: 0x4a1a0a, sun: 0xff9050, props: ['outdoor:rock_single_A', 'outdoor:rock_single_E', 'spooky:ribcage', 'spooky:skull', 'dungeon:torch_lit'] }),
  caverns: T({ floor: 'dungeon:floor_dirt_small_weeds', tint: 0x80c0c0, ground: 0x1a3030, sky: 0x081414, fog: 0x1a4040, sun: 0xa0ffff, props: ['outdoor:rock_single_A', 'outdoor:rock_single_C', 'outdoor:rock_single_E', 'dungeon:torch_lit'], propTint: 0x90d8e0 }),
  pyramid: T({ floor: 'dungeon:floor_tile_large', tint: 0xf0c870, ground: 0x6a5020, sky: 0x2a1a08, fog: 0x5a4010, sun: 0xffe090, props: ['dungeon:chest', 'dungeon:column', 'dungeon:barrel_large', 'dungeon:box_stacked'] }),
  raid: T({ floor: 'dungeon:floor_tile_large', tint: 0xc890b0, ground: 0x2a1020, sky: 0x140810, fog: 0x3a1430, sun: 0xffa0e0, props: ['dungeon:column', 'dungeon:banner_red', 'spooky:arch', 'dungeon:torch_lit'] }),
  tower: T({ floor: 'dungeon:floor_tile_large', tint: 0x98a8c8, ground: 0x1a2030, sky: 0x080c18, fog: 0x18203a, sun: 0xa0c0ff, props: ['dungeon:column', 'dungeon:banner_patternA_white', 'dungeon:torch_lit', 'dungeon:stairs_narrow'] }),
};
const PACKS = ['outdoor', 'spooky', 'dungeon', 'weapons'];
const CHAR_FILES = ['barbarian', 'knight', 'mage', 'rogue_hooded', 'skel_minion', 'skel_warrior', 'skel_rogue', 'skel_mage'];

export class Scene3D {
  constructor() {
    this.ok = false;
    this.wrap = document.createElement('div'); this.wrap.className = 'scene3d';
    try {
      this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    } catch (e) { console.warn('WebGL unavailable', e); return; }
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.wrap.appendChild(this.renderer.domElement);
    this.ov = document.createElement('canvas'); this.ov.className = 'overlay'; this.wrap.appendChild(this.ov);
    this.octx = this.ov.getContext('2d');
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-5, 5, 5, -5, 0.1, 200);
    this.camOff = new THREE.Vector3(14, 13, 14);
    this.camTarget = new THREE.Vector3();
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x404040, 1.1); this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffffff, 1.5);
    this.sun.castShadow = true; this.sun.shadow.mapSize.set(1024, 1024);
    const sc = this.sun.shadow.camera; sc.left = -20; sc.right = 20; sc.top = 20; sc.bottom = -20; sc.near = 1; sc.far = 80;
    this.sun.shadow.bias = -0.0015; this.sun.shadow.normalBias = 0.03;
    this.scene.add(this.sun); this.scene.add(this.sun.target);
    this.groundPlane = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshLambertMaterial({ color: 0x406030 }));
    this.groundPlane.rotation.x = -Math.PI / 2; this.groundPlane.position.y = -0.25; this.groundPlane.receiveShadow = true;
    this.scene.add(this.groundPlane);
    this.floorGroup = new THREE.Group(); this.scene.add(this.floorGroup);
    this.propGroup = new THREE.Group(); this.scene.add(this.propGroup);
    this.fxGroup = new THREE.Group(); this.scene.add(this.fxGroup);
    this.zoneGroup = new THREE.Group(); this.scene.add(this.zoneGroup);
    this.ents = new Map();      // enemy id -> visual
    this.fx = []; this.nums = []; this.banner = null; this.flash = null; this.shake = 0;
    this.models = {}; this.packs = {}; this.clips = {}; this.tex = new Map();
    this.loader = new THREE.GLTFLoader(); this.loader.setMeshoptDecoder(THREE.MeshoptDecoder);
    this.glowTex = this.makeGlow();
    this.t = 0; this.themeKey = null; this.props = new Map(); this.floorCenter = null;
    this.ok = true;
    this.ready = this.loadAll().catch((e) => { console.warn('3D assets failed', e); this.failed = true; });
    this.bindJoystick();
  }
  async loadAll() {
    const load = (f) => new Promise((res, rej) => this.loader.load(`assets/3d/${f}.glb`, res, undefined, rej));
    const [anims, ...rest] = await Promise.all([load('anims'), ...CHAR_FILES.map(load), ...PACKS.map(load)]);
    for (const c of anims.animations) this.clips[c.name] = c;
    CHAR_FILES.forEach((f, i) => { this.models[f] = rest[i].scene; });
    PACKS.forEach((p, i) => {
      const map = {};
      for (const ch of rest[CHAR_FILES.length + i].scene.children) map[ch.name] = ch;
      this.packs[p] = map;
    });
    this.loaded = true;
  }
  makeGlow() {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,255,255,0.6)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  texture(path) {
    let t = this.tex.get(path);
    if (!t) { t = new THREE.TextureLoader().load(path); t.colorSpace = THREE.SRGBColorSpace; this.tex.set(path, t); }
    return t;
  }
  mount(el) {
    if (this.wrap.parentNode !== el) el.prepend(this.wrap);
    this.resize();
  }
  opt(s) { const z = this.S?.zoom; this.S = s || {}; if (z !== this.S.zoom) this.w = 0; }
  resize() {
    const p = this.wrap.parentNode; if (!p) return;
    const r = p.getBoundingClientRect();
    const w = Math.round(r.width), h = Math.round(r.height);
    if (w === this.w && h === this.h) return;
    this.w = w; this.h = h;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.renderer.setPixelRatio(this.S?.effects === 'reduced' ? 1 : dpr);
    this.renderer.setSize(w, h);
    this.ov.width = w * dpr; this.ov.height = h * dpr; this.ov.style.width = w + 'px'; this.ov.style.height = h + 'px'; this.dpr = dpr;
    const view = { near: 6.4, mid: 8.6, far: 10.8 }[this.S?.zoom || 'mid'] || 8.6, asp = w / Math.max(1, h);
    this.camera.left = -view * asp; this.camera.right = view * asp; this.camera.top = view; this.camera.bottom = -view;
    this.camera.updateProjectionMatrix();
  }

  // ---------- characters ----------
  makeChar(file, keep = [], tint = null, extra = []) {
    const src = this.models[file];
    const obj = THREE.cloneSkinned(src);
    obj.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true; o.receiveShadow = false;
        if (WEAPONISH.test(o.name) && !keep.includes(o.name)) o.visible = false;
        o.material = o.material.clone();
        if (tint) o.material.color.multiply(new THREE.Color(tint));
        o.frustumCulled = false;
      }
    });
    for (const [packItem, bone] of extra) {
      const it = this.packs.weapons[packItem]; const b = obj.getObjectByName(bone);
      if (it && b) { const w = it.clone(); w.traverse((o) => { if (o.isMesh) { o.castShadow = true; if (tint) { o.material = o.material.clone(); o.material.color.multiply(new THREE.Color(tint)); } } }); b.add(w); }
    }
    const mixer = new THREE.AnimationMixer(obj);
    const v = { obj, mixer, actions: {}, cur: null, oneShot: null };
    v.play = (name, opts = {}) => {
      const clip = this.clips[name]; if (!clip) return;
      let a = v.actions[name];
      if (!a) { a = mixer.clipAction(clip); v.actions[name] = a; }
      if (opts.once) {
        a.reset(); a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; a.timeScale = opts.speed || 1;
        a.setEffectiveWeight(1); a.fadeIn(0.08); a.play();
        if (v.cur && v.cur !== a) v.cur.fadeOut(0.08);
        v.oneShot = { a, until: this.t + clip.duration / (opts.speed || 1) * 0.92, hold: opts.hold };
        v.cur = a; return;
      }
      if (v.cur === a && !v.oneShot) return;
      a.reset(); a.setLoop(THREE.LoopRepeat, Infinity); a.timeScale = opts.speed || 1; a.fadeIn(0.15); a.play();
      if (v.cur && v.cur !== a) v.cur.fadeOut(0.15);
      v.cur = a; v.oneShot = null;
    };
    return v;
  }
  makeBillboard(dir, name, height, flip = false) {
    const mat = new THREE.SpriteMaterial({ map: this.texture(`assets/${dir}/${name}.webp`), transparent: true, alphaTest: 0.08, depthWrite: true });
    const s = new THREE.Sprite(mat);
    s.center.set(0.5, 0.02);
    const img = mat.map.image;
    const setScale = () => { const asp = img && img.width ? img.width / img.height : 0.8; s.scale.set(height * asp * (flip ? -1 : 1), height, 1); };
    setScale(); if (img && !img.width) img.addEventListener?.('load', setScale);
    mat.map.onUpdate = setScale;
    const g = new THREE.Group(); g.add(s);
    const sh = new THREE.Mesh(new THREE.CircleGeometry(height * 0.22, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false }));
    sh.rotation.x = -Math.PI / 2; sh.position.y = 0.02; g.add(sh);
    return { obj: g, sprite: s, mat, height, billboard: true };
  }

  // ---------- world ----------
  setTheme(key) {
    const th = THEMES[key] || THEMES.crossroads;
    if (key === this.themeKey) return;
    this.themeKey = key; this.theme = th;
    this.scene.background = new THREE.Color(th.sky);
    this.scene.fog = new THREE.Fog(th.fog, 30, 52);
    this.sun.color.set(th.sun); this.hemi.color.set(th.sun); this.hemi.groundColor.set(th.ground);
    this.groundPlane.material.color.set(th.ground);
    this.floorCenter = null;
    for (const p of this.props.values()) this.propGroup.remove(p);
    this.props.clear();
  }
  packItem(ref) { const [p, n] = ref.split(':'); return this.packs[p]?.[n]; }
  buildFloor(cx, cz) {
    const th = this.theme;
    for (const ch of [...this.floorGroup.children]) { this.floorGroup.remove(ch); ch.dispose?.(); }
    const tile = this.packItem(th.floor);
    if (!tile) return;
    tile.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(tile), size = box.getSize(new THREE.Vector3());
    const isHex = th.floor.includes('hex');
    const R = 26, cells = [];
    if (isHex) {
      const w = size.x, d = size.z, pointy = d > w;
      const sx = pointy ? w : w * 0.75, sz = pointy ? d * 0.75 : d;
      const i0 = Math.round(cx / sx), j0 = Math.round(cz / sz), n = Math.ceil(R / Math.min(sx, sz));
      for (let i = i0 - n; i <= i0 + n; i++) for (let j = j0 - n; j <= j0 + n; j++) {
        const x = i * sx + (pointy && j & 1 ? sx / 2 : 0), z = j * sz + (!pointy && i & 1 ? sz / 2 : 0);
        if ((x - cx) ** 2 + (z - cz) ** 2 < R * R) cells.push([x, z, i, j]);
      }
    } else {
      const s = Math.max(size.x, size.z) || 4;
      const i0 = Math.round(cx / s), j0 = Math.round(cz / s), n = Math.ceil(R / s);
      for (let i = i0 - n; i <= i0 + n; i++) for (let j = j0 - n; j <= j0 + n; j++) { const x = i * s, z = j * s; if ((x - cx) ** 2 + (z - cz) ** 2 < R * R) cells.push([x, z, i, j]); }
    }
    const meshes = []; tile.traverse((o) => { if (o.isMesh) meshes.push(o); });
    const tint = new THREE.Color(th.tint), m4 = new THREE.Matrix4(), base = new THREE.Matrix4();
    for (const me of meshes) {
      const mat = recolor(me.material.clone(), th.desat ? th.tint : null); if (!th.desat) mat.color.multiply(tint);
      const im = new THREE.InstancedMesh(me.geometry, mat, cells.length);
      im.receiveShadow = true;
      cells.forEach(([x, z, i, j], k) => {
        const rot = isHex ? 0 : Math.floor(hash2(i, j) * 4) * Math.PI / 2;
        base.makeRotationY(rot).setPosition(x, -box.max.y + 0.001 * (hash2(j, i) - 0.5), z);
        m4.multiplyMatrices(base, me.matrixWorld);
        im.setMatrixAt(k, m4);
        im.setColorAt(k, new THREE.Color().setScalar(0.88 + hash2(i * 7, j * 3) * 0.14));
      });
      this.floorGroup.add(im);
    }
    if (th.water) {
      const water = new THREE.Mesh(new THREE.RingGeometry(R + 1, 60, 48), new THREE.MeshLambertMaterial({ color: 0x2a7a9a, transparent: true, opacity: 0.9 }));
      water.rotation.x = -Math.PI / 2; water.position.set(cx, -0.15, cz); this.floorGroup.add(water);
    }
    this.floorCenter = { x: cx, z: cz };
  }
  updateProps(cx, cz) {
    const th = this.theme, C = 5.5, R = 24;
    const want = new Set();
    for (let i = Math.floor((cx - R) / C); i <= Math.floor((cx + R) / C); i++) for (let j = Math.floor((cz - R) / C); j <= Math.floor((cz + R) / C); j++) {
      const k = i + ',' + j; want.add(k);
      if (this.props.has(k)) continue;
      const r = hash2(i, j);
      let obj = null;
      if (r < (this.theme.floor.startsWith('dungeon') ? 0.16 : 0.3)) {
        const ref = th.props[Math.floor(hash2(j * 13, i * 7) * th.props.length)];
        const src = this.packItem(ref);
        if (src) {
          obj = src.clone();
          const tint = th.propTint ? new THREE.Color(th.propTint) : null;
          obj.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; if (tint) o.material = th.desatProps ? recolor(o.material.clone(), th.propTint) : (() => { const m = o.material.clone(); m.color.multiply(tint); return m; })(); } });
          obj.position.set((i + 0.2 + hash2(i * 3, j) * 0.6) * C, 0, (j + 0.2 + hash2(i, j * 5) * 0.6) * C);
          obj.rotation.y = hash2(i * 11, j * 17) * Math.PI * 2;
          const s = ref.includes('mountain') || ref.includes('hill') ? 0.6 : 1;
          obj.scale.setScalar(s * (0.85 + hash2(j, i * 9) * 0.35));
          this.propGroup.add(obj);
        }
      }
      this.props.set(k, obj);
    }
    for (const [k, o] of this.props) if (!want.has(k)) { if (o) this.propGroup.remove(o); this.props.delete(k); }
  }

  // ---------- joystick ----------
  bindJoystick() {
    const el = this.wrap;
    this.joy = null;
    const start = (x, y, id) => { const r = el.getBoundingClientRect(); this.joy = { id, ox: x - r.left, oy: y - r.top, x: x - r.left, y: y - r.top }; };
    const move = (x, y) => {
      if (!this.joy) return;
      const r = el.getBoundingClientRect(); this.joy.x = x - r.left; this.joy.y = y - r.top;
      let dx = this.joy.x - this.joy.ox, dy = this.joy.y - this.joy.oy;
      const l = Math.hypot(dx, dy), max = 46;
      if (l < 8) { this.inp = null; return; }
      const k = Math.min(1, l / max); dx /= l; dy /= l;
      // screen right -> world (1,0,-1)/√2, screen down -> world (1,0,1)/√2
      const wx = (dx + dy) / Math.SQRT2, wz = (dy - dx) / Math.SQRT2;
      this.inp = { x: wx * k, z: wz * k };
    };
    const end = () => { this.joy = null; this.inp = null; };
    el.addEventListener('touchstart', (e) => { const t = e.changedTouches[0]; start(t.clientX, t.clientY, t.identifier); e.preventDefault(); }, { passive: false });
    el.addEventListener('touchmove', (e) => { for (const t of e.changedTouches) if (this.joy && t.identifier === this.joy.id) move(t.clientX, t.clientY); e.preventDefault(); }, { passive: false });
    el.addEventListener('touchend', (e) => { for (const t of e.changedTouches) if (this.joy && t.identifier === this.joy.id) end(); });
    el.addEventListener('touchcancel', end);
    el.addEventListener('mousedown', (e) => { start(e.clientX, e.clientY, 'm'); });
    window.addEventListener('mousemove', (e) => { if (this.joy?.id === 'm') move(e.clientX, e.clientY); });
    window.addEventListener('mouseup', () => { if (this.joy?.id === 'm') end(); });
  }

  // ---------- events ----------
  onEvent(e, state) {
    if (!this.loaded) return;
    const H = this.hero;
    switch (e.t) {
      case 'swing': if (H) { const cfg = HERO[state.cls]; H.play(cfg.atk[Math.floor(Math.random() * cfg.atk.length)], { once: true, speed: 1.6 }); if (cfg.ranged) this.projectile(this.heroPos(1.2), this.entPos(e.id, 1), ELEM_COL[state.cls === 'ranger' ? 'phys' : state.cls === 'warlock' ? 'shadow' : 'arcane'], 0.14, 0.18); } break;
      case 'hit': {
        const v = this.ents.get(e.id);
        if (v) { v.flash = e.crit || !v.boss ? 0.08 : 0; if (!e.dot && v.char && !v.oneShotLock && Math.random() < 0.35) v.char.play('Hit_A', { once: true, speed: 1.5 }); }
        const p = this.entPos(e.id, 1.2);
        if (!e.dot) this.sparks(p, e.crit ? 0xffd34d : ELEM_COL[e.elem] || 0xffffff, e.crit ? 10 : 4);
        this.num(p, fmtN(e.dmg), e.crit ? '#ffd34d' : e.dot ? hex(ELEM_COL[e.elem] || 0xffffff) : e.pet || e.minion ? '#ffe08a' : '#ffffff', e.crit ? 22 : e.dot ? 11 : 14, e.crit);
        if (e.crit) this.shakeIt(2);
        break;
      }
      case 'cast': this.castFx(e, state); break;
      case 'skillHit': for (const id of e.ids || []) { const p = this.entPos(id, 0.05); if (e.role === 'aoe' || e.role === 'ultimate') this.groundRing(p, ELEM_COL[e.elem], 0.3, 2.2, 0.5); } break;
      case 'heal': this.num(this.heroPos(2), '+' + fmtN(e.n), '#6fe07a', 14, true); this.sparks(this.heroPos(1), 0x8fffa0, 6, true); break;
      case 'hurt': if (H && Math.random() < (e.big ? 1 : 0.25)) H.play('Hit_A', { once: true, speed: 1.6 }); this.hurtT = 0.12; this.num(this.heroPos(2.1), '-' + fmtN(e.dmg), '#ff6b5e', e.big ? 20 : 13, e.big); if (e.big) { this.shakeIt(0.35); this.flashIt('#ff2020', 0.25, 0.25); } break;
      case 'eatk': { const v = this.ents.get(e.id); if (v?.char) v.char.play(v.atkClip, { once: true, speed: 1.4 }); else if (v) v.lunge = 0.2; if (v?.ranged) this.projectile(this.entPos(e.id, 1.2), this.heroPos(1), 0x9a6aff, 0.12, 0.3); break; }
      case 'dodge': if (H) H.play('Dodge_Backward', { once: true, speed: 1.5 }); this.num(this.heroPos(2.3), 'Dodged!', '#9ad1ff', 16, true); break;
      case 'avoided': this.num(this.heroPos(2.3), 'Avoided!', '#9ad1ff', 16, true); break;
      case 'kill': {
        const v = this.ents.get(e.id);
        if (v) { v.dying = 0; if (v.char) v.char.play('Death_A', { once: true, speed: 1.3, hold: true }); }
        this.sparks(this.entPos(e.id, 1), 0xffffff, e.boss ? 40 : 10);
        if (e.boss) { this.shakeIt(0.5); this.flashIt('#ffd34d', 0.4, 0.3); this.banner = { text: 'Boss defeated!', sub: '', t: 2, c: '#ffd34d' }; if (H) setTimeout(() => H.play('Cheer', { once: true }), 400); }
        break;
      }
      case 'status': this.num(this.entPos(e.id, 2.4), STATUS[e.k].name, STATUS[e.k].color, 11, true); break;
      case 'tele': if (e.small) this.num(this.entPos(e.id, 2.6), '⚠', '#ff5a4a', 18, true); else this.banner = { text: '⚠ ' + e.name, sub: 'Get out of the red!', t: 1.4, c: '#ff5a4a' }; break;
      case 'teleHit': { const v = this.ents.get(e.id); if (v?.char) { v.char.oneShot = null; v.char.play(v.atkClip === 'Spellcast_Shoot' ? 'Spellcast_Shoot' : '2H_Melee_Attack_Chop', { once: true, speed: 1.3 }); } } this.shakeIt(0.4); for (const z of e.zones || []) { this.groundRing({ x: z.x, y: 0.05, z: z.z }, z.kind === 'storm' || z.kind === 'breath' ? 0xff7a2b : 0xff3a2a, 0.5, z.r, 0.5); this.sparks({ x: z.x, y: 0.3, z: z.z }, 0xff9a5a, 14); } break;
      case 'phase': this.banner = { text: e.name, sub: e.n === 9 ? 'The boss is enraged!' : `Phase ${e.n}`, t: 2.2, c: '#ff8ad0' }; this.shakeIt(0.5); this.flashIt('#ff3bd0', 0.4, 0.3); break;
      case 'bossShield': this.num(this.entPos(e.id, 4), 'Shielded!', '#9ad8ff', 15, true); break;
      case 'smite': for (const [id] of this.ents) this.beam(this.entPos(id, 0), 0xfff3b0, 0.5, 0.25); break;
      case 'blaze': case 'explode': for (const [id] of this.ents) { const p = this.entPos(id, 0.1); this.groundRing(p, 0xff7a2b, 0.2, 1.8, 0.4); this.sparks({ ...p, y: 1 }, 0xff9a4a, 8); } break;
      case 'loot': if (e.rarity >= 2) { const p = this.heroPos(0); this.beam({ x: p.x + rand(-2, 2), y: 0, z: p.z + rand(-2, 2) }, new THREE.Color(RARITIES[e.rarity].color).getHex(), e.rarity >= 4 ? 2.6 : 1.4, e.rarity >= 4 ? 0.35 : 0.2); } break;
      case 'level': this.groundRing(this.heroPos(0.05), 0xffd34d, 0.3, 3, 0.8); this.sparks(this.heroPos(1), 0xffd34d, 20, true); this.flashIt('#ffd34d', 0.3, 0.15); if (H) H.play('Cheer', { once: true }); break;
      case 'death': if (H) H.play('Death_A', { once: true, hold: true }); this.flashIt('#000000', 0.6, 0.5); this.banner = { text: 'Defeated', sub: 'Regrouping…', t: 2.5, c: '#ff6b5e' }; break;
      case 'wave': if (e.boss) this.banner = { text: 'Boss!', sub: '', t: 1.6, c: '#ff8a2b' }; break;
      case 'runEnd': if (e.win) { this.flashIt('#ffd34d', 0.6, 0.3); if (H) H.play('Cheer', { once: true }); } break;
    }
  }
  castFx(e, state) {
    const H = this.hero, cfg = HERO[state.cls], col = ELEM_COL[e.elem] || 0xffffff;
    if (!H) return;
    const hp = this.heroPos(1.2);
    const tgt = this.firstTarget(state);
    switch (e.role) {
      case 'primary': case 'secondary':
        H.play(cfg.ranged ? 'Spellcast_Shoot' : cfg.atk[e.role === 'secondary' ? 1 % cfg.atk.length : 0], { once: true, speed: 1.4 });
        if (tgt) { if (cfg.ranged || state.cls === 'paladin') this.projectile(hp, tgt, col, e.role === 'secondary' ? 0.3 : 0.2, 0.25); else this.slash(tgt, col, e.role === 'secondary'); }
        break;
      case 'aoe': H.play(cfg.aoe, { once: true, speed: 1.3 }); this.groundRing(this.heroPos(0.05), col, 0.5, 4, 0.5); break;
      case 'defensive': H.play(state.cls === 'paladin' || state.cls === 'warrior' ? 'Block' : 'Spellcast_Raise', { once: true, speed: 1.4 }); this.shell = { col, t: 1.2 }; break;
      case 'utility': H.play(SKILLS[e.id]?.summon ? 'Spellcast_Summon' : 'Spellcast_Raise', { once: true, speed: 1.3 }); this.groundRing(this.heroPos(0.05), col, 0.3, 2.8, 0.7); this.sparks(hp, col, 14, true); break;
      case 'ultimate':
        H.play('Spellcast_Long', { once: true, speed: 1.3 });
        this.flashIt(hex(col), 0.35, 0.3); this.shakeIt(0.6);
        for (const [id] of this.ents) { const p = this.entPos(id, 0); this.beam(p, col, 1, 0.5); this.groundRing(p, col, 0.3, 2.5, 0.8); }
        this.banner = { text: SKILLS[e.id]?.name || 'Ultimate', sub: 'Ultimate', t: 1.3, c: hex(col) };
        break;
    }
    if (e.echo) this.num(this.heroPos(2.6), 'Echo!', '#c08bff', 13, true);
  }
  firstTarget(state) { const c = state.combat; const e = c?.enemies.find((x) => x.hp > 0); return e ? { x: e.x, y: 1, z: e.z } : null; }
  heroPos(y = 0) { const h = this.heroState; return { x: h?.x || 0, y, z: h?.z || 0 }; }
  entPos(id, y = 0) { const v = this.ents.get(id); const p = v ? v.obj.position : this.heroPos(); return { x: p.x, y: y * (v?.scale || 1), z: p.z }; }

  // ---------- fx primitives ----------
  addFx(obj, life, update) { this.fxGroup.add(obj); this.fx.push({ obj, life, age: 0, update }); }
  glowSprite(col, size) { const m = new THREE.SpriteMaterial({ map: this.glowTex, color: col, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }); const s = new THREE.Sprite(m); s.scale.setScalar(size); return s; }
  projectile(a, b, col, size, life) {
    if (!b) return;
    const s = this.glowSprite(col, size * 3);
    this.addFx(s, life, (k) => { s.position.set(a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k + Math.sin(k * Math.PI) * 0.4, a.z + (b.z - a.z) * k); });
    setTimeout(() => this.sparks(b, col, 5), life * 1000);
  }
  sparks(p, col, n, up = false) {
    if (this.S?.effects === 'reduced') n = Math.ceil(n / 3);
    for (let i = 0; i < n; i++) {
      const s = this.glowSprite(col, rand(0.15, 0.35));
      const v = new THREE.Vector3(rand(-1, 1), up ? rand(1, 2.5) : rand(0.2, 2), rand(-1, 1)).multiplyScalar(up ? 1.2 : 2.5);
      s.position.set(p.x, p.y, p.z);
      this.addFx(s, rand(0.3, 0.7), (k, dt) => { s.position.addScaledVector(v, dt); if (!up) v.y -= 9 * dt; s.material.opacity = 1 - k; });
    }
  }
  groundRing(p, col, r0, r1, life) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 48), new THREE.MeshBasicMaterial({ color: col, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    m.rotation.x = -Math.PI / 2; m.position.set(p.x, 0.06, p.z);
    this.addFx(m, life, (k) => { const r = r0 + (r1 - r0) * (1 - Math.pow(1 - k, 3)); m.scale.setScalar(Math.max(0.01, r)); m.material.opacity = 1 - k; });
  }
  slash(p, col, big) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.7, big ? 1.1 : 0.95, 24, 1, 0, Math.PI * 0.9), new THREE.MeshBasicMaterial({ color: col, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    m.position.set(p.x, 1.1, p.z); m.rotation.set(rand(-0.5, 0.5), Math.PI / 4, rand(0, 6.28));
    this.addFx(m, 0.25, (k) => { m.material.opacity = 1 - k; m.rotation.z += 0.15; m.scale.setScalar(1 + k * 0.4); });
  }
  beam(p, col, life, w) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(w, w, 14, 12, 1, true), new THREE.MeshBasicMaterial({ color: col, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.position.set(p.x, 7, p.z);
    this.addFx(m, life, (k) => { m.material.opacity = (k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85) * 0.7; });
  }
  num(p, text, color, size = 14, crit = false) {
    const mode = this.S?.dmgNums || 'all';
    if (mode === 'off') return;
    if (mode === 'crits' && !crit) return;
    if (this.nums.length > (mode === 'all' ? 18 : 8)) this.nums.shift();
    this.nums.push({ p: new THREE.Vector3(p.x, p.y, p.z), dx: rand(-14, 14), text, c: color, s: size, age: 0, life: 0.9 });
  }
  shakeIt(n) { if (this.S?.shake !== false) this.shake = Math.max(this.shake, n); }
  flashIt(c, t, a) { if (this.S?.effects !== 'reduced') this.flash = { c, t, a }; }

  // ---------- per frame ----------
  frame(dt, state, bg) {
    if (!this.ok) return;
    try { this._frame(dt, state, bg); } catch (err) { console.warn('3d', err); }
  }
  _frame(dt, state, bg) {
    this.t += dt;
    state.input = this.inp || null;
    const c = state.combat;
    if (!this.loaded || !c) { this.renderer.setClearColor(0x15101c); this.renderer.clear(); this.drawOverlay(dt, state, true); return; }
    this.setTheme(bg);
    const h = c.hero; this.heroState = h;
    // hero
    const cls = state.cls;
    if (!this.hero || this.heroCls !== cls) {
      if (this.hero) this.scene.remove(this.hero.obj);
      const cfg = HERO[cls];
      this.hero = this.makeChar(cfg.file, cfg.keep, cfg.tint);
      this.hero.obj.scale.setScalar(1.05);
      this.scene.add(this.hero.obj); this.heroCls = cls;
      this.hero.play('Idle');
    }
    const H = this.hero;
    H.obj.position.set(h.x, 0, h.z);
    const targetRot = Math.PI / 2 - (h.face || 0);
    H.obj.rotation.y = lerpAngle(H.obj.rotation.y, targetRot, Math.min(1, dt * 14));
    if (H.oneShot && this.t > H.oneShot.until && !H.oneShot.hold) H.oneShot = null;
    if (h.dead > 0) { if (!H.oneShot) H.play('Death_A_Pose'); }
    else if (!H.oneShot || h.moving) { if (H.oneShot && h.moving) H.oneShot = null; H.play(h.moving ? 'Running_A' : c.enemies.some((e) => e.hp > 0) ? 'Idle_Combat' : 'Idle', { speed: h.moving ? 1.1 : 1 }); }
    H.mixer.update(dt);
    // companion & minions (billboards)
    this.syncCompanion(state, h, dt);
    this.syncMinions(h, dt);
    // enemies
    const alive = new Set();
    for (const e of c.enemies) {
      if (e.x === undefined) continue;
      let v = this.ents.get(e.id);
      if (!v && e.hp > 0) v = this.spawnEnt(e);
      if (!v) continue;
      alive.add(e.id);
      v.obj.position.x += (e.x - v.obj.position.x) * Math.min(1, dt * 12);
      v.obj.position.z += (e.z - v.obj.position.z) * Math.min(1, dt * 12);
      if (v.char) {
        v.obj.rotation.y = lerpAngle(v.obj.rotation.y, Math.PI / 2 - (e.face || 0), Math.min(1, dt * 10));
        if (v.dying === undefined) {
          if (v.char.oneShot && this.t > v.char.oneShot.until) v.char.oneShot = null;
          if (e.tele && v.boss) v.char.play(e.tele.kind === 'ultimate' || e.tele.kind === 'storm' ? 'Spellcast_Long' : 'Spellcast_Raise', { speed: 0.8 });
          else if (!v.char.oneShot) v.char.play(e.moving ? (v.walk) : 'Idle_Combat', { speed: e.moving ? 1.2 : 1 });
        }
        v.char.mixer.update(dt * (e.frozen > 0 ? 0 : e.st?.chill ? 0.6 : 1));
        const fl = v.flash > 0;
        const glow = fl ? 0.6 : 0;
        if (fl !== v.flashing || (v.boss && !!e.tele !== v.charging)) { v.flashing = fl; v.charging = !!e.tele; v.char.obj.traverse((o) => { if (o.isMesh && o.material.emissive) { if (fl) o.material.emissive.setScalar(v.boss ? 0.18 : 0.45); else if (e.tele) o.material.emissive.setRGB(0.3 + 0.2 * Math.abs(Math.sin(this.t * 10)), 0.05, 0.02); else if (o.userData.baseEm) o.material.emissive.copy(o.userData.baseEm); else o.material.emissive.setScalar(0); } }); }
      } else {
        // billboard boss: face the hero, bob, flash, charge glow
        const dx = (state.combat.hero.x - e.x) - (state.combat.hero.z - e.z);
        const flip = dx < 0;
        v.sprite.scale.x = Math.abs(v.sprite.scale.x) * (flip ? 1 : -1) * (v.baseFlip ? -1 : 1);
        v.sprite.position.y = Math.sin(this.t * 2.2) * 0.05;
        const fl = v.flash > 0 ? 2.2 : e.tele ? 1 + 0.6 * Math.abs(Math.sin(this.t * 12)) : e.frozen > 0 ? 0.8 : 1;
        v.mat.color.setRGB(fl, e.tele ? fl * 0.6 : fl, e.tele ? fl * 0.6 : e.frozen > 0 ? 1.4 : fl);
        if (v.lunge > 0) { v.lunge -= dt; }
      }
      v.flash = Math.max(0, (v.flash || 0) - dt);
      if (e.hp <= 0 && v.dying === undefined) { v.dying = 0; if (v.char) v.char.play('Death_A', { once: true, hold: true, speed: 1.3 }); }
      if (v.dying !== undefined) {
        v.dying += dt;
        if (v.dying > 1.1) v.obj.position.y = -(v.dying - 1.1) * 1.5;
        if (v.billboard) v.mat.opacity = Math.max(0, 1 - v.dying * 1.5);
        if (v.dying > 1.8) { this.scene.remove(v.obj); this.ents.delete(e.id); }
      }
      // elite / boss ring
      if (v.ring) { v.ring.rotation.z += dt * 0.8; }
    }
    for (const [id, v] of this.ents) if (!alive.has(id)) { this.scene.remove(v.obj); this.ents.delete(id); }
    // telegraph zones
    this.syncZones(c.zones || []);
    // fx
    for (let i = this.fx.length - 1; i >= 0; i--) {
      const f = this.fx[i]; f.age += dt;
      const k = f.age / f.life;
      if (k >= 1) { this.fxGroup.remove(f.obj); f.obj.geometry?.dispose?.(); f.obj.material?.dispose?.(); this.fx.splice(i, 1); continue; }
      f.update(k, dt);
    }
    // shell (defensive)
    if (this.shell) { this.shell.t -= dt; if (this.shell.t <= 0) this.shell = null; }
    // world streaming + camera
    if (!this.floorCenter || Math.hypot(h.x - this.floorCenter.x, h.z - this.floorCenter.z) > 5) this.buildFloor(Math.round(h.x), Math.round(h.z));
    this.updateProps(h.x, h.z);
    this.camTarget.x += (h.x - this.camTarget.x) * Math.min(1, dt * 4);
    this.camTarget.z += (h.z - this.camTarget.z) * Math.min(1, dt * 4);
    let sx = 0, sz = 0;
    if (this.shake > 0) { sx = rand(-this.shake, this.shake); sz = rand(-this.shake, this.shake); this.shake = Math.max(0, this.shake - dt * 2.5); }
    this.camera.position.set(this.camTarget.x + this.camOff.x + sx, this.camOff.y, this.camTarget.z + this.camOff.z + sz);
    this.camera.lookAt(this.camTarget.x + sx, 0.8, this.camTarget.z + sz);
    this.sun.position.set(this.camTarget.x + 8, 18, this.camTarget.z + 4); this.sun.target.position.set(this.camTarget.x, 0, this.camTarget.z);
    this.renderer.render(this.scene, this.camera);
    this.drawOverlay(dt, state);
  }
  spawnEnt(e) {
    let v;
    const b3 = (e.boss || e.vault) && BOSS3D[e.art[1]];
    if (b3) {
      const [file, tint, keep, extra = []] = b3;
      const ch = this.makeChar(file, keep, tint, extra.map((w, i) => [w, i ? 'handslot.l' : 'handslot.r']));
      const sc = e.vault ? 1.8 : file === 'mage' ? 1.75 : 2.0;
      v = { obj: new THREE.Group(), char: ch, scale: sc, boss: true, isHeroModel: !file.startsWith('skel') };
      ch.obj.scale.setScalar(sc); v.obj.add(ch.obj);
      ch.obj.traverse((o) => { if (o.isMesh) { o.material.emissive = new THREE.Color(tint).multiplyScalar(/Eyes/.test(o.name) ? 1.5 : 0.12); o.userData.baseEm = o.material.emissive.clone(); } });
      v.walk = file === 'skel_minion' ? 'Walking_D_Skeletons' : 'Running_A';
      v.atkClip = file === 'skel_mage' || file === 'mage' ? 'Spellcast_Shoot' : '2H_Melee_Attack_Chop';
      v.ranged = false;
      ch.play(file.startsWith('skel') ? 'Spawn_Ground_Skeletons' : 'Cheer', { once: true, speed: 1.2 });
      const ring = new THREE.Mesh(new THREE.RingGeometry(1.5, 1.75, 40), new THREE.MeshBasicMaterial({ color: e.vault ? 0xffd040 : 0xff7a2b, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }));
      ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05; v.obj.add(ring); v.ring = ring;
    } else if (e.boss || e.vault) {
      v = this.makeBillboard(e.art[0], e.art[1], e.vault ? 4.2 : e.art[0] === 'bosses' ? 5.2 : 4.4);
      v.baseFlip = false; v.scale = e.vault ? 1.8 : 2.2;
      const ring = new THREE.Mesh(new THREE.RingGeometry(1.5, 1.75, 40), new THREE.MeshBasicMaterial({ color: 0xff7a2b, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }));
      ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05; v.obj.add(ring); v.ring = ring;
    } else {
      const m = enemyModel(e.art[1]);
      const tint = this.theme?.enemyTint || enemyTint(this.themeKey);
      const extra = [[m.weapon, 'handslot.r']]; if (m.shield) extra.push([m.shield, 'handslot.l']);
      const ch = this.makeChar(m.file, [], tint, extra);
      v = { obj: new THREE.Group(), char: ch, scale: m.scale * (e.elite ? 1.25 : 1) };
      ch.obj.scale.setScalar(v.scale); v.obj.add(ch.obj);
      v.walk = m.file === 'skel_minion' ? 'Walking_D_Skeletons' : 'Running_A';
      v.atkClip = m.file === 'skel_mage' ? 'Spellcast_Shoot' : m.file === 'skel_warrior' ? '2H_Melee_Attack_Chop' : '1H_Melee_Attack_Chop';
      v.ranged = m.file === 'skel_mage';
      ch.play('Spawn_Ground_Skeletons', { once: true, speed: 1.6 });
      if (e.elite) {
        const ring = new THREE.Mesh(new THREE.RingGeometry(0.75, 0.9, 32), new THREE.MeshBasicMaterial({ color: 0x6b8cff, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
        ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05; v.obj.add(ring); v.ring = ring;
      }
    }
    v.obj.position.set(e.x, 0, e.z);
    this.scene.add(v.obj);
    this.ents.set(e.id, v);
    return v;
  }
  syncCompanion(state, h, dt) {
    const id = state.companions?.active;
    if (this.compId !== id) {
      if (this.comp) this.scene.remove(this.comp.obj);
      this.comp = null; this.compId = id;
      if (id) { const a = COMPANIONS[id].art; this.comp = this.makeBillboard(a[0], a[1], 1.3, a[0] === 'monsters'); this.scene.add(this.comp.obj); }
    }
    if (this.comp) {
      const tx = h.x - Math.cos(h.face || 0) * 1.4 + 0.8, tz = h.z - Math.sin(h.face || 0) * 1.4 - 0.8;
      const p = this.comp.obj.position; p.x += (tx - p.x) * Math.min(1, dt * 5); p.z += (tz - p.z) * Math.min(1, dt * 5);
      this.comp.sprite.position.y = Math.abs(Math.sin(this.t * 6)) * 0.12;
    }
  }
  syncMinions(h, dt) {
    const want = (h.minions || []).length;
    this.minis = this.minis || [];
    while (this.minis.length < want) {
      const m = h.minions[this.minis.length];
      let v;
      if (m.kind === 'skeleton') { v = this.makeChar('skel_minion', [], 0xa0ffb0, [['Skeleton_Blade', 'handslot.r']]); v.obj.scale.setScalar(0.75); v.play('Spawn_Ground_Skeletons', { once: true, speed: 1.5 }); }
      else { const b = this.makeBillboard('monsters', m.kind === 'demon' ? 'demonlord' : 'magmagolem', m.kind === 'demon' ? 2 : 2.6, true); v = b; }
      v.kind = m.kind; this.scene.add(v.obj); this.minis.push(v);
    }
    while (this.minis.length > want) this.scene.remove(this.minis.pop().obj);
    this.minis.forEach((v, i) => {
      const a = (h.face || 0) + (i - (want - 1) / 2) * 0.7, d = 1.6;
      const tx = h.x + Math.cos(a) * d, tz = h.z + Math.sin(a) * d, p = v.obj.position;
      const mv = Math.hypot(tx - p.x, tz - p.z) > 0.2;
      p.x += (tx - p.x) * Math.min(1, dt * 4); p.z += (tz - p.z) * Math.min(1, dt * 4);
      if (v.mixer) { v.obj.rotation.y = Math.PI / 2 - (h.face || 0); if (v.oneShot && this.t > v.oneShot.until) v.oneShot = null; if (!v.oneShot) v.play(mv ? 'Walking_D_Skeletons' : 'Idle_Combat'); v.mixer.update(dt); }
    });
  }
  syncZones(zones) {
    this.zoneMeshes = this.zoneMeshes || new Map();
    const seen = new Set();
    for (const z of zones) {
      seen.add(z);
      let m = this.zoneMeshes.get(z);
      if (!m) {
        const g = new THREE.Group();
        const fill = new THREE.Mesh(new THREE.CircleGeometry(1, 48), new THREE.MeshBasicMaterial({ color: z.kind === 'ultimate' ? 0xff2a6a : 0xff3a2a, transparent: true, opacity: 0.35, depthWrite: false }));
        const edge = new THREE.Mesh(new THREE.RingGeometry(0.95, 1, 64), new THREE.MeshBasicMaterial({ color: 0xffd0c0, transparent: true, opacity: 0.9, depthWrite: false }));
        fill.rotation.x = edge.rotation.x = -Math.PI / 2;
        g.add(fill); g.add(edge); g.position.set(z.x, 0.07, z.z); edge.scale.setScalar(z.r);
        this.zoneGroup.add(g); m = { g, fill }; this.zoneMeshes.set(z, m);
      }
      const k = z.tele ? 1 - z.tele.t / z.tele.total : 1;
      m.fill.scale.setScalar(Math.max(0.05, z.r * k));
      m.fill.material.opacity = 0.25 + 0.2 * Math.abs(Math.sin(this.t * 10));
    }
    for (const [z, m] of this.zoneMeshes) if (!seen.has(z)) { this.zoneGroup.remove(m.g); this.zoneMeshes.delete(z); }
  }

  // ---------- 2D overlay ----------
  project(p) { const v = new THREE.Vector3(p.x, p.y, p.z).project(this.camera); return { x: (v.x + 1) / 2 * this.w, y: (1 - v.y) / 2 * this.h }; }
  drawOverlay(dt, state, loading) {
    const x = this.octx, w = this.w, h = this.h;
    x.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    x.clearRect(0, 0, w, h);
    if (loading) { x.fillStyle = '#e0c8a0'; x.font = '600 14px system-ui'; x.textAlign = 'center'; x.fillText(this.failed ? 'Could not load 3D models — switch to Classic 2D in Settings' : 'Loading 3D models…', w / 2, h / 2); return; }
    const c = state.combat;
    const fs = this.S?.text === 'l' ? 1.2 : this.S?.text === 's' ? 0.9 : 1;
    // enemy bars + statuses
    for (const e of c.enemies) {
      if (e.hp <= 0 || e.boss || e.x === undefined) continue;
      const v = this.ents.get(e.id); if (!v) continue;
      const p = this.project({ x: v.obj.position.x, y: 2.3 * (v.scale || 1), z: v.obj.position.z });
      const bw = e.elite ? 44 : 34;
      x.fillStyle = 'rgba(0,0,0,0.7)'; x.fillRect(p.x - bw / 2 - 1, p.y - 1, bw + 2, 6);
      x.fillStyle = e.elite ? '#6b8cff' : '#d0392f'; x.fillRect(p.x - bw / 2, p.y, bw * Math.max(0, e.hp / e.maxHp), 4);
      if (e.elite) { x.font = '11px serif'; x.textAlign = 'center'; x.fillText(e.mods.map((m) => MOD_ICON[m]).join(''), p.x, p.y - 4); }
      this.drawStatuses(e, p.x, p.y - (e.elite ? 16 : 4));
    }
    for (const e of c.enemies) if (e.boss && e.hp > 0) { const v = this.ents.get(e.id); if (v) { const p = this.project({ x: v.obj.position.x, y: v.billboard ? 5.4 : 2.3 * v.scale, z: v.obj.position.z }); this.drawStatuses(e, p.x, p.y); } }
    // hero shield bubble + joystick
    if (c.hero.shield > 0 || this.shell) {
      const p = this.project({ x: c.hero.x, y: 1, z: c.hero.z });
      x.strokeStyle = this.shell ? hex(this.shell.col) : 'rgba(255,200,110,0.8)'; x.lineWidth = 2; x.globalAlpha = 0.7;
      x.beginPath(); x.arc(p.x, p.y, 34 + Math.sin(this.t * 5) * 2, 0, 7); x.stroke(); x.globalAlpha = 1;
    }
    if (this.joy) {
      const j = this.joy; x.globalAlpha = 0.5; x.fillStyle = '#000'; x.beginPath(); x.arc(j.ox, j.oy, 46, 0, 7); x.fill();
      x.strokeStyle = '#e0c8a0'; x.lineWidth = 2; x.stroke();
      let dx = j.x - j.ox, dy = j.y - j.oy; const l = Math.hypot(dx, dy); if (l > 46) { dx *= 46 / l; dy *= 46 / l; }
      x.globalAlpha = 0.85; x.fillStyle = '#e0b45a'; x.beginPath(); x.arc(j.ox + dx, j.oy + dy, 20, 0, 7); x.fill(); x.globalAlpha = 1;
    }
    // damage numbers
    x.textAlign = 'center';
    for (let i = this.nums.length - 1; i >= 0; i--) {
      const n = this.nums[i]; n.age += dt;
      if (n.age > n.life) { this.nums.splice(i, 1); continue; }
      const p = this.project(n.p), k = n.age / n.life, pop = k < 0.15 ? 1 + (0.15 - k) * 3 : 1;
      x.globalAlpha = k > 0.6 ? (1 - k) / 0.4 : 1;
      x.font = `900 ${Math.round(n.s * pop * fs)}px system-ui, sans-serif`;
      x.lineWidth = 3.5; x.strokeStyle = '#000'; x.lineJoin = 'round';
      x.strokeText(n.text, p.x + n.dx, p.y - k * 40); x.fillStyle = n.c; x.fillText(n.text, p.x + n.dx, p.y - k * 40);
    }
    x.globalAlpha = 1;
    if (this.banner) {
      const b = this.banner; b.t -= dt;
      if (b.t <= 0) this.banner = null;
      else {
        x.globalAlpha = Math.min(1, b.t * 3);
        x.fillStyle = 'rgba(0,0,0,0.55)'; x.fillRect(0, h * 0.2, w, 46);
        x.font = `800 ${Math.round(20 * fs)}px Cinzel, Georgia, serif`; x.fillStyle = b.c; x.strokeStyle = '#000'; x.lineWidth = 4;
        x.strokeText(b.text, w / 2, h * 0.2 + 24); x.fillText(b.text, w / 2, h * 0.2 + 24);
        if (b.sub) { x.font = `600 ${Math.round(11 * fs)}px system-ui`; x.fillStyle = '#e8dcc8'; x.fillText(b.sub, w / 2, h * 0.2 + 40); }
        x.globalAlpha = 1;
      }
    }
    if (this.flash) {
      this.flash.t -= dt;
      if (this.flash.t <= 0) this.flash = null;
      else { x.globalAlpha = this.flash.a * Math.min(1, this.flash.t * 4); x.fillStyle = this.flash.c; x.fillRect(0, 0, w, h); x.globalAlpha = 1; }
    }
    const lifeK = c.hero.dead > 0 ? 1 : c.hero.hp / c.st.hp;
    if (lifeK < 0.35 && this.S?.effects !== 'reduced') {
      const g = x.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, w * 0.8);
      g.addColorStop(0, 'rgba(180,0,0,0)'); g.addColorStop(1, `rgba(180,0,0,${(0.35 - lifeK) * (1.2 + Math.sin(this.t * 6) * 0.3)})`);
      x.fillStyle = g; x.fillRect(0, 0, w, h);
    }
    if (!this.hintShown && this.loaded) { this.hintT = (this.hintT || 0) + dt; if (this.hintT < 6) { x.globalAlpha = Math.min(1, (6 - this.hintT)); x.font = '600 11px system-ui'; x.fillStyle = '#e0d0b0'; x.fillText('Drag anywhere to move · let go to auto-fight', w / 2, h - 10); x.globalAlpha = 1; } else this.hintShown = true; }
  }
  drawStatuses(e, cx, y) {
    const x = this.octx;
    const list = Object.keys(e.st).filter((k) => STATUS[k]);
    if (e.frozen > 0) list.push('freeze');
    if (!list.length) return;
    const safe = this.S?.colorSafe, step = safe ? 26 : 18;
    list.forEach((k, n) => {
      const ix = cx - (list.length - 1) * step / 2 + n * step;
      x.font = '13px serif'; x.textAlign = 'center'; x.fillText(STATUS[k].icon, ix, y);
      if (safe) { x.font = '800 9px system-ui'; x.fillStyle = '#fff'; x.strokeStyle = '#000'; x.lineWidth = 3; x.strokeText(STATUS[k].letter, ix + 9, y + 3); x.fillText(STATUS[k].letter, ix + 9, y + 3); }
      if (k === 'poison' && e.st.poison) { x.font = '700 9px system-ui'; x.fillStyle = '#7ad04a'; x.fillText(e.st.poison.n, ix + 8, y + 4); }
    });
  }
  clearEntities() { for (const v of this.ents.values()) this.scene.remove(v.obj); this.ents.clear(); }
}
const MOD_ICON = { tough: '🪨', explosive: '💥', venomous: '🐍', regen: '💚', frenzied: '💢', summoner: '🪦' };
// greyscale the texture then tint it, so green grass can become snow, ash or sand
function recolor(mat, tint) {
  if (tint == null) return mat;
  mat.color.set(tint);
  mat.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
      { float l = dot(diffuseColor.rgb / max(diffuse, vec3(0.001)), vec3(0.299, 0.587, 0.114)); diffuseColor.rgb = diffuse * (0.45 + l * 0.6); }`);
  };
  mat.customProgramCacheKey = () => 'recolor' + tint;
  return mat;
}
function enemyTint(key) {
  return { crossroads: 0xd8f0c0, stones: 0xe0d0b0, necropolis: 0xc0d8b0, ironhold: 0xffb080, frostfall: 0xb8e0ff, hellfire: 0xff8a6a, prison: 0xc0a0ff, harbour: 0x90e0d0, rift: 0xd090ff, spire: 0xfff0c0, dungeon: 0xe0d8c8, lair: 0xff9a7a, caverns: 0x90f0f0, pyramid: 0xffe0a0, raid: 0xffa0d8, tower: 0xa0c0ff }[key] || 0xffffff;
}
function lerpAngle(a, b, t) { let d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; return a + d * t; }
function fmtN(n) {
  if (n < 1000) return Math.round(n).toString();
  const u = ['K', 'M', 'B', 'T', 'Qa', 'Qi'];
  let i = -1; while (n >= 1000 && i < u.length - 1) { n /= 1000; i++; }
  return (n < 100 ? n.toFixed(1) : Math.round(n)) + u[i];
}
