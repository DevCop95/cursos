/**
 * Regla de acceso a cursos (módulo puro, con tests). Es un espejo de public.can_access_course()
 * en Supabase, que es quien de verdad la aplica; aquí solo sirve para explicar en el panel de admin
 * por qué un alumno tiene o no acceso.
 *
 * Orden: administrador → sí (todos, también los no publicados) · bloqueo explícito → no · concesión explícita → sí · curso gratis y publicado → sí ·
 * nivel 'full' y curso publicado → sí · si no → no.
 */
export const ACCESS_LEVELS = [
  { id: 'free', label: 'Gratis', desc: 'Solo cursos gratuitos' },
  { id: 'full', label: 'Total', desc: 'Todos los cursos publicados' }
];

export const ACCESS_REASONS = {
  admin: { label: 'Administrador', allowed: true },
  blocked: { label: 'Bloqueado', allowed: false },
  granted: { label: 'Concedido', allowed: true },
  free: { label: 'Gratis', allowed: true },
  full: { label: 'Acceso total', allowed: true },
  unpublished: { label: 'No publicado', allowed: false },
  none: { label: 'Sin acceso', allowed: false }
};

// course: { id, is_free, published } · profile: { role, access_level } · overrides: [{ course_id, enabled }]
export function courseAccess(course, profile = {}, overrides = []) {
  const override = overrides.find(o => o.course_id === course.id);
  let reason;
  if (profile.role === 'admin') reason = 'admin';
  else if (override && !override.enabled) reason = 'blocked';
  else if (override && override.enabled) reason = 'granted';
  else if (!course.published) reason = 'unpublished';
  else if (course.is_free) reason = 'free';
  else if (profile.access_level === 'full') reason = 'full';
  else reason = 'none';
  return { reason, ...ACCESS_REASONS[reason] };
}
