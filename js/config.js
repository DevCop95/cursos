/**
 * Dev101x — Configuración pública de la plataforma.
 * Todo lo que hay aquí es público por diseño (se sirve al navegador).
 */
export const CONFIG = {
  // OAuth Client ID de Google Identity Services (fijo; no se puede sobrescribir desde el navegador)
  googleClientId: '41363425322-c9n72qus0d8jj3g3vqc5icd371p7ju1f.apps.googleusercontent.com',

  // Supabase: la anon key es pública; la seguridad real la ponen las políticas RLS de supabase/schema.sql.
  // Mientras supabaseAnonKey esté vacía la plataforma funciona en modo local (solo rol estudiante,
  // progreso guardado en este navegador y panel de administración desactivado).
  supabaseUrl: 'https://tkiknjszqllztzqnvhnz.supabase.co',
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRraWtuanN6cWxsenR6cW52aG56Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAyMDQ2NDMsImV4cCI6MjEwNTc4MDY0M30.XBG7H3bxDMqYY4N29yhzEk7U7c1jPaBXIo7Kgz_xQaA',
  supabaseSdkUrl: 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.1/+esm',

  // Duración de la sesión en modo local (en modo nube la gestiona Supabase con refresh tokens)
  localSessionTtlMs: 7 * 24 * 60 * 60 * 1000,

  defaultCourseId: 'pentesting-101'
};

export function isCloudEnabled() {
  return Boolean(CONFIG.supabaseUrl && CONFIG.supabaseAnonKey);
}
