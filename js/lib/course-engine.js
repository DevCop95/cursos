/**
 * Motor de los cursos guardados en la base de datos (módulo puro, con tests).
 *  - runCourseCommand(): terminal simulada CON ESTADO definida por el propio curso. Cada comando es
 *    { match, when?, set?, steps?, output, fail? }: se usa el primero cuyo patrón encaje y cuyas
 *    condiciones (when) se cumplan con el estado actual; si ninguno las cumple, se muestra el `fail`
 *    del primero que encajó. `set` modifica el estado ('+1' incrementa, '$N' o '{N}' usa un grupo).
 *    En los textos, {N} es un grupo capturado y {nombre} una variable del estado.
 *  - computeCourseProgress(): misma regla que private.rebuild_course_progress() en Supabase.
 */
export const isCheckStep = step => /^(q|f)-/.test(step);

function normalize(raw) {
  return String(raw || '').trim().replace(/\s+/g, ' ');
}

const unquote = v => String(v ?? '').replace(/^(["'])(.*)\1$/, '$2');

// Sustituye {0}, {1}… por grupos capturados y {nombre} por variables del estado.
function fill(text, groups = [], state = {}) {
  return String(text)
    .replace(/\{(\d)\}/g, (_, i) => unquote(groups[Number(i)]))
    .replace(/\{([a-zA-Z_]\w*)\}/g, (all, k) => (k in state ? String(state[k]) : all));
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

const toLines = (rows, groups, state) => (rows || []).map(([text, type]) => ({ text: fill(text, groups, state), type: type || 'out' }));

export function initialCourseState(terminal) {
  return { ...(terminal.initialState || {}) };
}

export function promptFor(terminal, state = {}) {
  const tpl = state.repo === 'no' && terminal.promptNoRepo ? terminal.promptNoRepo : (terminal.prompt || '$ ');
  return fill(tpl, [], state);
}

function whenPasses(when, groups, state) {
  return Object.entries(when || {}).every(([k, v]) => String(state[k] ?? '') === fill(v, groups, state));
}

function applySet(set, groups, state) {
  const next = { ...state };
  Object.entries(set || {}).forEach(([k, v]) => {
    if (v === '+1') next[k] = String((Number(state[k]) || 0) + 1);
    else if (/^\$\d$/.test(v)) next[k] = unquote(groups[Number(v.slice(1))]);
    else next[k] = fill(v, groups, state);
  });
  return next;
}

/**
 * @returns {{ lines: {text:string,type:string}[], steps: string[], clear: boolean, state: object }}
 */
export function runCourseCommand(terminal, raw, state = initialCourseState(terminal)) {
  const cmd = normalize(raw).slice(0, 300);
  const result = { lines: [], steps: [], clear: false, state };
  if (!cmd) return result;
  const first = cmd.split(' ')[0].toLowerCase();
  if (first === 'clear' || first === 'cls') { result.clear = true; return result; }
  if (first === 'help') { result.lines = toLines(terminal.help, [], state); return result; }

  let firstMatch = null;
  for (const c of patterns(terminal)) {
    const m = cmd.match(c.re);
    if (!m) continue;
    const groups = [m[0], ...m.slice(1)];
    if (!firstMatch) firstMatch = { c, groups };
    if (whenPasses(c.when, groups, state)) {
      result.lines = toLines(c.output, groups, state);
      result.steps = [...(c.steps || [])];
      result.state = applySet(c.set, groups, state);
      return result;
    }
  }
  if (firstMatch) {
    const { c, groups } = firstMatch;
    const fail = typeof c.fail === 'string' ? terminal[c.fail] : c.fail;
    result.lines = toLines(fail || [['[LAB] Ese comando no se puede usar todavía.', 'hint']], groups, state);
    return result;
  }
  const parts = cmd.split(' ');
  const text = first === 'git' && parts[1]
    ? fill(terminal.unknownGit || "git: '{0}' is not a git command.", [parts[1]])
    : fill(terminal.unknown || '{0}: command not found', [parts[0]]);
  result.lines = [{ text, type: 'error' }];
  return result;
}

// ---------------------------------------------------------------------------
// Terminal Linux real: tras cada comando, lab-hook.sh informa { cmd, rc, dir, repo, branch, commits,
// upstream, conflict }. Cada regla del curso (terminal.real) es { step, cmd, rc?, when?, after? }:
//  cmd: patrón del comando (se prueba con cada parte de "a && b; c"); rc: código de salida esperado
//  (por defecto 0; null = cualquiera); when: { campo: valor | '>=1' | '!=x' | '~patrón' };
//  after: paso que tiene que estar hecho antes. Devuelve los pasos nuevos que se cumplen.
// ---------------------------------------------------------------------------
function compare(actual, expected) {
  const m = String(expected).match(/^(>=|<=|!=|>|<|~)(.*)$/);
  if (!m) return String(actual ?? '') === String(expected);
  const [, op, raw] = m;
  if (op === '!=') return String(actual ?? '') !== raw;
  if (op === '~') { try { return new RegExp(raw).test(String(actual ?? '')); } catch (e) { return false; } }
  const a = Number(actual);
  const b = Number(raw);
  return op === '>=' ? a >= b : op === '<=' ? a <= b : op === '>' ? a > b : a < b;
}

export function realCourseSteps(rules, state, steps = {}) {
  if (!Array.isArray(rules) || !state || typeof state.cmd !== 'string') return [];
  const parts = normalize(state.cmd).split(/\s*(?:&&|\|\||;)\s*/).filter(Boolean);
  const found = [];
  const done = s => Boolean(steps[s]) || found.includes(s);
  for (const r of rules) {
    if (!r || typeof r.step !== 'string' || done(r.step)) continue;
    let re;
    try { re = new RegExp(r.cmd, 'i'); } catch (e) { continue; }
    if (!parts.some(p => re.test(p))) continue;
    const rc = r.rc === undefined ? 0 : r.rc;
    if (rc !== null && Number(state.rc) !== Number(rc)) continue;
    if (r.after && !done(r.after)) continue;
    if (!Object.entries(r.when || {}).every(([k, v]) => compare(state[k], v))) continue;
    found.push(r.step);
  }
  return found;
}

// Valores propios del alumno que salen de su laboratorio real (terminal.realValues: { key, field, when? }),
// p. ej. el hash de su primer commit, que el servidor acepta luego como respuesta del reto.
export function realCourseValues(defs, state) {
  if (!Array.isArray(defs) || !state) return [];
  return defs
    .filter(d => d && typeof d.key === 'string' && typeof d.field === 'string')
    .filter(d => /^[0-9a-f]{7,40}$/.test(String(state[d.field] || '')))
    .filter(d => Object.entries(d.when || {}).every(([k, v]) => compare(state[k], v)))
    .map(d => ({ key: d.key, value: String(state[d.field]) }));
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
  const labsDone = (content.labs || []).filter(lab => lab.all.every(s => Boolean(steps[s]))).map(l => l.id);
  return { lessons, lessonsDone, nextLesson, percent, labsDone, complete: lessons.length > 0 && percent === 100 };
}

// Comandos y comprobaciones (preguntas / reto) que faltan en la siguiente lección.
export function pendingCourseSteps(content, steps = {}) {
  const { nextLesson } = computeCourseProgress(content, steps);
  if (!nextLesson) return { commands: [], checks: [] };
  const missing = (nextLesson.requires || []).filter(s => !steps[s]);
  return { commands: missing.filter(s => !isCheckStep(s)), checks: missing.filter(isCheckStep) };
}
