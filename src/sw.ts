/// <reference lib="webworker" />

const CACHE_NAME = 'textbook-runtime-v2';

self.addEventListener(
  'activate',
  ((event: ExtendableEvent) => {
    event.waitUntil(
      caches.keys().then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
      )
    );
  }) as EventListener
);

self.addEventListener(
  'fetch',
  ((event: FetchEvent) => {
    const { request } = event;
    const url = new URL(request.url);

    if (request.method !== 'GET' || url.origin !== self.location.origin) return;

    if (request.mode === 'navigate') {
      event.respondWith(
        fetch(request)
          .then(async (response) => {
            if (response.ok) {
              const cache = await caches.open(CACHE_NAME);
              await cache.put(request, response.clone());
            }
            return response;
          })
          .catch(async () => (await caches.match(request)) ?? Response.error())
      );
      return;
    }

    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        const networkResponse = fetch(request).then(async (response) => {
          if (response.ok) {
            const cache = await caches.open(CACHE_NAME);
            await cache.put(request, response.clone());
          }
          return response;
        });

        return cachedResponse ?? networkResponse;
      })
    );
  }) as EventListener
);
