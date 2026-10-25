/**
 * Aceptación de los documentos legales (términos, privacidad y cookies).
 *  - Con sesión: si el servidor dice que falta aceptar la versión vigente de alguno, se muestra una ventana que
 *    no se puede cerrar sin aceptar o salir. La aceptación la guarda Supabase (accept_legal) con fecha del servidor.
 *  - Sin sesión: aviso breve de cookies en la portada; se recuerda en este navegador.
 * Cuando se cambie un documento: subir LEGAL_VERSION y la versión en public.legal_documents (migración).
 */
import { appState, isSessionValid } from '../state.js?v=dev101x-v109';
import { isCloudEnabled, CONFIG } from '../config.js?v=dev101x-v109';
import { fetchPendingLegal, acceptLegal, setEmailOptIn } from '../cloud.js?v=dev101x-v109';
import { showToast } from '../ui.js?v=dev101x-v109';
import { esc } from '../lib/html.js?v=dev101x-v109';

// Al activar los avisos por correo (CONFIG.emailReminders) pasa a '2026-10-15' junto con la nueva privacidad
// (supabase/pendiente/privacidad-2026-10-15.html) y public.legal_documents.
export const LEGAL_VERSION = '2026-10-13';
const DOCS = {
  terms: { label: 'He leído y acepto los', link: 'Términos y condiciones', href: '/terminos/' },
  privacy: { label: 'Autorizo el tratamiento de mis datos según la', link: 'Política de privacidad', href: '/privacidad/' },
  cookies: { label: 'Acepto la', link: 'Política de cookies', href: '/cookies/' }
};
const acceptedKey = userId => `dev101x_legal:${userId}`;
const COOKIE_KEY = 'dev101x_cookies';

const read = key => { try { return localStorage.getItem(key); } catch (e) { return null; } };
const write = (key, value) => { try { localStorage.setItem(key, value); } catch (e) { /* sin almacenamiento */ } };

let checking = false;
let overlay = null;

// Comprueba con el servidor (solo si este navegador no sabe ya que la versión vigente está aceptada).
export async function checkConsent({ onDecline } = {}) {
  const s = appState.session;
  if (checking || overlay || !isCloudEnabled() || !isSessionValid() || !s || !s.userId) return;
  if (read(acceptedKey(s.userId)) === LEGAL_VERSION) return;
  checking = true;
  try {
    const pending = await fetchPendingLegal();
    if (!isSessionValid() || appState.session.userId !== s.userId) return;
    if (!pending.length) { markAccepted(s.userId); return; }
    showConsent(pending.map(p => p.document).filter(d => DOCS[d]), s.userId, onDecline);
  } catch (e) {
    // Sin conexión o el servidor aún sin la función: se vuelve a preguntar la próxima vez.
  } finally {
    checking = false;
  }
}

function markAccepted(userId) {
  write(acceptedKey(userId), LEGAL_VERSION);
  write(COOKIE_KEY, JSON.stringify({ v: LEGAL_VERSION, at: new Date().toISOString() }));
  hideCookieNotice();
}

function showConsent(docs, userId, onDecline) {
  if (!docs.length) return;
  overlay = document.createElement('div');
  overlay.className = 'fixed inset-0 z-[65] bg-ink/50 backdrop-blur-sm flex items-center justify-center p-4';
  overlay.innerHTML = `
    <div role="dialog" aria-modal="true" aria-labelledby="consent-title" class="w-full max-w-md max-h-[85dvh] overflow-y-auto bg-surface rounded-2xl shadow-2xl border border-line modal-enter p-6 flex flex-col gap-4">
      <div class="flex flex-col gap-1.5">
        <h2 id="consent-title" class="text-lg font-extrabold text-ink tracking-tight">Antes de seguir</h2>
        <p class="text-[13px] text-ink2 leading-relaxed">Para usar Dev101x necesitamos que aceptes estos documentos. Se guarda qué versión aceptas y cuándo.</p>
      </div>
      <div class="flex flex-col gap-2.5">
        ${docs.map(d => `
          <label class="flex items-start gap-2.5 text-[13px] text-ink2 leading-snug cursor-pointer">
            <input type="checkbox" data-consent="${esc(d)}" class="mt-0.5 w-4 h-4 shrink-0 accent-[#005c38]" />
            <span>${esc(DOCS[d].label)} <a href="${DOCS[d].href}" target="_blank" rel="noopener" class="font-semibold text-accent hover:underline">${esc(DOCS[d].link)}</a>.</span>
          </label>`).join('')}
      </div>
      ${CONFIG.emailReminders ? `<label class="flex items-start gap-2.5 pt-3 border-t border-line text-[13px] text-ink2 leading-snug cursor-pointer">
        <input type="checkbox" data-consent-email class="mt-0.5 w-4 h-4 shrink-0 accent-[#005c38]" />
        <span>Quiero recibir por correo avisos sobre mi progreso. <span class="text-muted">Opcional: puedes cambiarlo en tu perfil o darte de baja desde cualquier correo.</span></span>
      </label>` : ''}
      <p data-consent-error role="alert" class="hidden text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2"></p>
      <div class="flex items-center justify-between gap-3 pt-1">
        <button type="button" data-consent-decline class="text-[13px] font-semibold text-muted hover:text-ink">Salir</button>
        <button type="button" data-consent-accept disabled class="inline-flex items-center h-10 px-5 rounded-full bg-accent hover:bg-accent2 text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors">Aceptar y continuar</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const boxes = [...overlay.querySelectorAll('[data-consent]')];
  const accept = overlay.querySelector('[data-consent-accept]');
  const error = overlay.querySelector('[data-consent-error]');
  const sync = () => { accept.disabled = !boxes.every(b => b.checked); };
  boxes.forEach(b => b.addEventListener('change', sync));
  boxes[0].focus();

  accept.addEventListener('click', async () => {
    accept.disabled = true;
    error.classList.add('hidden');
    try {
      const left = await acceptLegal(docs);
      if (left > 0) throw new Error('Quedan documentos pendientes');
      const emailBox = overlay.querySelector('[data-consent-email]');
      const wantsEmail = Boolean(emailBox && emailBox.checked);
      markAccepted(userId);
      closeConsent();
      showToast('Gracias. Ya puedes seguir con tus cursos.', 'success');
      // El permiso de correo es aparte y opcional: si falla, no bloquea la entrada (se puede activar en el perfil).
      if (wantsEmail) setEmailOptIn(true, 'consent').catch(() => showToast('No se pudieron activar los avisos por correo. Puedes hacerlo desde tu perfil.', 'error'));
    } catch (e) {
      error.textContent = 'No se pudo guardar tu aceptación. Revisa tu conexión e inténtalo de nuevo.';
      error.classList.remove('hidden');
      sync();
    }
  });
  overlay.querySelector('[data-consent-decline]').addEventListener('click', () => {
    closeConsent();
    if (onDecline) onDecline();
  });
}

export function closeConsent() {
  if (overlay) overlay.remove();
  overlay = null;
}

// ---------------------------------------------------------------------------
// Aviso de cookies para visitantes sin sesión
// ---------------------------------------------------------------------------
let notice = null;

export function showCookieNotice() {
  if (notice || read(COOKIE_KEY)) return;
  notice = document.createElement('div');
  notice.setAttribute('role', 'region');
  notice.setAttribute('aria-label', 'Aviso de cookies');
  notice.className = 'fixed bottom-3 left-3 right-3 sm:left-auto sm:right-4 sm:bottom-4 sm:max-w-sm z-40 bg-surface border border-line rounded-xl shadow-lg p-4 flex flex-col gap-3 text-[12px] text-ink2 leading-relaxed';
  notice.innerHTML = `
    <p>Solo guardamos en tu navegador lo necesario para que la plataforma funcione. Sin publicidad ni rastreo. <a href="/cookies/" class="font-semibold text-accent hover:underline">Política de cookies</a></p>
    <button type="button" class="self-end inline-flex items-center h-8 px-4 rounded-full bg-ink hover:bg-ink2 text-white text-[12px] font-semibold">Entendido</button>`;
  notice.querySelector('button').addEventListener('click', () => {
    write(COOKIE_KEY, JSON.stringify({ v: LEGAL_VERSION, at: new Date().toISOString() }));
    hideCookieNotice();
  });
  document.body.appendChild(notice);
}

export function hideCookieNotice() {
  if (notice) notice.remove();
  notice = null;
}
