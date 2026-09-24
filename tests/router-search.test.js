import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveRoute } from '../js/router.js';
import { buildIndex, search } from '../js/search.js';

test('sin sesión todo redirige a login', () => {
  assert.deepEqual(resolveRoute('#/perfil', { authenticated: false }), { route: 'login', param: null, redirect: '#/login' });
  assert.equal(resolveRoute('#/login', { authenticated: false }).redirect, null);
});

test('rutas válidas, desconocidas y parámetro por defecto', () => {
  assert.equal(resolveRoute('#/perfil', { authenticated: true }).route, 'perfil');
  assert.equal(resolveRoute('#/aula-interactiva', { authenticated: true }).param, 'pentesting-101');
  assert.equal(resolveRoute('#/nada', { authenticated: true }).redirect, '#/mis-cursos');
  assert.equal(resolveRoute('', { authenticated: true }).route, 'mis-cursos');
});

test('el panel de admin exige rol admin', () => {
  const denied = resolveRoute('#/panel-admin', { authenticated: true, admin: false });
  assert.equal(denied.route, 'mis-cursos');
  assert.equal(denied.denied, true);
  assert.equal(resolveRoute('#/panel-admin', { authenticated: true, admin: true }).route, 'panel-admin');
});

test('búsqueda: sin tildes, por comando y oculta admin a alumnos', () => {
  const idx = buildIndex({ admin: false });
  assert.ok(search(idx, 'deteccion versiones').some(r => r.kind === 'Lección'));
  assert.equal(search(idx, 'netstat')[0].title, 'netstat.exe');
  assert.ok(!search(idx, 'administracion').some(r => r.href === '#/panel-admin'));
  assert.ok(search(buildIndex({ admin: true }), 'administracion').some(r => r.href === '#/panel-admin'));
});
