// Dashboard Service Worker
// Bump CACHE_VERSION on each deploy to force cache refresh
const CACHE_VERSION = 'v2.9.0';
const CACHE_NAME = `dashboard-${CACHE_VERSION}`;

// Files to pre-cache on install
const V3 = '?v=2.9.0';
const PRECACHE = [
  '/v3/',
  '/v3/app.css' + V3,
  '/v3/core.js' + V3,
  '/v3/today.js' + V3,
  '/v3/gym.html',
  '/v3/gym.js' + V3,
  '/v3/school.html',
  '/v3/school.js' + V3,
  '/v3/commute.js' + V3,
  '/v3/food.html',
  '/v3/food.js' + V3,
  '/v3/trip.js' + V3,
  '/v3/data/rail.json?v=20261019',
  '/v3/data/bus.json?v=20261019',
  '/v3/vendor/supabase-2.116.0.js',
  '/v3/fonts/BricolageGrotesque-latin.woff2',
  '/v3/fonts/Onest-latin.woff2',
  '/login.html',
  '/topbar.js',
  '/manifest.json',
  '/icon.svg',
];

// Versioned v3 assets (?v=…), the pinned library and fonts never change at the same
// URL, so they are served from the cache instantly. Pages stay network-first.
function isImmutable(url) {
  const p = url.pathname;
  return p.startsWith('/v3/vendor/') || p.startsWith('/v3/fonts/') || (p.startsWith('/v3/') && !p.startsWith('/v3/data/') && url.searchParams.has('v'));
}

// The page asks a waiting worker to take over immediately (installed iOS apps
// resume rather than reload, so a worker can otherwise sit waiting indefinitely).
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

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

  const url = new URL(request.url);
  const save = response => {
    if (response && response.ok) { const clone = response.clone(); caches.open(CACHE_NAME).then(cache => cache.put(request, clone)); }
    return response;
  };

  // Timetables refresh twice a week under the same URL: answer from the cache at once,
  // and fetch the newest copy in the background for the next open.
  if (url.pathname.startsWith('/v3/data/')) {
    e.respondWith(caches.match(request).then(hit => { const net = fetch(request).then(save).catch(() => hit); return hit || net; }));
    return;
  }

  if (isImmutable(url)) {
    e.respondWith(caches.match(request).then(hit => hit || fetch(request).then(save)));
    return;
  }

  // Pages: network first, but never leave the app hanging on a slow connection.
  // After 2.5 s the cached copy is shown; the network answer still refreshes the cache.
  if (request.mode === 'navigate') {
    const net = fetch(request).then(save);
    e.respondWith(new Promise(resolve => {
      let done = false;
      const fallback = () => caches.match(request).then(hit => hit || (url.pathname.startsWith('/v3') ? caches.match('/v3/') : null));
      const timer = setTimeout(() => fallback().then(hit => { if (hit && !done) { done = true; resolve(hit); } }), 2500);
      net.then(r => { if (!done) { done = true; clearTimeout(timer); resolve(r); } })
        .catch(() => fallback().then(hit => { if (!done) { done = true; clearTimeout(timer); resolve(hit || Response.error()); } }));
    }));
    return;
  }

  e.respondWith(fetch(request).then(save).catch(() => caches.match(request)));
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
