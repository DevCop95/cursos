/**
 * Vista: portada pública (consola de muestra, catálogo, móvil) + login con Google.
 *  - Modo nube: botón propio → redirección OAuth de Supabase. Si este navegador recuerda la
 *    última cuenta, se ofrece "Continuar como …" con opción de usar otra o de olvidarla.
 *  - Modo local (sin Supabase): botón oficial de Google Identity Services.
 */
import { CONFIG, isCloudEnabled } from '../config.js?v=dev101x-v84';
import { prepareNonce, signInWithGoogleCredential, startGoogleLogin, getLastAccount, forgetLastAccount, preloadCloud } from '../auth.js?v=dev101x-v84';
import { esc } from '../lib/html.js?v=dev101x-v84';
import { avatarFor, showToast, openModal } from '../ui.js?v=dev101x-v84';
import { PUBLIC_COURSES } from '../lib/public-courses.js?v=dev101x-v84';
import { UPCOMING } from '../lib/upcoming.js?v=dev101x-v84';
import { courseIcon } from '../lib/ranks.js?v=dev101x-v84';
import { courseLogo } from '../lib/course-logos.js?v=dev101x-v84';
import { showLoader, hideLoader } from './loader.js?v=dev101x-v84';

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
    showLoader('Conectando con Google…');
    await startGoogleLogin(button.dataset.mode);
    // Si todo va bien el navegador ya está saliendo hacia Google.
  } catch (err) {
    hideLoader();
    console.error('No se pudo iniciar el login con Google:', err);
    box.removeAttribute('aria-busy');
    setLoginStatus({
      type: 'error',
      text: 'No se pudo conectar con Google. Revisa tu conexión e inténtalo de nuevo.'
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

// La librería de Google solo hace falta en este modo: se descarga aquí y no en cada visita (el modo nube
// entra por la redirección de Supabase).
function loadGoogleIdentity() {
  if (document.querySelector('script[data-gsi]')) return;
  const s = document.createElement('script');
  s.src = 'https://accounts.google.com/gsi/client';
  s.async = true;
  s.dataset.gsi = '1';
  document.head.appendChild(s);
}

async function mountGoogleButton() {
  const el = document.getElementById('login-actions');
  if (!el) return;
  el.innerHTML = `<div class="w-full h-12 flex items-center justify-center gap-3 rounded-xl bg-white border border-line text-sm text-ink2">${SPINNER}<span>Cargando Google…</span></div>`;
  loadGoogleIdentity();

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

      <section class="landing-card w-full rounded-3xl p-6 sm:p-10 grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] gap-8 md:gap-10 items-center modal-enter">
        <div class="flex flex-col gap-5 min-w-0">
          <div class="flex flex-col gap-3">
            <p class="text-[11px] font-mono font-bold text-accent uppercase tracking-wide">Cursos de ciberseguridad en español</p>
            <h1 class="text-[32px] sm:text-[44px] leading-[1.05] font-extrabold text-ink tracking-tight">Aprende escribiendo comandos</h1>
            <p class="text-[15px] text-ink2 leading-relaxed">Cada lección se practica en una consola dentro del navegador: Nmap, Linux, Git, Shodan y OSINT. Sin instalar nada, en el móvil o en el ordenador.</p>
          </div>
          <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
            <button type="button" data-open-login class="inline-flex items-center gap-2 h-11 px-6 rounded-full bg-accent hover:bg-accent2 text-white text-sm font-semibold transition-colors">
              Empezar gratis<span class="material-symbols-outlined text-[18px]" aria-hidden="true">arrow_forward</span>
            </button>
            <span class="text-xs text-muted">Con tu cuenta de Google</span>
          </div>
        </div>
        ${demoTermHtml()}
      </section>

      ${catalogHtml()}

      <section class="landing-card w-full rounded-3xl p-6 sm:p-10 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-8 md:gap-12 items-center">
        <div class="flex flex-col gap-5 min-w-0">
          <div class="flex flex-col gap-2">
            <h2 class="text-2xl sm:text-[28px] leading-tight font-extrabold text-ink tracking-tight">Igual en el móvil</h2>
            <p class="text-[15px] text-ink2 leading-relaxed">La consola, las lecciones y tu avance funcionan igual en el móvil y en el ordenador. Sigues donde lo dejaste.</p>
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
        </div>
        <button type="button" class="phone-frame justify-self-center" data-phone-next aria-label="Ver la siguiente pantalla">
          <span class="phone-screen">
            ${PHONE_SCREENS.map((s, i) => `<img src="${s.img}" alt="${esc(s.alt)}" width="488" height="1055" ${i === 0 ? '' : 'loading="lazy" '}decoding="async" class="phone-shot${i === 0 ? ' is-active' : ''}" data-phone-shot="${i}" />`).join('')}
          </span>
        </button>
      </section>

      <p class="text-center text-[11px] text-muted px-4 pb-2">Cursos creados por <a href="https://dev101x.online/" rel="author noopener" target="_blank" class="font-semibold text-ink2 hover:text-accent">Yared Henriquez (Dev101x)</a> · <a href="https://github.com/DevCop95" rel="me noopener" target="_blank" class="font-semibold text-ink2 hover:text-accent">GitHub DevCop95</a> · <a href="/privacidad/" class="font-semibold text-ink2 hover:text-accent">Privacidad</a></p>
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
  initDemoTerm(container);
  container.querySelectorAll('[data-open-login]').forEach(b => b.addEventListener('click', openLoginModal));
  if (loginStatus) openLoginModal();
}

function openLoginModal() {
  const m = document.getElementById('login-modal');
  if (!m || !m.classList.contains('hidden')) return;
  preloadCloud();
  openModal('login-modal');
  const main = m.querySelector('#login-actions button');
  if (main) main.focus();
}

// ---------------------------------------------------------------------------
// Catálogo: todos los cursos (datos públicos generados por npm run pages) y el próximo lanzamiento.
// Cada ficha lleva a la página pública del curso. Un color sobrio por curso, solo en el borde superior.
// ---------------------------------------------------------------------------
const COURSE_TINT = {
  'pentesting-101': '#005c38',
  'linux-101': '#8a5a00',
  'git-github-101': '#a8432a',
  'shodan-101': '#8c2f39',
  'osint-101': '#2b5278'
};

function courseLogoHtml(c, size = 26) {
  const logo = courseLogo(c.id) || c.logo;
  return logo
    ? `<img src="${esc(logo)}" alt="" width="${size}" height="${size}" decoding="async" class="object-contain" style="width:${size}px;height:${size}px" />`
    : `<span class="material-symbols-outlined text-emerald-400 text-[22px]" aria-hidden="true">${esc(courseIcon(c.id))}</span>`;
}

function catalogHtml() {
  if (!PUBLIC_COURSES.length) return '';
  const card = c => `
    <a href="/${esc(c.slug)}/" class="catalog-card group" style="--tint:${COURSE_TINT[c.id] || 'var(--accent)'}">
      <span class="flex items-center gap-3 min-w-0">
        <span class="w-10 h-10 rounded-xl bg-term flex items-center justify-center shrink-0">${courseLogoHtml(c)}</span>
        <span class="flex flex-col min-w-0">
          <span class="text-[15px] font-bold text-ink leading-snug group-hover:text-accent">${esc(c.short)}</span>
          <span class="text-[11px] font-mono font-bold ${c.free ? 'text-accent' : 'text-amber-700'}">${c.free ? 'GRATIS' : 'PREMIUM'}</span>
        </span>
      </span>
      ${c.pitch ? `<span class="text-sm text-ink2 leading-relaxed">${esc(c.pitch)}</span>` : ''}
      <span class="mt-auto flex items-center justify-between gap-3 pt-1">
        <span class="text-[11px] font-mono text-muted truncate">${c.lessons} lecciones · ${c.labs} labs</span>
        <span class="material-symbols-outlined text-[18px] text-muted group-hover:text-accent transition-colors" aria-hidden="true">arrow_forward</span>
      </span>
    </a>`;
  const soon = UPCOMING ? `
    <div class="flex items-center gap-3 p-4 rounded-2xl border border-dashed border-line min-w-0" aria-label="Próximo curso: ${esc(UPCOMING.title)}">
      <span class="w-10 h-10 rounded-xl bg-white border border-line flex items-center justify-center shrink-0"><img src="${esc(UPCOMING.icon)}" alt="" width="24" height="24" loading="lazy" class="w-6 h-6 object-contain" /></span>
      <span class="flex flex-col min-w-0">
        <span class="text-sm font-semibold text-ink2 leading-snug line-clamp-2">${esc(UPCOMING.short || UPCOMING.title)}</span>
        <span class="text-[11px] font-mono text-muted truncate">PRÓXIMAMENTE</span>
      </span>
    </div>` : '';
  const group = (title, note, list, cols) => list.length ? `
        <div class="flex flex-col gap-3">
          <div class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h3 class="text-[11px] font-mono font-bold text-muted uppercase tracking-wide">${title}</h3>
            ${note ? `<span class="text-[11px] text-muted">${note}</span>` : ''}
          </div>
          <div class="grid grid-cols-1 ${cols} gap-3">${list.map(card).join('')}</div>
        </div>` : '';
  return `
      <section class="landing-card w-full rounded-3xl px-6 sm:px-10 py-6 sm:py-8 flex flex-col gap-6">
        <h2 class="text-2xl sm:text-[28px] leading-tight font-extrabold text-ink tracking-tight">Cursos</h2>
        ${group('Gratis', '', PUBLIC_COURSES.filter(c => c.free), 'sm:grid-cols-2')}
        ${group('Premium', 'Se solicitan desde tu cuenta', PUBLIC_COURSES.filter(c => !c.free), 'sm:grid-cols-3')}
        ${soon}
      </section>`;
}

// ---------------------------------------------------------------------------
// Consola de muestra: escribe sola un comando de cada curso. Se para fuera de la pantalla o con la pestaña
// oculta; con "reducir movimiento" muestra la escena completa y no avanza. Los botones eligen el curso.
// Salidas inventadas para la portada: nada de las respuestas de los retos.
// ---------------------------------------------------------------------------
const DEMO_SCENES = [
  { id: 'pentesting-101', pick: 'Nmap', title: 'Pentesting 101 · Nmap', prompt: 'PS>', steps: [
    { cmd: 'nmap -sV 10.128.44.12' },
    { out: 'PORT     STATE SERVICE       VERSION', tone: 'muted' },
    { out: '80/tcp   open  http          nginx 1.24' },
    { out: '445/tcp  open  microsoft-ds  Win 2022' },
    { out: '3389/tcp open  ms-wbt-server RDP' },
    { out: 'Nmap done: 1 host up', tone: 'muted' },
    { out: '✓ Lección completada', tone: 'ok' }
  ] },
  { id: 'linux-101', pick: 'Linux', title: 'Linux para ciberseguridad', prompt: '$', steps: [
    { cmd: 'ls -l notas.txt' },
    { out: '-rw-r--r-- 1 ana ana 312 notas.txt' },
    { cmd: 'chmod 600 notas.txt' },
    { cmd: 'ls -l notas.txt' },
    { out: '-rw------- 1 ana ana 312 notas.txt' },
    { out: '✓ Solo ana puede leerlo', tone: 'ok' }
  ] },
  { id: 'git-github-101', pick: 'Git', title: 'Git y GitHub', prompt: '$', steps: [
    { cmd: 'git switch -c mi-rama' },
    { out: "Switched to a new branch 'mi-rama'", tone: 'muted' },
    { cmd: 'git commit -m "Añade el README"' },
    { out: '[mi-rama 4e1b2c7] Añade el README' },
    { out: ' 1 file changed, 12 insertions(+)', tone: 'muted' },
    { out: '✓ Primer commit en tu rama', tone: 'ok' }
  ] },
  { id: 'shodan-101', pick: 'Shodan', title: 'Shodan', prompt: '$', steps: [
    { cmd: 'shodan host 198.51.100.23' },
    { out: '198.51.100.23', tone: 'info' },
    { out: 'Ports: 22, 80, 443', tone: 'muted' },
    { out: '22/tcp   OpenSSH 8.9' },
    { out: '80/tcp   nginx 1.22.1' },
    { out: '✓ Servicios expuestos encontrados', tone: 'ok' }
  ] },
  { id: 'osint-101', pick: 'OSINT', title: 'OSINT defensivo', prompt: '$', steps: [
    { cmd: 'exiftool -Model -GPSPosition foto.jpg' },
    { out: 'Camera Model Name : Galaxy A54' },
    { out: 'GPS Position      : 40.4172, -3.7027' },
    { cmd: 'exiftool -all= foto.jpg' },
    { out: '    1 image files updated', tone: 'muted' },
    { out: '✓ Metadatos borrados', tone: 'ok' }
  ] }
];

function demoTermHtml() {
  const byId = Object.fromEntries(PUBLIC_COURSES.map(c => [c.id, c]));
  return `
        <div class="flex flex-col gap-3 min-w-0">
          <div class="demo-term" aria-hidden="true">
            <div class="demo-term-bar"><span data-demo-title>${esc(DEMO_SCENES[0].title)}</span><span class="demo-term-tag">laboratorio</span></div>
            <pre class="demo-term-body" data-demo-body></pre>
          </div>
          <div class="flex flex-wrap gap-1.5" role="group" aria-label="Ver un comando de cada curso">
            ${DEMO_SCENES.map((d, i) => `
              <button type="button" data-demo-scene="${i}" aria-pressed="${i === 0}" class="demo-pick" aria-label="${esc(d.title)}">
                <span class="w-6 h-6 rounded-md bg-term flex items-center justify-center shrink-0">${byId[d.id] ? courseLogoHtml(byId[d.id], 16) : ''}</span>
                <span class="hidden sm:inline">${esc(d.pick)}</span>
              </button>`).join('')}
          </div>
        </div>`;
}

function initDemoTerm(container) {
  const body = container.querySelector('[data-demo-body]');
  const title = container.querySelector('[data-demo-title]');
  const picks = [...container.querySelectorAll('[data-demo-scene]')];
  if (!body) return;
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let run = 0; // cada escena nueva invalida la anterior
  let visible = true;
  const wait = ms => new Promise(r => setTimeout(r, ms));
  // Espera mientras la consola no se ve; false si ya hay otra escena o la vista se fue.
  const ready = async token => {
    while (token === run && body.isConnected && (!visible || document.hidden)) await wait(400);
    return token === run && body.isConnected;
  };
  const line = (cls, text) => {
    const el = document.createElement('div');
    if (cls) el.className = cls;
    el.textContent = text;
    body.appendChild(el);
    return el;
  };
  const promptLine = scene => {
    const el = line('', '');
    const p = document.createElement('span');
    p.className = 'demo-prompt';
    p.textContent = scene.prompt + ' ';
    const t = document.createElement('span');
    el.append(p, t);
    return t;
  };
  async function play(i) {
    const token = ++run;
    const scene = DEMO_SCENES[i];
    picks.forEach((b, k) => b.setAttribute('aria-pressed', String(k === i)));
    title.textContent = scene.title;
    body.replaceChildren();
    if (reduce) {
      for (const s of scene.steps) {
        if (s.cmd) promptLine(scene).textContent = s.cmd;
        else line(`demo-${s.tone || 'out'}`, s.out);
      }
      return;
    }
    for (const s of scene.steps) {
      if (!(await ready(token))) return;
      if (s.cmd) {
        const t = promptLine(scene);
        t.classList.add('demo-typing');
        for (const ch of s.cmd) {
          if (!(await ready(token))) return;
          t.textContent += ch;
          await wait(30 + Math.random() * 40);
        }
        t.classList.remove('demo-typing');
        await wait(350);
      } else {
        line(`demo-${s.tone || 'out'}`, s.out);
        await wait(s.tone === 'ok' ? 500 : 110);
      }
    }
    await wait(2800);
    if (await ready(token)) play((i + 1) % DEMO_SCENES.length);
  }
  picks.forEach(b => b.addEventListener('click', () => play(Number(b.dataset.demoScene))));
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(([e]) => {
      if (!body.isConnected) { io.disconnect(); return; }
      visible = e.isIntersecting;
    });
    io.observe(body);
  }
  play(0);
}

// ---------------------------------------------------------------------------
// Móvil de muestra: capturas reales de la app. Se cambian tocando las pestañas o el móvil; pasan solas
// mientras se ve la sección, hasta que el usuario toca algo (y nunca con "reducir movimiento").
// ---------------------------------------------------------------------------
const PHONE_SCREENS = [
  { icon: 'terminal', title: 'La consola', text: 'Escribe comandos y ve el resultado al momento.', img: 'assets/landing/movil-consola-cd45d631.webp', alt: 'Consola del laboratorio en el móvil con un escaneo de Nmap' },
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
