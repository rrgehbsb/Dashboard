// Dashboard Service Worker
// Bump CACHE_VERSION on each deploy to force cache refresh
const CACHE_VERSION = 'v2.5.32';
const CACHE_NAME = `dashboard-${CACHE_VERSION}`;

// Files to pre-cache on install
const PRECACHE = [
  '/',
  '/index.html',
  '/topbar.js',
  '/manifest.json',
  '/icon.svg',
];

// ── Install ───────────────────────────────────────────────────
self.addEventListener('install', e => {
  // Take control immediately — don't wait for old SW to die
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE)).catch(() => {})
  );
});

// ── Activate ──────────────────────────────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ── Fetch — network-first to keep deployments fresh ──────────
self.addEventListener('fetch', e => {
  const { request } = e;
  // Skip non-GET and cross-origin requests
  if (request.method !== 'GET') return;
  if (!request.url.startsWith(self.location.origin)) return;
  // Skip Supabase API calls — always network
  if (request.url.includes('supabase.co')) return;

  e.respondWith(
    fetch(request)
      .then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});

// ── Push notifications (Stage 2 — wired but not active yet) ──
self.addEventListener('push', e => {
  try {
    const data = e.data ? e.data.json() : {};
    const title = data.title || 'Dashboard';
    const options = {
      body: data.body || '',
      icon: '/icon.svg',
      badge: '/icon.svg',
      data: { url: data.url || '/' },
    };
    e.waitUntil(self.registration.showNotification(title, options));
  } catch {}
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil(clients.openWindow(url));
});
