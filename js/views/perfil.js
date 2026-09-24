/**
 * Vista: Perfil del alumno (resumen) + ventana con habilidades y datos de la cuenta.
 */
import { esc } from '../lib/html.js';
import { appState } from '../state.js';
import { TOTAL_LESSONS } from '../lab.js';
import { currentProgress, currentSteps, fetchStreak } from '../progress.js';
import { computeBadges } from '../lib/badges.js';
import { avatarFor, openDialog } from '../ui.js';
import { isAdmin } from '../auth.js';
import { fetchOwnCompletions } from '../cloud.js';

function formatDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' });
  } catch (e) {
    return '—';
  }
}

function badgesHtml(steps, bestStreak) {
  return computeBadges(steps, { bestStreak }).map(b => `
    <div class="flex flex-col items-center text-center gap-1.5 p-2.5 rounded-xl border ${b.earned ? 'border-emerald-200 bg-emerald-50/60' : 'border-line bg-bg/50'}" title="${esc(b.desc)}">
      <span class="w-10 h-10 rounded-full flex items-center justify-center ${b.earned ? 'bg-accent text-white' : 'bg-white text-[#c4bfb6] border border-line'}">
        <span class="material-symbols-outlined text-[20px]" aria-hidden="true">${b.earned ? esc(b.icon) : 'lock'}</span>
      </span>
      <span class="text-[11px] font-semibold leading-tight ${b.earned ? 'text-ink' : 'text-muted'}">${esc(b.title)}</span>
    </div>`).join('');
}

function paintBadgeCount(steps, bestStreak) {
  const title = document.getElementById('badges-title');
  if (!title) return;
  const all = computeBadges(steps, { bestStreak });
  title.textContent = `Insignias · ${all.filter(b => b.earned).length}/${all.length}`;
}

export function renderPerfil(container) {
  const user = appState.session;
  const admin = isAdmin();
  const p = currentProgress();
  const steps = currentSteps();
  const ring = 169.6;


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
              <span class="text-slate-400"><strong class="text-white">${p.lessonsDone.length}</strong>/${TOTAL_LESSONS} lecciones</span>
              <span id="profile-streak" class="text-slate-400 hidden" title="Días seguidos con actividad"></span>
              <span id="profile-completed" class="hidden px-2 py-0.5 rounded-md bg-emerald-400/15 text-emerald-300 border border-emerald-400/30 font-bold"></span>
            </div>
          </div>
          <div class="relative shrink-0">
            <svg class="w-[72px] h-[72px] -rotate-90" viewBox="0 0 64 64" aria-hidden="true">
              <circle cx="32" cy="32" r="27" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="6" />
              <circle cx="32" cy="32" r="27" fill="none" stroke="#34d399" stroke-width="6" stroke-linecap="round" stroke-dasharray="${ring}" stroke-dashoffset="${(ring * (1 - p.percent / 100)).toFixed(1)}" class="progress-ring" />
            </svg>
            <span class="absolute inset-0 flex items-center justify-center text-base font-extrabold text-white">${p.percent}%</span>
          </div>
        </div>
      </section>

      <section class="bg-surface p-4 sm:p-5 rounded-2xl border border-line">
        <div class="flex items-center justify-between gap-2 mb-3">
          <h2 id="badges-title" class="text-sm font-bold text-ink">Insignias</h2>
          <a href="#/aula-interactiva/pentesting-101" class="text-[11px] font-mono font-bold text-accent hover:underline shrink-0">Ir al aula →</a>
        </div>
        <div id="badges-grid" class="grid grid-cols-2 sm:grid-cols-4 gap-2.5">${badgesHtml(steps, 0)}</div>
      </section>

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
  paintBadgeCount(steps, 0);
  // La racha llega del servidor: se pinta cuando responde.
  fetchStreak().then(streak => {
    const el = document.getElementById('profile-streak');
    if (el && streak.current > 0) {
      el.innerHTML = `🔥 <strong class="text-white">${streak.current}</strong> ${streak.current === 1 ? 'día' : 'días'}`;
      el.classList.remove('hidden');
    }
    const grid = document.getElementById('badges-grid');
    if (grid) grid.innerHTML = badgesHtml(steps, streak.best);
    paintBadgeCount(steps, streak.best);
  });
  // Curso terminado según el registro del servidor (course_completions).
  fetchOwnCompletions().then(list => {
    const done = list.find(c => c.course_id === 'pentesting-101');
    const el = document.getElementById('profile-completed');
    if (!done || !el) return;
    el.textContent = '✓ Curso terminado';
    el.title = `Terminado el ${formatDate(done.completed_at)}`;
    el.classList.remove('hidden');
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
