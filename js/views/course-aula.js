/**
 * Vista: aula de un curso cuyo contenido vive en Supabase (cursos de pago).
 * El contenido solo llega si el servidor concede acceso (RLS). Todo el texto del curso es dato:
 * se escapa siempre con esc(). El progreso y las respuestas los valida el servidor.
 */
import { esc } from '../lib/html.js?v=dev101x-v75';
import { showToast, openDialog, closeModal } from '../ui.js?v=dev101x-v75';
import { isCloudEnabled } from '../config.js?v=dev101x-v75';
import * as cloud from '../cloud.js?v=dev101x-v75';
import { appState } from '../state.js?v=dev101x-v75';
import { scheduleRankCheck } from './rank-notice.js?v=dev101x-v75';
import { runCourseCommand, computeCourseProgress, pendingCourseSteps, isCheckStep, initialCourseState, promptFor, realCourseSteps, realCourseValues } from '../lib/course-engine.js?v=dev101x-v75';

const LINE_CLASSES = {
  error: 'text-red-400', cmd: 'text-emerald-400 font-bold', info: 'text-sky-300', slate: 'text-slate-400',
  hint: 'text-amber-300', system: 'text-slate-200', out: 'text-slate-200'
};
const MAX_LINES = 200;
const SAVED_LINES = 80; // líneas de la terminal que se guardan en el servidor
const SAVE_DELAY = 1500;
const TAB_ACTIVE = 'font-bold bg-accent text-white';
const TAB_IDLE = 'font-semibold bg-white hover:bg-bg2 text-ink border border-line/70';
const TAB_BTN = 'h-9 px-3 rounded-xl bg-white border border-line hover:border-accent/60 text-xs font-semibold text-ink flex items-center gap-1.5 transition-colors';
// Cursos que también se pueden practicar en Linux real (v86 en /lab-linux/embed.html, dentro de un iframe
// para no relajar el CSP del sitio). Al salir del aula el iframe desaparece y la máquina con él.
const LINUX_LAB_COURSES = new Set(['git-github-101']);
const LINUX_LAB_URL = '/lab-linux/embed.html';
const MODE_ON = 'bg-accent text-white font-bold';
const MODE_OFF = 'text-slate-300 hover:text-white';

// Estado del curso abierto (en memoria: el contenido de pago no se guarda en el navegador).
// El estado de la terminal (variables, últimas líneas y ficha abierta) se guarda en Supabase
// (user_course_state), así el alumno retoma el laboratorio en cualquier dispositivo.
let S = null; // { id, content, steps, lines, state, expl, mode }
let saveTimer = null;
let pendingSave = null;

const safeVideoId = id => (/^[\w-]{11}$/.test(String(id || '')) ? id : null);
const fmtTime = sec => `${Math.floor(sec / 3600) ? Math.floor(sec / 3600) + ':' : ''}${String(Math.floor(sec % 3600 / 60)).padStart(Math.floor(sec / 3600) ? 2 : 1, '0')}:${String(sec % 60).padStart(2, '0')}`;

// ---------------------------------------------------------------------------
// Carga y render principal
// ---------------------------------------------------------------------------
function messageHtml(icon, title, text) {
  return `
    <div class="max-w-lg mx-auto my-12 p-6 bg-surface rounded-2xl border border-line text-center flex flex-col gap-3 items-center">
      <span class="material-symbols-outlined text-3xl text-muted" aria-hidden="true">${icon}</span>
      <h1 class="text-lg font-bold text-ink">${title}</h1>
      <p class="text-sm text-muted">${text}</p>
      <a href="#/explorar-cursos" class="px-4 py-2 bg-accent hover:bg-accent2 text-white rounded-xl text-sm font-semibold">Ver catálogo</a>
    </div>`;
}

export async function renderCourseAula(container, courseId) {
  if (!isCloudEnabled()) {
    container.innerHTML = messageHtml('cloud_off', 'Curso no disponible', 'Este curso necesita conexión con el servidor.');
    return;
  }
  container.innerHTML = '<p class="py-16 text-center text-sm text-muted">Cargando curso…</p>';
  let content = null;
  let progress = null;
  let saved = null;
  try {
    [content, progress, saved] = await Promise.all([
      cloud.fetchCourseContent(courseId),
      cloud.fetchCourseProgress(courseId),
      cloud.fetchCourseState(courseId).catch(() => null)
    ]);
  } catch (e) {
    console.error(e);
  }
  if (!document.body.contains(container)) return;
  if (!content) {
    container.innerHTML = messageHtml('lock', 'No tienes acceso a este curso', 'Es un curso de pago. Pide acceso al administrador de la plataforma.');
    return;
  }
  const steps = (progress && progress[0] && progress[0].steps) || {};
  flushSave();
  S = restoreState(courseId, content, steps, saved);
  paintAula(container);
}

const introLines = content => (content.terminal.intro || []).map(([text, type]) => ({ text, type }));

// El estado guardado lo escribe el propio alumno: se valida antes de usarlo (solo variables
// conocidas, textos cortos y tipos de línea permitidos).
function restoreState(id, content, steps, saved) {
  const explKeys = (content.explanations || []).map(e => e.key);
  const S0 = { id, content, steps, lines: introLines(content), state: initialCourseState(content.terminal), expl: explKeys[0] || null, mode: 'sim' };
  if (!saved || typeof saved !== 'object') return S0;
  if (saved.vars && typeof saved.vars === 'object') {
    Object.keys(S0.state).forEach(k => {
      const v = saved.vars[k];
      if (typeof v === 'string' && v.length <= 120) S0.state[k] = v;
    });
  }
  if (Array.isArray(saved.lines)) {
    const lines = saved.lines
      .filter(l => l && typeof l.text === 'string' && LINE_CLASSES[l.type])
      .slice(-SAVED_LINES)
      .map(l => ({ text: l.text.slice(0, 400), type: l.type }));
    if (lines.length) S0.lines = [...lines, { text: '— Sesión restaurada: sigues donde lo dejaste —', type: 'slate' }];
  }
  if (explKeys.includes(saved.expl)) S0.expl = saved.expl;
  return S0;
}

function scheduleSave() {
  if (!S) return;
  pendingSave = { id: S.id, data: { v: 1, vars: S.state, lines: S.lines.slice(-SAVED_LINES), expl: S.expl } };
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flushSave, SAVE_DELAY);
}

// Guarda lo pendiente (tras la pausa, al cambiar de curso o al salir de la página).
function flushSave() {
  clearTimeout(saveTimer);
  saveTimer = null;
  if (!pendingSave) return;
  const { id, data } = pendingSave;
  pendingSave = null;
  cloud.saveCourseState(id, data).catch(err => console.warn('No se pudo guardar el estado del laboratorio:', err.message || err));
}
window.addEventListener('pagehide', flushSave);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushSave(); });

export function resetCourseLab() {
  if (!S) return;
  if (!window.confirm('¿Reiniciar el laboratorio? La terminal vuelve al principio; tu progreso y tus respuestas se conservan.')) return;
  S.state = initialCourseState(S.content.terminal);
  S.lines = introLines(S.content);
  renderScreen();
  updatePrompt();
  scheduleSave();
}

function paintAula(container) {
  const { content } = S;
  const p = computeCourseProgress(content, S.steps);
  const video = safeVideoId(content.video && content.video.id);

  container.innerHTML = `
    <div class="flex flex-col w-full py-4 sm:py-6 gap-4 sm:gap-5">
      <section class="bg-surface p-4 sm:p-5 rounded-2xl border border-line flex flex-col gap-3">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2 font-mono text-[11px] flex-wrap text-muted">
              <span class="px-2 py-0.5 rounded-md bg-accent text-white font-bold">${esc(content.title)}</span>
              <span id="c-module">${esc(p.nextLesson ? p.nextLesson.module : 'Curso completado')}</span>
            </div>
            <button type="button" data-action="c-lesson" id="c-lesson-title" data-id="${esc(p.nextLesson ? p.nextLesson.id : '')}" class="block text-left text-[15px] sm:text-lg font-bold text-ink mt-1.5 leading-snug hover:text-accent transition-colors">${esc(p.nextLesson ? p.nextLesson.title : 'Curso completado')}</button>
          </div>
          <div class="flex items-center gap-2 shrink-0 flex-wrap">
            ${video ? `<button type="button" data-action="c-video" data-start="0" class="${TAB_BTN}"><span class="material-symbols-outlined text-[18px] text-rose-500" aria-hidden="true">smart_display</span><span>Video de la clase</span></button>` : ''}
            ${(content.resources || []).length ? `<button type="button" data-action="c-resources" class="${TAB_BTN}" title="Documentación, libros y práctica extra"><span class="material-symbols-outlined text-[18px] text-sky-600" aria-hidden="true">menu_book</span><span class="hidden sm:inline">Recursos</span></button>` : ''}
            <button type="button" data-action="c-cheat" class="${TAB_BTN}" title="Hoja de comandos imprimible"><span class="material-symbols-outlined text-[18px] text-accent" aria-hidden="true">description</span><span class="hidden sm:inline">Hoja de comandos</span></button>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <div class="flex-1 bg-bg h-1.5 rounded-full overflow-hidden" role="progressbar" aria-valuenow="${p.percent}" aria-valuemin="0" aria-valuemax="100" aria-label="Progreso del curso">
            <div id="c-bar" class="bg-accent h-full rounded-full transition-all duration-500" style="width: ${p.percent}%;"></div>
          </div>
          <span id="c-pct" class="font-mono text-[11px] font-bold text-accent tabular-nums">${p.percent}%</span>
        </div>
        <div id="c-next">${nextStepHtml()}</div>
      </section>

      <div class="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 items-start">
        <div class="lg:col-span-8 flex flex-col gap-4 sm:gap-5 min-w-0">
        <section class="bg-term rounded-2xl border border-term-line overflow-hidden font-mono text-xs" aria-label="Terminal del laboratorio">
          <div class="p-3 bg-term-2 text-slate-300 flex items-center justify-between gap-2 text-[11px] border-b border-term-line">
            <div class="flex items-center gap-2.5 min-w-0">
              <div class="hidden sm:flex items-center gap-1.5" aria-hidden="true"><span class="w-3 h-3 rounded-full bg-[#ff5f56]/80"></span><span class="w-3 h-3 rounded-full bg-[#ffbd2e]/80"></span><span class="w-3 h-3 rounded-full bg-[#27c93f]/80"></span></div>
              <span class="font-bold text-slate-100 truncate">${esc(content.terminal.title || 'Terminal')}</span>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              ${LINUX_LAB_COURSES.has(S.id) ? `
              <div class="hidden sm:flex items-center gap-0.5 p-0.5 rounded bg-slate-800" role="group" aria-label="Tipo de terminal">
                ${[['sim', 'Simulada'], ['linux', 'Linux real']].map(([mode, label]) => `
                <button type="button" data-action="c-mode" data-mode="${mode}" aria-pressed="${S.mode === mode}" class="px-2 py-0.5 rounded text-[10px] transition-colors ${S.mode === mode ? MODE_ON : MODE_OFF}">${label}</button>`).join('')}
              </div>` : ''}
              <span id="c-linux-note" class="hidden text-[10px] text-slate-400" title="Aquí practicas libremente; el progreso del curso se cuenta en la terminal simulada">práctica libre</span>
              <button type="button" id="c-linux-reset" data-action="c-linux-reset" title="Vuelve a empezar la máquina Linux desde cero (no borra tu progreso)" class="hidden px-2.5 h-7 sm:h-6 items-center rounded bg-slate-800 hover:bg-slate-700 text-rose-300 text-[10px]">reiniciar</button>
              <span id="c-sim-tools" class="flex items-center gap-2">
              <button type="button" data-action="c-reset" title="Vuelve a empezar el laboratorio (no borra tu progreso)" class="px-2.5 h-7 sm:h-6 inline-flex items-center rounded bg-slate-800 hover:bg-slate-700 text-rose-300 text-[10px]">reiniciar</button>
              <button type="button" data-action="c-run" data-cmd="clear" class="px-2.5 h-7 sm:h-6 inline-flex items-center rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px]">clear</button>
              <button type="button" data-action="c-run" data-cmd="help" class="px-2.5 h-7 sm:h-6 inline-flex items-center rounded bg-slate-800 hover:bg-slate-700 text-amber-300 text-[10px]">help</button>
              </span>
            </div>
          </div>
          <div id="c-sim">
          <div id="c-screen" role="log" aria-live="polite" class="p-3.5 sm:p-4 h-64 sm:h-96 overflow-y-auto space-y-1 text-slate-200 text-[11px] sm:text-xs leading-relaxed whitespace-pre-wrap break-words"></div>
          <form data-action="c-terminal" class="p-3 bg-term-deep border-t border-term-line flex items-center gap-2">
            <label for="c-input" class="text-emerald-400 text-xs shrink-0 select-none font-bold max-w-[55%] truncate"><span id="c-prompt" class="hidden md:inline">${esc(promptFor(content.terminal, S.state).trim())}</span><span class="md:hidden">${esc(content.terminal.promptShort || '$')}</span></label>
            <input id="c-input" type="text" maxlength="300" enterkeyhint="go" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="${esc(content.terminal.placeholder || 'help')}" class="flex-1 min-w-0 bg-transparent text-emerald-300 text-[13px] sm:text-xs outline-none font-mono py-1.5" />
            <button type="submit" class="px-3.5 sm:px-4 py-2 bg-accent hover:bg-accent2 rounded-xl text-white text-xs font-semibold shrink-0 transition-colors">Ejecutar</button>
          </form>
          </div>
          <div id="c-linux" class="hidden"></div>
        </section>
        ${explanationsPanelHtml()}
        </div>

        <div class="lg:col-span-4 flex flex-col gap-4 sm:gap-5">
          ${video ? `
          <button type="button" data-action="c-video" data-start="0" class="group bg-surface rounded-2xl border border-line hover:border-accent/60 overflow-hidden text-left transition-colors">
            <span class="relative block w-full aspect-video bg-term">
              <img src="https://i.ytimg.com/vi/${video}/hqdefault.jpg" alt="" class="absolute inset-0 w-full h-full object-cover" loading="lazy" />
              <span class="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/20 transition-colors">
                <span class="w-12 h-12 rounded-full bg-white/95 flex items-center justify-center shadow-lg"><span class="material-symbols-outlined text-accent text-3xl" aria-hidden="true">play_arrow</span></span>
              </span>
            </span>
            <span class="block p-3.5">
              <span class="block text-[10px] font-mono font-bold text-rose-600 mb-0.5">VIDEO EN ESPAÑOL · ${esc(content.video.author)}</span>
              <span class="block text-[13px] font-bold text-ink leading-snug">${esc(content.video.title)}</span>
            </span>
          </button>` : ''}
          <section class="bg-surface rounded-2xl border border-line p-4 flex flex-col gap-3">
            <div class="flex items-center justify-between">
              <h3 class="text-xs font-bold text-ink uppercase font-mono">Plan de estudio</h3>
              <span class="text-[11px] text-muted font-mono">${esc(content.duration || '')}</span>
            </div>
            <div id="c-syllabus" class="flex flex-col gap-1">${syllabusHtml()}</div>
            ${(content.objectives || []).length ? `
            <details class="mt-1 pt-3 border-t border-line/60 text-xs">
              <summary class="cursor-pointer font-semibold text-ink2 hover:text-accent">Qué aprenderás</summary>
              <ul class="mt-2 flex flex-col gap-1.5 text-ink2">
                ${content.objectives.map(o => `<li class="flex gap-1.5"><span class="material-symbols-outlined text-[14px] text-accent mt-px" aria-hidden="true">check</span><span>${esc(o)}</span></li>`).join('')}
              </ul>
            </details>` : ''}
          </section>
          ${(content.labs || []).length ? `
          <section class="bg-surface rounded-2xl border border-line p-4 flex flex-col gap-2.5">
            <h3 class="text-xs font-bold text-ink uppercase font-mono">Laboratorios</h3>
            <div id="c-labs" class="flex flex-col gap-2">${labsHtml()}</div>
          </section>` : ''}
        </div>
      </div>
    </div>`;
  renderScreen();
}

function syllabusHtml() {
  const p = computeCourseProgress(S.content, S.steps);
  return (S.content.syllabus || []).map(m => {
    const done = m.lessons.filter(l => p.lessonsDone.includes(l.id)).length;
    return `
      <div class="flex flex-col gap-1">
        <div class="flex items-center justify-between gap-2 px-1 pb-0.5">
          <span class="font-bold text-ink text-[11px] leading-snug">${esc(m.module)}</span>
          <span class="text-[10px] shrink-0 font-mono ${done === m.lessons.length ? 'text-accent font-bold' : 'text-muted'}">${done === m.lessons.length ? '✓' : `${done}/${m.lessons.length}`}</span>
        </div>
        ${m.lessons.map(l => {
          const isDone = p.lessonsDone.includes(l.id);
          const active = p.nextLesson && p.nextLesson.id === l.id;
          return `
            <button type="button" data-action="c-lesson" data-id="${esc(l.id)}" class="w-full flex items-center gap-2 py-2 px-2 rounded-lg text-left transition-colors ${active ? 'bg-emerald-100/70 text-accent' : 'hover:bg-bg'}">
              <span class="material-symbols-outlined text-[16px] shrink-0 ${isDone || active ? 'text-accent' : 'text-[#b6b2a9]'}" aria-hidden="true">${isDone ? 'check_circle' : active ? 'play_circle' : 'radio_button_unchecked'}</span>
              <span class="flex-1 min-w-0 truncate text-[12px] ${active ? 'font-bold' : 'text-ink2'}">${esc(l.title)}</span>
              <span class="text-[10px] shrink-0 font-mono text-muted">${esc(l.time || '')}</span>
            </button>`;
        }).join('')}
      </div>`;
  }).join('<div class="border-t border-line/60 my-1"></div>');
}

function labsHtml() {
  const p = computeCourseProgress(S.content, S.steps);
  return (S.content.labs || []).map(lab => {
    const done = p.labsDone.includes(lab.id);
    const count = lab.all.filter(s => S.steps[s]).length;
    return `
      <div class="flex items-start gap-2.5 p-2.5 rounded-xl border ${done ? 'border-emerald-200 bg-emerald-50/60' : 'border-line bg-white/60'}">
        <span class="material-symbols-outlined text-[18px] shrink-0 ${done ? 'text-accent' : 'text-muted'}" aria-hidden="true">${done ? 'verified' : esc(lab.icon || 'science')}</span>
        <div class="min-w-0 flex-1">
          <div class="flex items-center justify-between gap-2">
            <p class="text-[12px] font-bold text-ink truncate">${esc(lab.title)}</p>
            <span class="text-[10px] font-mono shrink-0 ${done ? 'text-accent font-bold' : 'text-muted'}">${done ? '✓' : `${count}/${lab.all.length}`}</span>
          </div>
          <p class="text-[11px] text-ink2 leading-snug mt-0.5">${esc(lab.hint || '')}</p>
        </div>
      </div>`;
  }).join('');
}

// Fichas de los comandos, debajo de la terminal (como en el curso de Nmap).
function explanationsPanelHtml() {
  if (!(S.content.explanations || []).length) return '';
  return `
    <section class="bg-surface rounded-2xl border border-line overflow-hidden">
      <div class="px-3.5 py-3 bg-bg/70 border-b border-line/80 flex items-center gap-2.5 min-w-0">
        <span class="material-symbols-outlined text-accent text-base shrink-0" aria-hidden="true">psychology</span>
        <div id="c-expl-tabs" class="flex items-center gap-1.5 overflow-x-auto pb-0.5 max-w-full font-mono text-[11px] cmd-tab-bar">${explTabsHtml()}</div>
      </div>
      <div id="c-expl" class="p-4 sm:p-6 flex flex-col gap-4 text-xs">${explanationCardHtml()}</div>
    </section>`;
}

function explTabsHtml() {
  return (S.content.explanations || []).map(e => `
    <button type="button" data-action="c-expl" data-key="${esc(e.key)}" aria-pressed="${e.key === S.expl}" class="px-3 py-1.5 rounded-lg whitespace-nowrap transition-all ${e.key === S.expl ? TAB_ACTIVE : TAB_IDLE}">${esc(e.name)}</button>`).join('');
}

function explanationCardHtml() {
  const e = (S.content.explanations || []).find(x => x.key === S.expl);
  if (!e) return '';
  return `
    <div class="flex items-start justify-between gap-3 pb-3.5 border-b border-line">
      <h3 class="text-base font-bold text-ink">${esc(e.title)}</h3>
      <button type="button" data-action="copy-cmd" data-cmd="${esc(e.cmd)}" class="px-3 py-1.5 rounded-xl bg-bg hover:bg-bg2 text-ink font-mono text-xs font-semibold flex items-center gap-1 border border-line transition-colors shrink-0">
        <span class="material-symbols-outlined text-sm" aria-hidden="true">content_copy</span><span>Copiar</span>
      </button>
    </div>
    <div class="bg-term p-3.5 rounded-xl border border-term-line font-mono text-xs overflow-x-auto">
      <span class="text-emerald-400 select-none font-bold">$ </span><span class="text-emerald-300 font-bold whitespace-nowrap">${esc(e.cmd)}</span>
    </div>
    <p class="text-ink2 leading-relaxed text-[13px]">${esc(e.purpose)}</p>
    ${(e.flags || []).length ? `
    <div class="grid grid-cols-1 md:grid-cols-2 gap-2.5">
      ${e.flags.map(([flag, desc]) => `
        <div class="bg-bg/60 p-3 rounded-xl border border-line/80 flex flex-col gap-1">
          <code class="self-start font-mono font-bold text-accent bg-emerald-100/80 px-1.5 py-0.5 rounded text-[11px] break-all">${esc(flag)}</code>
          <p class="text-ink2 text-[11px] leading-snug">${esc(desc)}</p>
        </div>`).join('')}
    </div>` : ''}
    ${e.tip ? `
    <p class="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 text-xs leading-relaxed flex gap-2">
      <span class="material-symbols-outlined text-[16px] text-amber-500 shrink-0" aria-hidden="true">tips_and_updates</span><span>${esc(e.tip)}</span>
    </p>` : ''}`;
}

export function selectCourseExplanation(key) {
  if (!S || !(S.content.explanations || []).some(e => e.key === key)) return;
  S.expl = key;
  const tabs = document.getElementById('c-expl-tabs');
  if (tabs) tabs.innerHTML = explTabsHtml();
  const card = document.getElementById('c-expl');
  if (card) card.innerHTML = explanationCardHtml();
  scheduleSave();
}

// Ficha que corresponde al comando escrito (git commit → "git add · commit", ssh-keygen → "SSH").
function explanationFor(cmd) {
  const parts = cmd.toLowerCase().split(' ');
  const word = (parts[0] === 'git' ? parts[1] : parts[0].split('-')[0]) || '';
  if (!word || word.startsWith('-')) return null;
  const hit = (S.content.explanations || []).find(e => String(e.name).toLowerCase().split(/[^a-z0-9]+/).includes(word));
  return hit ? hit.key : null;
}

function nextStepHtml() {
  const p = computeCourseProgress(S.content, S.steps);
  if (p.complete) return '<p class="text-xs text-accent font-semibold">✓ Has completado todas las lecciones del curso.</p>';
  const { commands, checks } = pendingCourseSteps(S.content, S.steps);
  return `
    <div class="flex flex-wrap items-center gap-1.5">
      <span class="text-[11px] font-mono text-muted mr-1">${commands.length ? 'Practica:' : 'Siguiente:'}</span>
      ${commands.map((step, i) => `
        <button type="button" data-action="c-hint" data-step="${esc(step)}" class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 text-[11px] font-semibold">
          <span class="material-symbols-outlined text-[14px]" aria-hidden="true">lightbulb</span>Pista ${i + 1}
        </button>`).join('')}
      ${!commands.length && checks.length ? `
        <button type="button" data-action="c-lesson" data-id="${esc(p.nextLesson.id)}" class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-accent hover:bg-accent2 text-white text-[11px] font-semibold">
          <span class="material-symbols-outlined text-[14px]" aria-hidden="true">quiz</span>${p.nextLesson.afterAll ? 'Resolver el reto final' : 'Responder la pregunta de la lección'}
        </button>` : ''}
    </div>`;
}

function refreshProgress() {
  const p = computeCourseProgress(S.content, S.steps);
  const set = (id, fn) => { const el = document.getElementById(id); if (el) fn(el); };
  set('c-next', el => { el.innerHTML = nextStepHtml(); });
  set('c-syllabus', el => { el.innerHTML = syllabusHtml(); });
  set('c-bar', el => { el.style.width = `${p.percent}%`; });
  set('c-pct', el => { el.textContent = `${p.percent}%`; });
  set('c-lesson-title', el => { el.textContent = p.nextLesson ? p.nextLesson.title : 'Curso completado'; el.dataset.id = p.nextLesson ? p.nextLesson.id : ''; });
  set('c-module', el => { el.textContent = p.nextLesson ? p.nextLesson.module : 'Curso completado'; });
  set('c-labs', el => { el.innerHTML = labsHtml(); });
}

function applyServerSteps(serverSteps) {
  const before = computeCourseProgress(S.content, S.steps);
  S.steps = { ...S.steps, ...(serverSteps || {}) };
  const after = computeCourseProgress(S.content, S.steps);
  refreshProgress();
  after.labsDone.filter(id => !before.labsDone.includes(id)).forEach(id => {
    const lab = (S.content.labs || []).find(x => x.id === id);
    if (lab) showToast(`Laboratorio superado: ${lab.title}`, 'success');
  });
  after.lessonsDone.filter(id => !before.lessonsDone.includes(id)).forEach(id => {
    const l = after.lessons.find(x => x.id === id);
    if (l) showToast(`Lección completada: ${l.title}`, 'success');
  });
  if (after.complete && !before.complete) showToast('¡Felicidades! Has completado el curso.', 'success');
  // El servidor ya tiene el avance: si subió de rango, se avisa.
  if (after.lessonsDone.length > before.lessonsDone.length) scheduleRankCheck(1500);
}

// ---------------------------------------------------------------------------
// Terminal
// ---------------------------------------------------------------------------
function lineNode(l) {
  const div = document.createElement('div');
  div.className = LINE_CLASSES[l.type] || LINE_CLASSES.out;
  div.textContent = l.text || ' ';
  return div;
}

function updatePrompt() {
  const el = document.getElementById('c-prompt');
  if (el && S) el.textContent = promptFor(S.content.terminal, S.state).trim();
}

function renderScreen() {
  const screen = document.getElementById('c-screen');
  if (!screen || !S) return;
  screen.replaceChildren(...S.lines.map(lineNode));
  screen.scrollTop = screen.scrollHeight;
}

// Comandos "en vivo" del curso (terminal.live): en vez de la salida simulada, llaman a una función real.
// Ahora solo 'recon' (reconocimiento pasivo de un dominio). El patrón captura el argumento en el grupo 1.
function liveCommand(cmd) {
  for (const rule of (S.content.terminal.live || [])) {
    let re;
    try { re = new RegExp(rule.match, 'i'); } catch (e) { continue; }
    const m = cmd.match(re);
    if (m) return { rule, arg: (m[1] || '').trim() };
  }
  return null;
}

function pushLines(lines) {
  S.lines.push(...lines);
  if (S.lines.length > MAX_LINES) S.lines.splice(0, S.lines.length - MAX_LINES);
  renderScreen();
  scheduleSave();
}

// El argumento puede traer opciones: "dev101x.online --live". Se separa el dominio de las banderas.
async function runReconCommand(argStr, rule) {
  const tokens = String(argStr || '').split(/\s+/).filter(Boolean);
  const domain = tokens.find(t => !t.startsWith('-')) || '';
  const live = tokens.includes('--live');
  if (!domain) { pushLines([{ text: 'Uso: recons101x <dominio> [--live]  (por ejemplo: recons101x dev101x.online)', type: 'hint' }]); return; }
  pushLines([{ text: live ? `[*] Comprobando hosts vivos de ${domain}…` : `[*] Consultando Certificate Transparency para ${domain}…`, type: 'slate' }]);
  try {
    const res = await cloud.recon(domain, live);
    if (!res || res.error) { pushLines([{ text: `[!] ${res && res.error ? res.error : 'No se pudo hacer el reconocimiento.'}`, type: 'error' }]); return; }
    if (res.live) {
      const rows = Array.isArray(res.results) ? res.results : [];
      const label = { HTTPS_OK: '● vivo (HTTPS)', HTTP_OK: '● vivo (HTTP)', STALE: '○ sin respuesta' };
      pushLines([
        { text: `[+] ${rows.length} host(s) comprobados de ${res.domain}:`, type: 'system' },
        ...rows.map(r => ({ text: `    ${(label[r.state] || r.state).padEnd(18)} ${r.host}`, type: r.state === 'STALE' ? 'slate' : 'info' })),
        { text: '[LAB] Comprobación activa (autorizada) del dominio de demostración: se conecta a los hosts.', type: 'hint' }
      ]);
      recordFreshSteps(['sh-recon', 'sh-live']);
    } else {
      const hosts = Array.isArray(res.hostnames) ? res.hostnames : [];
      if (!hosts.length) pushLines([{ text: `[i] Sin hostnames para ${res.domain} en Certificate Transparency.`, type: 'hint' }]);
      else pushLines([
        { text: `[+] ${hosts.length} hostname(s) de ${res.domain}:`, type: 'system' },
        ...hosts.map(h => ({ text: `    ${h}`, type: 'info' })),
        { text: '[LAB] Datos públicos de CT. Reconocimiento pasivo: no se ha tocado el objetivo.', type: 'hint' }
      ]);
      if (rule && rule.steps) recordFreshSteps(rule.steps);
    }
  } catch (err) {
    pushLines([{ text: `[!] ${err.message || 'No se pudo hacer el reconocimiento.'}`, type: 'error' }]);
  }
}

export function runCourseCmd(raw) {
  if (!S) return;
  const cmd = String(raw || '').trim();
  if (!cmd) return;
  const prompt = promptFor(S.content.terminal, S.state);
  const live = liveCommand(cmd);
  if (live) {
    S.lines.push({ text: prompt + cmd, type: 'cmd' });
    renderScreen();
    if (live.rule.action === 'recon') runReconCommand(live.arg, live.rule);
    return;
  }
  const r = runCourseCommand(S.content.terminal, cmd, S.state);
  if (r.clear) { S.lines = []; renderScreen(); scheduleSave(); return; }
  S.state = r.state;
  S.lines.push({ text: prompt + cmd, type: 'cmd' }, ...r.lines);
  if (S.lines.length > MAX_LINES) S.lines.splice(0, S.lines.length - MAX_LINES);
  renderScreen();
  updatePrompt();
  const key = explanationFor(cmd.replace(/\s+/g, ' '));
  if (key && key !== S.expl) selectCourseExplanation(key);
  else scheduleSave();
  recordFreshSteps(r.steps);
}

function recordFreshSteps(steps) {
  const fresh = steps.filter(s => !S.steps[s]);
  if (!fresh.length) return;
  cloud.recordCourseSteps(S.id, fresh)
    .then(applyServerSteps)
    .catch(err => { console.warn('No se pudo guardar el progreso:', err.message || err); showToast('No se pudo guardar el progreso', 'error'); });
}

// Copia del trabajo del alumno en la máquina Linux (.tgz de unos KB) guardada en este navegador, por alumno
// y curso, para devolverla al recargar la página. Si el navegador no deja guardar, se sigue sin copia.
const MAX_SNAPSHOT = 1024 * 1024;
function snapshotKey() {
  const s = appState.session || {};
  return `dev101x-lab:${s.userId || s.email || 'anon'}:${S.id}`;
}
function loadSnapshot() {
  try {
    const b64 = localStorage.getItem(snapshotKey());
    return b64 ? Uint8Array.from(atob(b64), c => c.charCodeAt(0)) : null;
  } catch (e) { return null; }
}
function saveSnapshot(data) {
  if (!(data instanceof Uint8Array) || !data.length || data.length > MAX_SNAPSHOT) return;
  try {
    let bin = '';
    for (let i = 0; i < data.length; i += 0x8000) bin += String.fromCharCode.apply(null, data.subarray(i, i + 0x8000));
    localStorage.setItem(snapshotKey(), btoa(bin));
  } catch (e) { /* sin espacio o almacenamiento bloqueado */ }
}
function clearSnapshot() {
  try { localStorage.removeItem(snapshotKey()); } catch (e) { /* nada */ }
}

// Datos del escenario del curso que necesita la máquina (vienen del contenido, solo con acceso al curso).
function linuxScenario() {
  const sc = S.content.terminal.scenario || {};
  return /^\d{1,6}$/.test(String(sc.prNumber ?? '')) ? { prNumber: Number(sc.prNumber) } : {};
}

// Mensajes de la terminal Linux real (lab-hook.sh → lab.js → aquí). Solo se aceptan del iframe del
// laboratorio. 'booted': pide escenario y copia guardada · 'save': copia nueva · 'state': tras cada comando,
// los pasos se deciden con las reglas del curso (terminal.real).
const sentValues = new Map();
function onLinuxMessage(e) {
  const frame = linuxFrame();
  if (!S || !frame || e.source !== frame.contentWindow || e.origin !== location.origin) return;
  const d = e.data;
  if (!d || d.type !== 'dev101x-lab') return;
  if (d.event === 'booted') {
    frame.contentWindow.postMessage({ type: 'dev101x-lab', setup: { scenario: linuxScenario(), restore: loadSnapshot() } }, location.origin);
    return;
  }
  if (d.event === 'ready' && d.restored) { showToast('Se recuperó tu trabajo en Linux', 'success'); return; }
  if (d.event === 'save') { saveSnapshot(d.data); return; }
  if (d.event !== 'state' || !d.state || typeof d.state.cmd !== 'string') return;
  const st = d.state;
  const state = {
    cmd: st.cmd.slice(0, 300), rc: Number(st.rc), dir: String(st.dir || '').slice(0, 120), repo: Boolean(st.repo),
    branch: String(st.branch || '').slice(0, 120), commits: Number(st.commits) || 0,
    upstream: String(st.upstream || '').slice(0, 120), conflict: Number(st.conflict) || 0,
    root: /^[0-9a-f]{40}$/.test(String(st.root || '')) ? st.root : ''
  };
  const key = explanationFor(state.cmd.replace(/\s+/g, ' '));
  if (key && key !== S.expl) selectCourseExplanation(key);
  recordFreshSteps(realCourseSteps(S.content.terminal.real, state, S.steps));
  realCourseValues(S.content.terminal.realValues, state).forEach(({ key: k, value }) => {
    const id = `${S.id}:${k}`;
    if (sentValues.get(id) === value) return;
    sentValues.set(id, value);
    cloud.recordCourseValue(S.id, k, value).catch(err => { sentValues.delete(id); console.warn('No se pudo guardar el dato del laboratorio:', err.message || err); });
  });
}
window.addEventListener('message', onLinuxMessage);

// Vuelve a empezar la máquina Linux desde cero (borra la copia guardada). El progreso del curso se conserva.
export function resetLinuxLab() {
  if (!S || !window.confirm('¿Reiniciar Linux? Se borra lo que hayas hecho en la máquina; tu progreso del curso se conserva.')) return;
  clearSnapshot();
  const frame = linuxFrame();
  if (frame) frame.remove();
  setCourseTerminalMode('linux');
}

export function runCourseCmdFromUi(el) {
  const linux = S && S.mode === 'linux';
  if (el.closest('#app-dialog')) {
    closeModal('app-dialog');
    const screen = document.getElementById(linux ? 'c-linux' : 'c-screen');
    if (screen) screen.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  if (linux) sendToLinux(el.dataset.cmd);
  else runCourseCmd(el.dataset.cmd);
}

// ---------------------------------------------------------------------------
// Terminal Linux real (iframe). Se crea la primera vez que el alumno la elige y se conserva al
// volver a la simulada, para no perder lo que haya hecho en la máquina.
// ---------------------------------------------------------------------------
function linuxFrame() {
  return document.querySelector('#c-linux iframe');
}

export function setCourseTerminalMode(mode) {
  if (!S || !LINUX_LAB_COURSES.has(S.id) || !['sim', 'linux'].includes(mode)) return;
  S.mode = mode;
  const linux = mode === 'linux';
  const box = document.getElementById('c-linux');
  if (linux && box && !linuxFrame()) {
    const frame = document.createElement('iframe');
    frame.src = LINUX_LAB_URL;
    frame.title = 'Terminal Linux real';
    frame.className = 'block w-full h-[440px] border-0';
    box.appendChild(frame);
  }
  const toggle = (id, hidden) => { const el = document.getElementById(id); if (el) el.classList.toggle('hidden', hidden); };
  toggle('c-sim', linux);
  toggle('c-sim-tools', linux);
  toggle('c-linux', !linux);
  toggle('c-linux-reset', !linux);
  // Sin reglas para la terminal real, lo que se hace ahí es práctica libre (no cuenta para el progreso).
  toggle('c-linux-note', !linux || Array.isArray(S.content.terminal.real));
  document.querySelectorAll('[data-action="c-mode"]').forEach(b => {
    const on = b.dataset.mode === mode;
    b.setAttribute('aria-pressed', String(on));
    b.className = b.className.replace(on ? MODE_OFF : MODE_ON, on ? MODE_ON : MODE_OFF);
  });
  if (linux) { const f = linuxFrame(); if (f) f.focus(); }
  else { const input = document.getElementById('c-input'); if (input) input.focus(); }
}

function sendToLinux(cmd) {
  const frame = linuxFrame();
  const text = String(cmd || '').trim();
  if (!frame || !frame.contentWindow || !text) return;
  frame.contentWindow.postMessage({ type: 'dev101x-lab', run: text }, location.origin);
  frame.focus();
}

// ---------------------------------------------------------------------------
// Ventanas: pista, lección, video y hoja de comandos
// ---------------------------------------------------------------------------
export function openCourseHint(step) {
  if (!S) return;
  const info = S.content.steps[step] || {};
  const p = computeCourseProgress(S.content, S.steps);
  openDialog({
    title: 'Pista',
    kicker: p.nextLesson ? p.nextLesson.title.toUpperCase() : '',
    body: `
      <div class="flex flex-col gap-4">
        <p class="flex items-start gap-3 text-[15px] leading-relaxed text-ink">
          <span class="material-symbols-outlined text-[22px] text-amber-500 shrink-0" aria-hidden="true">lightbulb</span><span>${esc(info.concept || '')}</span>
        </p>
        <details class="rounded-xl border border-line bg-bg/60">
          <summary class="list-none cursor-pointer px-4 py-3 text-xs font-semibold text-accent select-none">¿Sigues sin verlo? Muestra el comando</summary>
          <div class="px-4 pb-4 flex flex-col gap-2">
            <code class="block px-3 py-2 rounded-lg bg-term text-emerald-300 font-mono text-xs break-all">${esc(info.command || '')}</code>
            <button type="button" data-action="c-run" data-cmd="${esc(info.command || '')}" class="self-start h-9 px-4 rounded-xl bg-accent hover:bg-accent2 text-white text-xs font-semibold">Ejecutar en la terminal</button>
          </div>
        </details>
      </div>`
  });
}

function quizHtml(quiz, done) {
  if (done) return '<p class="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 text-xs text-emerald-900">✓ Pregunta respondida correctamente.</p>';
  return `
    <form data-action="c-quiz" data-step="${esc(quiz.step)}" class="flex flex-col gap-2">
      <p class="text-[13px] font-semibold text-ink">${esc(quiz.question)}</p>
      ${(quiz.options || []).map(([value, label]) => `
        <label class="flex items-start gap-2.5 p-2.5 rounded-lg border border-line hover:border-accent/60 bg-white cursor-pointer text-[13px] has-[:checked]:border-accent has-[:checked]:bg-emerald-50/60">
          <input type="radio" name="answer" value="${esc(value)}" required class="accent-accent mt-0.5" /><span>${esc(label)}</span>
        </label>`).join('')}
      <div class="flex items-center gap-3 pt-1">
        <button type="submit" class="h-9 px-4 rounded-xl bg-accent hover:bg-accent2 text-white text-xs font-semibold">Comprobar</button>
        <p data-quiz-result class="text-xs" role="status"></p>
      </div>
    </form>`;
}

function flagHtml(flag, done) {
  return `
    <form data-action="c-quiz" data-step="${esc(flag.step)}" class="flex flex-col gap-1.5">
      <label class="text-[13px] font-semibold text-ink" for="cf-${esc(flag.step)}">${esc(flag.question)}</label>
      ${done
        ? '<p class="text-xs text-accent font-semibold">✓ Respuesta correcta</p>'
        : `<div class="flex items-center gap-2">
            <input id="cf-${esc(flag.step)}" name="answer" type="text" required maxlength="100" autocomplete="off" spellcheck="false" placeholder="${esc(flag.placeholder || '')}" class="flex-1 min-w-0 h-9 px-3 rounded-lg border border-line bg-white font-mono text-xs outline-none focus:border-accent" />
            <button type="submit" class="h-9 px-3 rounded-xl bg-accent hover:bg-accent2 text-white text-xs font-semibold shrink-0">Enviar</button>
          </div>
          <p data-quiz-result class="text-xs" role="status"></p>`}
    </form>`;
}

export function openCourseLesson(id) {
  if (!S) return;
  const p = computeCourseProgress(S.content, S.steps);
  const lesson = p.lessons.find(l => l.id === id);
  if (!lesson) return;
  const done = p.lessonsDone.includes(id);
  const quiz = S.content.quizzes && S.content.quizzes[id];
  const video = safeVideoId(S.content.video && S.content.video.id);
  const commands = (lesson.afterAll ? p.lessons.flatMap(l => l.requires) : lesson.requires).filter(s => !isCheckStep(s));
  const uniqueCommands = [...new Set(commands)];

  const practice = uniqueCommands.map(step => {
    const info = S.content.steps[step] || {};
    const ok = Boolean(S.steps[step]);
    return `
      <li class="flex items-start gap-2">
        <span class="material-symbols-outlined text-[16px] shrink-0 mt-0.5 ${ok ? 'text-accent' : 'text-[#b6b2a9]'}" aria-hidden="true">${ok ? 'check_circle' : 'radio_button_unchecked'}</span>
        <div class="flex-1 min-w-0">
          <p class="text-[13px] ${ok ? 'text-ink2' : 'text-ink'}">${esc(info.concept || step)}</p>
          <details class="mt-1">
            <summary class="list-none cursor-pointer text-[11px] font-semibold text-accent hover:underline select-none">${ok ? 'Ver el comando' : 'Pista: ver el comando'}</summary>
            <button type="button" data-action="c-run" data-cmd="${esc(info.command || '')}" class="mt-1.5 max-w-full text-left px-2.5 py-1.5 rounded-lg bg-term hover:bg-term-3 text-emerald-300 font-mono text-[11px] truncate transition-colors">${esc(info.command || '')}</button>
          </details>
        </div>
      </li>`;
  }).join('');
  const section = (title, body) => `<section class="flex flex-col gap-2"><h3 class="text-[11px] font-mono font-bold text-muted uppercase tracking-wide">${title}</h3>${body}</section>`;

  openDialog({
    title: lesson.title,
    kicker: `${String(lesson.module).toUpperCase()} · ${lesson.time || ''}`,
    body: `
      <div class="flex flex-col gap-5" data-c-lesson="${esc(id)}">
        <span class="self-start px-2 py-0.5 rounded-md text-[10px] font-mono font-bold ${done ? 'bg-accent text-white' : 'bg-bg text-muted border border-line'}">${done ? '✓ COMPLETADA' : 'PENDIENTE'}</span>
        ${lesson.objective ? `
          <div class="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 flex gap-2.5">
            <span class="material-symbols-outlined text-accent text-[18px] shrink-0" aria-hidden="true">flag</span>
            <div><p class="text-[11px] font-mono font-bold text-accent mb-0.5">OBJETIVO</p><p class="text-[13px] text-emerald-950 leading-relaxed">${esc(lesson.objective)}</p></div>
          </div>` : ''}
        ${lesson.summary ? `<p class="text-[13px] leading-relaxed text-ink2">${esc(lesson.summary)}</p>` : ''}
        ${video && lesson.video ? `
          <button type="button" data-action="c-video" data-start="${Number(lesson.video.start) || 0}" class="flex items-center gap-3 p-2.5 rounded-xl border border-line hover:border-accent/60 bg-white text-left transition-colors">
            <span class="relative w-24 aspect-video rounded-lg overflow-hidden bg-term shrink-0">
              <img src="https://i.ytimg.com/vi/${video}/mqdefault.jpg" alt="" class="absolute inset-0 w-full h-full object-cover" loading="lazy" />
              <span class="absolute inset-0 flex items-center justify-center bg-black/25"><span class="material-symbols-outlined text-white text-2xl" aria-hidden="true">play_circle</span></span>
            </span>
            <span class="min-w-0">
              <span class="block text-[11px] font-mono text-muted">Ver en el video · ${fmtTime(Number(lesson.video.start) || 0)}</span>
              <span class="block text-[13px] font-bold text-ink truncate">${esc(lesson.video.label)}</span>
            </span>
          </button>` : ''}
        ${lesson.afterAll && Array.isArray(S.content.final) ? section('Reto final', `
          <p class="text-xs text-ink2">Usa la terminal para encontrar las respuestas. Tienes 3 intentos cada 10 minutos por pregunta.</p>
          ${S.content.final.map(f => flagHtml(f, Boolean(S.steps[f.step]))).join('')}`) : ''}
        ${uniqueCommands.length ? (lesson.afterAll
          ? `<details class="rounded-xl border border-line bg-white/60"><summary class="list-none cursor-pointer p-3 text-[11px] font-mono font-bold text-muted uppercase tracking-wide select-none">Repaso: todos los comandos</summary><ul class="flex flex-col gap-2.5 px-3 pb-3">${practice}</ul></details>`
          : section('Práctica en la terminal', `<ul class="flex flex-col gap-2.5">${practice}</ul>`)) : ''}
        ${quiz ? section('Comprueba lo aprendido', quizHtml(quiz, Boolean(S.steps[quiz.step]))) : ''}
        ${section('Mis notas', `
          <textarea data-note="${esc(id)}" maxlength="4000" rows="3" placeholder="Apuntes personales de esta lección (solo los ves tú)…" class="w-full p-3 rounded-xl border border-line bg-white text-[13px] outline-none focus:border-accent resize-y"></textarea>
          <p data-note-status class="text-[11px] text-muted font-mono h-4"></p>`)}
      </div>`
  });
  const area = document.querySelector(`textarea[data-note="${id}"]`);
  if (area) cloud.fetchNote(id).then(n => { if (n && document.body.contains(area) && !area.value) area.value = n.body; }).catch(() => {});
}

export async function submitCourseQuiz(form) {
  if (!S) return;
  const step = form.dataset.step;
  const input = form.querySelector('[name="answer"]:checked') || form.querySelector('input[name="answer"][type="text"]');
  const answer = input ? input.value.trim() : '';
  const out = form.querySelector('[data-quiz-result]');
  if (!answer) return;
  const button = form.querySelector('button[type="submit"]');
  if (button) button.disabled = true;
  try {
    const res = await cloud.answerCourseQuiz(S.id, step, answer);
    if (!res || !res.correct) {
      const left = res && typeof res.remaining === 'number' ? res.remaining : null;
      if (out) { out.className = 'text-xs text-rose-700'; out.textContent = left === 0 ? 'Incorrecto. Sin intentos: repasa la lección y vuelve en unos minutos.' : `Incorrecto. Te quedan ${left ?? 'algunos'} intentos.`; }
      return;
    }
    const before = computeCourseProgress(S.content, S.steps).lessonsDone.length;
    applyServerSteps(res.steps);
    if (computeCourseProgress(S.content, S.steps).lessonsDone.length === before) showToast('¡Correcto!', 'success');
    const holder = form.closest('[data-c-lesson]');
    if (holder) openCourseLesson(holder.dataset.cLesson);
  } catch (err) {
    console.error(err);
    if (out) { out.className = 'text-xs text-rose-700'; out.textContent = /intentos/i.test(err.message || '') ? err.message : 'No se pudo comprobar la respuesta. Inténtalo de nuevo.'; }
  } finally {
    if (button && document.body.contains(button)) button.disabled = false;
  }
}

function videoSrc(start, autoplay) {
  return `https://www.youtube-nocookie.com/embed/${safeVideoId(S.content.video.id)}?rel=0&start=${Number(start) || 0}${autoplay ? '&autoplay=1' : ''}`;
}

function chaptersHtml(active) {
  return (S.content.video.chapters || []).map(c => `
    <button type="button" data-action="c-seek" data-start="${Number(c.start) || 0}" class="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left text-xs transition-colors ${Number(c.start) === active ? 'bg-emerald-100/80 text-accent font-bold' : 'hover:bg-bg text-ink2'}">
      <span class="font-mono text-[11px] w-12 shrink-0 ${Number(c.start) === active ? 'text-accent' : 'text-muted'}">${fmtTime(Number(c.start) || 0)}</span><span class="truncate">${esc(c.label)}</span>
    </button>`).join('');
}

export function openCourseVideo(start = 0) {
  if (!S || !safeVideoId(S.content.video && S.content.video.id)) return;
  const v = S.content.video;
  openDialog({
    title: v.title,
    kicker: `VIDEO DE LA CLASE · ${v.author} · ${v.duration}`,
    size: 'lg',
    body: `
      <div class="flex flex-col gap-4">
        <div class="relative w-full aspect-video rounded-xl overflow-hidden bg-term border border-term-line">
          <iframe id="c-video" class="absolute inset-0 w-full h-full" src="${videoSrc(start, true)}" title="${esc(v.title)}" referrerpolicy="strict-origin-when-cross-origin" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>
        </div>
        <div>
          <h3 class="text-[11px] font-mono font-bold text-muted uppercase tracking-wide mb-1.5">Capítulos</h3>
          <div id="c-chapters" class="grid grid-cols-1 sm:grid-cols-2 gap-0.5">${chaptersHtml(Number(start) || 0)}</div>
        </div>
        <p class="text-[11px] text-muted">Video de <strong class="text-ink2">${esc(v.author)}</strong> en YouTube.</p>
      </div>`
  });
}

export function seekCourseVideo(start) {
  const frame = document.getElementById('c-video');
  if (!frame) return openCourseVideo(start);
  frame.src = videoSrc(start, true);
  const list = document.getElementById('c-chapters');
  if (list) list.innerHTML = chaptersHtml(Number(start) || 0);
}

export function openCourseCheatSheet() {
  if (!S) return;
  openDialog({
    title: 'Hoja de comandos',
    kicker: String(S.content.title).toUpperCase(),
    size: 'lg',
    body: `
      <div class="cheatsheet flex flex-col gap-4">
        <table class="w-full text-left border-collapse">
          <thead><tr class="border-b border-line text-[10px] font-mono text-muted uppercase"><th class="py-1.5 pr-3">Comando</th><th class="py-1.5">Para qué</th></tr></thead>
          <tbody>${(S.content.cheatsheet || []).map(([cmd, desc]) => `
            <tr class="border-b border-line/70 align-top"><td class="py-2 pr-3"><code class="font-mono text-[11px] text-accent font-bold break-all">${esc(cmd)}</code></td><td class="py-2 text-[11px] text-ink2">${esc(desc)}</td></tr>`).join('')}</tbody>
        </table>
        <button type="button" data-action="print-cheatsheet" class="no-print self-start h-9 px-4 rounded-xl bg-accent hover:bg-accent2 text-white text-xs font-semibold inline-flex items-center gap-1.5">
          <span class="material-symbols-outlined text-[18px]" aria-hidden="true">print</span>Imprimir o guardar PDF
        </button>
      </div>`
  });
}

export function openCourseResources() {
  if (!S) return;
  const list = (S.content.resources || []).filter(r => /^https:\/\/[^\s"'<>]+$/.test(String(r.url || '')));
  openDialog({
    title: 'Recursos del curso',
    kicker: String(S.content.title).toUpperCase(),
    body: `
      <ul class="flex flex-col gap-2">
        ${list.map(r => `
          <li>
            <a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer" class="flex items-start gap-3 p-3 rounded-xl border border-line hover:border-accent/60 bg-white transition-colors">
              <span class="material-symbols-outlined text-[18px] text-accent shrink-0 mt-0.5" aria-hidden="true">open_in_new</span>
              <span class="min-w-0 flex-1">
                <span class="flex items-center gap-2 flex-wrap">
                  <span class="text-[13px] font-bold text-ink">${esc(r.title)}</span>
                  ${r.tag ? `<span class="px-1.5 py-0.5 rounded bg-bg border border-line text-[10px] font-mono text-muted">${esc(r.tag)}</span>` : ''}
                </span>
                ${r.desc ? `<span class="block text-[12px] text-ink2 mt-0.5">${esc(r.desc)}</span>` : ''}
              </span>
            </a>
          </li>`).join('')}
      </ul>`
  });
}
