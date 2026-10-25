/**
 * Ruta de aprendizaje: en qué orden conviene hacer los cursos (módulo puro, con tests).
 * Solo ordena y recomienda: nunca bloquea un curso. `hard` = sin esto el curso no se entiende (se avisa);
 * `soft` = ayuda, pero se puede saltar.
 */
export const ROADMAP = {
  base: {
    title: 'Base',
    blurb: 'Gratis y para todos. Los demás cursos dan estos conocimientos por sabidos.',
    note: 'Si prefieres un resultado rápido, puedes empezar por Nmap.',
    steps: ['linux-101', 'redes-101', 'pentesting-101']
  },
  paths: [
    { key: 'defensa', title: 'Defensa', blurb: 'Detectar, investigar y reducir lo que se expone.', steps: ['incidentes-101', 'osint-101'] },
    { key: 'ofensiva', title: 'Ofensiva y bug bounty', blurb: 'Reconocer un objetivo y encontrar fallos con ética.', steps: ['shodan-101', 'webhacking-101'] },
    { key: 'desarrollo', title: 'Desarrollo seguro', blurb: 'Proteger el código antes de que llegue a producción.', steps: ['git-github-101', 'devsec-101', 'webhacking-101'] },
    { key: 'exposicion', title: 'Exposición pública', blurb: 'Auditar información indexada y código público de forma autorizada.', steps: ['dorks-101'] }
  ],
  requires: {
    'linux-101': {},
    'redes-101': { soft: ['linux-101'] },
    'pentesting-101': { soft: ['redes-101'] },
    'incidentes-101': { hard: ['linux-101'], soft: ['redes-101'] },
    'osint-101': { soft: ['linux-101'] },
    'shodan-101': { soft: ['redes-101'] },
    'webhacking-101': { soft: ['redes-101'] },
    'git-github-101': {},
    'dorks-101': {},
    'devsec-101': { hard: ['git-github-101'], soft: ['linux-101'] }
  }
};

/** Todos los cursos de la ruta, sin repetir, en el orden en que se leen (base y luego cada camino). */
export function roadmapCourseIds(map = ROADMAP) {
  return [...new Set([...map.base.steps, ...map.paths.flatMap(p => p.steps)])];
}

/**
 * Estado de un curso a partir del progreso: { percent, complete } (cualquier curso sin dato cuenta como nuevo).
 * @returns {'done'|'doing'|'new'}
 */
export function courseState(id, progress = {}) {
  const p = progress[id];
  if (p && p.complete) return 'done';
  if (p && Number(p.percent) > 0) return 'doing';
  return 'new';
}

/** Qué le falta antes de este curso: { hard: ids sin completar, soft: ids sin completar }. */
export function missingBefore(id, progress = {}, map = ROADMAP) {
  const r = map.requires[id] || {};
  const open = list => (list || []).filter(x => courseState(x, progress) !== 'done');
  return { hard: open(r.hard), soft: open(r.soft) };
}

/**
 * Siguiente curso recomendado. Primero la base en su orden; con la base hecha, sigue el camino que el alumno ya
 * empezó (el que tenga más cursos completados o en marcha); si aún no ha elegido, devuelve null (que elija).
 * @returns {{ id: string, why: 'base'|'camino' } | null}
 */
export function nextRecommended(progress = {}, map = ROADMAP) {
  const firstOpen = steps => steps.find(id => courseState(id, progress) !== 'done');
  const inBase = firstOpen(map.base.steps);
  if (inBase) {
    const doing = map.base.steps.find(id => courseState(id, progress) === 'doing');
    return { id: doing || inBase, why: 'base' };
  }
  let best = null;
  for (const path of map.paths) {
    const touched = path.steps.filter(id => courseState(id, progress) !== 'new').length;
    const next = firstOpen(path.steps);
    if (!next || !touched) continue;
    if (!best || touched > best.touched) best = { id: next, why: 'camino', touched };
  }
  return best ? { id: best.id, why: best.why } : null;
}
