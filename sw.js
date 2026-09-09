const CACHE = 'flexalot-14';
const ASSETS = [
  './',
  './index.html',
  './css/styles.css',
  './js/config.js',
  './js/version.js',
  './js/holidays.js',
  './js/storage.js',
  './js/app.js',
  './js/sync.js',
  './manifest.json',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', e => {
  // `cache: 'reload'` = ignora la cache HTTP del browser: tutti gli asset di
  // QUESTA build arrivano dalla rete, senza mischiare file di build diverse
  // (era la causa di app "appesa" dopo un aggiornamento). addAll resta atomico.
  e.waitUntil(
    caches.open(CACHE).then(c =>
      c.addAll(ASSETS.map(u => new Request(u, { cache: 'reload' })))
    )
  );
  self.skipWaiting();
});

// Il pulsante "aggiorna" nell'app può sollecitare un SW rimasto in attesa.
self.addEventListener('message', e => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
