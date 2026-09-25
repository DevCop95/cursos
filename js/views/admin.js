/**
 * Vista: Panel de administración (datos reales desde Supabase; RLS solo los entrega a administradores).
 *  - Usuarios: actividad, progreso y nivel de acceso (Gratis / Total). El detalle de cada alumno
 *    (con las excepciones por curso) se abre en una ventana emergente.
 *  - Cursos: catálogo con los interruptores Gratis y Publicado.
 * La regla de acceso la aplica el servidor (can_access_course); lib/access.js solo la explica.
 */
import { esc, toCsv } from '../lib/html.js?v=dev101x-v54';
import { isCloudEnabled } from '../config.js?v=dev101x-v54';
import { COURSE, LAB_STEPS } from '../content.js?v=dev101x-v54';
import { computeProgress, isLabDone, TOTAL_LESSONS } from '../lab.js?v=dev101x-v54';
import { adminListStudents, fetchCourses, adminSetCourseOverride, adminSetAccessLevel, adminUpdateCourse, adminResetProgress, fetchAccessRequests, adminRejectAccessRequest, fetchMessages, adminRevokeCourse, fetchUserStats } from '../cloud.js?v=dev101x-v54';
import { rankView } from '../lib/ranks.js?v=dev101x-v54';
import { openAdminThread } from './messages.js?v=dev101x-v54';
import { avatarFor, showToast, openDialog } from '../ui.js?v=dev101x-v54';
import { activityStatus, filterByActivity, lastActivity, relativeTime } from '../lib/activity.js?v=dev101x-v54';
import { courseAccess, ACCESS_LEVELS } from '../lib/access.js?v=dev101x-v54';

const REFRESH_MS = 60 * 1000;
const FILTERS = [
  { id: 'active', label: 'Activos' },
  { id: 'online', label: 'En línea' },
  { id: 'all', label: 'Todos' }
];
const STATUS_BADGE = {
  online: { label: 'En línea', dot: 'bg-emerald-500 animate-pulse', text: 'text-emerald-700' },
  active: { label: 'Activo', dot: 'bg-sky-500', text: 'text-sky-700' },
  inactive: { label: 'Inactivo', dot: 'bg-[#b6b2a9]', text: 'text-muted' },
  never: { label: 'Sin actividad', dot: 'bg-[#d3cec5]', text: 'text-muted' }
};
const OVERRIDES = [
  { id: 'auto', label: 'Según su nivel' },
  { id: 'grant', label: 'Conceder' },
  { id: 'block', label: 'Bloquear' }
];

let lastRows = [];
let lastCourses = [];
let lastRequests = []; // solicitudes de acceso pendientes
let lastMessages = []; // mensajes de todas las conversaciones
let currentFilter = 'active';
let refreshTimer = null;

// Fecha en que el servidor registró el curso como terminado (o null).
function completedAt(row, courseId = COURSE.id) {
  const rec = (row.completions || []).find(c => c.course_id === courseId);
  return rec ? rec.completed_at : null;
}

function overrideMode(row, courseId) {
  const rec = row.access.find(a => a.course_id === courseId);
  return rec ? (rec.enabled ? 'grant' : 'block') : 'auto';
}

function accessFor(row, course) {
  return courseAccess(course, row, row.access);
}

// Progreso del alumno en cada curso al que tiene acceso (o en el que ya tiene progreso).
// Nmap se calcula con sus pasos (student_progress); los demás vienen de course_progress.
function courseProgressItems(row) {
  return lastCourses.map(c => {
    if (c.id === COURSE.id) {
      const steps = (row.progress && row.progress.steps) || {};
      const p = computeProgress(steps);
      return { course: c, percent: p.percent, done: Boolean(completedAt(row)), allowed: accessFor(row, c).allowed, started: Object.keys(steps).length > 0 };
    }
    const cp = (row.courseProgress || []).find(x => x.course_id === c.id);
    const percent = cp ? Number(cp.progress_percentage) || 0 : 0;
    return { course: c, percent, done: Boolean(cp && cp.completed_at), allowed: accessFor(row, c).allowed, started: Boolean(cp) };
  }).filter(i => i.allowed || i.started);
}

const shortTitle = title => String(title || '').split(/[\s:]+/)[0];

function progressBarsHtml(row) {
  const items = courseProgressItems(row);
  if (!items.length) return '<span class="text-[11px] text-muted">—</span>';
  return items.map(i => `
    <div class="flex items-center gap-2 w-44" title="${esc(i.course.title)}">
      <span class="w-16 truncate text-[10px] text-muted">${esc(shortTitle(i.course.title))}</span>
      <div class="flex-1 h-1.5 rounded-full bg-bg overflow-hidden"><div class="h-full rounded-full bg-accent" style="width: ${i.percent}%;"></div></div>
      <span class="w-8 text-right font-mono text-[11px] tabular-nums ${i.done ? 'text-accent font-bold' : 'text-ink2'}">${i.done ? '✓' : `${i.percent}%`}</span>
    </div>`).join('');
}

function formatDate(iso) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' }); } catch (e) { return '—'; }
}

function notConfiguredHtml() {
  return `
    <div class="max-w-xl mx-auto my-10 p-6 bg-surface rounded-2xl border border-line flex flex-col gap-3">
      <h1 class="text-lg font-bold text-ink">Panel de administración no disponible</h1>
      <p class="text-sm text-ink2">El panel necesita la base de datos en la nube.</p>
    </div>`;
}

const SELECT_CLS = 'h-8 pl-2 pr-7 rounded-lg border border-line bg-white text-xs font-semibold text-ink outline-none focus:border-accent cursor-pointer';

function levelSelect(row) {
  if (row.role === 'admin') return '<span class="inline-block px-2 py-1 rounded-lg bg-amber-100 text-amber-900 text-[11px] font-mono font-bold shrink-0" title="Los administradores tienen acceso a todos los cursos">Total</span>';
  return `
    <select data-action="admin-level" data-user="${esc(row.id)}" class="${SELECT_CLS}" aria-label="Nivel de acceso de ${esc(row.full_name || row.email)}">
      ${ACCESS_LEVELS.map(l => `<option value="${l.id}" ${row.access_level === l.id ? 'selected' : ''}>${l.label}</option>`).join('')}
    </select>`;
}

function toolbarHtml(rows) {
  const now = Date.now();
  const count = status => rows.filter(r => activityStatus(r, now) === status).length;
  const online = count('online');
  const active = online + count('active');
  const tabs = FILTERS.map(f => `
    <button type="button" data-action="admin-filter" data-filter="${f.id}" aria-pressed="${f.id === currentFilter}"
      class="px-3 h-8 rounded-md text-xs font-semibold transition-colors ${f.id === currentFilter ? 'bg-white text-ink shadow-sm' : 'text-muted hover:text-ink'}">${f.label}</button>`).join('');
  return `
    <div class="flex items-center gap-3 flex-wrap text-xs">
      <span class="inline-flex items-center gap-1.5 font-semibold text-emerald-700"><span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" aria-hidden="true"></span>${online} en línea</span>
      <span class="text-line" aria-hidden="true">•</span>
      <span class="text-ink2"><strong class="text-ink">${active}</strong> activos (7 días)</span>
      <span class="text-line" aria-hidden="true">•</span>
      <span class="text-ink2"><strong class="text-ink">${rows.length}</strong> registrados</span>
      <span class="text-line" aria-hidden="true">•</span>
      <span class="text-ink2"><strong class="text-ink">${rows.filter(r => r.access_level === 'full' || r.role === 'admin').length}</strong> con acceso total</span>
    </div>
    <div class="flex items-center gap-2">
      <div class="inline-flex p-0.5 rounded-lg bg-bg border border-line/70" role="group" aria-label="Filtrar usuarios por actividad">${tabs}</div>
      <button type="button" data-action="export-csv" class="h-9 w-9 rounded-lg bg-white border border-line hover:border-accent/60 flex items-center justify-center text-ink2" title="Exportar CSV" aria-label="Exportar CSV">
        <span class="material-symbols-outlined text-[18px]" aria-hidden="true">download</span>
      </button>
    </div>`;
}

function statusHtml(r, now) {
  const b = STATUS_BADGE[activityStatus(r, now)];
  return `
    <span class="inline-flex items-center gap-1.5 text-xs font-semibold ${b.text}"><span class="w-1.5 h-1.5 rounded-full ${b.dot}" aria-hidden="true"></span>${b.label}</span>
    <span class="block text-[11px] text-muted font-mono">${esc(relativeTime(lastActivity(r), now))}</span>`;
}

function tableHtml(allRows) {
  if (!allRows.length) {
    return '<p class="p-8 text-sm text-muted text-center">Todavía no hay alumnos registrados.</p>';
  }
  const now = Date.now();
  const rows = filterByActivity(allRows, currentFilter, now);
  if (!rows.length) {
    const msg = currentFilter === 'online' ? 'No hay nadie en línea ahora mismo.' : 'Ningún usuario ha estado activo en los últimos 7 días.';
    return `<p class="p-8 text-sm text-muted text-center">${msg}</p>`;
  }
  return `
    <table class="w-full text-left border-collapse">
      <thead class="text-[11px] text-muted font-mono uppercase">
        <tr class="border-b border-line">
          <th scope="col" class="px-4 py-2.5 font-semibold">Usuario</th>
          <th scope="col" class="px-3 py-2.5 font-semibold">Actividad</th>
          <th scope="col" class="px-3 py-2.5 font-semibold hidden sm:table-cell">Progreso</th>
          <th scope="col" class="px-3 py-2.5 font-semibold text-right">Nivel</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-line/60">
        ${rows.map(r => {
          return `
            <tr class="hover:bg-bg/50 transition-colors">
              <td class="pl-4 pr-2 py-2.5">
                <button type="button" data-action="admin-user" data-user="${esc(r.id)}" class="flex items-center gap-2.5 text-left min-w-0 group" title="Ver detalle y cursos">
                  <img src="${esc(avatarFor({ avatar: r.avatar_url, name: r.full_name, email: r.email }))}" alt="" referrerpolicy="no-referrer" class="w-8 h-8 rounded-lg object-cover border border-line shrink-0" />
                  <span class="min-w-0">
                    <span class="flex items-center gap-1.5">
                      <span class="font-semibold text-sm text-ink group-hover:text-accent truncate">${esc(r.full_name || r.email)}</span>
                      ${r.role === 'admin' ? '<span class="px-1.5 py-px rounded bg-amber-100 text-amber-900 text-[9px] font-mono font-bold shrink-0">ADMIN</span>' : ''}
                    </span>
                    <span class="block text-[11px] text-muted font-mono truncate max-w-[140px] sm:max-w-[260px]">${esc(r.email)}</span>
                  </span>
                </button>
              </td>
              <td class="px-3 py-2.5 whitespace-nowrap">${statusHtml(r, now)}</td>
              <td class="px-3 py-2.5 hidden sm:table-cell"><div class="flex flex-col gap-1">${progressBarsHtml(r)}</div></td>
              <td class="px-3 py-2.5 text-right">${levelSelect(r)}</td>
            </tr>`;
        }).join('')}
      </tbody>
    </table>`;
}

function coursesHtml(courses) {
  if (!courses.length) return '<p class="p-6 text-sm text-muted text-center">No hay cursos en el catálogo.</p>';
  const toggle = (c, field, label) => `
    <label class="inline-flex items-center gap-1.5 text-xs text-ink2 cursor-pointer">
      <input type="checkbox" ${c[field] ? 'checked' : ''} data-action="admin-course-flag" data-course="${esc(c.id)}" data-field="${field}" class="accent-accent w-4 h-4" />${label}
    </label>`;
  return `
    <ul class="divide-y divide-line/60">
      ${courses.map(c => `
        <li class="flex items-center justify-between gap-3 px-4 py-3 flex-wrap">
          <div class="min-w-0">
            <p class="text-sm font-semibold text-ink truncate">${esc(c.title)}</p>
            <p class="text-[11px] font-mono text-muted">${esc(c.id)}${c.id === COURSE.id || c.has_content ? '' : ' · sin contenido todavía'}</p>
          </div>
          <div class="flex items-center gap-4">${toggle(c, 'is_free', 'Gratis')}${toggle(c, 'published', 'Publicado')}</div>
        </li>`).join('')}
    </ul>`;
}

export async function renderAdmin(container) {
  if (!isCloudEnabled()) {
    container.innerHTML = notConfiguredHtml();
    return;
  }
  container.innerHTML = `
    <div class="flex flex-col w-full py-4 sm:py-6 gap-3 max-w-5xl mx-auto">
      <div class="flex items-end justify-between gap-3">
        <div>
          <p class="text-[11px] font-mono text-muted">ADMINISTRACIÓN</p>
          <h1 class="text-xl font-extrabold text-ink tracking-tight">Usuarios y accesos</h1>
        </div>
        <span class="text-[11px] text-muted font-mono hidden sm:inline">Se actualiza cada minuto</span>
      </div>
      <div id="admin-requests"></div>
      <div id="admin-messages"></div>
      <section class="min-w-0 bg-surface rounded-2xl border border-line overflow-hidden">
        <div id="admin-toolbar" class="px-4 py-3 border-b border-line flex items-center justify-between gap-3 flex-wrap"></div>
        <div id="admin-table" class="overflow-x-auto">
          <p class="p-8 text-sm text-muted text-center">Cargando alumnos…</p>
        </div>
      </section>

      <h2 class="text-base font-bold text-ink mt-4 px-1">Cursos</h2>
      <section class="min-w-0 bg-surface rounded-2xl border border-line overflow-hidden">
        <div id="admin-courses"><p class="p-6 text-sm text-muted text-center">Cargando cursos…</p></div>
      </section>
      <p class="text-[11px] text-muted px-1">Los cursos nuevos se crean en Supabase (tabla <code class="font-mono">courses</code>) y aparecen aquí para gestionarlos.</p>
    </div>`;

  clearInterval(refreshTimer);
  await loadRows(container);
  // Refresco periódico mientras el panel siga en pantalla.
  refreshTimer = setInterval(() => {
    if (!container.querySelector('#admin-table')) { clearInterval(refreshTimer); return; }
    if (document.visibilityState === 'visible') loadRows(container, { quiet: true });
  }, REFRESH_MS);
}

function paint(container) {
  const toolbar = container.querySelector('#admin-toolbar');
  const table = container.querySelector('#admin-table');
  const courses = container.querySelector('#admin-courses');
  if (toolbar) toolbar.innerHTML = toolbarHtml(lastRows);
  if (table) table.innerHTML = tableHtml(lastRows);
  if (courses) courses.innerHTML = coursesHtml(lastCourses);
  const requests = container.querySelector('#admin-requests');
  if (requests) requests.innerHTML = requestsHtml();
  const messages = container.querySelector('#admin-messages');
  if (messages) messages.innerHTML = messagesHtml();
}

// Conversaciones con alumnos: primero las que tienen mensajes sin leer, luego la más reciente.
function messagesHtml() {
  const byUser = new Map();
  lastMessages.forEach(m => { if (!byUser.has(m.user_id)) byUser.set(m.user_id, []); byUser.get(m.user_id).push(m); });
  if (!byUser.size) return '';
  const now = Date.now();
  const threads = [...byUser.entries()]
    .map(([userId, list]) => ({ userId, last: list[list.length - 1], unread: list.filter(m => !m.from_admin && !m.read_at).length }))
    .sort((a, b) => (b.unread > 0) - (a.unread > 0) || Date.parse(b.last.created_at) - Date.parse(a.last.created_at));
  const unreadTotal = threads.reduce((n, t) => n + t.unread, 0);
  return `
    <details class="min-w-0 bg-surface rounded-2xl border border-line overflow-hidden" ${unreadTotal ? 'open' : ''}>
      <summary class="px-4 py-3 text-sm font-bold text-ink flex items-center gap-2 cursor-pointer select-none">
        <span class="material-symbols-outlined text-[18px] text-accent" aria-hidden="true">mail</span>Mensajes
        ${unreadTotal ? `<span class="px-1.5 py-px rounded-md bg-rose-500 text-white text-[10px] font-mono">${unreadTotal} sin leer</span>` : `<span class="text-[11px] font-mono text-muted font-normal">${threads.length} ${threads.length === 1 ? 'conversación' : 'conversaciones'}</span>`}
      </summary>
      <ul class="divide-y divide-line/60 border-t border-line">
        ${threads.map(t => {
          const r = lastRows.find(x => x.id === t.userId) || { email: 'Alumno', full_name: '' };
          return `
            <li>
              <button type="button" data-action="admin-thread" data-user="${esc(t.userId)}" class="w-full px-4 py-2.5 flex items-center gap-3 text-left hover:bg-bg/60">
                <img src="${esc(avatarFor({ avatar: r.avatar_url, name: r.full_name, email: r.email }))}" alt="" referrerpolicy="no-referrer" class="w-8 h-8 rounded-lg object-cover border border-line shrink-0" />
                <span class="min-w-0 flex-1">
                  <span class="block text-[13px] ${t.unread ? 'font-bold text-ink' : 'font-semibold text-ink2'} truncate">${esc(r.full_name || r.email)}</span>
                  <span class="block text-[11px] text-muted truncate">${t.last.from_admin ? 'Tú: ' : ''}${esc(t.last.body)}</span>
                </span>
                <span class="text-[10px] font-mono text-muted shrink-0">${esc(relativeTime(Date.parse(t.last.created_at), now))}</span>
                ${t.unread ? `<span class="px-1.5 py-px rounded-md bg-rose-500 text-white text-[10px] font-mono shrink-0">${t.unread}</span>` : ''}
              </button>
            </li>`;
        }).join('')}
      </ul>
    </details>`;
}

export async function openThread(userId) {
  const r = lastRows.find(x => x.id === userId) || {};
  await openAdminThread(userId, r.full_name || r.email);
  lastMessages = lastMessages.map(m => (m.user_id === userId && !m.from_admin && !m.read_at ? { ...m, read_at: new Date().toISOString() } : m));
  repaint();
}

// Revocar un curso con motivo: ventana con el motivo → bloquea el curso y se lo explica al alumno.
export function openRevokeDialog(btn) {
  const { user, course } = btn.dataset;
  const r = lastRows.find(x => x.id === user);
  const c = lastCourses.find(x => x.id === course);
  if (!r || !c) return;
  openDialog({
    title: 'Revocar acceso',
    kicker: String(c.title).toUpperCase(),
    body: `
      <form data-action="admin-revoke-confirm" data-user="${esc(user)}" data-course="${esc(course)}" class="flex flex-col gap-3">
        <p class="text-[13px] text-ink2">${esc(r.full_name || r.email)} dejará de tener acceso a <strong class="text-ink">${esc(c.title)}</strong>. Su progreso se conserva. Le llegará este motivo como mensaje:</p>
        <textarea name="reason" required maxlength="900" rows="3" placeholder="Ej.: el pago fue rechazado por el banco." class="w-full p-3 rounded-xl border border-line bg-white text-[13px] outline-none focus:border-accent resize-y"></textarea>
        <div class="flex items-center justify-end gap-2">
          <button type="button" data-action="admin-user" data-user="${esc(user)}" class="h-9 px-4 rounded-xl bg-white border border-line text-xs font-semibold text-ink">Cancelar</button>
          <button type="submit" class="h-9 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold inline-flex items-center gap-1.5"><span class="material-symbols-outlined text-[16px]" aria-hidden="true">block</span>Revocar y avisar</button>
        </div>
      </form>`
  });
}

export async function confirmRevoke(form) {
  const { user, course } = form.dataset;
  const area = form.querySelector('textarea[name="reason"]');
  const reason = area ? area.value.trim() : '';
  const btn = form.querySelector('button[type="submit"]');
  if (!reason || !btn) return;
  const ok = await saving(btn, () => adminRevokeCourse(user, course, reason), 'Acceso revocado y alumno avisado');
  if (!ok) return;
  const r = lastRows.find(x => x.id === user);
  if (r) {
    r.access = r.access.filter(a => a.course_id !== course);
    r.access.push({ course_id: course, enabled: false });
  }
  lastRequests = lastRequests.filter(q => !(q.user_id === user && q.course_id === course));
  lastMessages = await fetchMessages().catch(() => lastMessages);
  repaint();
  openUserDetails(user);
}

// Solicitudes de acceso pendientes (el alumno pulsó "Solicitar acceso" en el catálogo).
function requestsHtml() {
  if (!lastRequests.length) return '';
  const now = Date.now();
  return `
    <section class="min-w-0 bg-amber-50/70 rounded-2xl border border-amber-200 overflow-hidden">
      <h2 class="px-4 py-3 border-b border-amber-200 text-sm font-bold text-amber-950 flex items-center gap-2">
        <span class="material-symbols-outlined text-[18px] text-amber-600" aria-hidden="true">key</span>Solicitudes de acceso
        <span class="px-1.5 py-px rounded-md bg-amber-500 text-white text-[10px] font-mono">${lastRequests.length}</span>
      </h2>
      <ul class="divide-y divide-amber-200/70">
        ${lastRequests.map(q => {
          const r = lastRows.find(x => x.id === q.user_id) || { email: 'Alumno', full_name: '' };
          const c = lastCourses.find(x => x.id === q.course_id) || { title: q.course_id };
          return `
            <li class="px-4 py-2.5 flex items-center gap-3 flex-wrap">
              <img src="${esc(avatarFor({ avatar: r.avatar_url, name: r.full_name, email: r.email }))}" alt="" referrerpolicy="no-referrer" class="w-8 h-8 rounded-lg object-cover border border-line shrink-0" />
              <div class="min-w-0 flex-1">
                <p class="text-[13px] font-semibold text-ink truncate">${esc(r.full_name || r.email)} <span class="font-normal text-ink2">pide</span> ${esc(c.title)}</p>
                <p class="text-[11px] font-mono text-muted truncate">${esc(r.email)} · ${esc(relativeTime(Date.parse(q.created_at), now))}</p>
              </div>
              <div class="flex items-center gap-2 shrink-0">
                <button type="button" data-action="admin-grant-request" data-user="${esc(q.user_id)}" data-course="${esc(q.course_id)}" class="h-8 px-3 rounded-lg bg-accent hover:bg-accent2 text-white text-xs font-semibold">Conceder</button>
                <button type="button" data-action="admin-reject-request" data-user="${esc(q.user_id)}" data-course="${esc(q.course_id)}" class="h-8 px-3 rounded-lg bg-white border border-line hover:border-rose-300 text-rose-600 text-xs font-semibold">Rechazar</button>
              </div>
            </li>`;
        }).join('')}
      </ul>
    </section>`;
}

export async function answerAccessRequest(btn, grant) {
  const { user, course } = btn.dataset;
  const ok = await saving(btn, () => (grant ? adminSetCourseOverride(user, course, 'grant') : adminRejectAccessRequest(user, course)),
    grant ? 'Acceso concedido' : 'Solicitud rechazada');
  if (!ok) return;
  lastRequests = lastRequests.filter(q => !(q.user_id === user && q.course_id === course));
  const r = lastRows.find(x => x.id === user);
  if (grant && r) {
    r.access = r.access.filter(a => a.course_id !== course);
    r.access.push({ course_id: course, enabled: true });
  }
  repaint();
}

async function loadRows(container, { quiet = false } = {}) {
  try {
    let requests;
    [lastRows, lastCourses, requests, lastMessages] = await Promise.all([adminListStudents(), fetchCourses(), fetchAccessRequests().catch(() => []), fetchMessages().catch(() => [])]);
    lastRequests = requests.filter(q => !q.rejected_at);
    // No repintar si el admin está cambiando algo en este momento.
    if (container.querySelector('select:disabled, input:disabled')) return;
    paint(container);
  } catch (err) {
    console.error(err);
    const table = container.querySelector('#admin-table');
    if (table && !quiet) {
      table.innerHTML = '<p class="p-8 text-sm text-rose-700 text-center">No se pudieron cargar los datos. Comprueba que tu cuenta tiene rol de administrador.</p>';
    }
  }
}

function repaint() {
  const container = document.getElementById('app-view');
  if (container && container.querySelector('#admin-table')) paint(container);
}

export function setAdminFilter(filter) {
  if (!FILTERS.some(f => f.id === filter)) return;
  currentFilter = filter;
  repaint();
}

// ---------------------------------------------------------------------------
// Detalle del alumno
// ---------------------------------------------------------------------------
function userCoursesHtml(r) {
  return lastCourses.map(c => {
    const a = accessFor(r, c);
    const mode = overrideMode(r, c.id);
    return `
      <li class="flex items-center justify-between gap-3 py-2.5">
        <div class="min-w-0">
          <p class="text-[13px] font-semibold text-ink truncate">${esc(c.title)}</p>
          <p class="text-[11px] font-mono ${a.allowed ? 'text-accent' : 'text-rose-600'}">${a.allowed ? '✓' : '✕'} ${esc(a.label)}${c.is_free ? ' · curso gratis' : ''}</p>
        </div>
        ${r.role === 'admin' ? '' : `
        <div class="flex items-center gap-2 shrink-0">
        ${!c.is_free && a.allowed ? `<button type="button" data-action="admin-revoke" data-user="${esc(r.id)}" data-course="${esc(c.id)}" class="h-8 px-2.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-[11px] font-semibold" title="Retira el acceso y le explica el motivo">Revocar</button>` : ''}
        <select data-action="admin-override" data-user="${esc(r.id)}" data-course="${esc(c.id)}" class="${SELECT_CLS} shrink-0" aria-label="Acceso a ${esc(c.title)}">
          ${OVERRIDES.map(o => `<option value="${o.id}" ${mode === o.id ? 'selected' : ''}>${o.label}</option>`).join('')}
        </select>
        </div>`}
      </li>`;
  }).join('');
}

export function openUserDetails(userId) {
  const r = lastRows.find(row => row.id === userId);
  if (!r) return;
  const steps = (r.progress && r.progress.steps) || {};
  const p = computeProgress(steps);
  const now = Date.now();
  const status = STATUS_BADGE[activityStatus(r, now)];
  const row = (label, value) => `
    <div class="flex items-center justify-between gap-3 py-2">
      <dt class="text-muted">${label}</dt><dd class="text-ink font-semibold text-right">${value}</dd>
    </div>`;

  openDialog({
    title: r.full_name || r.email,
    kicker: r.role === 'admin' ? 'ADMINISTRADOR' : 'ALUMNO',
    body: `
      <div class="flex flex-col gap-5" data-user-detail="${esc(r.id)}">
        <div class="flex items-center gap-3">
          <img src="${esc(avatarFor({ avatar: r.avatar_url, name: r.full_name, email: r.email }))}" alt="" referrerpolicy="no-referrer" class="w-12 h-12 rounded-xl object-cover border border-line" />
          <div class="min-w-0 flex-1">
            <p class="text-xs font-mono text-muted truncate">${esc(r.email)}</p>
            <p class="inline-flex items-center gap-1.5 text-xs font-semibold ${status.text}"><span class="w-1.5 h-1.5 rounded-full ${status.dot}" aria-hidden="true"></span>${status.label} · ${esc(relativeTime(lastActivity(r), now))}</p>
            <p id="user-rank" data-user="${esc(r.id)}" class="text-[11px] font-mono text-muted mt-0.5">&nbsp;</p>
          </div>
          <button type="button" data-action="admin-thread" data-user="${esc(r.id)}" class="h-8 w-8 rounded-lg border border-line bg-white hover:border-accent/60 text-ink2 inline-flex items-center justify-center shrink-0" title="Mensajes con este alumno" aria-label="Mensajes con este alumno"><span class="material-symbols-outlined text-[18px]" aria-hidden="true">mail</span></button>
          ${levelSelect(r)}
        </div>
        <section class="flex flex-col gap-2">
          <h3 class="text-[11px] font-mono font-bold text-muted uppercase tracking-wide">Progreso por curso</h3>
          ${courseProgressItems(r).map(i => `
            <div class="flex items-center gap-3 text-xs">
              <span class="flex-1 min-w-0 truncate text-ink font-semibold">${esc(i.course.title)}</span>
              <span class="w-20 bg-bg h-1.5 rounded-full overflow-hidden shrink-0" aria-hidden="true"><span class="block bg-accent h-full rounded-full" style="width: ${i.percent}%"></span></span>
              <span class="w-10 text-right font-mono font-bold ${i.done ? 'text-accent' : 'text-ink2'}">${i.done ? '✓' : `${i.percent}%`}</span>
              ${i.started ? `<button type="button" data-action="admin-reset" data-user="${esc(r.id)}" data-course="${esc(i.course.id)}" class="shrink-0 px-2 py-1 rounded-lg border border-line hover:border-rose-300 hover:bg-rose-50 text-rose-600 text-[10px] font-semibold" title="Borra el progreso de este curso">Reiniciar</button>` : '<span class="w-[62px] shrink-0" aria-hidden="true"></span>'}
            </div>`).join('') || '<p class="text-xs text-muted">Sin cursos todavía.</p>'}
          <details class="rounded-xl border border-line bg-bg/40 text-xs">
            <summary class="cursor-pointer px-3 py-2 font-semibold text-ink2 select-none">Detalle de ${esc(shortTitle(COURSE.title))}: ${p.lessonsDone.length}/${TOTAL_LESSONS} lecciones · ${p.labsDone.length}/${LAB_STEPS.length} labs</summary>
            <ul class="flex flex-col gap-1.5 px-3 pb-3">
              ${LAB_STEPS.map(lab => {
                const done = isLabDone(lab, steps);
                return `<li class="flex items-center gap-2"><span class="material-symbols-outlined text-[16px] ${done ? 'text-accent' : 'text-[#b6b2a9]'}" aria-hidden="true">${done ? 'check_circle' : 'radio_button_unchecked'}</span><span class="${done ? 'text-ink font-semibold' : 'text-ink2'}">${esc(lab.title)}</span></li>`;
              }).join('')}
            </ul>
          </details>
        </section>
        <section>
          <h3 class="text-[11px] font-mono font-bold text-muted uppercase tracking-wide">Acceso a cursos</h3>
          <ul id="user-courses" class="flex flex-col divide-y divide-line/60">${userCoursesHtml(r)}</ul>
        </section>
        <dl class="flex flex-col divide-y divide-line/60 text-xs font-mono">
          ${row('Último login', esc(formatDate(r.last_login)))}
          ${row('Última actividad', esc(formatDate(r.last_seen)))}
          ${row('Registrado', esc(formatDate(r.created_at)))}
          ${row('Cursos terminados', (r.completions || []).length
            ? r.completions.map(c => `<span class="block text-accent">✓ ${esc((lastCourses.find(x => x.id === c.course_id) || { title: c.course_id }).title)} · ${esc(formatDate(c.completed_at))}</span>`).join('')
            : 'Ninguno')}
        </dl>
      </div>`
  });
  // Rango y puntos del alumno (calculados en el servidor).
  fetchUserStats(userId).then(stats => {
    const el = document.getElementById('user-rank');
    const v = rankView(stats);
    if (!el || !v || el.dataset.user !== userId) return;
    el.innerHTML = `<span class="inline-flex items-center gap-1 px-1.5 py-px rounded-md bg-term border ${v.tone} font-bold"><span class="material-symbols-outlined text-[13px]" aria-hidden="true">${esc(v.icon)}</span>${esc(v.name)}</span> <span class="ml-1">${v.points} pts</span>`;
  }).catch(() => {});
}

// ---------------------------------------------------------------------------
// Cambios del admin (los valida el servidor con RLS)
// ---------------------------------------------------------------------------
async function saving(el, fn, okMsg) {
  el.disabled = true;
  try {
    await fn();
    showToast(okMsg, 'success');
    return true;
  } catch (err) {
    console.error(err);
    showToast('No se pudo guardar el cambio', 'error');
    return false;
  } finally {
    el.disabled = false;
  }
}

function refreshUserDetail(userId) {
  const list = document.getElementById('user-courses');
  const r = lastRows.find(row => row.id === userId);
  if (list && r) list.innerHTML = userCoursesHtml(r);
}

export async function setAccessLevel(select) {
  const { user } = select.dataset;
  const level = select.value;
  const r = lastRows.find(row => row.id === user);
  const prev = r ? r.access_level : 'free';
  const ok = await saving(select, () => adminSetAccessLevel(user, level), `Nivel de acceso: ${level === 'full' ? 'Total' : 'Gratis'}`);
  if (!ok) { select.value = prev; return; }
  if (r) r.access_level = level;
  // Sincronizar el otro selector del mismo alumno (tabla o ventana) y los cursos del detalle.
  document.querySelectorAll(`select[data-action="admin-level"][data-user="${user}"]`).forEach(s => { s.value = level; });
  refreshUserDetail(user);
  const toolbar = document.getElementById('admin-toolbar');
  if (toolbar) toolbar.innerHTML = toolbarHtml(lastRows);
  // Con nivel 'full' el servidor borra sus solicitudes pendientes: se vuelven a leer.
  if (level === 'full') {
    const requests = await fetchAccessRequests().catch(() => null);
    if (requests) {
      lastRequests = requests.filter(q => !q.rejected_at);
      const box = document.getElementById('admin-requests');
      if (box) box.innerHTML = requestsHtml();
    }
  }
}

export async function setCourseOverride(select) {
  const { user, course } = select.dataset;
  const mode = select.value;
  const r = lastRows.find(row => row.id === user);
  const prev = r ? overrideMode(r, course) : 'auto';
  const label = OVERRIDES.find(o => o.id === mode).label.toLowerCase();
  const ok = await saving(select, () => adminSetCourseOverride(user, course, mode), `Acceso al curso: ${label}`);
  if (!ok) { select.value = prev; return; }
  if (r) {
    r.access = r.access.filter(a => a.course_id !== course);
    if (mode !== 'auto') r.access.push({ course_id: course, enabled: mode === 'grant' });
  }
  refreshUserDetail(user);
}

// Borra el progreso de un alumno en un curso. En Nmap, su navegador descarta la copia local al volver a
// sincronizar (student_progress.reset_at), así que no lo vuelve a subir.
export async function resetUserProgress(btn) {
  const { user, course } = btn.dataset;
  const r = lastRows.find(row => row.id === user);
  const c = lastCourses.find(x => x.id === course);
  if (!r || !c) return;
  const who = r.full_name || r.email;
  if (!window.confirm(`¿Reiniciar el progreso de ${who} en «${c.title}»? Se borran sus comandos, respuestas y el estado del laboratorio. No se puede deshacer.`)) return;
  const ok = await saving(btn, () => adminResetProgress(user, course), 'Progreso reiniciado');
  if (!ok) return;
  if (course === COURSE.id) r.progress = { ...(r.progress || {}), steps: {}, progress_percentage: 0, completed_at: null };
  else r.courseProgress = (r.courseProgress || []).filter(cp => cp.course_id !== course);
  r.completions = (r.completions || []).filter(x => x.course_id !== course);
  repaint();
  openUserDetails(user);
}

export async function setCourseFlag(input) {
  const { course, field } = input.dataset;
  const value = input.checked;
  const ok = await saving(input, () => adminUpdateCourse(course, { [field]: value }),
    field === 'is_free' ? (value ? 'Curso marcado como gratis' : 'Curso marcado como de pago') : (value ? 'Curso publicado' : 'Curso oculto'));
  if (!ok) { input.checked = !value; return; }
  const c = lastCourses.find(x => x.id === course);
  if (c) c[field] = value;
}

export function exportCsv() {
  if (!lastRows.length) {
    showToast('No hay datos para exportar', 'info');
    return;
  }
  const rows = lastRows.map(r => {
    const p = computeProgress((r.progress && r.progress.steps) || {});
    const last = lastActivity(r);
    const courses = lastCourses.map(c => (accessFor(r, c).allowed ? 'sí' : 'no'));
    const items = courseProgressItems(r);
    const pct = lastCourses.map(c => { const i = items.find(x => x.course.id === c.id); return i ? i.percent : ''; });
    return [r.id, r.full_name || '', r.email, r.role, r.role === 'admin' || r.access_level === 'full' ? 'total' : 'gratis', ...courses, ...pct, p.labsDone.length,
      STATUS_BADGE[activityStatus(r)].label, last ? new Date(last).toISOString() : '', r.last_login || '', completedAt(r) || ''];
  });
  const csv = toCsv(['ID', 'Alumno', 'Email', 'Rol', 'Nivel', ...lastCourses.map(c => `Acceso ${c.id}`), ...lastCourses.map(c => `Progreso ${c.id} %`), `Labs ${COURSE.id}`, 'Estado', 'Última actividad', 'Último login', `Terminado ${COURSE.id}`], rows);
  const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'dev101x_alumnos.csv';
  a.click();
  URL.revokeObjectURL(url);
  showToast('CSV descargado', 'success');
}
