/**
 * Vista: Perfil del alumno (resumen) + ventana con habilidades y datos de la cuenta.
 */
import { esc } from '../lib/html.js?v=dev101x-v53';
import { appState } from '../state.js?v=dev101x-v53';
import { currentProgress, currentSteps, fetchStreak } from '../progress.js?v=dev101x-v53';
import { computeBadges } from '../lib/badges.js?v=dev101x-v53';
import { avatarFor, openDialog } from '../ui.js?v=dev101x-v53';
import { isAdmin } from '../auth.js?v=dev101x-v53';
import { fetchCourseProgress, fetchCourses, fetchAccessibleCourses, fetchUserStats } from '../cloud.js?v=dev101x-v53';
import { rankView, courseIcon } from '../lib/ranks.js?v=dev101x-v53';
import { COURSE } from '../content.js?v=dev101x-v53';
import { paintResume } from './resume.js?v=dev101x-v53'; // curso de Nmap: su progreso vive en progress.js

function formatDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' });
  } catch (e) {
    return '—';
  }
}

// Logros pequeños del laboratorio de Nmap (primer comando, labs, reto, racha): fila discreta.
function achievementsHtml(steps, bestStreak) {
  return computeBadges(steps, { bestStreak }).map(b => `
    <span class="inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] font-semibold ${b.earned ? 'border-emerald-200 bg-emerald-50/70 text-emerald-900' : 'border-line bg-bg/60 text-muted'}" title="${esc(b.desc)}">
      <span class="material-symbols-outlined text-[14px]" aria-hidden="true">${b.earned ? esc(b.icon) : 'lock'}</span>${esc(b.title)}
    </span>`).join('');
}

const shortDate = iso => { try { return new Date(iso).toLocaleDateString('es', { dateStyle: 'medium' }); } catch (e) { return ''; } };

// Insignias: una por curso. Ganada (curso terminado, según el servidor) o bloqueada con su avance.
function courseBadgesHtml(items, earned) {
  const byId = new Map(earned.map(b => [b.course_id, b]));
  const list = [
    ...items.map(c => ({ id: c.id, title: c.title, percent: c.percent, badge: byId.get(c.id) })),
    ...earned.filter(b => !items.some(c => c.id === b.course_id)).map(b => ({ id: b.course_id, title: b.title, percent: 100, badge: b }))
  ];
  if (!list.length) return '<p class="text-xs text-muted col-span-full">Termina un curso para ganar tu primera insignia.</p>';
  return list.map(c => c.badge ? `
    <div class="flex flex-col items-center text-center gap-2 p-3 rounded-2xl border border-amber-200 bg-gradient-to-b from-amber-50 to-white" title="Curso terminado">
      <span class="relative w-14 h-14 rounded-2xl bg-term flex items-center justify-center ring-2 ring-amber-300 shadow-sm">
        <span class="material-symbols-outlined text-emerald-400 text-[28px]" aria-hidden="true">${esc(courseIcon(c.id))}</span>
        <span class="absolute -bottom-1.5 -right-1.5 w-6 h-6 rounded-full bg-amber-400 border-2 border-white flex items-center justify-center"><span class="material-symbols-outlined text-white text-[14px]" aria-hidden="true">workspace_premium</span></span>
      </span>
      <span class="text-[12px] font-bold text-ink leading-tight line-clamp-2">${esc(c.title)}</span>
      <span class="text-[10px] font-mono text-amber-800">${esc(shortDate(c.badge.completed_at))}</span>
    </div>` : `
    <div class="flex flex-col items-center text-center gap-2 p-3 rounded-2xl border border-line bg-bg/40" title="Termina el curso para ganar esta insignia">
      <span class="w-14 h-14 rounded-2xl bg-white border border-line flex items-center justify-center">
        <span class="material-symbols-outlined text-[#c4bfb6] text-[28px]" aria-hidden="true">${esc(courseIcon(c.id))}</span>
      </span>
      <span class="text-[12px] font-semibold text-muted leading-tight line-clamp-2">${esc(c.title)}</span>
      <span class="text-[10px] font-mono text-muted">${Number(c.percent) || 0}% · bloqueada</span>
    </div>`).join('');
}

// Rango (calculado en el servidor): chip en la cabecera y barra hasta el siguiente.
function paintRank(stats) {
  const v = rankView(stats);
  const chip = document.getElementById('profile-rank');
  const bar = document.getElementById('profile-rank-bar');
  if (!v || !chip || !bar) return;
  chip.className = `inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold border ${v.tone}`;
  chip.innerHTML = `<span class="material-symbols-outlined text-[14px]" aria-hidden="true">${esc(v.icon)}</span>${esc(v.name)}`;
  bar.innerHTML = `
    <div class="flex items-center justify-between gap-2 text-[11px] font-mono mb-1.5">
      <span class="text-slate-300"><strong class="text-white">${v.points}</strong> puntos</span>
      <span class="text-slate-400">${v.next ? `${v.remaining} para <strong class="text-slate-200">${esc(v.next)}</strong>` : 'Rango máximo'}</span>
    </div>
    <div class="h-1.5 rounded-full bg-white/10 overflow-hidden"><div class="h-full rounded-full bg-emerald-400 transition-all" style="width: ${v.pct}%"></div></div>`;
  bar.classList.remove('hidden');
}

// Resumen de la cabecera: número de cursos, terminados y progreso medio (anillo).
const RING = 169.6;
const average = items => (items.length ? Math.round(items.reduce((sum, c) => sum + c.percent, 0) / items.length) : 0);
const ringOffset = pct => (RING * (1 - pct / 100)).toFixed(1);

function summaryHtml(items) {
  const done = items.filter(c => c.done).length;
  return `<strong class="text-white">${items.length}</strong> ${items.length === 1 ? 'curso' : 'cursos'}${done ? ` · <strong class="text-emerald-300">${done}</strong> ${done === 1 ? 'terminado' : 'terminados'}` : ''}`;
}

function paintSummary(items) {
  const set = (id, fn) => { const el = document.getElementById(id); if (el) fn(el); };
  set('profile-summary', el => { el.innerHTML = summaryHtml(items); });
  set('profile-pct', el => { el.textContent = `${average(items)}%`; });
  set('profile-ring', el => { el.setAttribute('stroke-dashoffset', ringOffset(average(items))); });
}

// Cursos del alumno: [{ id, title, percent, done, draft }]
function myCoursesHtml(items) {
  if (!items.length) return '<p class="text-xs text-muted">Aún no tienes cursos. Mira el catálogo.</p>';
  return items.map(c => `
    <a href="#/aula-interactiva/${encodeURIComponent(c.id)}" class="flex items-center gap-3 p-2.5 -mx-1 rounded-xl hover:bg-bg transition-colors">
      <span class="flex-1 min-w-0 flex items-center gap-2">
        <span class="truncate text-[13px] font-semibold text-ink">${esc(c.title)}</span>
        ${c.draft ? '<span class="px-1.5 py-px rounded bg-amber-100 text-amber-900 text-[9px] font-mono font-bold shrink-0">BORRADOR</span>' : ''}
      </span>
      <span class="w-20 sm:w-28 bg-bg h-1.5 rounded-full overflow-hidden shrink-0" aria-hidden="true"><span class="block bg-accent h-full rounded-full" style="width: ${c.percent}%"></span></span>
      <span class="w-14 text-right text-[11px] font-mono font-bold shrink-0 ${c.done ? 'text-accent' : c.percent ? 'text-ink2' : 'text-muted'}">${c.done ? '✓' : c.percent ? `${c.percent}%` : 'Empezar'}</span>
    </a>`).join('');
}

export function renderPerfil(container) {
  const user = appState.session;
  const admin = isAdmin();
  const p = currentProgress();
  const steps = currentSteps();
  // Hasta que responda el servidor solo se conoce el curso de Nmap (su progreso está en el navegador).
  const initial = [{ id: COURSE.id, title: COURSE.title, percent: p.percent, done: p.complete }];

  container.innerHTML = `
    <div class="flex flex-col w-full py-4 sm:py-6 gap-4 max-w-2xl mx-auto">
      <section class="relative bg-term rounded-2xl border border-term-line overflow-hidden">
        <div class="absolute inset-0 opacity-[0.22] pointer-events-none profile-glow" aria-hidden="true"></div>
        <div class="relative p-5 flex items-center gap-4">
          <img src="${esc(avatarFor(user))}" alt="" referrerpolicy="no-referrer" class="w-16 h-16 rounded-2xl object-cover bg-term-2 ring-2 ring-emerald-500/30 shrink-0" />
          <div class="flex-1 min-w-0">
            <h1 class="text-lg sm:text-xl font-extrabold text-white tracking-tight leading-tight truncate">${esc(user.name)}</h1>
            <p class="text-[11px] text-slate-400 font-mono mt-0.5 truncate">${esc(user.email)}</p>
            <div class="flex items-center gap-x-3 gap-y-1.5 mt-2 font-mono text-[11px] flex-wrap">
              <span class="px-2 py-0.5 rounded-md font-bold ${admin ? 'bg-amber-400/15 text-amber-300 border border-amber-400/30' : 'bg-emerald-400/15 text-emerald-300 border border-emerald-400/30'}">${admin ? 'ADMIN' : 'ESTUDIANTE'}</span>
              <span id="profile-rank" class="hidden"></span>
              <span id="profile-summary" class="text-slate-400">${summaryHtml(initial)}</span>
              <span id="profile-streak" class="text-slate-400 hidden" title="Días seguidos con actividad"></span>
            </div>
          </div>
          <div class="relative shrink-0" title="Progreso medio de tus cursos">
            <svg class="w-[72px] h-[72px] -rotate-90" viewBox="0 0 64 64" aria-hidden="true">
              <circle cx="32" cy="32" r="27" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="6" />
              <circle cx="32" cy="32" r="27" fill="none" stroke="#34d399" stroke-width="6" stroke-linecap="round" stroke-dasharray="${RING}" stroke-dashoffset="${ringOffset(average(initial))}" class="progress-ring" id="profile-ring" />
            </svg>
            <span id="profile-pct" class="absolute inset-0 flex items-center justify-center text-base font-extrabold text-white">${average(initial)}%</span>
          </div>
        </div>
        <div id="profile-rank-bar" class="hidden relative px-5 pb-4" title="Puntos: 1 por cada % de avance en tus cursos y 150 por curso terminado"></div>
      </section>

      <div id="resume-card" class="hidden"></div>

      <section class="bg-surface p-4 sm:p-5 rounded-2xl border border-line">
        <div class="flex items-center justify-between gap-2 mb-2">
          <h2 class="text-sm font-bold text-ink">Mis cursos</h2>
          <a href="#/explorar-cursos" class="text-[11px] font-mono font-bold text-accent hover:underline shrink-0">Catálogo →</a>
        </div>
        <div id="profile-courses-list" class="flex flex-col gap-0.5">${myCoursesHtml(initial)}</div>
      </section>

      <section class="bg-surface p-4 sm:p-5 rounded-2xl border border-line">
        <div class="flex items-center justify-between gap-2 mb-3">
          <h2 id="badges-title" class="text-sm font-bold text-ink">Insignias</h2>
          <span class="text-[11px] font-mono text-muted shrink-0">Una por curso terminado</span>
        </div>
        <div id="course-badges" class="grid grid-cols-2 sm:grid-cols-3 gap-2.5">${courseBadgesHtml(initial, [])}</div>
        <div class="mt-4 pt-3 border-t border-line/60">
          <p class="text-[11px] font-mono text-muted mb-2">Logros del laboratorio de Nmap</p>
          <div id="achievements" class="flex flex-wrap gap-1.5">${achievementsHtml(steps, 0)}</div>
        </div>
      </section>

      ${admin ? '' : `
      <button type="button" data-action="open-messages" class="bg-surface p-4 rounded-2xl border border-line hover:border-accent/60 transition-colors flex items-center gap-3 text-left">
        <span class="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0"><span class="material-symbols-outlined text-accent" aria-hidden="true">mail</span></span>
        <span class="min-w-0 flex-1">
          <span class="block text-sm font-bold text-ink">Mensajes con el administrador</span>
          <span class="block text-xs text-muted">Sugerencias, dudas o problemas con tu acceso.</span>
        </span>
        <span class="material-symbols-outlined text-muted" aria-hidden="true">chevron_right</span>
      </button>`}

      <div class="grid grid-cols-2 gap-3">
        <button type="button" data-action="open-account" class="h-12 px-4 bg-surface hover:bg-bg rounded-2xl text-sm font-semibold border border-line hover:border-accent/60 transition-colors flex items-center justify-center gap-2 text-ink">
          <span class="material-symbols-outlined text-base text-accent" aria-hidden="true">insights</span><span>Habilidades<span class="hidden sm:inline"> y cuenta</span></span>
        </button>
        <button type="button" data-action="logout" class="h-12 px-4 bg-surface hover:bg-rose-50 text-rose-600 rounded-2xl text-sm font-semibold border border-line hover:border-rose-300 transition-colors flex items-center justify-center gap-2">
          <span class="material-symbols-outlined text-base" aria-hidden="true">logout</span><span>Cerrar sesión</span>
        </button>
      </div>
    </div>
  `;
  paintResume(document.getElementById('resume-card'));
  // La racha llega del servidor: se pinta cuando responde.
  fetchStreak().then(streak => {
    const el = document.getElementById('profile-streak');
    if (el && streak.current > 0) {
      el.innerHTML = `🔥 <strong class="text-white">${streak.current}</strong> ${streak.current === 1 ? 'día' : 'días'}`;
      el.classList.remove('hidden');
    }
    const row = document.getElementById('achievements');
    if (row) row.innerHTML = achievementsHtml(steps, streak.best);
  });
  // Cursos disponibles según el servidor (can_access_course: el admin los tiene todos) con su progreso.
  Promise.all([fetchAccessibleCourses(), fetchCourses(), fetchCourseProgress(), fetchUserStats().catch(() => null)]).then(([ids, courses, rows, stats]) => {
    const list = document.getElementById('profile-courses-list');
    if (!list || !Array.isArray(ids)) return;
    const items = courses.filter(c => ids.includes(c.id)).map(c => {
      if (c.id === COURSE.id) return { id: c.id, title: c.title, percent: p.percent, done: p.complete };
      const r = (rows || []).find(x => x.course_id === c.id);
      return { id: c.id, title: c.title, percent: r ? Number(r.progress_percentage) || 0 : 0, done: Boolean(r && r.completed_at), draft: !c.published };
    });
    list.innerHTML = myCoursesHtml(items);
    paintSummary(items);
    const earned = (stats && Array.isArray(stats.badges)) ? stats.badges : [];
    const badges = document.getElementById('course-badges');
    if (badges) badges.innerHTML = courseBadgesHtml(items, earned);
    const title = document.getElementById('badges-title');
    if (title) title.textContent = `Insignias · ${earned.length}`;
    paintRank(stats);
  }).catch(() => {});
}

export function openAccountDetails() {
  const user = appState.session;
  if (!user) return;
  const p = currentProgress();
  const studentId = user.sub ? 'STU-' + String(user.sub).slice(-8) : 'STU-LOCAL';
  const provider = user.mode === 'cloud' ? 'Google · verificada en servidor' : 'Google · modo local';
  const row = (label, value) => `
    <div class="flex items-center justify-between gap-3 py-2">
      <dt class="text-muted shrink-0">${label}</dt>
      <dd class="text-ink font-semibold truncate text-right">${esc(value)}</dd>
    </div>`;

  openDialog({
    title: 'Habilidades y cuenta',
    kicker: String(user.name || '').toUpperCase(), // openDialog lo pone con textContent
    body: `
      <div class="flex flex-col gap-5">
        <section class="flex flex-col gap-3">
          <h3 class="text-[11px] font-mono font-bold text-muted uppercase tracking-wide">Habilidades técnicas</h3>
          ${p.skills.map(s => `
            <div class="flex flex-col gap-1.5">
              <div class="flex items-center justify-between gap-2">
                <span class="text-[13px] font-semibold text-ink">${esc(s.name)}</span>
                <span class="font-mono text-[10px] text-accent font-bold shrink-0">${esc(s.level)}</span>
              </div>
              <div class="w-full bg-bg h-1.5 rounded-full overflow-hidden"><div class="bg-accent h-full rounded-full" style="width: ${s.pct}%;"></div></div>
            </div>`).join('')}
        </section>
        <section>
          <h3 class="text-[11px] font-mono font-bold text-muted uppercase tracking-wide mb-1">Cuenta y sesión</h3>
          <dl class="flex flex-col divide-y divide-line/60 text-xs font-mono">
            ${row('Correo', user.email)}
            ${row('Identificador', studentId)}
            ${row('Proveedor', provider)}
            ${row('Sesión iniciada', formatDate(user.loginAt))}
            ${p.complete ? row('Curso completado', formatDate((appState.progress[user.email] || {}).completedAt)) : ''}
          </dl>
        </section>
      </div>`
  });
}
