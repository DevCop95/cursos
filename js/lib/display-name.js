/**
 * Validación del nombre visible (módulo puro, con tests). Es la misma regla que aplica el servidor en
 * public.set_display_name() y en la restricción de la tabla: solo letras (con acentos y ñ) y espacios,
 * sin números ni símbolos. Aquí solo sirve para avisar antes de enviar.
 * Devuelve { value } (null = volver al nombre de Google) o { error }.
 */
const LETTERS = 'A-Za-zÀ-ÖØ-öø-ÿ';
const VALID = new RegExp(`^[${LETTERS}]+( [${LETTERS}]+)*$`);

export function checkDisplayName(raw) {
  const value = String(raw ?? '')
    .replace(/[\u0000-\u0008\u000B-\u001F\u007F‎‏‪-‮⁦-⁩]/g, '')
    .trim()
    .replace(/\s+/g, ' ');
  if (!value) return { value: null };
  if (value.length < 2 || value.length > 40) return { error: 'El nombre debe tener entre 2 y 40 letras.' };
  if (!VALID.test(value)) return { error: 'Usa solo letras y espacios, sin números ni símbolos.' };
  return { value };
}
