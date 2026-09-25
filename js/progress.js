/**
 * Registro del progreso del alumno: guarda en localStorage y, en modo nube, sincroniza con Supabase.
 */
import { appState, saveState, getProgressRecord } from './state.js?v=dev101x-v51';
import { computeProgress, mergeSteps, isCommandStep, applyProgressReset } from './lab.js?v=dev101x-v51';
import * as cloud from './cloud.js?v=dev101x-v51';
import { computeStreak } from './lib/activity.js?v=dev101x-v51';

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

function diff(before, after) {
  return {
    newLessons: after.lessonsDone.filter(id => !before.lessonsDone.includes(id)),
    newLabs: after.labsDone.filter(id => !before.labsDone.includes(id)),
    progress: after
  };
}

/**
 * Registra los pasos completados en la consola. Devuelve qué lecciones y labs se acaban de completar.
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
  return { changed: true, ...diff(before, after) };
}

/**
 * Aplica los pasos que devuelve el servidor (p. ej. tras acertar una pregunta).
 */
export function applyServerSteps(serverSteps) {
  const record = getProgressRecord();
  const before = computeProgress(record.steps);
  record.steps = mergeSteps(record.steps, serverSteps || {});
  const after = computeProgress(record.steps);
  if (after.complete && !record.completedAt) record.completedAt = new Date().toISOString();
  saveState(appState);
  return diff(before, after);
}

let pushTimer = null;
export function pushProgressToCloud() {
  const userId = cloudUserId();
  if (!userId) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(async () => {
    try {
      // Si el admin reinició el progreso con esta pestaña abierta, no se vuelven a subir los pasos viejos.
      const remote = await cloud.fetchOwnProgress(userId);
      applyReset(remote);
      // Solo comandos: las preguntas y el reto final los valida el servidor por separado.
      await cloud.recordSteps(Object.keys(getProgressRecord().steps).filter(isCommandStep));
    } catch (err) {
      console.warn('No se pudo sincronizar el progreso:', err.message || err);
    }
  }, 600);
}

// Aplica un reinicio del admin (student_progress.reset_at) al registro local. Devuelve true si lo aplicó.
function applyReset(remote) {
  const record = getProgressRecord();
  const next = applyProgressReset(record, remote && remote.reset_at);
  if (!next) return false;
  Object.assign(record, next);
  saveState(appState);
  return true;
}

// Al iniciar sesión en modo nube: une el progreso remoto con el local (no se pierde nada de ninguno).
export async function pullProgressFromCloud() {
  const userId = cloudUserId();
  if (!userId) return;
  const remote = await cloud.fetchOwnProgress(userId).catch(() => null);
  applyReset(remote);
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

// Racha de días con actividad (la fecha de cada día la pone el servidor). Sin nube: sin racha.
export async function fetchStreak() {
  if (!cloudUserId()) return computeStreak([]);
  const days = await cloud.fetchOwnActivityDays().catch(() => []);
  return computeStreak(days);
}
