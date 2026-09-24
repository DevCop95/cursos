import { test } from 'node:test';
import assert from 'node:assert/strict';
import { esc, safeUrl, csvCell, toCsv, normalize } from '../js/lib/html.js';

test('esc neutraliza HTML y atributos', () => {
  assert.equal(esc('<img src=x onerror=alert(1)>'), '&lt;img src=x onerror=alert(1)&gt;');
  assert.equal(esc('"\'&`'), '&quot;&#39;&amp;&#96;');
  assert.equal(esc(null), '');
  assert.equal(esc(42), '42');
});

test('safeUrl rechaza esquemas peligrosos', () => {
  assert.equal(safeUrl('javascript:alert(1)'), '');
  assert.equal(safeUrl('https://lh3.googleusercontent.com/a/x'), 'https://lh3.googleusercontent.com/a/x');
  assert.equal(safeUrl('assets/icon-192.png'), 'assets/icon-192.png');
  assert.equal(safeUrl('http://inseguro.test/a.png', 'fb'), 'fb');
});

test('csvCell escapa comillas y evita inyección de fórmulas', () => {
  assert.equal(csvCell('a"b'), '"a""b"');
  assert.equal(csvCell('=HYPERLINK("x")'), '"\'=HYPERLINK(""x"")"');
  assert.equal(csvCell('-1'), '"\'-1"');
  assert.equal(toCsv(['a'], [[1]]), '"a"\r\n"1"\r\n');
});

test('normalize quita tildes y mayúsculas', () => {
  assert.equal(normalize('Lección ÁRBOL'), 'leccion arbol');
});
