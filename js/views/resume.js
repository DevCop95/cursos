/**
 * "Continuar donde lo dejaste": último curso abierto por el alumno (en este navegador) y su siguiente lección.
 * Se muestra arriba de Mis cursos y del perfil; no aparece si no hay curso, ya no tiene acceso o lo terminó.
 */
import { esc } from '../lib/html.js?v=dev101x-v76';
import { appState } from '../state.js?v=dev101x-v76';
import { COURSE } from '../content.js?v=dev101x-v76';
import { currentProgress } from '../progress.js?v=dev101x-v76';
import { fetchCourseContent, fetchCourseProgress } from '../cloud.js?v=dev101x-v76';
import { computeCourseProgress } from '../lib/course-engine.js?v=dev101x-v76';
import { readViewCache, writeViewCache } from '../lib/view-cache.js?v=dev101x-v76';

const lastCourseKey = () => {
  const s = appState.session || {};
  return `dev101x_last_course:${s.userId || s.email || ''}`;
};

export function rememberLastCourse(id) {
  try { localStorage.setItem(lastCourseKey(), String(id).slice(0, 80)); } catch (e) { /* almacenamiento bloqueado */ }
}

function lastCourseId() {
  try { return localStorage.getItem(lastCourseKey()); } catch (e) { return null; }
}

async function resumeInfo() {
  const id = lastCourseId();
  if (!id || !appState.enabledCourses.includes(id)) return null;
  if (id === COURSE.id) {
    const p = currentProgress();
    return { id, title: COURSE.title, percent: p.percent, next: p.nextLesson && p.nextLesson.title, complete: p.complete };
  }
  const [content, progress] = await Promise.all([fetchCourseContent(id), fetchCourseProgress(id)]);
  if (!content) return null;
  const p = computeCourseProgress(content, (progress && progress[0] && progress[0].steps) || {});
  return { id, title: content.title, percent: p.percent, next: p.nextLesson && p.nextLesson.title, complete: p.complete };
}

function cardHtml(info) {
  return `
    <a href="#/aula-interactiva/${encodeURIComponent(info.id)}" class="group flex items-center gap-4 p-4 rounded-2xl bg-term border border-term-line text-left hover:border-emerald-500/60 transition-colors relative overflow-hidden">
      <span class="absolute inset-0 opacity-[0.22] pointer-events-none profile-glow" aria-hidden="true"></span>
      <span class="relative w-11 h-11 rounded-xl bg-accent flex items-center justify-center shrink-0"><span class="material-symbols-outlined text-white text-[26px]" aria-hidden="true">play_arrow</span></span>
      <span class="relative min-w-0 flex-1 flex flex-col gap-1">
        <span class="text-[10px] font-mono font-bold text-emerald-300">CONTINUAR DONDE LO DEJASTE</span>
        <span class="text-[14px] font-bold text-white truncate">${esc(info.title)}</span>
        ${info.next ? `<span class="text-xs text-slate-400 truncate">Siguiente: ${esc(info.next)}</span>` : ''}
      </span>
      <span class="relative hidden sm:flex items-center gap-2 shrink-0">
        <span class="w-24 bg-white/10 h-1.5 rounded-full overflow-hidden" aria-hidden="true"><span class="block bg-emerald-400 h-full rounded-full" style="width: ${Number(info.percent) || 0}%"></span></span>
        <span class="font-mono text-[11px] font-bold text-white w-9 text-right">${Number(info.percent) || 0}%</span>
      </span>
      <span class="relative material-symbols-outlined text-slate-300 group-hover:text-emerald-300 group-hover:translate-x-0.5 transition-transform shrink-0" aria-hidden="true">arrow_forward</span>
    </a>`;
}

// Se pinta al instante con lo último que se vio (sin saltos al responder el servidor) y solo se retoca si cambia.
export async function paintResume(el) {
  if (!el) return;
  const user = appState.session;
  const cached = readViewCache('resume', user);
  let shown = null;
  if (cached && !cached.complete && cached.id === lastCourseId() && appState.enabledCourses.includes(cached.id)) {
    el.innerHTML = cardHtml(cached);
    el.classList.remove('hidden');
    shown = JSON.stringify(cached);
  }
  let info;
  try { info = await resumeInfo(); } catch (e) { return; } // sin red: se queda lo que había
  if (!document.body.contains(el)) return;
  writeViewCache('resume', user, info);
  if (!info || info.complete) {
    el.classList.add('hidden');
    el.innerHTML = '';
    return;
  }
  if (JSON.stringify(info) !== shown) el.innerHTML = cardHtml(info);
  el.classList.remove('hidden');
}
