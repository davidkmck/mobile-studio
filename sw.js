const CACHE_NAME = 'mobile-studio-v9';

const ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js'

  // Sub-app HTML
  '/apps/beat-maker/index.html',
  '/apps/multitrack/index.html',
  '/apps/synth/index.html',
  '/apps/beat-maker/style.css',
  '/apps/multitrack/style.css',
  '/apps/synth/style.css',
  '/apps/beat-maker/script.js',
  '/apps/multitrack/script.js',
  '/apps/synth/script.js',


  // Icons
  '/icon.png',
  '/icon-sml.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting(); // Forces the waiting service worker to become the active one
});
/*
// Install and cache assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});
*/
// Intercept requests to serve from cache if offline
self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((response) => {
      return response || fetch(e.request);
    })
  );
});

/*
// Activate and clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Normalize URLs for matching
function normalize(request) {
  const url = new URL(request.url);
  return url.pathname;
}

// Fetch handler
self.addEventListener('fetch', (event) => {
  const path = normalize(event.request);

  event.respondWith(
    caches.match(path).then((cached) => {
      return cached || fetch(event.request);
    })
  );
});
*/
