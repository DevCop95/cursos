import { iconSvg } from './icono.js?v=dev101x-v114';
import { SCENES } from './escenas/index.js?v=dev101x-v114';

const $ = id => document.getElementById(id);
const el = {
  hub: $('hub'), lista: $('lista'), video: $('video'),
  ruta: $('v-ruta'), codigo: $('v-codigo'), titulo: $('v-titulo'), resumen: $('v-resumen'),
  mp4: $('v-mp4'), fin: $('v-fin'), pasos: $('v-pasos')
};

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fmt = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const poster = s => s.video.replace(/\.mp4$/, '.jpg');

let durations = {};

function renderHub() {
  el.lista.innerHTML = SCENES.map(s => `
    <li>
      <a href="#${s.id}" class="group h-full flex flex-col rounded-2xl border border-line bg-surface hover:border-accent/60 overflow-hidden transition-colors">
        <span class="relative block bg-term" style="aspect-ratio:16/9">
          <img src="${esc(poster(s))}" alt="" width="1280" height="720" loading="lazy" decoding="async" class="w-full h-full object-cover" />
          <span class="absolute inset-0 flex items-center justify-center"><span class="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-accent text-white shadow-md group-hover:bg-accent2 transition-colors">${iconSvg('play', 'w-6 h-6')}</span></span>
        </span>
        <span class="flex flex-col gap-1.5 p-4">
          <span class="flex items-center justify-between"><span class="font-mono text-[11px] font-bold text-accent">${esc(s.code)}</span>${durations[s.id] ? `<span class="font-mono text-[11px] text-muted">${fmt(durations[s.id])}</span>` : ''}</span>
          <span class="text-[15px] font-bold leading-snug">${esc(s.title)}</span>
          <span class="text-[13px] text-ink2 leading-relaxed">${esc(s.blurb)}</span>
        </span>
      </a>
    </li>`).join('');
}

function showHub() {
  el.mp4.pause();
  el.video.hidden = true;
  el.hub.hidden = false;
  document.title = 'OWASP Top 10 en video | Dev101x';
}

function showVideo(s) {
  el.hub.hidden = true;
  el.video.hidden = false;
  document.title = `${s.code} ${s.title} | OWASP Top 10 en video | Dev101x`;
  el.ruta.textContent = `${s.code} ${s.title}`;
  el.codigo.textContent = `OWASP Top 10 2021 · ${s.code}`;
  el.titulo.textContent = s.title;
  el.resumen.textContent = s.blurb;
  el.mp4.poster = poster(s);
  el.mp4.src = s.video;
  const next = SCENES[SCENES.indexOf(s) + 1];
  el.fin.innerHTML = `${next ? `<a href="#${next.id}" class="h-10 px-4 rounded-xl bg-accent hover:bg-accent2 text-white text-sm font-semibold inline-flex items-center transition-colors">Siguiente: ${esc(next.code)} ${esc(next.title)}</a>` : ''}
    <a href="#" class="h-10 px-3 inline-flex items-center text-sm font-semibold text-muted hover:text-accent transition-colors">Todos los videos</a>`;
  el.pasos.innerHTML = s.steps.map(p => `
    <li><span class="font-bold text-ink">${esc(p.title)}.</span> ${esc(p.text)}${p.points ? `<ul class="mt-1 flex flex-col gap-1">${p.points.map(t => `<li class="flex gap-2"><span class="mt-[9px] h-1.5 w-1.5 shrink-0 bg-accent" aria-hidden="true"></span><span>${esc(t)}</span></li>`).join('')}</ul>` : ''}</li>`).join('');
  window.scrollTo(0, 0);
  el.titulo.focus({ preventScroll: true });
  if (!reduced()) el.mp4.play().catch(() => {});
}

function route() {
  const id = decodeURIComponent(location.hash.replace(/^#\/?/, ''));
  const s = SCENES.find(x => x.id === id);
  if (s) showVideo(s); else showHub();
}

window.addEventListener('hashchange', route);

// Las duraciones las escribe videos-src/make.mjs al publicar cada video; si no llegan, las tarjetas salen sin tiempo.
fetch('videos/index.json').then(r => (r.ok ? r.json() : {})).catch(() => ({})).then(d => {
  durations = d;
  renderHub();
  route();
});
