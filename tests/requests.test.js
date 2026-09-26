import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groupRequests } from '../js/lib/requests.js';

const rows = [
  { id: 'u1', full_name: 'Sebastián Ávila', email: 'seba@example.com' },
  { id: 'u2', full_name: 'haker 563', email: 'h2717932@example.com' }
];
const reqs = [
  { user_id: 'u2', course_id: 'shodan-101', created_at: '2026-09-25T12:00:00Z' },
  { user_id: 'u1', course_id: 'shodan-101', created_at: '2026-09-25T08:00:00Z' },
  { user_id: 'u2', course_id: 'git-github-101', created_at: '2026-09-25T11:00:00Z' },
  { user_id: 'u3', course_id: 'git-github-101', created_at: '2026-09-25T13:00:00Z', rejected_at: '2026-09-25T14:00:00Z' }
];

test('solicitudes: una fila por alumno, la más antigua primero, sin las rechazadas', () => {
  const g = groupRequests(reqs, { rows });
  assert.deepEqual(g.map(x => x.userId), ['u1', 'u2']);
  assert.deepEqual(g[1].items.map(i => i.courseId), ['git-github-101', 'shodan-101'], 'dentro del alumno, por orden de llegada');
  assert.equal(g[1].oldest, '2026-09-25T11:00:00Z');
});

test('solicitudes: filtro por curso', () => {
  const g = groupRequests(reqs, { rows, course: 'git-github-101' });
  assert.deepEqual(g.map(x => x.userId), ['u2']);
  assert.deepEqual(g[0].items.map(i => i.courseId), ['git-github-101']);
});

test('solicitudes: búsqueda por nombre o correo sin tildes ni mayúsculas', () => {
  assert.deepEqual(groupRequests(reqs, { rows, query: 'SEBASTIAN avila' }).map(x => x.userId), ['u1']);
  assert.deepEqual(groupRequests(reqs, { rows, query: 'h2717' }).map(x => x.userId), ['u2']);
  assert.deepEqual(groupRequests(reqs, { rows, query: 'nadie' }), []);
});

test('solicitudes: 100 pendientes de 40 alumnos se agrupan en 40 filas', () => {
  const many = Array.from({ length: 100 }, (_, i) => ({ user_id: 'u' + (i % 40), course_id: ['a', 'b', 'c'][i % 3], created_at: new Date(Date.UTC(2026, 8, 1, 0, i)).toISOString() }));
  assert.equal(groupRequests(many).length, 40);
});
