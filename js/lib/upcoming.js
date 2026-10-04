/**
 * Próximo lanzamiento (portada y catálogo). Solo datos públicos; cuando el curso exista, se quita de aquí.
 * El icono es el logo oficial de la herramienta que enseña el curso (o uno propio si no hay una sola).
 * null = no hay ninguno anunciado (la portada y el catálogo no muestran la tarjeta).
 * Forma: { id, title, short, description, icon }
 */
export const UPCOMING = {
  id: 'devsec-101',
  title: 'Seguridad para desarrolladores: revisa tu código antes de desplegar',
  short: 'Código seguro',
  description: 'Encuentra secretos en tu código y en el historial de Git, bloquéalos con un hook y revisa Dockerfile, configuración y dependencias antes de desplegar, en un Linux real dentro del navegador.',
  icon: 'assets/logos/devsec-escudo.svg'
};
