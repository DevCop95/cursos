import { code, ATACANTE, PROTEGIDA } from './ayuda.js?v=dev101x-v118';

export default {
  id: 'a09-registro-monitoreo',
  code: 'A09',
  title: 'Fallos en el registro y la supervisión',
  blurb: 'Una intrusión que nadie ve puede durar meses.',
  actors: [
    { id: 'u', icon: 'human', label: 'Cliente' },
    { id: 'app', icon: 'server', label: 'Aplicación' },
    { id: 'log', icon: 'files', label: 'Registros' }
  ],
  steps: [
    {
      mode: 'vulnerable',
      title: 'Una aplicación que casi no registra',
      text: 'La aplicación solo guarda un registro cuando se cae. Los intentos de acceso fallidos, los accesos denegados y los cambios importantes no dejan rastro.',
      code: code('registrar(error_fatal)', '{d:// y nada más}'),
      actors: {}
    },
    {
      mode: 'vulnerable',
      title: 'Alguien empieza a probar',
      text: 'Un atacante lanza miles de intentos contra la aplicación: contraseñas, direcciones, parámetros. Es ruido muy visible, si alguien mirara.',
      code: code('{d:POST /login  fallo (x 3.000)}', '{d:GET /admin   403  (x 800)}'),
      actors: { u: ATACANTE },
      packet: { from: 'u', to: 'app', label: 'miles de intentos', tone: 'danger' }
    },
    {
      mode: 'vulnerable',
      title: 'Nadie lo ve',
      text: 'El registro sigue vacío y no salta ninguna alerta. Para el equipo todo va normal, así que nadie investiga.',
      code: code('{l:registro de seguridad}', '{l:(vacío)}'),
      actors: { u: ATACANTE, app: { badge: 'sin avisos' }, log: { tone: 'idle', badge: 'vacío' } }
    },
    {
      mode: 'vulnerable',
      title: 'Semanas después',
      text: 'Detectar una intrusión a tiempo es difícil sin registros: puede tardar meses y muchas veces avisa un tercero. Mientras tanto, el atacante copia los datos con calma.',
      code: code('{d:acceso no autorizado}', '{d:duración: sin detectar}'),
      actors: { u: { ...ATACANTE, badge: 'sigue dentro' }, app: { tone: 'danger', badge: 'sin detectar' }, log: { tone: 'idle', badge: 'vacío' } }
    },
    {
      mode: 'safe',
      title: 'Registrar y avisar',
      text: 'Se registran los eventos de seguridad con su contexto (quién, qué, cuándo y desde dónde) y se definen alertas para los patrones sospechosos.',
      code: code('registrar({o:login_fallido}, ip)', 'registrar({o:acceso_denegado})', 'alerta si {o:más de 5 fallos/min}'),
      actors: { log: { icon: 'files', tone: 'ok', badge: 'registra eventos' } }
    },
    {
      mode: 'safe',
      title: 'El mismo ataque, ahora',
      text: 'En los primeros intentos fallidos se genera una alerta. El equipo puede bloquear la dirección, revisar qué se tocó y responder mientras el ataque sigue en marcha.',
      code: code('{o:ALERTA: 120 fallos en 1 min}', '{o:origen: 203.0.113.7}'),
      actors: { u: { ...ATACANTE, badge: 'bloqueado' }, app: { ...PROTEGIDA }, log: { icon: 'bell-ring', tone: 'ok', badge: 'alerta enviada' } },
      packet: { from: 'u', to: 'app', label: 'miles de intentos', tone: 'danger' }
    },
    {
      mode: 'safe',
      title: 'Qué recordar',
      text: 'Sin registros y alertas, los demás controles fallan en silencio.',
      points: [
        'Registra eventos de seguridad con contexto suficiente.',
        'Centraliza los registros y protégelos contra borrado o alteración.',
        'Define alertas y quién responde, y ensaya la respuesta.',
        'Nunca guardes contraseñas ni datos sensibles en los registros.'
      ],
      code: [],
      actors: { log: { icon: 'bell-ring', tone: 'ok' } }
    }
  ]
};
