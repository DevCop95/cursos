/**
 * Historial de comandos de una terminal (flechas ↑ / ↓), como en una consola real.
 * Módulo puro: no toca el DOM.
 */
export function createHistory(max = 50) {
  const items = [];
  let pos = 0;   // índice que se está mostrando; items.length = línea nueva
  let draft = ''; // lo que había escrito antes de empezar a navegar

  return {
    push(cmd) {
      const c = String(cmd || '').trim();
      pos = items.length;
      draft = '';
      if (!c || items[items.length - 1] === c) { pos = items.length; return; }
      items.push(c);
      if (items.length > max) items.shift();
      pos = items.length;
    },
    // Devuelve el texto a mostrar, o null si no hay nada que cambiar.
    up(current = '') {
      if (!items.length || pos === 0) return null;
      if (pos === items.length) draft = current;
      pos -= 1;
      return items[pos];
    },
    down() {
      if (pos >= items.length) return null;
      pos += 1;
      return pos === items.length ? draft : items[pos];
    },
    get size() { return items.length; }
  };
}
