import { code, ATACANTE, PROTEGIDA } from './ayuda.js?v=dev101x-v114';

export default {
  id: 'a01-control-acceso',
  code: 'A01',
  title: 'Control de acceso roto',
  blurb: 'Cambiar un número en la dirección basta para leer la factura de otra persona.',
  actors: [
    { id: 'u', icon: 'human', label: 'Ana' },
    { id: 'app', icon: 'server', label: 'Aplicación web' },
    { id: 'db', icon: 'files', label: 'Facturas' }
  ],
  steps: [
    {
      mode: 'vulnerable',
      title: 'Una página con facturas',
      text: 'Ana consulta sus facturas en una web. La dirección de cada una lleva su número: la factura 5 está en /factura/5.',
      code: code('GET /factura/{i:5}'),
      actors: {},
      packet: { from: 'u', to: 'app', label: 'GET /factura/5', tone: 'normal' }
    },
    {
      mode: 'vulnerable',
      title: 'La aplicación la entrega',
      text: 'La aplicación busca la factura 5 y se la enseña a Ana. Hasta aquí, todo normal.',
      code: code('factura = buscar({i:5})', 'devolver factura'),
      actors: {},
      packet: { from: 'app', to: 'u', label: 'factura 5 (de Ana)', tone: 'normal' }
    },
    {
      mode: 'vulnerable',
      title: 'Alguien cambia el número',
      text: 'La dirección se puede editar a mano. Un usuario cambia el 5 por un 6 y pide la factura de otra persona.',
      code: code('GET /factura/{d:6}'),
      actors: { u: { ...ATACANTE, label: 'Usuario curioso' } },
      packet: { from: 'u', to: 'app', label: 'GET /factura/6', tone: 'danger' }
    },
    {
      mode: 'vulnerable',
      title: 'Nadie pregunta de quién es',
      text: 'La aplicación comprueba que hay una sesión iniciada, pero no que la factura pertenezca a quien la pide. Busca la 6 y ya.',
      code: code('factura = buscar(6)', 'devolver factura', '{d:// no se comprueba el dueño}'),
      actors: { u: { ...ATACANTE, label: 'Usuario curioso' }, app: { tone: 'danger' } },
      packet: { from: 'app', to: 'db', label: 'factura 6', tone: 'danger' }
    },
    {
      mode: 'vulnerable',
      title: 'Entrega datos ajenos',
      text: 'La factura 6 es de otro cliente y la aplicación se la entrega. Esto se llama IDOR: referencia directa e insegura a un objeto. Probando números se puede recorrer toda la base.',
      code: code('{l:factura 6}', '{d:cliente: Luis Pérez}', '{d:importe: 480,00 EUR}'),
      actors: { u: { ...ATACANTE, label: 'Usuario curioso', badge: 've datos ajenos' }, db: { tone: 'danger' } },
      packet: { from: 'app', to: 'u', label: 'factura de Luis', tone: 'danger' }
    },
    {
      mode: 'safe',
      title: 'La defensa: comprobar el dueño',
      text: 'En cada petición el servidor comprueba que el recurso pertenece al usuario de la sesión. Tener sesión no basta: hay que tener permiso sobre ese dato.',
      code: code('factura = buscar(id)', '{o:si factura.dueño != sesion.usuario:}', '{o:    devolver 403}'),
      actors: { app: { ...PROTEGIDA, badge: 'comprueba el dueño' } }
    },
    {
      mode: 'safe',
      title: 'El mismo intento, ahora',
      text: 'El mismo cambio de 5 a 6 ahora termina en un 403 (prohibido). La factura existe, pero no es de quien la pide, y no se entrega.',
      code: code('GET /factura/{d:6}', '{o:403 prohibido}'),
      actors: { u: { ...ATACANTE, label: 'Usuario curioso', badge: 'denegado' }, app: { ...PROTEGIDA, badge: 'comprueba el dueño' } },
      packet: { from: 'app', to: 'u', label: '403 prohibido', tone: 'ok' }
    },
    {
      mode: 'safe',
      title: 'Qué recordar',
      text: 'El control de acceso falla cuando el servidor da por bueno lo que pide el cliente.',
      points: [
        'Deniega por defecto y permite solo lo necesario.',
        'Comprueba el permiso en el servidor, en cada petición.',
        'Los identificadores difíciles de adivinar ayudan, pero no sustituyen al control.',
        'Registra los accesos denegados: avisan de que alguien está probando.'
      ],
      code: [],
      actors: { app: PROTEGIDA }
    }
  ]
};
