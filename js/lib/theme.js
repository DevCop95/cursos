/**
 * Modo oscuro de toda la app (clase theme-dark en <html>, estilos en css/app.css).
 * Se guarda en este navegador; js/theme-boot.js lo aplica al cargar antes de pintar.
 * Se cambia con el botón luna/sol de la cabecera o, en Halloween, con la calabaza de la portada.
 */
const KEY = 'dev101x_theme';

export function isDark() {
  return document.documentElement.classList.contains('theme-dark');
}

// Pone el estado de todos los botones que lo cambian (cabecera y calabaza).
export function syncThemeButtons() {
  const dark = isDark();
  document.querySelectorAll('[data-theme-toggle]').forEach(btn => {
    btn.setAttribute('aria-pressed', String(dark));
    btn.title = dark ? (btn.dataset.titleOn || 'Pasar a modo claro') : (btn.dataset.titleOff || 'Pasar a modo oscuro');
    const icon = btn.querySelector('[data-theme-icon]');
    if (icon) icon.textContent = dark ? 'light_mode' : 'dark_mode';
  });
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', dark ? '#0b0d10' : '#005c38');
}

export function setDark(on) {
  document.documentElement.classList.toggle('theme-dark', on);
  try {
    if (on) localStorage.setItem(KEY, 'dark'); else localStorage.removeItem(KEY);
  } catch (e) { /* sin almacenamiento: dura hasta recargar */ }
  syncThemeButtons();
}

export const toggleDark = () => setDark(!isDark());
