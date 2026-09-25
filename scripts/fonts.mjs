// Fuentes servidas desde el propio dominio (sin conexiones a Google al cargar la página).
//  - Bricolage Grotesque (variable, 400–800) y DM Mono 400/500: subconjunto latin (cubre el español). Se
//    descargan una vez a assets/fonts/ (licencia OFL).
//  - Material Symbols: solo los iconos que usa el sitio (se buscan en el código y se cruzan con la lista oficial;
//    licencia Apache 2.0). El archivo lleva un hash en el nombre: si cambian los iconos cambia la URL.
//  - Genera css/fonts.css (lo enlazan la app, las páginas de los cursos y el laboratorio).
// Se ejecuta con `npm run release`. Sin red, deja todo como estaba.
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, mkdirSync, unlinkSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const FONTS = join(ROOT, 'assets', 'fonts');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const NAMES_URL = 'https://raw.githubusercontent.com/google/material-design-icons/master/variablefont/MaterialSymbolsOutlined%5BFILL%2CGRAD%2Copsz%2Cwght%5D.codepoints';
const SCAN = ['js', 'scripts', 'lab-linux', 'supabase/content', 'index.html'];
const TEXT_FONTS = [
  { file: 'bricolage-grotesque-latin.woff2', css: 'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@400..800&display=swap' },
  { file: 'dm-mono-400-latin.woff2', css: 'https://fonts.googleapis.com/css2?family=DM+Mono:wght@400&display=swap' },
  { file: 'dm-mono-500-latin.woff2', css: 'https://fonts.googleapis.com/css2?family=DM+Mono:wght@500&display=swap' }
];

const get = async (url, as = 'text') => {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return as === 'buffer' ? Buffer.from(await res.arrayBuffer()) : res.text();
};

// URL del woff2 del bloque /* latin */ (o el único bloque, en los subconjuntos de iconos).
function woff2Url(css) {
  const latin = css.split('/* ').find(b => b.startsWith('latin */'));
  const block = latin || css;
  const m = block.match(/src:\s*url\((https:[^)]+\.woff2)\)/) || block.match(/src:\s*url\((https:[^)]+)\)/);
  if (!m) throw new Error('No encuentro el archivo de la fuente en el CSS de Google');
  return m[1];
}

function files(p, out = []) {
  if (!existsSync(p)) return out;
  if (statSync(p).isDirectory()) {
    for (const f of readdirSync(p)) if (!/^(node_modules|img-v\d+|v86)$/.test(f)) files(join(p, f), out);
  } else if (/\.(js|mjs|html|json)$/.test(p)) out.push(p);
  return out;
}

try {
  mkdirSync(FONTS, { recursive: true });

  // 1) Fuentes de texto (solo si faltan).
  for (const f of TEXT_FONTS) {
    if (existsSync(join(FONTS, f.file))) continue;
    writeFileSync(join(FONTS, f.file), await get(woff2Url(await get(f.css)), 'buffer'));
    console.log(`Fuentes: descargada ${f.file}`);
  }

  // 2) Iconos: los nombres usados en el código que existen en Material Symbols.
  const names = new Set((await get(NAMES_URL)).split('\n').map(l => l.split(' ')[0]).filter(Boolean));
  const used = new Set();
  for (const f of SCAN.flatMap(p => files(join(ROOT, p)))) {
    const s = readFileSync(f, 'utf8');
    for (const m of s.matchAll(/material-symbols-outlined[^>]*>\s*([a-z0-9_]+)\s*</g)) used.add(m[1]);
    for (const m of s.matchAll(/['"`]([a-z0-9_]{2,40})['"`]/g)) used.add(m[1]);
  }
  const icons = [...used].filter(n => names.has(n)).sort();
  const iconsCss = await get(`https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,400,0,0&icon_names=${icons.join(',')}&display=block`);
  const iconBuf = await get(woff2Url(iconsCss), 'buffer');
  const iconFile = `material-symbols-${createHash('sha1').update(iconBuf).digest('hex').slice(0, 8)}.woff2`;
  writeFileSync(join(FONTS, iconFile), iconBuf);
  for (const f of readdirSync(FONTS)) if (f.startsWith('material-symbols-') && f !== iconFile) unlinkSync(join(FONTS, f));

  // 3) css/fonts.css
  const css = `/* Generado por scripts/fonts.mjs (npm run release). No editar a mano. */
@font-face {
  font-family: 'Bricolage Grotesque';
  font-style: normal;
  font-weight: 400 800;
  font-display: swap;
  src: url(/assets/fonts/bricolage-grotesque-latin.woff2) format('woff2');
}
@font-face {
  font-family: 'DM Mono';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url(/assets/fonts/dm-mono-400-latin.woff2) format('woff2');
}
@font-face {
  font-family: 'DM Mono';
  font-style: normal;
  font-weight: 500;
  font-display: swap;
  src: url(/assets/fonts/dm-mono-500-latin.woff2) format('woff2');
}
/* Material Symbols: ${icons.length} iconos */
@font-face {
  font-family: 'Material Symbols Outlined';
  font-style: normal;
  font-weight: 400;
  font-display: block;
  src: url(/assets/fonts/${iconFile}) format('woff2');
}
.material-symbols-outlined {
  font-family: 'Material Symbols Outlined';
  font-weight: normal;
  font-style: normal;
  font-size: 24px;
  line-height: 1;
  letter-spacing: normal;
  text-transform: none;
  display: inline-block;
  white-space: nowrap;
  word-wrap: normal;
  direction: ltr;
  -webkit-font-feature-settings: 'liga';
  -webkit-font-smoothing: antialiased;
}
`;
  writeFileSync(join(ROOT, 'css', 'fonts.css'), css);
  console.log(`Fuentes: ${icons.length} iconos (${Math.round(iconBuf.length / 1024)} KB) → ${iconFile}`);
} catch (e) {
  console.warn(`Fuentes: sin cambios (${e.message}).`);
}
