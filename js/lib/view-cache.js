/**
 * Últimos datos que se mostraron en una vista (por usuario, en este navegador), para pintarla al instante la
 * próxima vez y retocar solo lo que cambie cuando responda el servidor: sin saltos de contenido.
 * Solo datos de presentación del propio alumno (títulos, porcentajes, rango). Se borran al cerrar sesión.
 */
const PREFIX = 'dev101x_view:';
const key = (name, user) => `${PREFIX}${name}:${(user && (user.userId || user.email)) || 'anon'}`;

export function readViewCache(name, user) {
  try {
    const raw = localStorage.getItem(key(name, user));
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

export function writeViewCache(name, user, data) {
  try { localStorage.setItem(key(name, user), JSON.stringify(data)); } catch (e) { /* sin almacenamiento: no pasa nada */ }
}

export function clearViewCaches() {
  try {
    Object.keys(localStorage).filter(k => k.startsWith(PREFIX)).forEach(k => localStorage.removeItem(k));
  } catch (e) { /* noop */ }
}
