/**
 * Ayudas para escribir las escenas. code('SELECT {d:texto}') convierte las marcas en segmentos [texto, tipo]:
 * {i:} lo que escribe el usuario, {d:} lo que mete el atacante, {c:} lo que se ignora (tachado),
 * {l:} una etiqueta gris, {o:} algo correcto. Lo que no lleva marca es texto normal.
 */
const KINDS = { i: 'input', d: 'danger', c: 'comment', l: 'label', o: 'ok' };

export function code(...lines) {
  return lines.map(line => {
    const out = [];
    let at = 0;
    for (const m of line.matchAll(/\{([idclo]):([^}]*)\}/g)) {
      if (m.index > at) out.push([line.slice(at, m.index), 'plain']);
      out.push([m[2], KINDS[m[1]]]);
      at = m.index + m[0].length;
    }
    if (at < line.length) out.push([line.slice(at), 'plain']);
    return out;
  });
}

export const ATACANTE = { icon: 'skull', label: 'Atacante', tone: 'danger' };
export const PROTEGIDA = { icon: 'shield', tone: 'ok' };
