/**
 * Pantalla de carga con la marca: Dev101x al centro y Google y GitHub que llegan en curva a sus lados, unidos
 * por una línea que se dibuja. Mientras espera: una onda suave desde el centro y los logos flotan.
 * Solo CSS (en app.css, clases .ldr-*); con "reducir movimiento" se ve quieta.
 *  - showLoader(texto, { delay }): con delay solo aparece si la espera supera ese tiempo (no parpadea).
 *  - hideLoader(): la retira cuando ha estado visible al menos un momento, para que no sea un destello.
 */
const MIN_VISIBLE = 700;
let el = null;
let showTimer = null;
let shownAt = 0;

function build() {
  const node = document.createElement('div');
  node.className = 'ldr';
  node.setAttribute('role', 'status');
  node.setAttribute('aria-live', 'polite');
  node.innerHTML = `
    <div class="ldr-stage" aria-hidden="true">
      <span class="ldr-line"></span>
      <span class="ldr-ring"></span>
      <span class="ldr-tile ldr-g"><img src="assets/google.png" alt="" width="26" height="26" /></span>
      <span class="ldr-tile ldr-brand"><img src="assets/icon-192.png" alt="" width="56" height="56" class="pixelated" /></span>
      <span class="ldr-tile ldr-gh"><img src="assets/logos/github.svg" alt="" width="24" height="24" /></span>
    </div>
    <p class="ldr-text"></p>`;
  return node;
}

export function showLoader(text = 'Cargando…', { delay = 0 } = {}) {
  clearTimeout(showTimer);
  const go = () => {
    if (!el) {
      el = build();
      document.body.appendChild(el);
      requestAnimationFrame(() => { if (el) el.classList.add('is-on'); });
      shownAt = Date.now();
    }
    el.querySelector('.ldr-text').textContent = text;
  };
  if (delay > 0) showTimer = setTimeout(go, delay);
  else go();
}

export function hideLoader() {
  clearTimeout(showTimer);
  if (!el) return;
  const node = el;
  el = null;
  const wait = Math.max(0, MIN_VISIBLE - (Date.now() - shownAt));
  setTimeout(() => {
    node.classList.remove('is-on');
    setTimeout(() => node.remove(), 280);
  }, wait);
}
