import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runCourseCommand, computeCourseProgress, pendingCourseSteps } from '../js/lib/course-engine.js';

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
