/**
 * Laboratorio Linux real (prototipo): Alpine Linux emulado con v86 dentro del navegador.
 * La máquina arranca desde un estado ya iniciado (state.bin.zst) y lee los archivos del disco
 * bajo demanda (img-vN/flat). Todo se ejecuta en el equipo del alumno.
 * Sirve a la página del prototipo (index.html) y a la terminal del aula (embed.html, en un iframe):
 * el aula manda comandos con postMessage { type: 'dev101x-lab', run } y recibe { type, event: 'ready' } y,
 * tras cada comando, { type, event: 'state', state } con lo que informa lab-hook.sh desde dentro de Linux.
 */
(function () {
  'use strict';
  const IMG = 'img-v1/';
  const HOOK_URL = 'lab-hook.sh?v=dev101x-v46';
  const HOOK_PATH = '/tmp/.dev101x-lab.sh';
  const $ = id => document.getElementById(id);
  let emulator = null;
  let term = null;
  let fit = null;
  let ready = false;
  let queued = null;
  const embedded = window.parent !== window;

  function status(text) { $('lab-status').textContent = text; }

  function notifyParent(event, extra) {
    if (embedded) window.parent.postMessage({ type: 'dev101x-lab', event, ...extra }, location.origin);
  }

  // Estado que imprime lab-hook.sh tras cada comando: 1|codigo|comando(b64)|carpeta(b64)|repo|rama|commits|upstream|conflictos
  const b64 = v => { try { return new TextDecoder().decode(Uint8Array.from(atob(v || ''), c => c.charCodeAt(0))); } catch (e) { return ''; } };
  function parseState(data) {
    const f = String(data).split('|');
    if (f[0] !== '1' || f.length < 9) return null;
    return {
      rc: Number(f[1]), cmd: b64(f[2]).slice(0, 300), dir: b64(f[3]).slice(0, 120), repo: f[4] === '1',
      branch: f[5].slice(0, 120), commits: Number(f[6]) || 0, upstream: f[7].slice(0, 120), conflict: Number(f[8]) || 0
    };
  }

  // Copia lab-hook.sh dentro de la máquina (sistema de archivos 9p) y lo carga en la terminal.
  async function installHook() {
    try {
      const res = await fetch(HOOK_URL, { cache: 'no-cache' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const text = (await res.text()).replace(/\r/g, '');
      await emulator.create_file(HOOK_PATH, new TextEncoder().encode(text));
      emulator.serial0_send(' . ' + HOOK_PATH + '; clear; cat /etc/motd\n');
    } catch (e) {
      console.warn('No se pudo preparar el laboratorio:', e);
      emulator.serial0_send('clear; cat /etc/motd\n');
    }
  }

  function setProgress(pct) {
    $('lab-progress').classList.remove('hidden');
    $('lab-bar').style.width = Math.max(2, Math.min(100, pct)) + '%';
  }

  // Salida de la consola serie → xterm, agrupada por fotograma (escribir byte a byte es lento).
  let pending = [];
  let scheduled = false;
  function flush() {
    scheduled = false;
    if (!pending.length) return;
    term.write(Uint8Array.from(pending));
    pending = [];
  }

  function syncSize() {
    if (!fit || !ready) return;
    fit.fit();
    // La consola serie no conoce el tamaño de la ventana: se lo decimos a Linux.
    emulator.serial0_send('stty cols ' + term.cols + ' rows ' + term.rows + '\n');
  }

  function boot() {
    if (emulator) return;
    if (typeof window.V86 !== 'function' || typeof window.Terminal !== 'function') {
      status('No se pudo cargar el emulador. Recarga la página.');
      return;
    }
    $('lab-boot').disabled = true;
    $('lab-boot').classList.add('opacity-60');
    status('Descargando…');
    setProgress(2);

    emulator = new window.V86({
      wasm_path: 'v86/v86.wasm',
      memory_size: 128 * 1024 * 1024,
      vga_memory_size: 2 * 1024 * 1024,
      bios: { url: IMG + 'seabios.bin' },
      vga_bios: { url: IMG + 'vgabios.bin' },
      filesystem: { baseurl: IMG + 'flat/', basefs: IMG + 'fs.json' },
      initial_state: { url: IMG + 'state.bin.zst' },
      autostart: true,
      disable_keyboard: true,
      disable_mouse: true,
      disable_speaker: true,
    });

    emulator.add_listener('download-progress', e => {
      if (e.file_name && /state\.bin/.test(e.file_name) && e.lengthComputable) {
        const pct = (e.loaded / e.total) * 100;
        setProgress(pct);
        status('Descargando Linux… ' + Math.round(e.loaded / 1e6) + ' / ' + Math.round(e.total / 1e6) + ' MB');
      }
    });

    emulator.add_listener('emulator-ready', () => {
      $('lab-start').classList.add('hidden');
      $('lab-term').classList.remove('hidden');
      term = new window.Terminal({
        fontFamily: '"DM Mono", ui-monospace, monospace',
        fontSize: 13,
        cursorBlink: true,
        convertEol: false,
        theme: { background: '#0e1013', foreground: '#e2e8f0', cursor: '#34d399', selectionBackground: '#34d39955' },
      });
      fit = new window.FitAddon.FitAddon();
      term.loadAddon(fit);
      term.open($('lab-term'));
      term.parser.registerOscHandler(7777, data => {
        const state = parseState(data);
        if (state) notifyParent('state', { state });
        return true;
      });
      term.onData(data => emulator.serial0_send(data));
      emulator.add_listener('serial0-output-byte', byte => {
        pending.push(byte);
        if (!scheduled) { scheduled = true; requestAnimationFrame(flush); }
      });
      ready = true;
      status('Listo · Linux real');
      syncSize();
      installHook().then(() => {
        if (queued) { emulator.serial0_send(queued + '\n'); queued = null; }
        notifyParent('ready');
      });
      term.focus();
    });
  }

  function typeCommand(cmd) {
    if (!ready) { queued = cmd; boot(); return; }
    emulator.serial0_send(cmd + '\n');
    term.focus();
  }

  document.addEventListener('DOMContentLoaded', () => {
    $('lab-boot').addEventListener('click', boot);
    if (/[?&]autostart=1/.test(location.search)) boot();
    const cmds = $('lab-cmds');
    if (cmds) cmds.addEventListener('click', e => {
      const btn = e.target.closest('button[data-cmd]');
      if (btn) typeCommand(btn.dataset.cmd);
    });
    // Comandos que llegan del aula (solo desde este mismo sitio).
    window.addEventListener('message', e => {
      if (e.origin !== location.origin || e.source !== window.parent) return;
      const d = e.data;
      if (d && d.type === 'dev101x-lab' && typeof d.run === 'string' && d.run.length <= 300) typeCommand(d.run.replace(/\s+/g, ' '));
    });
    let t = null;
    window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(syncSize, 200); });
  });
})();
