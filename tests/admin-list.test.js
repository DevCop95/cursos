import { test } from 'node:test';
import assert from 'node:assert/strict';
import { searchUsers, groupThreads } from '../js/lib/admin-list.js';

const rows = [
  { id: 'a', full_name: 'Sebastián Ávila Losada', google_name: 'Sebastian Avila', email: 'seba@example.com' },
  { id: 'b', full_name: 'Ana María', google_name: 'Ana Maria Ruiz', email: 'ana.ruiz@example.com' },
  { id: 'c', full_name: '', email: 'h2717932@example.com' }
];

test('buscar alumnos: nombre, nombre de Google o correo, sin tildes ni mayúsculas y por palabras', () => {
  assert.deepEqual(searchUsers(rows, 'avila').map(r => r.id), ['a']);
  assert.deepEqual(searchUsers(rows, 'RUIZ').map(r => r.id), ['b'], 'también por el nombre de Google');
  assert.deepEqual(searchUsers(rows, 'h2717').map(r => r.id), ['c']);
  assert.deepEqual(searchUsers(rows, 'ana example').map(r => r.id), ['b'], 'todas las palabras deben aparecer');
  assert.equal(searchUsers(rows, '   ').length, 3, 'sin texto: todos');
  assert.deepEqual(searchUsers(rows, 'nadie'), []);
});

test('conversaciones: primero las que tienen mensajes sin leer, luego la más reciente', () => {
  const msgs = [
    { user_id: 'a', from_admin: false, read_at: '2026-09-25T10:00:00Z', created_at: '2026-09-25T09:00:00Z' },
    { user_id: 'b', from_admin: true, read_at: null, created_at: '2026-09-25T12:00:00Z' },
    { user_id: 'c', from_admin: false, read_at: null, created_at: '2026-09-25T08:00:00Z' },
    { user_id: 'c', from_admin: false, read_at: null, created_at: '2026-09-25T08:30:00Z' }
  ];
  const t = groupThreads(msgs);
  assert.deepEqual(t.map(x => x.userId), ['c', 'b', 'a']);
  assert.equal(t[0].unread, 2);
  assert.equal(t[0].last.created_at, '2026-09-25T08:30:00Z');
  assert.equal(t[1].unread, 0, 'los mensajes del admin no cuentan como sin leer');
});
