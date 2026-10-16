// Prototipo del laboratorio de redes: una lección de muestra con la ventana de la red (js/views/net-lab.js).
// El curso de verdad (con progreso, preguntas y reto) vive en el aula; esto es solo para probar la ventana.
import { openNetLab } from '/js/views/net-lab.js?v=dev101x-v105';

const network = {
  spec: {
    devices: [
      { id: 'pc1', name: 'PC1', type: 'pc', ifaces: [{ name: 'eth0', cidr: '192.168.1.10/24', seg: 'lan1' }], gateway: '192.168.1.1' },
      { id: 'pc2', name: 'PC2', type: 'pc', ifaces: [{ name: 'eth0', cidr: '192.168.1.11/24', seg: 'lan1' }] },
      { id: 'sw1', name: 'SW1', type: 'switch' },
      { id: 'r1', name: 'R1', type: 'router', ifaces: [{ name: 'eth0', cidr: '192.168.1.1/24', seg: 'lan1' }, { name: 'eth1', cidr: '10.0.0.1/24', seg: 'lan2' }] },
      { id: 'srv', name: 'Servidor', type: 'server', ifaces: [{ name: 'eth0', cidr: '10.0.0.20/24', seg: 'lan2' }], gateway: '10.0.0.1' }
    ],
    segments: { lan1: { switch: 'sw1' }, lan2: {} },
    links: [['pc1', 'sw1'], ['pc2', 'sw1'], ['sw1', 'r1'], ['r1', 'srv']]
  },
  zones: [{ label: 'Red 192.168.1.0/24', members: ['pc1', 'pc2', 'sw1'] }, { label: 'Red 10.0.0.0/24', members: ['srv'] }],
  layout: {
    wide: { w: 760, h: 300, pos: { pc1: [80, 80], pc2: [80, 222], sw1: [270, 151], r1: [470, 151], srv: [670, 151] } },
    narrow: { w: 340, h: 476, pos: { pc1: [80, 60], pc2: [260, 60], sw1: [170, 190], r1: [170, 296], srv: [170, 410] }, side: { sw1: 'right', r1: 'right', srv: 'right' }, zoneLabel: ['top', 'bottom'] }
  },
  start: 'pc1'
};

const TASKS = [
  { text: 'En PC1, mira su dirección IP.', hint: 'ip a', done: e => e.device === 'pc1' && e.kind === 'ip-addr-show' },
  { text: 'Desde PC1, haz ping a PC2 (192.168.1.11): misma red, solo pasa por el switch.', hint: 'ping 192.168.1.11', done: e => e.device === 'pc1' && e.kind === 'ping' && e.ok && e.target === '192.168.1.11' },
  { text: 'Desde PC1, haz ping al Servidor (10.0.0.20): otra red, sale por el router.', hint: 'ping 10.0.0.20', done: e => e.device === 'pc1' && e.kind === 'ping' && e.ok && e.target === '10.0.0.20' },
  { text: 'Pulsa PC2 y mira su tabla de rutas. ¿Qué le falta comparado con PC1?', hint: 'ip route', done: e => e.device === 'pc2' && e.kind === 'ip-route-show' },
  { text: 'Arregla PC2: ponle como puerta de enlace el router y haz ping al Servidor.', hint: 'ip route add default via 192.168.1.1  y después  ping 10.0.0.20', done: e => e.device === 'pc2' && e.kind === 'ping' && e.ok && e.target === '10.0.0.20' }
];
const done = TASKS.map(() => false);

document.querySelector('[data-open-net]').addEventListener('click', () => openNetLab({
  key: 'prototipo',
  title: 'Tu primera red',
  network,
  tasks: () => TASKS.map((t, i) => ({ text: t.text, hint: t.hint, done: done[i] })),
  onEvent: ev => TASKS.forEach((t, i) => { if (!done[i] && t.done(ev)) done[i] = true; }),
  extra: () => (done.every(Boolean) ? { text: 'Red funcionando: PC2 ya llega al servidor a través del router.' } : null)
}));
