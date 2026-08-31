const CACHE_NAME = 'todo-pwa-cache-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/static/js/main.js', // Or actual bundled paths
  '/static/css/main.css'
];

self.addEventListener('install', ((event: ExtendableEvent) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
}) as EventListener);

self.addEventListener('activate', ((event: ExtendableEvent) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
}) as EventListener);

self.addEventListener('fetch', ((event: FetchEvent) => {
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      return cachedResponse || fetch(event.request);
    })
  );
}) as EventListener);