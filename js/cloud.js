/**
 * Adaptador de Supabase. El SDK se carga bajo demanda y solo si hay anon key configurada.
 * Todas las lecturas/escrituras dependen de las políticas RLS definidas en supabase/schema.sql.
 */
import { CONFIG, isCloudEnabled } from './config.js';

let clientPromise = null;

export function getClient() {
  if (!isCloudEnabled()) return Promise.resolve(null);
  if (!clientPromise) {
    clientPromise = import(CONFIG.supabaseSdkUrl)
      .then(mod => mod.createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey, {
        // PKCE: Google devuelve ?code=… y lo canjeamos nosotros (el router usa el hash de la URL).
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, flowType: 'pkce' }
      }))
      .catch(err => {
        console.warn('No se pudo cargar Supabase:', err);
        clientPromise = null;
        return null;
      });
  }
  return clientPromise;
}

// Verifica el ID token de Google en el servidor de Supabase y abre una sesión.
export async function signInWithGoogleIdToken(idToken, rawNonce) {
  const client = await getClient();
  if (!client) throw new Error('Supabase no está disponible.');
  const { data, error } = await client.auth.signInWithIdToken({ provider: 'google', token: idToken, nonce: rawNonce });
  if (error) throw error;
  return data.user;
}

// Login por redirección: Supabase manda a Google y vuelve a esta misma página con ?code=…
export async function startGoogleOAuth({ loginHint, selectAccount } = {}) {
  const client = await getClient();
  if (!client) throw new Error('Supabase no está disponible.');
  const queryParams = {};
  if (selectAccount) queryParams.prompt = 'select_account';
  if (loginHint) queryParams.login_hint = loginHint;
  const { data, error } = await client.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin + window.location.pathname, queryParams, skipBrowserRedirect: true }
  });
  if (error) throw error;

  // Comprobación previa: si el proveedor está mal configurado, Supabase responde 400 con JSON
  // en vez de redirigir; así lo mostramos en la tarjeta y no como una página de error cruda.
  let check = null;
  try {
    check = await fetch(data.url, { redirect: 'manual', credentials: 'omit' });
  } catch (e) { /* sin red o CORS: se intenta igualmente */ }
  if (check && check.type !== 'opaqueredirect' && check.status >= 400) {
    const body = await check.json().catch(() => ({}));
    const err = new Error(body.msg || `HTTP ${check.status}`);
    err.code = 'oauth_not_configured';
    throw err;
  }
  window.location.assign(data.url);
}

export async function exchangeOAuthCode(code) {
  const client = await getClient();
  if (!client) throw new Error('Supabase no está disponible.');
  const { data, error } = await client.auth.exchangeCodeForSession(code);
  if (error) throw error;
  return data.user;
}

export async function getCurrentUser() {
  const client = await getClient();
  if (!client) return null;
  const { data } = await client.auth.getSession();
  return data && data.session ? data.session.user : null;
}

export async function signOut() {
  const client = await getClient();
  if (client) await client.auth.signOut().catch(() => {});
}

// El rol se lee de la tabla profiles (solo modificable por SQL/administrador; ver RLS).
export async function fetchOwnProfile(userId) {
  const client = await getClient();
  if (!client) return null;
  const { data, error } = await client.from('profiles').select('id, email, full_name, role').eq('id', userId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function touchLastLogin(userId, fullName, avatarUrl) {
  const client = await getClient();
  if (!client) return;
  await client.from('profiles').update({ last_login: new Date().toISOString(), full_name: fullName, avatar_url: avatarUrl }).eq('id', userId);
}

export async function fetchOwnProgress(userId) {
  const client = await getClient();
  if (!client) return null;
  const { data, error } = await client.from('student_progress').select('steps, completed_at').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return data;
}

// El progreso solo se escribe con la RPC record_steps: el servidor fecha cada paso y calcula el %.
export async function recordSteps(stepKeys) {
  const client = await getClient();
  if (!client) return null;
  const { data, error } = await client.rpc('record_steps', { p_steps: stepKeys });
  if (error) throw error;
  return data;
}

// Marca al usuario como activo (last_seen = now() en el servidor).
export async function touchPresence() {
  const client = await getClient();
  if (!client) return;
  const { error } = await client.rpc('touch_presence');
  if (error) throw error;
}

export async function fetchOwnCourseAccess(userId) {
  const client = await getClient();
  if (!client) return null;
  const { data, error } = await client.from('course_access').select('course_id, enabled').eq('user_id', userId);
  if (error) throw error;
  return data;
}

// --- Administración (RLS solo lo permite a perfiles con role = 'admin') ---
export async function adminListStudents() {
  const client = await getClient();
  if (!client) throw new Error('Supabase no está configurado.');
  const [profiles, progress, access] = await Promise.all([
    client.from('profiles').select('id, email, full_name, avatar_url, role, last_login, last_seen, created_at').order('created_at', { ascending: false }),
    client.from('student_progress').select('user_id, steps, progress_percentage, completed_at'),
    client.from('course_access').select('user_id, course_id, enabled')
  ]);
  const err = profiles.error || progress.error || access.error;
  if (err) throw err;
  return profiles.data.map(p => ({
    ...p,
    progress: progress.data.find(r => r.user_id === p.id) || null,
    access: access.data.filter(r => r.user_id === p.id)
  }));
}

export async function adminSetCourseAccess(userId, courseId, enabled) {
  const client = await getClient();
  if (!client) throw new Error('Supabase no está configurado.');
  const { error } = await client.from('course_access').upsert({ user_id: userId, course_id: courseId, enabled, updated_at: new Date().toISOString() });
  if (error) throw error;
}
