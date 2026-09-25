/**
 * Adaptador de Supabase. El SDK se carga bajo demanda y solo si hay anon key configurada.
 * Todas las lecturas/escrituras dependen de las políticas RLS definidas en supabase/schema.sql.
 */
import { CONFIG, isCloudEnabled } from './config.js?v=dev101x-v65';

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
  const { data, error } = await client.from('profiles').select('id, email, full_name, display_name, role').eq('id', userId).maybeSingle();
  if (error) throw error;
  return data;
}

// Nombre visible elegido por el alumno. Vacío = volver al de Google. El servidor valida y limita (1 por minuto).
export async function setDisplayName(name) {
  const client = await getClient();
  if (!client) throw new Error('Supabase no está configurado.');
  const { data, error } = await client.rpc('set_display_name', { p_name: String(name || '') });
  if (error) throw new Error(error.message || 'No se pudo cambiar el nombre.');
  return data; // nombre guardado o null
}

export async function touchLastLogin(userId, fullName, avatarUrl) {
  const client = await getClient();
  if (!client) return;
  await client.from('profiles').update({ last_login: new Date().toISOString(), full_name: fullName, avatar_url: avatarUrl }).eq('id', userId);
}

export async function fetchOwnProgress(userId) {
  const client = await getClient();
  if (!client) return null;
  const { data, error } = await client.from('student_progress').select('steps, completed_at, reset_at').eq('user_id', userId).maybeSingle();
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

// Pregunta de lección o respuesta del reto final: la valida el servidor.
// Devuelve { correct, steps? , remaining? }; lanza error si hay demasiados intentos.
export async function answerQuiz(step, answer) {
  const client = await getClient();
  if (!client) throw new Error('Las preguntas necesitan conexión con el servidor.');
  const { data, error } = await client.rpc('answer_quiz', { p_step: step, p_answer: String(answer || '').slice(0, 200) });
  if (error) throw error;
  return data;
}

// Cursos terminados del propio alumno (los registra el servidor al llegar al 100 %).
export async function fetchOwnCompletions() {
  const client = await getClient();
  if (!client) return [];
  const { data, error } = await client.from('course_completions').select('course_id, completed_at');
  if (error) throw error;
  return data;
}

// Días con actividad del propio alumno (para la racha), más recientes primero.
export async function fetchOwnActivityDays() {
  const client = await getClient();
  if (!client) return [];
  const { data, error } = await client.from('activity_days').select('day').order('day', { ascending: false }).limit(400);
  if (error) throw error;
  return data.map(r => r.day);
}

export async function fetchNote(lessonId) {
  const client = await getClient();
  if (!client) return null;
  const { data, error } = await client.from('lesson_notes').select('body, updated_at').eq('lesson_id', lessonId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function saveNote(lessonId, body) {
  const client = await getClient();
  if (!client) throw new Error('Las notas necesitan conexión con el servidor.');
  const { error } = await client.from('lesson_notes').upsert({ lesson_id: lessonId, body, updated_at: new Date().toISOString() });
  if (error) throw error;
}

// Marca al usuario como activo (last_seen = now() en el servidor).
export async function touchPresence() {
  const client = await getClient();
  if (!client) return;
  const { error } = await client.rpc('touch_presence');
  if (error) throw error;
}

// Cursos a los que el alumno tiene acceso según la regla del servidor (can_access_course).
export async function fetchAccessibleCourses() {
  const client = await getClient();
  if (!client) return null;
  const { data, error } = await client.rpc('accessible_courses');
  if (error) throw error;
  return data || [];
}

// ---------------------------------------------------------------------------
// Cursos con el contenido en la base de datos (de pago). Solo se entregan a quien tiene acceso.
// ---------------------------------------------------------------------------
export async function fetchCourseContent(courseId) {
  const client = await getClient();
  if (!client) return null;
  const { data, error } = await client.from('course_content').select('content').eq('course_id', courseId).maybeSingle();
  if (error) throw error;
  return data ? data.content : null;
}

export async function fetchCourseProgress(courseId) {
  const client = await getClient();
  if (!client) return null;
  let q = client.from('course_progress').select('course_id, steps, progress_percentage, completed_at');
  if (courseId) q = q.eq('course_id', courseId);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

export async function recordCourseSteps(courseId, steps) {
  const client = await getClient();
  if (!client) throw new Error('Supabase no está disponible.');
  const { data, error } = await client.rpc('record_course_steps', { p_course: courseId, p_steps: steps });
  if (error) throw error;
  return data;
}

export async function answerCourseQuiz(courseId, step, answer) {
  const client = await getClient();
  if (!client) throw new Error('Las preguntas necesitan conexión con el servidor.');
  const { data, error } = await client.rpc('answer_course_quiz', { p_course: courseId, p_step: step, p_answer: String(answer || '').slice(0, 200) });
  if (error) throw error;
  return data;
}

// Reconocimiento pasivo real de un dominio (hostnames en Certificate Transparency), vía la Edge Function
// 'recon'. Solo para alumnos con acceso al curso de Shodan. Devuelve { domain, hostnames, total } o { error }.
export async function recon(domain, live = false) {
  const client = await getClient();
  if (!client) throw new Error('Supabase no está disponible.');
  const { data: sess } = await client.auth.getSession();
  const token = sess && sess.session && sess.session.access_token;
  if (!token) throw new Error('Inicia sesión para usar recons101x.');
  // Se llama por fetch directo (no functions.invoke) para adjuntar el token del alumno de forma explícita
  // y poder leer el mensaje de error del cuerpo tal cual.
  const res = await fetch(`${CONFIG.supabaseUrl}/functions/v1/recon`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, apikey: CONFIG.supabaseAnonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ domain, live })
  });
  let body = null;
  try { body = await res.json(); } catch (e) { /* respuesta sin JSON */ }
  if (!res.ok) throw new Error((body && body.error) || `No se pudo hacer el reconocimiento (${res.status}).`);
  return body;
}

// Rango, puntos e insignias (cursos terminados), calculados en el servidor. Sin userId: los propios.
export async function fetchUserStats(userId = null) {
  const client = await getClient();
  if (!client) return null;
  const { data, error } = await client.rpc('user_stats', { p_user: userId });
  if (error) throw error;
  return data;
}

// Mensajes alumno ↔ administrador. RLS: el alumno solo ve su conversación; el admin, todas.
// El servidor limita los envíos del alumno (5 por hora, 20 al día, 1000 caracteres).
export async function fetchMessages() {
  const client = await getClient();
  if (!client) return [];
  const { data, error } = await client.from('messages')
    .select('id, user_id, from_admin, kind, course_id, body, created_at, read_at')
    .order('created_at', { ascending: false }).limit(500); // los 500 más recientes
  if (error) throw error;
  return (data || []).reverse();
}

async function rpc(name, args) {
  const client = await getClient();
  if (!client) throw new Error('Supabase no está configurado.');
  const { error } = await client.rpc(name, args);
  if (error) throw error;
}

export const sendMessage = body => rpc('send_message', { p_body: body });
export const adminSendMessage = (userId, body) => rpc('admin_send_message', { p_user: userId, p_body: body });
export const markMessagesRead = (userId = null) => rpc('mark_messages_read', { p_user: userId });
export const adminRevokeCourse = (userId, courseId, reason) => rpc('admin_revoke_course', { p_user: userId, p_course: courseId, p_reason: reason });

// Solicitudes de acceso. El servidor limita: una por alumno y curso, y 24 h de espera tras un rechazo.
export async function requestCourseAccess(courseId) {
  const client = await getClient();
  if (!client) throw new Error('Supabase no está configurado.');
  const { error } = await client.rpc('request_course_access', { p_course: courseId });
  if (error) throw error;
}

// Las del alumno (RLS: solo las suyas) o todas si es admin: [{ user_id, course_id, created_at, rejected_at }].
export async function fetchAccessRequests() {
  const client = await getClient();
  if (!client) return [];
  const { data, error } = await client.from('course_access_requests').select('user_id, course_id, created_at, rejected_at').order('created_at');
  if (error) throw error;
  return data || [];
}

export async function adminRejectAccessRequest(userId, courseId) {
  const client = await getClient();
  if (!client) throw new Error('Supabase no está configurado.');
  const { error } = await client.rpc('admin_reject_access_request', { p_user: userId, p_course: courseId });
  if (error) throw error;
}

// Valor propio del laboratorio real del alumno (p. ej. el hash de su primer commit) para el reto final.
export async function recordCourseValue(courseId, key, value) {
  const client = await getClient();
  if (!client) return;
  const { error } = await client.rpc('record_course_value', { p_course: courseId, p_key: key, p_value: value });
  if (error) throw error;
}

// Estado del alumno en un curso (terminal, historial, última lección). Solo lo lee y escribe su dueño.
export async function fetchCourseState(courseId) {
  const client = await getClient();
  if (!client) return null;
  const { data, error } = await client.from('user_course_state').select('data, updated_at').eq('course_id', courseId).maybeSingle();
  if (error) throw error;
  return data ? data.data : null;
}

export async function saveCourseState(courseId, data) {
  const client = await getClient();
  if (!client) return;
  const { error } = await client.from('user_course_state').upsert({ course_id: courseId, data, updated_at: new Date().toISOString() });
  if (error) throw error;
}

// Catálogo: los alumnos ven los publicados; los admin, todos.
export async function fetchCourses() {
  const client = await getClient();
  if (!client) return [];
  const { data, error } = await client.from('courses').select('id, title, is_free, published, has_content, sort, summary').order('sort').order('id');
  if (error) throw error;
  return data;
}

// --- Administración (RLS solo lo permite a perfiles con role = 'admin') ---
export async function adminListStudents() {
  const client = await getClient();
  if (!client) throw new Error('Supabase no está configurado.');
  const [profiles, progress, access, completions, courseProgress] = await Promise.all([
    client.from('profiles').select('id, email, full_name, display_name, avatar_url, role, access_level, last_login, last_seen, created_at').order('created_at', { ascending: false }),
    client.from('student_progress').select('user_id, steps, progress_percentage, completed_at'),
    client.from('course_access').select('user_id, course_id, enabled'),
    client.from('course_completions').select('user_id, course_id, completed_at'),
    client.from('course_progress').select('user_id, course_id, progress_percentage, completed_at')
  ]);
  const err = profiles.error || progress.error || access.error || completions.error || courseProgress.error;
  if (err) throw err;
  // full_name pasa a ser el nombre visible (el elegido por el alumno o el de Google); google_name, el de Google.
  return profiles.data.map(p => ({
    ...p,
    full_name: p.display_name || p.full_name,
    google_name: p.full_name,
    progress: progress.data.find(r => r.user_id === p.id) || null,
    access: access.data.filter(r => r.user_id === p.id),
    completions: completions.data.filter(r => r.user_id === p.id),
    courseProgress: courseProgress.data.filter(r => r.user_id === p.id)
  }));
}

// Excepción por curso: 'grant' (conceder), 'block' (bloquear) o 'auto' (quitar la excepción y aplicar la regla).
export async function adminSetCourseOverride(userId, courseId, mode) {
  const client = await getClient();
  if (!client) throw new Error('Supabase no está configurado.');
  const q = mode === 'auto'
    ? client.from('course_access').delete().eq('user_id', userId).eq('course_id', courseId)
    : client.from('course_access').upsert({ user_id: userId, course_id: courseId, enabled: mode === 'grant', updated_at: new Date().toISOString() });
  const { error } = await q;
  if (error) throw error;
}

// Nivel de acceso del alumno: 'free' o 'full'.
export async function adminSetAccessLevel(userId, level) {
  const client = await getClient();
  if (!client) throw new Error('Supabase no está configurado.');
  const { error } = await client.from('profiles').update({ access_level: level }).eq('id', userId);
  if (error) throw error;
}

// Reinicia el progreso de un alumno en un curso (la función del servidor comprueba que eres admin).
export async function adminResetProgress(userId, courseId) {
  const client = await getClient();
  if (!client) throw new Error('Supabase no está configurado.');
  const { error } = await client.rpc('admin_reset_progress', { p_user: userId, p_course: courseId });
  if (error) throw error;
}

// Cambia is_free o published de un curso del catálogo.
export async function adminUpdateCourse(courseId, fields) {
  const client = await getClient();
  if (!client) throw new Error('Supabase no está configurado.');
  const allowed = {};
  ['is_free', 'published'].forEach(k => { if (typeof fields[k] === 'boolean') allowed[k] = fields[k]; });
  const { error } = await client.from('courses').update(allowed).eq('id', courseId);
  if (error) throw error;
}
