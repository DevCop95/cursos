/**
 * Vistas: Mis Cursos y Catálogo.
 */
import { esc } from '../lib/html.js?v=dev101x-v48';
import { appState } from '../state.js?v=dev101x-v48';
import { COURSE, COURSE_OBJECTIVES, COURSE_VIDEO, LAB_STEPS, NMAP_RESOURCES } from '../content.js?v=dev101x-v48';
import { TOTAL_LESSONS } from '../lab.js?v=dev101x-v48';
import { currentProgress, fetchStreak } from '../progress.js?v=dev101x-v48';
import { fetchCourses, fetchCourseProgress, fetchCourseContent } from '../cloud.js?v=dev101x-v48';
import { computeCourseProgress } from '../lib/course-engine.js?v=dev101x-v48';
import { openDialog } from '../ui.js?v=dev101x-v48';
import { UPCOMING } from '../lib/upcoming.js?v=dev101x-v48';

const COURSES = [COURSE];
// Contenido de los cursos de pago ya descargado (solo llega si el servidor da acceso).
const dbContent = new Map();
// Filas de la tabla courses (con la ficha pública `summary`, que ven también quienes no tienen acceso).
const dbCourses = new Map();

// Ficha común de un curso de la base de datos: del contenido si hay acceso, si no de `summary`.
function dbInfo(id) {
  const row = dbCourses.get(id) || {};
  const sum = row.summary || {};
  const c = dbContent.get(id);
  if (c) {
    return {
      title: c.title || row.title, category: c.categoryLabel, duration: c.duration, description: c.description,
      objectives: c.objectives || [], labs: (c.labs || []).length, videoAuthor: c.video && c.video.author,
      modules: (c.syllabus || []).map(m => ({ title: m.module, lessons: m.lessons.length })),
      lessons: (c.syllabus || []).reduce((n, m) => n + m.lessons.length, 0)
    };
  }
  return {
    title: row.title, category: sum.category, duration: sum.duration, description: sum.description,
    objectives: sum.objectives || [], labs: Number(sum.labs) || 0, videoAuthor: sum.video_author,
    modules: sum.modules || [], lessons: Number(sum.lessons) || 0
  };
}
const rememberCourses = list => (list || []).forEach(c => dbCourses.set(c.id, c));
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

// Tarjeta de un curso de pago (contenido en Supabase) en Mis Cursos: misma forma que la de Nmap.
function dbTile(c, progress, content) {
  const steps = (progress && progress.steps) || {};
  const p = content ? computeCourseProgress(content, steps) : null;
  const pct = p ? p.percent : (progress ? Number(progress.progress_percentage) || 0 : 0);
  const cta = pct === 100 ? 'Repasar' : pct > 0 ? 'Continuar' : 'Empezar';
  const labs = content && Array.isArray(content.labs) ? content.labs.length : 0;
  return `
    <article class="min-w-0 bg-surface rounded-2xl border border-line hover:border-accent/60 overflow-hidden flex flex-col card-lift">
      <div class="relative bg-term px-4 py-4 flex items-center justify-between gap-3 overflow-hidden">
        <div class="absolute inset-0 opacity-[0.22] pointer-events-none profile-glow" aria-hidden="true"></div>
        <div class="relative flex flex-col gap-2 min-w-0">
          <span class="flex items-center gap-1.5 flex-wrap">
            ${content && content.categoryLabel ? `<span class="px-2 py-0.5 rounded-md bg-emerald-400/15 text-emerald-300 border border-emerald-400/30 font-mono text-[10px] font-bold">${esc(content.categoryLabel)}</span>` : ''}
            <span class="px-2 py-0.5 rounded-md bg-amber-400/15 text-amber-300 border border-amber-400/30 font-mono text-[10px] font-bold">${c.is_free ? 'GRATIS' : 'PREMIUM'}</span>
          </span>
          <span class="material-symbols-outlined text-emerald-400 text-3xl" aria-hidden="true">code</span>
        </div>
        <div class="relative">${ringHtml(pct)}</div>
      </div>
      <div class="p-4 flex flex-col gap-3 flex-1">
        <div class="flex flex-col gap-1">
          <h3 class="text-[15px] font-bold text-ink leading-snug line-clamp-2">${esc(c.title)}</h3>
          ${p ? `<p class="text-xs text-muted truncate">${p.complete ? '✓ Curso completado' : `Siguiente: ${esc(p.nextLesson.title)}`}</p>` : ''}
        </div>
        ${p ? `
        <div class="flex items-center gap-3 text-[11px] font-mono text-muted">
          <span class="inline-flex items-center gap-1"><span class="material-symbols-outlined text-[14px]" aria-hidden="true">menu_book</span>${p.lessonsDone.length}/${p.lessons.length}</span>
          ${labs ? `<span class="inline-flex items-center gap-1" title="Laboratorios superados"><span class="material-symbols-outlined text-[14px]" aria-hidden="true">science</span>${p.labsDone.length}/${labs} labs</span>` : ''}
          ${content.video ? '<span class="inline-flex items-center gap-1"><span class="material-symbols-outlined text-[14px] text-rose-500" aria-hidden="true">smart_display</span>Video</span>' : ''}
        </div>` : ''}
        <div class="mt-auto flex items-center gap-2">
          <a href="#/aula-interactiva/${esc(c.id)}" class="flex-1 h-10 bg-accent hover:bg-accent2 text-white rounded-xl text-[13px] font-semibold transition-colors inline-flex items-center justify-center gap-1.5">
            <span class="material-symbols-outlined text-[18px]" aria-hidden="true">play_arrow</span><span>${cta}</span>
          </a>
          ${content ? `<button type="button" data-action="open-db-course" data-id="${esc(c.id)}" class="h-10 px-3 rounded-xl bg-white border border-line hover:border-accent/60 text-xs font-semibold text-ink transition-colors" title="Ver temario">Temario</button>` : ''}
        </div>
      </div>
    </article>`;
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
          <span class="inline-flex items-center gap-1" title="Laboratorios superados"><span class="material-symbols-outlined text-[14px]" aria-hidden="true">science</span>${p.labsDone.length}/${LAB_STEPS.length} labs</span>
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
          <span class="px-2.5 py-1 rounded-lg bg-surface border border-line"><strong id="stat-courses" class="text-ink">${enrolled.length}</strong> <span class="text-muted">cursos</span></span>
          <span class="px-2.5 py-1 rounded-lg bg-surface border border-line"><strong id="stat-done" class="text-accent">${p.complete ? 1 : 0}</strong> <span class="text-muted">terminados</span></span>
          <span id="streak-chip" class="hidden px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-900" title="Días seguidos con actividad"></span>
        </div>
      </section>

      <section id="my-courses-grid" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        ${enrolled.length ? enrolled.map(tile).join('') : `
          <div class="p-6 bg-surface rounded-2xl border border-line text-center text-sm text-muted sm:col-span-2 lg:col-span-3">
            No tienes cursos habilitados. <a href="#/explorar-cursos" class="text-accent font-semibold hover:underline">Ver catálogo</a>
          </div>`}
        ${enrolled.length ? exploreTile : ''}
      </section>
    </div>
  `;  // Cursos de pago (contenido en Supabase) a los que el alumno tiene acceso.
  Promise.all([fetchCourses(), fetchCourseProgress().catch(() => [])]).then(([courses, progress]) => {
    rememberCourses(courses);
    const grid = document.getElementById('my-courses-grid');
    if (!grid) return;
    const mine = courses.filter(c => c.has_content && !COURSES.some(l => l.id === c.id) && appState.enabledCourses.includes(c.id));
    if (!mine.length) return null;
    return Promise.all(mine.map(c => dbContent.has(c.id)
      ? dbContent.get(c.id)
      : fetchCourseContent(c.id).then(ct => { if (ct) dbContent.set(c.id, ct); return ct; }).catch(() => null)
    )).then(contents => {
      const grid2 = document.getElementById('my-courses-grid');
      if (!grid2) return;
      const explore = grid2.querySelector('a[href="#/explorar-cursos"]');
      const html = mine.map((c, i) => dbTile(c, (progress || []).find(r => r.course_id === c.id), contents[i])).join('');
      if (explore) explore.insertAdjacentHTML('beforebegin', html);
      else grid2.insertAdjacentHTML('beforeend', html);
      const add = (id, n) => { const el = document.getElementById(id); if (el) el.textContent = String(Number(el.textContent) + n); };
      add('stat-courses', mine.length);
      add('stat-done', mine.filter(c => ((progress || []).find(r => r.course_id === c.id) || {}).completed_at).length);
    });
  }).catch(() => {});
  fetchStreak().then(streak => {
    const chip = document.getElementById('streak-chip');
    if (!chip || streak.current < 1) return;
    chip.innerHTML = `🔥 <strong>${streak.current}</strong> ${streak.current === 1 ? 'día' : 'días'}`;
    chip.classList.remove('hidden');
  });
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
            <span class="inline-flex items-center gap-1" title="Laboratorios prácticos"><span class="material-symbols-outlined text-[14px]" aria-hidden="true">science</span>${LAB_STEPS.length} labs</span>
            <span class="inline-flex items-center gap-1"><span class="material-symbols-outlined text-[14px] text-rose-500" aria-hidden="true">smart_display</span>Video</span>
          </div>
          <div class="mt-auto flex items-center gap-2">
            ${enrolled
              ? `<a href="#/aula-interactiva/${esc(c.id)}" class="flex-1 h-10 bg-accent hover:bg-accent2 text-white rounded-xl text-[13px] font-semibold transition-colors inline-flex items-center justify-center gap-1.5">
                   <span class="material-symbols-outlined text-[18px]" aria-hidden="true">play_arrow</span><span>Ir al aula</span>
                 </a>
                 <button type="button" data-action="open-course" data-id="${esc(c.id)}" class="h-10 px-3 rounded-xl bg-white border border-line hover:border-accent/60 text-xs font-semibold text-ink transition-colors">Temario</button>`
              : `<span class="flex-1 h-10 rounded-xl bg-bg border border-line text-[13px] font-semibold text-muted inline-flex items-center justify-center gap-1.5" title="Pide acceso al administrador"><span class="material-symbols-outlined text-[18px]" aria-hidden="true">lock</span>Requiere acceso</span>
                 <button type="button" data-action="open-course" data-id="${esc(c.id)}" class="h-10 px-3 rounded-xl bg-white border border-line hover:border-accent/60 text-xs font-semibold text-ink transition-colors">Temario</button>`}
          </div>
        </div>
      </article>`;
  };

  // Cursos del catálogo guardados en Supabase: misma tarjeta que Nmap, con la ficha pública.
  const upcomingTile = c => {
    if (!c.has_content) return soonDbTile(c);
    const ok = appState.enabledCourses.includes(c.id);
    const info = dbInfo(c.id);
    return `
      <article class="min-w-0 bg-surface rounded-2xl border border-line hover:border-accent/60 overflow-hidden flex flex-col card-lift">
        <div class="relative bg-term px-4 py-4 flex items-start justify-between gap-3 overflow-hidden">
          <div class="absolute inset-0 opacity-[0.22] pointer-events-none profile-glow" aria-hidden="true"></div>
          <div class="relative flex flex-col gap-2 min-w-0">
            <span class="flex items-center gap-1.5 flex-wrap">
              ${info.category ? `<span class="px-2 py-0.5 rounded-md bg-emerald-400/15 text-emerald-300 border border-emerald-400/30 font-mono text-[10px] font-bold">${esc(info.category)}</span>` : ''}
              <span class="px-2 py-0.5 rounded-md bg-amber-400/15 text-amber-300 border border-amber-400/30 font-mono text-[10px] font-bold">${c.is_free ? 'GRATIS' : 'PREMIUM'}</span>
            </span>
            <span class="material-symbols-outlined text-emerald-400 text-3xl" aria-hidden="true">code</span>
          </div>
          ${info.duration ? `<span class="relative px-2 py-0.5 rounded-md bg-white/10 text-slate-200 font-mono text-[10px] shrink-0">${esc(info.duration)}</span>` : ''}
        </div>
        <div class="p-4 flex flex-col gap-3 flex-1">
          <div class="flex flex-col gap-1">
            <h3 class="text-[15px] font-bold text-ink leading-snug line-clamp-2">${esc(info.title)}</h3>
            ${info.description ? `<p class="text-xs text-muted leading-relaxed line-clamp-2">${esc(info.description)}</p>` : ''}
          </div>
          <div class="flex items-center gap-3 text-[11px] font-mono text-muted flex-wrap">
            ${info.lessons ? `<span class="inline-flex items-center gap-1"><span class="material-symbols-outlined text-[14px]" aria-hidden="true">menu_book</span>${info.lessons} lecciones</span>` : ''}
            ${info.labs ? `<span class="inline-flex items-center gap-1" title="Laboratorios prácticos"><span class="material-symbols-outlined text-[14px]" aria-hidden="true">science</span>${info.labs} labs</span>` : ''}
            ${info.videoAuthor ? '<span class="inline-flex items-center gap-1"><span class="material-symbols-outlined text-[14px] text-rose-500" aria-hidden="true">smart_display</span>Video</span>' : ''}
          </div>
          <div class="mt-auto flex items-center gap-2">
            ${ok
              ? `<a href="#/aula-interactiva/${esc(c.id)}" class="flex-1 h-10 bg-accent hover:bg-accent2 text-white rounded-xl text-[13px] font-semibold transition-colors inline-flex items-center justify-center gap-1.5"><span class="material-symbols-outlined text-[18px]" aria-hidden="true">play_arrow</span><span>Ir al aula</span></a>`
              : `<span class="flex-1 h-10 rounded-xl bg-bg border border-line text-[13px] font-semibold text-muted inline-flex items-center justify-center gap-1.5" title="Pide acceso al administrador"><span class="material-symbols-outlined text-[18px]" aria-hidden="true">lock</span>Requiere acceso</span>`}
            ${info.modules.length ? `<button type="button" data-action="open-db-course" data-id="${esc(c.id)}" class="h-10 px-3 rounded-xl bg-white border border-line hover:border-accent/60 text-xs font-semibold text-ink transition-colors">Temario</button>` : ''}
          </div>
        </div>
      </article>`;
  };
  const soonDbTile = c => `
    <article class="min-w-0 rounded-2xl border border-line bg-surface/70 flex flex-col gap-3 p-4 min-h-[220px]">
      <div class="flex items-center justify-between gap-2">
        <span class="px-2 py-0.5 rounded-md font-mono text-[10px] font-bold ${c.is_free ? 'bg-emerald-50 text-accent border border-emerald-200' : 'bg-amber-50 text-amber-900 border border-amber-200'}">${c.is_free ? 'GRATIS' : 'ACCESO TOTAL'}</span>
        <span class="material-symbols-outlined text-[20px] text-muted" aria-hidden="true">hourglass_top</span>
      </div>
      <h3 class="text-[15px] font-bold text-ink leading-snug line-clamp-2">${esc(c.title)}</h3>
      <p class="mt-auto text-xs text-muted">Próximamente</p>
    </article>`;

  // Próximo lanzamiento: misma tarjeta que los demás, con el icono de la herramienta y sin botón de acceso.
  const soonTile = `
    <article class="min-w-0 bg-surface rounded-2xl border border-line overflow-hidden flex flex-col">
      <div class="relative bg-term px-4 py-4 flex items-start justify-between gap-3 overflow-hidden">
        <div class="absolute inset-0 opacity-[0.22] pointer-events-none profile-glow" aria-hidden="true"></div>
        <div class="relative flex flex-col gap-2 min-w-0">
          <span class="self-start px-2 py-0.5 rounded-md bg-rose-400/15 text-rose-300 border border-rose-400/30 font-mono text-[10px] font-bold">PRÓXIMO LANZAMIENTO</span>
          <img src="${UPCOMING.icon}" alt="" width="30" height="30" class="w-[30px] h-[30px] rounded-md" loading="lazy" />
        </div>
      </div>
      <div class="p-4 flex flex-col gap-3 flex-1">
        <div class="flex flex-col gap-1">
          <h3 class="text-[15px] font-bold text-ink leading-snug line-clamp-2">${esc(UPCOMING.title)}</h3>
          <p class="text-xs text-muted leading-relaxed line-clamp-2">${esc(UPCOMING.description)}</p>
        </div>
        <span class="mt-auto h-10 rounded-xl bg-bg border border-line text-[13px] font-semibold text-muted inline-flex items-center justify-center gap-1.5"><span class="material-symbols-outlined text-[18px]" aria-hidden="true">hourglass_top</span>Próximamente</span>
      </div>
    </article>`;

  container.innerHTML = `
    <div class="flex flex-col w-full py-4 sm:py-6 gap-5 max-w-5xl mx-auto">
      <section class="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <p class="text-[11px] font-mono text-muted">CATÁLOGO</p>
          <h1 class="text-xl sm:text-2xl font-extrabold text-ink tracking-tight">Explorar cursos</h1>
        </div>
        <div class="flex items-center gap-2 font-mono text-[11px]">
          <span id="catalog-count" class="px-2.5 py-1 rounded-lg bg-surface border border-line"><strong class="text-ink">${COURSES.length}</strong> <span class="text-muted">${COURSES.length === 1 ? 'curso' : 'cursos'}</span></span>
          <span class="px-2.5 py-1 rounded-lg bg-surface border border-line"><strong class="text-ink">${TOTAL_LINKS}</strong> <span class="text-muted">recursos</span></span>
        </div>
      </section>

      <section id="catalog-grid" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        ${COURSES.map(tile).join('')}
        ${soonTile}
      </section>
    </div>
  `;
  // El catálogo real está en Supabase: añade los cursos que aún no tienen contenido.
  fetchCourses().then(list => {
    rememberCourses(list);
    const grid = document.getElementById('catalog-grid');
    if (!grid) return;
    const upcoming = list.filter(c => c.published && !COURSES.some(local => local.id === c.id));
    grid.innerHTML = COURSES.map(tile).join('') + upcoming.map(upcomingTile).join('') + soonTile;
    const count = document.getElementById('catalog-count');
    if (count) count.innerHTML = `<strong class="text-ink">${COURSES.length + upcoming.length}</strong> <span class="text-muted">cursos</span>`;
  }).catch(() => {});
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

// Temario de un curso de la base de datos (con acceso: del contenido; sin acceso: de la ficha pública).
export function openDbCourseDetail(courseId) {
  if (!dbContent.has(courseId) && !dbCourses.has(courseId)) return;
  const info = dbInfo(courseId);
  const row = dbCourses.get(courseId) || {};
  const ok = appState.enabledCourses.includes(courseId);
  openDialog({
    title: info.title,
    kicker: `${info.category || 'CURSO'}${info.duration ? ` · ${info.duration}` : ''}${row.is_free === false ? ' · PREMIUM' : ''}`,
    body: `
      <div class="flex flex-col gap-4">
        ${info.description ? `<p class="text-[13px] leading-relaxed">${esc(info.description)}</p>` : ''}
        ${info.objectives.length ? `
        <div>
          <p class="text-[11px] font-mono font-bold text-muted uppercase tracking-wide mb-2">Qué aprenderás</p>
          <ul class="flex flex-col gap-1.5 text-[13px]">
            ${info.objectives.map(o => `<li class="flex gap-2"><span class="material-symbols-outlined text-[16px] text-accent mt-px shrink-0" aria-hidden="true">check_circle</span><span>${esc(o)}</span></li>`).join('')}
          </ul>
        </div>` : ''}
        ${info.modules.length ? `
        <div>
          <p class="text-[11px] font-mono font-bold text-muted uppercase tracking-wide mb-2">Temario</p>
          <ol class="flex flex-col gap-1.5">
            ${info.modules.map((m, i) => `
              <li class="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-bg/70 border border-line/70 text-xs">
                <span class="flex items-center gap-2 min-w-0"><span class="w-5 h-5 rounded-md bg-accent text-white text-[10px] font-bold flex items-center justify-center shrink-0">${i + 1}</span><span class="truncate font-semibold text-ink">${esc(String(m.title).replace(/^Módulo \d+:\s*/, ''))}</span></span>
                <span class="font-mono text-[10px] text-muted shrink-0">${Number(m.lessons) || 0} lecciones</span>
              </li>`).join('')}
          </ol>
        </div>` : ''}
        <p class="text-[11px] font-mono text-muted">${info.modules.length} módulos · ${info.lessons} lecciones · ${info.labs} labs${info.duration ? ` · ${esc(info.duration)}` : ''}${info.videoAuthor ? ` · Video en español de ${esc(info.videoAuthor)}` : ''}</p>
        ${ok
          ? `<a href="#/aula-interactiva/${esc(courseId)}" class="h-10 bg-accent hover:bg-accent2 text-white rounded-xl text-[13px] font-semibold inline-flex items-center justify-center gap-1.5"><span class="material-symbols-outlined text-[18px]" aria-hidden="true">play_arrow</span>Ir al aula</a>`
          : '<p class="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex gap-2"><span class="material-symbols-outlined text-[16px]" aria-hidden="true">lock</span><span>Curso de acceso total: pide acceso al administrador de la plataforma.</span></p>'}
      </div>`
  });
}
