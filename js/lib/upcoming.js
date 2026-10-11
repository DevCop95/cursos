/**
 * Próximo lanzamiento (portada y catálogo). Solo datos públicos; cuando el curso exista, se quita de aquí.
 * El icono es el logo oficial de la herramienta que enseña el curso (o uno propio si no hay una sola).
 * null = no hay ninguno anunciado (la portada y el catálogo no muestran la tarjeta).
 * Forma: { id, title, short, description, icon }
 */
export const UPCOMING = {
  id: 'webhacking-101',
  title: 'Web Hacking y Bug Bounty: OWASP Top 10 con ética',
  short: 'Web Hacking',
  description: 'Encuentra y reporta control de acceso roto, inyección SQL, XSS, SSRF y JWT débil siguiendo el OWASP Top 10, con la línea ética de un programa de bug bounty real.',
  icon: 'assets/logos/owasp-bn.svg'
};
