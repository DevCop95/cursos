import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rankView, courseIcon, RANKS } from '../js/lib/ranks.js';

test('rango: avance hacia el siguiente y puntos que faltan', () => {
  const v = rankView({ points: 250, rank: 'Hacker', rank_from: 150, next_rank: 'Pro Hacker', next_at: 300 });
  assert.equal(v.name, 'Hacker');
  assert.equal(v.pct, 67);
  assert.equal(v.remaining, 50);
  assert.equal(v.next, 'Pro Hacker');
});

test('rango: el último rango queda al 100 % y sin siguiente', () => {
  const v = rankView({ points: 1500, rank: 'Omniscient', rank_from: 1200, next_rank: null, next_at: null });
  assert.equal(v.pct, 100);
  assert.equal(v.next, null);
  assert.equal(v.remaining, 0);
});

test('rango: datos ausentes o desconocidos no rompen la vista', () => {
  assert.equal(rankView(null), null);
  assert.equal(rankView({ points: 10, rank: 'Inventado', rank_from: 0, next_at: 50, next_rank: 'Script Kiddie' }).name, RANKS[0].name);
  assert.equal(courseIcon('git-github-101'), 'account_tree');
  assert.equal(courseIcon('otro'), 'school');
});
