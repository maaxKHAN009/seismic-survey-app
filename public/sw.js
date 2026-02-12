const CACHE_NAME = 'building-app-v1';
const ASSETS = ['/', '/manifest.json', '/icon-192.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)));
});

self.addEventListener('fetch', (e) => {
  // If offline, serve from cache; if online, get fresh data
  e.respondWith(caches.match(e.request).then(res => res || fetch(e.request)));
});