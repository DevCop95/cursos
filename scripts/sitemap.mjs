/**
 * Genera sitemap.xml a partir de las páginas públicas (scripts/course-pages.json + páginas fijas).
 *
 * - Un curso nuevo en course-pages.json aparece solo en el sitemap.
 * - lastmod solo cambia cuando cambia el CONTENIDO de la página: se guarda un hash del archivo sin el
 *   número de versión (dev101x-vNN) en scripts/sitemap-state.json. Así una subida que solo cambia la versión
 *   no marca todas las páginas como modificadas (Google ignora el lastmod si no es fiable).
 * - La imagen de la portada usa la misma URL ?v= que index.html.
 *
 * Uso: npm run pages (lo ejecuta después de course-pages.mjs). Solo datos públicos.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const SITE = 'https://cursos.dev101x.online';
const STATE_FILE = join(ROOT, 'scripts/sitemap-state.json');
const read = f => readFileSync(join(ROOT, f), 'utf8');

const { courses } = JSON.parse(read('scripts/course-pages.json'));

// Páginas: [ruta, archivos que definen su contenido, changefreq, priority]
const pages = [
  ['/', ['index.html', 'js/views/login.js', 'js/lib/public-courses.js', 'js/lib/roadmap.js'], 'weekly', '1.0'],
  ...courses.map(c => [`/${c.slug}/`, [`${c.slug}/index.html`], 'monthly', '0.9']),
  ['/explicado/', ['explicado/index.html', ...['escena.js', 'icons.js'].map(f => `explicado/${f}`)], 'monthly', '0.8'],
  ['/privacidad/', ['privacidad/index.html'], 'yearly', '0.3'],
  ['/terminos/', ['terminos/index.html'], 'yearly', '0.3'],
  ['/cookies/', ['cookies/index.html'], 'yearly', '0.3']
];

const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }); // AAAA-MM-DD, hora de Colombia

// lastmod anterior (para sembrar el estado la primera vez sin inventar fechas).
const oldMods = {};
if (existsSync(join(ROOT, 'sitemap.xml'))) {
  for (const m of read('sitemap.xml').matchAll(/<loc>([^<]+)<\/loc>\s*<lastmod>([^<]+)<\/lastmod>/g)) oldMods[m[1]] = m[2];
}
const state = existsSync(STATE_FILE) ? JSON.parse(readFileSync(STATE_FILE, 'utf8')) : {};

const hashOf = files => {
  const h = createHash('sha256');
  for (const f of files) if (existsSync(join(ROOT, f))) h.update(read(f).replace(/dev101x-v\d+/g, ''));
  return h.digest('hex').slice(0, 16);
};

const next = {};
const urls = pages.map(([path, files, freq, prio]) => {
  const loc = SITE + path;
  const hash = hashOf(files);
  const prev = state[loc];
  const lastmod = prev && prev.hash === hash ? prev.lastmod : (prev ? today : (oldMods[loc] || today));
  next[loc] = { hash, lastmod };
  return { loc, lastmod, freq, prio };
});

// Imagen de la portada: la misma que declara index.html
const ogImage = (read('index.html').match(/property="og:image" content="([^"]+)"/) || [])[1] || `${SITE}/assets/og-image.jpg`;
const names = courses.map(c => c.short || String(c.title || c.slug).split(':')[0]);
const imageTitle = `Dev101x Cursos — ${names.slice(0, 5).join(', ')} y más`;

const xmlEsc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const body = urls.map(u => `  <url>
    <loc>${xmlEsc(u.loc)}</loc>
    <lastmod>${u.lastmod}</lastmod>
    <changefreq>${u.freq}</changefreq>
    <priority>${u.prio}</priority>${u.loc === SITE + '/' ? `
    <image:image>
      <image:loc>${xmlEsc(ogImage)}</image:loc>
      <image:title>${xmlEsc(imageTitle)}</image:title>
    </image:image>` : ''}
  </url>`).join('\n');

writeFileSync(join(ROOT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${body}
</urlset>
`);
writeFileSync(STATE_FILE, JSON.stringify(next, null, 2) + '\n');
console.log(`sitemap.xml generado (${urls.length} URLs)`);
