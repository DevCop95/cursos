/**
 * Autenticación con Google.
 *  - Modo nube (Supabase configurado): login OAuth por redirección (PKCE) gestionado por
 *    Supabase Auth; el rol se lee de la tabla profiles.
 *  - Modo local: solo se comprueban los claims para mostrar el perfil; el rol es siempre
 *    'student' y no existe acceso de administración.
 */
import { CONFIG, isCloudEnabled } from './config.js?v=dev101x-v50';
import { checkGoogleClaims } from './lib/jwt.js?v=dev101x-v50';
import { appState, saveState, resetState, clearSession, isSessionValid } from './state.js?v=dev101x-v50';
import * as cloud from './cloud.js?v=dev101x-v50';
import { pullProgressFromCloud } from './progress.js?v=dev101x-v50';

let pendingNonce = null;

async function sha256Hex(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Genera un nonce nuevo para cada render del botón de Google. Devuelve el hash que va a Google.
export async function prepareNonce() {
  if (!isCloudEnabled()) return undefined;
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  pendingNonce = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  return sha256Hex(pendingNonce);
}

// Cursos visibles para el alumno según el servidor. Si no responde, se asume solo el curso gratuito
// (el servidor sigue impidiendo guardar progreso de cursos sin acceso).
async function loadCourseAccess() {
  const ids = await cloud.fetchAccessibleCourses().catch(() => null);
  return Array.isArray(ids) ? ids : [CONFIG.defaultCourseId];
}

// Cursos que el alumno ya conocía en este navegador, para avisarle de los accesos nuevos (p. ej. cuando el
// admin concede una solicitud). La primera vez solo se anotan, sin avisar.
const seenAccessKey = () => `dev101x_seen_access:${appState.session ? appState.session.userId : ''}`;

export function takeNewCourseAccess() {
  if (!appState.session || appState.session.mode !== 'cloud') return [];
  let seen = null;
  try { seen = JSON.parse(localStorage.getItem(seenAccessKey()) || 'null'); } catch (e) { /* sin datos */ }
  const ids = appState.enabledCourses || [];
  try { localStorage.setItem(seenAccessKey(), JSON.stringify(ids)); } catch (e) { /* almacenamiento bloqueado */ }
  return Array.isArray(seen) ? ids.filter(id => !seen.includes(id)) : [];
}

// Vuelve a pedir los cursos accesibles (al volver a la pestaña) y devuelve los nuevos.
export async function checkNewCourseAccess() {
  if (!appState.session || appState.session.mode !== 'cloud') return [];
  const ids = await cloud.fetchAccessibleCourses().catch(() => null);
  if (!Array.isArray(ids)) return [];
  appState.enabledCourses = ids;
  saveState(appState);
  return takeNewCourseAccess();
}

// ---------------------------------------------------------------------------
// Última cuenta usada en este navegador (para "Continuar como …" en el login).
// Solo datos públicos del perfil; se conserva al cerrar sesión y se borra con "No soy yo".
// ---------------------------------------------------------------------------
const LAST_ACCOUNT_KEY = 'dev101x_last_account';

export function getLastAccount() {
  try {
    const acc = JSON.parse(localStorage.getItem(LAST_ACCOUNT_KEY) || 'null');
    return acc && typeof acc.email === 'string' && acc.email ? acc : null;
  } catch (e) {
    return null;
  }
}

function rememberAccount({ name, email, avatar }) {
  try { localStorage.setItem(LAST_ACCOUNT_KEY, JSON.stringify({ name, email, avatar })); } catch (e) { /* noop */ }
}

export function forgetLastAccount() {
  try { localStorage.removeItem(LAST_ACCOUNT_KEY); } catch (e) { /* noop */ }
}

// Abre la sesión local a partir del usuario ya verificado por Supabase.
async function establishCloudSession(user, info) {
  const now = Date.now();
  const profile = await cloud.fetchOwnProfile(user.id);
  await cloud.touchLastLogin(user.id, info.name, info.avatar).catch(() => {});
  appState.session = {
    mode: 'cloud',
    userId: user.id,
    sub: info.sub,
    email: info.email,
    name: info.name,
    avatar: info.avatar,
    role: profile && profile.role === 'admin' ? 'admin' : 'student',
    loginAt: new Date(now).toISOString(),
    // La sesión real la mantiene Supabase; esto solo acota la caché local.
    expiresAt: now + CONFIG.localSessionTtlMs
  };
  appState.enabledCourses = await loadCourseAccess();
  saveState(appState);
  rememberAccount(info);
  await pullProgressFromCloud();
}

// Datos del perfil de Google tal como los guarda Supabase en user_metadata.
function infoFromSupabaseUser(user) {
  const meta = user.user_metadata || {};
  const email = String(user.email || meta.email || '').toLowerCase().trim();
  return {
    sub: String(meta.sub || meta.provider_id || user.id),
    email,
    name: String(meta.full_name || meta.name || email.split('@')[0]),
    avatar: typeof (meta.avatar_url || meta.picture) === 'string' ? (meta.avatar_url || meta.picture) : ''
  };
}

/**
 * Modo nube: redirige a Google a través de Supabase. La página se abandona si todo va bien.
 * mode: 'continue' (cuenta recordada), 'other' (elegir otra) o 'new'.
 */
export async function startGoogleLogin(mode = 'new') {
  const last = getLastAccount();
  await cloud.startGoogleOAuth({
    loginHint: mode === 'continue' && last ? last.email : undefined,
    selectAccount: mode !== 'continue'
  });
}

/**
 * Lee (y quita de la barra de direcciones) el resultado de volver de Google: ?code=… o ?error=…
 * @returns {{code: string} | {error: string} | null}
 */
export function takeOAuthRedirect() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const error = params.get('error_description') || params.get('error');
  if (!code && !error) return null;
  history.replaceState(null, '', window.location.pathname + (window.location.hash || '#/login'));
  return code ? { code } : { error };
}

/**
 * Canjea el código de Google por una sesión de Supabase y abre la sesión de la app.
 * @returns {Promise<{ok: true} | {ok: false, error: string}>}
 */
export async function completeOAuthRedirect(redirect) {
  if (redirect.error) {
    const cancelled = /access_denied/i.test(redirect.error);
    return { ok: false, error: cancelled ? 'Cancelaste el inicio de sesión con Google.' : 'Google no pudo completar el inicio de sesión. Inténtalo de nuevo.' };
  }
  try {
    const user = await cloud.exchangeOAuthCode(redirect.code);
    await establishCloudSession(user, infoFromSupabaseUser(user));
    return { ok: true };
  } catch (err) {
    console.error('Fallo al completar el login con Google:', err);
    return { ok: false, error: 'No se pudo verificar tu sesión con el servidor. Inténtalo de nuevo.' };
  }
}

/**
 * Modo local (sin Supabase): procesa la credencial del botón de Google Identity Services.
 * En modo nube se usa como respaldo: Supabase verifica el ID token.
 * @returns {Promise<{ok: true} | {ok: false, error: string}>}
 */
export async function signInWithGoogleCredential(credential) {
  const claims = checkGoogleClaims(credential, CONFIG.googleClientId);
  if (!claims.valid) return { ok: false, error: claims.error };
  const now = Date.now();

  if (isCloudEnabled()) {
    try {
      const user = await cloud.signInWithGoogleIdToken(credential, pendingNonce);
      pendingNonce = null;
      await establishCloudSession(user, claims.user);
      return { ok: true };
    } catch (err) {
      console.error('Fallo al verificar la sesión en Supabase:', err);
      return { ok: false, error: 'No se pudo verificar tu sesión con el servidor. Inténtalo de nuevo.' };
    }
  }

  rememberAccount(claims.user);
  appState.session = {
    mode: 'local',
    sub: claims.user.sub,
    email: claims.user.email,
    name: claims.user.name,
    avatar: claims.user.avatar,
    role: 'student',
    loginAt: new Date(now).toISOString(),
    expiresAt: now + CONFIG.localSessionTtlMs
  };
  appState.enabledCourses = [CONFIG.defaultCourseId];
  saveState(appState);
  return { ok: true };
}

/**
 * Revalida la sesión guardada al arrancar. En modo nube comprueba que Supabase
 * siga teniendo una sesión para ese usuario y refresca rol y permisos desde la base de datos.
 * @returns {Promise<boolean>} true si algo cambió y hay que volver a pintar.
 */
export async function revalidateSession() {
  if (!appState.session) return false;
  if (!isSessionValid()) {
    await logout();
    return true;
  }
  if (appState.session.mode !== 'cloud') return false;

  if (!isCloudEnabled()) {
    await logout();
    return true;
  }
  const user = await cloud.getCurrentUser().catch(() => null);
  if (!user || user.id !== appState.session.userId) {
    await logout();
    return true;
  }
  const before = JSON.stringify([appState.session.role, appState.enabledCourses]);
  const profile = await cloud.fetchOwnProfile(user.id).catch(() => null);
  appState.session.role = profile && profile.role === 'admin' ? 'admin' : 'student';
  appState.enabledCourses = await loadCourseAccess();
  saveState(appState);
  await pullProgressFromCloud();
  return before !== JSON.stringify([appState.session.role, appState.enabledCourses]);
}

export async function logout() {
  const wasCloud = appState.session && appState.session.mode === 'cloud';
  resetState(clearSession(appState));
  if (wasCloud) await cloud.signOut();
  if (window.google && window.google.accounts && window.google.accounts.id) {
    try { window.google.accounts.id.disableAutoSelect(); } catch (e) { /* noop */ }
  }
}

export function isAdmin() {
  return Boolean(appState.session && appState.session.role === 'admin');
}
