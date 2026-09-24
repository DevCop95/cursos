import { test as nodeTest } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { COURSE, STEP_HINTS, QUIZZES, FINAL_CHALLENGE } from '../js/content.js';

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
  assert.deepEqual(sqlLessons(), lessons.map(l => l.requires));
  // Solo la última lección (reto final) exige además todas las anteriores; el servidor asume lo mismo.
  assert.deepEqual(lessons.filter(l => l.afterAll).map(l => l.id), [lessons.at(-1).id]);
});

test('los pasos de consola del servidor son exactamente los que reconoce la terminal', () => {
  const commands = new Set(sqlLessons().flat().filter(s => !/^(q|f)-/.test(s)));
  assert.deepEqual([...commands].sort(), Object.keys(STEP_HINTS).sort());
});

test('cada pregunta y respuesta del reto del cliente existe en el temario del servidor', () => {
  const serverChecks = new Set(sqlLessons().flat().filter(s => /^(q|f)-/.test(s)));
  const clientChecks = [...Object.values(QUIZZES).map(q => q.step), ...FINAL_CHALLENGE.map(f => f.step)];
  assert.deepEqual(clientChecks.sort(), [...serverChecks].sort());
});
