/**
 * Mensajes entre el alumno y el administrador (guardados en Supabase, tabla messages).
 *  - Alumno: ventana "Mensajes" (menú de usuario y perfil) con su conversación y un cuadro para escribir.
 *  - Admin: la misma conversación para cualquier alumno (panel de administración), con respuesta.
 * Los mensajes de revocación de un curso se destacan en rojo. Todo el texto se escapa con esc().
 */
import { esc } from '../lib/html.js?v=dev101x-v52';
import { appState } from '../state.js?v=dev101x-v52';
import { openDialog, showToast } from '../ui.js?v=dev101x-v52';
import { fetchMessages, sendMessage, adminSendMessage, markMessagesRead } from '../cloud.js?v=dev101x-v52';

const MAX = 1000;

function formatDate(iso) {
  try { return new Date(iso).toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' }); } catch (e) { return ''; }
}

// Conversación en burbujas. mine(m) indica si el mensaje es de quien mira (alumno o admin).
function threadHtml(list, mine) {
  if (!list.length) return '<p class="text-xs text-muted text-center py-6">Todavía no hay mensajes.</p>';
  return list.map(m => {
    const own = mine(m);
    const revoke = m.kind === 'revoke';
    const tone = revoke
      ? 'bg-rose-50 border-rose-200 text-rose-950'
      : own ? 'bg-emerald-50 border-emerald-200 text-emerald-950' : 'bg-white border-line text-ink';
    return `
      <div class="flex ${own ? 'justify-end' : 'justify-start'}">
        <div class="max-w-[85%] rounded-2xl border px-3.5 py-2.5 ${tone}">
          ${revoke ? '<p class="flex items-center gap-1 text-[10px] font-mono font-bold text-rose-700 mb-1"><span class="material-symbols-outlined text-[14px]" aria-hidden="true">block</span>ACCESO RETIRADO</p>' : ''}
          <p class="text-[13px] leading-relaxed whitespace-pre-wrap break-words">${esc(m.body)}</p>
          <p class="text-[10px] font-mono text-muted mt-1 text-right">${m.from_admin ? 'Administrador' : 'Alumno'} · ${esc(formatDate(m.created_at))}</p>
        </div>
      </div>`;
  }).join('');
}

function composerHtml(action, userId = '') {
  return `
    <form data-action="${action}" data-user="${esc(userId)}" class="flex flex-col gap-2 pt-3 border-t border-line">
      <textarea name="body" required maxlength="${MAX}" rows="3" placeholder="Escribe tu mensaje…" data-counter class="w-full p-3 rounded-xl border border-line bg-white text-[13px] outline-none focus:border-accent resize-y"></textarea>
      <div class="flex items-center justify-between gap-3">
        <span class="text-[11px] font-mono text-muted" data-count>0/${MAX}</span>
        <button type="submit" class="h-9 px-4 rounded-xl bg-accent hover:bg-accent2 text-white text-xs font-semibold inline-flex items-center gap-1.5">
          <span class="material-symbols-outlined text-[16px]" aria-hidden="true">send</span>Enviar
        </button>
      </div>
    </form>`;
}

function scrollThread() {
  const box = document.getElementById('msg-thread');
  if (box) box.scrollTop = box.scrollHeight;
}

// ---------------------------------------------------------------------------
// Alumno
// ---------------------------------------------------------------------------
export async function openMessages() {
  openDialog({
    title: 'Mensajes',
    kicker: 'CON EL ADMINISTRADOR',
    body: `
      <div class="flex flex-col gap-3">
        <p class="text-xs text-ink2">Escribe tus sugerencias o dudas. El administrador te responderá aquí.</p>
        <div id="msg-thread" class="flex flex-col gap-2 max-h-[45vh] overflow-y-auto pr-1"><p class="text-xs text-muted text-center py-6">Cargando…</p></div>
        ${composerHtml('send-message')}
      </div>`
  });
  try {
    const list = await fetchMessages();
    const box = document.getElementById('msg-thread');
    if (box) { box.innerHTML = threadHtml(list, m => !m.from_admin); scrollThread(); }
    if (list.some(m => m.from_admin && !m.read_at)) await markMessagesRead().catch(() => {});
    setUnreadIndicator(0);
  } catch (e) {
    const box = document.getElementById('msg-thread');
    if (box) box.innerHTML = '<p class="text-xs text-rose-700 text-center py-6">No se pudieron cargar los mensajes.</p>';
  }
}

async function submitWith(form, send, reopen) {
  const area = form.querySelector('textarea[name="body"]');
  const button = form.querySelector('button[type="submit"]');
  const body = area ? area.value.trim() : '';
  if (!body || (button && button.disabled)) return;
  if (button) button.disabled = true;
  try {
    await send(body);
    area.value = '';
    await reopen();
  } catch (err) {
    console.error(err);
    const msg = String((err && err.message) || '');
    showToast(/muchos mensajes|largo|vacío/.test(msg) ? msg : 'No se pudo enviar el mensaje.', 'error');
  } finally {
    if (button && document.body.contains(button)) button.disabled = false;
  }
}

async function refreshStudentThread() {
  const list = await fetchMessages();
  const box = document.getElementById('msg-thread');
  if (box) { box.innerHTML = threadHtml(list, m => !m.from_admin); scrollThread(); }
}

export function submitMessage(form) {
  return submitWith(form, sendMessage, refreshStudentThread);
}

// Punto en el avatar y contador en el menú cuando hay mensajes del admin sin leer (solo alumnos).
function setUnreadIndicator(n) {
  const dot = document.getElementById('msg-dot');
  if (dot) dot.classList.toggle('hidden', !n);
  const badge = document.getElementById('msg-badge');
  if (badge) { badge.textContent = String(n); badge.classList.toggle('hidden', !n); }
}

export async function refreshUnreadMessages({ notify = false } = {}) {
  const s = appState.session;
  if (!s || s.mode !== 'cloud' || s.role === 'admin') return setUnreadIndicator(0);
  const list = await fetchMessages().catch(() => []);
  const unread = list.filter(m => m.from_admin && !m.read_at);
  setUnreadIndicator(unread.length);
  if (notify && unread.length) {
    showToast(unread.some(m => m.kind === 'revoke')
      ? 'Tienes un mensaje del administrador sobre tu acceso a un curso'
      : `Tienes ${unread.length === 1 ? 'un mensaje nuevo' : `${unread.length} mensajes nuevos`} del administrador`, 'info');
  }
}

// ---------------------------------------------------------------------------
// Administrador
// ---------------------------------------------------------------------------
export async function openAdminThread(userId, name) {
  openDialog({
    title: name || 'Alumno',
    kicker: 'MENSAJES',
    body: `
      <div class="flex flex-col gap-3">
        <div id="msg-thread" class="flex flex-col gap-2 max-h-[45vh] overflow-y-auto pr-1"><p class="text-xs text-muted text-center py-6">Cargando…</p></div>
        ${composerHtml('admin-reply', userId)}
      </div>`
  });
  await refreshAdminThread(userId);
  await markMessagesRead(userId).catch(() => {});
}

async function refreshAdminThread(userId) {
  const list = (await fetchMessages().catch(() => [])).filter(m => m.user_id === userId);
  const box = document.getElementById('msg-thread');
  if (box) { box.innerHTML = threadHtml(list, m => m.from_admin); scrollThread(); }
}

export function submitAdminReply(form) {
  const userId = form.dataset.user;
  return submitWith(form, body => adminSendMessage(userId, body), () => refreshAdminThread(userId));
}

// Contador de caracteres de los cuadros de mensaje.
export function updateCounter(area) {
  const count = area.closest('form') && area.closest('form').querySelector('[data-count]');
  if (count) count.textContent = `${area.value.length}/${MAX}`;
}
