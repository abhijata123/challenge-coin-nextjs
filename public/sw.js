// Service Worker for caching
const CACHE_NAME = 'braav-cache-v1';
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  
  // Only cache image requests
  if (!event.request.url.match(/\.(jpg|jpeg|png|gif|webp)$/i)) return;

  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.match(event.request).then((response) => {
        if (response) {
          // Check if cache is expired
          const cachedDate = new Date(response.headers.get('date'));
          if ((new Date().getTime() - cachedDate.getTime()) < CACHE_DURATION) {
            return response;
          }
        }

        return fetch(event.request).then((networkResponse) => {
          cache.put(event.request, networkResponse.clone());
          return networkResponse;
        });
      });
    })
  );
});