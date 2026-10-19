// Simple offline-first service worker: app shell is cached; SRD API & fonts use network-first with cache fallback.
const CACHE = 'lorekeeper-v1'
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', './index.html', './manifest.webmanifest', './favicon.svg', './icon-192.png'])).then(() => self.skipWaiting()))
})
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()))
})
self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  const sameOrigin = url.origin === self.location.origin
  if (sameOrigin && req.mode === 'navigate') {
    // network-first for the page so updates show up, fall back to cache offline
    e.respondWith(fetch(req).then((r) => { caches.open(CACHE).then((c) => c.put('./index.html', r.clone())); return r }).catch(() => caches.match('./index.html')))
    return
  }
  if (sameOrigin) {
    // hashed assets: cache-first
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((r) => { if (r.ok) { const cl = r.clone(); caches.open(CACHE).then((c) => c.put(req, cl)) } return r })))
    return
  }
  // cross-origin (fonts, SRD API): network-first, cache fallback
  e.respondWith(fetch(req).then((r) => { if (r.ok || r.type === 'opaque') { const cl = r.clone(); caches.open(CACHE).then((c) => c.put(req, cl)) } return r }).catch(() => caches.match(req)))
})
