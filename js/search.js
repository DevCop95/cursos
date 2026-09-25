/**
 * Búsqueda rápida (Ctrl/Cmd + K) sobre páginas, comandos, lecciones y recursos.
 */
import { esc, normalize } from './lib/html.js?v=dev101x-v66';
import { COURSE, NMAP_RESOURCES, PENTESTING_COMMANDS } from './content.js?v=dev101x-v66';

const MAX_RESULTS = 12;

export function buildIndex({ admin = false } = {}) {
  const items = [
    { kind: 'Página', title: 'Mis Cursos', subtitle: 'Progreso y cursos matriculados', href: '#/mis-cursos' },
    { kind: 'Página', title: 'Aula interactiva', subtitle: COURSE.title, href: `#/aula-interactiva/${COURSE.id}` },
    { kind: 'Página', title: 'Catálogo de cursos', subtitle: 'Programa especializado', href: '#/explorar-cursos' },
    { kind: 'Página', title: 'Mi perfil', subtitle: 'Laboratorios, habilidades y cuenta', href: '#/perfil' }
  ];
  if (admin) items.push({ kind: 'Página', title: 'Panel de administración', subtitle: 'Control de accesos', href: '#/panel-admin' });

  Object.entries(PENTESTING_COMMANDS).forEach(([key, c]) => {
    items.push({ kind: 'Comando', title: c.name, subtitle: c.title, extra: c.cmd, command: key });
  });
  COURSE.syllabus.forEach(m => m.lessons.forEach(l => {
    items.push({ kind: 'Lección', title: l.title, subtitle: m.module, href: `#/aula-interactiva/${COURSE.id}` });
  }));
  NMAP_RESOURCES.forEach(cat => cat.items.forEach(r => {
    items.push({ kind: 'Recurso', title: r.title, subtitle: cat.categoryShort, url: r.url });
  }));
  return items.map(it => ({ ...it, haystack: normalize([it.title, it.subtitle, it.extra, it.kind].join(' ')) }));
}

export function search(index, query) {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  if (!terms.length) return index.filter(i => i.kind === 'Página');
  return index
    .map(item => {
      if (!terms.every(t => item.haystack.includes(t))) return null;
      const title = normalize(item.title);
      const score = terms.reduce((s, t) => s + (title.startsWith(t) ? 3 : title.includes(t) ? 2 : 1), 0);
      return { item, score };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_RESULTS)
    .map(r => r.item);
}

// ---------------------------------------------------------------------------
// UI
// ---------------------------------------------------------------------------
let index = [];
let results = [];
let selected = 0;
let onCommand = () => {};

function resultsEl() { return document.getElementById('quick-search-results'); }

function renderResults() {
  const el = resultsEl();
  if (!el) return;
  if (!results.length) {
    el.innerHTML = '<p class="p-3 text-xs text-muted">Sin resultados.</p>';
    return;
  }
  el.innerHTML = results.map((r, i) => `
    <li role="option" id="qs-opt-${i}" aria-selected="${i === selected}" data-idx="${i}" class="qs-item p-2 rounded-lg cursor-pointer flex items-center justify-between gap-3 ${i === selected ? 'bg-bg' : 'hover:bg-bg/60'}">
      <span class="min-w-0">
        <span class="block text-xs font-semibold text-ink truncate">${esc(r.title)}</span>
        <span class="block text-[11px] text-muted truncate">${esc(r.subtitle || '')}</span>
      </span>
      <span class="text-[10px] font-mono text-muted shrink-0">${esc(r.kind)}</span>
    </li>`).join('');
  const input = document.getElementById('quick-search-input');
  if (input) input.setAttribute('aria-activedescendant', `qs-opt-${selected}`);
  const active = el.querySelector(`[data-idx="${selected}"]`);
  if (active) active.scrollIntoView({ block: 'nearest' });
}

function update(query) {
  results = search(index, query);
  selected = 0;
  renderResults();
}

export function openSearch({ admin = false } = {}) {
  index = buildIndex({ admin });
  const modal = document.getElementById('quick-search-modal');
  const input = document.getElementById('quick-search-input');
  if (!modal || !input) return;
  modal.classList.remove('hidden');
  input.value = '';
  update('');
  input.focus();
}

export function closeSearch() {
  const modal = document.getElementById('quick-search-modal');
  if (modal) modal.classList.add('hidden');
}

function choose(i) {
  const r = results[i];
  if (!r) return;
  closeSearch();
  if (r.href) window.location.hash = r.href;
  else if (r.url) window.open(r.url, '_blank', 'noopener,noreferrer');
  else if (r.command) onCommand(r.command);
}

export function initSearch({ onSelectCommand, isAdmin }) {
  onCommand = onSelectCommand;
  const input = document.getElementById('quick-search-input');
  const list = resultsEl();
  if (!input || !list) return;

  input.addEventListener('input', () => update(input.value));
  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); selected = Math.min(selected + 1, results.length - 1); renderResults(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); selected = Math.max(selected - 1, 0); renderResults(); }
    else if (e.key === 'Enter') { e.preventDefault(); choose(selected); }
  });
  list.addEventListener('click', e => {
    const li = e.target.closest('.qs-item');
    if (li) choose(Number(li.dataset.idx));
  });
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      if (!document.getElementById('main-header') || document.getElementById('main-header').classList.contains('hidden')) return;
      e.preventDefault();
      openSearch({ admin: isAdmin() });
    } else if (e.key === 'Escape') {
      closeSearch();
    }
  });
}
