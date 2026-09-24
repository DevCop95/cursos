/**
 * Vista: página pública del curso + login con Google.
 *  - Modo nube: botón propio → redirección OAuth de Supabase. Si este navegador recuerda la
 *    última cuenta, se ofrece "Continuar como …" con opción de usar otra o de olvidarla.
 *  - Modo local (sin Supabase): botón oficial de Google Identity Services.
 */
import { CONFIG, isCloudEnabled } from '../config.js';
import { COURSE, COURSE_OBJECTIVES, COURSE_VIDEO, COURSE_INFO, LAB_STEPS } from '../content.js';
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
// Página pública (antes del login): qué se aprende, temario, requisitos y acceso.
// ---------------------------------------------------------------------------
function section(id, kicker, title, body) {
  return `
    <section id="${id}" class="landing-card w-full rounded-3xl p-6 sm:p-8 flex flex-col gap-5 scroll-mt-6">
      <div>
        <p class="text-[11px] font-mono font-bold text-accent">${kicker}</p>
        <h2 class="text-xl sm:text-2xl font-extrabold text-ink tracking-tight">${title}</h2>
      </div>
      ${body}
    </section>`;
}

export function renderLogin(container, onSuccess) {
  onLoginSuccess = onSuccess;
  const lessons = COURSE.syllabus.reduce((n, m) => n + m.lessons.length, 0);
  const meta = [
    ['schedule', COURSE.duration],
    ['menu_book', `${lessons} lecciones`],
    ['science', `${LAB_STEPS.length} laboratorios`],
    ['smart_display', 'Video en español']
  ];
  const steps = [
    ['auto_stories', 'Aprende', 'Cada lección tiene su objetivo, una explicación breve y el tramo del video que la cubre.'],
    ['terminal', 'Practica', 'Una consola de Windows simulada en el navegador y un objetivo de laboratorio para escanear sin riesgo.'],
    ['quiz', 'Demuestra', 'Una pregunta por lección y un reto final sobre el objetivo. El progreso se guarda en tu cuenta.']
  ];

  container.innerHTML = `
    <div class="relative z-10 w-full max-w-5xl mx-auto flex flex-col gap-5 sm:gap-6">
      <header class="flex items-center justify-between gap-3 px-1">
        <div class="flex items-center gap-2.5">
          <img src="assets/icon-192.png" alt="" class="w-9 h-9 rounded-lg pixelated" />
          <span class="font-extrabold text-xl tracking-tight text-ink">Dev<em class="not-italic text-accent">101x</em></span>
        </div>
        <button type="button" data-action="scroll-to" data-target="acceso" class="h-9 px-3.5 rounded-xl bg-white/90 border border-line hover:border-accent/60 text-xs font-semibold text-ink">Entrar</button>
      </header>

      <section class="landing-card w-full rounded-3xl p-6 sm:p-9 grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-7 lg:gap-10 items-center modal-enter">
        <div class="flex flex-col gap-4 min-w-0">
          <span class="self-start px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-accent font-mono text-[10px] font-bold">CURSO PRÁCTICO · ${esc(COURSE.categoryLabel)}</span>
          <h1 class="text-[30px] sm:text-[40px] leading-[1.08] font-extrabold text-ink tracking-tight">Aprende pentesting desde Windows, practicando.</h1>
          <p class="text-[15px] text-ink2 leading-relaxed">${esc(COURSE.description)}</p>
          <p class="text-[13px] text-muted flex items-start gap-2"><span class="material-symbols-outlined text-[18px] text-accent" aria-hidden="true">person_check</span><span>${esc(COURSE_INFO.audience)}</span></p>
          <ul class="flex flex-wrap gap-2 font-mono text-[11px] text-ink2">
            ${meta.map(([icon, label]) => `<li class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-line"><span class="material-symbols-outlined text-[15px] text-accent" aria-hidden="true">${icon}</span>${esc(label)}</li>`).join('')}
          </ul>
          <div id="acceso" class="flex flex-col gap-3 pt-1 max-w-[400px] scroll-mt-6">
            <div id="login-actions" class="flex flex-col gap-3 min-h-[48px]"></div>
            <p id="login-status" role="alert" class="hidden text-xs text-rose-700 text-center bg-rose-50 border border-rose-200 rounded-lg px-3 py-2"></p>
            <p class="flex items-start gap-2 text-[11px] leading-relaxed text-muted">
              <span class="material-symbols-outlined text-[15px] text-accent mt-px" aria-hidden="true">lock</span>
              <span>Acceso con tu cuenta de Google. Solo usamos tu nombre, correo y foto de perfil.</span>
            </p>
          </div>
        </div>
        <button type="button" data-action="open-video" data-start="0" class="group relative w-full aspect-video rounded-2xl overflow-hidden bg-term border border-term-line shadow-xl text-left">
          <img src="https://i.ytimg.com/vi/${COURSE_VIDEO.id}/hqdefault.jpg" alt="" class="absolute inset-0 w-full h-full object-cover" loading="lazy" />
          <span class="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent"></span>
          <span class="absolute inset-0 flex items-center justify-center">
            <span class="w-14 h-14 rounded-full bg-white/95 flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform"><span class="material-symbols-outlined text-accent text-4xl" aria-hidden="true">play_arrow</span></span>
          </span>
          <span class="absolute left-4 right-4 bottom-3 text-white">
            <span class="block text-[10px] font-mono font-bold text-emerald-300">VISTA PREVIA · ${esc(COURSE_VIDEO.duration)}</span>
            <span class="block text-sm font-bold leading-snug">${esc(COURSE_VIDEO.title)}</span>
          </span>
        </button>
      </section>

      ${section('como-funciona', 'CÓMO FUNCIONA', 'Aprende, practica y demuéstralo', `
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          ${steps.map(([icon, title, text], i) => `
            <div class="p-4 rounded-2xl bg-white border border-line flex flex-col gap-2">
              <span class="w-9 h-9 rounded-xl bg-accent text-white flex items-center justify-center"><span class="material-symbols-outlined text-[20px]" aria-hidden="true">${icon}</span></span>
              <p class="text-sm font-bold text-ink">${i + 1}. ${title}</p>
              <p class="text-[13px] text-ink2 leading-relaxed">${text}</p>
            </div>`).join('')}
        </div>`)}

      ${section('aprenderas', 'QUÉ APRENDERÁS', 'Al terminar sabrás…', `
        <ul class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          ${COURSE_OBJECTIVES.map(o => `<li class="flex gap-2.5 p-3.5 rounded-2xl bg-white border border-line text-[13px] text-ink2"><span class="material-symbols-outlined text-[18px] text-accent shrink-0" aria-hidden="true">check_circle</span><span>${esc(o)}</span></li>`).join('')}
        </ul>`)}

      ${section('temario', 'TEMARIO', `${COURSE.syllabus.length} módulos · ${lessons} lecciones`, `
        <div class="flex flex-col gap-2">
          ${COURSE.syllabus.map((m, i) => `
            <details class="group rounded-2xl bg-white border border-line" ${i === 0 ? 'open' : ''}>
              <summary class="list-none cursor-pointer flex items-center justify-between gap-3 p-4 select-none">
                <span class="flex items-center gap-2.5 min-w-0">
                  <span class="w-7 h-7 rounded-lg bg-accent text-white text-xs font-bold flex items-center justify-center shrink-0">${i + 1}</span>
                  <span class="text-sm font-bold text-ink">${esc(m.module.replace(/^Módulo \d+:\s*/, ''))}</span>
                </span>
                <span class="flex items-center gap-2 shrink-0 text-[11px] font-mono text-muted">${m.lessons.length} lecciones<span class="material-symbols-outlined text-[18px] transition-transform group-open:rotate-180" aria-hidden="true">expand_more</span></span>
              </summary>
              <ul class="px-4 pb-4 flex flex-col gap-1.5">
                ${m.lessons.map(l => `<li class="flex items-center justify-between gap-3 text-[13px] text-ink2"><span class="flex items-center gap-2 min-w-0"><span class="material-symbols-outlined text-[16px] text-[#b6b2a9]" aria-hidden="true">${l.afterAll ? 'flag' : 'play_circle'}</span><span class="truncate">${esc(l.title)}</span></span><span class="font-mono text-[11px] text-muted shrink-0">${esc(l.time)}</span></li>`).join('')}
              </ul>
            </details>`).join('')}
        </div>`)}

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
        ${section('requisitos', 'ANTES DE EMPEZAR', 'Requisitos', `
          <ul class="flex flex-col gap-2.5">
            ${COURSE_INFO.requirements.map(r => `<li class="flex gap-2.5 text-[13px] text-ink2"><span class="material-symbols-outlined text-[18px] text-accent shrink-0" aria-hidden="true">task_alt</span><span>${esc(r)}</span></li>`).join('')}
          </ul>
          <p class="flex items-start gap-2 p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-[12px] text-amber-950 leading-relaxed">
            <span class="material-symbols-outlined text-[18px] text-amber-600 shrink-0" aria-hidden="true">gavel</span>
            <span><strong>Uso responsable.</strong> Todo se practica contra un objetivo simulado. Fuera del laboratorio, estas técnicas solo se aplican sobre sistemas propios o con autorización expresa.</span>
          </p>`)}
        ${section('instructor', 'QUIÉN LO ENSEÑA', 'Instructor', `
          <div class="flex items-center gap-4">
            <img src="assets/icon-192.png" alt="" class="w-14 h-14 rounded-2xl bg-white border border-line p-2 pixelated" />
            <div>
              <p class="text-base font-bold text-ink">${esc(COURSE_INFO.instructor.name)}</p>
              <p class="text-[13px] text-ink2 leading-relaxed">${esc(COURSE_INFO.instructor.bio)}</p>
            </div>
          </div>
          <p class="text-[12px] text-muted">Video de apoyo: <strong class="text-ink2">${esc(COURSE_VIDEO.author)}</strong> (YouTube).</p>`)}
      </div>

      ${section('faq', 'PREGUNTAS FRECUENTES', 'Dudas habituales', `
        <div class="flex flex-col gap-2">
          ${COURSE_INFO.faq.map(([q, a]) => `
            <details class="group rounded-2xl bg-white border border-line">
              <summary class="list-none cursor-pointer flex items-center justify-between gap-3 p-4 text-sm font-semibold text-ink select-none">${esc(q)}<span class="material-symbols-outlined text-[18px] text-muted transition-transform group-open:rotate-180" aria-hidden="true">expand_more</span></summary>
              <p class="px-4 pb-4 text-[13px] text-ink2 leading-relaxed">${esc(a)}</p>
            </details>`).join('')}
        </div>`)}

      <section class="landing-card w-full rounded-3xl p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 class="text-xl font-extrabold text-ink tracking-tight">¿Empezamos?</h2>
          <p class="text-[13px] text-ink2">Entra con Google y empieza por la lección 1.1.</p>
        </div>
        <button type="button" data-action="scroll-to" data-target="acceso" class="h-11 px-5 rounded-xl bg-accent hover:bg-accent2 text-white text-sm font-semibold inline-flex items-center gap-2">
          <span class="material-symbols-outlined text-[18px]" aria-hidden="true">login</span>Entrar con Google
        </button>
      </section>

      <p class="w-full text-center text-[11px] text-muted pb-2">&copy; ${new Date().getFullYear()} Dev<em class="not-italic text-accent font-bold">101x</em> Academy</p>
    </div>
  `;
  if (isCloudEnabled()) paintActions();
  else mountGoogleButton();
}
