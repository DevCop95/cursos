import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rankView, courseIcon, RANKS } from '../js/lib/ranks.js';

test('rango: avance hacia Script Kiddie (450 pts = los 3 cursos actuales)', () => {
  // Un curso terminado y otro al 27 %: 177 de 450 → 39 % del camino, faltan 273.
  const v = rankView({ points: 177, rank: 'Noob', rank_from: 0, next_rank: 'Script Kiddie', next_at: 450 });
  assert.equal(v.name, 'Noob');
  assert.equal(v.pct, 39);
  assert.equal(v.remaining, 273);
  assert.equal(v.next, 'Script Kiddie');
});

test('rango: con los 3 cursos se entra justo en Script Kiddie y el siguiente es Hacker', () => {
  const v = rankView({ points: 450, rank: 'Script Kiddie', rank_from: 450, next_rank: 'Hacker', next_at: 1500 });
  assert.equal(v.name, 'Script Kiddie');
  assert.equal(v.pct, 0);
  assert.equal(v.remaining, 1050);
});

test('rango: el último rango queda al 100 % y sin siguiente', () => {
  const v = rankView({ points: 16000, rank: 'Omniscient', rank_from: 15000, next_rank: null, next_at: null });
  assert.equal(v.pct, 100);
  assert.equal(v.next, null);
  assert.equal(v.remaining, 0);
});

test('rango: datos ausentes o desconocidos no rompen la vista', () => {
  assert.equal(rankView(null), null);
  assert.equal(rankView({ points: 10, rank: 'Inventado', rank_from: 0, next_at: 450, next_rank: 'Script Kiddie' }).name, RANKS[0].name);
  assert.equal(courseIcon('shodan-101'), 'travel_explore');
  assert.equal(courseIcon('otro'), 'school');
});
