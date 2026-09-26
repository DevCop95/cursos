/**
 * Solicitudes de acceso agrupadas por alumno (módulo puro, con tests): una fila por persona con los cursos que
 * pide, la más antigua primero (se atienden por orden de llegada). Filtros opcionales por curso y por texto
 * (nombre o correo, sin distinguir mayúsculas ni tildes).
 */
const fold = v => String(v || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export function groupRequests(requests, { rows = [], query = '', course = '' } = {}) {
  const q = fold(query).trim();
  const byUser = new Map();
  for (const r of requests || []) {
    if (!r || r.rejected_at || (course && r.course_id !== course)) continue;
    if (!byUser.has(r.user_id)) {
      const row = rows.find(x => x.id === r.user_id) || {};
      byUser.set(r.user_id, { userId: r.user_id, name: row.full_name || '', email: row.email || '', avatar: row.avatar_url || '', items: [], oldest: r.created_at });
    }
    const g = byUser.get(r.user_id);
    g.items.push({ courseId: r.course_id, createdAt: r.created_at });
    if (Date.parse(r.created_at) < Date.parse(g.oldest)) g.oldest = r.created_at;
  }
  return [...byUser.values()]
    .filter(g => !q || fold(g.name).includes(q) || fold(g.email).includes(q))
    .map(g => ({ ...g, items: g.items.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt)) }))
    .sort((a, b) => Date.parse(a.oldest) - Date.parse(b.oldest));
}
