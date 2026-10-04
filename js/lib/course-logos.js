/**
 * Logo oficial de la herramienta que enseña cada curso (tarjetas de Mis cursos, Catálogo y portada).
 * Sobre fondo oscuro y en blanco y negro. Los cursos que no estén aquí usan su icono de siempre.
 */
export const COURSE_LOGOS = {
  'pentesting-101': 'assets/logos/nmap-bn.png',
  'git-github-101': 'assets/logos/github.svg',
  'shodan-101': 'assets/logos/shodan-bn.png',
  'osint-101': 'assets/logos/osint-huella.svg',
  'linux-101': 'assets/logos/linux-bn.svg',
  'devsec-101': 'assets/logos/devsec-escudo.svg'
};

export const courseLogo = id => COURSE_LOGOS[id] || '';
