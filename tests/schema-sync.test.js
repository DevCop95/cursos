import { test as nodeTest } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { COURSE, STEP_HINTS } from '../js/content.js';

// El temario del servidor (supabase/schema.sql) debe coincidir con content.js; si no, el progreso se rompe.
// El esquema no se publica en el repositorio: sin el archivo, estos tests se omiten.
const SCHEMA = new URL('../supabase/schema.sql', import.meta.url);
const sql = existsSync(SCHEMA) ? readFileSync(SCHEMA, 'utf8') : null;
const test = sql ? nodeTest : nodeTest.skip;

function sqlLessons() {
  const match = sql.match(/function public\.course_lessons\(\)[\s\S]*?select '([^']+)'::jsonb;/);
  assert.ok(match, 'No se encontró el temario en course_lessons()');
  return JSON.parse(match[1]);
}

test('el temario de course_lessons() coincide con COURSE.syllabus', () => {
  const lessons = COURSE.syllabus.flatMap(m => m.lessons);
  const expected = lessons.filter(l => l.requires !== 'all').map(l => l.requires);
  assert.deepEqual(sqlLessons(), expected);
  // El servidor cuenta una lección final extra ('all') que exige todas las anteriores.
  assert.equal(lessons.length, expected.length + 1);
  assert.ok(lessons.at(-1).requires === 'all', 'La última lección debe ser la evaluación final (requires: all)');
});

test('todos los pasos que reconoce la consola están permitidos en el servidor', () => {
  const allowed = new Set(sqlLessons().flat());
  assert.deepEqual([...allowed].sort(), Object.keys(STEP_HINTS).sort());
});
