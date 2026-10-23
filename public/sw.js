/* A small service worker so the site can be installed like an app and shows a friendly page when offline.
 * It never touches the API, never caches pages (so a new release is picked up straight away), and only keeps the built
 * static files (their names change with every release, so an old copy is never served for a new one). */
const CACHE = 'testprep-static-v1';
const OFFLINE = '/offline.html';

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll([OFFLINE, '/favicon.svg'])).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api')) return; // the API is always live

  if (req.mode === 'navigate') {
    // Always the newest page; the offline page only when there is no connection.
    event.respondWith(fetch(req).catch(() => caches.match(OFFLINE)));
    return;
  }
  if (/\.(?:js|css|woff2?|png|svg|ico)$/.test(url.pathname) && /-[A-Z0-9]{8}\./i.test(url.pathname)) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
  }
});
