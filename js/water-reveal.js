/**
 * Dev101x — Liquid Water / Ink Reveal Canvas Effect
 * Réplica exacta y natural del efecto de MiMo Code (mimo.xiaomi.com/coder)
 * 
 * Disuelve suave y orgánicamente la máscara sólida de papel al pasar el cursor,
 * sin líneas, trazos ni círculos artificiales, revelando el fondo de forma natural.
 */
(function initDev101xWaterReveal() {
  function startEngine() {
    const canvas = document.getElementById('waterMaskCanvas');
    const wrapper = document.getElementById('water-bg-wrapper');
    if (!canvas || !wrapper) return;

    // Solo habilitar en dispositivos con puntero (mouse/trackpad)
    const canHover = window.matchMedia('(hover: hover)').matches;
    if (!canHover) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Color de la máscara: Warm Paper #f3f0ea
    const MASK = '243, 240, 234';
    const R_START = 8;
    const R_END = 128;
    const R_VARY = 0.45;
    const LIFETIME = 540; // ms natural y dinámico
    const STAMP_STEP = 12;
    const MAX_STAMPS = 160;
    const DPR = Math.min(window.devicePixelRatio || 1, 2);

    let w = 0;
    let h = 0;

    function resize() {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.round(w * DPR);
      canvas.height = Math.round(h * DPR);
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';

      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = 'rgb(' + MASK + ')';
      ctx.fillRect(0, 0, w, h);
    }

    resize();
    window.addEventListener('resize', resize, { passive: true });

    const stamps = [];
    let lastX = null;
    let lastY = null;

    function addStamp(x, y) {
      if (stamps.length >= MAX_STAMPS) stamps.shift();
      stamps.push({
        x: x,
        y: y,
        born: performance.now(),
        seed: Math.random() * Math.PI * 2,
        rmax: R_END * (1 - R_VARY + Math.random() * R_VARY),
      });
    }

    function stampAlong(x, y) {
      if (lastX === null) {
        addStamp(x, y);
      } else {
        const dx = x - lastX;
        const dy = y - lastY;
        const dist = Math.hypot(dx, dy);
        const steps = Math.max(1, Math.ceil(dist / STAMP_STEP));
        for (let i = 1; i <= steps; i++) {
          addStamp(lastX + (dx * i) / steps, lastY + (dy * i) / steps);
        }
      }
      lastX = x;
      lastY = y;
    }

    // Carve orgánico suave y natural idéntico a MiMo Code
    function carveInk(x, y, r, alpha, seed) {
      const g = ctx.createRadialGradient(x, y, r * 0.25, x, y, r);
      g.addColorStop(0, 'rgba(0, 0, 0, ' + 0.95 * alpha + ')');
      g.addColorStop(0.55, 'rgba(0, 0, 0, ' + 0.88 * alpha + ')');
      g.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = g;

      ctx.beginPath();
      const segs = 32;
      for (let i = 0; i <= segs; i++) {
        const a = (i / segs) * Math.PI * 2;
        const wob =
          0.78 +
          0.14 * Math.sin(a * 3 + seed) +
          0.08 * Math.sin(a * 7 + seed * 2.1) +
          0.05 * Math.sin(a * 13 + seed * 0.7);
        const rr = r * wob;
        const px = x + Math.cos(a) * rr;
        const py = y + Math.sin(a) * rr;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
    }

    let running = false;

    function loop() {
      const now = performance.now();

      // 1. Repintar la máscara sólida uniforme
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = 'rgb(' + MASK + ')';
      ctx.fillRect(0, 0, w, h);

      // 2. Disolver suavemente en cada punto activo
      ctx.globalCompositeOperation = 'destination-out';
      for (let i = stamps.length - 1; i >= 0; i--) {
        const t = (now - stamps[i].born) / LIFETIME;
        if (t >= 1) {
          stamps.splice(i, 1);
          continue;
        }
        const ease = 1 - Math.pow(1 - t, 3); // Expansión fluida easeOutCubic
        const r = R_START + (stamps[i].rmax - R_START) * ease;
        const alpha = 1 - t * t; // Desvanecimiento suave
        carveInk(stamps[i].x, stamps[i].y, r, alpha, stamps[i].seed);
      }

      if (stamps.length) {
        requestAnimationFrame(loop);
      } else {
        running = false;
      }
    }

    function start() {
      if (!running) {
        running = true;
        requestAnimationFrame(loop);
      }
    }

    window.addEventListener('mousemove', function (e) {
      if (wrapper.classList.contains('hidden') || wrapper.style.display === 'none') return;
      stampAlong(e.clientX, e.clientY);
      start();
    }, { passive: true });

    window.addEventListener('mouseleave', function () {
      lastX = null;
      lastY = null;
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startEngine);
  } else {
    startEngine();
  }
})();
