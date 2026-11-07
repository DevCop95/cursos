import { code, PROTEGIDA } from './ayuda.js?v=dev101x-v116';

export default {
  id: 'a02-fallos-criptograficos',
  code: 'A02',
  title: 'Fallos criptográficos',
  blurb: 'Una clave que viaja sin cifrar la lee quien esté en la misma red.',
  actors: [
    { id: 'u', icon: 'human', label: 'Cliente' },
    { id: 'red', icon: 'wifi', label: 'Wi-Fi público' },
    { id: 'app', icon: 'server', label: 'Servidor' }
  ],
  steps: [
    {
      mode: 'vulnerable',
      title: 'Un login por HTTP',
      text: 'Una web antigua envía el formulario de acceso por HTTP, sin cifrar. Todo lo que viaja es texto legible.',
      code: code('POST http://tienda.example/login', '{i:usuario=ana&clave=x9k2}'),
      actors: {}
    },
    {
      mode: 'vulnerable',
      title: 'El mensaje cruza la red',
      text: 'Ana está en el Wi-Fi de una cafetería. El mensaje pasa por esa red antes de llegar al servidor, y cualquiera conectado a ella puede ver los paquetes.',
      code: code('{l:contenido del paquete}', '{d:usuario=ana&clave=x9k2}'),
      actors: {},
      packet: { from: 'u', to: 'red', label: 'clave=x9k2', tone: 'danger' }
    },
    {
      mode: 'vulnerable',
      title: 'Alguien escucha',
      text: 'Con una herramienta de captura de tráfico, otra persona de la misma red lee el usuario y la clave tal cual. No ha hackeado nada: el mensaje iba en abierto.',
      code: code('{l:captura}', '{d:POST /login  usuario=ana&clave=x9k2}'),
      actors: { red: { icon: 'eye', tone: 'danger', label: 'Espía en la red', badge: 'lee la clave' } },
      packet: { from: 'red', to: 'app', label: 'clave=x9k2', tone: 'danger' }
    },
    {
      mode: 'vulnerable',
      title: 'Y guardada en claro',
      text: 'En el servidor la clave se guardó también como texto plano. Si alguien roba la base de datos, se lleva las claves de todos, listas para usar.',
      code: code('{l:tabla usuarios}', '{d:ana    x9k2}', '{d:luis   miperro1}'),
      actors: { app: { tone: 'danger', badge: 'claves en claro' } }
    },
    {
      mode: 'safe',
      title: 'HTTPS cifra el camino',
      text: 'Con HTTPS (TLS) el mensaje se cifra antes de salir del equipo. Quien escucha en la red solo ve datos ininteligibles.',
      code: code('POST https://tienda.example/login', '{o:a8f3c09e71b2...d4}'),
      actors: { red: { tone: 'idle', label: 'Wi-Fi público', badge: 'no puede leer' } },
      packet: { from: 'u', to: 'red', label: 'a8f3c0...19d', tone: 'ok' }
    },
    {
      mode: 'safe',
      title: 'Guardar solo un hash',
      text: 'Las contraseñas se guardan con un algoritmo de hash lento y con sal (argon2, bcrypt). No se pueden deshacer: solo se comparan con lo que escribe el usuario.',
      code: code('hash = {o:argon2(clave, sal)}', 'guardar(usuario, hash)'),
      actors: { app: { ...PROTEGIDA, badge: 'solo guarda el hash' } }
    },
    {
      mode: 'safe',
      title: 'Qué recordar',
      text: 'Los fallos criptográficos son cifrar mal, o no cifrar, datos que lo necesitan.',
      points: [
        'Usa HTTPS en todo el sitio y activa HSTS.',
        'Cifra los datos sensibles también en reposo.',
        'Guarda contraseñas con hash lento y sal, nunca en claro.',
        'No inventes tu propio algoritmo: usa bibliotecas probadas.'
      ],
      code: [],
      actors: { app: PROTEGIDA }
    }
  ]
};
