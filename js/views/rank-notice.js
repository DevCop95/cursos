/**
 * Aviso de subida de rango. Compara el rango que calcula el servidor con el más alto que este alumno ya vio
 * (guardado por usuario en este navegador). La primera vez solo se anota; si luego sube, se muestra una ventana.
 * Se guarda el nivel más alto visto: reiniciar un curso y volver a subir no repite el aviso.
 */
import { appState, isSessionValid } from '../state.js?v=dev101x-v77';
import { isCloudEnabled } from '../config.js?v=dev101x-v77';
import { fetchUserStats } from '../cloud.js?v=dev101x-v77';
import { rankView, rankUpFrom } from '../lib/ranks.js?v=dev101x-v77';
import { openDialog } from '../ui.js?v=dev101x-v77';
import { esc } from '../lib/html.js?v=dev101x-v77';

const seenKey = userId => `dev101x_seen_rank:${userId}`;
let timer = null;
let running = false;

function readSeen(userId) {
  try {
    const raw = localStorage.getItem(seenKey(userId));
    return raw === null ? null : Number(raw);
  } catch (e) {
    return null;
  }
}

function writeSeen(userId, level) {
  try { localStorage.setItem(seenKey(userId), String(level)); } catch (e) { /* sin almacenamiento: no pasa nada */ }
}

// Comprueba dentro de `delay` ms (agrupa varias llamadas seguidas, p. ej. varias lecciones completadas).
export function scheduleRankCheck(delay = 4000) {
  clearTimeout(timer);
  timer = setTimeout(checkRankUp, delay);
}

export async function checkRankUp() {
  const s = appState.session;
  if (running || !isCloudEnabled() || !isSessionValid() || !s || !s.userId) return;
  running = true;
  try {
    const stats = await fetchUserStats();
    if (!stats || !Number.isFinite(Number(stats.rank_level))) return;
    const level = Number(stats.rank_level);
    const prev = readSeen(s.userId);
    const up = rankUpFrom(prev, stats);
    if (up) {
      // Si hay otra ventana abierta (una lección, un video…), se espera a que se cierre para no taparla.
      const dialog = document.getElementById('app-dialog');
      if (dialog && !dialog.classList.contains('hidden')) {
        scheduleRankCheck(5000);
        return;
      }
      showRankUp(stats);
    }
    writeSeen(s.userId, Number.isFinite(prev) ? Math.max(prev, level) : level);
  } catch (e) {
    // Sin conexión o sin sesión en el servidor: se vuelve a intentar en la próxima comprobación.
  } finally {
    running = false;
  }
}

function showRankUp(stats) {
  const v = rankView(stats);
  if (!v) return;
  openDialog({
    kicker: 'NUEVO RANGO',
    title: '¡Subiste de rango!',
    body: `
      <div class="flex flex-col items-center text-center gap-4 py-2">
        <span class="p-2 rounded-2xl bg-term">
          <span class="w-16 h-16 rounded-xl border flex items-center justify-center ${v.tone}">
            <span class="material-symbols-outlined text-4xl" aria-hidden="true">${esc(v.icon)}</span>
          </span>
        </span>
        <div class="flex flex-col gap-1">
          <p class="text-lg font-extrabold text-ink">Ahora eres ${esc(v.name)}</p>
          <p class="text-sm text-ink2">Llevas <strong>${v.points}</strong> puntos.${v.next ? ` El siguiente rango, <strong>${esc(v.next)}</strong>, está a ${v.remaining} puntos.` : ''}</p>
        </div>
        <div class="flex flex-wrap justify-center gap-2 pt-1">
          <a href="#/perfil" data-action="close-modal" data-target="app-dialog" class="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl bg-accent hover:bg-accent2 text-white text-sm font-semibold transition-colors">
            <span class="material-symbols-outlined text-[18px]" aria-hidden="true">workspace_premium</span>Ver mi perfil
          </a>
          <button type="button" data-action="close-modal" data-target="app-dialog" class="h-10 px-4 rounded-xl bg-white border border-line hover:border-accent/60 text-sm font-semibold text-ink transition-colors">Seguir</button>
        </div>
      </div>`
  });
}
