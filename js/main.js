/**
 * Dev101x — Punto de entrada: enrutado, cabecera/navegación y delegación de eventos.
 * No hay manejadores inline (onclick=…): todos los controles usan data-action.
 */
import { appState, isSessionValid } from './state.js?v=dev101x-v47';
import { resolveRoute } from './router.js?v=dev101x-v47';
import { isAdmin, logout, revalidateSession, takeOAuthRedirect, completeOAuthRedirect } from './auth.js?v=dev101x-v47';
import { showToast, closeModal, avatarFor } from './ui.js?v=dev101x-v47';
import { initSearch, openSearch, closeSearch } from './search.js?v=dev101x-v47';
import { renderLogin, setLoginStatus, loginWithGoogle, forgetAccount } from './views/login.js?v=dev101x-v47';
import { renderMisCursos, renderExplorar, openCourseDetail, openDbCourseDetail } from './views/courses.js?v=dev101x-v47';
import { renderAula, executeCommand, selectExplanation, switchNmapCategory, openLesson, openVideo, seekVideo, openResources, submitQuiz, onNoteInput, openCheatSheet, printCheatSheet, openHint } from './views/aula.js?v=dev101x-v47';
import { renderPerfil, openAccountDetails } from './views/perfil.js?v=dev101x-v47';
import { createHistory } from './lib/cmd-history.js?v=dev101x-v47';
import { renderCourseAula, runCourseCmd, runCourseCmdFromUi, openCourseLesson, openCourseVideo, seekCourseVideo, openCourseHint, openCourseCheatSheet, openCourseResources, selectCourseExplanation, resetCourseLab, submitCourseQuiz, setCourseTerminalMode, resetLinuxLab } from './views/course-aula.js?v=dev101x-v47';
import { COURSE } from './content.js?v=dev101x-v47';
import { renderAdmin, exportCsv, setAdminFilter, openUserDetails, setAccessLevel, setCourseOverride, setCourseFlag, resetUserProgress } from './views/admin.js?v=dev101x-v47';
import { startPresence } from './progress.js?v=dev101x-v47';

const $ = id => document.getElementById(id);

function updateChrome(route) {
  const isLogin = route === 'login';
  document.documentElement.classList.toggle('login-active', isLogin);
  document.body.classList.toggle('login-active', isLogin);
  document.body.classList.toggle('has-mobile-nav', !isLogin);
  ['main-header', 'app-footer', 'mobile-nav'].forEach(id => { const el = $(id); if (el) el.classList.toggle('hidden', isLogin); });
  const water = $('water-bg-wrapper');
  if (water) water.classList.toggle('hidden', !isLogin);

  document.querySelectorAll('[data-nav]').forEach(link => {
    const match = link.dataset.nav === route || (link.dataset.nav === 'mis-cursos' && route === 'explorar-cursos');
    link.classList.toggle('nav-active', match);
    if (match) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
  });

  const admin = isAdmin();
  document.querySelectorAll('[data-admin-only]').forEach(el => el.classList.toggle('hidden', !admin));

  const user = appState.session;
  if (user) {
    const avatar = avatarFor(user);
    ['header-user-avatar', 'dropdown-user-avatar'].forEach(id => { const img = $(id); if (img) img.src = avatar; });
    ['header-user-name', 'dropdown-user-name'].forEach(id => { const el = $(id); if (el) el.textContent = user.name; });
    const email = $('dropdown-user-email');
    if (email) email.textContent = user.email;
  }
}

function render() {
  const authenticated = isSessionValid();
  const { route, param, redirect, denied } = resolveRoute(window.location.hash, { authenticated, admin: isAdmin() });
  if (redirect) history.replaceState(null, '', redirect);
  if (denied) showToast('Acceso restringido: se requieren permisos de administrador', 'error');

  const view = $('app-view');
  if (!view) return;
  toggleProfile(false);
  closeSearch();
  closeModal('app-dialog');
  updateChrome(route);
  window.scrollTo(0, 0);

  if (route === 'login') {
    view.className = 'w-full flex-1 flex flex-col px-4 py-5 sm:py-8';
    renderLogin(view, onLoggedIn);
    return;
  }

  view.className = 'w-full pt-[76px] pb-6 sm:pt-20 sm:pb-12 max-w-[1280px] mx-auto px-gutter flex-1 flex flex-col';
  switch (route) {
    case 'aula-interactiva':
      // El curso de Nmap vive en el código; el resto (de pago) se carga desde Supabase.
      if (param === COURSE.id) renderAula(view, param);
      else renderCourseAula(view, param);
      break;
    case 'explorar-cursos': renderExplorar(view); break;
    case 'perfil': renderPerfil(view); break;
    case 'panel-admin': renderAdmin(view); break;
    default: renderMisCursos(view);
  }
  view.focus({ preventScroll: true });
}

function onLoggedIn() {
  startPresence();
  showToast(`Bienvenido, ${appState.session.name}`, 'success');
  window.location.hash = '#/mis-cursos';
  render();
}

function toggleProfile(force) {
  const dd = $('profile-dropdown');
  const btn = $('user-menu-btn');
  if (!dd) return;
  const open = typeof force === 'boolean' ? force : dd.classList.contains('hidden');
  dd.classList.toggle('hidden', !open);
  if (btn) btn.setAttribute('aria-expanded', String(open));
}

function copyText(text) {
  if (!text) return;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text)
      .then(() => showToast('Comando copiado al portapapeles', 'success'))
      .catch(() => showToast('No se pudo copiar el comando', 'error'));
  } else {
    showToast('Tu navegador no permite copiar automáticamente', 'info');
  }
}

async function doLogout() {
  await logout();
  showToast('Sesión cerrada correctamente', 'info');
  window.location.hash = '#/login';
  render();
}

function goToCommand(key) {
  const aula = '#/aula-interactiva/pentesting-101';
  appState.activeCommandKey = key;
  if (window.location.hash !== aula) window.location.hash = aula;
  else selectExplanation(key, false);
  setTimeout(() => {
    const card = $('command-explanation-card');
    if (card) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 50);
}

const ACTIONS = {
  'toggle-profile': () => toggleProfile(),
  'close-profile': () => toggleProfile(false),
  'open-search': () => { toggleProfile(false); openSearch({ admin: isAdmin() }); },
  'close-search': () => closeSearch(),
  'logout': () => { toggleProfile(false); doLogout(); },
  'open-course': el => openCourseDetail(el.dataset.id),
  'open-lesson': el => openLesson(el.dataset.id),
  'open-video': el => openVideo(Number(el.dataset.start) || 0),
  'video-seek': el => seekVideo(Number(el.dataset.start) || 0),
  'open-resources': () => openResources(),
  'open-cheatsheet': () => openCheatSheet(),
  'open-hint': el => openHint(el.dataset.step),
  'c-run': el => runCourseCmdFromUi(el),
  'c-lesson': el => openCourseLesson(el.dataset.id),
  'c-video': el => openCourseVideo(Number(el.dataset.start) || 0),
  'c-seek': el => seekCourseVideo(Number(el.dataset.start) || 0),
  'c-hint': el => openCourseHint(el.dataset.step),
  'c-cheat': () => openCourseCheatSheet(),
  'open-db-course': el => openDbCourseDetail(el.dataset.id),
  'c-resources': () => openCourseResources(),
  'c-expl': el => selectCourseExplanation(el.dataset.key),
  'c-reset': () => resetCourseLab(),
  'c-mode': el => setCourseTerminalMode(el.dataset.mode),
  'c-linux-reset': () => resetLinuxLab(),
  'print-cheatsheet': () => printCheatSheet(),
  'open-account': () => openAccountDetails(),
  'admin-user': el => openUserDetails(el.dataset.user),
  'admin-reset': el => resetUserProgress(el),
  'close-modal': el => closeModal(el.dataset.target),
  'toggle-panel': el => {
    const panel = $(el.dataset.target);
    if (!panel) return;
    const open = panel.classList.toggle('panel-open');
    el.setAttribute('aria-expanded', String(open));
    const chevron = el.querySelector('[data-chevron]');
    if (chevron) chevron.classList.toggle('rotate-180', open);
  },
  'select-cmd': el => selectExplanation(el.dataset.key, el.dataset.run === '1'),
  'run-cmd': el => {
    // Desde una ficha de lección: cerrar la ventana y llevar la vista a la terminal.
    if (el.closest('#app-dialog')) {
      closeModal('app-dialog');
      const screen = $('terminal-screen');
      if (screen) screen.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    executeCommand(el.dataset.cmd);
  },
  'copy-cmd': el => copyText(el.dataset.cmd),
  'nmap-cat': el => switchNmapCategory(el.dataset.idx),
  'export-csv': () => exportCsv(),
  'admin-filter': el => setAdminFilter(el.dataset.filter),
  'google-login': el => loginWithGoogle(el),
  'forget-account': () => forgetAccount()
};

document.addEventListener('click', e => {
  const el = e.target.closest('[data-action]');
  if (el && el.tagName !== 'FORM' && el.type !== 'checkbox' && ACTIONS[el.dataset.action]) {
    ACTIONS[el.dataset.action](el, e);
  }
  // Cerrar el menú de usuario y los modales al pulsar fuera
  const dd = $('profile-dropdown');
  if (dd && !dd.classList.contains('hidden') && !e.target.closest('#profile-dropdown, #user-menu-btn')) toggleProfile(false);
  if (e.target.classList && e.target.classList.contains('modal-backdrop')) closeModal(e.target.id);
});

document.addEventListener('change', e => {
  const el = e.target;
  const action = el.dataset && el.dataset.action;
  if (action === 'admin-level') setAccessLevel(el);
  else if (action === 'admin-override') setCourseOverride(el);
  else if (action === 'admin-course-flag') setCourseFlag(el);
});

document.addEventListener('submit', e => {
  const form = e.target;
  if (form.dataset.action === 'quiz') {
    e.preventDefault();
    submitQuiz(form);
    return;
  }
  if (form.dataset.action === 'c-quiz') {
    e.preventDefault();
    submitCourseQuiz(form);
    return;
  }
  if (form.dataset.action === 'c-terminal') {
    e.preventDefault();
    const input = $('c-input');
    if (input) {
      historyFor(input).push(input.value);
      runCourseCmd(input.value);
      input.value = '';
    }
    return;
  }
  if (form.dataset.action === 'terminal') {
    e.preventDefault();
    const input = $('terminal-input');
    if (input) {
      historyFor(input).push(input.value);
      executeCommand(input.value);
      input.value = '';
    }
  }
});

// Notas de lección: guardado automático al escribir.
document.addEventListener('input', e => {
  if (e.target.matches && e.target.matches('textarea[data-note]')) onNoteInput(e.target);
});

// Historial de comandos por terminal (↑ / ↓), en memoria durante la sesión.
const histories = {};
function historyFor(input) {
  if (!histories[input.id]) histories[input.id] = createHistory();
  return histories[input.id];
}

document.addEventListener('keydown', e => {
  const t = e.target;
  if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && t && (t.id === 'terminal-input' || t.id === 'c-input')) {
    const h = historyFor(t);
    const next = e.key === 'ArrowUp' ? h.up(t.value) : h.down();
    if (next !== null) {
      e.preventDefault();
      t.value = next;
      t.setSelectionRange(next.length, next.length);
    }
    return;
  }
  if (e.key === 'Escape') {
    toggleProfile(false);
    document.querySelectorAll('.modal-backdrop:not(.hidden)').forEach(m => closeModal(m.id));
  }
});

window.addEventListener('hashchange', render);

initSearch({ onSelectCommand: goToCommand, isAdmin });

// Vuelta de Google (?code=… o ?error=…): se muestra el login en modo "verificando" y se canjea el código.
const oauthRedirect = takeOAuthRedirect();
if (oauthRedirect) setLoginStatus(oauthRedirect.code ? { type: 'pending' } : null);
render();
if (oauthRedirect) {
  completeOAuthRedirect(oauthRedirect).then(result => {
    if (result.ok) {
      setLoginStatus(null);
      onLoggedIn();
    } else {
      setLoginStatus({ type: 'error', text: result.error });
    }
  });
}

// Revalida la sesión contra el servidor (modo nube) sin bloquear el primer render.
revalidateSession()
  .then(changed => { if (changed) render(); })
  .catch(err => console.warn('No se pudo revalidar la sesión:', err))
  .finally(startPresence);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js?v=dev101x-v47').catch(() => {}));
  // Cuando se activa una versión nueva del service worker, se recarga una vez para no mezclar
  // archivos de dos despliegues (solo si ya había uno antes: la primera visita no recarga).
  if (navigator.serviceWorker.controller) {
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloaded) return;
      reloaded = true;
      window.location.reload();
    });
  }
}
