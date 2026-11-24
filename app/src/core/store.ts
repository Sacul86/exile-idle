// Tiny global store: one game state + runtime, with change notifications for the UI.
import { GameState, Runtime, newGame, newRuntime, load, save, offline, OfflineReport } from './engine';
import { equipBest } from './engine';

type Fn = () => void;
const subs = new Set<Fn>();
export const store = {
  s: load() || newGame(),
  rt: newRuntime() as Runtime,
  version: 0,
  offlineReport: null as OfflineReport | null,
  toasts: [] as { id: number; html: string; kind: string }[],
};
export const subscribe = (f: Fn) => { subs.add(f); return () => subs.delete(f); };
export const notify = () => { store.version++; subs.forEach((f) => f()); };
/** Run a state change from the UI and refresh. */
export function act<T>(fn: (s: GameState) => T): T { const r = fn(store.s); notify(); return r; }

let tid = 0;
export function toast(html: string, kind = '') {
  const id = ++tid; store.toasts = [...store.toasts.slice(-3), { id, html, kind }]; notify();
  setTimeout(() => { store.toasts = store.toasts.filter((t) => t.id !== id); notify(); }, 2800);
}
export function persist() { if (store.s.started) save(store.s); }
export function applyOffline() {
  if (store.s.settings.autoEquip) equipBest(store.s);
  const away = (Date.now() - (store.s.lastSeen || Date.now())) / 1000;
  if (!store.s.started || away < 60) return;
  const rep = offline(store.s, away);
  store.s.lastSeen = Date.now();
  if (rep) { store.offlineReport = rep; notify(); }
}
export function resetGame() { localStorage.removeItem('pocket-realm-v1'); store.s = newGame(); store.rt = newRuntime(); notify(); }
