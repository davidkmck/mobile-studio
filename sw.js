const CACHE_NAME = 'mobile-studio-v3';
const ASSETS = [
  '/',
  '/index.html',
  '/apps/multitrack/index.html',
  '/apps/beat-maker/index.html',
  '/icon.png',
  '/icon-sml.png'
  // Add all CSS/JS files for the sub-apps here
];

self.addEventListener('install', (event) => {
  self.skipWaiting(); // Forces the waiting service worker to become the active one
});
/*
// Install the service worker and cache basic files
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
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
