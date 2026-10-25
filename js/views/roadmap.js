/**
 * Ruta de aprendizaje (HTML). Un solo componente para el Catálogo de la app y la portada pública:
 *  - modo 'app': cada curso es un botón que abre su ficha, y se marca lo que el alumno ya hizo.
 *  - modo 'public': cada curso es un enlace a su página pública y se muestran los requisitos tal cual.
 */
import { esc } from '../lib/html.js?v=dev101x-v113';
import { ROADMAP, courseState, missingBefore, nextRecommended } from '../lib/roadmap.js?v=dev101x-v113';
import { PUBLIC_COURSES } from '../lib/public-courses.js?v=dev101x-v113';
import { courseLogo } from '../lib/course-logos.js?v=dev101x-v113';
import { courseIcon } from '../lib/ranks.js?v=dev101x-v113';

const byId = new Map(PUBLIC_COURSES.map(c => [c.id, c]));
const shortOf = id => (byId.get(id) || {}).short || id;

function logoHtml(id) {
  const src = courseLogo(id) || (byId.get(id) || {}).logo;
  return src
    ? `<img src="${esc(src)}" alt="" width="18" height="18" loading="lazy" decoding="async" class="object-contain" style="width:18px;height:18px" />`
    : `<span class="material-symbols-outlined text-white text-[18px]" aria-hidden="true">${esc(courseIcon(id))}</span>`;
}

// Qué decir de los requisitos: en la app solo lo que aún falta; en la portada, lo que pide el curso.
function prereqText(id, progress) {
  const miss = progress ? missingBefore(id, progress) : null;
  const req = ROADMAP.requires[id] || {};
  const hard = (miss ? miss.hard : req.hard) || [];
  const soft = (miss ? miss.soft : req.soft) || [];
  if (hard.length) return { text: `Requiere ${hard.map(shortOf).join(' y ')}`, strong: true };
  if (soft.length) return { text: `Recomendado: ${soft.map(shortOf).join(' y ')}`, strong: false };
  return null;
}

function stepHtml(id, n, ctx) {
  const c = byId.get(id);
  if (!c) return '';
  const state = ctx.progress ? courseState(id, ctx.progress) : 'new';
  const prog = ctx.progress && ctx.progress[id];
  const pre = state === 'done' ? null : prereqText(id, ctx.progress);
  const badge = state === 'done'
    ? '<span class="material-symbols-outlined text-[18px]" aria-hidden="true">check</span>'
    : String(n);
  const status = state === 'done'
    ? '<span class="text-accent">Completado</span>'
    : state === 'doing' ? `<span class="text-accent">${Math.round(Number(prog.percent) || 0)} %</span>` : '';
  const inner = `
      <span class="w-6 h-6 rounded-full shrink-0 inline-flex items-center justify-center font-mono text-[11px] font-bold ${state === 'done' ? 'bg-accent text-white' : 'bg-bg2 text-ink2'}">${badge}</span>
      <span class="w-8 h-8 rounded-lg bg-term inline-flex items-center justify-center shrink-0">${logoHtml(id)}</span>
      <span class="min-w-0 flex-1 flex flex-col">
        <span class="text-[13px] font-bold text-ink leading-tight truncate">${esc(c.short)}</span>
        <span class="text-[11px] font-mono text-muted truncate">${c.free ? 'Gratis' : 'Premium'} · ${esc(c.duration || '')}</span>
        ${pre ? `<span class="text-[11px] ${pre.strong ? 'text-ink2 font-semibold' : 'text-muted'} truncate">${esc(pre.text)}</span>` : ''}
      </span>
      ${status ? `<span class="shrink-0 font-mono text-[11px] font-bold">${status}</span>` : ''}`;
  const cls = 'w-full h-full flex items-center gap-2.5 rounded-xl border border-line bg-surface hover:border-accent/60 px-2.5 py-2 text-left transition-colors';
  return ctx.mode === 'public'
    ? `<a href="/${esc(c.slug)}/" class="${cls}">${inner}</a>`
    : `<button type="button" data-action="${id === 'pentesting-101' ? 'open-course' : 'open-db-course'}" data-id="${esc(id)}" class="${cls}">${inner}</button>`;
}

function nextHtml(ctx) {
  if (ctx.mode !== 'app' || !ctx.progress) return '';
  const next = nextRecommended(ctx.progress);
  if (!next) return `<p class="text-[13px] text-ink2"><strong class="text-ink">Base completada.</strong> Elige el camino que más te interese.</p>`;
  const c = byId.get(next.id);
  if (!c) return '';
  const started = courseState(next.id, ctx.progress) === 'doing';
  return `
    <p class="text-[13px] text-ink2 flex items-center gap-2 flex-wrap">
      <span>${started ? 'Sigue con' : next.why === 'base' ? 'Te recomendamos empezar por' : 'Siguiente en tu camino:'}</span>
      <button type="button" data-action="${next.id === 'pentesting-101' ? 'open-course' : 'open-db-course'}" data-id="${esc(next.id)}" class="font-bold text-accent hover:underline">${esc(c.short)}</button>
    </p>`;
}

/**
 * @param {{ mode?: 'app'|'public', progress?: Record<string, { percent?: number, complete?: boolean }> }} opts
 */
export function roadmapHtml({ mode = 'public', progress = null } = {}) {
  const ctx = { mode, progress };
  const { base, paths } = ROADMAP;
  const pathCard = p => `
    <div class="min-w-0 rounded-2xl border border-line bg-bg/60 p-3 sm:p-4 flex flex-col gap-3">
      <div class="flex flex-col gap-0.5">
        <h3 class="text-[15px] font-bold text-ink leading-snug">${esc(p.title)}</h3>
        <p class="text-xs text-muted leading-relaxed">${esc(p.blurb)}</p>
      </div>
      <ol class="flex flex-col gap-2">${p.steps.map((id, i) => `<li>${stepHtml(id, i + 1, ctx)}</li>`).join('')}</ol>
    </div>`;
  const landing = mode === 'public';
  const frame = landing
    ? 'landing-card w-full rounded-3xl px-6 sm:px-10 py-6 sm:py-8 flex flex-col gap-5'
    : 'w-full rounded-2xl border border-line bg-surface p-4 sm:p-6 flex flex-col gap-5';
  const head = landing
    ? `<h2 id="roadmap-title" class="text-2xl sm:text-[28px] leading-tight font-extrabold text-ink tracking-tight">Ruta de aprendizaje</h2>`
    : `<p class="text-[11px] font-mono text-muted">RUTA DE APRENDIZAJE</p>
        <h2 id="roadmap-title" class="text-lg sm:text-xl font-extrabold text-ink tracking-tight">Por dónde empezar</h2>`;
  return `
    <section id="roadmap" aria-labelledby="roadmap-title" class="${frame}">
      <div class="flex flex-col gap-1.5">
        ${head}
        <p class="text-sm text-muted leading-relaxed">Empieza por la base y luego elige un camino. Es una guía: puedes hacer los cursos en el orden que prefieras.</p>
        <div id="roadmap-next" class="${landing ? 'hidden' : 'min-h-[20px]'}">${nextHtml(ctx)}</div>
      </div>
      <div class="flex flex-col gap-2">
        <div class="flex items-baseline justify-between gap-2 flex-wrap">
          <h3 class="text-[11px] font-mono font-bold text-muted uppercase tracking-wide">${esc(base.title)} · gratis</h3>
          <p class="text-xs text-muted">${esc(base.note)}</p>
        </div>
        <ol class="grid grid-cols-1 sm:grid-cols-3 gap-2">${base.steps.map((id, i) => `<li class="h-full">${stepHtml(id, i + 1, ctx)}</li>`).join('')}</ol>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-3">${paths.map(pathCard).join('')}</div>
    </section>`;
}

/** Repinta la ruta cuando llega el progreso del alumno (sin tocar el resto de la página). */
export function repaintRoadmap(progress) {
  const el = document.getElementById('roadmap');
  if (!el) return;
  el.outerHTML = roadmapHtml({ mode: 'app', progress });
}
