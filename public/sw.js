const CACHE_NAME = 'uet-building-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/manifest.json',
  // Add any other core CSS/JS paths here
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE))
  );
});

// CRITICAL: The browser checks for this listener to enable the Install button
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => response || fetch(event.request))
  );
});