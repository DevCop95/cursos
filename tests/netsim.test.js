import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNetwork, runCommand, deliver, ipToInt, intToIp, parseCidr, exportNetState, importNetState } from '../js/lib/netsim.js';

// Red de ejemplo (no es la del curso): dos PCs en un switch, un router y, al otro lado, un servidor DNS y uno web.
const spec = () => ({
  devices: [
    { id: 'pc1', name: 'PC1', type: 'pc', ifaces: [{ name: 'eth0', cidr: '192.168.1.10/24', seg: 'lan1' }], gateway: '192.168.1.1', dns: '10.0.0.53' },
    { id: 'pc2', name: 'PC2', type: 'pc', ifaces: [{ name: 'eth0', cidr: '192.168.1.11/24', seg: 'lan1' }], dns: '10.0.0.53' },
    { id: 'sw1', name: 'SW1', type: 'switch' },
    { id: 'r1', name: 'R1', type: 'router', ifaces: [{ name: 'eth0', cidr: '192.168.1.1/24', seg: 'lan1' }, { name: 'eth1', cidr: '10.0.0.1/24', seg: 'lan2' }] },
    { id: 'sw2', name: 'SW2', type: 'switch' },
    { id: 'dns', name: 'DNS', type: 'server', ifaces: [{ name: 'eth0', cidr: '10.0.0.53/24', seg: 'lan2' }], gateway: '10.0.0.1',
      services: [{ proto: 'udp', port: 53, process: 'named' }], records: { 'web.test': '10.0.0.20', 'otro.test': '10.0.0.99' } },
    { id: 'web', name: 'Web', type: 'server', ifaces: [{ name: 'eth0', cidr: '10.0.0.20/24', seg: 'lan2' }], gateway: '10.0.0.1', dns: '10.0.0.53',
      services: [
        { proto: 'tcp', port: 22, process: 'sshd' },
        { proto: 'tcp', port: 80, process: 'nginx', http: { routes: { '/': { status: 200, headers: [['Content-Type', 'text/html']], body: '<h1>Hola</h1>' } } } },
        { proto: 'tcp', port: 443, process: 'nginx', http: { routes: { '/': { status: 200, headers: [['Content-Type', 'text/html']], body: '<h1>Hola seguro</h1>' } } },
          tls: { subject: 'CN=web.test', issuer: 'CN=Ejemplo CA', notBefore: 'Jan  1 00:00:00 2026 GMT', notAfter: 'Dec 31 23:59:59 2026 GMT' } }
      ] }
  ],
  segments: { lan1: { switch: 'sw1' }, lan2: { switch: 'sw2' } },
  links: [['pc1', 'sw1'], ['pc2', 'sw1'], ['sw1', 'r1'], ['r1', 'sw2'], ['sw2', 'dns'], ['sw2', 'web']]
});
const run = (net, dev, cmd) => runCommand(net, dev, cmd);
const text = r => r.lines.join('\n');

test('direcciones IPv4: conversión y CIDR', () => {
  assert.equal(intToIp(ipToInt('192.168.1.10')), '192.168.1.10');
  assert.equal(ipToInt('300.1.1.1'), null);
  assert.deepEqual(parseCidr('10.0.0.20/24'), { ip: ipToInt('10.0.0.20'), prefix: 24 });
  assert.equal(parseCidr('10.0.0.20/33'), null);
  assert.equal(parseCidr('10.0.0.20'), null);
});

test('ip a e ip route con el formato de Linux', () => {
  const net = createNetwork(spec());
  assert.match(text(run(net, 'pc1', 'ip a')), /inet 192\.168\.1\.10\/24 brd 192\.168\.1\.255 scope global eth0/);
  assert.deepEqual(run(net, 'pc1', 'ip route').lines, ['default via 192.168.1.1 dev eth0', '192.168.1.0/24 dev eth0 proto kernel scope link src 192.168.1.10']);
  assert.deepEqual(run(net, 'pc2', 'ip r').lines, ['192.168.1.0/24 dev eth0 proto kernel scope link src 192.168.1.11']);
});

test('ping por el switch y por el router (ttl 63), con los tramos para animar', () => {
  const net = createNetwork(spec());
  const lan = run(net, 'pc1', 'ping 192.168.1.11');
  assert.equal(lan.event.ok, true);
  assert.deepEqual(lan.legs[0].path, ['pc1', 'sw1', 'pc2']);
  assert.match(lan.lines[1], /ttl=64/);
  const wan = run(net, 'pc1', 'ping -c 2 10.0.0.20');
  assert.deepEqual(wan.legs.map(l => [l.kind, l.path.join('>')]), [['go', 'pc1>sw1>r1>sw2>web'], ['back', 'web>sw2>r1>sw1>pc1']]);
  assert.match(wan.lines[1], /ttl=63/);
  assert.match(text(wan), /2 packets transmitted, 2 received, 0% packet loss/);
});

test('sin puerta de enlace no sale de su red; al ponerla, llega', () => {
  const net = createNetwork(spec());
  assert.deepEqual(run(net, 'pc2', 'ping 10.0.0.20').lines, ['ping: connect: Network is unreachable']);
  assert.equal(run(net, 'pc2', 'ip route add default via 10.0.0.1').lines[0], 'Error: Nexthop has invalid gateway.');
  assert.deepEqual(run(net, 'pc2', 'ip route add default via 192.168.1.1').lines, []);
  assert.equal(run(net, 'pc2', 'ip route add default via 192.168.1.1').lines[0], 'RTNETLINK answers: File exists');
  assert.equal(run(net, 'pc2', 'ping 10.0.0.20').event.ok, true);
});

test('el destino sin ruta de vuelta: llegan los paquetes pero no las respuestas', () => {
  const net = createNetwork(spec());
  run(net, 'web', 'ip route del default');
  const r = run(net, 'pc1', 'ping 10.0.0.20');
  assert.equal(r.event.reason, 'timeout');
  assert.deepEqual(r.legs.map(l => l.ok), [true, false]);
  assert.match(text(r), /4 packets transmitted, 0 received, 100% packet loss/);
  assert.match(text(run(net, 'pc1', 'curl http://10.0.0.20/')), /curl: \(28\) .*Timeout was reached/);
});

test('equipos que no existen: Host Unreachable desde el propio equipo o desde el router; Net Unreachable', () => {
  const net = createNetwork(spec());
  assert.match(run(net, 'pc1', 'ping -c 1 192.168.1.99').lines[1], /From 192\.168\.1\.10 icmp_seq=1 Destination Host Unreachable/);
  assert.match(run(net, 'pc1', 'ping -c 1 10.0.0.99').lines[1], /From 192\.168\.1\.1 icmp_seq=1 Destination Host Unreachable/);
  assert.match(run(net, 'pc1', 'ping -c 1 172.16.0.1').lines[1], /From 192\.168\.1\.1 icmp_seq=1 Destination Net Unreachable/);
});

test('IP mal puesta y PC usado como puerta de enlace', () => {
  const net = createNetwork(spec());
  run(net, 'pc2', 'ip addr del 192.168.1.11/24 dev eth0');
  run(net, 'pc2', 'ip addr add 192.168.2.11/24 dev eth0');
  assert.equal(run(net, 'pc2', 'ping 192.168.1.10').lines[0], 'ping: connect: Network is unreachable');
  assert.equal(run(net, 'pc2', 'ip addr add 192.168.1.11/24 dev eth9').lines[0], 'Cannot find device "eth9"');
  run(net, 'pc2', 'ip addr del 192.168.2.11/24 dev eth0');
  run(net, 'pc2', 'ip addr add 192.168.1.11/24 dev eth0');
  run(net, 'pc2', 'ip route add default via 192.168.1.10');
  const r = run(net, 'pc2', 'ping 10.0.0.20');
  assert.equal(r.event.reason, 'not-router');
  assert.match(text(r), /0 received, 100% packet loss/);
});

test('traceroute: un salto por el router y luego el destino', () => {
  const net = createNetwork(spec());
  const r = run(net, 'pc1', 'traceroute web.test');
  assert.match(r.lines[0], /traceroute to web\.test \(10\.0\.0\.20\), 30 hops max/);
  assert.match(r.lines[1], /^ 1 {2}192\.168\.1\.1 \(192\.168\.1\.1\)/);
  assert.match(r.lines[2], /^ 2 {2}web\.test \(10\.0\.0\.20\)/);
  assert.equal(r.event.ok, true);
  run(net, 'web', 'ip route del default');
  const lost = run(net, 'pc1', 'traceroute 10.0.0.20');
  assert.match(lost.lines[2], /^ 2 {2}\* \* \*$/);
  assert.equal(lost.event.ok, false);
});

test('DNS: resolv.conf, dig (respuesta y NXDOMAIN), dig +short y nombres en ping', () => {
  const net = createNetwork(spec());
  assert.deepEqual(run(net, 'pc1', 'cat /etc/resolv.conf').lines, ['nameserver 10.0.0.53']);
  const d = run(net, 'pc1', 'dig web.test');
  assert.match(text(d), /status: NOERROR/);
  assert.match(text(d), /web\.test\.\t\t300\tIN\tA\t10\.0\.0\.20/);
  assert.match(text(d), /;; SERVER: 10\.0\.0\.53#53/);
  assert.deepEqual(d.legs.map(l => l.kind), ['dns', 'dns-back']);
  assert.equal(d.event.ok, true);
  assert.match(text(run(net, 'pc1', 'dig nada.test')), /status: NXDOMAIN/);
  assert.deepEqual(run(net, 'pc1', 'dig +short web.test').lines, ['10.0.0.20']);
  const p = run(net, 'pc1', 'ping -c 1 web.test');
  assert.match(p.lines[1], /64 bytes from web\.test \(10\.0\.0\.20\)/);
  assert.deepEqual(p.legs.map(l => l.kind), ['dns', 'dns-back', 'go', 'back']);
  assert.equal(run(net, 'pc1', 'ping nada.test').lines[0], 'ping: nada.test: Name or service not known');
  // PC2 tiene DNS configurado pero no sabe llegar a él (sin puerta de enlace).
  assert.equal(run(net, 'pc2', 'ping web.test').lines[0], 'ping: web.test: Temporary failure in name resolution');
  assert.match(text(run(net, 'pc2', 'dig web.test')), /no servers could be reached/);
});

test('ss muestra lo que escucha el equipo; nc prueba puertos abiertos, cerrados y rangos', () => {
  const net = createNetwork(spec());
  const ss = text(run(net, 'web', 'ss -tlnp'));
  assert.match(ss, /LISTEN .*0\.0\.0\.0:80 .*users:\(\("nginx"/);
  assert.doesNotMatch(ss, /:53 /);
  assert.match(text(run(net, 'dns', 'ss -ulnp')), /UNCONN .*0\.0\.0\.0:53/);
  assert.equal(run(net, 'pc1', 'nc -zv web.test 80').lines[0], 'Connection to web.test (10.0.0.20) 80 port [tcp/http] succeeded!');
  const closed = run(net, 'pc1', 'nc -zv 10.0.0.20 3306');
  assert.equal(closed.lines[0], 'nc: connect to 10.0.0.20 port 3306 (tcp) failed: Connection refused');
  assert.equal(closed.event.reason, 'refused');
  const range = run(net, 'pc1', 'nc -zv web.test 1-100');
  assert.deepEqual(range.event.open, [22, 80]);
  assert.match(run(net, 'pc1', 'nc -zuv 10.0.0.53 53').lines[0], /\[udp\/domain\] succeeded!/);
  assert.match(run(net, 'pc1', 'nc web.test 80').lines[0], /nc -zv/);
});

test('curl: cuerpo, cabeceras (-I), detalle (-v), HTTPS y errores', () => {
  const net = createNetwork(spec());
  assert.deepEqual(run(net, 'pc1', 'curl http://web.test/').lines, ['<h1>Hola</h1>']);
  const head = run(net, 'pc1', 'curl -I http://web.test/');
  assert.equal(head.lines[0], 'HTTP/1.1 200 OK');
  assert.match(text(head), /Server: nginx\/1\.24\.0/);
  const v = text(run(net, 'pc1', 'curl -v http://web.test/'));
  assert.match(v, /> GET \/ HTTP\/1\.1\n> Host: web\.test/);
  assert.match(v, /< HTTP\/1\.1 200 OK/);
  const s = run(net, 'pc1', 'curl -v https://web.test/');
  assert.match(text(s), /\*  issuer: CN=Ejemplo CA/);
  assert.equal(s.event.ok, true);
  assert.match(text(run(net, 'pc1', 'curl http://web.test/nada')), /404 Not Found/);
  assert.match(text(run(net, 'pc1', 'curl http://web.test:8080/')), /curl: \(7\) Failed to connect to web\.test port 8080 .*Couldn't connect to server/);
  assert.match(text(run(net, 'pc1', 'curl http://nada.test/')), /curl: \(6\) Could not resolve host: nada\.test/);
  assert.match(text(run(net, 'pc1', 'curl https://web.test:80/')), /wrong version number/);
});

test('openssl s_client muestra el certificado; contra un puerto sin TLS, error', () => {
  const net = createNetwork(spec());
  const r = run(net, 'pc1', 'openssl s_client -connect web.test:443');
  assert.match(text(r), /0 s:CN = web\.test\n {3}i:CN = Ejemplo CA/);
  assert.equal(r.event.ok, true);
  assert.match(text(run(net, 'pc1', 'openssl s_client -connect web.test:80')), /wrong version number/);
  assert.match(text(run(net, 'pc1', 'openssl s_client -connect web.test:8443')), /connect:errno=111/);
});

test('guardar y restaurar los cambios del alumno; lo inválido se ignora', () => {
  const net = createNetwork(spec());
  run(net, 'pc2', 'ip route add default via 192.168.1.1');
  const saved = JSON.parse(JSON.stringify(exportNetState(net)));
  const net2 = createNetwork(spec());
  assert.equal(importNetState(net2, saved), true);
  assert.equal(run(net2, 'pc2', 'ping 10.0.0.20').event.ok, true);
  const net3 = createNetwork(spec());
  importNetState(net3, { pc2: { a: { eth0: ['nada', '192.168.1.11/24'] }, r: [['default', '8.8.8.8', 'eth0'], ['x']] }, sw1: { a: {} } });
  assert.deepEqual(run(net3, 'pc2', 'ip r').lines, ['192.168.1.0/24 dev eth0 proto kernel scope link src 192.168.1.11']);
  assert.equal(importNetState(net3, null), false);
});

test('comandos desconocidos, ayuda y obsoletos', () => {
  const net = createNetwork(spec());
  assert.equal(run(net, 'pc1', 'nmap 10.0.0.20').lines[0], 'nmap: command not found');
  assert.match(text(run(net, 'pc1', 'help')), /openssl s_client/);
  assert.match(run(net, 'pc1', 'ifconfig').lines[0], /ip a/);
  assert.match(run(net, 'pc1', 'netstat -tlnp').lines[0], /ss -tlnp/);
  assert.equal(run(net, 'pc1', 'ping -c 0 10.0.0.20').lines[0], 'ping: bad number of packets to transmit.');
  assert.equal(run(net, 'sw1', 'ip a').lines[0], 'Este equipo no tiene consola.');
  assert.equal(run(net, 'pc1', 'sudo ip r').event.kind, 'ip-route-show');
  assert.equal(deliver(net, net.devices.get('pc1'), ipToInt('127.0.0.1')).ok, true);
});
