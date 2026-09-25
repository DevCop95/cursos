/**
 * Laboratorio Linux real (prototipo): Alpine Linux emulado con v86 dentro del navegador.
 * La máquina arranca desde un estado ya iniciado (state.bin.zst) y lee los archivos del disco
 * bajo demanda (img-vN/flat). Todo se ejecuta en el equipo del alumno.
 * Sirve a la página del prototipo (index.html) y a la terminal del aula (embed.html, en un iframe):
 * el aula manda comandos con postMessage { type: 'dev101x-lab', run } y recibe { type, event: 'ready' }.
 */
(function () {
  'use strict';
  const IMG = 'img-v1/';
  const $ = id => document.getElementById(id);
  let emulator = null;
  let term = null;
  let fit = null;
  let ready = false;
  let queued = null;
  const embedded = window.parent !== window;

  function status(text) { $('lab-status').textContent = text; }

  function notifyParent(event) {
    if (embedded) window.parent.postMessage({ type: 'dev101x-lab', event }, location.origin);
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
      term.onData(data => emulator.serial0_send(data));
      emulator.add_listener('serial0-output-byte', byte => {
        pending.push(byte);
        if (!scheduled) { scheduled = true; requestAnimationFrame(flush); }
      });
      ready = true;
      status('Listo · Linux real');
      syncSize();
      emulator.serial0_send('clear; cat /etc/motd\n');
      if (queued) { emulator.serial0_send(queued + '\n'); queued = null; }
      notifyParent('ready');
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
