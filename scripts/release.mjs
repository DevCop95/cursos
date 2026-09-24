/**
 * Prepara un despliegue: pone la versión nueva en TODAS las URLs de los módulos.
 *
 * La CDN guarda los .js varias horas. Si solo main.js lleva ?v=, un despliegue puede mezclar
 * un main.js nuevo con módulos viejos y la app deja de cargar. Con ?v= en cada import (y en el
 * registro del service worker) cada versión usa URLs nuevas que la CDN aún no tiene guardadas.
 *
 * Uso: npm run release            → sube un número (dev101x-v35 → dev101x-v36)
 *      npm run release -- v40     → versión concreta
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const read = f => readFileSync(join(ROOT, f), 'utf8');
const write = (f, s) => writeFileSync(join(ROOT, f), s);

const current = (read('sw.js').match(/const VERSION = 'dev101x-v(\d+)'/) || [])[1];
if (!current) throw new Error('No se encontró VERSION en sw.js');
const arg = (process.argv[2] || '').replace(/^v/, '');
const next = `dev101x-v${arg || Number(current) + 1}`;

function jsFiles(dir) {
  return readdirSync(join(ROOT, dir)).flatMap(name => {
    const rel = `${dir}/${name}`;
    if (statSync(join(ROOT, rel)).isDirectory()) return jsFiles(rel);
    return /\.js$/.test(name) && !name.startsWith('__') ? [rel] : [];
  });
}

// 1. Imports relativos de los módulos: './x.js' → './x.js?v=<versión>'.
let changed = 0;
for (const file of jsFiles('js')) {
  const before = read(file);
  const after = before.replace(/((?:from|import)\s+')(\.{1,2}\/[^'?]+\.js)(?:\?v=[^']*)?'/g, `$1$2?v=${next}'`);
  if (after !== before) { write(file, after); changed++; }
}

// 2. Registro del service worker con la versión (la CDN también guarda sw.js).
const main = read('js/main.js').replace(/register\('\.\/sw\.js(?:\?v=[^']*)?'/, `register('./sw.js?v=${next}'`);
write('js/main.js', main);

// 3. index.html y sw.js: versión y lista de precarga con las mismas URLs que usan los imports.
write('index.html', read('index.html').replace(/dev101x-v\d+/g, next));
let sw = read('sw.js').replace(/dev101x-v\d+/g, next);
sw = sw.replace(/'(\.\/js\/[^'?]+\.js)(?:\?v=[^']*)?'/g, `'$1?v=${next}'`);
write('sw.js', sw);

console.log(`Versión ${next} (${changed} módulos actualizados). Ahora: npm run build:css && npm test`);
