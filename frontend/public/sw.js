// HartHome service worker — installable PWA + offline app shell.
// Network-first for navigations (so updates show up), cache-first for built
// assets, and the API is never cached (always live data).
const CACHE = 'harthome-shell-v1';
const SHELL = ['/', '/index.html', '/favicon.svg', '/manifest.webmanifest'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api')) return; // never cache the API

  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request).catch(() => caches.match('/index.html').then((r) => r || caches.match('/')))
    );
    return;
  }
  e.respondWith(
    caches.match(request).then((cached) =>
      cached || fetch(request).then((res) => {
        const copy = res.clone();
        if (res.ok) caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {});
        return res;
      }).catch(() => cached)
    )
  );
});
