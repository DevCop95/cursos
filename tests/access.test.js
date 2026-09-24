import { test } from 'node:test';
import assert from 'node:assert/strict';
import { courseAccess } from '../js/lib/access.js';

const FREE = { id: 'nmap', is_free: true, published: true };
const PAID = { id: 'ia', is_free: false, published: true };
const DRAFT = { id: 'draft', is_free: false, published: false };

test('nivel gratis: solo cursos gratuitos', () => {
  assert.equal(courseAccess(FREE, { access_level: 'free' }).reason, 'free');
  assert.equal(courseAccess(PAID, { access_level: 'free' }).reason, 'none');
  assert.equal(courseAccess(PAID, { access_level: 'free' }).allowed, false);
});

test('nivel total: todos los publicados, pero no los borradores', () => {
  assert.equal(courseAccess(PAID, { access_level: 'full' }).reason, 'full');
  assert.equal(courseAccess(DRAFT, { access_level: 'full' }).allowed, false);
});

test('las excepciones del admin mandan sobre la regla general', () => {
  assert.equal(courseAccess(PAID, { access_level: 'free' }, [{ course_id: 'ia', enabled: true }]).reason, 'granted');
  assert.equal(courseAccess(FREE, { access_level: 'full' }, [{ course_id: 'nmap', enabled: false }]).reason, 'blocked');
  // Una excepción de otro curso no afecta.
  assert.equal(courseAccess(PAID, { access_level: 'free' }, [{ course_id: 'nmap', enabled: true }]).reason, 'none');
});
