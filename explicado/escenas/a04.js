import { code, ATACANTE, PROTEGIDA } from './ayuda.js?v=dev101x-v116';

export default {
  id: 'a04-diseno-inseguro',
  code: 'A04',
  title: 'Diseño inseguro',
  blurb: 'No hay un fallo de código: la tienda confía en el precio que manda el navegador.',
  actors: [
    { id: 'u', icon: 'human', label: 'Comprador' },
    { id: 'tienda', icon: 'server', label: 'Tienda web' },
    { id: 'db', icon: 'database', label: 'Pedidos' }
  ],
  steps: [
    {
      mode: 'vulnerable',
      title: 'Una tienda con carrito',
      text: 'Una tienda online muestra un producto de 120 euros. Al pulsar Comprar, el navegador envía el pedido a la tienda.',
      code: code('{ "producto": 7,', '  "precio": {i:120.00} }'),
      actors: {},
      packet: { from: 'u', to: 'tienda', label: 'precio: 120', tone: 'normal' }
    },
    {
      mode: 'vulnerable',
      title: 'El diseño confía en el cliente',
      text: 'El problema no es un error de programación, es una decisión de diseño: la tienda acepta el precio que le llega en el pedido en lugar de consultarlo en su catálogo.',
      code: code('total = pedido.precio * unidades', '{d:// el precio viene del navegador}'),
      actors: { tienda: { tone: 'danger', badge: 'confía en el cliente' } }
    },
    {
      mode: 'vulnerable',
      title: 'Alguien edita el pedido',
      text: 'Cualquiera puede modificar lo que envía su navegador con las herramientas de desarrollo. El comprador cambia 120 por 1 antes de enviar.',
      code: code('{ "producto": 7,', '  "precio": {d:1.00} }'),
      actors: { u: { ...ATACANTE, label: 'Comprador' } },
      packet: { from: 'u', to: 'tienda', label: 'precio: 1', tone: 'danger' }
    },
    {
      mode: 'vulnerable',
      title: 'La tienda lo acepta',
      text: 'La tienda no ve nada raro y guarda el pedido por 1 euro. Ninguna validación falló: simplemente nadie pensó en este caso al diseñar el flujo.',
      code: code('{l:pedido guardado}', '{d:producto 7  total 1.00 EUR}'),
      actors: { u: { ...ATACANTE, label: 'Comprador' }, tienda: { tone: 'danger' }, db: { tone: 'danger', badge: 'cobrado: 1 EUR' } },
      packet: { from: 'tienda', to: 'db', label: 'pedido por 1 EUR', tone: 'danger' }
    },
    {
      mode: 'safe',
      title: 'Rediseñar: manda el servidor',
      text: 'El servidor ignora cualquier precio recibido y lo toma de su catálogo. El navegador solo dice qué producto y cuántas unidades; lo demás se calcula en el servidor.',
      code: code('precio = {o:catalogo[producto].precio}', '{o:// se ignora pedido.precio}'),
      actors: { tienda: { ...PROTEGIDA, badge: 'precio del catálogo' } }
    },
    {
      mode: 'safe',
      title: 'El mismo intento, ahora',
      text: 'El comprador sigue enviando precio 1, pero la tienda lo descarta y cobra 120. Lo que el cliente controla ya no puede cambiar lo que importa.',
      code: code('{l:pedido guardado}', '{o:producto 7  total 120.00 EUR}'),
      actors: { u: { ...ATACANTE, label: 'Comprador', badge: 'precio ignorado' }, tienda: { ...PROTEGIDA, badge: 'precio del catálogo' } },
      packet: { from: 'tienda', to: 'db', label: 'pedido por 120 EUR', tone: 'ok' }
    },
    {
      mode: 'safe',
      title: 'Qué recordar',
      text: 'El diseño inseguro se evita pensando en el abuso antes de escribir código, no corrigiendo errores después.',
      points: [
        'Haz modelado de amenazas al diseñar cada función.',
        'Escribe casos de abuso, no solo casos de uso.',
        'No confíes en nada que controle el cliente: precios, descuentos, roles.',
        'Pon límites en el servidor: cantidades, cupones, intentos.'
      ],
      code: [],
      actors: { tienda: PROTEGIDA }
    }
  ]
};
