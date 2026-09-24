/**
 * Actividad de los usuarios para el panel de administración (módulo puro, con tests).
 * last_seen lo actualiza la app cada minuto mientras la pestaña está visible.
 */
export const ONLINE_WINDOW_MS = 5 * 60 * 1000;
export const ACTIVE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

function toMs(iso) {
  const ms = iso ? Date.parse(iso) : NaN;
  return Number.isNaN(ms) ? null : ms;
}

// Última señal de vida: la más reciente entre last_seen y last_login.
export function lastActivity(row) {
  const times = [toMs(row.last_seen), toMs(row.last_login)].filter(t => t !== null);
  return times.length ? Math.max(...times) : null;
}

// 'online' (≤ 5 min), 'active' (≤ 7 días), 'inactive' (más antiguo) o 'never'.
export function activityStatus(row, now = Date.now()) {
  const last = lastActivity(row);
  if (last === null) return 'never';
  const age = now - last;
  if (age <= ONLINE_WINDOW_MS) return 'online';
  if (age <= ACTIVE_WINDOW_MS) return 'active';
  return 'inactive';
}

export function relativeTime(ms, now = Date.now()) {
  if (ms === null || ms === undefined) return '—';
  const min = Math.max(0, Math.round((now - ms) / 60000));
  if (min < 1) return 'ahora';
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  return `hace ${d} ${d === 1 ? 'día' : 'días'}`;
}

// ---------------------------------------------------------------------------
// Racha de días con actividad. Los días llegan como 'YYYY-MM-DD' (fecha de Colombia, la pone el servidor).
// ---------------------------------------------------------------------------
export function todayInBogota(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(date);
}

function dayNumber(ymd) {
  const [y, m, d] = String(ymd).split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86400000);
}

// current: días seguidos hasta hoy (o hasta ayer, si hoy aún no hubo actividad). best: la racha más larga.
export function computeStreak(days = [], today = todayInBogota()) {
  const nums = [...new Set(days.filter(Boolean).map(dayNumber))].filter(n => !Number.isNaN(n)).sort((a, b) => b - a);
  const t = dayNumber(today);
  let current = 0;
  if (nums.length && (nums[0] === t || nums[0] === t - 1)) {
    current = 1;
    for (let i = 1; i < nums.length && nums[i] === nums[i - 1] - 1; i++) current++;
  }
  let best = nums.length ? 1 : 0;
  let run = 1;
  for (let i = 1; i < nums.length; i++) {
    run = nums[i] === nums[i - 1] - 1 ? run + 1 : 1;
    if (run > best) best = run;
  }
  return { current, best, activeToday: nums[0] === t };
}

// Filtro del panel: 'all', 'online' o 'active' (en línea + últimos 7 días). Ordena por actividad reciente.
export function filterByActivity(rows, filter, now = Date.now()) {
  const keep = row => {
    const status = activityStatus(row, now);
    if (filter === 'online') return status === 'online';
    if (filter === 'active') return status === 'online' || status === 'active';
    return true;
  };
  return rows.filter(keep).sort((a, b) => (lastActivity(b) ?? -1) - (lastActivity(a) ?? -1));
}
