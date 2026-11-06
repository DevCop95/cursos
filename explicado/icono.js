import { ICONS } from './icons.js?v=dev101x-v114';

/** SVG en línea de un icono de pixelarticons (cuadrícula de 24x24). */
export function iconSvg(name, cls = 'w-5 h-5') {
  return `<svg viewBox="0 0 24 24" fill="currentColor" class="${cls}" aria-hidden="true" focusable="false"><path d="${ICONS[name]}"/></svg>`;
}
