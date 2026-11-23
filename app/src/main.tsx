import './style.css';
import { render } from 'preact';
import { App } from './ui/App';
import { applyOffline, persist } from './core/store';
import { unlockAudio } from './audio';

async function boot() {
  applyOffline();
  render(<App />, document.getElementById('app')!);
  const unlock = () => { unlockAudio(); window.removeEventListener('pointerdown', unlock); };
  window.addEventListener('pointerdown', unlock);
  document.addEventListener('visibilitychange', () => { if (document.hidden) persist(); else applyOffline(); });
  window.addEventListener('pagehide', persist);
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('./sw.js').catch(() => {});
}
boot();
