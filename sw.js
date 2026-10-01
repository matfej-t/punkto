// Punkto service worker — makes the app work offline after the first visit.
//
// Strategy: precache the whole app on install; afterwards serve from cache
// immediately and refresh the cache in the background (stale-while-revalidate),
// so updates you push to GitHub reach users on their next visit.
// Cross-origin requests (AdSense, Lemon Squeezy) are never touched.
//
// The VERSION and ASSETS list below are rewritten by tools/generate-pages.mjs.

// @@GENERATED-START
const VERSION = 'punkto-203ac7256b';
const ASSETS = [
  './',
  'de/',
  'ru/',
  'es/',
  'fr/',
  'it/',
  'pt/',
  'pl/',
  'uk/',
  'tr/',
  'cs/',
  'nl/',
  'config.js',
  'manifest.webmanifest',
  'css/app.css',
  'js/ads.js',
  'js/app.js',
  'js/confetti.js',
  'js/env.js',
  'js/i18n.js',
  'js/icons.js',
  'js/illustrations.js',
  'js/images.js',
  'js/model.js',
  'js/premium.js',
  'js/share.js',
  'js/store.js',
  'js/theme.js',
  'js/ui.js',
  'js/views/common.js',
  'js/views/control-leaderboard.js',
  'js/views/control-scoreboard.js',
  'js/views/control.js',
  'js/views/display.js',
  'js/views/home.js',
  'js/views/winner.js',
  'i18n/cs.json',
  'i18n/de.json',
  'i18n/en.json',
  'i18n/es.json',
  'i18n/fr.json',
  'i18n/it.json',
  'i18n/nl.json',
  'i18n/pl.json',
  'i18n/pt.json',
  'i18n/ru.json',
  'i18n/tr.json',
  'i18n/uk.json',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/apple-touch-icon.png'
];
// @@GENERATED-END

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION)
      .then(cache => cache.addAll(ASSETS.map(u => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('punkto-') && k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // ads, license API, etc.

  event.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const cached = await cache.match(req, { ignoreSearch: true });
    const network = fetch(req).then((res) => {
      if (res.ok && res.type === 'basic') cache.put(req, res.clone());
      return res;
    }).catch(() => null);

    if (cached) {
      event.waitUntil(network); // refresh in the background
      return cached;
    }
    const res = await network;
    if (res) return res;
    // Offline and not cached: fall back to the app shell for page loads.
    if (req.mode === 'navigate') return (await cache.match('./')) || Response.error();
    return Response.error();
  })());
});
