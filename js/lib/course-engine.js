/**
 * Motor de los cursos guardados en la base de datos (módulo puro, con tests).
 *  - runCourseCommand(): terminal simulada definida por el propio curso (patrones → salida → pasos).
 *  - computeCourseProgress(): misma regla que private.rebuild_course_progress() en Supabase.
 */
export const isCheckStep = step => /^(q|f)-/.test(step);

function normalize(raw) {
  return String(raw || '').trim().replace(/\s+/g, ' ');
}

// Sustituye {0}, {1}… por los grupos capturados (sin comillas envolventes).
function fill(text, groups) {
  return String(text).replace(/\{(\d)\}/g, (_, i) => String(groups[Number(i)] ?? '').replace(/^(["'])(.*)\1$/, '$2'));
}

const compiled = new WeakMap();
function patterns(terminal) {
  if (!compiled.has(terminal)) {
    compiled.set(terminal, (terminal.commands || []).map(c => {
      try { return { ...c, re: new RegExp(c.match, 'i') }; } catch (e) { return null; }
    }).filter(Boolean));
  }
  return compiled.get(terminal);
}

const toLines = (rows, groups = []) => (rows || []).map(([text, type]) => ({ text: fill(text, groups), type: type || 'out' }));

/**
 * @returns {{ lines: {text:string,type:string}[], steps: string[], clear: boolean }}
 */
export function runCourseCommand(terminal, raw) {
  const cmd = normalize(raw).slice(0, 300);
  const result = { lines: [], steps: [], clear: false };
  if (!cmd) return result;
  const first = cmd.split(' ')[0].toLowerCase();
  if (first === 'clear' || first === 'cls') { result.clear = true; return result; }
  if (first === 'help') { result.lines = toLines(terminal.help); return result; }

  for (const c of patterns(terminal)) {
    const m = cmd.match(c.re);
    if (m) {
      result.lines = toLines(c.output, [m[0], ...m.slice(1)]);
      result.steps = [...(c.steps || [])];
      return result;
    }
  }
  const parts = cmd.split(' ');
  const text = first === 'git' && parts[1]
    ? fill(terminal.unknownGit || "git: '{0}' is not a git command.", [parts[1]])
    : fill(terminal.unknown || '{0}: command not found', [parts[0]]);
  result.lines = [{ text, type: 'error' }];
  return result;
}

export function allLessons(content) {
  return (content.syllabus || []).flatMap(m => m.lessons.map(l => ({ ...l, module: m.module })));
}

export function isCourseLessonDone(lesson, steps, lessons) {
  if (lesson.afterAll && !lessons.filter(l => !l.afterAll).every(l => isCourseLessonDone(l, steps, lessons))) return false;
  return (lesson.requires || []).every(s => Boolean(steps[s]));
}

export function computeCourseProgress(content, steps = {}) {
  const lessons = allLessons(content);
  const lessonsDone = lessons.filter(l => isCourseLessonDone(l, steps, lessons)).map(l => l.id);
  const nextLesson = lessons.find(l => !lessonsDone.includes(l.id)) || null;
  const percent = lessons.length ? Math.round((lessonsDone.length / lessons.length) * 100) : 0;
  return { lessons, lessonsDone, nextLesson, percent, complete: lessons.length > 0 && percent === 100 };
}

// Comandos y comprobaciones (preguntas / reto) que faltan en la siguiente lección.
export function pendingCourseSteps(content, steps = {}) {
  const { nextLesson } = computeCourseProgress(content, steps);
  if (!nextLesson) return { commands: [], checks: [] };
  const missing = (nextLesson.requires || []).filter(s => !steps[s]);
  return { commands: missing.filter(s => !isCheckStep(s)), checks: missing.filter(isCheckStep) };
}
