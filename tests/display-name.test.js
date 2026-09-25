import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkDisplayName } from '../js/lib/display-name.js';

test('nombre visible: solo letras (con acentos y ñ) y espacios; limpia espacios de más', () => {
  assert.deepEqual(checkDisplayName('  Ana    María  '), { value: 'Ana María' });
  assert.deepEqual(checkDisplayName('José Ñúñez'), { value: 'José Ñúñez' });
  assert.deepEqual(checkDisplayName('Ana María'), { value: 'Ana María' }, 'el espacio duro pasa a espacio normal');
});

test('nombre visible: vacío vuelve al nombre de Google', () => {
  assert.deepEqual(checkDisplayName(''), { value: null });
  assert.deepEqual(checkDisplayName('   '), { value: null });
  assert.deepEqual(checkDisplayName(null), { value: null });
});

test('nombre visible: rechaza números, símbolos e intentos de inyección', () => {
  const malos = [
    'Ana1', 'R2D2', '12', 'Ana-María', "O'Brien", 'dev_101x', 'Ana.',
    "Robert'); DROP TABLE profiles;--", '<img src=x onerror=alert(1)>', '"><script>alert(1)</script>',
    '${7*7}', '{{7*7}}', '=HYPERLINK("x")', 'Ana​María', 'Аnа', 'Ana 😀'
  ];
  for (const m of malos) assert.ok(checkDisplayName(m).error, `debería rechazar: ${m}`);
});

test('nombre visible: longitud entre 2 y 40', () => {
  assert.ok(checkDisplayName('A').error);
  assert.ok(checkDisplayName('a'.repeat(41)).error);
  assert.deepEqual(checkDisplayName('a'.repeat(40)), { value: 'a'.repeat(40) });
});
