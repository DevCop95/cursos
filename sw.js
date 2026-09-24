/**
 * Dev101x — Service Worker
 *  - HTML: red primero (siempre la versión más reciente) con copia offline.
 *  - CSS/JS/imágenes propios: se sirven desde caché y se actualizan en segundo plano
 *    (stale-while-revalidate), así un despliegue nuevo llega sin tener que cambiar VERSION.
 *  - Fuentes de Google: caché primero (sus URLs son inmutables).
 *  - Google Identity, Supabase y demás orígenes: no se interceptan.
 */
const VERSION = 'dev101x-v28';
const STATIC_CACHE = `${VERSION}-static`;
const FONT_CACHE = 'dev101x-fonts';

const PRECACHE = [
  './',
  './index.html',
  './manifest.json',
  './css/tailwind.css?v=dev101x-v28',
  './css/app.css?v=dev101x-v28',
  './js/main.js?v=dev101x-v28',
  './js/identicon.js?v=dev101x-v28',
  './js/water-reveal.js?v=dev101x-v28',
  './js/config.js',
  './js/state.js',
  './js/router.js',
  './js/auth.js',
  './js/cloud.js',
  './js/progress.js',
  './js/lab.js',
  './js/content.js',
  './js/search.js',
  './js/ui.js',
  './js/lib/html.js',
  './js/lib/jwt.js',
  './js/lib/activity.js',
  './js/lib/badges.js',
  './js/views/login.js',
  './js/views/courses.js',
  './js/views/aula.js',
  './js/views/perfil.js',
  './js/views/admin.js',
  './assets/icon-192.png',
  './assets/favicon.png',
  './assets/dev101x_identicon.svg',
  './assets/mimo-bg.webp'
];

const FONT_ORIGINS = ['https://fonts.googleapis.com', 'https://fonts.gstatic.com'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(PRECACHE.map(url => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== STATIC_CACHE && k !== FONT_CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function networkFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (e) {
    return (await cache.match(request)) || (await cache.match('./index.html'));
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok || response.type === 'opaque') cache.put(request, response.clone());
  return response;
}

async function staleWhileRevalidate(event) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(event.request);
  const update = fetch(event.request)
    .then(response => {
      if (response.ok) cache.put(event.request, response.clone());
      return response;
    });
  if (cached) {
    event.waitUntil(update.catch(() => {}));
    return cached;
  }
  return update;
}

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (FONT_ORIGINS.includes(url.origin)) {
    event.respondWith(cacheFirst(request, FONT_CACHE));
    return;
  }
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(networkFirst(request));
    return;
  }
  event.respondWith(staleWhileRevalidate(event));
});
