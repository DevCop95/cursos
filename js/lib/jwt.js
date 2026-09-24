/**
 * Lectura de ID tokens de Google en el navegador.
 *
 * IMPORTANTE: aquí NO se verifica la firma. Esta comprobación solo sirve para dar mensajes
 * de error claros al usuario. La verificación criptográfica la hace Supabase Auth
 * (signInWithIdToken) en el servidor, y los permisos los imponen las políticas RLS.
 */
function base64UrlDecode(segment) {
  const base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function decodeJwt(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.trim().split('.');
  if (parts.length !== 3) return null;
  try {
    return { header: JSON.parse(base64UrlDecode(parts[0])), payload: JSON.parse(base64UrlDecode(parts[1])) };
  } catch (e) {
    return null;
  }
}

const GOOGLE_ISSUERS = ['accounts.google.com', 'https://accounts.google.com'];

export function checkGoogleClaims(token, expectedClientId, nowSeconds = Math.floor(Date.now() / 1000)) {
  const decoded = decodeJwt(token);
  if (!decoded) return { valid: false, error: 'El token de Google no tiene un formato válido.' };
  const p = decoded.payload;

  if (!GOOGLE_ISSUERS.includes(p.iss)) return { valid: false, error: 'El token no fue emitido por Google.' };
  if (!p.exp || p.exp < nowSeconds) return { valid: false, error: 'La sesión de Google ha expirado. Vuelve a intentarlo.' };
  if (p.aud !== expectedClientId) return { valid: false, error: 'El token no pertenece a esta aplicación.' };
  if (p.email_verified !== true && p.email_verified !== 'true') return { valid: false, error: 'Tu correo de Google no está verificado.' };

  const email = String(p.email || '').toLowerCase().trim();
  if (!email) return { valid: false, error: 'El token no incluye un correo.' };

  return {
    valid: true,
    user: {
      sub: String(p.sub || ''),
      email,
      name: String(p.name || p.given_name || email.split('@')[0]),
      avatar: typeof p.picture === 'string' ? p.picture : ''
    },
    exp: p.exp
  };
}
