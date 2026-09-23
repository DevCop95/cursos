/**
 * Dev101x — Liquid Water / Ink Reveal Canvas Effect
 * Inspirado en la experiencia de MiMo Code (mimo.xiaomi.com/coder)
 * 
 * Genera un lienzo interactivo con física de ondas de agua y gotas de tinta que
 * disuelven suavemente la máscara sólida para revelar el arte de fondo cuando
 * el cursor se desplaza sobre la pantalla.
 */
(function initDev101xWaterReveal() {
  function startEngine() {
    const canvas = document.getElementById('waterMaskCanvas');
    const wrapper = document.getElementById('water-bg-wrapper');
    if (!canvas || !wrapper) return;

    // Solo habilitar interacción en dispositivos con puntero (mouse/trackpad)
    const canHover = window.matchMedia('(hover: hover)').matches;
    if (!canHover) {
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Color de la máscara: Warm Paper #f3f0ea
    const MASK = '243, 240, 234';
    const R_START = 14;
    const R_END = 160;
    const R_VARY = 0.45;
    const LIFETIME = 850; // ms de expansión fluida
    const STAMP_STEP = 10;
    const MAX_STAMPS = 220;
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

    // Dibuja una gota irregular con gradiente suave que perfora la máscara sólida
    function carveWaterDrop(x, y, r, alpha, seed) {
      const g = ctx.createRadialGradient(x, y, r * 0.18, x, y, r);
      g.addColorStop(0, 'rgba(0, 0, 0, ' + 0.98 * alpha + ')');
      g.addColorStop(0.5, 'rgba(0, 0, 0, ' + 0.85 * alpha + ')');
      g.addColorStop(0.85, 'rgba(0, 0, 0, ' + 0.35 * alpha + ')');
      g.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.fillStyle = g;
      ctx.beginPath();
      const segs = 32;
      for (let i = 0; i <= segs; i++) {
        const a = (i / segs) * Math.PI * 2;
        const wob =
          0.82 +
          0.12 * Math.sin(a * 3 + seed) +
          0.06 * Math.sin(a * 7 + seed * 2.1) +
          0.04 * Math.sin(a * 13 + seed * 0.7);
        const rr = r * wob;
        const px = x + Math.cos(a) * rr;
        const py = y + Math.sin(a) * rr;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
    }

    // Dibuja una onda / anillo de refracción líquida sutil
    function drawRippleRing(x, y, r, alpha) {
      if (alpha < 0.08) return;
      ctx.save();
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = 'rgba(0, 92, 56, ' + (alpha * 0.16) + ')';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x, y, r * 0.92, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    let running = false;

    function loop() {
      const now = performance.now();

      // 1. Re-pintar máscara sólida
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = 'rgb(' + MASK + ')';
      ctx.fillRect(0, 0, w, h);

      // 2. Perforar con gotas activas estilo MiMo
      ctx.globalCompositeOperation = 'destination-out';
      for (let i = stamps.length - 1; i >= 0; i--) {
        const t = (now - stamps[i].born) / LIFETIME;
        if (t >= 1) {
          stamps.splice(i, 1);
          continue;
        }
        const ease = 1 - Math.pow(1 - t, 3); // Expansión fluida easeOutCubic
        const r = R_START + (stamps[i].rmax - R_START) * ease;
        const alpha = 1 - t * t; // Desvanecimiento progresivo
        carveWaterDrop(stamps[i].x, stamps[i].y, r, alpha, stamps[i].seed);
      }

      // 3. Dibujar ondas de refracción líquida suaves
      for (let i = 0; i < stamps.length; i++) {
        const t = (now - stamps[i].born) / LIFETIME;
        if (t < 1) {
          const ease = 1 - Math.pow(1 - t, 3);
          const r = R_START + (stamps[i].rmax - R_START) * ease;
          const alpha = 1 - t * t;
          drawRippleRing(stamps[i].x, stamps[i].y, r, alpha);
        }
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

    // Pequeño saludo visual inicial tipo gota que se expande
    setTimeout(function () {
      if (wrapper.classList.contains('hidden') || wrapper.style.display === 'none') return;
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      addStamp(cx - 80, cy - 60);
      addStamp(cx + 80, cy + 50);
      start();
    }, 350);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startEngine);
  } else {
    startEngine();
  }
})();
