import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rankView, courseIcon, RANKS } from '../js/lib/ranks.js';

test('rango: avance hacia el siguiente según el % del contenido completado', () => {
  // 39 % → Hacker (20 %), siguiente Pro Hacker (45 %): 19 de 25 puntos porcentuales = 76 %.
  const v = rankView({ points: 175, ownership: 39, rank: 'Hacker', rank_from: 20, next_rank: 'Pro Hacker', next_at: 45 });
  assert.equal(v.name, 'Hacker');
  assert.equal(v.ownership, 39);
  assert.equal(v.pct, 76);
  assert.equal(v.remaining, 6);
  assert.equal(v.next, 'Pro Hacker');
});

test('rango: con todo completado (100 %) es el máximo, sin siguiente', () => {
  const v = rankView({ points: 450, ownership: 100, rank: 'Omniscient', rank_from: 100, next_rank: null, next_at: null });
  assert.equal(v.name, 'Omniscient');
  assert.equal(v.pct, 100);
  assert.equal(v.next, null);
  assert.equal(v.remaining, 0);
});

test('rango: datos ausentes o desconocidos no rompen la vista', () => {
  assert.equal(rankView(null), null);
  assert.equal(rankView({ points: 10, ownership: 2, rank: 'Inventado', rank_from: 0, next_at: 5, next_rank: 'Script Kiddie' }).name, RANKS[0].name);
  assert.equal(courseIcon('git-github-101'), 'account_tree');
  assert.equal(courseIcon('otro'), 'school');
});
