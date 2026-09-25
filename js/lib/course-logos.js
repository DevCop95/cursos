/**
 * Logo oficial de la herramienta que enseña cada curso (tarjetas de Mis cursos, Catálogo y portada).
 * Sobre fondo oscuro. Los cursos que no estén aquí usan su icono de siempre.
 */
export const COURSE_LOGOS = {
  'pentesting-101': 'assets/logos/nmap.png',
  'git-github-101': 'assets/logos/github.svg',
  'shodan-101': 'assets/shodan.png'
};

export const courseLogo = id => COURSE_LOGOS[id] || '';
