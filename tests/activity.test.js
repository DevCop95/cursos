import { test } from 'node:test';
import assert from 'node:assert/strict';
import { activityStatus, relativeTime, filterByActivity, lastActivity } from '../js/lib/activity.js';

const NOW = Date.parse('2026-09-24T12:00:00Z');
const ago = min => new Date(NOW - min * 60000).toISOString();

test('activityStatus clasifica por la señal más reciente', () => {
  assert.equal(activityStatus({ last_seen: ago(2) }, NOW), 'online');
  assert.equal(activityStatus({ last_seen: ago(6) }, NOW), 'active');
  assert.equal(activityStatus({ last_seen: ago(8 * 24 * 60) }, NOW), 'inactive');
  assert.equal(activityStatus({}, NOW), 'never');
  assert.equal(activityStatus({ last_seen: ago(600), last_login: ago(1) }, NOW), 'online');
  assert.equal(activityStatus({ last_seen: 'basura' }, NOW), 'never');
});

test('relativeTime', () => {
  assert.equal(relativeTime(null, NOW), '—');
  assert.equal(relativeTime(NOW - 10000, NOW), 'ahora');
  assert.equal(relativeTime(NOW - 5 * 60000, NOW), 'hace 5 min');
  assert.equal(relativeTime(NOW - 3 * 3600000, NOW), 'hace 3 h');
  assert.equal(relativeTime(NOW - 24 * 3600000, NOW), 'hace 1 día');
  assert.equal(relativeTime(NOW - 72 * 3600000, NOW), 'hace 3 días');
});

test('filterByActivity filtra y ordena por actividad reciente', () => {
  const rows = [
    { id: 'viejo', last_seen: ago(30 * 24 * 60) },
    { id: 'nunca' },
    { id: 'online', last_seen: ago(1) },
    { id: 'semana', last_login: ago(3 * 24 * 60) }
  ];
  assert.deepEqual(filterByActivity(rows, 'all', NOW).map(r => r.id), ['online', 'semana', 'viejo', 'nunca']);
  assert.deepEqual(filterByActivity(rows, 'active', NOW).map(r => r.id), ['online', 'semana']);
  assert.deepEqual(filterByActivity(rows, 'online', NOW).map(r => r.id), ['online']);
  assert.equal(lastActivity({}), null);
});
