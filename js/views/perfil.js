/**
 * Vista: Perfil del alumno (resumen) + ventana con habilidades y datos de la cuenta.
 */
import { esc } from '../lib/html.js';
import { appState } from '../state.js';
import { LAB_STEPS } from '../content.js';
import { isLabDone, TOTAL_LESSONS } from '../lab.js';
import { currentProgress, currentSteps } from '../progress.js';
import { avatarFor, openDialog } from '../ui.js';
import { isAdmin } from '../auth.js';

function formatDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' });
  } catch (e) {
    return '—';
  }
}

export function renderPerfil(container) {
  const user = appState.session;
  const admin = isAdmin();
  const p = currentProgress();
  const steps = currentSteps();
  const ring = 169.6;

  const labsHtml = LAB_STEPS.map(lab => {
    const done = isLabDone(lab, steps);
    return `
      <li class="flex items-center gap-3 py-2.5">
        <span class="material-symbols-outlined text-[20px] shrink-0 ${done ? 'text-accent' : 'text-[#b6b2a9]'}" aria-hidden="true">${done ? 'check_circle' : lab.icon}</span>
        <span class="flex-1 min-w-0 text-[13px] font-semibold ${done ? 'text-accent' : 'text-ink'} truncate">${esc(lab.title)}</span>
        <span class="text-[10px] font-mono font-bold shrink-0 px-2 py-0.5 rounded-full ${done ? 'bg-accent text-white' : 'bg-bg text-muted border border-line'}">${done ? 'HECHO' : 'PENDIENTE'}</span>
      </li>`;
  }).join('');

  container.innerHTML = `
    <div class="flex flex-col w-full py-4 sm:py-6 gap-4 max-w-2xl mx-auto">
      <section class="relative bg-term rounded-2xl border border-term-line overflow-hidden">
        <div class="absolute inset-0 opacity-[0.22] pointer-events-none profile-glow" aria-hidden="true"></div>
        <div class="relative p-5 flex items-center gap-4">
          <img src="${esc(avatarFor(user))}" alt="" referrerpolicy="no-referrer" class="w-16 h-16 rounded-2xl object-cover bg-term-2 ring-2 ring-emerald-500/30 shrink-0" />
          <div class="flex-1 min-w-0">
            <h1 class="text-lg sm:text-xl font-extrabold text-white tracking-tight leading-tight truncate">${esc(user.name)}</h1>
            <p class="text-[11px] text-slate-400 font-mono mt-0.5 truncate">${esc(user.email)}</p>
            <div class="flex items-center gap-3 mt-2 font-mono text-[11px]">
              <span class="px-2 py-0.5 rounded-md font-bold ${admin ? 'bg-amber-400/15 text-amber-300 border border-amber-400/30' : 'bg-emerald-400/15 text-emerald-300 border border-emerald-400/30'}">${admin ? 'ADMIN' : 'ESTUDIANTE'}</span>
              <span class="text-slate-400"><strong class="text-white">${p.lessonsDone.length}</strong>/${TOTAL_LESSONS} lecciones</span>
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

      <section class="bg-surface px-4 sm:px-5 py-3 rounded-2xl border border-line">
        <div class="flex items-center justify-between gap-2 pt-1">
          <h2 class="text-sm font-bold text-ink">Laboratorios · ${p.labsDone.length}/${LAB_STEPS.length}</h2>
          <a href="#/aula-interactiva/pentesting-101" class="text-[11px] font-mono font-bold text-accent hover:underline shrink-0">Ir al aula →</a>
        </div>
        <ul class="flex flex-col divide-y divide-line/60">${labsHtml}</ul>
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
