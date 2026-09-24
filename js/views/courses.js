/**
 * Vistas: Mis Cursos y Catálogo.
 */
import { esc } from '../lib/html.js';
import { appState } from '../state.js';
import { COURSE, COURSE_OBJECTIVES, COURSE_VIDEO, LAB_STEPS, NMAP_RESOURCES } from '../content.js';
import { TOTAL_LESSONS } from '../lab.js';
import { currentProgress } from '../progress.js';
import { openDialog } from '../ui.js';

const COURSES = [COURSE];
const TOTAL_LINKS = NMAP_RESOURCES.reduce((n, c) => n + c.items.length, 0);

function courseMeta(c) {
  const lessons = c.syllabus.reduce((n, m) => n + m.lessons.length, 0);
  return `${c.syllabus.length} módulos · ${lessons} lecciones · ${LAB_STEPS.length} labs · ${esc(c.duration)}`;
}

// Anillo de progreso (SVG) para la portada de la tarjeta.
function ringHtml(percent) {
  const c = 150.8; // 2πr con r = 24
  return `
    <span class="relative w-16 h-16 shrink-0">
      <svg class="w-16 h-16 -rotate-90" viewBox="0 0 56 56" aria-hidden="true">
        <circle cx="28" cy="28" r="24" fill="none" stroke="rgba(255,255,255,.12)" stroke-width="5" />
        <circle cx="28" cy="28" r="24" fill="none" stroke="#34d399" stroke-width="5" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${(c * (1 - percent / 100)).toFixed(1)}" />
      </svg>
      <span class="absolute inset-0 flex items-center justify-center text-sm font-extrabold text-white tabular-nums">${percent}%</span>
    </span>`;
}

export function renderMisCursos(container) {
  const user = appState.session;
  const firstName = String(user.name || '').split(' ')[0] || 'estudiante';
  const enrolled = COURSES.filter(c => appState.enabledCourses.includes(c.id));
  const p = currentProgress();
  const cta = p.complete ? 'Repasar' : p.percent > 0 ? 'Continuar' : 'Empezar';

  const tile = c => `
    <article class="min-w-0 bg-surface rounded-2xl border border-line hover:border-accent/60 overflow-hidden flex flex-col card-lift">
      <div class="relative bg-term px-4 py-4 flex items-center justify-between gap-3 overflow-hidden">
        <div class="absolute inset-0 opacity-[0.22] pointer-events-none profile-glow" aria-hidden="true"></div>
        <div class="relative flex flex-col gap-2 min-w-0">
          <span class="self-start px-2 py-0.5 rounded-md bg-emerald-400/15 text-emerald-300 border border-emerald-400/30 font-mono text-[10px] font-bold">${esc(c.categoryLabel)}</span>
          <span class="material-symbols-outlined text-emerald-400 text-3xl" aria-hidden="true">terminal</span>
        </div>
        <div class="relative">${ringHtml(p.percent)}</div>
      </div>
      <div class="p-4 flex flex-col gap-3 flex-1">
        <div class="flex flex-col gap-1">
          <h3 class="text-[15px] font-bold text-ink leading-snug line-clamp-2">${esc(c.title)}</h3>
          <p class="text-xs text-muted truncate">${p.complete ? '✓ Curso completado' : `Siguiente: ${esc(p.nextLesson.title)}`}</p>
        </div>
        <div class="flex items-center gap-3 text-[11px] font-mono text-muted">
          <span class="inline-flex items-center gap-1"><span class="material-symbols-outlined text-[14px]" aria-hidden="true">menu_book</span>${p.lessonsDone.length}/${TOTAL_LESSONS}</span>
          <span class="inline-flex items-center gap-1"><span class="material-symbols-outlined text-[14px]" aria-hidden="true">science</span>${p.labsDone.length}/${LAB_STEPS.length} labs</span>
          <span class="inline-flex items-center gap-1"><span class="material-symbols-outlined text-[14px] text-rose-500" aria-hidden="true">smart_display</span>Video</span>
        </div>
        <div class="mt-auto flex items-center gap-2">
          <a href="#/aula-interactiva/${esc(c.id)}" class="flex-1 h-10 bg-accent hover:bg-accent2 text-white rounded-xl text-[13px] font-semibold transition-colors inline-flex items-center justify-center gap-1.5">
            <span class="material-symbols-outlined text-[18px]" aria-hidden="true">play_arrow</span><span>${cta}</span>
          </a>
          <button type="button" data-action="open-course" data-id="${esc(c.id)}" class="h-10 px-3 rounded-xl bg-white border border-line hover:border-accent/60 text-xs font-semibold text-ink transition-colors" title="Ver temario">Temario</button>
        </div>
      </div>
    </article>`;

  const exploreTile = `
    <a href="#/explorar-cursos" class="rounded-2xl border-2 border-dashed border-line hover:border-accent/60 hover:bg-surface/60 flex flex-col items-center justify-center gap-2 p-6 min-h-[220px] text-center text-muted hover:text-accent transition-colors">
      <span class="material-symbols-outlined text-3xl" aria-hidden="true">add_circle</span>
      <span class="text-sm font-semibold">Explorar catálogo</span>
      <span class="text-[11px]">Más cursos próximamente</span>
    </a>`;

  container.innerHTML = `
    <div class="flex flex-col w-full py-4 sm:py-6 gap-5 max-w-5xl mx-auto">
      <section class="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <p class="text-[11px] font-mono text-muted">MIS CURSOS</p>
          <h1 class="text-xl sm:text-2xl font-extrabold text-ink tracking-tight">Hola, ${esc(firstName)} 👋</h1>
        </div>
        <div class="flex items-center gap-2 font-mono text-[11px]">
          <span class="px-2.5 py-1 rounded-lg bg-surface border border-line"><strong class="text-accent">${p.percent}%</strong> <span class="text-muted">progreso</span></span>
          <span class="px-2.5 py-1 rounded-lg bg-surface border border-line"><strong class="text-ink">${p.labsDone.length}/${LAB_STEPS.length}</strong> <span class="text-muted">labs</span></span>
        </div>
      </section>

      <section class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        ${enrolled.length ? enrolled.map(tile).join('') : `
          <div class="p-6 bg-surface rounded-2xl border border-line text-center text-sm text-muted sm:col-span-2 lg:col-span-3">
            No tienes cursos habilitados. <a href="#/explorar-cursos" class="text-accent font-semibold hover:underline">Ver catálogo</a>
          </div>`}
        ${enrolled.length ? exploreTile : ''}
      </section>
    </div>
  `;
}

export function renderExplorar(container) {
  const tile = c => {
    const enrolled = appState.enabledCourses.includes(c.id);
    const lessons = c.syllabus.reduce((n, m) => n + m.lessons.length, 0);
    return `
      <article class="min-w-0 bg-surface rounded-2xl border border-line hover:border-accent/60 overflow-hidden flex flex-col card-lift">
        <div class="relative bg-term px-4 py-4 flex items-start justify-between gap-3 overflow-hidden">
          <div class="absolute inset-0 opacity-[0.22] pointer-events-none profile-glow" aria-hidden="true"></div>
          <div class="relative flex flex-col gap-2 min-w-0">
            <span class="self-start px-2 py-0.5 rounded-md bg-emerald-400/15 text-emerald-300 border border-emerald-400/30 font-mono text-[10px] font-bold">${esc(c.categoryLabel)}</span>
            <span class="material-symbols-outlined text-emerald-400 text-3xl" aria-hidden="true">terminal</span>
          </div>
          <span class="relative px-2 py-0.5 rounded-md bg-white/10 text-slate-200 font-mono text-[10px] shrink-0">${esc(c.duration)}</span>
        </div>
        <div class="p-4 flex flex-col gap-3 flex-1">
          <div class="flex flex-col gap-1">
            <h3 class="text-[15px] font-bold text-ink leading-snug line-clamp-2">${esc(c.title)}</h3>
            <p class="text-xs text-muted leading-relaxed line-clamp-2">${esc(c.description)}</p>
          </div>
          <div class="flex items-center gap-3 text-[11px] font-mono text-muted flex-wrap">
            <span class="inline-flex items-center gap-1"><span class="material-symbols-outlined text-[14px]" aria-hidden="true">menu_book</span>${lessons} lecciones</span>
            <span class="inline-flex items-center gap-1"><span class="material-symbols-outlined text-[14px]" aria-hidden="true">science</span>${LAB_STEPS.length} labs</span>
            <span class="inline-flex items-center gap-1"><span class="material-symbols-outlined text-[14px] text-rose-500" aria-hidden="true">smart_display</span>Video</span>
          </div>
          <div class="mt-auto flex items-center gap-2">
            ${enrolled
              ? `<a href="#/aula-interactiva/${esc(c.id)}" class="flex-1 h-10 bg-accent hover:bg-accent2 text-white rounded-xl text-[13px] font-semibold transition-colors inline-flex items-center justify-center gap-1.5">
                   <span class="material-symbols-outlined text-[18px]" aria-hidden="true">play_arrow</span><span>Ir al aula</span>
                 </a>
                 <button type="button" data-action="open-course" data-id="${esc(c.id)}" class="h-10 px-3 rounded-xl bg-white border border-line hover:border-accent/60 text-xs font-semibold text-ink transition-colors">Temario</button>`
              : `<button type="button" data-action="open-course" data-id="${esc(c.id)}" class="flex-1 h-10 rounded-xl bg-white border border-line hover:border-accent/60 text-[13px] font-semibold text-ink transition-colors">Ver temario</button>`}
          </div>
        </div>
      </article>`;
  };

  const soonTile = `
    <div class="rounded-2xl border-2 border-dashed border-line flex flex-col items-center justify-center gap-2 p-6 min-h-[220px] text-center text-muted">
      <span class="material-symbols-outlined text-3xl" aria-hidden="true">hourglass_top</span>
      <span class="text-sm font-semibold">Más cursos próximamente</span>
      <span class="text-[11px]">Ciberseguridad e inteligencia artificial</span>
    </div>`;

  container.innerHTML = `
    <div class="flex flex-col w-full py-4 sm:py-6 gap-5 max-w-5xl mx-auto">
      <section class="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <p class="text-[11px] font-mono text-muted">CATÁLOGO</p>
          <h1 class="text-xl sm:text-2xl font-extrabold text-ink tracking-tight">Explorar cursos</h1>
        </div>
        <div class="flex items-center gap-2 font-mono text-[11px]">
          <span class="px-2.5 py-1 rounded-lg bg-surface border border-line"><strong class="text-ink">${COURSES.length}</strong> <span class="text-muted">${COURSES.length === 1 ? 'curso' : 'cursos'}</span></span>
          <span class="px-2.5 py-1 rounded-lg bg-surface border border-line"><strong class="text-ink">${TOTAL_LINKS}</strong> <span class="text-muted">recursos</span></span>
        </div>
      </section>

      <section class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        ${COURSES.map(tile).join('')}
        ${soonTile}
      </section>
    </div>
  `;
}

export function openCourseDetail(courseId) {
  const course = COURSES.find(c => c.id === courseId) || COURSE;
  const enrolled = appState.enabledCourses.includes(course.id);
  openDialog({
    title: course.title,
    kicker: `${course.categoryLabel} · ${course.duration}`,
    body: `
      <div class="flex flex-col gap-4">
        <p class="text-[13px] leading-relaxed">${esc(course.description)}</p>
        <div>
          <p class="text-[11px] font-mono font-bold text-muted uppercase tracking-wide mb-2">Qué aprenderás</p>
          <ul class="flex flex-col gap-1.5 text-[13px]">
            ${COURSE_OBJECTIVES.map(o => `<li class="flex gap-2"><span class="material-symbols-outlined text-[16px] text-accent mt-px shrink-0" aria-hidden="true">check_circle</span><span>${esc(o)}</span></li>`).join('')}
          </ul>
        </div>
        <div>
          <p class="text-[11px] font-mono font-bold text-muted uppercase tracking-wide mb-2">Temario</p>
          <ol class="flex flex-col gap-1.5">
            ${course.syllabus.map((m, i) => `
              <li class="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-bg/70 border border-line/70 text-xs">
                <span class="flex items-center gap-2 min-w-0"><span class="w-5 h-5 rounded-md bg-accent text-white text-[10px] font-bold flex items-center justify-center shrink-0">${i + 1}</span><span class="truncate font-semibold text-ink">${esc(m.module.replace(/^Módulo \d+:\s*/, ''))}</span></span>
                <span class="font-mono text-[10px] text-muted shrink-0">${m.lessons.length} lecciones</span>
              </li>`).join('')}
          </ol>
        </div>
        <p class="text-[11px] font-mono text-muted">${courseMeta(course)} · Video en español de ${esc(COURSE_VIDEO.author)}</p>
        ${enrolled ? `<a href="#/aula-interactiva/${esc(course.id)}" class="h-10 bg-accent hover:bg-accent2 text-white rounded-xl text-[13px] font-semibold inline-flex items-center justify-center gap-1.5"><span class="material-symbols-outlined text-[18px]" aria-hidden="true">play_arrow</span>Ir al aula</a>` : ''}
      </div>`
  });
}
