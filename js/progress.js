/**
 * Registro del progreso del alumno: guarda en localStorage y, en modo nube, sincroniza con Supabase.
 */
import { appState, saveState, getProgressRecord } from './state.js';
import { computeProgress, mergeSteps } from './lab.js';
import * as cloud from './cloud.js';

// Señal de presencia para el panel de admin: cada minuto mientras la pestaña está visible.
const PRESENCE_INTERVAL_MS = 60 * 1000;
let presenceTimer = null;

function sendPresence() {
  if (!cloudUserId() || document.visibilityState !== 'visible') return;
  cloud.touchPresence().catch(err => console.warn('No se pudo actualizar la presencia:', err.message || err));
}

// Se puede llamar varias veces (arranque, tras el login): envía ya y programa el intervalo una sola vez.
export function startPresence() {
  sendPresence();
  if (presenceTimer) return;
  presenceTimer = setInterval(sendPresence, PRESENCE_INTERVAL_MS);
  document.addEventListener('visibilitychange', sendPresence);
}

function cloudUserId() {
  const s = appState.session;
  return s && s.mode === 'cloud' ? s.userId : null;
}

/**
 * Registra los pasos completados. Devuelve qué lecciones y labs se acaban de completar.
 */
export function recordSteps(steps) {
  const record = getProgressRecord();
  const before = computeProgress(record.steps);
  const nowIso = new Date().toISOString();
  let changed = false;
  steps.forEach(s => {
    if (!record.steps[s]) { record.steps[s] = nowIso; changed = true; }
  });
  if (!changed) return { changed: false, newLessons: [], newLabs: [], progress: before };

  const after = computeProgress(record.steps);
  if (after.complete && !record.completedAt) record.completedAt = nowIso;
  saveState(appState);
  pushProgressToCloud();
  return {
    changed: true,
    newLessons: after.lessonsDone.filter(id => !before.lessonsDone.includes(id)),
    newLabs: after.labsDone.filter(id => !before.labsDone.includes(id)),
    progress: after
  };
}

let pushTimer = null;
export function pushProgressToCloud() {
  const userId = cloudUserId();
  if (!userId) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    cloud.recordSteps(Object.keys(getProgressRecord().steps))
      .catch(err => console.warn('No se pudo sincronizar el progreso:', err.message || err));
  }, 600);
}

// Al iniciar sesión en modo nube: une el progreso remoto con el local (no se pierde nada de ninguno).
export async function pullProgressFromCloud() {
  const userId = cloudUserId();
  if (!userId) return;
  const remote = await cloud.fetchOwnProgress(userId).catch(() => null);
  const record = getProgressRecord();
  const remoteSteps = (remote && remote.steps) || {};
  const merged = mergeSteps(record.steps, remoteSteps);
  record.steps = merged;
  if (remote && remote.completed_at && (!record.completedAt || remote.completed_at < record.completedAt)) {
    record.completedAt = remote.completed_at;
  }
  saveState(appState);
  const remoteIsBehind = Object.keys(merged).some(k => remoteSteps[k] !== merged[k]);
  if (remoteIsBehind) pushProgressToCloud();
}

export function currentProgress() {
  return computeProgress(getProgressRecord().steps);
}

export function currentSteps() {
  return getProgressRecord().steps;
}
