import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeStreak, todayInBogota } from '../js/lib/activity.js';
import { computeBadges } from '../js/lib/badges.js';

test('computeStreak: racha actual y mejor racha', () => {
  const today = '2026-09-24';
  assert.deepEqual(computeStreak([], today), { current: 0, best: 0, activeToday: false });
  assert.deepEqual(computeStreak(['2026-09-24', '2026-09-23', '2026-09-22'], today), { current: 3, best: 3, activeToday: true });
  // Hoy aún sin actividad: la racha sigue viva si ayer hubo.
  assert.equal(computeStreak(['2026-09-23', '2026-09-22'], today).current, 2);
  // Hueco de un día: la racha se reinicia, pero la mejor se conserva.
  const r = computeStreak(['2026-09-24', '2026-09-20', '2026-09-19', '2026-09-18', '2026-09-17'], today);
  assert.equal(r.current, 1);
  assert.equal(r.best, 4);
  // Hace dos días: racha actual 0.
  assert.equal(computeStreak(['2026-09-22'], today).current, 0);
  // Cambio de mes y días repetidos.
  assert.equal(computeStreak(['2026-10-01', '2026-09-30', '2026-09-30'], '2026-10-01').current, 2);
});

test('todayInBogota devuelve la fecha de Colombia (UTC-5)', () => {
  assert.equal(todayInBogota(new Date('2026-09-25T03:00:00Z')), '2026-09-24');
  assert.equal(todayInBogota(new Date('2026-09-25T06:00:00Z')), '2026-09-25');
});

test('computeBadges: se ganan con progreso y racha', () => {
  const none = computeBadges({});
  assert.ok(none.every(b => !b.earned));
  const s = { ipconfig: 'x', ping: 'x', 'q-p1-1': 'x', tracert: 'x', netstat: 'x', 'q-p1-2': 'x', whoami: 'x', 'q-p1-3': 'x' };
  const earned = computeBadges(s, { bestStreak: 3 }).filter(b => b.earned).map(b => b.id);
  assert.deepEqual(earned, ['first-step', 'lab-2', 'lab-3', 'module-1', 'streak-3']); // lab-3: whoami + netstat
  // Las preguntas por sí solas no cuentan como "primer comando".
  assert.ok(!computeBadges({ 'q-p1-1': 'x' }).find(b => b.id === 'first-step').earned);
});
