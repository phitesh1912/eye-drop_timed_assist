// Offline support: the app keeps working without internet.
// Network first (so updates arrive), falling back to the saved copy.

const CACHE = 'droptime-v2';
const SHELL = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/app.css',
  'js/app.js',
  'js/regimens.js',
  'js/schedule.js',
  'js/store.js',
  'js/alarm.js',
  'js/ui.js',
  'js/view-today.js',
  'js/view-records.js',
  'js/view-schedule.js',
  'js/view-settings.js',
  'js/sheets.js',
  'assets/chime.wav',
  'icons/icon-192.png',
  'icons/apple-touch-icon.png',
  'icons/favicon-64.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      // Only this app's old caches: Drop Time+ (/brother/) keeps its own.
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('droptime-v') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const fresh = await Promise.race([
        fetch(req),
        new Promise((_, reject) => setTimeout(() => reject(new Error('slow')), 4000)),
      ]);
      if (fresh && fresh.ok && !req.url.endsWith('.ics')) cache.put(req, fresh.clone());
      return fresh;
    } catch {
      const hit = await cache.match(req, { ignoreSearch: true });
      if (hit) return hit;
      if (req.mode === 'navigate') return (await cache.match('index.html')) || Response.error();
      return Response.error();
    }
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (all.length) return all[0].focus();
    return self.clients.openWindow('./');
  })());
});
