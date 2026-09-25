import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runCourseCommand, computeCourseProgress, pendingCourseSteps, realCourseSteps } from '../js/lib/course-engine.js';

// Curso mínimo de ejemplo (el contenido real vive en Supabase, no en el repositorio).
const COURSE = {
  terminal: {
    help: [['ayuda', 'system']],
    unknownGit: "git: '{0}' is not a git command.",
    unknown: 'bash: {0}: command not found',
    commands: [
      { match: '^git (--version|version)$', steps: ['v'], output: [['git version 2.47', 'cmd']] },
      { match: "^git commit -m (\"[^\"]+\"|'[^']+')$", steps: ['c'], output: [['[main 9b41c2e] {1}', 'cmd']] },
      { match: '^git (switch -c|checkout -b) ([\\w./-]+)$', steps: ['b', 's'], output: [["Switched to a new branch '{2}'", 'cmd']] },
      { match: '^git (bad[$', steps: ['x'], output: [] }
    ]
  },
  syllabus: [
    { module: 'M1', lessons: [
      { id: 'a1-1', requires: ['v', 'q-a1-1'] },
      { id: 'a1-2', requires: ['c', 'b', 's'] }
    ] },
    { module: 'M2', lessons: [{ id: 'a2-1', requires: ['f-x'], afterAll: true }] }
  ]
};

test('runCourseCommand reconoce comandos, rellena grupos y registra pasos', () => {
  assert.deepEqual(runCourseCommand(COURSE.terminal, '  GIT   --version ').steps, ['v']);
  assert.equal(runCourseCommand(COURSE.terminal, 'git commit -m "Hola mundo"').lines[0].text, '[main 9b41c2e] Hola mundo');
  const r = runCourseCommand(COURSE.terminal, 'git switch -c feature/x');
  assert.deepEqual(r.steps, ['b', 's']);
  assert.equal(r.lines[0].text, "Switched to a new branch 'feature/x'");
});

test('runCourseCommand: clear, help y comandos desconocidos (y patrones inválidos no rompen)', () => {
  assert.equal(runCourseCommand(COURSE.terminal, 'clear').clear, true);
  assert.equal(runCourseCommand(COURSE.terminal, 'help').lines[0].text, 'ayuda');
  assert.equal(runCourseCommand(COURSE.terminal, 'git hack').lines[0].text, "git: 'hack' is not a git command.");
  assert.equal(runCourseCommand(COURSE.terminal, 'rm -rf /').lines[0].text, 'bash: rm: command not found');
  assert.deepEqual(runCourseCommand(COURSE.terminal, 'git commit -m sin-comillas').steps, []);
});

test('computeCourseProgress: preguntas obligatorias y reto final al final', () => {
  assert.equal(computeCourseProgress(COURSE, {}).percent, 0);
  assert.equal(computeCourseProgress(COURSE, { v: 1 }).percent, 0); // falta la pregunta
  assert.equal(computeCourseProgress(COURSE, { v: 1, 'q-a1-1': 1 }).percent, 33);
  // El reto no cuenta mientras falten lecciones anteriores.
  assert.equal(computeCourseProgress(COURSE, { v: 1, 'q-a1-1': 1, 'f-x': 1 }).percent, 33);
  const all = { v: 1, 'q-a1-1': 1, c: 1, b: 1, s: 1, 'f-x': 1 };
  assert.equal(computeCourseProgress(COURSE, all).complete, true);
});

test('pendingCourseSteps separa comandos y comprobaciones', () => {
  assert.deepEqual(pendingCourseSteps(COURSE, {}), { commands: ['v'], checks: ['q-a1-1'] });
  assert.deepEqual(pendingCourseSteps(COURSE, { v: 1 }), { commands: [], checks: ['q-a1-1'] });
});

// Terminal Linux real: reglas genéricas (las del curso viven en su contenido, en la base de datos).
const RULES = [
  { step: 'ver', cmd: '^tool --version$' },
  { step: 'save', cmd: '^tool save', when: { count: '>=1' } },
  { step: 'clash', cmd: '^tool mix', rc: null, when: { clash: '>=1' } },
  { step: 'fix', cmd: '^tool (add|save)', after: 'clash', when: { clash: '0', dir: 'team' } },
  { step: 'send', cmd: '^tool send', when: { upstream: '~^origin/(?!main$)' } }
];
const st = (cmd, extra = {}) => ({ cmd, rc: 0, dir: 'demo', repo: true, branch: 'main', commits: 0, upstream: '', conflict: 0, count: 0, clash: 0, ...extra });

test('Linux real: el paso cuenta solo si el comando funcionó y el estado lo confirma', () => {
  assert.deepEqual(realCourseSteps(RULES, st('tool --version')), ['ver']);
  assert.deepEqual(realCourseSteps(RULES, st('tool --version', { rc: 127 })), []);
  assert.deepEqual(realCourseSteps(RULES, st('tool save -m x', { count: 0 })), []);
  assert.deepEqual(realCourseSteps(RULES, st('tool save -m x', { count: 1 })), ['save']);
  // Un paso ya hecho no se repite.
  assert.deepEqual(realCourseSteps(RULES, st('tool --version'), { ver: 'x' }), []);
});

test('Linux real: rc null acepta un comando que falla y "after" exige el paso previo', () => {
  assert.deepEqual(realCourseSteps(RULES, st('tool mix other', { rc: 1, clash: 2 })), ['clash']);
  assert.deepEqual(realCourseSteps(RULES, st('tool add file', { dir: 'team' })), []);
  assert.deepEqual(realCourseSteps(RULES, st('tool add file', { dir: 'team' }), { clash: 'x' }), ['fix']);
});

test('Linux real: comandos encadenados y condiciones con patrón', () => {
  assert.deepEqual(realCourseSteps(RULES, st('cd x && tool --version')), ['ver']);
  assert.deepEqual(realCourseSteps(RULES, st('tool send', { upstream: 'origin/main' })), []);
  assert.deepEqual(realCourseSteps(RULES, st('tool send', { upstream: 'origin/feature/x' })), ['send']);
  assert.deepEqual(realCourseSteps(RULES, st('tool send', { upstream: '' })), []);
  assert.deepEqual(realCourseSteps(null, st('tool --version')), []);
  assert.deepEqual(realCourseSteps([{ step: 'bad', cmd: '(' }], st('(')), []);
});
