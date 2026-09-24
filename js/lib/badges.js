/**
 * Insignias del alumno (módulo puro, con tests). Se derivan del progreso y de la racha, que valida
 * el servidor, así que no hace falta guardarlas aparte.
 */
import { COURSE, LAB_STEPS } from '../content.js';
import { isLessonDone, isLabDone, isCommandStep } from '../lab.js';

export function computeBadges(steps = {}, { bestStreak = 0 } = {}) {
  const has = s => Boolean(steps[s]);
  const badges = [
    {
      id: 'first-step', icon: 'rocket_launch', title: 'Primer comando',
      desc: 'Ejecutaste tu primer comando válido en el laboratorio.',
      earned: Object.keys(steps).some(isCommandStep)
    },
    ...LAB_STEPS.map(lab => ({
      id: lab.id, icon: lab.icon, title: lab.title,
      desc: 'Laboratorio completado en la consola.',
      earned: isLabDone(lab, steps)
    })),
    ...COURSE.syllabus.map((m, i) => ({
      id: `module-${i + 1}`, icon: 'workspace_premium', title: `Módulo ${i + 1} completado`,
      desc: m.module.replace(/^Módulo \d+:\s*/, ''),
      earned: m.lessons.every(l => isLessonDone(l, steps))
    })),
    {
      id: 'final', icon: 'flag', title: 'Reto final superado',
      desc: 'Encontraste las respuestas del reto sobre el objetivo.',
      earned: ['f-ports', 'f-web', 'f-build'].every(has)
    },
    { id: 'streak-3', icon: 'local_fire_department', title: 'Racha de 3 días', desc: 'Estudiaste 3 días seguidos.', earned: bestStreak >= 3 },
    { id: 'streak-7', icon: 'whatshot', title: 'Racha de 7 días', desc: 'Estudiaste 7 días seguidos.', earned: bestStreak >= 7 }
  ];
  return badges;
}
