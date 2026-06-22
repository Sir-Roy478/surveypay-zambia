// service-worker.js — enables installability and basic offline support
const CACHE_NAME = 'surveypay-zm-v1';
const PRECACHE_URLS = [
  '/index.html',
  '/login.html',
  '/signup.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(PRECACHE_URLS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(key) { return key !== CACHE_NAME; })
            .map(function(key) { return caches.delete(key); })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function(event) {
  // Never cache API calls or Firestore/Firebase requests — always go to network
  if (event.request.url.indexOf('/api/') !== -1 ||
      event.request.url.indexOf('firestore') !== -1 ||
      event.request.url.indexOf('firebase') !== -1 ||
      event.request.url.indexOf('googleapis') !== -1) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then(function(cached) {
      // Try network first for fresh content, fall back to cache if offline
      return fetch(event.request)
        .then(function(response) {
          // Update cache with fresh copy for next time
          if (response && response.status === 200 && event.request.method === 'GET') {
            var responseClone = response.clone();
            caches.open(CACHE_NAME).then(function(cache) {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        })
        .catch(function() {
          return cached; // offline fallback
        });
    })
  );
});
