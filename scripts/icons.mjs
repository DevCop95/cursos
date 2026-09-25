// Reduce la fuente de iconos (Material Symbols) a los iconos que usa el sitio: de ~3,9 MB a unas decenas de KB.
// Busca los nombres en el código y los cruza con la lista oficial; reescribe el enlace de la fuente en las páginas.
// Se ejecuta con `npm run release`. Si no hay red, deja el enlace como estaba.
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const NAMES_URL = 'https://raw.githubusercontent.com/google/material-design-icons/master/variablefont/MaterialSymbolsOutlined%5BFILL%2CGRAD%2Copsz%2Cwght%5D.codepoints';
const SCAN = ['js', 'scripts', 'lab-linux', 'supabase/content', 'index.html'];
const TARGETS = ['index.html', 'lab-linux/index.html', 'lab-linux/embed.html', 'scripts/course-pages.mjs'];
const FONT_RE = /https:\/\/fonts\.googleapis\.com\/css2\?family=Material\+Symbols\+Outlined:[^"'`\s]*/g;

function files(p, out = []) {
  if (!existsSync(p)) return out;
  if (statSync(p).isDirectory()) {
    for (const f of readdirSync(p)) if (!/^(node_modules|img-v\d+|v86)$/.test(f)) files(join(p, f), out);
  } else if (/\.(js|mjs|html|json)$/.test(p)) out.push(p);
  return out;
}

let names;
try {
  const res = await fetch(NAMES_URL);
  if (!res.ok) throw new Error(String(res.status));
  names = new Set((await res.text()).split('\n').map(l => l.split(' ')[0]).filter(Boolean));
} catch (e) {
  console.warn(`Iconos: no se pudo descargar la lista oficial (${e.message}); la fuente no se cambia.`);
  process.exit(0);
}

const used = new Set();
for (const f of SCAN.flatMap(p => files(p))) {
  const s = readFileSync(f, 'utf8');
  for (const m of s.matchAll(/material-symbols-outlined[^>]*>\s*([a-z0-9_]+)\s*</g)) used.add(m[1]);
  for (const m of s.matchAll(/['"`]([a-z0-9_]{2,40})['"`]/g)) used.add(m[1]);
}
const icons = [...used].filter(n => names.has(n)).sort();
const url = 'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,400,0,0'
  + `&icon_names=${icons.join(',')}&display=block`;

for (const t of TARGETS) {
  if (!existsSync(t)) continue;
  const s = readFileSync(t, 'utf8');
  const next = s.replace(FONT_RE, url);
  if (next !== s) writeFileSync(t, next);
}
console.log(`Iconos: ${icons.length} en la fuente.`);
