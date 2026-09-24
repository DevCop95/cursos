/**
 * Utilidades de interfaz compartidas: toasts, modales y avatar.
 */
import { safeUrl } from './lib/html.js?v=dev101x-v38';

export function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  const tone = type === 'success' ? 'bg-accent text-white' : type === 'error' ? 'bg-rose-700 text-white' : 'bg-ink text-white';
  toast.className = `fixed bottom-20 md:bottom-6 right-4 md:right-6 z-[60] max-w-[calc(100vw-2rem)] px-3.5 py-2 rounded-lg shadow-lg text-xs flex items-center gap-2 modal-enter ${tone}`;
  toast.setAttribute('role', type === 'error' ? 'alert' : 'status');

  const icon = document.createElement('span');
  icon.className = 'material-symbols-outlined text-sm';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = type === 'success' ? 'check_circle' : type === 'error' ? 'warning' : 'info';
  const text = document.createElement('span');
  text.textContent = message;

  toast.append(icon, text);
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.transition = 'opacity 0.2s ease';
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 200);
  }, 2800);
}

export function openModal(id) {
  const m = document.getElementById(id);
  if (!m) return;
  m.classList.remove('hidden');
  const focusable = m.querySelector('input, button, a[href]');
  if (focusable) focusable.focus();
}

export function closeModal(id) {
  const m = document.getElementById(id);
  if (!m || m.classList.contains('hidden')) return;
  m.classList.add('hidden');
  if (id === 'app-dialog') {
    // Vaciar detiene videos y libera el contenido; el foco vuelve a donde estaba.
    document.getElementById('app-dialog-body').replaceChildren();
    if (lastFocus && document.body.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
    lastFocus = null;
  }
}

// Ventana emergente genérica. size: 'md' (lecciones, detalles) o 'lg' (video, recursos).
const DIALOG_SIZES = { md: 'sm:max-w-lg', lg: 'sm:max-w-3xl' };
let lastFocus = null;

export function openDialog({ title, kicker = '', body, size = 'md' }) {
  const panel = document.getElementById('app-dialog-panel');
  if (!panel) return;
  if (document.getElementById('app-dialog').classList.contains('hidden')) lastFocus = document.activeElement;
  Object.values(DIALOG_SIZES).forEach(c => panel.classList.remove(c));
  panel.classList.add(DIALOG_SIZES[size] || DIALOG_SIZES.md);
  document.getElementById('app-dialog-title').textContent = title;
  const k = document.getElementById('app-dialog-kicker');
  k.textContent = kicker;
  k.classList.toggle('hidden', !kicker);
  const bodyEl = document.getElementById('app-dialog-body');
  bodyEl.innerHTML = body;
  bodyEl.scrollTop = 0;
  openModal('app-dialog');
}

export function avatarFor(user) {
  const url = user && safeUrl(user.avatar);
  if (url && url.startsWith('https://')) return url;
  const seed = (user && (user.name || user.email)) || 'Dev101x';
  return window.Identicon ? window.Identicon.dataUri(seed) : 'assets/dev101x_identicon.svg';
}
