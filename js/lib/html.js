/**
 * Utilidades de escape. Todo dato dinámico que se interpole en una plantilla HTML
 * (nombres, correos, datos de la base de datos, entrada de la terminal) debe pasar por esc().
 */
const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' };

export function esc(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[&<>"'`]/g, ch => HTML_ESCAPES[ch]);
}

// Solo permite URLs http(s) o rutas relativas/data de imagen; cualquier otra cosa (javascript:, etc.) se descarta.
export function safeUrl(value, fallback = '') {
  const url = String(value || '').trim();
  if (/^https:\/\//i.test(url) || /^data:image\/(svg\+xml|png|jpeg|webp);/i.test(url) || /^(\.\/|assets\/|#\/)/.test(url)) {
    return url;
  }
  return fallback;
}

// Celda CSV segura: escapa comillas y neutraliza fórmulas (=, +, -, @) al abrirse en Excel/Sheets.
export function csvCell(value) {
  let s = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return '"' + s.replace(/"/g, '""') + '"';
}

export function toCsv(header, rows) {
  return [header, ...rows].map(r => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

// Normaliza texto para búsquedas: minúsculas y sin tildes.
export function normalize(value) {
  return String(value || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}
