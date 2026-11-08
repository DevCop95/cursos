/**
 * Comunidad: ranking de miembros premium que han elegido aparecer (opt-in), con su foto, nombre, rango y puntos.
 *
 * Privacidad: el servidor decide qué sale (funciones community_wall / my_wall / set_wall_visibility). Aquí solo
 * se pinta: no llega ningún correo ni identificador, y si el nombre parecía un correo el servidor ya manda el alias
 * «Anonimo…» (sin foto). Se pide la lista UNA vez al abrir y se reutiliza 5 minutos: nada de consultas repetidas.
 * Todo el texto se escapa con esc().
 */
import { esc, safeUrl } from '../lib/html.js?v=dev101x-v118';
import { appState } from '../state.js?v=dev101x-v118';
import { showToast } from '../ui.js?v=dev101x-v118';
import { fetchCommunityWall, fetchMyWall, setWallVisibility } from '../cloud.js?v=dev101x-v118';
import { RANKS } from '../lib/ranks.js?v=dev101x-v118';

const TTL = 5 * 60 * 1000;
let cache = null; // { at, uid, wall, mine }: por usuario, para no mezclar datos si se cambia de cuenta en el mismo navegador
const uidOf = u => (u && (u.userId || u.email)) || '';

const pts = n => (Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0).toLocaleString('es-CO');
const rankIcon = name => (RANKS.find(r => r.name === name) || RANKS[0]).icon;

function avatarHtml(m) {
  const url = !m.anon && typeof m.avatar === 'string' ? safeUrl(m.avatar) : '';
  if (url && url.startsWith('https://')) {
    return `<img src="${esc(url)}" alt="" referrerpolicy="no-referrer" loading="lazy" class="w-10 h-10 rounded-xl object-cover bg-bg border border-line shrink-0" />`;
  }
  return '<span class="w-10 h-10 rounded-xl bg-bg border border-line flex items-center justify-center text-muted shrink-0"><span class="material-symbols-outlined text-[22px]" aria-hidden="true">person</span></span>';
}

function rowHtml(m, i) {
  return `
    <li class="flex items-center gap-3 px-4 py-3 ${m.me ? 'bg-emerald-50/60' : ''}">
      <span class="w-6 text-center font-mono text-[12px] shrink-0 ${i < 3 ? 'font-bold text-accent' : 'text-muted'}">${i + 1}</span>
      ${avatarHtml(m)}
      <span class="min-w-0 flex-1 flex flex-col gap-1">
        <span class="flex items-center gap-2 min-w-0">
          <span class="text-[14px] font-semibold text-ink truncate">${esc(m.name)}</span>
          ${m.me ? '<span class="px-1.5 py-px rounded-md bg-emerald-50 border border-emerald-200 text-accent text-[10px] font-mono font-bold shrink-0">TÚ</span>' : ''}
        </span>
        <span class="inline-flex items-center gap-1 self-start text-[11px] font-mono font-bold text-ink2" title="Rango">
          <span class="material-symbols-outlined text-[15px] text-accent" aria-hidden="true">${esc(rankIcon(m.rank))}</span>${esc(m.rank)}
        </span>
      </span>
      <span class="font-mono text-[13px] font-bold text-ink shrink-0 whitespace-nowrap" title="Puntos">${esc(pts(m.points))}<span class="text-muted font-normal text-[11px]"> pts</span></span>
    </li>`;
}

function settingsHtml(mine) {
  if (!mine) return '';
  if (!mine.premium) {
    return `<section class="bg-surface rounded-2xl border border-line p-4 sm:p-5">
      <p class="text-[13px] text-ink2 leading-relaxed">Este muro es para miembros premium. Cuando tengas acceso a un curso de pago podrás elegir aparecer aquí.</p>
    </section>`;
  }
  const how = mine.anon
    ? `Tu nombre se parece a un correo, así que aparecerías como <strong class="text-ink">${esc(mine.shown_as)}</strong>, sin foto. Puedes poner un nombre normal en tu perfil.`
    : `Aparecerías como <strong class="text-ink">${esc(mine.shown_as)}</strong>, con tu foto de Google, tu rango y tus puntos.`;
  return `<section class="bg-surface rounded-2xl border border-line p-4 sm:p-5 flex flex-col gap-3">
      <div class="flex items-start justify-between gap-4">
        <div class="flex flex-col gap-1 min-w-0">
          <h2 class="text-sm font-bold text-ink">Aparecer en el muro</h2>
          <p class="text-[13px] text-ink2 leading-relaxed">${how} Nunca se muestra tu correo. Está desactivado hasta que tú lo actives y puedes quitarlo cuando quieras.</p>
        </div>
        <label class="relative inline-flex items-center cursor-pointer shrink-0 mt-0.5" title="Aparecer en el muro">
          <input type="checkbox" id="wall-toggle" class="sr-only peer" ${mine.visible ? 'checked' : ''} aria-label="Aparecer en el muro de la comunidad" />
          <span class="w-11 h-6 rounded-full bg-line peer-checked:bg-accent transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-accent/50"></span>
          <span class="absolute left-0.5 top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5"></span>
        </label>
      </div>
    </section>`;
}

function listHtml(wall) {
  if (!wall.length) {
    return `<div class="px-5 py-10 text-center text-[13px] text-muted">Todavía nadie ha activado su aparición. Cuando alguien lo haga, saldrá aquí con su rango y sus puntos.</div>`;
  }
  return `<ol class="divide-y divide-line/70">${wall.map(rowHtml).join('')}</ol>`;
}

function paint(container, data) {
  container.innerHTML = `
    <div class="flex flex-col w-full py-4 sm:py-6 gap-5 max-w-3xl mx-auto">
      <section>
        <p class="text-[11px] font-mono text-muted">COMUNIDAD</p>
        <h1 class="text-xl sm:text-2xl font-extrabold text-ink tracking-tight">Ranking de la comunidad</h1>
        <p class="text-[13px] text-ink2 mt-1 max-w-xl leading-relaxed">Miembros premium que han elegido aparecer, ordenados por puntos. Solo se muestran el nombre, la foto, el rango y los puntos.</p>
      </section>
      <div id="wall-settings">${settingsHtml(data.mine)}</div>
      <section class="bg-surface rounded-2xl border border-line overflow-hidden" aria-label="Miembros">
        <div id="wall-list">${listHtml(data.wall)}</div>
      </section>
    </div>`;

  const toggle = container.querySelector('#wall-toggle');
  if (toggle) {
    toggle.addEventListener('change', async () => {
      const want = toggle.checked;
      toggle.disabled = true;
      try {
        await setWallVisibility(want);
        cache = null; // la lista cambió: la próxima lectura es nueva
        const [wall, mine] = await Promise.all([fetchCommunityWall(), fetchMyWall()]);
        cache = { at: Date.now(), uid: uidOf(appState.session), wall, mine };
        if (container.isConnected) paint(container, cache);
        showToast(want ? 'Ya apareces en el muro' : 'Ya no apareces en el muro', 'success');
      } catch (e) {
        toggle.checked = !want;
        toggle.disabled = false;
        showToast('No se pudo guardar el cambio. Inténtalo de nuevo.', 'error');
      }
    });
  }
}

export async function renderComunidad(container) {
  const user = appState.session;
  if (!user || user.mode !== 'cloud') {
    container.innerHTML = '<div class="max-w-3xl mx-auto py-10 text-center text-sm text-muted">La comunidad necesita iniciar sesión con tu cuenta de Google.</div>';
    return;
  }
  if (cache && cache.uid === uidOf(user) && Date.now() - cache.at < TTL) { paint(container, cache); return; }
  container.innerHTML = '<div class="max-w-3xl mx-auto py-10 text-center text-sm text-muted">Cargando la comunidad…</div>';
  try {
    const [wall, mine] = await Promise.all([fetchCommunityWall(), fetchMyWall()]);
    cache = { at: Date.now(), uid: uidOf(user), wall, mine };
    if (container.isConnected) paint(container, cache);
  } catch (e) {
    if (container.isConnected) container.innerHTML = '<div class="max-w-3xl mx-auto py-10 text-center text-sm text-muted">No se pudo cargar la comunidad. Revisa tu conexión e inténtalo de nuevo.</div>';
  }
}
