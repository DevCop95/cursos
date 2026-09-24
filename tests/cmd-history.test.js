import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHistory } from '../js/lib/cmd-history.js';

test('↑ recorre los comandos del más reciente al más antiguo y ↓ vuelve al borrador', () => {
  const h = createHistory();
  h.push('git init');
  h.push('git status');
  assert.equal(h.up('git a'), 'git status');
  assert.equal(h.up(), 'git init');
  assert.equal(h.up(), null);
  assert.equal(h.down(), 'git status');
  assert.equal(h.down(), 'git a');
  assert.equal(h.down(), null);
});

test('no guarda vacíos ni repetidos seguidos y respeta el máximo', () => {
  const h = createHistory(3);
  ['a', 'a', '  ', 'b', 'c', 'd'].forEach(c => h.push(c));
  assert.equal(h.size, 3);
  assert.equal(h.up(), 'd');
  assert.equal(h.up(), 'c');
  assert.equal(h.up(), 'b');
  assert.equal(h.up(), null);
});

test('sin historial, las flechas no cambian nada', () => {
  const h = createHistory();
  assert.equal(h.up('x'), null);
  assert.equal(h.down(), null);
});
