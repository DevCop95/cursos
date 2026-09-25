/**
 * Vista: página pública del curso + login con Google.
 *  - Modo nube: botón propio → redirección OAuth de Supabase. Si este navegador recuerda la
 *    última cuenta, se ofrece "Continuar como …" con opción de usar otra o de olvidarla.
 *  - Modo local (sin Supabase): botón oficial de Google Identity Services.
 */
import { CONFIG, isCloudEnabled } from '../config.js?v=dev101x-v65';
import { COURSE, COURSE_VIDEO } from '../content.js?v=dev101x-v65';
import { prepareNonce, signInWithGoogleCredential, startGoogleLogin, getLastAccount, forgetLastAccount } from '../auth.js?v=dev101x-v65';
import { esc } from '../lib/html.js?v=dev101x-v65';
import { avatarFor, showToast, openModal } from '../ui.js?v=dev101x-v65';

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
      class="login-btn self-start inline-flex items-center gap-2.5 h-11 pl-4 pr-5 rounded-full bg-white border border-line text-sm font-semibold text-ink">
      ${GOOGLE_LOGO}<span>Continuar con Google</span>
    </button>`;
}

function accountHtml(acc) {
  const first = String(acc.name || acc.email).split(' ')[0];
  return `
    <button type="button" data-action="google-login" data-mode="continue" title="${esc(acc.email)}"
      class="login-btn self-start inline-flex items-center gap-2.5 h-11 pl-1.5 pr-4 rounded-full bg-white border border-line text-sm text-ink">
      <img src="${esc(avatarFor(acc))}" alt="" referrerpolicy="no-referrer" class="w-8 h-8 rounded-full object-cover shrink-0" />
      <span class="whitespace-nowrap">Continuar como <strong class="font-semibold">${esc(first)}</strong></span>
      <span class="material-symbols-outlined text-[18px] text-accent" aria-hidden="true">arrow_forward</span>
    </button>
    <div class="flex items-center gap-2 flex-wrap">
      <button type="button" data-action="google-login" data-mode="other" class="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-white/70 border border-line hover:border-accent/60 hover:text-accent text-[12px] font-semibold text-ink2 transition-colors">
        <span class="material-symbols-outlined text-[16px]" aria-hidden="true">switch_account</span>Usar otra cuenta
      </button>
      <button type="button" data-action="forget-account" class="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-white/70 border border-line hover:border-rose-300 hover:text-rose-600 text-[12px] font-semibold text-ink2 transition-colors">
        <span class="material-symbols-outlined text-[16px]" aria-hidden="true">person_remove</span>No soy yo
      </button>
    </div>`;
}

function pendingHtml() {
  return `
    <div class="self-start inline-flex items-center gap-2.5 h-11 px-4 rounded-full bg-white border border-line">
      ${SPINNER}<span class="text-sm font-medium text-ink2">Verificando tu cuenta…</span>
    </div>`;
}

function paintActions() {
  const box = document.getElementById('login-actions');
  const statusEl = document.getElementById('login-status');
  if (!box) return;
  if (loginStatus) openLoginModal();

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
  if (main) main.innerHTML = `${SPINNER}<span class="text-sm font-semibold text-ink2 whitespace-nowrap">Conectando con Google…</span>`;
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
// Página pública (antes del login): el móvil con la app como portada, el curso y el acceso en un popup.
// ---------------------------------------------------------------------------
export function renderLogin(container, onSuccess) {
  onLoginSuccess = onSuccess;
  const lessons = COURSE.syllabus.reduce((n, m) => n + m.lessons.length, 0);

  container.innerHTML = `
    <div class="relative z-10 w-full max-w-5xl mx-auto flex flex-col gap-5">
      <div class="flex items-center justify-between gap-3 px-1">
        <div class="flex items-center gap-2.5">
          <img src="assets/icon-192.png" alt="" class="w-8 h-8 rounded-lg pixelated" />
          <span class="font-extrabold text-lg tracking-tight text-ink">Dev<em class="not-italic text-accent">101x</em></span>
        </div>
        <button type="button" data-open-login class="inline-flex items-center gap-1.5 h-9 px-4 rounded-full bg-white border border-line hover:border-accent/60 hover:text-accent text-sm font-semibold text-ink transition-colors">
          <span class="material-symbols-outlined text-[18px]" aria-hidden="true">login</span>Entrar
        </button>
      </div>

      <section class="landing-card w-full rounded-3xl p-6 sm:p-10 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-8 md:gap-12 items-center modal-enter">
        <div class="flex flex-col gap-5 min-w-0">
          <div class="flex flex-col gap-3">
            <p class="text-[11px] font-mono font-bold text-accent uppercase tracking-wide">Cursos de ciberseguridad en español</p>
            <h1 class="text-[32px] sm:text-[44px] leading-[1.05] font-extrabold text-ink tracking-tight">Practica donde estés</h1>
            <p class="text-[15px] text-ink2 leading-relaxed">Aprende pentesting con una consola dentro del navegador. La consola, las lecciones y tu avance funcionan igual en el móvil y en el ordenador, sin instalar nada.</p>
          </div>
          <div class="flex flex-col gap-1.5" role="tablist" aria-label="Pantallas de la app">
            ${PHONE_SCREENS.map((s, i) => `
              <button type="button" role="tab" data-phone-tab="${i}" aria-selected="${i === 0}" class="phone-tab">
                <span class="material-symbols-outlined text-[20px]" aria-hidden="true">${s.icon}</span>
                <span class="flex flex-col text-left min-w-0">
                  <span class="text-sm font-semibold text-ink">${esc(s.title)}</span>
                  <span class="text-xs text-muted">${esc(s.text)}</span>
                </span>
              </button>`).join('')}
          </div>
          <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
            <button type="button" data-open-login class="inline-flex items-center gap-2 h-11 px-6 rounded-full bg-accent hover:bg-accent2 text-white text-sm font-semibold transition-colors">
              Empezar gratis<span class="material-symbols-outlined text-[18px]" aria-hidden="true">arrow_forward</span>
            </button>
            <span class="text-xs text-muted">Con tu cuenta de Google</span>
          </div>
        </div>
        <button type="button" class="phone-frame justify-self-center" data-phone-next aria-label="Ver la siguiente pantalla">
          <span class="phone-screen">
            ${PHONE_SCREENS.map((s, i) => `<img src="${s.img}" alt="${esc(s.alt)}" width="488" height="1055" ${i === 0 ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async" class="phone-shot${i === 0 ? ' is-active' : ''}" data-phone-shot="${i}" />`).join('')}
          </span>
        </button>
      </section>

      <section class="landing-card w-full rounded-3xl p-6 sm:p-10 grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
        <div class="flex flex-col gap-4 min-w-0">
          <div class="flex flex-col gap-2">
            <p class="text-[11px] font-mono font-bold text-accent uppercase tracking-wide">Curso gratis</p>
            <h2 class="text-2xl sm:text-[28px] leading-tight font-extrabold text-ink tracking-tight">Pentesting 101</h2>
            <p class="text-[15px] text-ink2 leading-relaxed">Aprende a reconocer una red y a escanear puertos con Nmap desde Windows, lección a lección y con laboratorios.</p>
            <p class="text-xs font-mono text-muted">${esc(COURSE.duration.toLowerCase())} · ${lessons} lecciones · en español</p>
          </div>
          <button type="button" data-open-login class="self-start inline-flex items-center gap-1.5 h-10 px-4 rounded-full bg-white border border-line hover:border-accent/60 hover:text-accent text-sm font-semibold text-ink transition-colors">
            Empezar el curso<span class="material-symbols-outlined text-[18px]" aria-hidden="true">arrow_forward</span>
          </button>
        </div>
        <button type="button" data-action="open-video" data-start="0" class="group relative w-full aspect-video rounded-2xl overflow-hidden bg-term text-left" aria-label="Ver el video de la clase">
          <img src="https://i.ytimg.com/vi/${COURSE_VIDEO.id}/hqdefault.jpg" alt="" class="absolute inset-0 w-full h-full object-cover" loading="lazy" decoding="async" />
          <span class="absolute inset-0 bg-black/25 group-hover:bg-black/15 transition-colors"></span>
          <span class="absolute inset-0 flex items-center justify-center">
            <span class="w-14 h-14 rounded-full bg-white/95 flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform"><span class="material-symbols-outlined text-accent text-4xl" aria-hidden="true">play_arrow</span></span>
          </span>
        </button>
      </section>

      <section class="landing-card w-full rounded-3xl px-6 sm:px-10 py-6 sm:py-8">
        <h2 class="text-base font-bold text-ink mb-3">Temario</h2>
        <ol class="flex flex-col divide-y divide-line/70">
          ${COURSE.syllabus.map((m, i) => `
            <li class="flex items-baseline justify-between gap-4 py-2.5 text-sm">
              <span class="text-ink2"><span class="font-mono text-muted mr-2">${i + 1}.</span>${esc(m.module.replace(/^Módulo \d+:\s*/, ''))}</span>
              <span class="text-xs text-muted shrink-0">${m.lessons.length} lecciones</span>
            </li>`).join('')}
        </ol>
      </section>

      <p class="text-center text-[11px] text-muted px-4 pb-2">Cursos creados por <a href="https://dev101x.online/" rel="author noopener" target="_blank" class="font-semibold text-ink2 hover:text-accent">Yared Henriquez (Dev101x)</a> · <a href="https://github.com/DevCop95" rel="me noopener" target="_blank" class="font-semibold text-ink2 hover:text-accent">GitHub DevCop95</a></p>
    </div>

    <div id="login-modal" class="modal-backdrop hidden fixed inset-0 z-50 bg-ink/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="login-modal-title" class="relative w-full max-w-sm max-h-[85dvh] overflow-y-auto bg-surface rounded-2xl shadow-2xl border border-line modal-enter p-6 sm:p-7 flex flex-col gap-5">
        <button type="button" data-action="close-modal" data-target="login-modal" class="absolute top-3 right-3 w-8 h-8 rounded-lg text-muted hover:text-ink hover:bg-bg flex items-center justify-center" aria-label="Cerrar">
          <span class="material-symbols-outlined text-lg" aria-hidden="true">close</span>
        </button>
        <div class="flex flex-col items-center text-center gap-2 pt-1">
          <img src="assets/icon-192.png" alt="" class="w-12 h-12 rounded-xl pixelated" />
          <h2 id="login-modal-title" class="text-xl font-extrabold text-ink tracking-tight">Entra en Dev101x</h2>
          <p class="text-sm text-ink2">Usa tu cuenta de Google para guardar tu avance y seguir en cualquier dispositivo.</p>
        </div>
        <div id="login-actions" class="login-modal-actions flex flex-col items-center gap-2 min-h-[44px]"></div>
        <p id="login-status" role="alert" class="hidden text-xs text-rose-700 text-center bg-rose-50 border border-rose-200 rounded-lg px-3 py-2"></p>
        <p class="self-center inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50/80 border border-emerald-200 text-[11px] text-emerald-900">
          <span class="material-symbols-outlined text-[15px] text-accent" aria-hidden="true">verified_user</span>Solo usamos tu nombre, correo y foto de Google.
        </p>
      </div>
    </div>
  `;
  if (isCloudEnabled()) paintActions();
  else mountGoogleButton();
  initPhoneShowcase(container);
  container.querySelectorAll('[data-open-login]').forEach(b => b.addEventListener('click', openLoginModal));
  if (loginStatus) openLoginModal();
}

function openLoginModal() {
  const m = document.getElementById('login-modal');
  if (!m || !m.classList.contains('hidden')) return;
  openModal('login-modal');
  const main = m.querySelector('#login-actions button');
  if (main) main.focus();
}

// ---------------------------------------------------------------------------
// Móvil de muestra: capturas reales de la app. Se cambian tocando las pestañas o el móvil; pasan solas
// mientras se ve la sección, hasta que el usuario toca algo (y nunca con "reducir movimiento").
// ---------------------------------------------------------------------------
const PHONE_SCREENS = [
  { icon: 'terminal', title: 'La consola', text: 'Escribe comandos de Nmap y ve el resultado al momento.', img: 'assets/landing/movil-consola-cd45d631.webp', alt: 'Consola del laboratorio en el móvil con un escaneo de Nmap' },
  { icon: 'menu_book', title: 'Las lecciones', text: 'Cada lección con su objetivo, práctica y pregunta.', img: 'assets/landing/movil-leccion-fcfb8006.webp', alt: 'Ficha de una lección en el móvil' },
  { icon: 'school', title: 'Tu avance', text: 'Continúa donde lo dejaste, en cualquier dispositivo.', img: 'assets/landing/movil-cursos-8ee15f7d.webp', alt: 'Pantalla Mis cursos en el móvil con el avance del curso' }
];

function initPhoneShowcase(container) {
  const tabs = [...container.querySelectorAll('[data-phone-tab]')];
  const shots = [...container.querySelectorAll('[data-phone-shot]')];
  const phone = container.querySelector('[data-phone-next]');
  if (!tabs.length || !phone) return;
  let current = 0;
  let timer = null;
  const show = i => {
    current = (i + shots.length) % shots.length;
    shots.forEach((s, k) => s.classList.toggle('is-active', k === current));
    tabs.forEach((t, k) => t.setAttribute('aria-selected', String(k === current)));
  };
  const stop = () => { clearInterval(timer); timer = null; };
  tabs.forEach(t => t.addEventListener('click', () => { stop(); show(Number(t.dataset.phoneTab)); }));
  phone.addEventListener('click', () => { stop(); show(current + 1); });

  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || !('IntersectionObserver' in window)) return;
  let touched = false;
  [...tabs, phone].forEach(el => el.addEventListener('click', () => { touched = true; }));
  const io = new IntersectionObserver(([entry]) => {
    if (!phone.isConnected) { io.disconnect(); stop(); return; }
    if (entry.isIntersecting && !touched && !timer) {
      timer = setInterval(() => { if (!phone.isConnected) { stop(); io.disconnect(); return; } show(current + 1); }, 4500);
    } else if (!entry.isIntersecting) stop();
  }, { threshold: 0.5 });
  io.observe(phone);
}
