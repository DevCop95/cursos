/**
 * Estado de la aplicación persistido en localStorage.
 * No se guarda ningún token: solo el perfil visible, el rol en caché y la fecha de caducidad.
 * El rol en caché solo decide qué UI se muestra; los datos protegidos los filtra RLS en Supabase.
 */
import { CONFIG } from './config.js?v=dev101x-v64';
import { MAX_TERMINAL_LINES } from './lab.js?v=dev101x-v64';
import { LAB_TARGET } from './content.js?v=dev101x-v64';

const STATE_KEY = 'dev101x_state';
const LEGACY_LAB_STEPS = { 'lab-1': ['nmap-basic', 'nmap-sv'], 'lab-2': ['ipconfig', 'ping'], 'lab-3': ['whoami', 'netstat'] };

export function initialTerminal() {
  return [
    { text: 'Windows PowerShell [Entorno Ofensivo Dev101x - Host Windows 11]', type: 'system' },
    { text: '(c) Microsoft Corporation. Terminal Activa en C:\\Users\\Student\\Labs', type: 'slate' },
    { text: `[INFO] Red de laboratorio conectada: 10.128.44.0/24. Target objetivo: ${LAB_TARGET}`, type: 'info' },
    { text: `Escribe 'help', 'progreso' o 'nmap -sV ${LAB_TARGET}' para comenzar el reconocimiento.`, type: 'cmd' }
  ];
}

function defaults() {
  return {
    version: 2,
    session: null,
    enabledCourses: [CONFIG.defaultCourseId],
    progress: {},
    terminalLines: initialTerminal(),
    activeCommandKey: 'nmap',
    activeNmapCategory: 0
  };
}

function migrate(parsed) {
  const state = defaults();
  // v1 → v2: se descarta la sesión (guardaba el JWT y no era verificable) y se conserva el progreso.
  if (parsed.studentProgress && typeof parsed.studentProgress === 'object') {
    Object.entries(parsed.studentProgress).forEach(([email, p]) => {
      const steps = {};
      (p.completedLabs || []).forEach(lab => (LEGACY_LAB_STEPS[lab] || []).forEach(s => { steps[s] = p.completedAt || new Date().toISOString(); }));
      state.progress[email] = { steps };
    });
  }
  return state;
}

export function loadState() {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (!raw) return defaults();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return defaults();
    if (parsed.version !== 2) {
      const migrated = migrate(parsed);
      saveState(migrated);
      return migrated;
    }
    const state = Object.assign(defaults(), parsed);
    if (!Array.isArray(state.terminalLines)) state.terminalLines = initialTerminal();
    state.terminalLines = state.terminalLines
      .filter(l => l && typeof l.text === 'string')
      .slice(-MAX_TERMINAL_LINES);
    return state;
  } catch (e) {
    return defaults();
  }
}

export function saveState(state) {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
  } catch (e) { /* almacenamiento lleno o bloqueado: la app sigue en memoria */ }
}

export function clearSession(state) {
  const fresh = defaults();
  // El progreso local se conserva entre sesiones (va indexado por correo).
  fresh.progress = state.progress || {};
  return fresh;
}

export const appState = loadState();

export function resetState(next) {
  Object.keys(appState).forEach(k => delete appState[k]);
  Object.assign(appState, next);
  saveState(appState);
}

export function isSessionValid(state = appState, now = Date.now()) {
  const s = state.session;
  return Boolean(s && s.email && s.expiresAt && s.expiresAt > now);
}

export function getProgressRecord(email = appState.session && appState.session.email) {
  const key = String(email || '').toLowerCase();
  if (!key) return { steps: {} };
  if (!appState.progress[key]) appState.progress[key] = { steps: {} };
  if (!appState.progress[key].steps) appState.progress[key].steps = {};
  return appState.progress[key];
}
