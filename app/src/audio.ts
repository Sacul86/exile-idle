// Retro SFX synthesised with jsfxr, plus looping background music per biome.
import jsfxr from 'jsfxr';
const sfxr = (jsfxr as any).sfxr; const SoundEffect = (jsfxr as any).SoundEffect;
import { store } from './core/store';

let ctx: AudioContext | null = null;
let sfxGain: GainNode, musicGain: GainNode;
const buffers: Record<string, AudioBuffer> = {};
let musicEl: HTMLAudioElement | null = null, musicTrack = '';
const last: Record<string, number> = {};

const P = (kind: string, tweak: (p: any) => void = () => {}) => { const p = sfxr.generate(kind); tweak(p); return p; };
function build() {
  const defs: Record<string, any> = {
    hit: P('hitHurt', (p) => { p.sound_vol = 0.18; }),
    crit: P('explosion', (p) => { p.sound_vol = 0.2; p.p_env_decay = 0.12; }),
    coin: P('pickupCoin', (p) => { p.sound_vol = 0.14; }),
    loot: P('powerUp', (p) => { p.sound_vol = 0.18; }),
    rare: P('powerUp', (p) => { p.sound_vol = 0.22; p.p_base_freq = 0.45; p.p_env_sustain = 0.25; }),
    level: P('powerUp', (p) => { p.sound_vol = 0.16; p.p_base_freq = 0.3; }),
    boss: P('explosion', (p) => { p.sound_vol = 0.28; p.p_base_freq = 0.08; p.p_env_sustain = 0.3; }),
    tap: P('click', (p) => { p.sound_vol = 0.12; }),
    blip: P('blipSelect', (p) => { p.sound_vol = 0.12; }),
    fire: P('laserShoot', (p) => { p.sound_vol = 0.14; p.p_base_freq = 0.25; }),
    heal: P('powerUp', (p) => { p.sound_vol = 0.1; p.p_base_freq = 0.55; }),
    hurt: P('hitHurt', (p) => { p.sound_vol = 0.14; p.p_base_freq = 0.12; }),
    frenzy: P('powerUp', (p) => { p.sound_vol = 0.24; p.p_base_freq = 0.2; p.p_env_sustain = 0.35; }),
    gather: P('click', (p) => { p.sound_vol = 0.05; }),
  };
  for (const [k, def] of Object.entries(defs)) {
    const fx = new (SoundEffect as any)(def);
    const raw = fx.getRawBuffer().normalized as number[];
    const b = ctx!.createBuffer(1, raw.length, fx.sampleRate);
    b.getChannelData(0).set(raw);
    buffers[k] = b;
  }
}
/** Must be called from a user gesture (first tap) on mobile. */
export function unlockAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  try {
    ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    sfxGain = ctx.createGain(); sfxGain.connect(ctx.destination);
    musicGain = ctx.createGain(); musicGain.connect(ctx.destination);
    build(); applyVolumes();
  } catch (e) { console.warn('audio', e); }
}
export function applyVolumes() {
  const st = store.s.settings;
  if (sfxGain) sfxGain.gain.value = st.sfx ? st.sfxVol : 0;
  if (musicEl) { musicEl.volume = st.music ? st.musicVol * 0.6 : 0; if (st.music && musicEl.paused) musicEl.play().catch(() => {}); if (!st.music) musicEl.pause(); }
}
export function sfx(k: string, minGap = 0.05) {
  if (!ctx || !buffers[k] || !store.s.settings.sfx) return;
  const now = ctx.currentTime; if (last[k] && now - last[k] < minGap) return; last[k] = now;
  const src = ctx.createBufferSource(); src.buffer = buffers[k];
  src.playbackRate.value = 0.94 + Math.random() * 0.12;
  src.connect(sfxGain); src.start();
}
export function music(track: string) {
  if (!ctx || track === musicTrack) return;
  musicTrack = track;
  const next = new Audio(`audio/${track}.m4a`); next.loop = true; next.volume = 0;
  const prev = musicEl; musicEl = next;
  if (store.s.settings.music) next.play().catch(() => {});
  const target = store.s.settings.music ? store.s.settings.musicVol * 0.6 : 0;
  let k = 0; const fade = setInterval(() => { k += 0.05; next.volume = Math.min(target, target * k); if (prev) prev.volume = Math.max(0, prev.volume - target * 0.05); if (k >= 1) { clearInterval(fade); prev?.pause(); } }, 60);
}
document.addEventListener('visibilitychange', () => { if (!musicEl) return; if (document.hidden) musicEl.pause(); else if (store.s.settings.music) musicEl.play().catch(() => {}); });
