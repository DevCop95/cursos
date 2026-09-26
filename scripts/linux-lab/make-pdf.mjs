// Genera un PDF mínimo y válido (con tabla xref) para el caso de OSINT: una página con el título de la
// propuesta. Los metadatos (autor, programa, fechas) se los pone exiftool al construir la imagen.
// Uso: node make-pdf.mjs caso-propuesta.pdf
import { writeFileSync } from 'node:fs';

const text = 'Propuesta comercial 2026 - Ejemplo Lab S.A.';
const stream = `BT /F1 20 Tf 72 760 Td (${text}) Tj ET`;
const objects = [
  '<< /Type /Catalog /Pages 2 0 R >>',
  '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
  `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'
];
let pdf = '%PDF-1.4\n';
const offsets = [];
objects.forEach((body, i) => {
  offsets.push(Buffer.byteLength(pdf, 'latin1'));
  pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
});
const xref = Buffer.byteLength(pdf, 'latin1');
pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
pdf += offsets.map(o => `${String(o).padStart(10, '0')} 00000 n \n`).join('');
pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
writeFileSync(process.argv[2] || 'caso-propuesta.pdf', pdf, 'latin1');
