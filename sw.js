/* ===== Service Worker — offline caching =====
   Static assets: cache-first (app shell, always available offline)
   API calls (jsonblob, translate, weather, F1 results): network-first,
   with a cache fallback so the app keeps showing data when offline.
   Map tiles (OpenStreetMap): cache-first so previously-viewed areas
   keep working without signal. */

// Config (Worker URL) is shared with the app via js/config.js
importScripts('js/config.js');

const CACHE_VERSION = 'f1-hungary-v9';
const STATIC_CACHE = CACHE_VERSION + '-static';
const RUNTIME_CACHE = CACHE_VERSION + '-runtime';

const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/config.js',
  './js/data.js',
  './js/storage.js',
  './js/countdown.js',
  './js/map.js',
  './js/weather.js',
  './js/results.js',
  './js/sync.js',
  './js/translate.js',
  './js/push.js',
  './js/app.js',
  './img/background.jpg',
  './img/icon.svg',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
];

// Install: pre-cache the app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(STATIC_ASSETS).catch(() => {
        // If one external asset fails, cache the rest individually
        return Promise.all(STATIC_ASSETS.map((url) =>
          cache.add(url).catch(() => null)
        ));
      }))
      .then(() => self.skipWaiting())
  );
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== STATIC_CACHE && k !== RUNTIME_CACHE)
            .map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

function isApiRequest(url) {
  return (
    url.hostname.includes('workers.dev') ||
    url.hostname.includes('mymemory.translated.net') ||
    url.hostname.includes('open-meteo.com') ||
    url.hostname.includes('api.jolpi.ca') ||
    url.hostname.includes('ergast.com')
  );
}

function isMapTile(url) {
  return (
    url.hostname.includes('tile.openstreetmap.org') ||
    url.hostname.includes('tile.opentopomap.org') ||
    /\.tile\./.test(url.hostname)
  );
}

/* ---------- Push: deadline reminders ----------
   Pushes arrive WITHOUT payload (no message encryption needed). We fetch
   our personalized message from the Worker; if that fails we show a
   generic reminder so the push is never silently dropped. */
self.addEventListener('push', (event) => {
  event.waitUntil((async () => {
    let title = '🏁 F1 Voorspelling';
    let body = 'De volgende race sluit binnenkort — vergeet je voorspelling niet!';
    try {
      const workerUrl = (self.F1_CONFIG && self.F1_CONFIG.workerUrl) || '';
      const sub = await self.registration.pushManager.getSubscription();
      if (workerUrl && sub) {
        const res = await fetch(workerUrl + '/push/message', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint })
        });
        if (res.ok) {
          const data = await res.json();
          if (data && data.body) {
            body = data.body;
            if (data.title) title = data.title;
          }
        }
      }
    } catch (e) { /* generic fallback text is fine */ }
    await self.registration.showNotification(title, {
      body: body,
      icon: 'img/icon.svg',
      badge: 'img/icon.svg',
      tag: 'f1-deadline-reminder'
    });
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) return client.focus();
      }
      return clients.openWindow('./');
    })
  );
});

// Fetch: smart routing based on request type
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // API: network-first with cache fallback (so you still see last-known data offline)
  if (isApiRequest(url)) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const clone = res.clone();
            caches.open(RUNTIME_CACHE).then((c) => c.put(req, clone));
          }
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // Map tiles: cache-first (offline maps after initial load)
  if (isMapTile(url)) {
    event.respondWith(
      caches.match(req).then((cached) =>
        cached || fetch(req).then((res) => {
          if (res && res.ok) {
            const clone = res.clone();
            caches.open(RUNTIME_CACHE).then((c) => c.put(req, clone));
          }
          return res;
        }).catch(() => cached)
      )
    );
    return;
  }

  // Static shell: cache-first, revalidate in background
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req).then((res) => {
        const cacheable = url.origin === location.origin ||
          url.hostname.includes('unpkg.com') ||
          url.hostname.includes('fonts.googleapis.com') ||
          url.hostname.includes('fonts.gstatic.com');
        if (res && res.ok && cacheable) {
          const clone = res.clone();
          caches.open(STATIC_CACHE).then((c) => c.put(req, clone));
        }
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
