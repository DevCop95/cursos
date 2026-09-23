/**
 * Dev101x - GitHub-Style Identicon Generator
 * Genera avatares deterministas de 5x5 en cuadrícula simétrica tipo GitHub
 */
(function (global) {
  'use strict';

  function hashString(str) {
    let hash = 2166136261;
    const s = String(str || 'Dev101x').trim().toLowerCase();
    for (let i = 0; i < s.length; i++) {
      hash ^= s.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return Math.abs(hash);
  }

  function generateSvg(seed, size = 64) {
    const hash = hashString(seed);

    // Color determinista estilo GitHub
    // Para 'dev101x' genera un tono verde esmeralda que empata con la marca
    const hue = hash % 360;
    const saturation = 65 + (hash % 20); // 65% - 85%
    const lightness = 40 + ((hash >> 4) % 15); // 40% - 55%
    const fgColor = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    const bgColor = '#F0F3F6'; // Fondo gris claro característico de GitHub

    // Cuadrícula 5x5 con margen
    const margin = Math.round(size * 0.08);
    const innerSize = size - (margin * 2);
    const cellSize = innerSize / 5;

    const cells = [];
    let tempHash = hash;

    for (let row = 0; row < 5; row++) {
      // 3 columnas independientes reflejadas simétricamente en 5
      const rowBits = (tempHash >> (row * 3)) & 7;
      const b0 = (rowBits & 1) === 1;
      const b1 = ((rowBits >> 1) & 1) === 1;
      const b2 = ((rowBits >> 2) & 1) === 1;

      const y = (margin + row * cellSize).toFixed(1);
      const h = cellSize.toFixed(1);
      const w = cellSize.toFixed(1);

      if (b0) {
        cells.push(`<rect x="${(margin + 0 * cellSize).toFixed(1)}" y="${y}" width="${w}" height="${h}" fill="${fgColor}"/>`);
        cells.push(`<rect x="${(margin + 4 * cellSize).toFixed(1)}" y="${y}" width="${w}" height="${h}" fill="${fgColor}"/>`);
      }
      if (b1) {
        cells.push(`<rect x="${(margin + 1 * cellSize).toFixed(1)}" y="${y}" width="${w}" height="${h}" fill="${fgColor}"/>`);
        cells.push(`<rect x="${(margin + 3 * cellSize).toFixed(1)}" y="${y}" width="${w}" height="${h}" fill="${fgColor}"/>`);
      }
      if (b2) {
        cells.push(`<rect x="${(margin + 2 * cellSize).toFixed(1)}" y="${y}" width="${w}" height="${h}" fill="${fgColor}"/>`);
      }

      tempHash = Math.imul(tempHash ^ 0x9e3779b9, 16777619);
    }

    // Asegurar que nunca quede vacío
    if (cells.length === 0) {
      cells.push(`<rect x="${(margin + 2 * cellSize).toFixed(1)}" y="${(margin + 2 * cellSize).toFixed(1)}" width="${cellSize.toFixed(1)}" height="${cellSize.toFixed(1)}" fill="${fgColor}"/>`);
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" style="background-color:${bgColor};border-radius:6px;overflow:hidden;display:inline-block;vertical-align:middle;">${cells.join('')}</svg>`;
  }

  function getDataUri(seed, size = 64) {
    const svg = generateSvg(seed, size);
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  }

  function updateIdenticonsInDocument() {
    document.querySelectorAll('[data-identicon]').forEach(el => {
      const seed = el.getAttribute('data-identicon');
      if (el.tagName === 'IMG') {
        el.src = getDataUri(seed);
      } else {
        el.innerHTML = generateSvg(seed, el.clientWidth || 32);
      }
    });
  }

  const Identicon = {
    svg: generateSvg,
    dataUri: getDataUri,
    updateAll: updateIdenticonsInDocument
  };

  global.Identicon = Identicon;
})(typeof window !== 'undefined' ? window : this);
