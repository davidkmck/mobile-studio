const CACHE_NAME = 'mobile-studio-v4';

const ASSETS = [
  '/',
  '/index.html',

  // Sub-app HTML
  '/apps/beat-maker/index.html',
  '/apps/multitrack/index.html',
  '/apps/synth/index.html',

  // Icons
  '/icon.png',
  '/icon-sml.png'
];

// Install and cache assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

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
