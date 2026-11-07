import { code, ATACANTE, PROTEGIDA } from './ayuda.js?v=dev101x-v115';

export default {
  id: 'a05-mala-configuracion',
  code: 'A05',
  title: 'Configuración de seguridad incorrecta',
  blurb: 'Un servidor con la configuración de fábrica deja el panel de administración abierto.',
  actors: [
    { id: 'u', icon: 'human', label: 'Cliente' },
    { id: 'srv', icon: 'server', label: 'Servidor web' },
    { id: 'panel', icon: 'monitor', label: 'Panel /admin' }
  ],
  steps: [
    {
      mode: 'vulnerable',
      title: 'Un servidor recién instalado',
      text: 'Se publica un servidor con la configuración de fábrica. Funciona, así que nadie la revisa. Y esa configuración está pensada para que sea fácil de probar, no para estar en internet.',
      code: code('usuario admin:  {d:admin}', 'clave admin:    {d:admin}', 'modo debug:     {d:activado}', 'listar carpetas: {d:activado}'),
      actors: {}
    },
    {
      mode: 'vulnerable',
      title: 'Alguien busca el panel',
      text: 'Un atacante prueba direcciones habituales de paneles de administración, como /admin. Es rutina: hay programas que lo hacen solos en miles de sitios.',
      code: code('GET /{d:admin}'),
      actors: { u: ATACANTE },
      packet: { from: 'u', to: 'srv', label: 'GET /admin', tone: 'danger' }
    },
    {
      mode: 'vulnerable',
      title: 'El panel responde a todo el mundo',
      text: 'El panel de administración está abierto a internet. No hacía falta que fuera público: solo lo usan unas pocas personas del equipo.',
      code: code('{l:acceso a /admin}', '{d:desde cualquier dirección IP}'),
      actors: { u: ATACANTE, panel: { tone: 'danger', badge: 'abierto a todos' } },
      packet: { from: 'srv', to: 'panel', label: 'pantalla de login', tone: 'danger' }
    },
    {
      mode: 'vulnerable',
      title: 'Credenciales de fábrica',
      text: 'El atacante prueba el usuario y la clave por defecto, que están publicados en los manuales del producto. Funciona.',
      code: code('usuario: {d:admin}', 'clave:   {d:admin}'),
      actors: { u: ATACANTE, panel: { tone: 'danger' } },
      packet: { from: 'u', to: 'srv', label: 'admin / admin', tone: 'danger' }
    },
    {
      mode: 'vulnerable',
      title: 'Dentro, y con pistas de sobra',
      text: 'Entra como administrador. Además, el modo debug enseña errores con rutas y versiones internas, y el listado de carpetas deja ver archivos que no debían verse.',
      code: code('{d:Error en /var/www/app/db.php:42}', '{d:MySQL 5.7.22, usuario root}'),
      actors: { u: { ...ATACANTE, badge: 'control total' }, srv: { tone: 'danger', badge: 'modo debug' }, panel: { icon: 'unlock', tone: 'danger', badge: 'sesión de admin' } }
    },
    {
      mode: 'safe',
      title: 'Endurecer la configuración',
      text: 'Antes de publicar se revisa y se endurece: credenciales propias y largas, debug apagado, sin listado de carpetas y el panel accesible solo desde la red del equipo.',
      code: code('clave admin:    {o:única y larga}', 'modo debug:     {o:desactivado}', 'listar carpetas: {o:desactivado}', '/admin:  {o:solo desde la VPN}'),
      actors: { srv: { ...PROTEGIDA, badge: 'endurecido' } }
    },
    {
      mode: 'safe',
      title: 'El mismo intento, ahora',
      text: 'La petición a /admin desde internet recibe un 403. El panel sigue existiendo, pero ya no es alcanzable por quien no debería.',
      code: code('GET /admin', '{o:403 prohibido}'),
      actors: { u: { ...ATACANTE, badge: 'denegado' }, srv: { ...PROTEGIDA, badge: 'endurecido' }, panel: { icon: 'lock', tone: 'ok', badge: 'solo por VPN' } },
      packet: { from: 'srv', to: 'u', label: '403 prohibido', tone: 'ok' }
    },
    {
      mode: 'safe',
      title: 'Qué recordar',
      text: 'Las configuraciones por defecto casi nunca son seguras. La seguridad empieza antes de publicar.',
      points: [
        'Cambia o elimina las cuentas y claves por defecto.',
        'Desactiva lo que no uses: puertos, módulos, páginas de ejemplo, debug.',
        'Revisa la configuración con listas de comprobación y automatízala.',
        'Mantén los mismos ajustes en todos los entornos y revísalos con regularidad.'
      ],
      code: [],
      actors: { srv: PROTEGIDA }
    }
  ]
};
