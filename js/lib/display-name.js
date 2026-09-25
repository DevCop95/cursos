/**
 * Validación del nombre visible (módulo puro, con tests). Es la misma regla que aplica el servidor en
 * public.set_display_name(): aquí solo sirve para avisar antes de enviar.
 * Devuelve { value } (null = volver al nombre de Google) o { error }.
 */
const ALLOWED = /^[A-Za-zÀ-ÖØ-öø-ÿ0-9 .'_-]+$/;
const LETTER = /[A-Za-zÀ-ÖØ-öø-ÿ]/;

export function checkDisplayName(raw) {
  const value = String(raw ?? '')
    .replace(/[\u0000-\u0008\u000B-\u001F\u007F‎‏‪-‮⁦-⁩]/g, '')
    .trim()
    .replace(/\s+/g, ' ');
  if (!value) return { value: null };
  if (value.length < 2 || value.length > 40) return { error: 'El nombre debe tener entre 2 y 40 caracteres.' };
  if (!ALLOWED.test(value)) return { error: "Usa solo letras, números, espacios y . ' - _" };
  if (!LETTER.test(value)) return { error: 'El nombre debe tener al menos una letra.' };
  return { value };
}
