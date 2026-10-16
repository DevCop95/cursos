import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ROADMAP, roadmapCourseIds, courseState, missingBefore, nextRecommended } from '../js/lib/roadmap.js';
import { PUBLIC_COURSES } from '../js/lib/public-courses.js';

const done = (...ids) => Object.fromEntries(ids.map(id => [id, { percent: 100, complete: true }]));

test('la ruta incluye exactamente los cursos del catálogo, cada uno con su ficha', () => {
  const ids = roadmapCourseIds();
  assert.deepEqual([...ids].sort(), PUBLIC_COURSES.map(c => c.id).sort());
  ids.forEach(id => assert.ok(ROADMAP.requires[id], `sin requisitos definidos para ${id}`));
});

test('los requisitos apuntan a cursos que existen y vienen antes en la ruta', () => {
  const order = roadmapCourseIds();
  for (const [id, r] of Object.entries(ROADMAP.requires)) {
    for (const dep of [...(r.hard || []), ...(r.soft || [])]) {
      assert.ok(order.includes(dep), `${id} depende de ${dep}, que no está en la ruta`);
      assert.notEqual(dep, id);
      assert.ok(order.indexOf(dep) < order.indexOf(id), `${dep} debería venir antes que ${id}`);
    }
  }
});

test('en cada camino, un curso nunca aparece antes de su requisito obligatorio', () => {
  for (const path of ROADMAP.paths) {
    path.steps.forEach((id, i) => {
      for (const dep of (ROADMAP.requires[id].hard || [])) {
        const before = [...ROADMAP.base.steps, ...path.steps.slice(0, i)];
        assert.ok(before.includes(dep), `${path.key}: ${id} necesita ${dep} antes`);
      }
    });
  }
});

test('la base es gratis y los caminos no repiten un curso dentro del mismo camino', () => {
  ROADMAP.base.steps.forEach(id => assert.equal(PUBLIC_COURSES.find(c => c.id === id).free, true, `${id} debería ser gratis`));
  ROADMAP.paths.forEach(p => assert.equal(new Set(p.steps).size, p.steps.length));
});

test('courseState distingue nuevo, en curso y completado', () => {
  assert.equal(courseState('linux-101', {}), 'new');
  assert.equal(courseState('linux-101', { 'linux-101': { percent: 0 } }), 'new');
  assert.equal(courseState('linux-101', { 'linux-101': { percent: 35 } }), 'doing');
  assert.equal(courseState('linux-101', { 'linux-101': { percent: 100, complete: true } }), 'done');
});

test('missingBefore: obligatorio y recomendado que faltan, y se vacían al completarlos', () => {
  assert.deepEqual(missingBefore('incidentes-101', {}), { hard: ['linux-101'], soft: ['redes-101'] });
  assert.deepEqual(missingBefore('incidentes-101', done('linux-101')), { hard: [], soft: ['redes-101'] });
  assert.deepEqual(missingBefore('incidentes-101', done('linux-101', 'redes-101')), { hard: [], soft: [] });
  assert.deepEqual(missingBefore('devsec-101', {}).hard, ['git-github-101']);
  assert.deepEqual(missingBefore('linux-101', {}), { hard: [], soft: [] });
});

test('nextRecommended: empieza por Linux, sigue la base y luego el camino ya empezado', () => {
  assert.deepEqual(nextRecommended({}), { id: 'linux-101', why: 'base' });
  assert.deepEqual(nextRecommended(done('linux-101')), { id: 'redes-101', why: 'base' });
  assert.deepEqual(nextRecommended({ ...done('linux-101'), 'pentesting-101': { percent: 20 } }), { id: 'pentesting-101', why: 'base' });
  const base = done('linux-101', 'redes-101', 'pentesting-101');
  assert.equal(nextRecommended(base), null); // base hecha y ningún camino elegido: que elija
  assert.deepEqual(nextRecommended({ ...base, 'shodan-101': { percent: 100, complete: true } }), { id: 'webhacking-101', why: 'camino' });
  assert.deepEqual(nextRecommended({ ...base, 'git-github-101': { percent: 40 } }), { id: 'git-github-101', why: 'camino' });
  assert.deepEqual(nextRecommended({ ...base, ...done('git-github-101', 'devsec-101') }), { id: 'webhacking-101', why: 'camino' });
  const all = done(...roadmapCourseIds());
  assert.equal(nextRecommended(all), null);
});
