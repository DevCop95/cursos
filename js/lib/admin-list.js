/**
 * Listas del panel de admin que crecen con el número de alumnos (módulo puro, con tests).
 *  - searchUsers: filtra por nombre o correo, sin distinguir mayúsculas ni tildes.
 *  - groupThreads: conversaciones por alumno, primero las que tienen mensajes sin leer y luego la más reciente.
 */
const fold = v => String(v || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export function searchUsers(rows, query) {
  const q = fold(query).trim();
  if (!q) return rows || [];
  const words = q.split(/\s+/);
  return (rows || []).filter(r => {
    const hay = `${fold(r.full_name)} ${fold(r.google_name)} ${fold(r.email)}`;
    return words.every(w => hay.includes(w));
  });
}

export function groupThreads(messages) {
  const byUser = new Map();
  for (const m of messages || []) {
    if (!byUser.has(m.user_id)) byUser.set(m.user_id, []);
    byUser.get(m.user_id).push(m);
  }
  return [...byUser.entries()]
    .map(([userId, list]) => {
      const sorted = list.slice().sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
      return { userId, last: sorted[sorted.length - 1], unread: sorted.filter(m => !m.from_admin && !m.read_at).length };
    })
    .sort((a, b) => (b.unread > 0) - (a.unread > 0) || Date.parse(b.last.created_at) - Date.parse(a.last.created_at));
}
