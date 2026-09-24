/**
 * Dev101x — Service Worker
 *  - HTML: red primero (siempre la versión más reciente) con copia offline.
 *  - CSS/JS/imágenes propios: también red primero (revalidando con el servidor) y caché solo sin
 *    conexión. Los módulos se importan sin ?v=, así que servirlos desde caché podía mezclar un
 *    main.js nuevo con módulos viejos tras un despliegue.
 *  - Fuentes de Google: caché primero (sus URLs son inmutables).
 *  - Google Identity, Supabase y demás orígenes: no se interceptan.
 */
const VERSION = 'dev101x-v35';
const STATIC_CACHE = `${VERSION}-static`;
const FONT_CACHE = 'dev101x-fonts';

const PRECACHE = [
  './',
  './index.html',
  './manifest.json',
  './css/tailwind.css?v=dev101x-v35',
  './css/app.css?v=dev101x-v35',
  './js/main.js?v=dev101x-v35',
  './js/identicon.js?v=dev101x-v35',
  './js/water-reveal.js?v=dev101x-v35',
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
  './js/lib/access.js',
  './js/lib/course-engine.js',
  './js/views/course-aula.js',
  './js/lib/cmd-history.js',
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
    // no-cache: pregunta al servidor aunque la caché HTTP tenga copia (responde 304 si no cambió).
    // Las navegaciones no admiten opciones en fetch(): esas van tal cual.
    const response = await fetch(request.mode === 'navigate' ? request : new Request(request, { cache: 'no-cache' }));
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (e) {
    const cached = await cache.match(request);
    if (cached) return cached;
    if (request.mode === 'navigate') return (await cache.match('./index.html')) || Response.error();
    return Response.error();
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

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (FONT_ORIGINS.includes(url.origin)) {
    event.respondWith(cacheFirst(request, FONT_CACHE));
    return;
  }
  if (url.origin !== self.location.origin) return;

  event.respondWith(networkFirst(request));
});
