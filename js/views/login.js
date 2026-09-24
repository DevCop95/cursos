/**
 * Vista: Login con Google.
 *  - Modo nube: botón propio → redirección OAuth de Supabase. Si este navegador recuerda la
 *    última cuenta, se ofrece "Continuar como …" con opción de usar otra o de olvidarla.
 *  - Modo local (sin Supabase): botón oficial de Google Identity Services.
 */
import { CONFIG, isCloudEnabled } from '../config.js';
import { prepareNonce, signInWithGoogleCredential, startGoogleLogin, getLastAccount, forgetLastAccount } from '../auth.js';
import { esc } from '../lib/html.js';
import { avatarFor, showToast } from '../ui.js';

const GOOGLE_LOGO = `
  <svg class="w-5 h-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
  </svg>`;

const SPINNER = '<span class="w-5 h-5 rounded-full border-2 border-accent/25 border-t-accent animate-spin shrink-0" aria-hidden="true"></span>';

// Estado que sobrevive a un re-render: 'pending' mientras se verifica la vuelta de Google, o un error.
let loginStatus = null;
let onLoginSuccess = () => {};

export function setLoginStatus(status) {
  loginStatus = status;
  paintActions();
}

// ---------------------------------------------------------------------------
// Modo nube: botones propios
// ---------------------------------------------------------------------------
function googleButtonHtml() {
  return `
    <button type="button" data-action="google-login" data-mode="new"
      class="login-btn w-full h-12 flex items-center justify-center gap-3 px-5 rounded-xl bg-white border border-line text-sm font-semibold text-ink">
      ${GOOGLE_LOGO}<span>Continuar con Google</span>
    </button>`;
}

function accountHtml(acc) {
  return `
    <button type="button" data-action="google-login" data-mode="continue"
      class="login-btn login-account group w-full flex items-center gap-3.5 p-3 pr-3.5 rounded-2xl bg-white border border-line text-left">
      <img src="${esc(avatarFor(acc))}" alt="" referrerpolicy="no-referrer" class="w-11 h-11 rounded-xl object-cover border border-line shrink-0" />
      <span class="flex-1 min-w-0">
        <span class="block text-[11px] text-muted font-medium">Continuar como</span>
        <span class="block text-sm font-bold text-ink truncate">${esc(acc.name || acc.email)}</span>
        <span class="block text-[11px] text-muted font-mono truncate">${esc(acc.email)}</span>
      </span>
      <span class="login-account-arrow w-9 h-9 rounded-full bg-accent text-white flex items-center justify-center shrink-0" aria-hidden="true">
        <span class="material-symbols-outlined text-[18px]">arrow_forward</span>
      </span>
    </button>
    <div class="flex items-center justify-center gap-3 text-xs">
      <button type="button" data-action="google-login" data-mode="other" class="inline-flex items-center gap-1 font-semibold text-accent hover:text-accent2 hover:underline underline-offset-2">
        <span class="material-symbols-outlined text-[16px]" aria-hidden="true">switch_account</span>Usar otra cuenta
      </button>
      <span class="text-line" aria-hidden="true">•</span>
      <button type="button" data-action="forget-account" class="text-muted hover:text-ink hover:underline underline-offset-2">No soy yo</button>
    </div>`;
}

function pendingHtml() {
  return `
    <div class="w-full h-[88px] flex items-center justify-center gap-3 rounded-2xl bg-bg/70 border border-line/70">
      ${SPINNER}<span class="text-sm font-medium text-ink2">Verificando tu cuenta…</span>
    </div>`;
}

function paintActions() {
  const box = document.getElementById('login-actions');
  const statusEl = document.getElementById('login-status');
  if (!box) return;

  if (statusEl) {
    const error = loginStatus && loginStatus.type === 'error' ? loginStatus.text : '';
    statusEl.textContent = error;
    statusEl.classList.toggle('hidden', !error);
  }
  if (!isCloudEnabled()) return; // el botón de Google Identity Services se monta aparte

  if (loginStatus && loginStatus.type === 'pending') {
    box.innerHTML = pendingHtml();
    return;
  }
  const acc = getLastAccount();
  box.innerHTML = acc ? accountHtml(acc) : googleButtonHtml();
}

export async function loginWithGoogle(button) {
  const box = document.getElementById('login-actions');
  if (!box || box.getAttribute('aria-busy') === 'true') return;
  box.setAttribute('aria-busy', 'true');
  box.querySelectorAll('button').forEach(b => { b.disabled = true; });

  const main = box.querySelector('.login-btn');
  if (main) {
    main.innerHTML = `${SPINNER}<span class="text-sm font-semibold text-ink2">Conectando con Google…</span>`;
    main.classList.add('justify-center');
  }
  loginStatus = null;
  const statusEl = document.getElementById('login-status');
  if (statusEl) statusEl.classList.add('hidden');

  try {
    await startGoogleLogin(button.dataset.mode);
    // Si todo va bien el navegador ya está saliendo hacia Google.
  } catch (err) {
    console.error('No se pudo iniciar el login con Google:', err);
    box.removeAttribute('aria-busy');
    setLoginStatus({
      type: 'error',
      text: err && err.code === 'oauth_not_configured'
        ? 'El acceso con Google no está disponible en este momento. Inténtalo más tarde.'
        : 'No se pudo conectar con Google. Revisa tu conexión e inténtalo de nuevo.'
    });
  }
}

export function forgetAccount() {
  forgetLastAccount();
  loginStatus = null;
  paintActions();
}

// ---------------------------------------------------------------------------
// Modo local: botón oficial de Google Identity Services
// ---------------------------------------------------------------------------
function setGsiStatus(el, message, tone) {
  const span = document.createElement('span');
  span.className = `text-xs ${tone === 'error' ? 'text-rose-600' : 'text-amber-700'}`;
  span.textContent = message;
  el.replaceChildren(span);
}

async function mountGoogleButton() {
  const el = document.getElementById('login-actions');
  if (!el) return;
  el.innerHTML = `<div class="w-full h-12 flex items-center justify-center gap-3 rounded-xl bg-white border border-line text-sm text-ink2">${SPINNER}<span>Cargando Google…</span></div>`;

  for (let i = 0; i < 40 && !(window.google && window.google.accounts && window.google.accounts.id); i++) {
    await new Promise(r => setTimeout(r, 100));
  }
  if (!document.body.contains(el)) return;
  if (!(window.google && window.google.accounts && window.google.accounts.id)) {
    setGsiStatus(el, 'El servicio de Google tardó en cargar. Recarga la página.', 'warn');
    return;
  }

  try {
    const nonce = await prepareNonce();
    window.google.accounts.id.initialize({
      client_id: CONFIG.googleClientId,
      nonce,
      auto_select: false,
      cancel_on_tap_outside: true,
      callback: async (resp) => {
        if (!resp || !resp.credential) {
          showToast('No se recibió la credencial de Google', 'error');
          return;
        }
        el.setAttribute('aria-busy', 'true');
        const result = await signInWithGoogleCredential(resp.credential);
        el.removeAttribute('aria-busy');
        if (!result.ok) {
          showToast(result.error, 'error');
          mountGoogleButton(); // nonce nuevo para el siguiente intento
          return;
        }
        onLoginSuccess();
      }
    });
    el.replaceChildren();
    const width = Math.min(360, Math.max(240, el.clientWidth || 320));
    window.google.accounts.id.renderButton(el, { theme: 'outline', size: 'large', width, text: 'continue_with', shape: 'rectangular', logo_alignment: 'center' });
  } catch (e) {
    console.error('Error inicializando Google Identity Services:', e);
    setGsiStatus(el, 'No se pudo iniciar el acceso con Google.', 'error');
  }
}

// ---------------------------------------------------------------------------
export function renderLogin(container, onSuccess) {
  onLoginSuccess = onSuccess;
  container.innerHTML = `
    <div class="relative w-full min-h-[82vh] flex flex-col items-center justify-center py-10 px-4 z-10">
      <div class="login-card-editorial w-full max-w-[400px] rounded-[28px] p-7 sm:p-9 flex flex-col gap-7 modal-enter">
        <header class="flex flex-col items-center text-center gap-4">
          <div class="relative group cursor-default">
            <div class="absolute -inset-2 rounded-2xl bg-gradient-to-tr from-accent/20 via-[#9ffdd3]/30 to-accent/10 blur-md opacity-60 group-hover:opacity-100 transition-all duration-500" aria-hidden="true"></div>
            <div class="relative w-16 h-16 rounded-2xl bg-white border border-line flex items-center justify-center p-2.5 group-hover:scale-105 transition-transform duration-300">
              <img src="assets/icon-192.png" alt="" class="w-11 h-11 rounded-lg object-contain pixelated" />
            </div>
          </div>
          <div class="flex flex-col gap-1.5">
            <h1 class="text-[28px] sm:text-[32px] leading-tight font-extrabold text-ink tracking-tight">Bienvenido a Dev<em class="not-italic text-accent">101x</em></h1>
            <p class="text-sm text-ink2">Pentesting y ciberseguridad con laboratorios prácticos.</p>
          </div>
        </header>

        <div class="flex flex-col gap-3">
          <div id="login-actions" class="flex flex-col gap-3 min-h-[48px]"></div>
          <p id="login-status" role="alert" class="hidden text-xs text-rose-700 text-center bg-rose-50 border border-rose-200 rounded-lg px-3 py-2"></p>
        </div>

        <footer class="pt-5 border-t border-line/70 flex items-start gap-2.5 text-[11px] leading-relaxed text-muted">
          <span class="material-symbols-outlined text-[16px] text-accent mt-px" aria-hidden="true">lock</span>
          <span>Acceso seguro con tu cuenta de Google. Solo usamos tu nombre, correo y foto de perfil.</span>
        </footer>
      </div>
      <p class="w-full max-w-[400px] mt-5 text-center text-[11px] text-muted">&copy; ${new Date().getFullYear()} Dev<em class="not-italic text-accent font-bold">101x</em> &bull; Plataforma Oficial de Aprendizaje</p>
    </div>
  `;
  if (isCloudEnabled()) paintActions();
  else mountGoogleButton();
}
