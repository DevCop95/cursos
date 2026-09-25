/**
 * Dev101x — Punto de entrada: enrutado, cabecera/navegación y delegación de eventos.
 * No hay manejadores inline (onclick=…): todos los controles usan data-action.
 */
import { appState, isSessionValid } from './state.js?v=dev101x-v67';
import { resolveRoute } from './router.js?v=dev101x-v67';
import { isAdmin, logout, revalidateSession, takeOAuthRedirect, completeOAuthRedirect, takeNewCourseAccess, checkNewCourseAccess } from './auth.js?v=dev101x-v67';
import { showToast, closeModal, avatarFor } from './ui.js?v=dev101x-v67';
import { initSearch, openSearch, closeSearch } from './search.js?v=dev101x-v67';
import { renderLogin, setLoginStatus, loginWithGoogle, forgetAccount } from './views/login.js?v=dev101x-v67';
import { renderMisCursos, renderExplorar, openCourseDetail, openDbCourseDetail, requestAccess } from './views/courses.js?v=dev101x-v67';
import { renderPerfil, openAccountDetails, openNameDialog, submitName } from './views/perfil.js?v=dev101x-v67';
import { createHistory } from './lib/cmd-history.js?v=dev101x-v67';
import { COURSE } from './content.js?v=dev101x-v67';
import { fetchCourses } from './cloud.js?v=dev101x-v67';
import { rememberLastCourse } from './views/resume.js?v=dev101x-v67';
import { openMessages, submitMessage, submitAdminReply, updateCounter, refreshUnreadMessages } from './views/messages.js?v=dev101x-v67';
import { startPresence } from './progress.js?v=dev101x-v67';
import { scheduleRankCheck } from './views/rank-notice.js?v=dev101x-v67';

const $ = id => document.getElementById(id);

// Las vistas pesadas (aulas y panel de admin) se descargan al abrirlas, no al entrar: el login y "Mis cursos"
// cargan antes. Con la sesión iniciada se precargan en segundo plano para que el aula abra al instante.
function lazy(load) {
  let p = null;
  return () => (p = p || load().catch(err => { p = null; throw err; }));
}
const aulaView = lazy(() => import('./views/aula.js?v=dev101x-v67'));
const courseView = lazy(() => import('./views/course-aula.js?v=dev101x-v67'));
const adminView = lazy(() => import('./views/admin.js?v=dev101x-v67'));
// Ejecuta fn(módulo) cuando está listo (dentro del aula ya lo está).
const withView = (view, fn) => view().then(fn, () => showToast('No se pudo cargar esta sección. Revisa tu conexión y recarga.', 'error'));
function prefetchViews() {
  if (!isSessionValid()) return;
  const go = () => { courseView().catch(() => {}); aulaView().catch(() => {}); if (isAdmin()) adminView().catch(() => {}); };
  if ('requestIdleCallback' in window) requestIdleCallback(go, { timeout: 4000 }); else setTimeout(go, 1500);
}

// Anti-clickjacking: la app no se muestra dentro de un iframe (GitHub Pages no deja enviar X-Frame-Options
// y la meta CSP no admite frame-ancestors). Si alguien la incrusta, se intenta salir del marco y, si no, se oculta.
if (window.top !== window.self) {
  try { window.top.location = window.self.location.href; } catch (e) { document.documentElement.style.display = 'none'; }
  throw new Error('Dev101x no se puede mostrar dentro de otro sitio.');
}

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
  document.querySelectorAll('[data-student-only]').forEach(el => el.classList.toggle('hidden', admin || !appState.session));

  const user = appState.session;
  if (user) {
    const avatar = avatarFor(user);
    ['header-user-avatar', 'dropdown-user-avatar'].forEach(id => { const img = $(id); if (img) img.src = avatar; });
    ['header-user-name', 'dropdown-user-name'].forEach(id => { const el = $(id); if (el) el.textContent = user.name; });
    const email = $('dropdown-user-email');
    if (email) email.textContent = user.email;
  }
}

let renderSeq = 0;
function render() {
  const seq = ++renderSeq;
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
  // Vista que se descarga al abrirla: se pinta solo si el usuario no ha cambiado de ruta mientras tanto.
  const paintLazy = (mod, fn) => {
    view.innerHTML = '';
    withView(mod, m => { if (seq !== renderSeq) return; fn(m); view.focus({ preventScroll: true }); });
  };
  switch (route) {
    case 'aula-interactiva':
      // El curso de Nmap vive en el código; el resto (de pago) se carga desde Supabase.
      if (appState.enabledCourses.includes(param)) rememberLastCourse(param);
      if (param === COURSE.id) paintLazy(aulaView, m => m.renderAula(view, param));
      else paintLazy(courseView, m => m.renderCourseAula(view, param));
      return;
    case 'panel-admin': paintLazy(adminView, m => m.renderAdmin(view)); return;
    case 'explorar-cursos': renderExplorar(view); break;
    case 'perfil': renderPerfil(view); break;
    default: renderMisCursos(view);
  }
  view.focus({ preventScroll: true });
  prefetchViews();
}

// Aviso de cursos nuevos (p. ej. el admin concedió una solicitud). Se comprueba al abrir la app y al volver a
// la pestaña (como mucho una vez por minuto); las vistas con la lista de cursos se repintan.
let lastAccessCheck = Date.now();
async function announceNewAccess(ids) {
  if (!ids || !ids.length) return;
  const courses = await fetchCourses().catch(() => []);
  const titles = ids.map(id => (courses.find(c => c.id === id) || { title: id }).title);
  showToast(`Ya tienes acceso a ${titles.map(t => `«${t}»`).join(' y ')}`, 'success');
  const { route } = resolveRoute(window.location.hash, { authenticated: isSessionValid(), admin: isAdmin() });
  if (['mis-cursos', 'explorar-cursos', 'perfil'].includes(route)) render();
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible' || !isSessionValid() || Date.now() - lastAccessCheck < 60000) return;
  lastAccessCheck = Date.now();
  checkNewCourseAccess().then(announceNewAccess).catch(() => {});
  refreshUnreadMessages();
  scheduleRankCheck(500);
});

function onLoggedIn() {
  takeNewCourseAccess(); // anota los cursos actuales (sin avisar de los que ya tenía)
  refreshUnreadMessages({ notify: true });
  startPresence();
  scheduleRankCheck(2500); // la primera vez solo anota el rango actual
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
  else withView(aulaView, m => m.selectExplanation(key, false));
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
  'request-access': el => requestAccess(el),
  'open-lesson': el => withView(aulaView, m => m.openLesson(el.dataset.id)),
  'open-video': el => withView(aulaView, m => m.openVideo(Number(el.dataset.start) || 0)),
  'video-seek': el => withView(aulaView, m => m.seekVideo(Number(el.dataset.start) || 0)),
  'open-resources': () => withView(aulaView, m => m.openResources()),
  'open-cheatsheet': () => withView(aulaView, m => m.openCheatSheet()),
  'open-hint': el => withView(aulaView, m => m.openHint(el.dataset.step)),
  'c-run': el => withView(courseView, m => m.runCourseCmdFromUi(el)),
  'c-lesson': el => withView(courseView, m => m.openCourseLesson(el.dataset.id)),
  'c-video': el => withView(courseView, m => m.openCourseVideo(Number(el.dataset.start) || 0)),
  'c-seek': el => withView(courseView, m => m.seekCourseVideo(Number(el.dataset.start) || 0)),
  'c-hint': el => withView(courseView, m => m.openCourseHint(el.dataset.step)),
  'c-cheat': () => withView(courseView, m => m.openCourseCheatSheet()),
  'open-db-course': el => openDbCourseDetail(el.dataset.id),
  'c-resources': () => withView(courseView, m => m.openCourseResources()),
  'c-expl': el => withView(courseView, m => m.selectCourseExplanation(el.dataset.key)),
  'c-reset': () => withView(courseView, m => m.resetCourseLab()),
  'c-mode': el => withView(courseView, m => m.setCourseTerminalMode(el.dataset.mode)),
  'c-linux-reset': () => withView(courseView, m => m.resetLinuxLab()),
  'print-cheatsheet': () => withView(aulaView, m => m.printCheatSheet()),
  'open-account': () => openAccountDetails(),
  'edit-name': () => openNameDialog(),
  'admin-user': el => withView(adminView, m => m.openUserDetails(el.dataset.user)),
  'admin-thread': el => withView(adminView, m => m.openThread(el.dataset.user)),
  'admin-revoke': el => withView(adminView, m => m.openRevokeDialog(el)),
  'open-messages': () => { toggleProfile(false); openMessages(); },
  'admin-grant-request': el => withView(adminView, m => m.answerAccessRequest(el, true)),
  'admin-reject-request': el => withView(adminView, m => m.answerAccessRequest(el, false)),
  'admin-reset': el => withView(adminView, m => m.resetUserProgress(el)),
  'close-modal': el => closeModal(el.dataset.target),
  'toggle-panel': el => {
    const panel = $(el.dataset.target);
    if (!panel) return;
    const open = panel.classList.toggle('panel-open');
    el.setAttribute('aria-expanded', String(open));
    const chevron = el.querySelector('[data-chevron]');
    if (chevron) chevron.classList.toggle('rotate-180', open);
  },
  'select-cmd': el => withView(aulaView, m => m.selectExplanation(el.dataset.key, el.dataset.run === '1')),
  'run-cmd': el => {
    // Desde una ficha de lección: cerrar la ventana y llevar la vista a la terminal.
    if (el.closest('#app-dialog')) {
      closeModal('app-dialog');
      const screen = $('terminal-screen');
      if (screen) screen.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    withView(aulaView, m => m.executeCommand(el.dataset.cmd));
  },
  'copy-cmd': el => copyText(el.dataset.cmd),
  'nmap-cat': el => withView(aulaView, m => m.switchNmapCategory(el.dataset.idx)),
  'export-csv': () => withView(adminView, m => m.exportCsv()),
  'admin-filter': el => withView(adminView, m => m.setAdminFilter(el.dataset.filter)),
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
  if (action === 'admin-level') withView(adminView, m => m.setAccessLevel(el));
  else if (action === 'admin-override') withView(adminView, m => m.setCourseOverride(el));
  else if (action === 'admin-course-flag') withView(adminView, m => m.setCourseFlag(el));
});

document.addEventListener('submit', e => {
  const form = e.target;
  if (form.dataset.action === 'set-name') {
    e.preventDefault();
    submitName(form, e.submitter);
    return;
  }
  if (form.dataset.action === 'quiz') {
    e.preventDefault();
    withView(aulaView, m => m.submitQuiz(form));
    return;
  }
  const messageForms = { 'send-message': submitMessage, 'admin-reply': submitAdminReply, 'admin-revoke-confirm': f => withView(adminView, m => m.confirmRevoke(f)) };
  if (messageForms[form.dataset.action]) {
    e.preventDefault();
    messageForms[form.dataset.action](form);
    return;
  }
  if (form.dataset.action === 'c-quiz') {
    e.preventDefault();
    withView(courseView, m => m.submitCourseQuiz(form));
    return;
  }
  if (form.dataset.action === 'c-terminal') {
    e.preventDefault();
    const input = $('c-input');
    if (input) {
      historyFor(input).push(input.value);
      const cmd = input.value;
      withView(courseView, m => m.runCourseCmd(cmd));
      input.value = '';
    }
    return;
  }
  if (form.dataset.action === 'terminal') {
    e.preventDefault();
    const input = $('terminal-input');
    if (input) {
      historyFor(input).push(input.value);
      const cmd = input.value;
      withView(aulaView, m => m.executeCommand(cmd));
      input.value = '';
    }
  }
});

// Notas de lección: guardado automático al escribir.
document.addEventListener('input', e => {
  if (e.target.matches && e.target.matches('textarea[data-note]')) withView(aulaView, m => m.onNoteInput(e.target));
  if (e.target.matches && e.target.matches('textarea[data-counter]')) updateCounter(e.target);
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
  .then(changed => { if (changed) render(); announceNewAccess(takeNewCourseAccess()); refreshUnreadMessages({ notify: true }); scheduleRankCheck(1500); })
  .catch(err => console.warn('No se pudo revalidar la sesión:', err))
  .finally(startPresence);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js?v=dev101x-v67').catch(() => {}));
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
