/* みち — service worker */
const V = 'michi-32c9988778';
const ASSETS = ['./', './manifest.webmanifest',
                './icon-192-v3.png', './icon-512-v3.png',
                './icon-maskable-192-v3.png', './icon-maskable-512-v3.png',
                './apple-touch-icon.png'];

/* Installation instantanée : aucun téléchargement ne doit retarder l'activation,
   sans quoi Chrome ne propose pas l'installation de l'application. */
self.addEventListener('install', e => { e.waitUntil(self.skipWaiting()); });

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const ks = await caches.keys();
    await Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)));  /* purge des versions précédentes */
    await self.clients.claim();
  })());
  precache();
});

async function precache() {
  try {
    const c = await caches.open(V);
    await Promise.all(ASSETS.map(u => c.add(u).catch(() => {})));
  } catch (err) {}
}
self.addEventListener('message', e => { if (e.data === 'precache') precache(); });

const isShell = req =>
  req.mode === 'navigate' ||
  req.destination === 'document' ||
  /\/(index\.html)?$/.test(new URL(req.url).pathname);

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  /* La page elle-même : le réseau d'abord, pour qu'une mise à jour arrive
     dès la première ouverture ; le cache seulement si l'on est hors ligne. */
  if (isShell(e.request)) {
    e.respondWith((async () => {
      try {
        const res = await fetch(e.request);
        if (res && res.ok && !res.redirected) {
          const copy = res.clone();
          caches.open(V).then(c => c.put('./', copy)).catch(() => {});
        }
        return res;
      } catch (err) {
        return (await caches.match('./')) || (await caches.match(e.request)) || Response.error();
      }
    })());
    return;
  }

  /* Le reste (icônes, polices) porte un nom versionné : le cache d'abord. */
  e.respondWith((async () => {
    const hit = await caches.match(e.request, { ignoreSearch: true });
    if (hit) return hit;
    try {
      const res = await fetch(e.request);
      if (res && res.ok && !res.redirected) {
        const copy = res.clone();
        caches.open(V).then(c => c.put(e.request, copy)).catch(() => {});
      }
      return res;
    } catch (err) {
      return Response.error();
    }
  })());
});

