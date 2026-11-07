import { code, ATACANTE, PROTEGIDA } from './ayuda.js?v=dev101x-v117';

export default {
  id: 'a07-fallos-autenticacion',
  code: 'A07',
  title: 'Fallos de identificación y autenticación',
  blurb: 'Un login sin límites cae ante una lista de contraseñas comunes.',
  actors: [
    { id: 'u', icon: 'human', label: 'Cliente' },
    { id: 'app', icon: 'login', label: 'Login' },
    { id: 'db', icon: 'database', label: 'Cuentas' }
  ],
  steps: [
    {
      mode: 'vulnerable',
      title: 'Un login sin límites',
      text: 'Un formulario de acceso permite probar contraseñas todas las veces que se quiera y acepta claves muy débiles, como 123456.',
      code: code('intentos permitidos: {d:ilimitados}', 'clave mínima: {d:4 caracteres}', 'segundo factor: {d:no}'),
      actors: {}
    },
    {
      mode: 'vulnerable',
      title: 'Una lista de contraseñas comunes',
      text: 'El atacante tiene una lista con las contraseñas más usadas y un programa que las prueba una detrás de otra contra la cuenta de administración.',
      code: code('usuario: admin', 'clave:   {d:123456}'),
      actors: { u: ATACANTE },
      packet: { from: 'u', to: 'app', label: 'admin / 123456', tone: 'danger' }
    },
    {
      mode: 'vulnerable',
      title: 'Fallo tras fallo',
      text: 'Fallo. Otro fallo. Para el servidor son intentos normales: no hay bloqueo, ni retraso, ni aviso. El programa sigue probando y puede hacerlo toda la noche.',
      code: code('usuario: admin', 'clave:   {d:password}', '{l:respuesta: contraseña incorrecta}'),
      actors: { u: ATACANTE, app: { tone: 'danger', badge: 'intento 1.482' } },
      packet: { from: 'u', to: 'app', label: 'admin / password', tone: 'danger' }
    },
    {
      mode: 'vulnerable',
      title: 'Acierta',
      text: 'Tras miles de intentos acierta: la clave era admin123. Lo mismo funciona con claves filtradas de otras webs, porque mucha gente repite contraseña (credential stuffing).',
      code: code('usuario: admin', 'clave:   {d:admin123}', '{d:acceso concedido}'),
      actors: { u: { ...ATACANTE, badge: 'dentro como admin' }, app: { icon: 'unlock', tone: 'danger', badge: 'acceso concedido' }, db: { tone: 'danger' } },
      packet: { from: 'app', to: 'db', label: 'sesión de admin', tone: 'danger' }
    },
    {
      mode: 'safe',
      title: 'La defensa: límites y segundo factor',
      text: 'Se limitan los intentos y se bloquea temporalmente la cuenta, se exige una contraseña larga que no esté en listas filtradas y se añade un segundo factor (MFA).',
      code: code('máximo {o:5 intentos / 10 min}', 'clave mínima: {o:12 + lista filtradas}', 'segundo factor: {o:sí}'),
      actors: { app: { ...PROTEGIDA, badge: 'límites + MFA' } }
    },
    {
      mode: 'safe',
      title: 'El mismo ataque, ahora',
      text: 'A partir del sexto intento la cuenta se bloquea y se avisa. Y aunque el atacante acertara la clave, le faltaría el segundo factor.',
      code: code('intento 6: {o:cuenta bloqueada}', '{o:aviso enviado al propietario}'),
      actors: { u: { ...ATACANTE, badge: 'bloqueado' }, app: { ...PROTEGIDA, badge: 'cuenta bloqueada' } },
      packet: { from: 'app', to: 'u', label: 'demasiados intentos', tone: 'ok' }
    },
    {
      mode: 'safe',
      title: 'Qué recordar',
      text: 'La autenticación falla cuando es fácil adivinar, repetir o saltarse la identidad de alguien.',
      points: [
        'Limita y retrasa los intentos de acceso.',
        'Activa un segundo factor, sobre todo en cuentas con permisos.',
        'Rechaza contraseñas débiles o ya filtradas.',
        'Usa mensajes de error iguales: no reveles si el usuario existe.'
      ],
      code: [],
      actors: { app: PROTEGIDA }
    }
  ]
};
