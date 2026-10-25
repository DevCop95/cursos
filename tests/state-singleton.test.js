import { test } from 'node:test';
import assert from 'node:assert/strict';

test('copias de state.js cargadas con versiones distintas comparten la sesión', async () => {
  const first = await import('../js/state.js?test=version-a');
  const second = await import('../js/state.js?test=version-b');

  assert.equal(first.appState, second.appState);
  assert.equal(first.appState, globalThis[Symbol.for('dev101x.appState.v2')]);
});
