import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeJwt, checkGoogleClaims } from '../js/lib/jwt.js';

const CLIENT = 'client-123.apps.googleusercontent.com';
const b64 = obj => Buffer.from(JSON.stringify(obj)).toString('base64url');
const token = payload => `${b64({ alg: 'RS256' })}.${b64(payload)}.firma`;
const now = 1_800_000_000;
const base = { iss: 'https://accounts.google.com', aud: CLIENT, exp: now + 600, email: 'Alumna@Gmail.com', email_verified: true, name: 'José Ñandú', sub: '1234567890' };

test('decodeJwt soporta UTF-8 y rechaza formatos inválidos', () => {
  assert.equal(decodeJwt(token(base)).payload.name, 'José Ñandú');
  assert.equal(decodeJwt('a.b'), null);
  assert.equal(decodeJwt('###.###.###'), null);
});

test('checkGoogleClaims acepta un token correcto y normaliza el correo', () => {
  const r = checkGoogleClaims(token(base), CLIENT, now);
  assert.equal(r.valid, true);
  assert.equal(r.user.email, 'alumna@gmail.com');
});

test('checkGoogleClaims rechaza emisor, audiencia, caducidad y correo no verificado', () => {
  assert.equal(checkGoogleClaims(token({ ...base, iss: 'evil.com' }), CLIENT, now).valid, false);
  assert.equal(checkGoogleClaims(token({ ...base, aud: 'otro' }), CLIENT, now).valid, false);
  assert.equal(checkGoogleClaims(token({ ...base, aud: undefined }), CLIENT, now).valid, false);
  assert.equal(checkGoogleClaims(token({ ...base, exp: now - 1 }), CLIENT, now).valid, false);
  assert.equal(checkGoogleClaims(token({ ...base, email_verified: false }), CLIENT, now).valid, false);
});
