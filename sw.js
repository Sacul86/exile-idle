// Network-first for app files so updates land, cache fallback for offline play.
const CACHE = 'exile-idle-v4';
const FILES = ['./', 'index.html', 'css/style.css', 'js/main.js', 'js/game.js', 'js/items.js', 'js/stats.js', 'js/data.js', 'js/tree.js', 'js/treeview.js', 'js/skills.js', 'js/fx.js', 'manifest.json', 'icons/icon-192.png', 'icons/icon.svg'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))); self.clients.claim(); });
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request).then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return r; })
    .catch(() => caches.match(e.request)));
});
