// Canvas battle renderer: painted backdrops, weather, hero + companion + minions vs packs and bosses,
// readable boss telegraphs, status icons, skill VFX, damage numbers, loot beams. Honours accessibility settings.
import { CLASSES, COMPANIONS, RARITIES } from './data.js';
import { STATUS } from './skills.js';

const rand = (a, b) => a + Math.random() * (b - a);
const ELEM_COL = { phys: '#f0e6d2', fire: '#ff7a2b', cold: '#7ad0ff', lightning: '#ffe36b', arcane: '#c08bff', shadow: '#a05ae0', holy: '#ffe9a0', poison: '#7ad04a', nature: '#6fe07a' };
const WEATHER = { fireflies: '#c8ff7a', dust: '#d8c8a8', mist: '#ffdcc8', embers: '#ff7a2b', snow: '#ffffff', spores: '#d07aff', rain: '#7ae0ff', sparkles: '#fff0b0' };

const imgCache = new Map();
export function art(dir, name) {
  if (!name) return null;
  const key = dir + '/' + name;
  let e = imgCache.get(key);
  if (!e) {
    e = { img: new Image(), ok: false, white: null };
    e.img.onload = () => {
      e.ok = true;
      if (dir === 'bg') return;
      const c = document.createElement('canvas');
      c.width = e.img.naturalWidth; c.height = e.img.naturalHeight;
      const x = c.getContext('2d');
      x.drawImage(e.img, 0, 0);
      x.globalCompositeOperation = 'source-atop';
      x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
      e.white = c;
    };
    e.img.src = `assets/${key}.webp`;
    imgCache.set(key, e);
  }
  return e.ok ? e : null;
}

export class Arena {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'fx';
    this.ctx = this.canvas.getContext('2d');
    this.t = 0; this.parts = []; this.nums = []; this.fx = []; this.ambient = [];
    this.shake = 0; this.flash = null; this.banner = null;
    this.hero = { lunge: 0, hit: 0, cast: 0, castCol: '#ffffff', dodge: 0 };
    this.pet = { lunge: 0 };
    this.ep = new Map();   // enemy id -> visual state
    this.dying = [];
    this.weather = 'fireflies'; this.bg = null;
  }
  mount(el) { if (this.canvas.parentNode !== el) el.prepend(this.canvas); this.resize(); }
  resize() {
    const r = this.canvas.parentNode ? this.canvas.parentNode.getBoundingClientRect() : { width: 360, height: 260 };
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.round(r.width), h = Math.round(r.height);
    if (this.w === w && this.h === h) return;
    this.w = w; this.h = h; this.dpr = dpr;
    this.canvas.width = w * dpr; this.canvas.height = h * dpr;
    this.canvas.style.width = w + 'px'; this.canvas.style.height = h + 'px';
    this.ambient = [];
  }
  setScene(bg, weather) { if (bg !== this.bg) { this.bg = bg; this.ambient = []; } this.weather = weather || 'dust'; }
  get gy() { return this.h * 0.88; }
  get heroH() { return this.h * 0.42; }
  get hx() { return this.w * 0.22; }
  get hy() { return this.gy - this.heroH * 0.5; }
  opt(s) { this.S = s || {}; }
  get reduced() { return this.S?.effects === 'reduced'; }

  // ---------- particles ----------
  burst(x, y, color, n = 12, speed = 120, size = 3, life = 0.6, grav = 200) {
    if (this.reduced) n = Math.ceil(n / 3);
    for (let i = 0; i < n && this.parts.length < 300; i++) {
      const a = rand(0, Math.PI * 2), v = rand(speed * 0.3, speed);
      this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - speed * 0.3, c: color, s: rand(size * 0.5, size), life: rand(life * 0.6, life), age: 0, g: grav });
    }
  }
  ring(x, y, color, r0, r1, life = 0.5, width = 4) { this.fx.push({ k: 'ring', x, y, c: color, r0, r1, life, age: 0, w: width }); }
  num(x, y, text, color, size = 15, crit = false) {
    const mode = this.S?.dmgNums || 'all';
    if (mode === 'off') return;
    if (mode === 'crits' && !crit && !/[+A-Za-z!]/.test(text)) return;
    if (this.nums.length > (mode === 'all' ? 16 : 8)) this.nums.shift();
    this.nums.push({ x: x + rand(-16, 16), y, text, c: color, s: size, age: 0, life: 0.9 });
  }
  shakeIt(n) { if (this.S?.shake !== false) this.shake = Math.max(this.shake, n); }
  flashIt(c, t, a) { if (!this.reduced) this.flash = { c, t, a }; }

  // ---------- layout ----------
  layout(enemies) {
    const alive = enemies.filter((e) => e.hp > 0);
    const n = alive.length;
    alive.forEach((e, i) => {
      let v = this.ep.get(e.id);
      if (!v) { v = { spawn: 0, hit: 0, kb: 0, x: 0, lunge: 0 }; this.ep.set(e.id, v); }
      const big = e.boss;
      v.size = this.h * (big ? 0.66 : e.elite ? 0.4 : 0.32);
      const tx = big ? this.w * 0.72 : n === 1 ? this.w * 0.72 : this.w * (0.56 + (i / Math.max(1, n - 1)) * 0.34);
      v.x = v.x ? v.x + (tx - v.x) * 0.15 : tx;
      v.foot = this.gy + (big ? 2 : (i % 2) * 8 - 2);
      v.cy = v.foot - v.size * 0.5;
    });
    for (const id of [...this.ep.keys()]) if (!alive.some((e) => e.id === id)) { if (!this.dying.some((d) => d.id === id)) this.ep.delete(id); }
    return alive;
  }
  pos(id) { const v = this.ep.get(id); return v ? { x: v.x, y: v.cy } : { x: this.w * 0.72, y: this.gy - this.h * 0.2 }; }

  drawArt(entry, emoji, cx, footY, height, white, flip = false) {
    const x = this.ctx;
    if (entry) {
      const im = entry.img, k = height / im.naturalHeight, w = im.naturalWidth * k;
      x.save();
      if (flip) { x.translate(cx, 0); x.scale(-1, 1); x.translate(-cx, 0); }
      x.drawImage(im, cx - w / 2, footY - height, w, height);
      if (white > 0 && entry.white) { x.globalAlpha *= white; x.drawImage(entry.white, cx - w / 2, footY - height, w, height); }
      x.restore();
      return w;
    }
    x.font = `${Math.round(height * 0.5)}px serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(emoji || '❔', cx, footY - height * 0.4); x.textBaseline = 'alphabetic';
    return height * 0.6;
  }
  shadow(x0, y0, r) { const x = this.ctx; x.fillStyle = 'rgba(0,0,0,0.45)'; x.beginPath(); x.ellipse(x0, y0 - 2, Math.max(1, r), Math.max(1, r * 0.22), 0, 0, 7); x.fill(); }
  aura(x0, y0, col, r) { const x = this.ctx; r = Math.max(2, r); const g = x.createRadialGradient(x0, y0, r * 0.2, x0, y0, r); g.addColorStop(0, col + '55'); g.addColorStop(1, col + '00'); x.fillStyle = g; x.beginPath(); x.arc(x0, y0, r, 0, 7); x.fill(); }

  // ---------- events ----------
  onEvent(e, state) {
    const { hx, hy } = this;
    switch (e.t) {
      case 'hit': {
        const p = this.pos(e.id), v = this.ep.get(e.id);
        if (v) { v.hit = 0.1; v.kb = e.crit ? 10 : 4; }
        if (!e.dot && !e.pet && !e.minion) this.hero.lunge = Math.max(this.hero.lunge, 0.12);
        const col = ELEM_COL[e.elem] || '#ffffff';
        if (!e.dot) this.burst(p.x + rand(-10, 10), p.y + rand(-14, 14), e.crit ? '#ffd34d' : col, e.crit ? 12 : 5, e.crit ? 200 : 110, e.crit ? 3.5 : 2.5, 0.4, 300);
        this.num(p.x, p.y - 30, fmtN(e.dmg), e.crit ? '#ffd34d' : e.dot ? (col) : e.pet || e.minion ? '#ffe08a' : '#ffffff', e.crit ? 22 : e.dot ? 11 : 14, e.crit);
        if (e.crit) { this.shakeIt(3); this.fx.push({ k: 'slash', x: p.x, y: p.y, a: rand(-0.6, 0.6), life: 0.22, age: 0, c: '#ffe8a0', r: 36 }); }
        break;
      }
      case 'cast': this.castFx(e, state); break;
      case 'heal': this.num(hx, hy - 50, '+' + fmtN(e.n), '#6fe07a', 14, true); this.burst(hx, hy, '#8fffa0', 8, 60, 2.5, 0.8, -90); break;
      case 'hurt':
        this.hero.hit = 0.12;
        this.burst(hx, hy, '#ff4a3a', e.big ? 18 : 5, e.big ? 200 : 90, 3, 0.5, 300);
        this.num(hx, hy - 40, '-' + fmtN(e.dmg), '#ff6b5e', e.big ? 20 : 13, e.big);
        if (e.big) { this.shakeIt(9); this.flashIt('#ff2020', 0.25, 0.25); this.ring(hx, this.gy, '#ff5040', 10, 90, 0.4, 6); }
        break;
      case 'eatk': { const v = this.ep.get(e.id); if (v) v.lunge = 0.18; break; }
      case 'dodge': this.hero.dodge = 0.4; this.num(hx, hy - 50, 'Dodged!', '#9ad1ff', 16, true); break;
      case 'kill': {
        const v = this.ep.get(e.id), en = state.combat?.enemies.find((x) => x.id === e.id);
        if (v && en) this.dying.push({ id: e.id, age: 0, x: v.x, foot: v.foot, size: v.size, art: en.art });
        const p = this.pos(e.id);
        this.burst(p.x, p.y, '#ffffff', e.boss ? 50 : 14, e.boss ? 260 : 150, 3.5, 0.8, 150);
        if (e.boss) { this.shakeIt(10); this.flashIt('#ffd34d', 0.4, 0.3); this.banner = { text: 'Boss defeated!', sub: '', t: 2, c: '#ffd34d' }; }
        break;
      }
      case 'status': { const p = this.pos(e.id); this.num(p.x, p.y - 56, STATUS[e.k].name, STATUS[e.k].color, 11, true); break; }
      case 'tele': { const p = this.pos(e.id); this.banner = { text: '⚠ ' + e.name, sub: 'Incoming!', t: 1.4, c: '#ff5a4a' }; this.ring(p.x, p.y, '#ff3a2a', 20, 70, 0.4, 4); break; }
      case 'teleHit': this.shakeIt(10); this.flashIt('#ff7a2b', 0.25, 0.2); break;
      case 'phase': this.banner = { text: e.name, sub: e.n === 9 ? 'The boss is enraged!' : `Phase ${e.n}`, t: 2.2, c: '#ff8ad0' }; this.shakeIt(10); this.flashIt('#ff3bd0', 0.4, 0.3); break;
      case 'bossShield': { const p = this.pos(e.id); this.ring(p.x, p.y, '#9ad8ff', 30, 90, 0.6, 6); this.num(p.x, p.y - 70, 'Shielded!', '#9ad8ff', 15, true); break; }
      case 'summon': this.burst(this.w * 0.75, this.gy - 20, '#8a6aff', 18, 120, 3, 0.7, -40); break;
      case 'smite': for (const id of this.ep.keys()) { const p = this.pos(id); this.fx.push({ k: 'beam', x: p.x, c: '#fff3b0', life: 0.5, age: 0 }); } break;
      case 'blaze': case 'explode': for (const id of this.ep.keys()) { const p = this.pos(id); this.ring(p.x, p.y, '#ff7a2b', 8, 60, 0.4, 5); this.burst(p.x, p.y, '#ff9a4a', 10, 160, 3, 0.5, 100); } break;
      case 'pet': this.pet.lunge = 0.2; break;
      case 'loot': if (e.rarity >= 2) this.fx.push({ k: 'beam', x: this.w * rand(0.55, 0.85), c: RARITIES[e.rarity].color, life: e.rarity >= 4 ? 2.6 : 1.4, age: 0, big: e.rarity >= 4 }); break;
      case 'level': this.ring(hx, hy, '#ffd34d', 10, 110, 0.8, 5); this.burst(hx, hy, '#ffd34d', 20, 160, 3, 1, -40); this.flashIt('#ffd34d', 0.3, 0.18); break;
      case 'death': this.flashIt('#000', 0.6, 0.5); this.banner = { text: 'Defeated', sub: 'Regrouping…', t: 2.5, c: '#ff6b5e' }; break;
      case 'wave': if (e.boss) this.banner = { text: 'Boss!', sub: '', t: 1.6, c: '#ff8a2b' }; break;
      case 'runEnd': if (e.win) this.flashIt('#ffd34d', 0.6, 0.35); break;
    }
  }

  castFx(e, state) {
    const { hx, hy, gy } = this;
    const col = ELEM_COL[e.elem] || '#ffffff';
    this.hero.cast = 0.35; this.hero.castCol = col;
    const targets = [...this.ep.keys()].map((id) => this.pos(id));
    const t0 = targets[0] || { x: this.w * 0.72, y: gy - 60 };
    switch (e.role) {
      case 'primary': case 'secondary': {
        const big = e.role === 'secondary';
        if (['phys'].includes(e.elem) && ['warrior', 'paladin'].includes(state.cls)) {
          this.fx.push({ k: 'slash', x: t0.x, y: t0.y, a: rand(-0.6, 0.6), life: 0.3, age: 0, c: col, r: big ? 60 : 44, wide: big });
        } else this.fx.push({ k: 'proj', x0: hx + 24, y0: hy - 10, x1: t0.x, y1: t0.y, life: 0.3, age: 0, c: col, c2: '#ffffff', r: big ? 12 : 7, onHit: () => { this.burst(t0.x, t0.y, col, big ? 22 : 10, 180, 3.5, 0.5, 100); if (big) this.ring(t0.x, t0.y, col, 8, 60, 0.35, 5); } });
        if (big) this.shakeIt(4);
        break;
      }
      case 'aoe':
        for (const p of targets) { this.ring(p.x, p.y, col, 8, 70, 0.45, 5); this.burst(p.x, p.y, col, 10, 160, 3, 0.6, 100); }
        this.ring(this.w * 0.72, gy - 4, col, 10, this.w * 0.3, 0.5, 6); this.shakeIt(4);
        break;
      case 'defensive': this.ring(hx, hy, col, 50, 40, 0.5, 7); this.burst(hx, hy, col, 16, 80, 2.5, 0.8, -60); break;
      case 'utility': this.ring(hx, hy, col, 10, 110, 0.6, 6); this.burst(hx, hy, col, 14, 120, 3, 0.8, -40); for (const p of targets) this.fx.push({ k: 'mark', x: p.x, y: p.y, life: 0.9, age: 0, c: col }); break;
      case 'ultimate':
        this.flashIt(col, 0.35, 0.35); this.shakeIt(14);
        for (let i = 0; i < 6; i++) this.fx.push({ k: 'proj', x0: rand(this.w * 0.45, this.w), y0: -30, x1: t0.x + rand(-40, 40), y1: gy - rand(10, 80), life: 0.4, age: -i * 0.08, c: col, c2: '#ffffff', r: 12, onHit: () => this.burst(t0.x, gy - 30, col, 18, 240, 4, 0.7, 200) });
        for (const p of targets) this.fx.push({ k: 'beam', x: p.x, c: col, life: 0.9, age: 0.2, big: true });
        this.banner = { text: SKILL_NAME(e.id), sub: 'Ultimate', t: 1.3, c: col };
        break;
    }
    if (e.echo) this.num(hx, hy - 70, 'Echo!', '#c08bff', 13, true);
  }

  // ---------- frame ----------
  frame(dt, state) { try { this._frame(dt, state); } catch (err) { console.warn('fx', err); try { this.ctx.restore(); } catch (_) {} } }
  _frame(dt, state) {
    if (!this.canvas.parentNode || !this.w) return;
    this.t += dt;
    const x = this.ctx, { w, h, gy } = this;
    const c = state.combat;
    x.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (this.shake > 0) { x.translate(rand(-this.shake, this.shake), rand(-this.shake, this.shake)); this.shake = Math.max(0, this.shake - dt * 40); }
    // background
    const bgE = art('bg', this.bg);
    if (bgE) {
      const im = bgE.img, k = Math.max(w / im.naturalWidth, h / im.naturalHeight) * 1.04;
      x.drawImage(im, (w - im.naturalWidth * k) / 2, (h - im.naturalHeight * k) * 0.8, im.naturalWidth * k, im.naturalHeight * k);
    } else { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#141020'); g.addColorStop(1, '#2a1e16'); x.fillStyle = g; x.fillRect(0, 0, w, h); }
    const vg = x.createRadialGradient(w / 2, h * 0.55, h * 0.25, w / 2, h * 0.55, w * 0.85);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.55)');
    x.fillStyle = vg; x.fillRect(0, 0, w, h);
    const fl = x.createLinearGradient(0, h * 0.72, 0, h); fl.addColorStop(0, 'rgba(0,0,0,0)'); fl.addColorStop(1, 'rgba(0,0,0,0.5)');
    x.fillStyle = fl; x.fillRect(0, h * 0.72, w, h * 0.28);
    if (!this.reduced) this.ambientTick(dt);
    if (!c) return;
    const hero = c.hero;
    for (const k of ['lunge', 'hit', 'cast', 'dodge']) this.hero[k] = Math.max(0, this.hero[k] - dt);
    this.pet.lunge = Math.max(0, this.pet.lunge - dt);
    const alive = this.layout(c.enemies);

    // telegraph ground markers (under everything)
    for (const e of alive) if (e.tele) {
      const k = 1 - e.tele.t / e.tele.total;
      x.save(); x.globalAlpha = 0.35 + 0.35 * Math.sin(this.t * 14);
      x.fillStyle = e.tele.kind === 'ultimate' ? '#ff2a6a' : '#ff3a2a';
      x.beginPath(); x.ellipse(this.hx, gy - 2, this.w * 0.16 * (0.4 + k * 0.6), this.h * 0.05, 0, 0, 7); x.fill(); x.restore();
      x.strokeStyle = '#ffd0c0'; x.lineWidth = 2; x.beginPath(); x.ellipse(this.hx, gy - 2, this.w * 0.16, this.h * 0.05, 0, 0, 7); x.stroke();
    }

    // companion
    const comp = state.companions?.active;
    if (comp) {
      const pl = this.pet.lunge > 0 ? Math.sin((this.pet.lunge / 0.2) * Math.PI) * 14 : 0;
      const pfoot = gy + 6, px = w * 0.07;
      this.shadow(px, pfoot, h * 0.05);
      const a = COMPANIONS[comp].art;
      this.drawArt(art(a[0], a[1]), '🐾', px + pl, pfoot + Math.sin(this.t * 4) * 2, h * 0.2, 0, a[0] === 'monsters');
    }
    // minions
    (hero.minions || []).forEach((m, i) => {
      const mx = w * (0.36 + (i % 3) * 0.05), mf = gy + 4 + (i >= 3 ? 6 : 0);
      const id = m.kind === 'skeleton' ? 'skeleton' : m.kind === 'demon' ? 'demonlord' : 'magmagolem';
      x.globalAlpha = Math.min(1, m.t);
      this.drawArt(art('monsters', id), '💀', mx, mf + Math.sin(this.t * 5 + i) * 1.5, h * (m.kind === 'skeleton' ? 0.16 : 0.24), 0, true);
      x.globalAlpha = 1;
    });
    // hero
    const H = this.heroH, hx = this.hx;
    const lunge = this.hero.lunge > 0 ? Math.sin((this.hero.lunge / 0.12) * Math.PI) * 12 : 0;
    const bob = Math.sin(this.t * 2.6) * 2;
    this.shadow(hx, gy, H * 0.22);
    const B = c.B || {};
    if (B.more || B.aspd) this.aura(hx, this.hy, '#ff4a3a', H * 0.5);
    if (B.dr) this.aura(hx, this.hy, '#9ad8ff', H * 0.48);
    if (this.hero.cast > 0) this.aura(hx, this.hy, this.hero.castCol, H * 0.6 * (0.6 + this.hero.cast));
    x.globalAlpha = hero.dead > 0 ? 0.25 : this.hero.dodge > 0 ? 0.5 : 1;
    this.drawArt(art('heroes', CLASSES[state.cls].art), CLASSES[state.cls].icon, hx + lunge + (this.hero.dodge > 0 ? -18 : 0), gy + bob, H, this.hero.hit > 0 ? 0.7 : 0);
    x.globalAlpha = 1;
    if (hero.shield > 0) {
      const cy = this.hy, g = x.createRadialGradient(hx, cy, H * 0.2, hx, cy, H * 0.55);
      g.addColorStop(0, 'rgba(255,190,90,0)'); g.addColorStop(0.8, 'rgba(255,190,90,0.15)'); g.addColorStop(1, 'rgba(255,220,140,0.5)');
      x.fillStyle = g; x.beginPath(); x.arc(hx, cy, H * 0.55 + Math.sin(this.t * 5) * 2, 0, 7); x.fill();
    }

    // enemies
    for (const e of alive) {
      const v = this.ep.get(e.id);
      v.spawn = Math.min(1, v.spawn + dt * 3.5); v.hit = Math.max(0, v.hit - dt); v.kb = Math.max(0, v.kb - dt * 60); v.lunge = Math.max(0, v.lunge - dt);
      const sc = Math.max(0.05, easeOutBack(v.spawn));
      const ex = v.x + v.kb - (v.lunge > 0 ? Math.sin((v.lunge / 0.18) * Math.PI) * 16 : 0);
      this.shadow(ex, v.foot, v.size * 0.28 * sc);
      if (e.boss) this.aura(ex, v.cy, e.enraged ? '#ff2020' : '#ff8a2b', v.size * 0.7 * (1 + Math.sin(this.t * (e.enraged ? 10 : 3)) * 0.06));
      else if (e.elite) this.aura(ex, v.cy, '#6b8cff', v.size * 0.6);
      x.save(); x.globalAlpha = v.spawn; x.translate(ex, v.foot); x.scale(sc, sc);
      this.drawArt(art(e.art[0], e.art[1]), '👹', 0, Math.sin(this.t * 2.2 + v.x) * 2, v.size, v.hit > 0 ? 0.75 : 0);
      x.restore();
      if (e.frozen > 0) { x.fillStyle = 'rgba(150,220,255,0.25)'; x.beginPath(); x.ellipse(ex, v.cy, v.size * 0.32, v.size * 0.48, 0, 0, 7); x.fill(); x.strokeStyle = 'rgba(200,240,255,0.7)'; x.lineWidth = 2; x.stroke(); }
      if (e.shieldT > 0) { x.strokeStyle = '#9ad8ff'; x.lineWidth = 4; x.globalAlpha = 0.6 + Math.sin(this.t * 8) * 0.2; x.beginPath(); x.arc(ex, v.cy, v.size * 0.5, 0, 7); x.stroke(); x.globalAlpha = 1; }
      // hp bar + statuses (bosses use the HUD bar)
      const top = v.foot - v.size - 6;
      if (!e.boss) {
        const bw = Math.min(64, v.size * 0.7);
        x.fillStyle = 'rgba(0,0,0,0.7)'; x.fillRect(ex - bw / 2 - 1, top - 1, bw + 2, 6);
        x.fillStyle = e.elite ? '#6b8cff' : '#d0392f'; x.fillRect(ex - bw / 2, top, bw * Math.max(0, e.hp / e.maxHp), 4);
        if (e.elite) { x.font = '11px serif'; x.textAlign = 'center'; x.fillText(e.mods.map((m) => MOD_ICON[m]).join(''), ex, top - 4); }
      }
      this.drawStatuses(e, ex, e.boss ? v.foot - v.size * 0.92 : top - (e.elite ? 16 : 4));
    }
    // dying
    for (let i = this.dying.length - 1; i >= 0; i--) {
      const d = this.dying[i];
      d.age += dt;
      const k = d.age / 0.45;
      if (k >= 1) { this.dying.splice(i, 1); this.ep.delete(d.id); continue; }
      x.save(); x.globalAlpha = 1 - k; x.translate(d.x, d.foot - k * 14); x.scale(1 + k * 0.2, 1 - k * 0.4);
      this.drawArt(art(d.art[0], d.art[1]), '👹', 0, 0, d.size, 0.9); x.restore();
    }
    // effects
    for (let i = this.fx.length - 1; i >= 0; i--) {
      const f = this.fx[i];
      f.age += dt;
      if (f.age < 0) continue;
      const k = f.age / f.life;
      if (k >= 1) { if (f.onHit) f.onHit(); this.fx.splice(i, 1); continue; }
      this.drawFx(f, k);
    }
    x.globalCompositeOperation = 'lighter';
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.age += dt;
      if (p.age > p.life) { this.parts.splice(i, 1); continue; }
      p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      const a = 1 - p.age / p.life;
      x.globalAlpha = a; x.fillStyle = p.c; x.beginPath(); x.arc(p.x, p.y, Math.max(0.5, p.s * (0.5 + a * 0.5)), 0, 7); x.fill();
    }
    x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';
    // numbers
    x.textAlign = 'center';
    const fs = this.S?.text === 'l' ? 1.2 : this.S?.text === 's' ? 0.9 : 1;
    for (let i = this.nums.length - 1; i >= 0; i--) {
      const n = this.nums[i];
      n.age += dt;
      if (n.age > n.life) { this.nums.splice(i, 1); continue; }
      const k = n.age / n.life, pop = k < 0.15 ? 1 + (0.15 - k) * 3 : 1;
      x.globalAlpha = k > 0.6 ? (1 - k) / 0.4 : 1;
      x.font = `900 ${Math.round(n.s * pop * fs)}px system-ui, sans-serif`;
      x.lineWidth = 3.5; x.strokeStyle = '#000'; x.lineJoin = 'round';
      const y = n.y - k * 40;
      x.strokeText(n.text, n.x, y); x.fillStyle = n.c; x.fillText(n.text, n.x, y);
    }
    x.globalAlpha = 1;
    // banner (phase / telegraph / boss)
    if (this.banner) {
      const b = this.banner; b.t -= dt;
      if (b.t <= 0) this.banner = null;
      else {
        x.globalAlpha = Math.min(1, b.t * 3);
        x.fillStyle = 'rgba(0,0,0,0.55)'; x.fillRect(0, h * 0.14, w, 46);
        x.font = `800 ${Math.round(20 * fs)}px Cinzel, Georgia, serif`; x.fillStyle = b.c; x.strokeStyle = '#000'; x.lineWidth = 4;
        x.strokeText(b.text, w / 2, h * 0.14 + 24); x.fillText(b.text, w / 2, h * 0.14 + 24);
        if (b.sub) { x.font = `600 ${Math.round(11 * fs)}px system-ui`; x.fillStyle = '#e8dcc8'; x.fillText(b.sub, w / 2, h * 0.14 + 40); }
        x.globalAlpha = 1;
      }
    }
    if (this.flash) {
      this.flash.t -= dt;
      if (this.flash.t <= 0) this.flash = null;
      else { x.globalAlpha = this.flash.a * Math.min(1, this.flash.t * 4); x.fillStyle = this.flash.c; x.fillRect(-20, -20, w + 40, h + 40); x.globalAlpha = 1; }
    }
    const lifeK = hero.dead > 0 ? 1 : hero.hp / c.st.hp;
    if (lifeK < 0.35 && !this.reduced) {
      const v2 = x.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, w * 0.7);
      v2.addColorStop(0, 'rgba(180,0,0,0)'); v2.addColorStop(1, `rgba(180,0,0,${(0.35 - lifeK) * (1.2 + Math.sin(this.t * 6) * 0.3)})`);
      x.fillStyle = v2; x.fillRect(0, 0, w, h);
    }
  }

  drawStatuses(e, cx, y) {
    const x = this.ctx;
    const list = Object.keys(e.st).filter((k) => STATUS[k]);
    if (e.frozen > 0) list.push('freeze');
    if (!list.length) return;
    const safe = this.S?.colorSafe;
    const step = safe ? 26 : 18;
    list.forEach((k, n) => {
      const ix = cx - (list.length - 1) * step / 2 + n * step;
      x.font = '13px serif'; x.textAlign = 'center';
      x.fillText(STATUS[k].icon, ix, y);
      if (safe) { x.font = '800 9px system-ui'; x.fillStyle = '#fff'; x.strokeStyle = '#000'; x.lineWidth = 3; x.strokeText(STATUS[k].letter, ix + 9, y + 3); x.fillText(STATUS[k].letter, ix + 9, y + 3); }
      if (k === 'poison' && e.st.poison) { x.font = '700 9px system-ui'; x.fillStyle = '#7ad04a'; x.fillText(e.st.poison.n, ix + 8, y + 4); }
    });
  }

  ambientTick(dt) {
    const { w, h } = this, kind = this.weather, col = WEATHER[kind] || '#fff';
    const target = { rain: 70, snow: 50, embers: 26, mist: 10, dust: 18, fireflies: 14, spores: 20, sparkles: 22 }[kind] || 15;
    while (this.ambient.length < target) {
      const a = { x: rand(0, w), y: rand(0, h), vx: 0, vy: 0, life: rand(2, 6), age: rand(0, 3), s: rand(1, 2.5) };
      if (kind === 'rain') { a.vx = -40; a.vy = rand(380, 460); a.y = rand(-h, 0); }
      if (kind === 'snow') { a.vx = rand(-20, 10); a.vy = rand(30, 70); a.y = rand(-h * 0.3, h); a.s = rand(1, 3); }
      if (kind === 'embers') { a.vx = rand(-10, 10); a.vy = rand(-40, -15); a.y = rand(h * 0.5, h); }
      if (kind === 'dust') { a.vx = rand(15, 40); a.vy = rand(-5, 5); }
      if (kind === 'mist') { a.vx = rand(5, 15); a.y = rand(h * 0.55, h * 0.85); a.s = rand(30, 60); }
      if (kind === 'fireflies' || kind === 'spores' || kind === 'sparkles') { a.vx = rand(-8, 8); a.vy = rand(-12, 4); }
      this.ambient.push(a);
    }
    const x = this.ctx;
    for (let i = this.ambient.length - 1; i >= 0; i--) {
      const a = this.ambient[i];
      a.age += dt; a.x += a.vx * dt; a.y += a.vy * dt;
      if (a.age > a.life || a.y > h + 10 || a.x > w + 60 || a.y < -h - 20) { this.ambient.splice(i, 1); continue; }
      const fade = Math.sin(Math.PI * Math.min(1, a.age / a.life));
      if (kind === 'rain') { x.strokeStyle = col + '55'; x.lineWidth = 1; x.beginPath(); x.moveTo(a.x, a.y); x.lineTo(a.x - 3, a.y + 10); x.stroke(); continue; }
      if (kind === 'mist') { x.fillStyle = `rgba(255,220,200,${0.05 * fade})`; x.beginPath(); x.ellipse(a.x, a.y, a.s, a.s * 0.3, 0, 0, 7); x.fill(); continue; }
      x.globalAlpha = fade * (kind === 'dust' ? 0.35 : 0.85); x.fillStyle = col;
      x.beginPath(); x.arc(a.x, a.y, a.s, 0, 7); x.fill(); x.globalAlpha = 1;
    }
  }

  drawFx(f, k) {
    const x = this.ctx;
    switch (f.k) {
      case 'ring': x.globalAlpha = 1 - k; x.strokeStyle = f.c; x.lineWidth = Math.max(0.5, f.w * (1 - k * 0.5)); x.beginPath(); x.arc(f.x, f.y, Math.max(0.5, f.r0 + (f.r1 - f.r0) * easeOut(k)), 0, 7); x.stroke(); x.globalAlpha = 1; break;
      case 'slash': {
        x.save(); x.translate(f.x, f.y); x.rotate(f.a); x.globalAlpha = 1 - k; x.globalCompositeOperation = 'lighter';
        x.strokeStyle = f.c; x.lineWidth = f.wide ? 7 : 4; x.lineCap = 'round';
        const sweep = Math.PI * (f.wide ? 1.1 : 0.7) * easeOut(Math.min(1, k * 2));
        x.beginPath(); x.arc(0, 0, f.r, -sweep / 2 - 0.6, sweep / 2 - 0.6); x.stroke(); x.restore(); x.globalAlpha = 1; break;
      }
      case 'proj': {
        const e = k * k, cx = f.x0 + (f.x1 - f.x0) * e, cy = f.y0 + (f.y1 - f.y0) * e;
        for (let i = 0; i < 5; i++) { const kk = Math.max(0, e - i * 0.05); x.globalAlpha = 0.5 - i * 0.09; x.fillStyle = f.c; x.beginPath(); x.arc(f.x0 + (f.x1 - f.x0) * kk, f.y0 + (f.y1 - f.y0) * kk, f.r * (1 - i * 0.14), 0, 7); x.fill(); }
        x.globalAlpha = 1;
        const g = x.createRadialGradient(cx, cy, 0, cx, cy, f.r * 1.8); g.addColorStop(0, '#fff'); g.addColorStop(0.35, f.c2); g.addColorStop(1, f.c + '00');
        x.fillStyle = g; x.beginPath(); x.arc(cx, cy, f.r * 1.8, 0, 7); x.fill(); break;
      }
      case 'beam': {
        const a = k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85, bw = f.big ? 16 : 10;
        const g = x.createLinearGradient(f.x - bw, 0, f.x + bw, 0); g.addColorStop(0, f.c + '00'); g.addColorStop(0.5, f.c); g.addColorStop(1, f.c + '00');
        x.globalAlpha = a * 0.75; x.globalCompositeOperation = 'lighter'; x.fillStyle = g; x.fillRect(f.x - bw, 0, bw * 2, this.gy);
        x.fillStyle = '#ffffff'; x.globalAlpha = a * 0.6; x.fillRect(f.x - 1.5, 0, 3, this.gy);
        x.globalAlpha = 1; x.globalCompositeOperation = 'source-over'; break;
      }
      case 'mark': {
        x.globalAlpha = (1 - k) * 0.9; x.strokeStyle = f.c || '#ff4a3a'; x.lineWidth = 2.5;
        const r = 26 + Math.sin(k * 20) * 2;
        x.beginPath(); x.arc(f.x, f.y, r, 0, 7); x.stroke(); x.globalAlpha = 1; break;
      }
    }
  }
}
const MOD_ICON = { tough: '🪨', explosive: '💥', venomous: '🐍', regen: '💚', frenzied: '💢', summoner: '🪦' };
let SKILL_NAME = (id) => id;
export const setSkillNamer = (f) => { SKILL_NAME = f; };
const easeOut = (k) => 1 - Math.pow(1 - k, 3);
const easeOutBack = (k) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2); };
export function fmtN(n) {
  if (n < 1000) return Math.round(n).toString();
  const u = ['K', 'M', 'B', 'T', 'Qa', 'Qi'];
  let i = -1; while (n >= 1000 && i < u.length - 1) { n /= 1000; i++; }
  return (n < 100 ? n.toFixed(1) : Math.round(n)) + u[i];
}
