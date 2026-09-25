/**
 * Vista: Aula interactiva (terminal simulada, ficha técnica del comando, recursos de Nmap y temario).
 */
import { esc } from '../lib/html.js?v=dev101x-v57';
import { appState, saveState, initialTerminal } from '../state.js?v=dev101x-v57';
import { COURSE, COURSE_OBJECTIVES, COURSE_VIDEO, LESSON_DETAILS, STEP_HINTS, STEP_CONCEPTS, QUIZZES, FINAL_CHALLENGE, LAB_TARGET, LAB_HOST_IP, NMAP_RESOURCES, PENTESTING_COMMANDS, LAB_STEPS } from '../content.js?v=dev101x-v57';
import { runCommand, isLessonDone, pendingHints, pendingChecks, isCommandStep, MAX_TERMINAL_LINES } from '../lab.js?v=dev101x-v57';
import { recordSteps, applyServerSteps, currentProgress, currentSteps } from '../progress.js?v=dev101x-v57';
import { showToast, openDialog } from '../ui.js?v=dev101x-v57';
import { isCloudEnabled } from '../config.js?v=dev101x-v57';
import * as cloud from '../cloud.js?v=dev101x-v57';

const LINE_CLASSES = {
  error: 'text-red-400',
  cmd: 'text-emerald-400 font-bold',
  info: 'text-sky-300',
  slate: 'text-slate-400',
  hint: 'text-amber-300',
  system: 'text-slate-200',
  out: 'text-slate-200'
};
const PROMPT = 'PS C:\\Users\\Student\\Labs> ';
const TOTAL_LINKS = NMAP_RESOURCES.reduce((n, c) => n + c.items.length, 0);

const SAVED_LINES = 80;
const SAVE_DELAY = 1500;

const TAB_ACTIVE = 'font-bold bg-accent text-white';
const TAB_IDLE = 'font-semibold bg-white hover:bg-bg2 text-ink border border-line/70';

// ---------------------------------------------------------------------------
// Terminal
// ---------------------------------------------------------------------------
function lineNode(l) {
  const div = document.createElement('div');
  div.className = LINE_CLASSES[l.type] || LINE_CLASSES.out;
  div.textContent = l.text || '\u00a0';
  return div;
}

function renderTerminal() {
  const screen = document.getElementById('terminal-screen');
  if (!screen) return;
  screen.replaceChildren(...appState.terminalLines.map(lineNode));
  screen.scrollTop = screen.scrollHeight;
}

function appendLines(lines) {
  appState.terminalLines.push(...lines);
  const overflow = appState.terminalLines.length - MAX_TERMINAL_LINES;
  if (overflow > 0) appState.terminalLines.splice(0, overflow);
  const screen = document.getElementById('terminal-screen');
  if (!screen) return;
  if (overflow > 0) return renderTerminal();
  lines.forEach(l => screen.appendChild(lineNode(l)));
  screen.scrollTop = screen.scrollHeight;
}

function progressLines() {
  const p = currentProgress();
  const lines = [{ text: `[PROGRESO] ${p.percent}% · ${p.lessonsDone.length} lecciones · ${p.labsDone.length}/${LAB_STEPS.length} labs`, type: 'system' }];
  if (p.complete) {
    lines.push({ text: '¡Has completado todo el curso!', type: 'cmd' });
    return lines;
  }
  lines.push({ text: `Siguiente lección: ${p.nextLesson.title}`, type: 'info' });
  pendingHints(currentSteps()).forEach(h => lines.push({ text: `  → ${h.command}`, type: 'hint' }));
  if (pendingChecks(currentSteps()).length) lines.push({ text: '  → Responde la pregunta en la ficha de la lección (pulsa su título).', type: 'hint' });
  return lines;
}

// ---------------------------------------------------------------------------
// Estado de la terminal en Supabase (user_course_state): se retoma en cualquier dispositivo.
// En el navegador sigue la copia local; gana la más reciente.
// ---------------------------------------------------------------------------
let cloudTimer = null;

const cloudSyncOn = () => isCloudEnabled() && Boolean(appState.session && appState.session.mode === 'cloud');

function queueCloudSave() {
  appState.terminalSavedAt = Date.now();
  if (!cloudSyncOn()) return;
  clearTimeout(cloudTimer);
  cloudTimer = setTimeout(flushCloudSave, SAVE_DELAY);
}

function flushCloudSave() {
  if (!cloudTimer) return;
  clearTimeout(cloudTimer);
  cloudTimer = null;
  if (!cloudSyncOn()) return;
  const data = { v: 1, lines: appState.terminalLines.slice(-SAVED_LINES), expl: appState.activeCommandKey, at: appState.terminalSavedAt };
  cloud.saveCourseState(COURSE.id, data).catch(err => console.warn('No se pudo guardar la terminal:', err.message || err));
}
window.addEventListener('pagehide', flushCloudSave);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushCloudSave(); });

// El estado del servidor lo escribió el propio alumno: se valida antes de pintarlo.
async function pullCloudState() {
  if (!cloudSyncOn()) return;
  const saved = await cloud.fetchCourseState(COURSE.id).catch(() => null);
  if (!saved || typeof saved !== 'object' || !(Number(saved.at) > (Number(appState.terminalSavedAt) || 0))) return;
  const lines = (Array.isArray(saved.lines) ? saved.lines : [])
    .filter(l => l && typeof l.text === 'string' && LINE_CLASSES[l.type])
    .slice(-SAVED_LINES)
    .map(l => ({ text: l.text.slice(0, 400), type: l.type }));
  if (lines.length) appState.terminalLines = lines;
  if (PENTESTING_COMMANDS[saved.expl]) {
    appState.activeCommandKey = saved.expl;
    updateExplanationCard(saved.expl);
  }
  appState.terminalSavedAt = Number(saved.at);
  saveState(appState);
  renderTerminal();
}

export function executeCommand(raw) {
  const cmd = String(raw || '').trim().slice(0, 300);
  if (!cmd) return;
  const result = runCommand(cmd);

  if (result.clear) {
    appState.terminalLines = [];
    renderTerminal();
    queueCloudSave();
    saveState(appState);
    return;
  }

  const out = [{ text: PROMPT + cmd, type: 'cmd' }];
  if (result.showProgress) out.push(...progressLines());
  else out.push(...result.lines);

  if (result.steps.length) {
    const rec = recordSteps(result.steps);
    if (rec.changed) {
      rec.newLessons.forEach(id => {
        const lesson = COURSE.syllabus.flatMap(m => m.lessons).find(l => l.id === id);
        out.push({ text: `[LAB] ✓ Lección completada: ${lesson.title}`, type: 'hint' });
      });
      rec.newLabs.forEach(id => {
        const lab = LAB_STEPS.find(l => l.id === id);
        showToast(`Laboratorio completado: ${lab.title}`, 'success');
      });
      if (rec.progress.complete && rec.newLessons.length) {
        showToast('¡Felicidades! Has completado el 100% del curso.', 'success');
      }
      refreshSyllabus();
      refreshNextStep();
    }
  }
  appendLines(out);

  if (result.explanationKey) {
    appState.activeCommandKey = result.explanationKey;
    updateExplanationCard(result.explanationKey);
  }
  queueCloudSave();
  saveState(appState);
}

export function resetTerminal() {
  appState.terminalLines = initialTerminal();
  renderTerminal();
  queueCloudSave();
  saveState(appState);
}

// ---------------------------------------------------------------------------
// Ficha técnica del comando
// ---------------------------------------------------------------------------
function explanationCardHtml(key) {
  const d = PENTESTING_COMMANDS[key] || PENTESTING_COMMANDS.nmap;
  const section = (icon, title, body) => `
    <div class="space-y-1.5">
      <h4 class="font-bold uppercase font-mono text-[11px] flex items-center gap-1.5 text-accent">
        <span class="material-symbols-outlined text-sm" aria-hidden="true">${icon}</span>
        <span>${title}</span>
      </h4>
      <p class="text-ink2 leading-relaxed text-xs pl-5 border-l-2 border-accent/50">${esc(body)}</p>
    </div>`;

  return `
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-line">
      <div>
        <div class="flex items-center gap-2 mb-1 flex-wrap">
          <span class="px-2 py-0.5 rounded font-mono text-[10px] font-bold ${d.badgeClass}">${esc(d.badge)}</span>
          <span class="text-muted font-mono text-[11px]">${esc(d.category)}</span>
        </div>
        <h3 class="text-base font-bold text-ink">${esc(d.title)}</h3>
      </div>
      <div class="flex items-center gap-2 shrink-0">
        <button type="button" data-action="copy-cmd" data-cmd="${esc(d.cmd)}" class="px-3 py-1.5 rounded-xl bg-bg hover:bg-bg2 text-ink font-mono text-xs font-semibold flex items-center gap-1 border border-line transition-colors">
          <span class="material-symbols-outlined text-sm" aria-hidden="true">content_copy</span><span>Copiar</span>
        </button>
        <button type="button" data-action="run-cmd" data-cmd="${esc(d.cmd)}" class="px-3 py-1.5 rounded-xl bg-accent hover:bg-accent2 text-white font-mono text-xs font-semibold flex items-center gap-1 transition-colors">
          <span class="material-symbols-outlined text-sm" aria-hidden="true">terminal</span><span>Ejecutar en Consola</span>
        </button>
      </div>
    </div>

    <div class="bg-term p-3.5 rounded-xl border border-term-line text-slate-100 font-mono text-xs flex items-center justify-between gap-2 overflow-x-auto">
      <div class="flex items-center gap-2">
        <span class="text-emerald-400 select-none font-bold">PS&gt;</span>
        <span class="text-emerald-300 font-bold whitespace-nowrap">${esc(d.cmd)}</span>
      </div>
      <span class="text-[10px] text-slate-400 bg-term-2 px-2 py-0.5 rounded shrink-0 border border-term-line">PowerShell</span>
    </div>

    ${section('flag', '1. Propósito ofensivo y uso en auditoría', d.purpose)}

    <div class="space-y-2">
      <h4 class="font-bold uppercase font-mono text-[11px] flex items-center gap-1.5 text-accent">
        <span class="material-symbols-outlined text-sm" aria-hidden="true">tune</span><span>2. Desglose de flags y parámetros</span>
      </h4>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        ${d.flags.map(f => `
          <div class="bg-bg/60 p-3 rounded-xl border border-line/80 flex flex-col gap-1">
            <div class="flex items-center justify-between gap-2">
              <code class="font-mono font-bold text-accent bg-emerald-100/80 px-1.5 py-0.5 rounded text-[11px]">${esc(f.flag)}</code>
              <span class="text-[10px] font-mono text-muted font-semibold text-right">${esc(f.name)}</span>
            </div>
            <p class="text-ink2 text-[11px] leading-snug">${esc(f.desc)}</p>
          </div>`).join('')}
      </div>
    </div>

    ${section('laptop_windows', '3. ¿Por qué desde Windows?', d.windowsContext)}

    <div class="p-4 bg-emerald-50/70 rounded-xl border border-emerald-200 space-y-2">
      <div class="flex items-center justify-between gap-2 flex-wrap">
        <h4 class="font-bold text-emerald-950 font-mono text-[11px] flex items-center gap-1.5">
          <span class="material-symbols-outlined text-sm text-accent" aria-hidden="true">fact_check</span><span>4. Análisis de hallazgos en el laboratorio</span>
        </h4>
        <span class="text-[10px] font-mono text-accent font-bold bg-emerald-100/90 px-2 py-0.5 rounded-md">Target: ${LAB_TARGET}</span>
      </div>
      <p class="text-emerald-900 text-xs leading-relaxed">${esc(d.findings)}</p>
      <div class="mt-2 pt-2 border-t border-emerald-200/80 font-mono text-[11px] text-emerald-800 flex items-center gap-1.5 flex-wrap">
        <span class="font-bold">Firma detectada:</span>
        <code class="bg-emerald-100 px-2 py-0.5 rounded text-[10px] text-emerald-950 font-semibold">${esc(d.sampleOutput)}</code>
      </div>
    </div>

    ${d.officialLinks ? `
      <div class="p-4 bg-term text-white rounded-xl border border-term-line space-y-2.5">
        <h4 class="font-bold text-emerald-400 font-mono text-[11px] flex items-center gap-1.5">
          <span class="material-symbols-outlined text-sm" aria-hidden="true">link</span><span>5. Enlaces oficiales de documentación</span>
        </h4>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
          ${d.officialLinks.map(l => `
            <a href="${esc(l.url)}" target="_blank" rel="noopener noreferrer" class="px-3 py-2 rounded-lg bg-term-2 hover:bg-term-3 text-slate-200 hover:text-emerald-300 flex items-center justify-between text-[11px] font-mono transition-colors border border-term-line/80">
              <span class="flex items-center gap-2 truncate">
                <span class="material-symbols-outlined text-xs text-emerald-500" aria-hidden="true">${esc(l.icon)}</span>
                <span class="truncate">${esc(l.label)}</span>
              </span>
              <span class="text-[9px] px-1.5 py-0.5 rounded bg-black/40 text-emerald-300 shrink-0 ml-1.5 font-bold">${esc(l.badge)}</span>
            </a>`).join('')}
        </div>
      </div>` : ''}
  `;
}

export function updateExplanationCard(key) {
  const card = document.getElementById('command-explanation-card');
  if (card) card.innerHTML = explanationCardHtml(key);
  document.querySelectorAll('.cmd-tab-btn').forEach(btn => {
    const active = btn.dataset.key === key;
    btn.className = `cmd-tab-btn px-3 py-1.5 rounded-lg whitespace-nowrap transition-all ${active ? TAB_ACTIVE : TAB_IDLE}`;
    btn.setAttribute('aria-pressed', String(active));
  });
}

export function selectExplanation(key, autoRun) {
  if (!PENTESTING_COMMANDS[key]) return;
  appState.activeCommandKey = key;
  saveState(appState);
  updateExplanationCard(key);
  if (autoRun) executeCommand(PENTESTING_COMMANDS[key].cmd);
}

// ---------------------------------------------------------------------------
// Recursos Nmap
// ---------------------------------------------------------------------------
function resourcesHtml(idx) {
  const cat = NMAP_RESOURCES[idx] || NMAP_RESOURCES[0];
  return `
    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
      ${cat.items.map(item => `
        <a href="${esc(item.url)}" target="_blank" rel="noopener noreferrer" class="resource-card p-4 bg-surface hover:bg-bg/70 border border-line hover:border-accent/60 rounded-xl flex flex-col justify-between gap-3 group">
          <div class="flex items-start justify-between gap-2">
            <div class="flex items-center gap-2">
              <span class="material-symbols-outlined text-accent text-base shrink-0" aria-hidden="true">${esc(cat.icon)}</span>
              <h4 class="font-bold text-ink group-hover:text-accent transition-colors text-xs leading-snug">${esc(item.title)}</h4>
            </div>
            <span class="text-[9px] px-1.5 py-0.5 rounded font-mono font-bold shrink-0 border ${item.badgeClass}">${esc(item.badge)}</span>
          </div>
          <p class="text-ink2 text-[11px] leading-relaxed">${esc(item.desc)}</p>
          <div class="flex items-center justify-between text-[10px] font-mono pt-2 border-t border-line/60">
            <span class="truncate max-w-[200px] text-accent font-medium">${esc(item.url.replace('https://', ''))}</span>
            <span class="inline-flex items-center gap-0.5 text-accent font-bold">
              <span>Abrir</span><span class="material-symbols-outlined text-xs" aria-hidden="true">open_in_new</span>
            </span>
          </div>
        </a>`).join('')}
    </div>`;
}

export function switchNmapCategory(idx) {
  const i = Number(idx) || 0;
  appState.activeNmapCategory = i;
  saveState(appState);
  const container = document.getElementById('nmap-resources-container');
  if (container) container.innerHTML = resourcesHtml(i);
  document.querySelectorAll('.nmap-cat-btn').forEach(btn => {
    const active = Number(btn.dataset.idx) === i;
    btn.className = `nmap-cat-btn px-3 py-1.5 rounded-lg text-[11px] sm:text-xs transition-all whitespace-nowrap ${active ? TAB_ACTIVE : TAB_IDLE}`;
    btn.setAttribute('aria-pressed', String(active));
  });
}

// ---------------------------------------------------------------------------
// Temario y siguiente paso (se refrescan al completar pasos)
// ---------------------------------------------------------------------------
const ALL_LESSONS = COURSE.syllabus.flatMap(m => m.lessons);

function syllabusHtml() {
  const steps = currentSteps();
  const { nextLesson } = currentProgress();
  return COURSE.syllabus.map(m => {
    const doneCount = m.lessons.filter(l => isLessonDone(l, steps)).length;
    const complete = doneCount === m.lessons.length;
    return `
      <div class="flex flex-col gap-1">
        <div class="flex items-center justify-between gap-2 px-1 pb-0.5">
          <span class="font-bold text-ink text-[11px] font-sans leading-snug">${esc(m.module)}</span>
          <span class="text-[10px] shrink-0 font-mono ${complete ? 'text-accent font-bold' : 'text-muted'}">${complete ? '✓' : `${doneCount}/${m.lessons.length}`}</span>
        </div>
        ${m.lessons.map(l => {
          const done = isLessonDone(l, steps);
          const active = l === nextLesson;
          const icon = done ? 'check_circle' : active ? 'play_circle' : 'radio_button_unchecked';
          const hasVideo = LESSON_DETAILS[l.id] && LESSON_DETAILS[l.id].video;
          return `
            <button type="button" data-action="open-lesson" data-id="${esc(l.id)}"
              class="w-full flex items-center gap-2 py-2 px-2 rounded-lg text-left transition-colors ${active ? 'bg-emerald-100/70 text-accent' : 'hover:bg-bg'}">
              <span class="material-symbols-outlined text-[16px] shrink-0 ${done || active ? 'text-accent' : 'text-[#b6b2a9]'}" aria-hidden="true">${icon}</span>
              <span class="flex-1 min-w-0 truncate font-sans text-[12px] ${active ? 'font-bold' : 'text-ink2'}">${esc(l.title)}</span>
              ${hasVideo ? '<span class="material-symbols-outlined text-[14px] text-rose-500 shrink-0" title="Incluye video" aria-label="Incluye video">smart_display</span>' : ''}
              <span class="text-[10px] shrink-0 font-mono text-muted">${esc(l.time)}</span>
            </button>`;
        }).join('')}
      </div>`;
  }).join('<div class="border-t border-line/60 my-1"></div>');
}

// Pistas por niveles, en ventana emergente: 1) concepto, 2) comando exacto (se revela al pulsar).
export function openHint(step) {
  const p = currentProgress();
  openDialog({
    title: 'Pista',
    kicker: p.nextLesson ? p.nextLesson.title.toUpperCase() : '',
    body: `
      <div class="flex flex-col gap-4">
        <p class="flex items-start gap-3 text-[15px] leading-relaxed text-ink">
          <span class="material-symbols-outlined text-[22px] text-amber-500 shrink-0" aria-hidden="true">lightbulb</span>
          <span>${esc(STEP_CONCEPTS[step] || '')}</span>
        </p>
        <details class="rounded-xl border border-line bg-bg/60">
          <summary class="list-none cursor-pointer px-4 py-3 text-xs font-semibold text-accent select-none">¿Sigues sin verlo? Muestra el comando</summary>
          <div class="px-4 pb-4 flex flex-col gap-2">
            <code class="block px-3 py-2 rounded-lg bg-term text-emerald-300 font-mono text-xs break-all">${esc(STEP_HINTS[step])}</code>
            <button type="button" data-action="run-cmd" data-cmd="${esc(STEP_HINTS[step])}" class="self-start h-9 px-4 rounded-xl bg-accent hover:bg-accent2 text-white text-xs font-semibold">Ejecutar en la consola</button>
          </div>
        </details>
      </div>`
  });
}

function nextStepHtml() {
  const p = currentProgress();
  if (p.complete) {
    return `<p class="text-xs text-accent font-semibold">✓ Has completado todas las lecciones del curso.</p>`;
  }
  const steps = currentSteps();
  const hints = pendingHints(steps);
  const checks = pendingChecks(steps);
  return `
    <div class="flex flex-wrap items-center gap-1.5">
      <span class="text-[11px] font-mono text-muted mr-1">${hints.length ? 'Practica:' : 'Siguiente:'}</span>
      ${hints.map((h, i) => `
        <button type="button" data-action="open-hint" data-step="${esc(h.step)}" class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 text-[11px] font-semibold">
          <span class="material-symbols-outlined text-[14px]" aria-hidden="true">lightbulb</span>Pista ${i + 1}
        </button>`).join('')}
      ${!hints.length && checks.length ? `
        <button type="button" data-action="open-lesson" data-id="${esc(p.nextLesson.id)}" class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-accent hover:bg-accent2 text-white text-[11px] font-semibold">
          <span class="material-symbols-outlined text-[14px]" aria-hidden="true">quiz</span>${p.nextLesson.afterAll ? 'Resolver el reto final' : 'Responder la pregunta de la lección'}
        </button>` : ''}
    </div>`;
}

function refreshSyllabus() {
  const el = document.getElementById('syllabus-list');
  if (el) el.innerHTML = syllabusHtml();
}

function refreshNextStep() {
  const el = document.getElementById('next-step');
  if (el) el.innerHTML = nextStepHtml();
  const p = currentProgress();
  const title = document.getElementById('aula-lesson-title');
  if (title) {
    title.textContent = p.nextLesson ? p.nextLesson.title : 'Curso completado';
    title.dataset.id = p.nextLesson ? p.nextLesson.id : '';
  }
  const mod = document.getElementById('aula-module-title');
  if (mod) mod.textContent = p.currentModule.module;
  const pct = document.getElementById('aula-percent');
  if (pct) pct.textContent = `${p.percent}%`;
  const bar = document.getElementById('aula-percent-bar');
  if (bar) bar.style.width = `${p.percent}%`;
}

// ---------------------------------------------------------------------------
// Ventanas emergentes: video, lección y recursos
// ---------------------------------------------------------------------------
function fmtTime(sec) {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}

function videoSrc(start, autoplay) {
  return `https://www.youtube-nocookie.com/embed/${COURSE_VIDEO.id}?rel=0&start=${start}${autoplay ? '&autoplay=1' : ''}`;
}

function chapterButtonsHtml(active) {
  return COURSE_VIDEO.chapters.map(c => `
    <button type="button" data-action="video-seek" data-start="${c.start}" aria-pressed="${c.start === active}"
      class="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left text-xs transition-colors ${c.start === active ? 'bg-emerald-100/80 text-accent font-bold' : 'hover:bg-bg text-ink2'}">
      <span class="font-mono text-[11px] w-10 shrink-0 ${c.start === active ? 'text-accent' : 'text-muted'}">${fmtTime(c.start)}</span>
      <span class="truncate">${esc(c.label)}</span>
    </button>`).join('');
}

export function openVideo(start = 0) {
  openDialog({
    title: COURSE_VIDEO.title,
    kicker: `VIDEO DE LA CLASE · ${COURSE_VIDEO.author} · ${COURSE_VIDEO.duration}`,
    size: 'lg',
    body: `
      <div class="flex flex-col gap-4">
        <div class="relative w-full aspect-video rounded-xl overflow-hidden bg-term border border-term-line">
          <iframe id="course-video" class="absolute inset-0 w-full h-full" src="${videoSrc(start, true)}"
            title="${esc(COURSE_VIDEO.title)}" referrerpolicy="strict-origin-when-cross-origin"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>
        </div>
        <div>
          <h3 class="text-[11px] font-mono font-bold text-muted uppercase tracking-wide mb-1.5">Capítulos</h3>
          <div id="video-chapters" class="grid grid-cols-1 sm:grid-cols-2 gap-0.5">${chapterButtonsHtml(start)}</div>
        </div>
        <p class="text-[11px] text-muted">Video de <strong class="text-ink2">${esc(COURSE_VIDEO.author)}</strong> en YouTube. Se graba en Kali Linux, pero los comandos de Nmap son los mismos en la consola de Windows.</p>
      </div>`
  });
}

export function seekVideo(start) {
  const frame = document.getElementById('course-video');
  if (!frame) return openVideo(start);
  frame.src = videoSrc(start, true);
  const list = document.getElementById('video-chapters');
  if (list) list.innerHTML = chapterButtonsHtml(start);
}

function quizHtml(quiz, done) {
  if (done) {
    return `
      <div class="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 text-xs text-emerald-900 flex items-center gap-2">
        <span class="material-symbols-outlined text-[18px] text-accent" aria-hidden="true">task_alt</span>Pregunta respondida correctamente.
      </div>`;
  }
  return `
    <form data-action="quiz" data-step="${esc(quiz.step)}" class="flex flex-col gap-2">
      <p class="text-[13px] font-semibold text-ink">${esc(quiz.question)}</p>
      ${quiz.options.map(([value, label]) => `
        <label class="flex items-start gap-2.5 p-2.5 rounded-lg border border-line hover:border-accent/60 bg-white cursor-pointer text-[13px] has-[:checked]:border-accent has-[:checked]:bg-emerald-50/60">
          <input type="radio" name="answer" value="${esc(value)}" required class="accent-accent mt-0.5" />
          <span>${esc(label)}</span>
        </label>`).join('')}
      <div class="flex items-center gap-3 pt-1">
        <button type="submit" class="h-9 px-4 rounded-xl bg-accent hover:bg-accent2 text-white text-xs font-semibold">Comprobar</button>
        <p data-quiz-result class="text-xs" role="status"></p>
      </div>
    </form>`;
}

function flagHtml(flag, done) {
  return `
    <form data-action="quiz" data-step="${esc(flag.step)}" class="flex flex-col gap-1.5">
      <label class="text-[13px] font-semibold text-ink" for="flag-${esc(flag.step)}">${esc(flag.question)}</label>
      ${done
        ? '<p class="text-xs text-accent font-semibold flex items-center gap-1"><span class="material-symbols-outlined text-[16px]" aria-hidden="true">task_alt</span>Respuesta correcta</p>'
        : `<div class="flex items-center gap-2">
            <input id="flag-${esc(flag.step)}" name="answer" type="text" required maxlength="100" autocomplete="off" spellcheck="false" placeholder="${esc(flag.placeholder)}" class="flex-1 min-w-0 h-9 px-3 rounded-lg border border-line bg-white font-mono text-xs outline-none focus:border-accent" />
            <button type="submit" class="h-9 px-3 rounded-xl bg-accent hover:bg-accent2 text-white text-xs font-semibold shrink-0">Enviar</button>
          </div>
          <p data-quiz-result class="text-xs" role="status"></p>`}
    </form>`;
}

export function openLesson(id) {
  const lesson = ALL_LESSONS.find(l => l.id === id);
  if (!lesson) return;
  const module = COURSE.syllabus.find(m => m.lessons.includes(lesson));
  const detail = LESSON_DETAILS[id] || {};
  const steps = currentSteps();
  const done = isLessonDone(lesson, steps);
  const commands = lesson.afterAll
    ? [...new Set(ALL_LESSONS.flatMap(l => l.requires).filter(isCommandStep))]
    : lesson.requires.filter(isCommandStep);
  const quiz = QUIZZES[id];

  const practice = commands.map(step => {
    const ok = Boolean(steps[step]);
    return `
      <li class="flex items-start gap-2">
        <span class="material-symbols-outlined text-[16px] shrink-0 mt-0.5 ${ok ? 'text-accent' : 'text-[#b6b2a9]'}" aria-hidden="true">${ok ? 'check_circle' : 'radio_button_unchecked'}</span>
        <div class="flex-1 min-w-0">
          <p class="text-[13px] ${ok ? 'text-ink2' : 'text-ink'}">${esc(STEP_CONCEPTS[step] || '')}</p>
          <details class="mt-1">
            <summary class="list-none cursor-pointer text-[11px] font-semibold text-accent hover:underline select-none">${ok ? 'Ver el comando' : 'Pista: ver el comando'}</summary>
            <button type="button" data-action="run-cmd" data-cmd="${esc(STEP_HINTS[step])}" class="mt-1.5 max-w-full text-left px-2.5 py-1.5 rounded-lg bg-term hover:bg-term-3 text-emerald-300 font-mono text-[11px] truncate transition-colors" title="Ejecutar en la consola">${esc(STEP_HINTS[step])}</button>
          </details>
        </div>
      </li>`;
  }).join('');

  const section = (title, body) => `
    <section class="flex flex-col gap-2">
      <h3 class="text-[11px] font-mono font-bold text-muted uppercase tracking-wide">${title}</h3>
      ${body}
    </section>`;

  openDialog({
    title: lesson.title,
    kicker: `${module.module.toUpperCase()} · ${lesson.time}`,
    body: `
      <div class="flex flex-col gap-5" data-lesson="${esc(id)}">
        <span class="self-start px-2 py-0.5 rounded-md text-[10px] font-mono font-bold ${done ? 'bg-accent text-white' : 'bg-bg text-muted border border-line'}">${done ? '✓ COMPLETADA' : 'PENDIENTE'}</span>
        ${detail.objective ? `
          <div class="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 flex gap-2.5">
            <span class="material-symbols-outlined text-accent text-[18px] shrink-0" aria-hidden="true">flag</span>
            <div><p class="text-[11px] font-mono font-bold text-accent mb-0.5">OBJETIVO</p><p class="text-[13px] text-emerald-950 leading-relaxed">${esc(detail.objective)}</p></div>
          </div>` : ''}
        ${detail.summary ? `<p class="text-[13px] leading-relaxed text-ink2">${esc(detail.summary)}</p>` : ''}
        ${detail.video ? `
          <button type="button" data-action="open-video" data-start="${detail.video.start}" class="flex items-center gap-3 p-2.5 rounded-xl border border-line hover:border-accent/60 bg-white text-left transition-colors">
            <span class="relative w-24 aspect-video rounded-lg overflow-hidden bg-term shrink-0">
              <img src="https://i.ytimg.com/vi/${COURSE_VIDEO.id}/mqdefault.jpg" alt="" class="absolute inset-0 w-full h-full object-cover" loading="lazy" />
              <span class="absolute inset-0 flex items-center justify-center bg-black/25"><span class="material-symbols-outlined text-white text-2xl" aria-hidden="true">play_circle</span></span>
            </span>
            <span class="min-w-0">
              <span class="block text-[11px] font-mono text-muted">Ver en el video · ${fmtTime(detail.video.start)}</span>
              <span class="block text-[13px] font-bold text-ink truncate">${esc(detail.video.label)}</span>
            </span>
          </button>` : ''}
        ${lesson.afterAll ? section('Reto final', `
          <p class="text-xs text-ink2">Usa la consola sobre ${esc(LAB_TARGET)} para encontrar las respuestas. Tienes 3 intentos cada 10 minutos por pregunta.</p>
          ${FINAL_CHALLENGE.map(f => flagHtml(f, Boolean(steps[f.step]))).join('')}`) : ''}
        ${lesson.afterAll
          ? `<details class="rounded-xl border border-line bg-white/60">
              <summary class="list-none cursor-pointer p-3 text-[11px] font-mono font-bold text-muted uppercase tracking-wide select-none">Repaso: todos los comandos (${commands.filter(c => steps[c]).length}/${commands.length})</summary>
              <ul class="flex flex-col gap-2.5 px-3 pb-3">${practice}</ul>
            </details>`
          : section('Práctica en la consola', `<ul class="flex flex-col gap-2.5">${practice}</ul>`)}
        ${quiz ? section('Comprueba lo aprendido', quizHtml(quiz, Boolean(steps[quiz.step]))) : ''}
        ${isCloudEnabled() ? section('Mis notas', `
          <textarea data-note="${esc(id)}" maxlength="4000" rows="3" placeholder="Apuntes personales de esta lección (solo los ves tú)…" class="w-full p-3 rounded-xl border border-line bg-white text-[13px] outline-none focus:border-accent resize-y"></textarea>
          <p data-note-status class="text-[11px] text-muted font-mono h-4"></p>`) : ''}
      </div>`
  });
  loadNote(id);
}

// ---------------------------------------------------------------------------
// Preguntas: la respuesta la valida el servidor (answer_quiz).
// ---------------------------------------------------------------------------
export async function submitQuiz(form) {
  const step = form.dataset.step;
  const input = form.querySelector('[name="answer"]:checked') || form.querySelector('input[name="answer"][type="text"]');
  const answer = input ? input.value.trim() : '';
  const out = form.querySelector('[data-quiz-result]');
  if (!answer) return;
  const button = form.querySelector('button[type="submit"]');
  if (button) button.disabled = true;
  try {
    const res = await cloud.answerQuiz(step, answer);
    if (!res || !res.correct) {
      const left = res && typeof res.remaining === 'number' ? res.remaining : null;
      if (out) {
        out.className = 'text-xs text-rose-700';
        out.textContent = left === 0 ? 'Incorrecto. Sin intentos: repasa la lección y vuelve en unos minutos.' : `Incorrecto. Te quedan ${left ?? 'algunos'} intentos.`;
      }
      return;
    }
    const rec = applyServerSteps(res.steps);
    refreshSyllabus();
    refreshNextStep();
    rec.newLessons.forEach(lid => {
      const l = ALL_LESSONS.find(x => x.id === lid);
      if (l) showToast(`Lección completada: ${l.title}`, 'success');
    });
    if (rec.progress.complete && rec.newLessons.length) showToast('¡Felicidades! Has completado el 100% del curso.', 'success');
    else if (!rec.newLessons.length) showToast('¡Correcto!', 'success');
    const lessonId = form.closest('[data-lesson]') && form.closest('[data-lesson]').dataset.lesson;
    if (lessonId) openLesson(lessonId);
  } catch (err) {
    console.error(err);
    if (out) {
      out.className = 'text-xs text-rose-700';
      out.textContent = /intentos/i.test(err.message || '') ? err.message : 'No se pudo comprobar la respuesta. Inténtalo de nuevo.';
    }
  } finally {
    if (button && document.body.contains(button)) button.disabled = false;
  }
}

// ---------------------------------------------------------------------------
// Notas personales (se guardan solas a los 800 ms de dejar de escribir)
// ---------------------------------------------------------------------------
let noteTimer = null;

async function loadNote(lessonId) {
  const area = document.querySelector(`textarea[data-note="${lessonId}"]`);
  if (!area) return;
  area.disabled = true;
  try {
    const note = await cloud.fetchNote(lessonId);
    if (note && document.body.contains(area) && !area.value) area.value = note.body;
  } catch (e) {
    console.warn('No se pudo cargar la nota:', e.message || e);
  } finally {
    area.disabled = false;
  }
}

export function onNoteInput(area) {
  const status = area.parentElement.querySelector('[data-note-status]');
  if (status) status.textContent = 'Escribiendo…';
  clearTimeout(noteTimer);
  noteTimer = setTimeout(async () => {
    try {
      await cloud.saveNote(area.dataset.note, area.value.slice(0, 4000));
      if (status && document.body.contains(status)) status.textContent = '✓ Guardado';
    } catch (e) {
      console.warn('No se pudo guardar la nota:', e.message || e);
      if (status && document.body.contains(status)) status.textContent = 'No se pudo guardar';
    }
  }, 800);
}

// ---------------------------------------------------------------------------
// Hoja de comandos (imprimible / guardar como PDF)
// ---------------------------------------------------------------------------
export function openCheatSheet() {
  const rows = Object.values(PENTESTING_COMMANDS).map(c => `
    <tr class="border-b border-line/70 align-top">
      <td class="py-2 pr-3 font-mono text-[11px] text-accent font-bold whitespace-nowrap">${esc(c.name)}</td>
      <td class="py-2 pr-3"><code class="font-mono text-[11px] text-ink break-all">${esc(c.cmd)}</code></td>
      <td class="py-2 text-[11px] text-ink2">${esc(c.title)}</td>
    </tr>`).join('');
  const flags = (PENTESTING_COMMANDS.nmap && PENTESTING_COMMANDS.nmap.flags) || [];
  openDialog({
    title: 'Hoja de comandos',
    kicker: `${COURSE.title.toUpperCase()}`,
    size: 'lg',
    body: `
      <div class="cheatsheet flex flex-col gap-4">
        <table class="w-full text-left border-collapse">
          <thead><tr class="border-b border-line text-[10px] font-mono text-muted uppercase"><th class="py-1.5 pr-3">Herramienta</th><th class="py-1.5 pr-3">Comando</th><th class="py-1.5">Para qué</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        ${flags.length ? `
          <div>
            <h3 class="text-[11px] font-mono font-bold text-muted uppercase tracking-wide mb-1.5">Flags de Nmap</h3>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
              ${flags.map(f => `<p class="text-[11px]"><code class="font-mono font-bold text-accent">${esc(f.flag)}</code> <span class="text-ink2">${esc(f.name)}</span></p>`).join('')}
            </div>
          </div>` : ''}
        <p class="text-[10px] text-muted">Objetivo del laboratorio: ${esc(LAB_TARGET)} · Usa estas técnicas solo en sistemas con autorización.</p>
        <button type="button" data-action="print-cheatsheet" class="no-print self-start h-9 px-4 rounded-xl bg-accent hover:bg-accent2 text-white text-xs font-semibold inline-flex items-center gap-1.5">
          <span class="material-symbols-outlined text-[18px]" aria-hidden="true">print</span>Imprimir o guardar PDF
        </button>
      </div>`
  });
}

export function printCheatSheet() {
  document.body.classList.add('printing-dialog');
  window.print();
  setTimeout(() => document.body.classList.remove('printing-dialog'), 500);
}

const DOWNLOADS = [
  ['https://nmap.org/download.html#windows', 'Descargar Nmap para Windows', 'Oficial'],
  ['https://npcap.com/#download', 'Npcap (driver de captura)', 'Windows'],
  ['https://nmap.org/book/', 'Libro oficial de Nmap', 'Libro'],
  ['https://nmap.org/nsedoc/', 'Catálogo de scripts NSE', '600+'],
  ['https://www.sans.org/posters/nmap-cheat-sheet/', 'SANS Nmap Cheat Sheet', 'PDF']
];

export function openResources() {
  const activeCatIdx = NMAP_RESOURCES[appState.activeNmapCategory] ? appState.activeNmapCategory : 0;
  openDialog({
    title: 'Recursos del curso',
    kicker: `${TOTAL_LINKS + DOWNLOADS.length} ENLACES OFICIALES`,
    size: 'lg',
    body: `
      <div class="flex flex-col gap-5">
        <section>
          <h3 class="text-[11px] font-mono font-bold text-muted uppercase tracking-wide mb-2">Descargas y manuales</h3>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            ${DOWNLOADS.map(([url, label, tag]) => `
              <a href="${url}" target="_blank" rel="noopener noreferrer" class="px-3 py-2.5 rounded-lg bg-white border border-line hover:border-accent/60 flex items-center justify-between gap-2 text-xs text-ink hover:text-accent transition-colors">
                <span class="truncate font-semibold">${label}</span><span class="text-[10px] font-mono text-muted shrink-0">${tag}</span>
              </a>`).join('')}
          </div>
        </section>
        <section class="flex flex-col gap-2.5">
          <h3 class="text-[11px] font-mono font-bold text-muted uppercase tracking-wide">Documentación de Nmap</h3>
          <div class="flex items-center gap-1.5 overflow-x-auto cmd-tab-bar pb-1 font-mono text-xs">
            ${NMAP_RESOURCES.map((c, i) => `
              <button type="button" data-action="nmap-cat" data-idx="${i}" aria-pressed="${i === activeCatIdx}" class="nmap-cat-btn px-3 py-1.5 rounded-lg text-[11px] sm:text-xs transition-all whitespace-nowrap ${i === activeCatIdx ? TAB_ACTIVE : TAB_IDLE}">${esc(c.categoryShort)}</button>`).join('')}
          </div>
          <div id="nmap-resources-container">${resourcesHtml(activeCatIdx)}</div>
        </section>
      </div>`
  });
}

// ---------------------------------------------------------------------------
// Render principal
// ---------------------------------------------------------------------------
function collapsible(id, icon, title, body) {
  return `
    <button type="button" data-action="toggle-panel" data-target="${id}" aria-expanded="false" aria-controls="${id}" class="lg:hidden w-full flex items-center justify-between gap-2 p-4 text-left">
      <span class="flex items-center gap-2 min-w-0">
        <span class="material-symbols-outlined text-base text-accent" aria-hidden="true">${icon}</span>
        <span class="font-bold text-xs uppercase font-mono text-ink">${title}</span>
      </span>
      <span data-chevron class="material-symbols-outlined text-base text-muted transition-transform" aria-hidden="true">expand_more</span>
    </button>
    <div id="${id}" class="hidden lg:flex flex-col gap-3 p-4 pt-0 lg:pt-4">${body}</div>`;
}

export function renderAula(container, courseId) {
  if (courseId !== COURSE.id || !appState.enabledCourses.includes(COURSE.id)) {
    container.innerHTML = `
      <div class="max-w-lg mx-auto my-12 p-6 bg-surface rounded-2xl border border-line text-center flex flex-col gap-3 items-center">
        <span class="material-symbols-outlined text-3xl text-muted" aria-hidden="true">lock</span>
        <h1 class="text-lg font-bold text-ink">No tienes acceso a este curso</h1>
        <p class="text-sm text-muted">Tu acceso no está habilitado o fue revocado por la administración.</p>
        <a href="#/mis-cursos" class="px-4 py-2 bg-accent hover:bg-accent2 text-white rounded-xl text-sm font-semibold">Volver a Mis Cursos</a>
      </div>`;
    return;
  }

  const activeCmdKey = PENTESTING_COMMANDS[appState.activeCommandKey] ? appState.activeCommandKey : 'nmap';
  const p = currentProgress();
  const commandKeys = Object.keys(PENTESTING_COMMANDS);

  container.innerHTML = `
    <div class="flex flex-col w-full py-4 sm:py-6 gap-4 sm:gap-5">
      <section class="bg-surface p-4 sm:p-5 rounded-2xl border border-line flex flex-col gap-3">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2 font-mono text-[11px] flex-wrap text-muted">
              <span class="px-2 py-0.5 rounded-md bg-accent text-white font-bold">${esc(COURSE.title.split(':')[0])}</span>
              <span id="aula-module-title">${esc(p.currentModule.module)}</span>
            </div>
            <button type="button" data-action="open-lesson" id="aula-lesson-title" data-id="${p.nextLesson ? esc(p.nextLesson.id) : ''}" class="block text-left text-[15px] sm:text-lg font-bold text-ink mt-1.5 leading-snug hover:text-accent transition-colors" title="Ver la ficha de la lección">${esc(p.nextLesson ? p.nextLesson.title : 'Curso completado')}</button>
          </div>
          <div class="flex items-center gap-2 shrink-0 flex-wrap">
            <button type="button" data-action="open-video" data-start="0" class="h-9 px-3 rounded-xl bg-white border border-line hover:border-accent/60 text-xs font-semibold text-ink flex items-center gap-1.5 transition-colors">
              <span class="material-symbols-outlined text-[18px] text-rose-500" aria-hidden="true">smart_display</span><span>Video de la clase</span>
            </button>
            <button type="button" data-action="open-resources" class="h-9 px-3 rounded-xl bg-white border border-line hover:border-accent/60 text-xs font-semibold text-ink flex items-center gap-1.5 transition-colors">
              <span class="material-symbols-outlined text-[18px] text-accent" aria-hidden="true">menu_book</span><span>Recursos</span>
            </button>
            <button type="button" data-action="open-cheatsheet" class="h-9 px-3 rounded-xl bg-white border border-line hover:border-accent/60 text-xs font-semibold text-ink flex items-center gap-1.5 transition-colors" title="Hoja de comandos imprimible">
              <span class="material-symbols-outlined text-[18px] text-accent" aria-hidden="true">description</span><span class="hidden sm:inline">Hoja de comandos</span>
            </button>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <div class="flex-1 bg-bg h-1.5 rounded-full overflow-hidden" role="progressbar" aria-valuenow="${p.percent}" aria-valuemin="0" aria-valuemax="100" aria-label="Progreso del curso">
            <div id="aula-percent-bar" class="bg-accent h-full rounded-full transition-all duration-500" style="width: ${p.percent}%;"></div>
          </div>
          <span id="aula-percent" class="font-mono text-[11px] font-bold text-accent tabular-nums">${p.percent}%</span>
        </div>
        <div id="next-step">${nextStepHtml()}</div>
        <p class="flex items-start gap-1.5 text-[11px] text-muted pt-2 border-t border-line/60">
          <span class="material-symbols-outlined text-[14px] text-amber-600 mt-px" aria-hidden="true">gavel</span>
          <span>Practica solo en este laboratorio o en sistemas propios o con autorización expresa. Escanear equipos ajenos sin permiso puede ser un delito.</span>
        </p>
      </section>

      <div class="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 items-start">
        <div class="lg:col-span-8 flex flex-col gap-4 sm:gap-5">

          <section class="bg-term rounded-2xl border border-term-line overflow-hidden font-mono text-xs" aria-label="Terminal del laboratorio">
            <div class="p-3 bg-term-2 text-slate-300 flex items-center justify-between gap-2 text-[11px] border-b border-term-line">
              <div class="flex items-center gap-2.5 min-w-0">
                <div class="hidden sm:flex items-center gap-1.5" aria-hidden="true">
                  <span class="w-3 h-3 rounded-full bg-[#ff5f56]/80"></span><span class="w-3 h-3 rounded-full bg-[#ffbd2e]/80"></span><span class="w-3 h-3 rounded-full bg-[#27c93f]/80"></span>
                </div>
                <span class="font-bold text-slate-100 truncate">PowerShell — ${LAB_HOST_IP}</span>
                <span class="text-emerald-400 hidden md:inline">→ target ${LAB_TARGET}</span>
              </div>
              <div class="flex items-center gap-2 shrink-0">
                <button type="button" data-action="run-cmd" data-cmd="progreso" class="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-emerald-300 text-[10px]">progreso</button>
                <button type="button" data-action="run-cmd" data-cmd="cls" class="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px]">cls</button>
                <button type="button" data-action="run-cmd" data-cmd="help" class="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 text-[10px]">help</button>
              </div>
            </div>

            <div id="terminal-screen" role="log" aria-live="polite" class="p-3.5 sm:p-4 h-56 sm:h-80 overflow-y-auto space-y-1 text-slate-200 text-[11px] sm:text-xs leading-relaxed whitespace-pre-wrap break-words"></div>

            <form data-action="terminal" class="p-3 bg-term-deep border-t border-term-line flex items-center gap-2">
              <label for="terminal-input" class="text-emerald-400 text-xs shrink-0 select-none font-bold"><span class="hidden md:inline">PS C:\\Users\\Student\\Labs&gt;</span><span class="md:hidden">PS&gt;</span></label>
              <input id="terminal-input" type="text" maxlength="300" enterkeyhint="go" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="nmap -sV ${LAB_TARGET} · help" class="flex-1 min-w-0 bg-transparent text-emerald-300 text-[13px] sm:text-xs outline-none font-mono py-1.5" />
              <button type="submit" class="px-3.5 sm:px-4 py-2 bg-accent hover:bg-accent2 rounded-xl text-white text-xs font-semibold shrink-0 transition-colors">Ejecutar</button>
            </form>
          </section>

          <section class="bg-surface rounded-2xl border border-line overflow-hidden">
            <div class="px-3.5 py-3 bg-bg/70 border-b border-line/80 flex items-center gap-2.5 min-w-0">
              <span class="material-symbols-outlined text-accent text-base shrink-0" aria-hidden="true">psychology</span>
              <div class="flex items-center gap-1.5 overflow-x-auto pb-0.5 max-w-full font-mono text-[11px] cmd-tab-bar">
                ${commandKeys.map(k => `
                  <button type="button" data-action="select-cmd" data-key="${k}" aria-pressed="${k === activeCmdKey}" class="cmd-tab-btn px-3 py-1.5 rounded-lg whitespace-nowrap transition-all ${k === activeCmdKey ? TAB_ACTIVE : TAB_IDLE}">${esc(PENTESTING_COMMANDS[k].name)}</button>`).join('')}
              </div>
            </div>
            <div id="command-explanation-card" class="p-4 sm:p-6 flex flex-col gap-4 sm:gap-5 text-xs">${explanationCardHtml(activeCmdKey)}</div>
          </section>
        </div>

        <div class="lg:col-span-4 flex flex-col gap-4 sm:gap-5">
          <button type="button" data-action="open-video" data-start="0" class="group bg-surface rounded-2xl border border-line hover:border-accent/60 overflow-hidden text-left transition-colors">
            <span class="relative block w-full aspect-video bg-term">
              <img src="https://i.ytimg.com/vi/${COURSE_VIDEO.id}/hqdefault.jpg" alt="" class="absolute inset-0 w-full h-full object-cover" loading="lazy" />
              <span class="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/20 transition-colors">
                <span class="w-12 h-12 rounded-full bg-white/95 flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform"><span class="material-symbols-outlined text-accent text-3xl" aria-hidden="true">play_arrow</span></span>
              </span>
              <span class="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/75 text-white text-[10px] font-mono">${COURSE_VIDEO.duration}</span>
            </span>
            <span class="block p-3.5">
              <span class="block text-[10px] font-mono font-bold text-rose-600 mb-0.5">VIDEO EN ESPAÑOL · ${esc(COURSE_VIDEO.author)}</span>
              <span class="block text-[13px] font-bold text-ink leading-snug">${esc(COURSE_VIDEO.title)}</span>
            </span>
          </button>

          <section class="bg-surface rounded-2xl border border-line overflow-hidden">
            ${collapsible('panel-syllabus', 'list_alt', 'Plan de estudio', `
              <div class="hidden lg:flex items-center justify-between pb-1">
                <h3 class="text-xs font-bold text-ink uppercase font-mono">Plan de estudio</h3>
                <span class="text-[11px] text-muted font-mono">${esc(COURSE.duration)}</span>
              </div>
              <div id="syllabus-list" class="flex flex-col gap-1">${syllabusHtml()}</div>
              <details class="mt-1 pt-3 border-t border-line/60 text-xs">
                <summary class="cursor-pointer font-semibold text-ink2 hover:text-accent">Qué aprenderás</summary>
                <ul class="mt-2 flex flex-col gap-1.5 text-ink2">
                  ${COURSE_OBJECTIVES.map(o => `<li class="flex gap-1.5"><span class="material-symbols-outlined text-[14px] text-accent mt-px" aria-hidden="true">check</span><span>${esc(o)}</span></li>`).join('')}
                </ul>
              </details>
            `)}
          </section>
        </div>
      </div>
    </div>
  `;

  renderTerminal();
  pullCloudState();
}
