import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkDisplayName } from '../js/lib/display-name.js';

test('nombre visible: limpia espacios y acepta acentos, ñ y . \' - _', () => {
  assert.deepEqual(checkDisplayName('  Ana    María  '), { value: 'Ana María' });
  assert.deepEqual(checkDisplayName("José Ñúñez-O'Brien"), { value: "José Ñúñez-O'Brien" });
  assert.deepEqual(checkDisplayName('dev_101x'), { value: 'dev_101x' });
});

test('nombre visible: vacío vuelve al nombre de Google', () => {
  assert.deepEqual(checkDisplayName(''), { value: null });
  assert.deepEqual(checkDisplayName('   '), { value: null });
  assert.deepEqual(checkDisplayName(null), { value: null });
});

test('nombre visible: rechaza símbolos, longitudes fuera de rango y nombres sin letras', () => {
  assert.ok(checkDisplayName('<script>').error);
  assert.ok(checkDisplayName('a').error);
  assert.ok(checkDisplayName('a'.repeat(41)).error);
  assert.ok(checkDisplayName('1234').error);
  assert.ok(checkDisplayName('Ana‮evil').value === 'Anaevil', 'quita caracteres de control bidireccionales');
});
