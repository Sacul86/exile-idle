// Canvas battle renderer: zone backdrops, weather, animated sprites, skill VFX,
// particles, damage numbers, loot beams and screen shake.

const THEMES = [
  { sky: ['#1b1430', '#7a3b4a', '#d9825b'], hills: ['#2a1b2c', '#1a1220'], ground: ['#5a4630', '#2a2016'], fx: 'mist', tint: '#ffb37a' },  // Twilight Strand
  { sky: ['#1d2230', '#4a5568', '#8792a3'], hills: ['#2b2f3a', '#1b1e26'], ground: ['#4a4a4a', '#262626'], fx: 'dust', tint: '#c9d3e0' },   // Ledge
  { sky: ['#100c0c', '#2e1a14', '#5c2c1a'], hills: ['#241612', '#150d0b'], ground: ['#3b2a22', '#1a120e'], fx: 'embers', tint: '#ff7a2b' }, // Prisoner's Gate
  { sky: ['#0d1a14', '#1f3a2a', '#3f6a4a'], hills: ['#16281e', '#0c1712'], ground: ['#2f4a2c', '#16241a'], fx: 'fireflies', tint: '#c8ff7a' }, // Crossroads
  { sky: ['#120a1e', '#2e1648', '#5a2c7a'], hills: ['#20102e', '#12081c'], ground: ['#2e1f3a', '#160e1e'], fx: 'spores', tint: '#d07aff' },   // Chamber of Sins
  { sky: ['#2a1a0a', '#8a5a22', '#e0b060'], hills: ['#5a3c18', '#3a250e'], ground: ['#a07a40', '#5a4020'], fx: 'dust', tint: '#ffd27a' },    // Pyramid
  { sky: ['#080c18', '#18223e', '#2c3c6a'], hills: ['#121a30', '#0a0f1e'], ground: ['#262a36', '#12141c'], fx: 'embers', tint: '#7aa8ff' }, // Cathedral
  { sky: ['#140606', '#3a0c0c', '#6e1a1a'], hills: ['#2a0a0a', '#180606'], ground: ['#3a1212', '#1c0808'], fx: 'rain', tint: '#ff4a4a' },     // Blood Aqueduct
  { sky: ['#061418', '#0e2e36', '#2a5a62'], hills: ['#0c2228', '#061418'], ground: ['#1e3a3e', '#0e1e20'], fx: 'rain', tint: '#7ae0ff' },     // Harbour
  { sky: ['#1a1408', '#5a4a1a', '#f0e0a0'], hills: ['#3a3014', '#221c0c'], ground: ['#6a5a30', '#342c18'], fx: 'sparkles', tint: '#fff0b0' }, // Sceptre
];
const DUNGEON_THEME = { sky: ['#0a0806', '#1c140c', '#3a2614'], hills: ['#1a120a', '#0e0a06'], ground: ['#2e2216', '#140e08'], fx: 'embers', tint: '#ffa04a', walls: true };
const RAID_THEME = { sky: ['#0c0414', '#2a0a2e', '#6a1a4a'], hills: ['#1e0822', '#100414'], ground: ['#2a0e26', '#140612'], fx: 'sparkles', tint: '#ff5ad0', walls: true };
const RARITY_COLORS = ['#c8c8c8', '#6b8cff', '#f2d64b', '#b46bff', '#ff8a2b', '#ff3b5c'];

const rand = (a, b) => a + Math.random() * (b - a);
const spriteCache = new Map();
function sprite(emoji, size, flip) {
  const key = emoji + size + (flip ? 'f' : '');
  let c = spriteCache.get(key);
  if (c) return c;
  const pad = Math.ceil(size * 0.35);
  c = document.createElement('canvas');
  c.width = c.height = size + pad * 2;
  const x = c.getContext('2d');
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.font = `${size}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",serif`;
  if (flip) { x.translate(c.width, 0); x.scale(-1, 1); }
  x.fillText(emoji, c.width / 2, c.height / 2 + size * 0.05);
  // white silhouette used for hit flashes
  const w = document.createElement('canvas');
  w.width = w.height = c.width;
  const wx = w.getContext('2d');
  wx.drawImage(c, 0, 0);
  wx.globalCompositeOperation = 'source-atop';
  wx.fillStyle = '#fff'; wx.fillRect(0, 0, w.width, w.height);
  c.white = w;
  spriteCache.set(key, c);
  if (spriteCache.size > 80) spriteCache.delete(spriteCache.keys().next().value);
  return c;
}

export class Arena {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'fx';
    this.ctx = this.canvas.getContext('2d');
    this.t = 0;
    this.parts = [];   // particles
    this.nums = [];    // damage numbers
    this.fx = [];      // shapes: rings, slashes, projectiles, beams
    this.ambient = [];
    this.shake = 0;
    this.flash = null; // {color, t}
    this.p = { lunge: 0, hit: 0, evade: 0 };
    this.m = { obj: null, spawn: 0, hit: 0, kb: 0, dying: null };
    this.themeKey = null;
    this.bgCache = null;
  }

  mount(el) {
    if (this.canvas.parentNode !== el) el.prepend(this.canvas);
    this.resize();
  }
  resize() {
    const r = this.canvas.parentNode ? this.canvas.parentNode.getBoundingClientRect() : { width: 360, height: 200 };
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.round(r.width), h = Math.round(r.height);
    if (this.w === w && this.h === h) return;
    this.w = w; this.h = h; this.dpr = dpr;
    this.canvas.width = w * dpr; this.canvas.height = h * dpr;
    this.canvas.style.width = w + 'px'; this.canvas.style.height = h + 'px';
    this.bgCache = null;
    this.ambient = [];
  }

  get px() { return this.w * 0.26; }
  get mx() { return this.w * 0.74; }
  get gy() { return this.h * 0.8; }

  setTheme(state) {
    const key = state.run ? state.run.kind : 'z' + (Math.floor((state.stage - 1) / 10) % THEMES.length);
    if (key === this.themeKey) return;
    this.themeKey = key;
    this.theme = state.run ? (state.run.kind === 'raid' ? RAID_THEME : DUNGEON_THEME) : THEMES[Math.floor((state.stage - 1) / 10) % THEMES.length];
    this.bgCache = null;
    this.ambient = [];
  }

  // ---- background (cached) ----
  drawBg() {
    const { w, h, dpr, theme: th } = this;
    if (!this.bgCache) {
      const c = document.createElement('canvas');
      c.width = w * dpr; c.height = h * dpr;
      const x = c.getContext('2d');
      x.scale(dpr, dpr);
      const g = x.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, th.sky[0]); g.addColorStop(0.55, th.sky[1]); g.addColorStop(0.8, th.sky[2]);
      x.fillStyle = g; x.fillRect(0, 0, w, h);
      // moon / sun glow
      const sg = x.createRadialGradient(w * 0.68, h * 0.32, 0, w * 0.68, h * 0.32, h * 0.5);
      sg.addColorStop(0, th.tint + '55'); sg.addColorStop(1, th.tint + '00');
      x.fillStyle = sg; x.fillRect(0, 0, w, h);
      x.fillStyle = th.tint + 'cc';
      x.beginPath(); x.arc(w * 0.68, h * 0.3, h * 0.07, 0, 7); x.fill();
      // stars
      x.fillStyle = '#ffffff';
      for (let i = 0; i < 40; i++) { x.globalAlpha = rand(0.1, 0.6); x.fillRect(rand(0, w), rand(0, h * 0.45), 1.2, 1.2); }
      x.globalAlpha = 1;
      if (th.walls) {
        // dungeon: pillars and arches
        x.fillStyle = th.hills[0];
        for (let i = 0; i < 5; i++) {
          const px = (i + 0.5) * w / 5;
          x.fillRect(px - 10, h * 0.15, 20, h);
          x.beginPath(); x.arc(px + w / 10, h * 0.22, w / 10 - 10, Math.PI, 0); x.lineWidth = 8; x.strokeStyle = th.hills[0]; x.stroke();
        }
        // torches
        for (let i = 0; i < 5; i++) {
          const px = (i + 0.5) * w / 5;
          const tg = x.createRadialGradient(px, h * 0.42, 0, px, h * 0.42, 40);
          tg.addColorStop(0, th.tint + 'aa'); tg.addColorStop(1, th.tint + '00');
          x.fillStyle = tg; x.fillRect(px - 40, h * 0.42 - 40, 80, 80);
        }
      } else {
        // two parallax hill layers
        [[0.52, 0.22, th.hills[0], 3], [0.64, 0.16, th.hills[1], 5]].forEach(([base, amp, col, n], li) => {
          x.fillStyle = col; x.beginPath(); x.moveTo(0, h);
          for (let px = 0; px <= w; px += 6) {
            const y = h * base - Math.abs(Math.sin(px / w * Math.PI * n + li * 2)) * h * amp * (0.6 + 0.4 * Math.sin(px / 37 + li));
            x.lineTo(px, y);
          }
          x.lineTo(w, h); x.fill();
        });
      }
      // ground
      const gg = x.createLinearGradient(0, h * 0.74, 0, h);
      gg.addColorStop(0, th.ground[0]); gg.addColorStop(1, th.ground[1]);
      x.fillStyle = gg;
      x.beginPath(); x.moveTo(0, h * 0.76);
      for (let px = 0; px <= w; px += 10) x.lineTo(px, h * 0.76 + Math.sin(px / 23) * 2);
      x.lineTo(w, h); x.lineTo(0, h); x.fill();
      // ground speckles
      for (let i = 0; i < 60; i++) { x.fillStyle = `rgba(0,0,0,${rand(0.1, 0.3)})`; x.fillRect(rand(0, w), rand(h * 0.78, h), rand(2, 6), 1.5); }
      // vignette
      const vg = x.createRadialGradient(w / 2, h * 0.6, h * 0.3, w / 2, h * 0.6, w * 0.75);
      vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.55)');
      x.fillStyle = vg; x.fillRect(0, 0, w, h);
      this.bgCache = c;
    }
    this.ctx.drawImage(this.bgCache, 0, 0, w, h);
  }

  // ---- ambient weather ----
  ambientTick(dt) {
    const { w, h, theme } = this;
    const kind = theme.fx;
    const target = { rain: 70, embers: 26, mist: 10, dust: 18, fireflies: 14, spores: 20, sparkles: 22 }[kind] || 15;
    while (this.ambient.length < target) {
      const a = { x: rand(0, w), y: rand(0, h), vx: 0, vy: 0, life: rand(2, 6), age: rand(0, 3), s: rand(1, 2.5) };
      if (kind === 'rain') { a.vx = -40; a.vy = rand(380, 460); a.y = rand(-h, 0); }
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
      if (kind === 'rain') { x.strokeStyle = theme.tint + '55'; x.lineWidth = 1; x.beginPath(); x.moveTo(a.x, a.y); x.lineTo(a.x - 3, a.y + 10); x.stroke(); continue; }
      if (kind === 'mist') { x.fillStyle = `rgba(255,220,200,${0.05 * fade})`; x.beginPath(); x.ellipse(a.x, a.y, a.s, a.s * 0.3, 0, 0, 7); x.fill(); continue; }
      const glow = kind !== 'dust';
      x.globalAlpha = fade * (glow ? 0.9 : 0.35);
      x.fillStyle = kind === 'dust' ? '#d8c8a8' : theme.tint;
      if (glow) { x.shadowColor = theme.tint; x.shadowBlur = 6; }
      x.beginPath(); x.arc(a.x, a.y, a.s * (kind === 'fireflies' ? 1 + 0.5 * Math.sin(this.t * 6 + i) : 1), 0, 7); x.fill();
      x.shadowBlur = 0; x.globalAlpha = 1;
    }
  }

  // ---- particles & effects ----
  burst(x, y, color, n = 12, speed = 120, size = 3, life = 0.6, grav = 200) {
    for (let i = 0; i < n && this.parts.length < 350; i++) {
      const a = rand(0, Math.PI * 2), v = rand(speed * 0.3, speed);
      this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - speed * 0.3, c: color, s: rand(size * 0.5, size), life: rand(life * 0.6, life), age: 0, g: grav });
    }
  }
  ring(x, y, color, r0, r1, life = 0.5, width = 4) { this.fx.push({ k: 'ring', x, y, c: color, r0, r1, life, age: 0, w: width }); }
  num(x, y, text, color, size = 15, stroke = '#000') {
    if (this.nums.length > 14) this.nums.shift();
    this.nums.push({ x: x + rand(-14, 14), y, text, c: color, s: size, age: 0, life: 0.9, st: stroke });
  }

  // ---- events from the game ----
  onEvent(e, state) {
    const { px, mx, gy } = this;
    const my = gy - this.mSize() * 0.45, py = gy - 36;
    switch (e.t) {
      case 'hit':
        if (e.who === 'm') {
          this.p.lunge = 0.14; this.m.hit = 0.1; this.m.kb = e.crit ? 10 : 5;
          this.burst(mx + rand(-10, 10), my + rand(-14, 14), e.crit ? '#ffd34d' : '#fff2d0', e.crit ? 14 : 6, e.crit ? 220 : 120, e.crit ? 3.5 : 2.5, 0.4, 300);
          this.num(mx, my - 30, fmtN(e.dmg), e.crit ? '#ffd34d' : '#ffffff', e.crit ? 22 : 15);
          if (e.crit) { this.shake = Math.max(this.shake, 4); this.fx.push({ k: 'slash', x: mx, y: my, a: rand(-0.6, 0.6), life: 0.22, age: 0, c: '#ffe8a0', r: 36 }); }
        } else {
          this.p.hit = 0.12;
          this.burst(px, py, '#ff4a3a', e.slam ? 18 : 6, e.slam ? 200 : 100, 3, 0.5, 300);
          this.num(px, py - 40, '-' + fmtN(e.dmg), '#ff6b5e', e.slam ? 20 : 14);
          if (e.slam) { this.shake = 9; this.flash = { c: '#ff2020', t: 0.25, a: 0.25 }; this.ring(px, gy, '#ff5040', 10, 90, 0.4, 6); }
        }
        break;
      case 'slam': this.fx.push({ k: 'warn', x: mx, y: my, life: 0.35, age: 0 }); break;
      case 'evade': this.p.evade = 0.3; this.num(px, py - 40, 'Evade', '#9ad1ff', 13); break;
      case 'block': this.ring(px + 20, py, '#7ab0ff', 10, 34, 0.3, 5); this.num(px, py - 40, 'Block', '#9ad1ff', 13); break;
      case 'skill': this.skillFx(e.id, state); break;
      case 'kill': {
        const m = this.m.obj;
        if (m) this.m.dying = { obj: m, age: 0, x: mx, y: my, icon: m.icon, size: this.mSize() };
        this.burst(mx, my, this.theme.tint, m && m.boss ? 50 : 18, m && m.boss ? 260 : 160, 3.5, 0.8, 150);
        this.burst(mx, my, '#ffffff', 6, 80, 2, 0.5, -60);
        if (m && m.boss) { this.shake = 10; this.flash = { c: '#ffd34d', t: 0.4, a: 0.3 }; }
        break;
      }
      case 'loot': case 'equip': {
        const r = e.item.rarity;
        if (r >= 2) this.fx.push({ k: 'beam', x: mx + rand(-30, 30), c: RARITY_COLORS[r], life: r >= 4 ? 2.6 : 1.6, age: 0, big: r >= 4 });
        break;
      }
      case 'level':
        this.ring(px, py, '#ffd34d', 10, 120, 0.8, 5);
        this.burst(px, py, '#ffd34d', 30, 180, 3, 1, -40);
        this.flash = { c: '#ffd34d', t: 0.3, a: 0.18 };
        break;
      case 'death': this.burst(px, py, '#c8352f', 30, 160, 4, 0.9, 250); this.flash = { c: '#000', t: 0.6, a: 0.5 }; break;
      case 'phase': this.shake = 12; this.flash = { c: '#ff3bd0', t: 0.5, a: 0.35 }; this.ring(mx, my, '#ff5ad0', 20, 200, 0.7, 8); break;
      case 'runEnd': if (e.success) { this.flash = { c: '#ffd34d', t: 0.6, a: 0.35 }; } break;
    }
  }

  skillFx(id, state) {
    const { px, mx, gy } = this;
    const my = gy - this.mSize() * 0.45, py = gy - 36;
    switch (id) {
      case 'cleave':
        this.fx.push({ k: 'slash', x: mx, y: my, a: -0.5, life: 0.3, age: 0, c: '#e8f0ff', r: 52, wide: true });
        this.shake = Math.max(this.shake, 3); break;
      case 'fireball':
        this.fx.push({ k: 'proj', x0: px + 20, y0: py - 6, x1: mx, y1: my, life: 0.35, age: 0, c: '#ff7a2b', c2: '#ffd34d', r: 9, onHit: () => { this.burst(mx, my, '#ff7a2b', 22, 200, 4, 0.6, 100); this.ring(mx, my, '#ffb04a', 8, 50, 0.35, 5); } });
        break;
      case 'meteor':
        this.fx.push({ k: 'proj', x0: mx - 80, y0: -30, x1: mx, y1: my, life: 0.5, age: 0, c: '#ff4a1a', c2: '#ffe08a', r: 16, onHit: () => {
          this.burst(mx, my, '#ff6a2a', 45, 300, 5, 0.9, 200); this.burst(mx, gy, '#5a4030', 20, 160, 4, 0.8, 400);
          this.ring(mx, gy - 4, '#ffb04a', 10, 110, 0.5, 8); this.shake = 12; this.flash = { c: '#ff7a2b', t: 0.25, a: 0.3 };
        } });
        break;
      case 'flurry':
        for (let i = 0; i < 6; i++) this.fx.push({ k: 'slash', x: mx + rand(-12, 12), y: my + rand(-18, 18), a: rand(-1.4, 1.4), life: 0.2, age: -i * 0.08, c: '#d0e8ff', r: 30 });
        break;
      case 'frostnova':
        this.ring(mx, my, '#9ae6ff', 10, 90, 0.5, 6); this.ring(mx, my, '#ffffff', 5, 60, 0.4, 3);
        this.burst(mx, my, '#bff0ff', 24, 180, 3, 0.7, 50); break;
      case 'warcry': case 'undying':
        this.ring(px, py, '#ff4a3a', 10, 140, 0.6, 7); this.ring(px, py, '#ffb04a', 6, 90, 0.45, 4); this.shake = Math.max(this.shake, 5); break;
      case 'haste':
        for (let i = 0; i < 10; i++) this.parts.push({ x: px - rand(20, 60), y: py + rand(-30, 20), vx: -200, vy: 0, c: '#ffe36b', s: 2, life: 0.3, age: 0, g: 0, line: true });
        this.ring(px, py, '#ffe36b', 6, 60, 0.35, 3); break;
      case 'bloodrite':
        this.burst(px, py, '#5cc46b', 20, 90, 3, 1, -120); this.num(px, py - 50, '+heal', '#5cc46b', 13); break;
      case 'molten':
        this.ring(px, py, '#ff8a2b', 50, 46, 0.4, 6); break;
      case 'divshield':
        this.ring(px, py, '#fff3b0', 56, 48, 0.5, 7); this.burst(px, py, '#fff3b0', 16, 80, 2.5, 0.8, -60); break;
      case 'arc':
        for (let i = 0; i < 3; i++) this.fx.push({ k: 'bolt', x0: px + 20, y0: py - 10, x1: mx + rand(-14, 14), y1: my + rand(-20, 20), life: 0.25, age: -i * 0.07, c: '#9ad8ff' });
        this.burst(mx, my, '#bfe8ff', 14, 160, 2.5, 0.4, 0); break;
      case 'storm':
        for (let i = 0; i < 8; i++) this.fx.push({ k: 'bolt', x0: mx + rand(-60, 60), y0: -10, x1: mx + rand(-20, 20), y1: my + rand(-10, 20), life: 0.2, age: -i * 0.09, c: i % 2 ? '#9ad8ff' : '#d8a0ff' });
        this.flash = { c: '#9ad8ff', t: 0.2, a: 0.15 }; this.shake = Math.max(this.shake, 4); break;
      case 'shadowstrike':
        this.p.evade = 0.3;
        this.fx.push({ k: 'slash', x: mx, y: my, a: 0.8, life: 0.3, age: 0.05, c: '#b46bff', r: 46, wide: true });
        this.fx.push({ k: 'slash', x: mx, y: my, a: -0.8, life: 0.3, age: -0.08, c: '#e0c0ff', r: 40 });
        this.burst(mx, my, '#7a3bd0', 18, 140, 3, 0.5, 0); break;
      case 'smoke':
        for (let i = 0; i < 18; i++) this.parts.push({ x: px + rand(-30, 30), y: py + rand(-10, 30), vx: rand(-20, 20), vy: rand(-40, -10), c: '#8a8a9a', s: rand(6, 12), life: 1.2, age: 0, g: 0 });
        break;
      case 'rain':
        for (let i = 0; i < 7; i++) this.fx.push({ k: 'proj', x0: mx + rand(-50, 50) - 40, y0: -20, x1: mx + rand(-16, 16), y1: my + rand(-10, 20), life: 0.3, age: -i * 0.06, c: '#c8d0a0', c2: '#ffffff', r: 3, onHit: () => this.burst(mx, my, '#e8e0c0', 4, 90, 2, 0.3, 200) });
        break;
      case 'mark':
        this.fx.push({ k: 'mark', x: mx, y: my, life: 1.2, age: 0 });
        this.fx.push({ k: 'proj', x0: px + 20, y0: py - 6, x1: mx, y1: my, life: 0.2, age: 0, c: '#ff4a3a', c2: '#ffd0a0', r: 4 }); break;
      case 'riposte':
        this.fx.push({ k: 'slash', x: mx, y: my, a: 0.3, life: 0.28, age: 0, c: '#ffffff', r: 48, wide: true });
        this.burst(px, py, '#5cc46b', 10, 70, 2.5, 0.8, -100); this.shake = Math.max(this.shake, 3); break;
      case 'bloodrush':
        this.ring(px, py, '#c8352f', 10, 80, 0.5, 6); this.burst(px, py, '#ff3b3b', 20, 120, 3, 0.8, -50); break;
      case 'quake':
        this.ring(mx, gy - 2, '#a07040', 10, 160, 0.6, 8); this.ring(mx, gy - 2, '#ffb04a', 6, 100, 0.45, 4);
        this.burst(mx, gy, '#7a5a3a', 30, 220, 4, 0.9, 500); this.shake = 12; break;
      case 'berserk':
        this.ring(px, py, '#ff2020', 8, 110, 0.5, 8); this.flash = { c: '#ff2020', t: 0.25, a: 0.2 }; this.shake = Math.max(this.shake, 6); break;
      case 'smite':
        this.fx.push({ k: 'beam', x: mx, c: '#fff3b0', life: 0.6, age: 0, big: true });
        this.burst(mx, my, '#fff3b0', 24, 200, 3, 0.6, 50); this.burst(px, py, '#5cc46b', 8, 60, 2, 0.8, -100); break;
    }
  }

  mSize() { const m = this.m.obj; return m ? (m.raid ? 104 : m.boss ? 92 : m.elite ? 70 : 62) : 62; }

  // ---- per-frame ----
  frame(dt, state) {
    try { this._frame(dt, state); } catch (err) { console.warn('fx', err); this.ctx.restore?.(); }
  }
  _frame(dt, state) {
    if (!this.canvas.parentNode || !this.w) return;
    this.t += dt;
    this.setTheme(state);
    const x = this.ctx;
    const { w, h, px, mx, gy } = this;
    x.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    // shake
    if (this.shake > 0) { x.translate(rand(-this.shake, this.shake), rand(-this.shake, this.shake)); this.shake = Math.max(0, this.shake - dt * 40); }
    this.drawBg();
    this.ambientTick(dt);

    const c = state.combat;
    const m = c.monster;
    if (m !== this.m.obj) { this.m.obj = m; this.m.spawn = 0; }
    this.m.spawn = Math.min(1, this.m.spawn + dt * 3.5);
    for (const k of ['lunge', 'hit', 'evade']) this.p[k] = Math.max(0, this.p[k] - dt);
    this.m.hit = Math.max(0, this.m.hit - dt);
    this.m.kb = Math.max(0, this.m.kb - dt * 60);

    // --- player ---
    const pIcon = state._pIcon || '🧙';
    const pDead = c.respawn > 0;
    const pBob = Math.sin(this.t * 3) * 2.5;
    const pLunge = this.p.lunge > 0 ? Math.sin((this.p.lunge / 0.14) * Math.PI) * 16 : 0;
    const pSize = 64;
    this.shadow(px, gy, 30);
    // buffs aura
    if (c.buffs && c.buffs.dmg) this.aura(px, gy - 34, '#ff4a3a', 44);
    if (c.buffs && c.buffs.aps) this.aura(px, gy - 34, '#ffe36b', 40);
    if (c.buffs && c.buffs.leech) this.aura(px, gy - 34, '#c8352f', 42);
    if (c.buffs && c.buffs.evade) { x.globalAlpha = 0.5; }
    if (this.p.evade > 0) { x.globalAlpha = 0.3; this.drawSprite(pIcon, pSize, px - 18, gy - 34 + pBob, false, 0); x.globalAlpha = 1; }
    x.globalAlpha = pDead ? 0.25 : (c.buffs && c.buffs.evade ? 0.55 : 1);
    this.drawSprite(pIcon, pSize, px + pLunge + (this.p.evade > 0 ? 10 : 0), gy - 34 + pBob, false, this.p.hit > 0 ? 0.8 : 0);
    x.globalAlpha = 1;
    if (c.shield && c.shield.v > 0) {
      const g = x.createRadialGradient(px, gy - 34, 20, px, gy - 34, 50);
      g.addColorStop(0, 'rgba(255,138,43,0)'); g.addColorStop(0.8, 'rgba(255,138,43,0.18)'); g.addColorStop(1, 'rgba(255,190,90,0.55)');
      x.fillStyle = g; x.beginPath(); x.arc(px, gy - 34, 50 + Math.sin(this.t * 5) * 2, 0, 7); x.fill();
    }

    // --- monster ---
    const ms = this.mSize();
    const mBob = Math.sin(this.t * 2.4 + 1) * 3;
    const sc = Math.max(0.05, easeOutBack(this.m.spawn));
    const mxp = mx + this.m.kb;
    const my = gy - ms * 0.45;
    this.shadow(mx, gy, ms * 0.45 * sc);
    if (m.boss || m.raid) this.aura(mx, my, m.raid ? '#ff3bd0' : '#ff8a2b', ms * 0.9 * (1 + Math.sin(this.t * 3) * 0.06));
    else if (m.elite) this.aura(mx, my, '#6b8cff', ms * 0.75);
    const enr = m.enrageAt && m.age > m.enrageAt;
    if (enr) this.aura(mx, my, '#ff2020', ms * (1 + Math.sin(this.t * 10) * 0.1));
    x.save();
    x.globalAlpha = this.m.spawn;
    x.translate(mxp, my + mBob); x.scale(sc, sc);
    this.drawSprite(m.icon, ms, 0, 0, true, this.m.hit > 0 ? 0.85 : 0);
    x.restore();
    if (m.frozen > 0 && m.stunned) {
      for (let i = 0; i < 3; i++) { const a = this.t * 4 + i * 2.1; x.font = '14px serif'; x.fillText('⭐', mxp + Math.cos(a) * 24, my - ms * 0.5 + Math.sin(a) * 6); }
    } else if (m.frozen > 0) {
      x.fillStyle = 'rgba(150,220,255,0.28)';
      x.beginPath(); x.arc(mxp, my, ms * 0.55, 0, 7); x.fill();
      x.strokeStyle = 'rgba(200,240,255,0.7)'; x.lineWidth = 2; x.stroke();
    }
    // dying monster
    const d = this.m.dying;
    if (d) {
      d.age += dt;
      const k = d.age / 0.45;
      if (k >= 1) this.m.dying = null;
      else {
        x.save(); x.globalAlpha = 1 - k; x.translate(d.x, d.y - k * 20); x.scale(1 + k * 0.3, 1 - k * 0.5);
        this.drawSprite(d.icon, d.size, 0, 0, true, 0.9); x.restore();
      }
    }

    // --- effects ---
    for (let i = this.fx.length - 1; i >= 0; i--) {
      const f = this.fx[i];
      f.age += dt;
      if (f.age < 0) continue;
      const k = f.age / f.life;
      if (k >= 1) { if (f.onHit) f.onHit(); this.fx.splice(i, 1); continue; }
      this.drawFx(f, k);
    }
    // particles
    x.globalCompositeOperation = 'lighter';
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.age += dt;
      if (p.age > p.life) { this.parts.splice(i, 1); continue; }
      p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      const a = 1 - p.age / p.life;
      x.globalAlpha = a;
      if (p.line) { x.strokeStyle = p.c; x.lineWidth = 2; x.beginPath(); x.moveTo(p.x, p.y); x.lineTo(p.x + 18, p.y); x.stroke(); }
      else { x.fillStyle = p.c; x.beginPath(); x.arc(p.x, p.y, p.s * (0.5 + a * 0.5), 0, 7); x.fill(); }
    }
    x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';
    // numbers
    x.textAlign = 'center';
    for (let i = this.nums.length - 1; i >= 0; i--) {
      const n = this.nums[i];
      n.age += dt;
      if (n.age > n.life) { this.nums.splice(i, 1); continue; }
      const k = n.age / n.life;
      const pop = k < 0.15 ? 1 + (0.15 - k) * 3 : 1;
      x.globalAlpha = k > 0.6 ? (1 - k) / 0.4 : 1;
      x.font = `900 ${Math.round(n.s * pop)}px system-ui, sans-serif`;
      x.lineWidth = 3.5; x.strokeStyle = n.st; x.lineJoin = 'round';
      const y = n.y - k * 40;
      x.strokeText(n.text, n.x, y); x.fillStyle = n.c; x.fillText(n.text, n.x, y);
    }
    x.globalAlpha = 1;
    // screen flash
    if (this.flash) {
      this.flash.t -= dt;
      if (this.flash.t <= 0) this.flash = null;
      else { x.globalAlpha = this.flash.a * Math.min(1, this.flash.t * 4); x.fillStyle = this.flash.c; x.fillRect(-20, -20, w + 40, h + 40); x.globalAlpha = 1; }
    }
    // low life vignette
    const lifeK = c.hp / c.stats.maxLife;
    if (lifeK < 0.35 && !pDead) {
      const vg = x.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, w * 0.7);
      vg.addColorStop(0, 'rgba(180,0,0,0)'); vg.addColorStop(1, `rgba(180,0,0,${(0.35 - lifeK) * (1.2 + Math.sin(this.t * 6) * 0.3)})`);
      x.fillStyle = vg; x.fillRect(0, 0, w, h);
    }
  }

  drawSprite(icon, size, x0, y0, flip, white) {
    const s = sprite(icon, size, flip);
    const x = this.ctx;
    const dw = s.width, dh = s.height;
    x.drawImage(s, x0 - dw / 2, y0 - dh / 2);
    if (white > 0) { x.globalAlpha *= white; x.drawImage(s.white, x0 - dw / 2, y0 - dh / 2); x.globalAlpha = 1; }
  }
  shadow(x0, y0, r) {
    const x = this.ctx;
    r = Math.max(1, r);
    x.fillStyle = 'rgba(0,0,0,0.45)';
    x.beginPath(); x.ellipse(x0, y0 - 2, r, r * 0.22, 0, 0, 7); x.fill();
  }
  aura(x0, y0, col, r) {
    const x = this.ctx;
    const g = x.createRadialGradient(x0, y0, r * 0.2, x0, y0, r);
    g.addColorStop(0, col + '55'); g.addColorStop(1, col + '00');
    x.fillStyle = g; x.beginPath(); x.arc(x0, y0, Math.max(1, r), 0, 7); x.fill();
  }

  drawFx(f, k) {
    const x = this.ctx;
    switch (f.k) {
      case 'ring': {
        x.globalAlpha = 1 - k; x.strokeStyle = f.c; x.lineWidth = f.w * (1 - k * 0.5);
        x.beginPath(); x.arc(f.x, f.y, f.r0 + (f.r1 - f.r0) * easeOut(k), 0, 7); x.stroke(); x.globalAlpha = 1; break;
      }
      case 'slash': {
        x.save(); x.translate(f.x, f.y); x.rotate(f.a);
        x.globalAlpha = 1 - k; x.globalCompositeOperation = 'lighter';
        x.strokeStyle = f.c; x.lineWidth = f.wide ? 7 : 4; x.lineCap = 'round';
        const sweep = Math.PI * (f.wide ? 1.1 : 0.7) * easeOut(Math.min(1, k * 2));
        x.beginPath(); x.arc(0, 0, f.r, -sweep / 2 - 0.6, sweep / 2 - 0.6); x.stroke();
        x.restore(); x.globalAlpha = 1; break;
      }
      case 'proj': {
        const e = k * k;
        const cx = f.x0 + (f.x1 - f.x0) * e, cy = f.y0 + (f.y1 - f.y0) * e;
        // trail
        for (let i = 0; i < 6; i++) {
          const kk = Math.max(0, e - i * 0.04);
          const tx = f.x0 + (f.x1 - f.x0) * kk, ty = f.y0 + (f.y1 - f.y0) * kk;
          x.globalAlpha = 0.5 - i * 0.08; x.fillStyle = f.c;
          x.beginPath(); x.arc(tx, ty, f.r * (1 - i * 0.12), 0, 7); x.fill();
        }
        x.globalAlpha = 1;
        const g = x.createRadialGradient(cx, cy, 0, cx, cy, f.r * 1.8);
        g.addColorStop(0, '#fff'); g.addColorStop(0.35, f.c2); g.addColorStop(1, f.c + '00');
        x.fillStyle = g; x.beginPath(); x.arc(cx, cy, f.r * 1.8, 0, 7); x.fill();
        if (Math.random() < 0.6) this.parts.push({ x: cx, y: cy, vx: rand(-30, 30), vy: rand(-30, 30), c: f.c2, s: 2, life: 0.3, age: 0, g: 0 });
        break;
      }
      case 'beam': {
        const a = k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85;
        const bw = f.big ? 16 : 10;
        const g = x.createLinearGradient(f.x - bw, 0, f.x + bw, 0);
        g.addColorStop(0, f.c + '00'); g.addColorStop(0.5, f.c); g.addColorStop(1, f.c + '00');
        x.globalAlpha = a * 0.75; x.globalCompositeOperation = 'lighter';
        x.fillStyle = g; x.fillRect(f.x - bw, 0, bw * 2, this.gy);
        x.fillStyle = '#ffffff'; x.globalAlpha = a * 0.6; x.fillRect(f.x - 1.5, 0, 3, this.gy);
        x.globalAlpha = a * 0.5; x.beginPath(); x.ellipse(f.x, this.gy, bw * 2.5, bw * 0.6, 0, 0, 7); x.fillStyle = f.c; x.fill();
        if (f.big && Math.random() < 0.5) this.parts.push({ x: f.x + rand(-bw, bw), y: this.gy - rand(0, 20), vx: 0, vy: -rand(40, 120), c: f.c, s: 2, life: 0.8, age: 0, g: 0 });
        x.globalAlpha = 1; x.globalCompositeOperation = 'source-over'; break;
      }
      case 'bolt': {
        x.save(); x.globalCompositeOperation = 'lighter'; x.globalAlpha = 1 - k;
        x.strokeStyle = f.c; x.lineWidth = 3; x.shadowColor = f.c; x.shadowBlur = 10;
        x.beginPath(); x.moveTo(f.x0, f.y0);
        const segs = 7;
        for (let i = 1; i <= segs; i++) {
          const t = i / segs;
          x.lineTo(f.x0 + (f.x1 - f.x0) * t + (i < segs ? rand(-12, 12) : 0), f.y0 + (f.y1 - f.y0) * t + (i < segs ? rand(-12, 12) : 0));
        }
        x.stroke(); x.restore(); break;
      }
      case 'mark': {
        x.globalAlpha = (1 - k) * 0.9; x.strokeStyle = '#ff4a3a'; x.lineWidth = 2.5;
        const r = 30 + Math.sin(k * 20) * 2;
        x.beginPath(); x.arc(f.x, f.y, r, 0, 7); x.stroke();
        x.beginPath(); x.moveTo(f.x - r - 8, f.y); x.lineTo(f.x - r + 8, f.y); x.moveTo(f.x + r - 8, f.y); x.lineTo(f.x + r + 8, f.y);
        x.moveTo(f.x, f.y - r - 8); x.lineTo(f.x, f.y - r + 8); x.moveTo(f.x, f.y + r - 8); x.lineTo(f.x, f.y + r + 8); x.stroke();
        x.globalAlpha = 1; break;
      }
      case 'warn': {
        x.globalAlpha = 1 - k; x.fillStyle = '#ff2a2a';
        x.font = '900 24px system-ui'; x.textAlign = 'center';
        x.lineWidth = 4; x.strokeStyle = '#000'; x.strokeText('SLAM!', f.x, f.y - 60 - k * 10); x.fillText('SLAM!', f.x, f.y - 60 - k * 10);
        x.globalAlpha = 1; break;
      }
    }
  }
}

const easeOut = (k) => 1 - Math.pow(1 - k, 3);
const easeOutBack = (k) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2); };
function fmtN(n) {
  if (n < 1000) return Math.round(n).toString();
  const u = ['K', 'M', 'B', 'T', 'Qa'];
  let i = -1; while (n >= 1000 && i < u.length - 1) { n /= 1000; i++; }
  return (n < 100 ? n.toFixed(1) : Math.round(n)) + u[i];
}
