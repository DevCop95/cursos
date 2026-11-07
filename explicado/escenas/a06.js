import { code, ATACANTE } from './ayuda.js?v=dev101x-v115';

export default {
  id: 'a06-componentes-vulnerables',
  code: 'A06',
  title: 'Componentes vulnerables y desactualizados',
  blurb: 'Una librería vieja con un fallo público abre la puerta sin descubrir nada nuevo.',
  actors: [
    { id: 'u', icon: 'human', label: 'Cliente' },
    { id: 'app', icon: 'server', label: 'Tu aplicación' },
    { id: 'lib', icon: 'package', label: 'libpdf 1.2' }
  ],
  steps: [
    {
      mode: 'vulnerable',
      title: 'Tu app usa piezas de terceros',
      text: 'Casi todo el software se construye con librerías ajenas. Tu aplicación usa una para generar PDF, en la versión 1.2, y funciona bien desde hace meses.',
      code: code('{l:dependencias}', '  libpdf        {i:1.2}', '  otra-libreria 4.0'),
      actors: {}
    },
    {
      mode: 'vulnerable',
      title: 'Se publica un fallo',
      text: 'Alguien descubre un fallo grave en la versión 1.2 y se publica con un identificador CVE. Desde ese día lo sabe todo el mundo, atacantes incluidos, y hay un exploit público.',
      code: code('{l:aviso de seguridad}', '{d:libpdf < 1.3  ejecución remota}'),
      actors: { lib: { icon: 'bug', tone: 'danger', badge: 'fallo publicado' } }
    },
    {
      mode: 'vulnerable',
      title: 'Nadie actualiza',
      text: 'El equipo no se entera del aviso, o lo deja para más adelante. Pasan semanas con la versión vieja funcionando en producción.',
      code: code('{l:en producción}', '  libpdf {d:1.2}'),
      actors: { lib: { icon: 'bug', tone: 'danger', badge: 'sigue en 1.2' }, app: { tone: 'danger' } }
    },
    {
      mode: 'vulnerable',
      title: 'El atacante lo encuentra',
      text: 'Hay herramientas que recorren internet buscando versiones con fallos conocidos. Tu servidor aparece en la lista sin que nadie lo haya señalado.',
      code: code('{l:escaneo}', '{d:¿usa libpdf 1.2?  sí}'),
      actors: { u: ATACANTE, lib: { icon: 'bug', tone: 'danger', badge: 'sigue en 1.2' } },
      packet: { from: 'u', to: 'app', label: 'busca libpdf 1.2', tone: 'danger' }
    },
    {
      mode: 'vulnerable',
      title: 'Y lo aprovecha',
      text: 'Envía un archivo preparado para ese fallo. No tuvo que descubrir nada: el exploit ya estaba publicado y solo había que lanzarlo.',
      code: code('{d:POST /convertir  archivo.pdf}', '{d:// ejecuta código en el servidor}'),
      actors: { u: ATACANTE, app: { tone: 'danger', badge: 'comprometida' }, lib: { icon: 'bug', tone: 'danger' } },
      packet: { from: 'u', to: 'app', label: 'PDF manipulado', tone: 'danger' }
    },
    {
      mode: 'safe',
      title: 'Mantener el inventario al día',
      text: 'Se mantiene un inventario de dependencias y se vigilan los avisos de forma automática. Cuando sale la versión corregida, se actualiza y se prueba.',
      code: code('npm audit', 'dependabot: {o:activado}', 'libpdf  1.2 -> {o:1.4}'),
      actors: { lib: { icon: 'package', tone: 'ok', label: 'libpdf 1.4', badge: 'al día' } }
    },
    {
      mode: 'safe',
      title: 'El mismo intento, ahora',
      text: 'La versión corregida ya no tiene ese fallo. El archivo manipulado no hace nada y se rechaza.',
      code: code('POST /convertir  archivo.pdf', '{o:archivo no válido}'),
      actors: { u: { ...ATACANTE, badge: 'sin efecto' }, lib: { icon: 'package', tone: 'ok', label: 'libpdf 1.4', badge: 'al día' } },
      packet: { from: 'app', to: 'u', label: 'archivo rechazado', tone: 'ok' }
    },
    {
      mode: 'safe',
      title: 'Qué recordar',
      text: 'No hace falta que el fallo sea tuyo para que te afecte: lo que ejecutas incluye todo lo que importas.',
      points: [
        'Conoce tus dependencias: guarda un inventario (SBOM).',
        'Automatiza avisos y actualizaciones (Dependabot, npm audit).',
        'Elimina librerías y funciones que no uses.',
        'Descarga solo de fuentes oficiales y comprueba su integridad.'
      ],
      code: [],
      actors: { lib: { icon: 'package', tone: 'ok', label: 'libpdf 1.4' } }
    }
  ]
};
