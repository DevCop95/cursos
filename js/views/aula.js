/**
 * Vista: Aula interactiva (terminal simulada, ficha técnica del comando, recursos de Nmap y temario).
 */
import { esc } from '../lib/html.js';
import { appState, saveState, initialTerminal } from '../state.js';
import { COURSE, COURSE_OBJECTIVES, COURSE_VIDEO, LESSON_DETAILS, STEP_HINTS, LAB_TARGET, LAB_HOST_IP, NMAP_RESOURCES, PENTESTING_COMMANDS, LAB_STEPS } from '../content.js';
import { runCommand, isLessonDone, pendingHints, MAX_TERMINAL_LINES } from '../lab.js';
import { recordSteps, currentProgress, currentSteps } from '../progress.js';
import { showToast, openDialog } from '../ui.js';

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
  return lines;
}

export function executeCommand(raw) {
  const cmd = String(raw || '').trim().slice(0, 300);
  if (!cmd) return;
  const result = runCommand(cmd);

  if (result.clear) {
    appState.terminalLines = [];
    renderTerminal();
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
  saveState(appState);
}

export function resetTerminal() {
  appState.terminalLines = initialTerminal();
  renderTerminal();
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

function nextStepHtml() {
  const p = currentProgress();
  if (p.complete) {
    return `<p class="text-xs text-accent font-semibold">✓ Has completado todas las lecciones del curso.</p>`;
  }
  const hints = pendingHints(currentSteps());
  return `
    <div class="flex flex-wrap items-center gap-1.5">
      <span class="text-[11px] font-mono text-muted mr-1">Practica:</span>
      ${hints.map(h => `
        <button type="button" data-action="run-cmd" data-cmd="${esc(h.command)}" class="px-2.5 py-1 rounded-lg bg-term text-emerald-300 font-mono text-[11px] hover:bg-term-3 transition-colors" title="Ejecutar en la consola">${esc(h.command)}</button>`).join('')}
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

export function openLesson(id) {
  const lesson = ALL_LESSONS.find(l => l.id === id);
  if (!lesson) return;
  const module = COURSE.syllabus.find(m => m.lessons.includes(lesson));
  const detail = LESSON_DETAILS[id] || {};
  const steps = currentSteps();
  const done = isLessonDone(lesson, steps);
  const reqs = lesson.requires === 'all'
    ? [...new Set(ALL_LESSONS.filter(l => l.requires !== 'all').flatMap(l => l.requires))]
    : lesson.requires;

  const practice = reqs.map(step => {
    const ok = Boolean(steps[step]);
    return `
      <li class="flex items-center gap-2">
        <span class="material-symbols-outlined text-[16px] shrink-0 ${ok ? 'text-accent' : 'text-[#b6b2a9]'}" aria-hidden="true">${ok ? 'check_circle' : 'radio_button_unchecked'}</span>
        <button type="button" data-action="run-cmd" data-cmd="${esc(STEP_HINTS[step])}" class="flex-1 min-w-0 text-left px-2.5 py-1.5 rounded-lg bg-term hover:bg-term-3 text-emerald-300 font-mono text-[11px] truncate transition-colors" title="Ejecutar en la consola">${esc(STEP_HINTS[step])}</button>
      </li>`;
  }).join('');

  openDialog({
    title: lesson.title,
    kicker: `${module.module.toUpperCase()} · ${lesson.time}`,
    body: `
      <div class="flex flex-col gap-4">
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
        <div>
          <p class="text-[11px] font-mono font-bold text-muted uppercase tracking-wide mb-2">Práctica en la consola</p>
          <ul class="flex flex-col gap-1.5">${practice}</ul>
        </div>
      </div>`
  });
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
          <div class="flex items-center gap-2 shrink-0">
            <button type="button" data-action="open-video" data-start="0" class="h-9 px-3 rounded-xl bg-white border border-line hover:border-accent/60 text-xs font-semibold text-ink flex items-center gap-1.5 transition-colors">
              <span class="material-symbols-outlined text-[18px] text-rose-500" aria-hidden="true">smart_display</span><span>Video de la clase</span>
            </button>
            <button type="button" data-action="open-resources" class="h-9 px-3 rounded-xl bg-white border border-line hover:border-accent/60 text-xs font-semibold text-ink flex items-center gap-1.5 transition-colors">
              <span class="material-symbols-outlined text-[18px] text-accent" aria-hidden="true">menu_book</span><span>Recursos</span>
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
}
