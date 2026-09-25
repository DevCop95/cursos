/**
 * Dev101x — Servidor estático local sin dependencias (solo para desarrollo).
 * En producción el sitio se sirve desde GitHub Pages.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = Number(process.env.PORT) || 3000;
const BASE_DIR = path.dirname(fileURLToPath(import.meta.url));
// Lo mismo que publica GitHub Pages: la app, las páginas de cada curso, el laboratorio y .well-known.
const COURSE_SLUGS = JSON.parse(fs.readFileSync(path.join(BASE_DIR, 'scripts/course-pages.json'), 'utf8')).courses.map(c => c.slug + '/');
const PUBLIC_PREFIXES = ['index.html', '404.html', 'manifest.json', 'sw.js', 'robots.txt', 'sitemap.xml', 'assets/', 'css/', 'js/', 'lab-linux/', '.well-known/', ...COURSE_SLUGS];

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm'
};

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'SAMEORIGIN', // como en producción: el aula incrusta el laboratorio Linux
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  // Google Identity Services necesita poder abrir su popup y comunicarse con la ventana
  'Cross-Origin-Opener-Policy': 'same-origin-allow-popups'
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, { ...SECURITY_HEADERS, ...headers });
  res.end(body);
}

const server = http.createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return send(res, 405, 'Method Not Allowed', { 'Content-Type': 'text/plain; charset=utf-8', Allow: 'GET, HEAD' });
  }

  let reqPath;
  try {
    reqPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch (e) {
    return send(res, 400, 'Bad Request', { 'Content-Type': 'text/plain; charset=utf-8' });
  }
  if (reqPath.endsWith('/')) reqPath += 'index.html'; // /shodan/ → /shodan/index.html, como GitHub Pages

  const filePath = path.resolve(BASE_DIR, '.' + reqPath);
  const relative = path.relative(BASE_DIR, filePath).split(path.sep).join('/');

  // Evita path traversal y solo expone los archivos públicos del sitio (no package.json, .git, node_modules…)
  if (relative.startsWith('..') || path.isAbsolute(relative) || !PUBLIC_PREFIXES.some(p => relative === p || (p.endsWith('/') && relative.startsWith(p)))) {
    return serveFallback(res);
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) return serveFallback(res);
    const contentType = MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
    fs.readFile(filePath, (readErr, content) => {
      if (readErr) return send(res, 500, 'Internal Server Error', { 'Content-Type': 'text/plain; charset=utf-8' });
      send(res, 200, req.method === 'HEAD' ? undefined : content, { 'Content-Type': contentType, 'Cache-Control': 'no-cache' });
    });
  });
});

// Igual que GitHub Pages: las rutas desconocidas sirven 404.html, que redirige a la ruta hash.
function serveFallback(res) {
  fs.readFile(path.join(BASE_DIR, '404.html'), (err, content) => {
    if (err) return send(res, 404, 'Not Found', { 'Content-Type': 'text/plain; charset=utf-8' });
    send(res, 404, content, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
  });
}

server.listen(PORT, () => {
  console.log(`[Dev101x] Servidor local en http://localhost:${PORT}`);
});
