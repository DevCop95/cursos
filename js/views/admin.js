/**
 * Vista: Panel de administración (datos reales desde Supabase; RLS solo los entrega a administradores).
 * Una sola tarjeta: barra con contadores y filtros + tabla compacta. El detalle de cada usuario
 * se abre en una ventana emergente.
 */
import { esc, toCsv } from '../lib/html.js';
import { isCloudEnabled } from '../config.js';
import { COURSE, LAB_STEPS } from '../content.js';
import { computeProgress, isLabDone, TOTAL_LESSONS } from '../lab.js';
import { adminListStudents, adminSetCourseAccess } from '../cloud.js';
import { avatarFor, showToast, openDialog } from '../ui.js';
import { activityStatus, filterByActivity, lastActivity, relativeTime } from '../lib/activity.js';

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

let lastRows = [];
let currentFilter = 'active';
let refreshTimer = null;

// Fecha en que el servidor registró el curso como terminado (o null).
function completedAt(row, courseId = COURSE.id) {
  const rec = (row.completions || []).find(c => c.course_id === courseId);
  return rec ? rec.completed_at : null;
}

function hasAccess(row, courseId) {
  const rec = row.access.find(a => a.course_id === courseId);
  return rec ? rec.enabled : true; // sin registro = acceso por defecto
}

function formatDate(iso) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' }); } catch (e) { return '—'; }
}

function notConfiguredHtml() {
  return `
    <div class="max-w-xl mx-auto my-10 p-6 bg-surface rounded-2xl border border-line flex flex-col gap-3">
      <h1 class="text-lg font-bold text-ink">Panel de administración no disponible</h1>
      <p class="text-sm text-ink2">El panel necesita la base de datos en la nube. Para activarlo:</p>
      <ol class="list-decimal pl-5 text-sm text-ink2 space-y-1">
        <li>Ejecuta <code class="font-mono text-xs bg-bg px-1 rounded">supabase/schema.sql</code> en el editor SQL de Supabase.</li>
        <li>Activa el proveedor Google en Supabase Auth con el mismo Client ID.</li>
        <li>Pega la <em>anon key</em> en <code class="font-mono text-xs bg-bg px-1 rounded">js/config.js</code>.</li>
        <li>Asígnate el rol con <code class="font-mono text-xs bg-bg px-1 rounded">update profiles set role = 'admin' where email = '…';</code></li>
      </ol>
    </div>`;
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
      <span class="text-ink2"><strong class="text-ink">${rows.filter(r => completedAt(r)).length}</strong> terminaron el curso</span>
    </div>
    <div class="flex items-center gap-2">
      <div class="inline-flex p-0.5 rounded-lg bg-bg border border-line/70" role="group" aria-label="Filtrar usuarios por actividad">${tabs}</div>
      <button type="button" data-action="export-csv" class="h-9 w-9 rounded-lg bg-white border border-line hover:border-accent/60 flex items-center justify-center text-ink2" title="Exportar CSV" aria-label="Exportar CSV">
        <span class="material-symbols-outlined text-[18px]" aria-hidden="true">download</span>
      </button>
    </div>`;
}

function statusHtml(r, now) {
  const status = activityStatus(r, now);
  const b = STATUS_BADGE[status];
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
          <th scope="col" class="px-3 py-2.5 font-semibold text-right">Acceso</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-line/60">
        ${rows.map(r => {
          const p = computeProgress((r.progress && r.progress.steps) || {});
          const enabled = hasAccess(r, COURSE.id);
          return `
            <tr class="hover:bg-bg/50 transition-colors">
              <td class="pl-4 pr-2 py-2.5">
                <button type="button" data-action="admin-user" data-user="${esc(r.id)}" class="flex items-center gap-2.5 text-left min-w-0 group" title="Ver detalle">
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
              <td class="px-3 py-2.5 hidden sm:table-cell">
                <div class="flex items-center gap-2 w-32">
                  <div class="flex-1 h-1.5 rounded-full bg-bg overflow-hidden"><div class="h-full rounded-full bg-accent" style="width: ${p.percent}%;"></div></div>
                  ${completedAt(r)
                    ? '<span class="material-symbols-outlined text-[18px] text-accent w-8 text-right" title="Curso terminado" aria-label="Curso terminado">verified</span>'
                    : `<span class="font-mono text-[11px] text-ink2 tabular-nums w-8 text-right">${p.percent}%</span>`}
                </div>
              </td>
              <td class="px-3 py-2.5 text-right">
                <label class="inline-flex items-center gap-2 cursor-pointer" title="Acceso a ${esc(COURSE.title)}">
                  <span class="hidden sm:inline font-mono text-[11px] ${enabled ? 'text-accent' : 'text-rose-600'}">${enabled ? 'Habilitado' : 'Bloqueado'}</span>
                  <input type="checkbox" ${enabled ? 'checked' : ''} data-action="toggle-access" data-user="${esc(r.id)}" data-course="${esc(COURSE.id)}" class="accent-accent w-4 h-4" />
                </label>
              </td>
            </tr>`;
        }).join('')}
      </tbody>
    </table>`;
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
      <section class="min-w-0 bg-surface rounded-2xl border border-line overflow-hidden">
        <div id="admin-toolbar" class="px-4 py-3 border-b border-line flex items-center justify-between gap-3 flex-wrap"></div>
        <div id="admin-table" class="overflow-x-auto">
          <p class="p-8 text-sm text-muted text-center">Cargando alumnos…</p>
        </div>
      </section>
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
  if (toolbar) toolbar.innerHTML = toolbarHtml(lastRows);
  if (table) table.innerHTML = tableHtml(lastRows);
}

async function loadRows(container, { quiet = false } = {}) {
  try {
    lastRows = await adminListStudents();
    // No repintar si el admin está cambiando un acceso en este momento.
    if (container.querySelector('#admin-table input:disabled')) return;
    paint(container);
  } catch (err) {
    console.error(err);
    const table = container.querySelector('#admin-table');
    if (table && !quiet) {
      table.innerHTML = '<p class="p-8 text-sm text-rose-700 text-center">No se pudieron cargar los datos. Comprueba que tu cuenta tiene rol de administrador.</p>';
    }
  }
}

export function setAdminFilter(filter) {
  if (!FILTERS.some(f => f.id === filter)) return;
  currentFilter = filter;
  const container = document.getElementById('app-view');
  if (container) paint(container);
}

export function openUserDetails(userId) {
  const r = lastRows.find(row => row.id === userId);
  if (!r) return;
  const steps = (r.progress && r.progress.steps) || {};
  const p = computeProgress(steps);
  const now = Date.now();
  const status = STATUS_BADGE[activityStatus(r, now)];
  const enabled = hasAccess(r, COURSE.id);
  const row = (label, value) => `
    <div class="flex items-center justify-between gap-3 py-2">
      <dt class="text-muted">${label}</dt><dd class="text-ink font-semibold text-right">${value}</dd>
    </div>`;

  openDialog({
    title: r.full_name || r.email,
    kicker: r.role === 'admin' ? 'ADMINISTRADOR' : 'ALUMNO',
    body: `
      <div class="flex flex-col gap-5">
        <div class="flex items-center gap-3">
          <img src="${esc(avatarFor({ avatar: r.avatar_url, name: r.full_name, email: r.email }))}" alt="" referrerpolicy="no-referrer" class="w-12 h-12 rounded-xl object-cover border border-line" />
          <div class="min-w-0">
            <p class="text-xs font-mono text-muted truncate">${esc(r.email)}</p>
            <p class="inline-flex items-center gap-1.5 text-xs font-semibold ${status.text}"><span class="w-1.5 h-1.5 rounded-full ${status.dot}" aria-hidden="true"></span>${status.label} · ${esc(relativeTime(lastActivity(r), now))}</p>
          </div>
        </div>
        <div class="grid grid-cols-3 gap-2 text-center">
          <div class="p-2.5 rounded-xl bg-bg/70 border border-line/70"><p class="text-lg font-extrabold text-accent">${p.percent}%</p><p class="text-[10px] font-mono text-muted">Progreso</p></div>
          <div class="p-2.5 rounded-xl bg-bg/70 border border-line/70"><p class="text-lg font-extrabold text-ink">${p.lessonsDone.length}/${TOTAL_LESSONS}</p><p class="text-[10px] font-mono text-muted">Lecciones</p></div>
          <div class="p-2.5 rounded-xl bg-bg/70 border border-line/70"><p class="text-lg font-extrabold text-ink">${p.labsDone.length}/${LAB_STEPS.length}</p><p class="text-[10px] font-mono text-muted">Labs</p></div>
        </div>
        <ul class="flex flex-col gap-1.5">
          ${LAB_STEPS.map(lab => {
            const done = isLabDone(lab, steps);
            return `<li class="flex items-center gap-2 text-xs"><span class="material-symbols-outlined text-[16px] ${done ? 'text-accent' : 'text-[#b6b2a9]'}" aria-hidden="true">${done ? 'check_circle' : 'radio_button_unchecked'}</span><span class="${done ? 'text-ink font-semibold' : 'text-ink2'}">${esc(lab.title)}</span></li>`;
          }).join('')}
        </ul>
        <dl class="flex flex-col divide-y divide-line/60 text-xs font-mono">
          ${row('Acceso al curso', enabled ? '<span class="text-accent">Habilitado</span>' : '<span class="text-rose-600">Bloqueado</span>')}
          ${row('Último login', esc(formatDate(r.last_login)))}
          ${row('Última actividad', esc(formatDate(r.last_seen)))}
          ${row('Registrado', esc(formatDate(r.created_at)))}
          ${row('Curso terminado', completedAt(r) ? `<span class="text-accent">✓ ${esc(formatDate(completedAt(r)))}</span>` : 'No')}
        </dl>
      </div>`
  });
}

export async function toggleCourseAccess(input) {
  const { user, course } = input.dataset;
  const enabled = input.checked;
  input.disabled = true;
  try {
    await adminSetCourseAccess(user, course, enabled);
    const row = lastRows.find(r => r.id === user);
    if (row) {
      row.access = row.access.filter(a => a.course_id !== course).concat({ course_id: course, enabled });
    }
    const label = input.parentElement.querySelector('span');
    if (label) {
      label.textContent = enabled ? 'Habilitado' : 'Bloqueado';
      label.className = `hidden sm:inline font-mono text-[11px] ${enabled ? 'text-accent' : 'text-rose-600'}`;
    }
    showToast(`Acceso ${enabled ? 'habilitado' : 'revocado'}`, 'success');
  } catch (err) {
    console.error(err);
    input.checked = !enabled;
    showToast('No se pudo guardar el cambio', 'error');
  } finally {
    input.disabled = false;
  }
}

export function exportCsv() {
  if (!lastRows.length) {
    showToast('No hay datos para exportar', 'info');
    return;
  }
  const rows = lastRows.map(r => {
    const p = computeProgress((r.progress && r.progress.steps) || {});
    const last = lastActivity(r);
    return [r.id, r.full_name || '', r.email, r.role, hasAccess(r, COURSE.id) ? 'habilitado' : 'bloqueado', p.percent, p.labsDone.length,
      STATUS_BADGE[activityStatus(r)].label, last ? new Date(last).toISOString() : '', r.last_login || '', completedAt(r) || ''];
  });
  const csv = toCsv(['ID', 'Alumno', 'Email', 'Rol', COURSE.id, 'Progreso %', 'Labs', 'Estado', 'Última actividad', 'Último login', 'Curso terminado'], rows);
  const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'dev101x_alumnos.csv';
  a.click();
  URL.revokeObjectURL(url);
  showToast('CSV descargado', 'success');
}
