/**
 * Insignias del alumno (módulo puro, con tests). Pocas y con sentido para un solo curso; se derivan
 * del progreso y de la racha, que valida el servidor, así que no hace falta guardarlas aparte.
 */
import { LAB_STEPS } from '../content.js?v=dev101x-v68';
import { isLabDone, isCommandStep } from '../lab.js?v=dev101x-v68';

export function computeBadges(steps = {}, { bestStreak = 0 } = {}) {
  return [
    {
      id: 'first-step', icon: 'rocket_launch', title: 'Primer comando',
      desc: 'Ejecutaste tu primer comando válido en el laboratorio.',
      earned: Object.keys(steps).some(isCommandStep)
    },
    {
      id: 'labs', icon: 'science', title: 'Laboratorios',
      desc: `Completaste los ${LAB_STEPS.length} laboratorios en la consola.`,
      earned: LAB_STEPS.every(lab => isLabDone(lab, steps))
    },
    {
      id: 'final', icon: 'flag', title: 'Reto final',
      desc: 'Encontraste las respuestas del reto sobre el objetivo.',
      earned: ['f-ports', 'f-web', 'f-build'].every(s => Boolean(steps[s]))
    },
    {
      id: 'streak-7', icon: 'local_fire_department', title: 'Racha de 7 días',
      desc: 'Estudiaste 7 días seguidos.',
      earned: bestStreak >= 7
    }
  ];
}
