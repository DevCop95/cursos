import { code, ATACANTE, PROTEGIDA } from './ayuda.js?v=dev101x-v114';

const AT = "' OR '1'='1' --";

export default {
  id: 'a03-inyeccion',
  code: 'A03',
  title: 'Inyección',
  blurb: 'Un formulario de acceso acaba entregando toda la tabla de usuarios.',
  actors: [
    { id: 'u', icon: 'human', label: 'Cliente' },
    { id: 'app', icon: 'server', label: 'Aplicación web' },
    { id: 'db', icon: 'database', label: 'Base de datos' }
  ],
  steps: [
    {
      mode: 'vulnerable',
      title: 'El formulario de acceso',
      text: 'Una web tiene un formulario de acceso. Para comprobar al usuario, la aplicación construye una consulta SQL pegando, tal cual, lo que se escribe en el formulario.',
      code: code('consulta = "SELECT * FROM usuarios', '  WHERE nombre = \'" + {i:nombre} + "\'', '  AND clave = \'" + {i:clave} + "\'"'),
      actors: {}
    },
    {
      mode: 'vulnerable',
      title: 'Un acceso normal',
      text: 'Ana escribe su nombre y su clave. Los valores caen entre las comillas y la consulta hace lo esperado: buscar a Ana. La base de datos devuelve una fila y Ana entra.',
      code: code('SELECT * FROM usuarios', "  WHERE nombre = '{i:ana}'", "  AND clave = '{i:x9k2}'"),
      actors: { u: { label: 'Ana' } },
      packet: { from: 'u', to: 'app', label: 'ana', tone: 'normal' }
    },
    {
      mode: 'vulnerable',
      title: 'Alguien escribe otra cosa',
      text: 'Un atacante no escribe un nombre: escribe fragmentos de SQL. Una comilla, la palabra OR y dos guiones. Para el formulario sigue siendo solo texto.',
      code: code(`nombre = "{d:${AT}}"`, 'clave  = {i:""}'),
      actors: { u: ATACANTE },
      packet: { from: 'u', to: 'app', label: AT, tone: 'danger' }
    },
    {
      mode: 'vulnerable',
      title: 'El texto se pega en la consulta',
      text: "La primera comilla cierra el texto del nombre. OR '1'='1' es siempre verdadero, y -- convierte en comentario todo lo que sigue, incluida la comprobación de la clave.",
      code: code('SELECT * FROM usuarios', `  WHERE nombre = '{d:${AT}}`, "{c:  ' AND clave = ''}"),
      actors: { u: ATACANTE, app: { tone: 'danger' } },
      packet: { from: 'app', to: 'db', label: 'consulta', tone: 'danger' }
    },
    {
      mode: 'vulnerable',
      title: 'La base de datos obedece',
      text: 'Para la base de datos la consulta es válida: la condición se cumple en todas las filas y devuelve la tabla entera. No sabe qué parte escribió el programador y cuál el atacante.',
      code: code('{l:id  nombre   rol}', '{d:1   admin    administrador}', '{d:2   ana      alumna}', '{d:3   luis     alumno}'),
      actors: { u: ATACANTE, db: { tone: 'danger', badge: 'devuelve todo' } },
      packet: { from: 'db', to: 'app', label: 'todas las filas', tone: 'danger' }
    },
    {
      mode: 'vulnerable',
      title: 'Acceso sin clave',
      text: 'La aplicación recibe filas y da el acceso por bueno. Suele abrir la sesión con la primera fila, que a menudo es una cuenta de administración. El atacante entró sin conocer ninguna clave.',
      code: code('sesion = filas[0]', '{d:// usuario: admin (administrador)}'),
      actors: { u: { ...ATACANTE, badge: 'dentro como admin' }, app: { icon: 'unlock', tone: 'danger', badge: 'acceso concedido' }, db: { tone: 'danger' } }
    },
    {
      mode: 'safe',
      title: 'La defensa: consultas parametrizadas',
      text: 'La solución es separar el código de los datos. La consulta viaja con huecos (?) y los valores van aparte. El motor los trata siempre como datos, nunca como SQL.',
      code: code('db.query(', '  "SELECT * FROM usuarios', '   WHERE nombre = ? AND clave = ?",', '  [{i:nombre}, {i:clave}]', ')'),
      actors: { app: { ...PROTEGIDA, badge: 'parametrizada' } }
    },
    {
      mode: 'safe',
      title: 'El mismo ataque, ahora',
      text: 'El atacante escribe exactamente lo mismo. Pero la consulta ya está fijada: el texto viaja en un canal aparte y no puede cerrar comillas ni añadir condiciones.',
      code: code('{l:consulta:}', '  SELECT * FROM usuarios', '  WHERE nombre = ? AND clave = ?', '{l:datos:}', `  {i:["${AT}", ""]}`),
      actors: { u: ATACANTE, app: { ...PROTEGIDA, badge: 'parametrizada' } },
      packet: { from: 'app', to: 'db', label: 'consulta + datos', tone: 'ok' }
    },
    {
      mode: 'safe',
      title: 'Acceso denegado',
      text: `Ningún usuario se llama literalmente ${AT}. La base de datos devuelve 0 filas y la aplicación deniega el acceso. El ataque se queda en texto inofensivo.`,
      code: code('{o:filas = []}', '{o:// acceso denegado}'),
      actors: { u: ATACANTE, app: { ...PROTEGIDA, badge: 'acceso denegado' }, db: { badge: '0 filas' } },
      packet: { from: 'db', to: 'app', label: '0 filas', tone: 'ok' }
    },
    {
      mode: 'safe',
      title: 'Qué recordar',
      text: 'La inyección ocurre cuando los datos del usuario se mezclan con el código de la consulta.',
      points: [
        'Parametriza siempre las consultas; es la defensa principal.',
        'Valida la entrada, pero no confíes solo en eso.',
        'Da a la cuenta de la base de datos solo los permisos que necesita.',
        'No muestres al usuario los errores SQL.'
      ],
      code: [],
      actors: { app: PROTEGIDA }
    }
  ]
};
