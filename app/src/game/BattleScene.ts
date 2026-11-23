// Phaser battle scene: pixel-art biome backdrops, hero party vs monster, and all the juice
// (hit flashes, lunges, projectiles, damage numbers, coin showers, loot pops, banners, shake).
import Phaser from 'phaser';
import * as E from '../core/engine';
import { store, notify } from '../core/store';
import { HERO, HeroId, biomeOf, BIOMES, KILLS_PER_STAGE, RARITIES, FOODS } from '../data/content';
import { sfx, music } from '../audio';

const FONT = '"Pixelify Sans", monospace';
const SANS = 'system-ui, -apple-system, Roboto, "Segoe UI", sans-serif';
const DPR = Math.min(3, Math.max(1, window.devicePixelRatio || 1));
const MELEE = new Set(['knight', 'cleric', 'rogue', 'barbarian']);
const STEP = 0.05;
type HeroView = { id: HeroId; spr: any; shadow: any; bar: any; x: number; y: number; bob: any; down: boolean };

export class BattleScene extends Phaser.Scene {
  heroes = new Map<HeroId, HeroView>();
  mon: any = null; monShadow: any; monBar: any; monName: any; monId = -1;
  bg: any; deco: any[] = []; biomeIdx = -1;
  hud: any; stageText: any; pips: any; timerBar: any; frenzyBar: any; frenzyGlow: any; shieldFx: any;
  acc = 0; numBudget = 0; onUiEvent: (e: any) => void = () => {};
  constructor() { super('battle'); }

  preload() {
    this.load.atlas('a', 'sprites/atlas.png', 'sprites/atlas.json');
  }
  create() {
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0xffffff, 1).fillRect(0, 0, 3, 3); g.generateTexture('px', 3, 3);
    g.clear(); g.fillStyle(0xffffff, 1).fillCircle(16, 16, 16); g.generateTexture('dot', 32, 32);
    g.destroy();
    this.bg = this.add.container(0, 0).setDepth(-10);
    this.hud = this.add.container(0, 0).setDepth(100);
    this.stageText = this.add.text(10, 8, '', { fontFamily: SANS, fontStyle: 'bold', resolution: DPR, fontSize: '16px', color: '#f2e6c8', stroke: '#000', strokeThickness: 4 }).setDepth(101);
    this.pips = this.add.graphics().setDepth(101);
    this.timerBar = this.add.graphics().setDepth(101);
    this.frenzyBar = this.add.graphics().setDepth(101);
    this.frenzyGlow = this.add.graphics().setDepth(99);
    this.monBar = this.add.graphics().setDepth(60);
    this.monName = this.add.text(0, 0, '', { fontFamily: SANS, fontStyle: 'bold', resolution: DPR, fontSize: '14px', color: '#ffffff', stroke: '#000', strokeThickness: 4 }).setOrigin(0.5, 1).setDepth(61);
    this.shieldFx = this.add.ellipse(0, 0, 10, 10, 0x6ab0ff, 0.18).setStrokeStyle(2, 0x9ad0ff, 0.8).setDepth(40).setVisible(false);
    this.input.on('pointerdown', (p: any) => this.onDown(p));
    this.input.on('pointermove', (p: any) => { if (p.isDown) { this.holdX = p.x; this.holdY = p.y; } });
    const up = () => this.onUp();
    this.input.on('pointerup', up); this.input.on('pointerupoutside', up); this.input.on('gameout', up);
    window.addEventListener('blur', up); document.addEventListener('visibilitychange', up);
    this.holdRing = this.add.graphics().setDepth(96);
    this.scale.on('resize', () => this.layout(true));
    this.layout(true);
  }

  // ---------- layout ----------
  get W() { return this.scale.width; } get H() { return this.scale.height; }
  get groundY() { return this.H * 0.78; }
  get monX() { return this.W * 0.73; }
  heroSlot(i: number, n: number) {
    // 2x2 formation, front row closest to the monster
    const front = i % 2 === 0, row = Math.floor(i / 2);
    const x = this.W * (front ? 0.36 : 0.18) - (row ? this.W * 0.04 : 0);
    const y = this.groundY - (row === 0 ? 34 : -6) + (front ? 0 : -14) + (n === 1 ? 20 : 0);
    return { x, y };
  }
  layout(force = false) {
    const s = store.s, b = Math.floor((s.stage - 1) / 10) % BIOMES.length;
    if (force || b !== this.biomeIdx) this.buildBackdrop(b, !force);
    this.syncHeroes(true);
    if (this.mon) { this.mon.x = this.monX; this.mon.y = this.groundY + 8; this.monShadow.setPosition(this.monX, this.groundY + 6); }
  }
  buildBackdrop(b: number, fade: boolean) {
    this.biomeIdx = b;
    const bi = BIOMES[b], W = this.W, H = this.H, S = 2, T = 32 * S;
    const old = this.bg;
    this.bg = this.add.container(0, 0).setDepth(-10);
    this.cameras.main.setBackgroundColor(bi.sky);
    const frames = (base: string) => { const out: string[] = []; for (let i = 0; i < 6; i++) if (this.textures.get('a').has(base + i)) out.push(base + i); return out.length ? out : [base + '0']; };
    const wall = frames(bi.wall), floor = frames(bi.floor);
    const horizon = Math.round(H * 0.38);
    for (let x = 0; x < W + T; x += T) for (let y = horizon - T * 2; y < horizon; y += T) this.bg.add(this.add.image(x, y, 'a', Phaser.Utils.Array.GetRandom(wall)).setOrigin(0).setScale(S).setTint(0x9a90a8));
    for (let x = 0; x < W + T; x += T) for (let y = horizon; y < H + T; y += T) this.bg.add(this.add.image(x, y, 'a', Phaser.Utils.Array.GetRandom(floor)).setOrigin(0).setScale(S));
    // horizon shadow + vignette bands
    const sh = this.add.graphics();
    sh.fillStyle(0x000000, 0.35).fillRect(0, horizon - 4, W, 10);
    for (let i = 0; i < 6; i++) { sh.fillStyle(0x000000, 0.06 * (6 - i)).fillRect(0, i * 6, W, 6); sh.fillRect(0, H - (i + 1) * 6, W, 6); }
    this.bg.add(sh);
    if (horizon > T * 2) { const top = this.add.graphics(); top.fillStyle(bi.sky, 1).fillRect(0, 0, W, horizon - T * 2); this.bg.add(top); }
    // decor scattered along the back
    const decor = bi.decor.flatMap((d) => frames(d));
    for (let i = 0; i < Math.ceil(W / 70); i++) {
      const x = 20 + i * 70 + Phaser.Math.Between(-15, 15), y = horizon + Phaser.Math.Between(-6, 26);
      if (x > W * 0.6 && x < W * 0.85) continue;
      this.bg.add(this.add.image(x, y, 'a', Phaser.Utils.Array.GetRandom(decor)).setOrigin(0.5, 1).setScale(S).setTint(0xd8d0e0));
    }
    if (fade && old) { this.bg.setAlpha(0); this.tweens.add({ targets: this.bg, alpha: 1, duration: 600 }); this.tweens.add({ targets: old, alpha: 0, duration: 600, onComplete: () => old.destroy() }); }
    else if (old) old.destroy();
    music(bi.music);
  }

  // ---------- heroes ----------
  syncHeroes(reposition = false) {
    const s = store.s, ids = E.fighters(s);
    for (const [id, v] of this.heroes) if (!ids.includes(id)) { v.spr.destroy(); v.shadow.destroy(); v.bar.destroy(); v.bob?.stop(); this.heroes.delete(id); reposition = true; }
    ids.forEach((id, i) => {
      let v = this.heroes.get(id);
      const pos = this.heroSlot(i, ids.length);
      if (!v) {
        const spr = this.add.image(pos.x, pos.y, 'a', HERO[id].sprite).setOrigin(0.5, 1).setScale(2.5).setDepth(20 + i);
        const shadow = this.add.ellipse(pos.x, pos.y - 2, 46, 12, 0x000000, 0.35).setDepth(10);
        const bar = this.add.graphics().setDepth(50);
        v = { id, spr, shadow, bar, x: pos.x, y: pos.y, bob: null, down: false };
        this.heroes.set(id, v);
        spr.setAlpha(0); spr.y -= 30; this.tweens.add({ targets: spr, alpha: 1, y: pos.y, duration: 400, ease: 'Bounce.Out' });
        reposition = true;
      }
      if (reposition) {
        v.x = pos.x; v.y = pos.y; v.spr.setDepth(20 + (pos.y | 0)); v.shadow.setPosition(pos.x, pos.y - 2);
        v.bob?.stop(); v.spr.setPosition(pos.x, pos.y);
        v.bob = this.tweens.add({ targets: v.spr, y: pos.y - 3, duration: 700 + Math.random() * 300, yoyo: true, repeat: -1, ease: 'Sine.InOut', delay: Math.random() * 500 });
      }
    });
  }
  drawHeroBars() {
    const s = store.s;
    for (const v of this.heroes.values()) {
      const h = s.heroes[v.id]; if (!h) continue;
      const mx = E.heroMaxHp(s, v.id), k = Math.max(0, Math.min(1, h.hp / mx));
      const g = v.bar; g.clear();
      const w = 40, x = v.x - w / 2, y = v.y + 4;
      g.fillStyle(0x000000, 0.75).fillRect(x - 1, y - 1, w + 2, 6);
      g.fillStyle(k > 0.5 ? 0x5cd06b : k > 0.25 ? 0xffb02a : 0xff4a3a, 1).fillRect(x, y, w * k, 4);
      const cd = 1 - Math.max(0, h.cd) / HERO[v.id].ability.cd;
      g.fillStyle(0x3a7aff, 1).fillRect(x, y + 5, w * cd, 2);
      const down = h.dead > 0;
      if (down !== v.down) {
        v.down = down;
        if (down) { v.bob?.pause(); this.tweens.add({ targets: v.spr, angle: -90, duration: 250 }); v.spr.setTint(0x666677); }
        else { this.tweens.add({ targets: v.spr, angle: 0, duration: 250 }); v.spr.clearTint(); v.bob?.resume(); this.sparkle(v.x, v.y - 30, 0x8fffa0, 10); }
      }
    }
  }

  // ---------- monster ----------
  syncMonster() {
    const m = store.rt.monster;
    if (!m) return;
    if (m.id !== this.monId) {
      this.monId = m.id;
      const scale = m.boss ? 4.6 : 3.4;
      this.mon?.destroy(); this.monShadow?.destroy();
      this.monShadow = this.add.ellipse(this.monX, this.groundY + 6, m.boss ? 120 : 80, 18, 0x000000, 0.35).setDepth(10);
      this.mon = this.add.image(this.monX, this.groundY + 8, 'a', m.key).setOrigin(0.5, 1).setScale(scale).setFlipX(true).setDepth(30);
      this.mon.y = -40; this.mon.setAlpha(0);
      this.tweens.add({ targets: this.mon, y: this.groundY + 8, alpha: 1, duration: 380, ease: 'Bounce.Out' });
      this.tweens.add({ targets: this.mon, scaleY: scale * 1.04, scaleX: scale * 0.97, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.InOut', delay: 400 });
      this.mon.setData('scale', scale);
    }
  }
  drawMonBar() {
    const m = store.rt.monster, g = this.monBar; g.clear();
    if (!m || !this.mon) { this.monName.setText(''); return; }
    const w = m.boss ? Math.min(220, this.W * 0.5) : Math.min(150, this.W * 0.38), x = this.monX - w / 2, top = this.groundY + 8 - this.mon.height * this.mon.getData('scale') - 14;
    const y = Math.max(54, top);
    g.fillStyle(0x000000, 0.8).fillRect(x - 2, y - 2, w + 4, 10);
    g.fillStyle(m.boss ? 0xc0392b : 0xd04a3a, 1).fillRect(x, y, w * Math.max(0, m.hp / m.maxHp), 6);
    g.fillStyle(0xffffff, 0.25).fillRect(x, y, w * Math.max(0, m.hp / m.maxHp), 2);
    this.monName.setPosition(this.monX, y - 3).setText(`${m.boss ? '☠ ' : ''}${m.name}  ${E.fmt(Math.max(0, m.hp))}`).setColor(m.boss ? '#ffb0a0' : '#ffffff');
  }

  // ---------- HUD ----------
  drawHud() {
    const s = store.s, b = biomeOf(s.stage), boss = E.isBossStage(s.stage);
    this.stageText.setText(`${b.name} · Stage ${s.stage}${s.autoAdvance ? '' : '  (farming)'}`);
    const g = this.pips; g.clear();
    if (!boss) for (let i = 0; i < KILLS_PER_STAGE; i++) { g.fillStyle(0x000000, 0.6).fillRect(10 + i * 13, 30, 11, 6); if (i < s.kills) g.fillStyle(0xffd34d, 1).fillRect(11 + i * 13, 31, 9, 4); }
    const t = this.timerBar; t.clear();
    if (boss && store.rt.monster?.boss) {
      const k = Math.max(0, s.bossT / E.bossTime(s));
      t.fillStyle(0x000000, 0.7).fillRect(10, 30, 140, 8); t.fillStyle(k < 0.3 ? 0xff3a2a : 0xffa02a, 1).fillRect(11, 31, 138 * k, 6);
      this.stageText.setText(`BOSS · ${Math.ceil(s.bossT)}s`);
    }
    const f = this.frenzyBar; f.clear();
    const fk = s.frenzyT > 0 ? s.frenzyT / 15 : s.frenzy / 100;
    const fw = Math.min(160, this.W * 0.42), fx = this.W - fw - 10, fy = this.H - 14;
    f.fillStyle(0x000000, 0.7).fillRect(fx - 1, fy - 1, fw + 2, 8);
    f.fillStyle(s.frenzyT > 0 ? 0xff4ad0 : 0xb06aff, 1).fillRect(fx, fy, fw * fk, 6);
    if (!this.frenzyLabel) this.frenzyLabel = this.add.text(0, 0, '', { fontFamily: SANS, fontStyle: 'bold', resolution: DPR, fontSize: '13px', color: '#e8d0ff', stroke: '#000', strokeThickness: 3 }).setOrigin(1, 1).setDepth(101);
    this.frenzyLabel.setPosition(this.W - 10, fy - 2).setText(s.frenzyT > 0 ? `FRENZY x2  ${Math.ceil(s.frenzyT)}s` : 'Hold to charge Frenzy');
    const gl = this.frenzyGlow; gl.clear();
    if (s.frenzyT > 0) { const a = 0.35 + 0.25 * Math.sin(this.time.now / 120); gl.lineStyle(8, 0xff4ad0, a).strokeRect(4, 4, this.W - 8, this.H - 8); }
    // shield wall
    const sh = store.rt.shield > 0 && this.heroes.size;
    this.shieldFx.setVisible(!!sh);
    if (sh) { const xs = [...this.heroes.values()].map((v) => v.x); const cx = (Math.min(...xs) + Math.max(...xs)) / 2; this.shieldFx.setPosition(cx, this.groundY - 30).setSize(Math.max(...xs) - Math.min(...xs) + 110, 120).setAlpha(0.6 + 0.2 * Math.sin(this.time.now / 150)); }
    for (const v of this.heroes.values()) if (v.id === 'barbarian') { if (store.rt.rage > 0) v.spr.setTint(Math.sin(this.time.now / 80) > 0 ? 0xff6a5a : 0xffffff); else if (!v.down) v.spr.clearTint(); }
  }
  frenzyLabel: any;

  // ---------- effects ----------
  num(x: number, y: number, text: string, color: string, size = 16, crit = false) {
    if (!store.s.settings.dmgNums) return;
    if (!crit && this.numBudget <= 0) return;
    this.numBudget--;
    const t = this.add.text(x + Phaser.Math.Between(-18, 18), y, text, { fontFamily: SANS, resolution: DPR, fontSize: `${size}px`, color, stroke: '#000', strokeThickness: 4, fontStyle: crit ? '900' : 'bold' }).setOrigin(0.5).setDepth(90);
    t.setScale(crit ? 1.6 : 1.2);
    this.tweens.add({ targets: t, scale: 1, duration: 120, ease: 'Back.Out' });
    this.tweens.add({ targets: t, y: y - 46, alpha: 0, duration: 800, delay: 200, ease: 'Cubic.Out', onComplete: () => t.destroy() });
  }
  burst(x: number, y: number, color: number, n = 10, speed = 140) {
    for (let i = 0; i < n; i++) {
      const p = this.add.image(x, y, 'px').setTint(color).setDepth(80).setScale(Phaser.Math.FloatBetween(1, 2));
      const a = Math.random() * Math.PI * 2, v = Phaser.Math.FloatBetween(speed * 0.3, speed);
      this.tweens.add({ targets: p, x: x + Math.cos(a) * v * 0.5, y: y + Math.sin(a) * v * 0.5 - 10, alpha: 0, duration: Phaser.Math.Between(300, 600), ease: 'Cubic.Out', onComplete: () => p.destroy() });
    }
  }
  sparkle(x: number, y: number, color: number, n = 8) {
    for (let i = 0; i < n; i++) {
      const p = this.add.image(x + Phaser.Math.Between(-20, 20), y + Phaser.Math.Between(-10, 20), 'px').setTint(color).setDepth(80).setScale(2);
      this.tweens.add({ targets: p, y: p.y - Phaser.Math.Between(20, 50), alpha: 0, duration: Phaser.Math.Between(500, 900), ease: 'Sine.Out', onComplete: () => p.destroy() });
    }
  }
  shake(ms: number, k: number) { if (store.s.settings.shake) this.cameras.main.shake(ms, k); }
  lastFlash = 0;
  flashMon(strong = false) {
    const m = this.mon; if (!m) return;
    const now = this.time.now; if (now - this.lastFlash < (strong ? 90 : 220)) return; this.lastFlash = now;
    if (strong) m.setTintFill(0xffffff); else m.setTint(0xff8a8a);
    this.time.delayedCall(strong ? 50 : 70, () => m.active && m.clearTint());
    const base = this.monX;
    this.tweens.add({ targets: m, x: base + 6, duration: 40, yoyo: true, onComplete: () => m.active && (m.x = base) });
  }
  lunge(v: HeroView) {
    if (v.down) return;
    if (MELEE.has(v.id)) this.tweens.add({ targets: v.spr, x: v.x + 26, duration: 80, yoyo: true, ease: 'Quad.Out', onComplete: () => (v.spr.x = v.x) });
    else this.tweens.add({ targets: v.spr, x: v.x - 6, duration: 70, yoyo: true, onComplete: () => (v.spr.x = v.x) });
  }
  projectile(from: HeroView, frame: string, opts: { scale?: number; tint?: number; arc?: number; dur?: number; spin?: boolean; onHit?: () => void } = {}) {
    if (!this.mon) return;
    const x0 = from.x + 14, y0 = from.y - 40, x1 = this.monX - 10, y1 = this.groundY - 50 + Phaser.Math.Between(-10, 10);
    const p = this.add.image(x0, y0, 'a', frame).setScale(opts.scale ?? 1.5).setDepth(70);
    if (opts.tint) p.setTint(opts.tint);
    p.rotation = Math.atan2(y1 - y0, x1 - x0) + (frame.startsWith('fx_arrow') ? Math.PI / 4 : 0);
    const d = { k: 0 };
    this.tweens.add({ targets: d, k: 1, duration: opts.dur ?? 180, ease: 'Linear', onUpdate: () => { p.x = x0 + (x1 - x0) * d.k; p.y = y0 + (y1 - y0) * d.k - Math.sin(d.k * Math.PI) * (opts.arc ?? 12); if (opts.spin) p.rotation += 0.3; },
      onComplete: () => { p.destroy(); opts.onHit?.(); } });
  }
  banner(text: string, sub = '', color = '#ffd34d', big = false) {
    const y = this.H * 0.42;
    const bgc = this.add.rectangle(this.W / 2, y, this.W, big ? 64 : 40, 0x000000, 0.65).setDepth(110);
    const t = this.add.text(this.W / 2, y - (sub ? 8 : 0), text, { fontFamily: SANS, fontStyle: 'bold', resolution: DPR, fontSize: big ? '28px' : '20px', color, stroke: '#000', strokeThickness: 5 }).setOrigin(0.5).setDepth(111);
    const st = sub ? this.add.text(this.W / 2, y + (big ? 18 : 12), sub, { fontFamily: SANS, fontStyle: 'bold', resolution: DPR, fontSize: '14px', color: '#e8dcc8', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5).setDepth(111) : null;
    const items = [bgc, t, st].filter(Boolean);
    items.forEach((o: any) => { o.setAlpha(0); });
    t.setScale(0.6);
    this.tweens.add({ targets: items, alpha: 1, duration: 160 });
    this.tweens.add({ targets: t, scale: 1, duration: 260, ease: 'Back.Out' });
    this.tweens.add({ targets: items, alpha: 0, duration: 300, delay: big ? 1800 : 1100, onComplete: () => items.forEach((o: any) => o.destroy()) });
  }
  coins(n: number) {
    if (!this.mon) return;
    for (let i = 0; i < n; i++) {
      const c = this.add.image(this.monX, this.groundY - 30, 'a', 'gold' + Phaser.Math.Between(0, 2)).setScale(1.4).setDepth(85);
      const dx = Phaser.Math.Between(-50, 50), up = Phaser.Math.Between(30, 70);
      this.tweens.add({ targets: c, x: c.x + dx, y: c.y - up, duration: 260, ease: 'Quad.Out', onComplete: () => {
        this.tweens.add({ targets: c, x: c.x, y: this.groundY + 10, duration: 220, ease: 'Bounce.Out', onComplete: () => {
          this.tweens.add({ targets: c, x: 30, y: -10, scale: 0.6, duration: 420, delay: 120 + i * 30, ease: 'Cubic.In', onComplete: () => { c.destroy(); if (i === 0) sfx('coin'); } });
        } });
      } });
    }
  }
  lootPop(icon: string, rarity: number) {
    const x = this.monX + Phaser.Math.Between(-30, 30), y = this.groundY - 40;
    const col = Phaser.Display.Color.HexStringToColor(RARITIES[rarity].color).color;
    if (rarity >= 2) {
      const beam = this.add.rectangle(x, this.groundY - 140, 18, 280, col, 0.35).setDepth(75).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: beam, alpha: 0, scaleX: 0.2, duration: 1400, onComplete: () => beam.destroy() });
    }
    const glow = this.add.image(x, y, 'dot').setTint(col).setAlpha(0.55).setScale(1.2).setDepth(86).setBlendMode(Phaser.BlendModes.ADD);
    const it = this.add.image(x, y, 'a', icon).setScale(1.8).setDepth(87);
    this.tweens.add({ targets: [it, glow], y: y - 40, duration: 260, ease: 'Quad.Out', yoyo: true, onComplete: () => {
      this.tweens.add({ targets: [it, glow], x: this.W / 2, y: this.H + 20, scale: 0.8, alpha: 0.2, duration: 600, delay: 450, ease: 'Cubic.In', onComplete: () => { it.destroy(); glow.destroy(); } });
    } });
    sfx(rarity >= 2 ? 'rare' : 'loot');
  }

  // ---------- input ----------
  holdX = 0; holdY = 0; holdRing: any;
  onDown(p: any) {
    const s = store.s; if (!s.started) return;
    this.holdX = p.x; this.holdY = p.y;
    E.setHolding(store.rt, true);
  }
  onUp() { E.setHolding(store.rt, false); this.holdRing?.clear(); }
  strikeFx() {
    sfx('tap', 0.05);
    const x = this.holdX + Phaser.Math.Between(-14, 14), y = this.holdY + Phaser.Math.Between(-14, 14);
    const slash = this.add.image(x, y, 'px').setScale(1).setDepth(95).setTint(store.s.frenzyT > 0 ? 0xff8ae0 : 0xffffff);
    this.tweens.add({ targets: slash, scaleX: 14, scaleY: 1.5, angle: Phaser.Math.Between(-60, 60), alpha: 0, duration: 160, onComplete: () => slash.destroy() });
    if (navigator.vibrate) try { navigator.vibrate(3); } catch (_) {}
  }
  drawHold() {
    const g = this.holdRing; if (!g) return; g.clear();
    if (!store.rt.holding) return;
    const s = store.s, x = this.holdX, y = this.holdY, t = this.time.now;
    const k = s.frenzyT > 0 ? s.frenzyT / E.FRENZY_TIME : s.frenzy / 100;
    const col = s.frenzyT > 0 ? 0xff4ad0 : 0xb06aff;
    g.lineStyle(4, 0x000000, 0.5).strokeCircle(x, y, 30);
    g.lineStyle(4, col, 1).beginPath().arc(x, y, 30, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k).strokePath();
    g.fillStyle(col, 0.12 + 0.08 * Math.sin(t / 90)).fillCircle(x, y, 26);
  }

  // ---------- event handling ----------
  handle(e: any) {
    const v = e.hero ? this.heroes.get(e.hero) : null;
    switch (e.t) {
      case 'hit': {
        this.flashMon(!!(e.tap || e.crit));
        if (e.tap) { this.strikeFx(); this.num(this.monX, this.groundY - 90, E.fmt(e.dmg), '#b8f0ff', 14, e.crit); break; }
        if (v && !e.ability) {
          this.lunge(v);
          if (e.hero === 'ranger') this.projectile(v, 'fx_arrow0', { scale: 1.6, arc: 10 });
          else if (e.hero === 'mage') this.projectile(v, 'fx_flame0', { scale: 1.1, arc: 4, spin: true });
        }
        if (e.ability && e.hero === 'ranger') { const vv = v!; this.time.delayedCall((e.volley || 0) * 70, () => this.projectile(vv, 'fx_arrow0', { scale: 1.8, arc: 26, tint: 0xfff0a0 })); }
        const col = e.crit ? '#ffd34d' : '#ffffff';
        this.num(this.monX, this.groundY - 100, E.fmt(e.dmg) + (e.crit ? '!' : ''), col, e.crit ? 22 : 15, e.crit || e.ability);
        if (e.crit) { sfx('crit', 0.08); this.shake(80, 0.004); this.burst(this.monX, this.groundY - 60, 0xffe08a, 8); } else sfx('hit', 0.06);
        break;
      }
      case 'ability': {
        const hv = this.heroes.get(e.id); if (!hv) break;
        const name = HERO[e.id as HeroId].ability.name;
        this.num(hv.x, hv.y - 96, name + '!', HERO[e.id as HeroId].color, 14, true);
        this.tweens.add({ targets: hv.spr, scale: 3, duration: 120, yoyo: true });
        if (e.kind === 'burst') { this.projectile(hv, 'fx_flame0', { scale: 3.2, arc: 30, dur: 320, onHit: () => { this.burst(this.monX, this.groundY - 60, 0xff7a2b, 26, 220); this.shake(160, 0.008); } }); sfx('fire'); }
        if (e.kind === 'heal') { for (const o of this.heroes.values()) { this.sparkle(o.x, o.y - 30, 0x8fffa0, 10); this.num(o.x, o.y - 70, '+', '#8fffa0', 18, true); } sfx('heal'); }
        if (e.kind === 'shield') { sfx('blip'); }
        if (e.kind === 'crit') { const ox = hv.x; this.tweens.add({ targets: hv.spr, x: this.monX - 50, duration: 90, yoyo: true, hold: 120, onComplete: () => (hv.spr.x = ox) }); this.burst(this.monX, this.groundY - 60, 0xc08bff, 14); }
        if (e.kind === 'rage') { this.burst(hv.x, hv.y - 40, 0xff4a3a, 16); this.shake(120, 0.005); sfx('frenzy'); }
        break;
      }
      case 'mhit': {
        const hv = this.heroes.get(e.id); if (!hv) break;
        hv.spr.setTintFill(0xff5a4a); this.time.delayedCall(70, () => !hv.down && hv.spr.clearTint());
        if (this.mon) this.tweens.add({ targets: this.mon, x: this.monX - 26, duration: 90, yoyo: true, ease: 'Quad.Out', onComplete: () => this.mon && (this.mon.x = this.monX) });
        this.num(hv.x, hv.y - 80, '-' + E.fmt(e.dmg), '#ff7a6a', 13, false);
        sfx('hurt', 0.12);
        break;
      }
      case 'down': this.shake(120, 0.006); break;
      case 'spawn': this.syncMonster(); if (e.boss) { this.banner('Boss!', store.rt.monster?.name || '', '#ff8a5a', true); sfx('boss'); this.shake(300, 0.01); } break;
      case 'kill': {
        const m = this.mon; this.mon = null; this.monId = -1;
        if (m) {
          this.tweens.killTweensOf(m);
          m.setTintFill(0xffffff);
          this.tweens.add({ targets: m, scaleX: m.scaleX * 1.3, scaleY: 0.1, alpha: 0, duration: 260, ease: 'Quad.In', onComplete: () => m.destroy() });
          this.burst(this.monX, this.groundY - 40, 0xffffff, e.boss ? 40 : 14, e.boss ? 260 : 150);
        }
        this.monShadow?.destroy();
        this.coins(e.boss ? 14 : 3 + Math.min(4, Math.floor(Math.random() * 3)));
        if (e.boss) { this.shake(300, 0.012); this.banner('Boss defeated!', '', '#ffd34d', true); }
        break;
      }
      case 'drop': this.lootPop(e.icon, e.rarity); break;
      case 'stage': if (e.newBiome) { const b = biomeOf(store.s.stage); this.banner(b.name, `Stage ${store.s.stage}`, '#ffe9a0', true); this.layout(); } else if (!E.isBossStage(store.s.stage)) this.num(this.W / 2, 70, `Stage ${store.s.stage}`, '#ffe9a0', 16, true); break;
      case 'bossFail': this.banner('The boss escaped!', 'Farming the previous stage to get stronger', '#ff6a5a'); this.mon?.destroy(); this.mon = null; this.monShadow?.destroy(); this.monId = -1; break;
      case 'wipe': this.banner('Party defeated!', 'Regrouping one stage back', '#ff6a5a'); this.cameras.main.flash(300, 0, 0, 0); this.mon?.destroy(); this.mon = null; this.monShadow?.destroy(); this.monId = -1; break;
      case 'retry': this.num(this.W / 2, 70, 'Pushing forward again!', '#9ad1ff', 14, true); break;
      case 'frenzy': this.banner('FRENZY!', 'Double damage and gold for 15s', '#ff6ad0', true); sfx('frenzy'); this.shake(200, 0.008); break;
      case 'eat': { this.sparkle(this.W * 0.27, this.groundY - 40, 0xffd08a, 12); const ic = this.add.image(this.W * 0.27, this.groundY - 90, 'a', FOODS[e.food].icon).setScale(2).setDepth(90); this.tweens.add({ targets: ic, y: ic.y - 30, alpha: 0, duration: 900, onComplete: () => ic.destroy() }); sfx('heal'); break; }
      case 'ascend': this.cameras.main.flash(600, 255, 240, 200); this.banner('Ascended!', `+${E.fmt(e.souls)} Souls`, '#ffe9a0', true); this.layout(true); break;
    }
    this.onUiEvent(e);
  }

  update(_t: number, deltaMs: number) {
    const s = store.s;
    if (!s.started) return;
    this.acc += Math.min(0.25, deltaMs / 1000);
    this.numBudget = Math.min(12, this.numBudget + deltaMs / 90);
    let n = 0;
    while (this.acc >= STEP && n < 10) { E.tick(s, store.rt, STEP); this.acc -= STEP; n++; }
    if (n >= 10) this.acc = 0;
    const evs = store.rt.events.splice(0);
    for (const e of evs) { try { this.handle(e); } catch (err) { console.warn(err); } }
    if (Math.floor(s.stage / 10) % BIOMES.length !== this.biomeIdx && Math.floor((s.stage - 1) / 10) % BIOMES.length !== this.biomeIdx) this.layout();
    this.syncHeroes(); this.drawHold();
    this.syncMonster();
    this.drawHeroBars(); this.drawMonBar(); this.drawHud();
  }
}

export function startGame(parent: HTMLElement, onUiEvent: (e: any) => void) {
  const game = new Phaser.Game({
    type: Phaser.AUTO, parent, backgroundColor: '#14101c', pixelArt: true, roundPixels: true, antialias: false,
    scale: { mode: Phaser.Scale.RESIZE, width: parent.clientWidth, height: parent.clientHeight },
    scene: [BattleScene], audio: { noAudio: true }, fps: { target: 60 },
  });
  game.events.once('ready', () => { const sc = game.scene.getScene('battle') as BattleScene; sc.onUiEvent = onUiEvent; });
  const iv = setInterval(() => { const sc = game.scene.getScene('battle') as BattleScene; if (sc) { sc.onUiEvent = onUiEvent; clearInterval(iv); } }, 50);
  return game;
}
export { notify };
