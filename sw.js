const CACHE_NAME = 'eato-v2';
const STATIC_ASSETS = [
  './',
  '/',
  '/index.html',
  '/offline.html',
  'https://unpkg.com/tesseract.js@5/dist/tesseract.min.js',
  'https://unpkg.com/quagga@0.12.1/dist/quagga.min.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(name => name !== CACHE_NAME).map(name => caches.delete(name))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') {
    return;
  }

  const requestURL = new URL(event.request.url);
  const isSameOrigin = requestURL.origin === self.location.origin;
  const isStaticAsset = STATIC_ASSETS.some(asset => {
    try {
      const assetURL = new URL(asset, self.location.origin);
      return assetURL.href === requestURL.href;
    } catch (err) {
      return asset === event.request.url;
    }
  });

  if (isStaticAsset) {
    event.respondWith(
      caches.match(event.request, { ignoreSearch: true }).then(cached => {
        if (cached) {
          return cached;
        }
        return fetch(event.request).then(response => {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
          return response;
        });
      })
    );
    return;
  }

  event.respondWith(
    fetch(event.request).then(response => {
      if (isSameOrigin && response && response.status === 200) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
      }
      return response;
    }).catch(() => {
      return caches.match(event.request).then(match => {
        if (match) {
          return match;
        }
        if (event.request.mode === 'navigate') {
          return caches.match('/offline.html');
        }
        return Response.error();
      });
    })
  );
});
