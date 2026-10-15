/**
 * Ventana del laboratorio de redes: la topología dibujada en SVG, la consola de cada equipo (se abre al pulsarlo)
 * y las tareas. El motor está en js/lib/netsim.js. La usan el aula de los cursos con terminal de red
 * (js/views/course-aula.js) y el prototipo /lab-red/.
 *
 * openNetLab({ key, title, kicker, network, tasks, onEvent, saved, onChange, select })
 *   network: { spec, zones, layout: { wide, narrow }, start }   (datos del curso: se escapan siempre)
 *   tasks(): [{ text, hint, done }]   · onEvent(event): tras cada comando · onChange(estado): la red cambió
 *   saved: estado guardado de la red (exportNetState) · select: equipo que se abre al empezar
 * Al hacer ping, el paquete recorre los cables: verde la ida, ámbar la vuelta, azul las consultas DNS y una ✕ roja
 * donde se pierde. Estilos: css/app.css (.nl-*). Con "reducir movimiento" no hay animación, solo el resultado.
 */
import { createNetwork, runCommand, addressesOf, exportNetState, importNetState } from '../lib/netsim.js?v=dev101x-v102';
import { esc } from '../lib/html.js?v=dev101x-v102';

const ICONS = {
  pc: '<rect class="nl-shape" x="-21" y="-17" width="42" height="28" rx="4"/><rect class="nl-screen" x="-16" y="-12" width="32" height="18" rx="1.5"/><path class="nl-shape" d="M-7 11h14l2.5 6h-19z"/>',
  server: '<rect class="nl-shape" x="-15" y="-21" width="30" height="42" rx="4"/><path class="nl-detail" d="M-9 -10h12M-9 0h12M-9 10h12"/><circle class="nl-led" cx="8" cy="-10" r="1.8"/><circle class="nl-led" cx="8" cy="0" r="1.8"/><circle class="nl-led" cx="8" cy="10" r="1.8"/>',
  switch: '<rect class="nl-shape" x="-26" y="-12" width="52" height="24" rx="5"/>' + [-17, -10, -3, 4, 11, 18].map(x => `<rect class="nl-port" x="${x - 2.5}" y="-3" width="5" height="6" rx="1"/>`).join(''),
  router: '<circle class="nl-shape" r="21"/><path class="nl-detail" d="M-12 -5h18m-4 -4 4 4-4 4M12 5h-18m4 -4-4 4 4 4"/>'
};
const KIND = { pc: 'PC', server: 'Servidor', switch: 'Switch', router: 'Router' };

const reduceMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const isWide = () => window.innerWidth >= 720;

/**
 * Dibuja la topología en un <svg>. Sirve para la ventana y para la miniatura del aula.
 * opts: { selected, net (red viva: muestra las direcciones actuales), interactive }
 */
export function drawTopology(svg, network, opts = {}) {
  const net = opts.net || createNetwork(network.spec);
  const L = isWide() ? network.layout.wide : network.layout.narrow;
  svg.setAttribute('viewBox', `0 0 ${L.w} ${L.h}`);
  const P = id => L.pos[id] || [0, 0];
  // Etiquetas debajo del equipo o, si un cable pasa por debajo (columna central en móvil), a su derecha.
  const side = id => (L.side && L.side[id]) || 'bottom';
  const extent = id => {
    const [x, y] = P(id);
    return side(id) === 'right' ? [x - 40, y - 40, x + 160, y + 58] : [x - 62, y - 56, x + 62, y + 76];
  };
  // Zonas (redes): el recuadro va debajo de los cables y el rótulo encima; arriba o abajo, donde no llegue un cable.
  const boxes = (network.zones || []).map((z, i) => {
    const e = z.members.map(extent);
    const x = Math.max(2, Math.min(...e.map(b => b[0]))), y = Math.max(2, Math.min(...e.map(b => b[1])));
    const w = Math.min(L.w - 2, Math.max(...e.map(b => b[2]))) - x, h = Math.min(L.h - 2, Math.max(...e.map(b => b[3]))) - y;
    const bottom = L.zoneLabel && L.zoneLabel[i] === 'bottom';
    return { label: z.label, x, y, w, h, ly: bottom ? y + h - 8 : y + 16 };
  });
  const zones = boxes.map(b => `<rect class="nl-zone" x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="14"/>`).join('');
  const zoneLabels = boxes.map(b => `<text class="nl-zone-label" x="${b.x + 10}" y="${b.ly}">${esc(b.label)}</text>`).join('');
  const links = net.links.map(([a, b]) => `<line class="nl-link" data-link="${esc(a)}-${esc(b)}" x1="${P(a)[0]}" y1="${P(a)[1]}" x2="${P(b)[0]}" y2="${P(b)[1]}"/>`).join('');
  const nodes = [...net.devices.values()].map(d => {
    const [x, y] = P(d.id);
    const ips = addressesOf(d);
    const right = side(d.id) === 'right';
    const tx = right ? ' x="34"' : '';
    const cls = right ? ' is-right' : '';
    const labels = (d.type === 'switch' ? ['sin IP'] : ips).map((t, i) => `<text class="nl-ip${cls}"${tx} y="${(right ? 12 : 56) + i * 13}">${esc(t)}</text>`).join('');
    const label = `${d.name}, ${KIND[d.type] || ''}${ips.length ? ', ' + ips.join(' y ') : ''}`;
    const on = d.id === opts.selected;
    const attrs = opts.interactive === false ? 'aria-hidden="true"' : `role="button" tabindex="0" aria-label="${esc(label)}" aria-pressed="${on}"`;
    return `<g class="nl-node nl-${esc(d.type)}${on ? ' is-selected' : ''}" data-dev="${esc(d.id)}" transform="translate(${x} ${y})" ${attrs}>
      <circle class="nl-halo" r="28"/>${ICONS[d.type] || ICONS.pc}<text class="nl-name${cls}"${tx} y="${right ? -2 : 43}">${esc(d.name)}</text>${labels}</g>`;
  }).join('');
  svg.innerHTML = `${zones}${links}${zoneLabels}${nodes}<g class="nl-packets"></g>`;
  svg._pos = L.pos;
}

// ---------- Estado (se conserva al cerrar y reabrir la ventana del mismo curso) ----------
let S = null;
let opts = null;
let root = null;

function freshState(o) {
  const net = createNetwork(o.network.spec);
  const restored = o.saved ? importNetState(net, o.saved) : false;
  const start = o.network.start || [...net.devices.values()].find(d => d.type !== 'switch').id;
  return { key: o.key, net, selected: start, buffers: new Map(), history: new Map(), histPos: -1, hintOpen: -1, busy: false, restored };
}

export function openNetLab(o) {
  opts = o;
  if (!S || S.key !== o.key) S = freshState(o);
  if (o.select && S.net.devices.has(o.select)) S.selected = o.select;
  if (!root) buildRoot();
  root.hidden = false;
  document.documentElement.classList.add('nl-open');
  redraw();
  paintConsole();
  paintTasks();
  const input = root.querySelector('.nl-input');
  if (o.prefill && !input.disabled) input.value = o.prefill;
  input.focus({ preventScroll: true });
}

// Título y subtítulo: texto fijo o una función (el aula pone la lección actual, que cambia al avanzar).
const val = v => (typeof v === 'function' ? v() : v);
function paintHeader() {
  root.querySelector('.nl-kicker').textContent = val(opts.kicker) || 'Laboratorio de redes';
  root.querySelector('.nl-title').textContent = val(opts.title) || 'Red';
}

export function closeNetLab() {
  if (!root || root.hidden) return;
  root.hidden = true;
  document.documentElement.classList.remove('nl-open');
  if (opts && opts.onClose) opts.onClose();
}

export const isNetLabOpen = () => Boolean(root && !root.hidden);
// Vuelve a pintar las tareas (el aula lo llama cuando el servidor confirma pasos nuevos).
export function refreshNetLabTasks() { if (isNetLabOpen()) paintTasks(); }
// Red del curso abierto (para la miniatura del aula) y vuelta al principio.
export const currentNet = key => (S && S.key === key ? S.net : null);
export function resetNetLab(key) {
  if (!S || S.key !== key || S.busy) return;
  S = freshState({ ...opts, saved: null });
  if (opts && opts.onChange) opts.onChange(exportNetState(S.net));
  if (isNetLabOpen()) { redraw(); paintConsole(); paintTasks(); }
}

function buildRoot() {
  root = document.createElement('div');
  root.className = 'nl-backdrop';
  root.hidden = true;
  root.innerHTML = `
    <div class="nl-panel" role="dialog" aria-modal="true" aria-labelledby="nl-title">
      <header class="nl-head">
        <div class="nl-head-text">
          <p class="nl-kicker"></p>
          <h2 id="nl-title" class="nl-title"></h2>
        </div>
        <div class="nl-head-actions">
          <button type="button" class="nl-btn" data-nl="reset" title="Vuelve la red a como estaba al principio (no borra tu progreso)">Reiniciar red</button>
          <button type="button" class="nl-close" data-nl="close" aria-label="Cerrar">✕</button>
        </div>
      </header>
      <div class="nl-body">
        <section class="nl-topo" aria-label="Topología de la red">
          <svg class="nl-svg" role="group" aria-label="Equipos de la red"></svg>
          <p class="nl-topo-hint">Pulsa un equipo para abrir su consola.</p>
        </section>
        <section class="nl-console" aria-label="Consola">
          <div class="nl-console-bar"><span class="nl-console-name"></span><span class="nl-console-ip"></span></div>
          <div class="nl-out" aria-live="polite"></div>
          <form class="nl-form" autocomplete="off">
            <label class="nl-prompt" for="nl-input"></label>
            <input id="nl-input" class="nl-input" maxlength="300" spellcheck="false" autocapitalize="off" autocomplete="off" enterkeyhint="send" />
          </form>
        </section>
        <aside class="nl-tasks" aria-label="Tareas">
          <p class="nl-tasks-head"><span>Tareas</span><span class="nl-tasks-count"></span></p>
          <ol class="nl-task-list"></ol>
          <div class="nl-tasks-extra"></div>
        </aside>
      </div>
    </div>`;
  document.body.appendChild(root);
  root.addEventListener('click', onClick);
  root.addEventListener('keydown', onKey);
  root.querySelector('.nl-form').addEventListener('submit', onSubmit);
  let lastWide = isWide();
  window.addEventListener('resize', () => { const w = isWide(); if (w !== lastWide) { lastWide = w; if (isNetLabOpen()) redraw(); } });
}

function redraw() {
  drawTopology(root.querySelector('.nl-svg'), opts.network, { net: S.net, selected: S.selected });
}

function select(id) {
  if (S.busy || !S.net.devices.has(id)) return;
  S.selected = id;
  S.histPos = -1;
  root.querySelectorAll('.nl-node').forEach(n => {
    const on = n.dataset.dev === id;
    n.classList.toggle('is-selected', on);
    n.setAttribute('aria-pressed', String(on));
  });
  paintConsole();
  if (!isWide()) root.querySelector('.nl-console').scrollIntoView({ block: 'nearest', behavior: reduceMotion() ? 'auto' : 'smooth' });
  root.querySelector('.nl-input').focus({ preventScroll: true });
}

// ---------- Consola ----------
const bufferOf = id => {
  if (!S.buffers.has(id)) {
    const d = S.net.devices.get(id);
    S.buffers.set(id, d.type === 'switch'
      ? [{ t: `${d.name} es un switch: no tiene dirección IP ni consola. Conecta a los equipos de su red y les pasa las tramas entre ellos.`, c: 'info' }]
      : [{ t: `Consola de ${d.name}. Escribe help para ver los comandos.${S.restored ? ' (Red restaurada: sigues donde lo dejaste.)' : ''}`, c: 'info' }]);
  }
  return S.buffers.get(id);
};
const promptOf = d => `alumno@${d.name.toLowerCase()}:~$`;

function paintConsole() {
  const d = S.net.devices.get(S.selected);
  root.querySelector('.nl-console-name').textContent = d.type === 'switch' ? d.name : promptOf(d).slice(0, -3);
  root.querySelector('.nl-console-ip').textContent = addressesOf(d).join(' · ');
  root.querySelector('.nl-prompt').textContent = promptOf(d);
  const out = root.querySelector('.nl-out');
  out.replaceChildren(...bufferOf(d.id).map(lineEl));
  out.scrollTop = out.scrollHeight;
  root.querySelector('.nl-input').disabled = d.type === 'switch' || S.busy;
  root.querySelector('.nl-form').classList.toggle('is-off', d.type === 'switch');
}

function lineEl({ t, c }) {
  const div = document.createElement('div');
  div.className = `nl-line${c ? ' nl-' + c : ''}`;
  div.textContent = t || ' ';
  return div;
}

function print(id, lines, cls) {
  const buf = bufferOf(id);
  const rows = lines.map(t => ({ t, c: cls || classify(t) }));
  buf.push(...rows);
  if (buf.length > 400) buf.splice(0, buf.length - 400);
  if (id === S.selected) {
    const out = root.querySelector('.nl-out');
    rows.forEach(r => out.appendChild(lineEl(r)));
    out.scrollTop = out.scrollHeight;
  }
}
const classify = t => (/Unreachable|100% packet loss|Error|error|not found|Cannot|RTNETLINK|bad number|not known|failed|refused|Timeout|timed out|Could not|no servers|NXDOMAIN|\* \* \*$/.test(t) ? 'err'
  : /^64 bytes|[^0-9]0% packet loss|succeeded!|status: NOERROR|HTTP\/1\.1 2|verify ok|Verification: OK/.test(t) ? 'ok'
  : /^\[LAB\]/.test(t) ? 'info' : '');

async function onSubmit(e) {
  e.preventDefault();
  const input = root.querySelector('.nl-input');
  const line = input.value;
  const id = S.selected;
  const d = S.net.devices.get(id);
  if (S.busy || d.type === 'switch') return;
  input.value = '';
  print(id, [`${promptOf(d)} ${line}`], 'cmd');
  if (line.trim()) {
    const h = S.history.get(id) || [];
    h.push(line.trim());
    S.history.set(id, h.slice(-50));
  }
  S.histPos = -1;
  const res = runCommand(S.net, id, line);
  if (res.clear) { S.buffers.set(id, []); paintConsole(); return; }
  if (res.legs.length) {
    S.busy = true;
    input.disabled = true;
    const firstShown = /^(PING|traceroute to|\*   Trying)/.test(res.lines[0] || '') ? 1 : 0;
    print(id, res.lines.slice(0, firstShown));
    await animate(res.legs);
    print(id, res.lines.slice(firstShown));
    S.busy = false;
    input.disabled = false;
    input.focus({ preventScroll: true });
  } else {
    print(id, res.lines);
  }
  if (res.changed) {
    if (/^(?:sudo )?ip (a|addr|address) /.test(line.trim())) redraw(); // la etiqueta del equipo cambia
    if (opts.onChange) opts.onChange(exportNetState(S.net));
  }
  if (opts.onEvent) opts.onEvent(res.event);
  paintTasks();
}

function onKey(e) {
  if (e.key === 'Escape') { closeNetLab(); return; }
  const node = e.target.closest && e.target.closest('.nl-node');
  if (node && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); select(node.dataset.dev); return; }
  if (e.target.classList.contains('nl-input') && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
    const h = S.history.get(S.selected) || [];
    if (!h.length) return;
    e.preventDefault();
    if (e.key === 'ArrowUp') S.histPos = S.histPos < 0 ? h.length - 1 : Math.max(0, S.histPos - 1);
    else S.histPos = S.histPos < 0 ? -1 : S.histPos + 1;
    if (S.histPos >= h.length) S.histPos = -1;
    e.target.value = S.histPos < 0 ? '' : h[S.histPos];
  }
}

function onClick(e) {
  if (e.target === root) { closeNetLab(); return; }
  const act = e.target.closest('[data-nl]');
  if (act) {
    const what = act.dataset.nl;
    if (what === 'close') closeNetLab();
    if (what === 'reset') resetNetLab(S.key);
    if (what === 'hint') { const i = Number(act.dataset.i); S.hintOpen = S.hintOpen === i ? -1 : i; paintTasks(); }
    if (what === 'extra' && opts.onExtra) { closeNetLab(); opts.onExtra(act.dataset.arg); }
    return;
  }
  const node = e.target.closest('.nl-node');
  if (node) select(node.dataset.dev);
}

// ---------- Tareas ----------
function paintTasks() {
  paintHeader();
  const tasks = (opts.tasks && opts.tasks()) || [];
  const next = tasks.findIndex(t => !t.done);
  root.querySelector('.nl-tasks-count').textContent = tasks.length ? `${tasks.filter(t => t.done).length}/${tasks.length}` : '';
  root.querySelector('.nl-task-list').innerHTML = tasks.map((t, i) => `
    <li class="nl-task${t.done ? ' is-done' : ''}${i === next ? ' is-next' : ''}">
      <span class="nl-check" aria-hidden="true">${t.done ? '✓' : i + 1}</span>
      <div class="nl-task-body">
        <p>${esc(t.text)}${t.done ? ' <span class="sr-only">(hecha)</span>' : ''}</p>
        ${!t.done && i === next && t.hint ? `<button type="button" class="nl-hint-btn" data-nl="hint" data-i="${i}" aria-expanded="${S.hintOpen === i}">${S.hintOpen === i ? 'Ocultar pista' : 'Pista'}</button>` : ''}
        ${S.hintOpen === i && !t.done && t.hint ? `<p class="nl-hint">${esc(t.hint)}</p>` : ''}
      </div>
    </li>`).join('');
  const extra = opts.extra ? opts.extra() : null;
  root.querySelector('.nl-tasks-extra').innerHTML = extra
    ? `<div class="nl-win"><p>${esc(extra.text)}</p>${extra.button ? `<button type="button" class="nl-btn nl-btn-solid" data-nl="extra" data-arg="${esc(extra.arg || '')}">${esc(extra.button)}</button>` : ''}</div>`
    : '';
}

// ---------- Animación del paquete ----------
// Las marcas del comando anterior se borran al rato; si empieza otro antes, se cancela (si no, borraría el nuevo).
let cleanupTimer = null;
async function animate(legs) {
  const svg = root.querySelector('.nl-svg');
  const layer = svg.querySelector('.nl-packets');
  const pos = svg._pos;
  clearTimeout(cleanupTimer);
  layer.replaceChildren();
  const cleanLater = () => { cleanupTimer = setTimeout(() => layer.replaceChildren(), 1200); };
  if (reduceMotion()) {
    const lost = legs.find(l => !l.ok);
    if (lost) markFail(layer, pos[lost.path[lost.path.length - 1]]);
    await sleep(120);
    cleanLater();
    return;
  }
  for (const leg of legs) {
    await travel(layer, pos, leg);
    if (!leg.ok) break;
  }
  cleanLater();
}

async function travel(layer, pos, leg) {
  const { path, ok, kind } = leg;
  const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  dot.setAttribute('r', '7');
  dot.setAttribute('class', `nl-packet nl-packet-${kind}`);
  const start = pos[path[0]] || [0, 0];
  dot.setAttribute('cx', start[0]);
  dot.setAttribute('cy', start[1]);
  layer.appendChild(dot);
  const speed = path.length > 5 ? 260 : 320;
  for (let i = 0; i < path.length - 1; i++) {
    const a = pos[path[i]], b = pos[path[i + 1]];
    if (!a || !b) continue;
    const link = layer.ownerSVGElement.querySelector(`[data-link="${path[i]}-${path[i + 1]}"], [data-link="${path[i + 1]}-${path[i]}"]`);
    if (link) link.classList.add('is-active');
    await move(dot, a, b, speed);
    if (link) link.classList.remove('is-active');
  }
  if (!ok) { dot.classList.add('is-lost'); markFail(layer, pos[path[path.length - 1]]); await sleep(500); }
  else await sleep(90);
  dot.remove();
}

function move(dot, [x1, y1], [x2, y2], ms) {
  return new Promise(resolve => {
    const t0 = performance.now();
    const step = now => {
      const k = Math.min(1, (now - t0) / ms);
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      dot.setAttribute('cx', x1 + (x2 - x1) * e);
      dot.setAttribute('cy', y1 + (y2 - y1) * e);
      if (k < 1) requestAnimationFrame(step); else resolve();
    };
    requestAnimationFrame(step);
  });
}

function markFail(layer, p) {
  if (!p) return;
  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  g.setAttribute('class', 'nl-fail');
  g.setAttribute('transform', `translate(${p[0] + 22} ${p[1] - 24})`);
  g.innerHTML = '<circle r="10"/><path d="M-4 -4l8 8M4 -4l-8 8"/>';
  layer.appendChild(g);
}
