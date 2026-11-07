import { code, PROTEGIDA } from './ayuda.js?v=dev101x-v116';

const INTRUSO = { icon: 'skull', label: 'Atacante', tone: 'danger' };

export default {
  id: 'a08-integridad-software-datos',
  code: 'A08',
  title: 'Fallos en la integridad de software y datos',
  blurb: 'Una actualización automática se instala sin comprobar que sea la original.',
  actors: [
    { id: 'prov', icon: 'cloud-server', label: 'Proveedor' },
    { id: 'red', icon: 'cloud', label: 'Internet' },
    { id: 'app', icon: 'server', label: 'Tu aplicación' }
  ],
  steps: [
    {
      mode: 'vulnerable',
      title: 'Una actualización automática',
      text: 'Tu aplicación comprueba cada noche si hay una versión nueva y la instala sola, descargándola de un servidor externo.',
      code: code('descargar(url)', 'instalar(archivo)'),
      actors: {},
      packet: { from: 'prov', to: 'red', label: 'actualización 2.0', tone: 'normal' }
    },
    {
      mode: 'vulnerable',
      title: 'Alguien cambia el paquete',
      text: 'En el camino el archivo se sustituye por otro con código malicioso: por un servidor comprometido, un enlace secuestrado o una red intermedia. También pasa con dependencias de repositorios públicos.',
      code: code('{l:archivo recibido}', '{d:actualización 2.0 (modificada)}'),
      actors: { red: { ...INTRUSO, label: 'Atacante en la red', badge: 'cambia el archivo' } },
      packet: { from: 'red', to: 'app', label: 'actualización 2.0', tone: 'danger' }
    },
    {
      mode: 'vulnerable',
      title: 'Se instala sin comprobar',
      text: 'La aplicación no verifica de dónde viene ni si coincide con el original, así que lo instala y lo ejecuta con todos sus permisos.',
      code: code('instalar(archivo)', '{d:// nadie comprueba la firma}'),
      actors: { red: INTRUSO, app: { tone: 'danger', badge: 'ejecuta código ajeno' } }
    },
    {
      mode: 'safe',
      title: 'Verificar firma y hash',
      text: 'Antes de instalar, la aplicación comprueba la firma digital del proveedor y el hash del archivo. Las dependencias se fijan a versiones y hashes concretos.',
      code: code('ok = {o:verificar(archivo, clave_publica)}', 'si no ok: rechazar()', '{o:lockfile con hashes}'),
      actors: { app: { ...PROTEGIDA, badge: 'verifica la firma' } }
    },
    {
      mode: 'safe',
      title: 'El mismo cambio, ahora',
      text: 'El archivo modificado ya no coincide con la firma del proveedor. Se rechaza, se avisa y no se ejecuta nada.',
      code: code('firma: {o:inválida}', '{o:archivo rechazado}'),
      actors: { red: { ...INTRUSO, label: 'Atacante en la red' }, app: { ...PROTEGIDA, badge: 'firma inválida' } },
      packet: { from: 'red', to: 'app', label: 'actualización 2.0', tone: 'danger' }
    },
    {
      mode: 'safe',
      title: 'Qué recordar',
      text: 'La integridad falla cuando se confía en código o datos sin comprobar su origen.',
      points: [
        'Firma y verifica lo que instalas y actualizas.',
        'Fija versiones y hashes de las dependencias (lockfile).',
        'Protege tu pipeline de CI/CD: accesos mínimos y revisión de cambios.',
        'No deserialices datos que no sean de confianza.'
      ],
      code: [],
      actors: { app: PROTEGIDA }
    }
  ]
};
