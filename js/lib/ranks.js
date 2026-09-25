/**
 * Rangos (estilo Hack The Box) e iconos de las insignias de curso. Módulo puro, con tests.
 * El rango y los puntos los calcula el servidor (public.user_stats); aquí solo se decide cómo se muestran.
 */
export const RANKS = [
  { name: 'Noob', icon: 'egg', tone: 'text-slate-300 bg-slate-400/15 border-slate-400/30' },
  { name: 'Script Kiddie', icon: 'code', tone: 'text-sky-300 bg-sky-400/15 border-sky-400/30' },
  { name: 'Hacker', icon: 'terminal', tone: 'text-emerald-300 bg-emerald-400/15 border-emerald-400/30' },
  { name: 'Pro Hacker', icon: 'bug_report', tone: 'text-violet-300 bg-violet-400/15 border-violet-400/30' },
  { name: 'Elite Hacker', icon: 'shield', tone: 'text-amber-300 bg-amber-400/15 border-amber-400/30' },
  { name: 'Guru', icon: 'psychology', tone: 'text-rose-300 bg-rose-400/15 border-rose-400/30' },
  { name: 'Omniscient', icon: 'visibility', tone: 'text-fuchsia-300 bg-fuchsia-400/15 border-fuchsia-400/30' }
];

// Icono de la insignia de cada curso (los que no estén aquí usan uno genérico).
export const COURSE_ICONS = { 'pentesting-101': 'radar', 'git-github-101': 'account_tree', 'shodan-101': 'travel_explore' };
export const courseIcon = id => COURSE_ICONS[id] || 'school';

/**
 * Datos para pintar el rango a partir de lo que devuelve user_stats. El rango depende del porcentaje del
 * contenido completado (ownership, 0-100), como en Hack The Box; rank_from y next_at son porcentajes.
 * { name, icon, tone, points, ownership, next, remaining (en %), pct (avance hacia el siguiente rango) }.
 */
export function rankView(stats) {
  if (!stats || typeof stats.rank !== 'string') return null;
  const def = RANKS.find(r => r.name === stats.rank) || RANKS[0];
  const points = Math.max(0, Number(stats.points) || 0);
  const own = Math.max(0, Math.min(100, Number(stats.ownership) || 0));
  const from = Number(stats.rank_from) || 0;
  const to = stats.next_at === null || stats.next_at === undefined ? null : Number(stats.next_at);
  const pct = to === null ? 100 : Math.max(0, Math.min(100, Math.round(((own - from) / Math.max(1, to - from)) * 100)));
  return {
    name: def.name, icon: def.icon, tone: def.tone, points, ownership: own,
    next: typeof stats.next_rank === 'string' ? stats.next_rank : null,
    remaining: to === null ? 0 : Math.max(0, to - own),
    pct
  };
}
