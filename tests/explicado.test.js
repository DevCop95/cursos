import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SCENES } from '../explicado/escenas/index.js';
import { code } from '../explicado/escenas/ayuda.js';
import { ICONS } from '../explicado/icons.js';
import { existsSync, readFileSync, statSync } from 'node:fs';

const TONES = ['normal', 'danger', 'ok', 'idle'];
const KINDS = ['plain', 'input', 'danger', 'comment', 'label', 'ok'];

test('hay diez escenas, A01 a A10, con ids únicos y en orden', () => {
  assert.equal(SCENES.length, 10);
  assert.deepEqual(SCENES.map(s => s.code), ['A01', 'A02', 'A03', 'A04', 'A05', 'A06', 'A07', 'A08', 'A09', 'A10']);
  assert.equal(new Set(SCENES.map(s => s.id)).size, 10);
  for (const s of SCENES) assert.ok(s.id.startsWith(s.code.toLowerCase() + '-'), s.id);
});

for (const scene of SCENES) {
  test(`${scene.code}: actores, pasos y paquetes son coherentes`, () => {
    assert.ok(scene.title && scene.blurb);
    assert.ok(scene.actors.length === 2 || scene.actors.length === 3);
    const ids = scene.actors.map(a => a.id);
    assert.equal(new Set(ids).size, ids.length);
    for (const a of scene.actors) assert.ok(ICONS[a.icon], `${a.id}: icono inexistente ${a.icon}`);
    assert.ok(scene.steps.length >= 6);
    for (const p of scene.steps) {
      assert.ok(p.title && p.text, `paso sin texto en ${scene.code}`);
      assert.ok(['vulnerable', 'safe'].includes(p.mode));
      for (const [id, a] of Object.entries(p.actors || {})) {
        assert.ok(ids.includes(id), `${scene.code}: actor desconocido ${id}`);
        if (a.icon) assert.ok(ICONS[a.icon], `icono inexistente ${a.icon}`);
        if (a.tone) assert.ok(TONES.includes(a.tone));
        if (a.label) assert.ok(a.label.length <= 18, `etiqueta larga: ${a.label}`);
        if (a.badge) assert.ok(a.badge.length <= 22, `distintivo largo: ${a.badge}`);
      }
      if (p.packet) {
        const { from, to, label, tone } = p.packet;
        assert.ok(ids.includes(from) && ids.includes(to) && from !== to);
        assert.equal(Math.abs(ids.indexOf(from) - ids.indexOf(to)), 1, 'el paquete debe ir entre actores contiguos');
        assert.ok(TONES.includes(tone));
        assert.ok(label.length <= 22, `etiqueta de paquete larga: ${label}`);
      }
      for (const line of p.code) {
        assert.ok(line.map(([t]) => t).join('').length <= 40, `línea de código larga en ${scene.code} «${p.title}»`);
        for (const [text, kind] of line) {
          assert.equal(typeof text, 'string');
          assert.ok(KINDS.includes(kind), `tipo de código desconocido ${kind}`);
        }
      }
    }
  });

  test(`${scene.code}: primero el ataque, luego la defensa y un resumen`, () => {
    const firstSafe = scene.steps.findIndex(p => p.mode === 'safe');
    assert.ok(firstSafe > 0, 'falta la parte de defensa');
    assert.ok(scene.steps.slice(0, firstSafe).every(p => p.mode === 'vulnerable'));
    assert.ok(scene.steps.slice(firstSafe).every(p => p.mode === 'safe'));
    const last = scene.steps[scene.steps.length - 1];
    assert.ok(last.points && last.points.length >= 3, 'el último paso debe resumir qué recordar');
  });
}

test('cada escena tiene su video MP4 y su portada, y pesan poco', () => {
  const idx = JSON.parse(readFileSync(new URL('../explicado/videos/index.json', import.meta.url), 'utf8'));
  for (const s of SCENES) {
    const mp4 = new URL('../explicado/' + s.video, import.meta.url);
    assert.ok(existsSync(mp4), 'falta ' + s.video);
    assert.ok(statSync(mp4).size < 4 * 1024 * 1024, s.video + ' pesa demasiado');
    assert.ok(existsSync(new URL('../explicado/' + s.video.replace(/\.mp4$/, '.jpg'), import.meta.url)), 'falta la portada de ' + s.id);
    assert.ok(idx[s.id] >= 15 && idx[s.id] <= 60, 'duración fuera de rango en ' + s.id);
  }
});

test('code(): convierte las marcas en segmentos', () => {
  assert.deepEqual(code("a {i:b} c {d:d}"), [[['a ', 'plain'], ['b', 'input'], [' c ', 'plain'], ['d', 'danger']]]);
  assert.deepEqual(code('{ "x": 1 }'), [[['{ "x": 1 }', 'plain']]]);
});

test('los iconos son rutas SVG de 24x24', () => {
  for (const [name, d] of Object.entries(ICONS)) assert.match(d, /^[MmHhVvLlZz0-9.\-\s,]+$/, name);
});
