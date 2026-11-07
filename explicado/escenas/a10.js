import { code, ATACANTE, PROTEGIDA } from './ayuda.js?v=dev101x-v116';

export default {
  id: 'a10-ssrf',
  code: 'A10',
  title: 'Falsificación de peticiones del lado del servidor (SSRF)',
  blurb: 'El atacante consigue que el servidor visite direcciones internas por él.',
  actors: [
    { id: 'u', icon: 'human', label: 'Cliente' },
    { id: 'app', icon: 'server', label: 'Servidor web' },
    { id: 'int', icon: 'cloud-server', label: 'Red interna' }
  ],
  steps: [
    {
      mode: 'vulnerable',
      title: 'Importar una imagen desde una URL',
      text: 'Una web permite poner tu foto de perfil pegando un enlace. El servidor descarga la imagen por ti y la guarda.',
      code: code('url = peticion.{i:url}', 'imagen = descargar(url)'),
      actors: { u: { label: 'Ana' } },
      packet: { from: 'u', to: 'app', label: 'url: foto.example', tone: 'normal' }
    },
    {
      mode: 'vulnerable',
      title: 'Alguien apunta a una dirección interna',
      text: 'El servidor está dentro de la red de la empresa, donde hay servicios que desde fuera no se ven: paneles, bases de datos, metadatos de la nube. El atacante pide que el servidor visite uno de ellos.',
      code: code('url = {d:http://10.0.0.5/admin}'),
      actors: { u: ATACANTE },
      packet: { from: 'u', to: 'app', label: 'url: 10.0.0.5/admin', tone: 'danger' }
    },
    {
      mode: 'vulnerable',
      title: 'El servidor obedece desde dentro',
      text: 'La petición sale del propio servidor, que es de confianza para la red interna. Ningún cortafuegos la bloquea, porque no viene de fuera.',
      code: code('descargar({d:"http://10.0.0.5/admin"})', '{d:// nadie valida el destino}'),
      actors: { u: ATACANTE, app: { tone: 'danger' }, int: { tone: 'danger', badge: 'confía en el servidor' } },
      packet: { from: 'app', to: 'int', label: 'GET /admin', tone: 'danger' }
    },
    {
      mode: 'vulnerable',
      title: 'La red interna responde',
      text: 'El servicio interno contesta como si hablara con un compañero de confianza y entrega el contenido de su panel.',
      code: code('{l:respuesta interna}', '{d:panel de administración}', '{d:claves de servicio}'),
      actors: { u: ATACANTE, app: { tone: 'danger' }, int: { tone: 'danger' } },
      packet: { from: 'int', to: 'app', label: 'datos internos', tone: 'danger' }
    },
    {
      mode: 'vulnerable',
      title: 'Y llega al atacante',
      text: 'Si la aplicación muestra o guarda la respuesta, el atacante acaba leyendo contenido que nunca debió salir de la red interna.',
      code: code('devolver {d:respuesta}'),
      actors: { u: { ...ATACANTE, badge: 've la red interna' }, app: { tone: 'danger' }, int: { tone: 'danger' } },
      packet: { from: 'app', to: 'u', label: 'datos internos', tone: 'danger' }
    },
    {
      mode: 'safe',
      title: 'La defensa: lista de destinos permitidos',
      text: 'El servidor solo descarga de destinos que están en una lista, bloquea las direcciones privadas y no devuelve la respuesta cruda al usuario.',
      code: code('permitidos = {o:["fotos.example"]}', 'si host no en permitidos: error', '{o:bloquear IP privadas}', '{o:no devolver respuesta cruda}'),
      actors: { app: { ...PROTEGIDA, badge: 'destinos permitidos' } }
    },
    {
      mode: 'safe',
      title: 'El mismo intento, ahora',
      text: 'La petición a 10.0.0.5 se rechaza antes de salir del servidor. La red interna ni se entera.',
      code: code('url = http://10.0.0.5/admin', '{o:error: destino no permitido}'),
      actors: { u: { ...ATACANTE, badge: 'rechazado' }, app: { ...PROTEGIDA, badge: 'destino no permitido' } },
      packet: { from: 'app', to: 'u', label: 'destino no permitido', tone: 'ok' }
    },
    {
      mode: 'safe',
      title: 'Qué recordar',
      text: 'SSRF convierte a tu servidor en un intermediario con acceso a lo que el atacante no alcanza.',
      points: [
        'Valida los destinos con una lista de permitidos, no con una lista de prohibidos.',
        'Bloquea las direcciones privadas y los servicios de metadatos.',
        'No devuelvas al usuario la respuesta tal cual.',
        'Segmenta la red: que el servidor web no llegue a todo.'
      ],
      code: [],
      actors: { app: PROTEGIDA }
    }
  ]
};
