/**
 * Motor del laboratorio de redes: varios equipos (PC, switch, router, servidor) con interfaces, direcciones IPv4,
 * rutas, DNS y servicios, que responden como Linux. Sin DOM: lo usan la ventana de la red (js/views/net-lab.js)
 * y las pruebas (tests/netsim.test.js). Cada comando devuelve el texto de la consola, los tramos que recorre el
 * paquete (para animarlo) y un evento con el que el aula comprueba los pasos de la lección.
 *
 * Modelo simplificado a propósito (es para aprender):
 *  - Un "segmento" es una red física: los equipos conectados al mismo switch, o un cable directo.
 *  - Un equipo entrega un paquete si la dirección es suya; si no, busca la ruta más específica (prefijo más
 *    largo). Si la ruta tiene "via", el siguiente salto es esa puerta de enlace; si no, el propio destino.
 *  - El siguiente salto tiene que estar en el mismo segmento (ARP). Solo los routers reenvían paquetes ajenos.
 *  - Toda conversación necesita ida y vuelta: si el destino no sabe volver, se pierden las respuestas.
 *  - Un puerto TCP/UDP sin servicio responde "Connection refused"; los nombres se resuelven con el servidor DNS
 *    de /etc/resolv.conf (registros A de su zona).
 */

// ---------- Direcciones IPv4 ----------
export function ipToInt(ip) {
  const parts = String(ip).split('.');
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p) || Number(p) > 255) return null;
    n = n * 256 + Number(p);
  }
  return n;
}
export const intToIp = n => [24, 16, 8, 0].map(s => (n >>> s) & 255).join('.');
const maskOf = prefix => (prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0);
const netOf = (ip, prefix) => (ip & maskOf(prefix)) >>> 0;
const inNet = (ip, net, prefix) => netOf(ip, prefix) === netOf(net, prefix);
const broadcastOf = (ip, prefix) => (netOf(ip, prefix) | (~maskOf(prefix) >>> 0)) >>> 0;
const LOOPBACK = ipToInt('127.0.0.1');

export function parseCidr(text) {
  const m = /^(\d{1,3}(?:\.\d{1,3}){3})\/(\d{1,2})$/.exec(String(text || '').trim());
  if (!m || Number(m[2]) > 32) return null;
  const ip = ipToInt(m[1]);
  return ip === null ? null : { ip, prefix: Number(m[2]) };
}
const cidrText = (ip, prefix) => `${intToIp(ip)}/${prefix}`;
const macOf = (devIndex, ifIndex) => `02:42:0a:${(devIndex + 16).toString(16).padStart(2, '0')}:00:${(ifIndex + 1).toString(16).padStart(2, '0')}`;
const PORT_NAMES = { 21: 'ftp', 22: 'ssh', 23: 'telnet', 25: 'smtp', 53: 'domain', 80: 'http', 110: 'pop3', 143: 'imap', 443: 'https', 3306: 'mysql', 5432: 'postgresql', 8080: 'http-alt' };

// ---------- Red ----------
/**
 * spec = {
 *   devices: [{ id, name, type: 'pc'|'router'|'switch'|'server', ifaces: [{ name, cidr, seg }], gateway?, dns?,
 *               services?: [{ proto: 'tcp'|'udp', port, process, pid?, http?: { routes: { '/': { status, headers, body } } },
 *                             tls?: { subject, issuer, notBefore, notAfter } }],
 *               records?: { 'web.lab': '10.0.0.20' } }],   // zona del servidor DNS
 *   segments: { <seg>: { switch?: <id del switch> } },
 *   links: [[idA, idB], …]   // cables que se dibujan
 * }
 */
export function createNetwork(spec) {
  const devices = new Map();
  spec.devices.forEach((d, i) => {
    const dev = {
      id: d.id, name: d.name, type: d.type, index: i,
      ifaces: (d.ifaces || []).map((f, k) => {
        const c = f.cidr ? parseCidr(f.cidr) : null;
        return { name: f.name, seg: f.seg, mac: macOf(i, k), addrs: c ? [c] : [] };
      }),
      routes: [], // estáticas: { dest, prefix, via, dev }
      dns: d.dns ? ipToInt(d.dns) : null,
      services: (d.services || []).map(s => ({ ...s, proto: s.proto || 'tcp', port: Number(s.port) })),
      records: Object.fromEntries(Object.entries(d.records || {}).map(([k, v]) => [k.toLowerCase().replace(/\.$/, ''), ipToInt(v)]))
    };
    if (d.gateway) {
      const via = ipToInt(d.gateway);
      const out = dev.ifaces.find(f => f.addrs.some(a => inNet(via, a.ip, a.prefix)));
      if (out) dev.routes.push({ dest: 0, prefix: 0, via, dev: out.name });
    }
    devices.set(d.id, dev);
  });
  return { devices, segments: spec.segments || {}, links: spec.links || [] };
}

const ownsIp = (dev, ip) => ip === LOOPBACK || dev.ifaces.some(f => f.addrs.some(a => a.ip === ip));
const findOwner = (net, ip) => [...net.devices.values()].find(d => d.type !== 'switch' && d.ifaces.some(f => f.addrs.some(a => a.ip === ip)));

// Rutas del equipo: las de sus redes conectadas (kernel) y las estáticas.
function routeTable(dev) {
  const kernel = [];
  dev.ifaces.forEach(f => f.addrs.forEach(a => kernel.push({ dest: netOf(a.ip, a.prefix), prefix: a.prefix, via: null, dev: f.name, src: a.ip, kernel: true })));
  return [...dev.routes, ...kernel];
}

function lookup(dev, dst) {
  let best = null;
  for (const r of routeTable(dev)) {
    if (inNet(dst, r.dest, r.prefix) && (!best || r.prefix > best.prefix)) best = r;
  }
  if (!best) return null;
  const iface = dev.ifaces.find(f => f.name === best.dev);
  // Dirección de origen: la de la interfaz de salida que comparte red con el siguiente salto (o la primera).
  const hop = best.via ?? dst;
  const addr = iface.addrs.find(a => inNet(hop, a.ip, a.prefix)) || iface.addrs[0];
  return { route: best, iface, src: addr ? addr.ip : null };
}

// Equipos por los que pasa el cable entre dos equipos del mismo segmento (con el switch en medio si lo hay).
function hopPath(net, seg, b) {
  const sw = net.segments[seg] && net.segments[seg].switch;
  return sw ? [sw, b.id] : [b.id];
}

/** Lleva un paquete de `from` hasta `dst`. Devuelve { ok, path, routers, reason, at }. */
export function deliver(net, from, dst) {
  let cur = from;
  const path = [cur.id];
  let routers = 0;
  for (let ttl = 0; ttl < 16; ttl++) {
    if (ownsIp(cur, dst)) return { ok: true, path, routers, at: cur.id };
    const r = lookup(cur, dst);
    if (!r) return { ok: false, path, routers, at: cur.id, reason: cur === from ? 'no-route' : 'router-no-route' };
    const hop = r.route.via ?? dst;
    const next = [...net.devices.values()].find(d => d !== cur && d.ifaces.some(f => f.seg === r.iface.seg && f.addrs.some(a => a.ip === hop)));
    if (!next) return { ok: false, path, routers, at: cur.id, reason: 'no-arp', hop };
    path.push(...hopPath(net, r.iface.seg, next));
    if (ownsIp(next, dst)) return { ok: true, path, routers, at: next.id };
    if (next.type !== 'router') return { ok: false, path, routers, at: next.id, reason: 'not-router' };
    routers++;
    cur = next;
  }
  return { ok: false, path, routers, at: cur.id, reason: 'ttl' };
}

// IP de la interfaz del equipo donde se quedó el paquete, la que mira hacia quien se lo mandó.
function facingIp(net, path, atId) {
  const dev = net.devices.get(atId);
  const i = path.lastIndexOf(atId);
  const prev = i > 0 ? net.devices.get(path[i - 1]) : null;
  let f = null;
  if (prev && prev.type === 'switch') f = dev.ifaces.find(x => net.segments[x.seg] && net.segments[x.seg].switch === prev.id);
  else if (prev) f = dev.ifaces.find(x => prev.ifaces.some(p => p.seg === x.seg));
  if (!f || !f.addrs.length) f = dev.ifaces.find(x => x.addrs.length);
  return f ? f.addrs[0].ip : 0;
}

/**
 * Conversación de ida y vuelta de `src` con `dstIp` (opcionalmente con un puerto TCP/UDP).
 * Devuelve { ok, reason, legs, dst, svc, src, back } · reason: no-route | no-arp | router-no-route | not-router |
 * refused (puerto sin servicio) | timeout (el destino no sabe volver).
 */
function exchange(net, src, dstIp, { proto, port, kind = 'go' } = {}) {
  if (ownsIp(src, dstIp)) {
    const svc = port ? src.services.find(s => s.proto === proto && s.port === port) : null;
    return { ok: !port || Boolean(svc), reason: port && !svc ? 'refused' : null, legs: [], dst: src, svc, srcIp: dstIp, back: { routers: 0 } };
  }
  const r = lookup(src, dstIp);
  if (!r) return { ok: false, reason: 'no-route', legs: [] };
  const go = deliver(net, src, dstIp);
  const backKind = kind === 'dns' ? 'dns-back' : 'back';
  if (!go.ok) return { ok: false, reason: go.reason, legs: [{ path: go.path, ok: false, kind }], go, srcIp: r.src };
  const dst = net.devices.get(go.at);
  const svc = port ? dst.services.find(s => s.proto === proto && s.port === port) : null;
  const back = deliver(net, dst, r.src);
  const legs = [{ path: go.path, ok: true, kind }, { path: back.path, ok: back.ok, kind: backKind }];
  if (!back.ok) return { ok: false, reason: 'timeout', legs, dst, srcIp: r.src };
  if (port && !svc) return { ok: false, reason: 'refused', legs, dst, srcIp: r.src, back };
  return { ok: true, legs, dst, svc, srcIp: r.src, back };
}

// ---------- Nombres (DNS) ----------
// Resuelve un nombre con el servidor DNS del equipo. { ip, legs, error: 'no-dns'|'unreachable'|'refused'|'nxdomain', server }
function resolve(net, dev, name, server = dev.dns) {
  const asIp = ipToInt(name);
  if (asIp !== null) return { ip: asIp, legs: [] };
  const n = String(name || '').toLowerCase().replace(/\.$/, '');
  if (n === 'localhost') return { ip: LOOPBACK, legs: [] };
  if (n === dev.name.toLowerCase()) { const a = dev.ifaces.find(f => f.addrs.length); return { ip: a ? a.addrs[0].ip : LOOPBACK, legs: [] }; }
  if (server === null || server === undefined) return { error: 'no-dns', legs: [] };
  const x = exchange(net, dev, server, { proto: 'udp', port: 53, kind: 'dns' });
  if (!x.ok) return { error: x.reason === 'refused' ? 'refused' : 'unreachable', legs: x.legs, server };
  const ip = x.dst.records[n];
  return ip === undefined ? { error: 'nxdomain', legs: x.legs, server } : { ip, legs: x.legs, server };
}

// Nombre de una IP según la zona del servidor DNS del equipo (sin animación: como la caché inversa).
function reverseName(net, dev, ip) {
  const srv = dev.dns !== null ? findOwner(net, dev.dns) : null;
  if (!srv) return null;
  const hit = Object.entries(srv.records).find(([, v]) => v === ip);
  return hit ? hit[0] : null;
}

// ---------- Salida de los comandos (formato de iproute2, ping, dig, ss, nc, curl y openssl de Linux) ----------
function ipAddrText(dev) {
  const out = [
    '1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN',
    '    link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00',
    '    inet 127.0.0.1/8 scope host lo'
  ];
  dev.ifaces.forEach((f, i) => {
    out.push(`${i + 2}: ${f.name}: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc fq_codel state UP`);
    out.push(`    link/ether ${f.mac} brd ff:ff:ff:ff:ff:ff`);
    f.addrs.forEach(a => out.push(`    inet ${cidrText(a.ip, a.prefix)} brd ${intToIp(broadcastOf(a.ip, a.prefix))} scope global ${f.name}`));
  });
  return out;
}

function ipRouteText(dev) {
  return routeTable(dev).sort((a, b) => a.prefix - b.prefix || a.dest - b.dest).map(r => {
    const dest = r.prefix === 0 ? 'default' : cidrText(r.dest, r.prefix);
    return r.kernel
      ? `${dest} dev ${r.dev} proto kernel scope link src ${intToIp(r.src)}`
      : `${dest} via ${intToIp(r.via)} dev ${r.dev}`;
  });
}

const ms = () => (0.3 + Math.random() * 0.9).toFixed(3);
const resolveFailText = (cmd, name, error) => error === 'nxdomain' ? `${cmd}: ${name}: Name or service not known` : `${cmd}: ${name}: Temporary failure in name resolution`;

function pingCmd(net, dev, args) {
  let count = 4;
  const rest = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '-c') { count = Number(args[++i]); if (!Number.isInteger(count) || count < 1 || count > 10) return { lines: ['ping: bad number of packets to transmit.'], event: { kind: 'error' } }; }
    else rest.push(args[i]);
  }
  if (rest.length !== 1) return { lines: ['Uso: ping [-c N] <equipo>'], event: { kind: 'error' } };
  const name = rest[0];
  const res = resolve(net, dev, name);
  const isName = ipToInt(name) === null;
  if (res.error) return { lines: [resolveFailText('ping', name, res.error)], event: { kind: 'ping', name, ok: false, reason: res.error }, legs: res.legs };
  const target = intToIp(res.ip);
  const label = isName ? `${name.toLowerCase()} (${target})` : target;
  const event = { kind: 'ping', target, name: isName ? name.toLowerCase() : undefined };
  const header = `PING ${isName ? name.toLowerCase() : target} (${target}) 56(84) bytes of data.`;
  const stats = (recv, extra = '') => ['', `--- ${isName ? name.toLowerCase() : target} ping statistics ---`, `${count} packets transmitted, ${recv} received,${extra} ${recv ? Math.round((1 - recv / count) * 100) : 100}% packet loss, time ${count * 1000 + 3}ms`];

  const x = exchange(net, dev, res.ip);
  const legs = [...res.legs, ...x.legs];
  if (!x.ok && x.reason === 'no-route') return { lines: ['ping: connect: Network is unreachable'], event: { ...event, ok: false, reason: 'no-route' }, legs };
  if (!x.ok && (x.reason === 'no-arp' || x.reason === 'router-no-route')) {
    const fromIp = x.go.at === dev.id ? x.srcIp : facingIp(net, x.go.path, x.go.at);
    const msg = x.reason === 'router-no-route' ? 'Destination Net Unreachable' : 'Destination Host Unreachable';
    const lines = [header];
    for (let i = 1; i <= count; i++) lines.push(`From ${intToIp(fromIp)} icmp_seq=${i} ${msg}`);
    return { lines: [...lines, ...stats(0, ` +${count} errors,`)], event: { ...event, ok: false, reason: x.reason }, legs };
  }
  if (!x.ok) return { lines: [header, ...stats(0)], event: { ...event, ok: false, reason: x.reason }, legs };
  const ttl = 64 - x.back.routers;
  const times = [];
  const lines = [header];
  for (let i = 1; i <= count; i++) { const t = ms(); times.push(Number(t)); lines.push(`64 bytes from ${label}: icmp_seq=${i} ttl=${ttl} time=${Number(t).toFixed(2)} ms`); }
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  lines.push(...stats(count), `rtt min/avg/max/mdev = ${Math.min(...times).toFixed(3)}/${avg.toFixed(3)}/${Math.max(...times).toFixed(3)}/0.120 ms`);
  return { lines, event: { ...event, ok: true }, legs };
}

function tracerouteCmd(net, dev, args) {
  const name = args.find(a => !a.startsWith('-'));
  if (!name) return { lines: ['Uso: traceroute <equipo>'], event: { kind: 'error' } };
  const res = resolve(net, dev, name);
  if (res.error) return { lines: [`${name}: ${res.error === 'nxdomain' ? 'Name or service not known' : 'Temporary failure in name resolution'}`, `Cannot handle "host" cmdline arg \`${name}' on position 1 (argc 1)`], event: { kind: 'traceroute', ok: false, name }, legs: res.legs };
  const target = intToIp(res.ip);
  const isName = ipToInt(name) === null;
  const event = { kind: 'traceroute', target, name: isName ? name.toLowerCase() : undefined };
  const lines = [`traceroute to ${isName ? name.toLowerCase() : target} (${target}), 30 hops max, 60 byte packets`];
  if (ownsIp(dev, res.ip)) return { lines: [...lines, ` 1  ${dev.name.toLowerCase()} (${target})  0.031 ms  0.009 ms  0.008 ms`], event: { ...event, ok: true }, legs: res.legs };
  const r = lookup(dev, res.ip);
  if (!r) return { lines: [...lines, 'connect: Network is unreachable'], event: { ...event, ok: false }, legs: res.legs };
  const go = deliver(net, dev, res.ip);
  const hops = go.path.filter((id, i) => i > 0 && net.devices.get(id).type !== 'switch');
  let n = 0;
  let reached = false;
  for (const id of hops) {
    n++;
    const hopDev = net.devices.get(id);
    const ip = id === go.at && go.ok ? res.ip : facingIp(net, go.path, id);
    const replies = deliver(net, hopDev, r.src).ok;
    const shown = reverseName(net, dev, ip) || intToIp(ip);
    lines.push(replies ? ` ${n}  ${shown} (${intToIp(ip)})  ${ms()} ms  ${ms()} ms  ${ms()} ms` : ` ${n}  * * *`);
    if (id === go.at && go.ok) reached = replies;
  }
  if (!go.ok || !reached) { for (let k = 0; k < 3; k++) lines.push(` ${++n}  * * *`); lines.push('[LAB] traceroute seguiría probando hasta 30 saltos: aquí se corta.'); }
  const backPath = reached ? deliver(net, net.devices.get(go.at), r.src).path : null;
  const legs = [...res.legs, { path: go.path, ok: go.ok, kind: 'go' }, ...(backPath ? [{ path: backPath, ok: true, kind: 'back' }] : [])];
  return { lines, event: { ...event, ok: reached }, legs };
}

function digCmd(net, dev, args) {
  let server = dev.dns;
  let short = false;
  let name = null;
  for (const a of args) {
    if (a.startsWith('@')) { server = ipToInt(a.slice(1)); if (server === null) return { lines: [`dig: couldn't get address for '${a.slice(1)}': not found`], event: { kind: 'error' } }; }
    else if (a === '+short') short = true;
    else if (/^(A|IN)$/i.test(a)) continue;
    else if (!name) name = a;
  }
  if (!name) return { lines: ['Uso: dig [@servidor] <nombre> [+short]'], event: { kind: 'error' } };
  const n = name.toLowerCase().replace(/\.$/, '');
  const event = { kind: 'dig', name: n };
  if (server === null) return { lines: [';; communications error to 127.0.0.1#53: connection refused', ';; no servers could be reached'], event: { ...event, ok: false, reason: 'no-dns' }, legs: [] };
  const sv = intToIp(server);
  const res = resolve(net, dev, ipToInt(n) !== null ? `${n}.invalid` : n, server);
  if (res.error === 'unreachable' || res.error === 'refused') {
    const why = res.error === 'refused' ? 'connection refused' : 'timed out';
    return { lines: [`;; communications error to ${sv}#53: ${why}`, `;; communications error to ${sv}#53: ${why}`, ';; no servers could be reached'], event: { ...event, ok: false, reason: res.error }, legs: res.legs };
  }
  const answer = res.error ? null : intToIp(res.ip);
  const status = answer ? 'NOERROR' : 'NXDOMAIN';
  if (short) return { lines: answer ? [answer] : [], event: { ...event, ok: Boolean(answer), answer, status }, legs: res.legs };
  const lines = [
    `; <<>> DiG 9.18.28 <<>> ${args.join(' ')}`, ';; global options: +cmd', ';; Got answer:',
    `;; ->>HEADER<<- opcode: QUERY, status: ${answer ? 'NOERROR' : 'NXDOMAIN'}, id: ${4000 + n.length * 37}`,
    `;; flags: qr aa rd ra; QUERY: 1, ANSWER: ${answer ? 1 : 0}, AUTHORITY: 0, ADDITIONAL: 1`, '',
    ';; QUESTION SECTION:', `;${n}.\t\t\tIN\tA`, ''
  ];
  if (answer) lines.push(';; ANSWER SECTION:', `${n}.\t\t300\tIN\tA\t${answer}`, '');
  lines.push(`;; Query time: 1 msec`, `;; SERVER: ${sv}#53(${sv}) (UDP)`, ';; MSG SIZE  rcvd: 56');
  return { lines, event: { ...event, ok: Boolean(answer), answer, status }, legs: res.legs };
}

function catCmd(net, dev, args) {
  const file = args[0] || '';
  if (file === '/etc/resolv.conf') {
    return { lines: dev.dns !== null ? [`nameserver ${intToIp(dev.dns)}`] : ['# sin servidor DNS configurado'], event: { kind: 'resolv' } };
  }
  if (file === '/etc/hosts') return { lines: ['127.0.0.1\tlocalhost', `127.0.1.1\t${dev.name.toLowerCase()}`], event: { kind: 'hosts' } };
  if (file === '/etc/hostname') return { lines: [dev.name.toLowerCase()], event: { kind: 'hostname' } };
  return { lines: [`cat: ${file || '-'}: No such file or directory`], event: { kind: 'error' } };
}

function ssCmd(net, dev, args) {
  const flags = args.filter(a => a.startsWith('-')).join('').replace(/-/g, '');
  const tcp = flags.includes('t') || !flags.includes('u');
  const udp = flags.includes('u');
  const listening = flags.includes('l');
  const proc = flags.includes('p');
  const both = tcp && udp;
  const head = `${both ? 'Netid ' : ''}State   Recv-Q  Send-Q   Local Address:Port    Peer Address:Port${proc ? '  Process' : ''}`;
  if (!listening) return { lines: [head, '[LAB] Sin conexiones abiertas ahora mismo. Usa ss -tlnp para ver los puertos que escuchan.'], event: { kind: 'ss', listening: false } };
  const rows = dev.services
    .filter(s => (s.proto === 'tcp' && tcp) || (s.proto === 'udp' && udp))
    .sort((a, b) => a.proto.localeCompare(b.proto) || a.port - b.port)
    .map(s => {
      const state = s.proto === 'tcp' ? 'LISTEN' : 'UNCONN';
      const local = `0.0.0.0:${s.port}`;
      return `${both ? s.proto.padEnd(6) : ''}${state.padEnd(8)}0       ${s.proto === 'tcp' ? '511' : '0  '}      ${local.padStart(14)}         0.0.0.0:*    ${proc ? `users:(("${s.process}",pid=${s.pid || 700 + s.port % 300},fd=6))` : ''}`.trimEnd();
    });
  return { lines: [head, ...rows], event: { kind: 'ss', listening: true } };
}

function ncCmd(net, dev, args) {
  const flags = args.filter(a => /^-[a-z]+$/i.test(a)).join('').replace(/-/g, '');
  const rest = args.filter(a => !/^-[a-z]+$/i.test(a));
  if (!flags.includes('z')) return { lines: ['[LAB] En este laboratorio usa nc -zv <equipo> <puerto> para comprobar si un puerto está abierto.'], event: { kind: 'error' } };
  if (rest.length !== 2) return { lines: ['Uso: nc -zv <equipo> <puerto>   (o un rango: 20-90)'], event: { kind: 'error' } };
  const [host, portArg] = rest;
  const proto = flags.includes('u') ? 'udp' : 'tcp';
  const m = /^(\d{1,5})(?:-(\d{1,5}))?$/.exec(portArg);
  if (!m) return { lines: [`nc: port number invalid: ${portArg}`], event: { kind: 'error' } };
  const from = Number(m[1]); const to = Number(m[2] || m[1]);
  if (from < 1 || to > 65535 || to < from) return { lines: ['nc: port range not valid'], event: { kind: 'error' } };
  const res = resolve(net, dev, host);
  if (res.error) return { lines: [`nc: getaddrinfo for host "${host}" port ${portArg}: ${res.error === 'nxdomain' ? 'Name or service not known' : 'Temporary failure in name resolution'}`], event: { kind: 'nc', ok: false, reason: res.error }, legs: res.legs };
  const ip = intToIp(res.ip);
  const shown = ipToInt(host) === null ? `${host.toLowerCase()} (${ip})` : ip;
  const pname = p => PORT_NAMES[p] || '*';
  const event = { kind: 'nc', target: ip, port: from, proto };
  if (from === to) {
    const x = exchange(net, dev, res.ip, { proto, port: from });
    const legs = [...res.legs, ...x.legs];
    if (x.ok) return { lines: [`Connection to ${shown} ${from} port [${proto}/${pname(from)}] succeeded!`], event: { ...event, ok: true }, legs };
    const why = { refused: 'failed: Connection refused', timeout: 'timed out: Operation now in progress', 'not-router': 'timed out: Operation now in progress', 'no-route': 'failed: Network is unreachable' }[x.reason] || 'failed: No route to host';
    return { lines: [`nc: connect to ${shown} port ${from} (${proto}) ${why}`], event: { ...event, ok: false, reason: x.reason }, legs };
  }
  // Rango: se muestran los abiertos (como un barrido rápido); el resto rechaza la conexión.
  const probe = exchange(net, dev, res.ip, {});
  if (!probe.ok) return { lines: [`nc: connect to ${shown} port ${from} (${proto}) ${probe.reason === 'timeout' ? 'timed out: Operation now in progress' : 'failed: No route to host'}`], event: { ...event, ok: false, reason: probe.reason }, legs: [...res.legs, ...probe.legs] };
  const open = probe.dst.services.filter(s => s.proto === proto && s.port >= from && s.port <= to).map(s => s.port).sort((a, b) => a - b);
  const lines = open.map(p => `Connection to ${shown} ${p} port [${proto}/${pname(p)}] succeeded!`);
  lines.push(`[LAB] El resto de puertos de ${from} a ${to}: Connection refused.`);
  return { lines, event: { ...event, ok: open.length > 0, range: true, open }, legs: [...res.legs, ...probe.legs] };
}

function parseUrl(raw) {
  const m = /^(?:(https?):\/\/)?([a-z0-9.-]+)(?::(\d{1,5}))?(\/[^\s]*)?$/i.exec(String(raw || ''));
  if (!m) return null;
  const scheme = (m[1] || 'http').toLowerCase();
  return { scheme, host: m[2].toLowerCase(), port: m[3] ? Number(m[3]) : (scheme === 'https' ? 443 : 80), path: m[4] || '/' };
}

// allowFrom (red/prefijo): la ruta solo responde a quien llega desde esa red; al resto, 403.
function httpResponse(svc, path, srcIp) {
  const routes = (svc.http && svc.http.routes) || {};
  let r = routes[path] || routes[path.replace(/\/$/, '')] || { status: 404, reason: 'Not Found', headers: [['Content-Type', 'text/html']], body: '<h1>404 Not Found</h1>' };
  const allow = r.allowFrom ? parseCidr(r.allowFrom) : null;
  if (allow && !inNet(srcIp, allow.ip, allow.prefix)) r = { status: 403, headers: [['Content-Type', 'text/html']], body: '<h1>403 Forbidden</h1>' };
  const reason = r.reason || { 200: 'OK', 301: 'Moved Permanently', 403: 'Forbidden', 404: 'Not Found' }[r.status] || '';
  const body = r.body || '';
  const headers = [['Server', svc.process === 'nginx' ? 'nginx/1.24.0' : svc.process], ...(r.headers || []), ['Content-Length', String(body.length + 1)]];
  return { status: r.status, reason, headers, body };
}

function curlCmd(net, dev, args) {
  const flags = args.filter(a => /^-[a-z]+$/i.test(a) || a === '--head').join('');
  const verbose = /v/.test(flags);
  const head = /I|--head/.test(flags);
  const urlArg = args.find(a => !a.startsWith('-'));
  const url = parseUrl(urlArg);
  if (!url) return { lines: [urlArg ? `curl: (3) URL rejected: Malformed input to a URL function` : 'curl: try \'curl --help\' for more information'], event: { kind: 'error' } };
  const event = { kind: 'curl', scheme: url.scheme, port: url.port, path: url.path, verbose, name: ipToInt(url.host) === null ? url.host : undefined };
  const res = resolve(net, dev, url.host);
  if (res.error) return { lines: [`curl: (6) Could not resolve host: ${url.host}`], event: { ...event, ok: false, reason: res.error }, legs: res.legs };
  const ip = intToIp(res.ip);
  const x = exchange(net, dev, res.ip, { proto: 'tcp', port: url.port });
  const legs = [...res.legs, ...x.legs];
  const pre = verbose ? [`*   Trying ${ip}:${url.port}...`] : [];
  if (!x.ok) {
    const fail = x.reason === 'timeout' || x.reason === 'not-router'
      ? `curl: (28) Failed to connect to ${url.host} port ${url.port} after 3002 ms: Timeout was reached`
      : `curl: (7) Failed to connect to ${url.host} port ${url.port} after 0 ms: ${x.reason === 'refused' ? "Couldn't connect to server" : x.reason === 'no-route' ? 'Network is unreachable' : 'No route to host'}`;
    return { lines: [...pre, fail], event: { ...event, target: ip, ok: false, reason: x.reason }, legs };
  }
  const svc = x.svc;
  if (url.scheme === 'https' && !svc.tls) return { lines: [...pre, ...(verbose ? [`* Connected to ${url.host} (${ip}) port ${url.port}`] : []), 'curl: (35) OpenSSL/3.0.13: error:0A00010B:SSL routines::wrong version number'], event: { ...event, target: ip, ok: false, reason: 'tls' }, legs };
  if (url.scheme === 'http' && svc.tls) return { lines: [...pre, 'curl: (52) Empty reply from server'], event: { ...event, target: ip, ok: false, reason: 'plain-to-tls' }, legs };
  if (!svc.http) return { lines: [...pre, 'curl: (1) Received HTTP/0.9 when not allowed'], event: { ...event, target: ip, ok: false, reason: 'not-http' }, legs };
  const r = httpResponse(svc, url.path, x.srcIp);
  const statusLine = `HTTP/1.1 ${r.status} ${r.reason}`;
  const headerLines = r.headers.map(([k, v]) => `${k}: ${v}`);
  let lines;
  if (verbose) {
    lines = [...pre, `* Connected to ${url.host} (${ip}) port ${url.port}`];
    if (url.scheme === 'https') lines.push('* SSL connection using TLSv1.3 / TLS_AES_256_GCM_SHA384', '* Server certificate:', `*  subject: ${svc.tls.subject}`, `*  issuer: ${svc.tls.issuer}`, '*  SSL certificate verify ok.');
    lines.push(`> ${head ? 'HEAD' : 'GET'} ${url.path} HTTP/1.1`, `> Host: ${url.host}${(url.scheme === 'http' && url.port !== 80) || (url.scheme === 'https' && url.port !== 443) ? ':' + url.port : ''}`, '> User-Agent: curl/8.5.0', '> Accept: */*', '>',
      `< ${statusLine}`, ...headerLines.map(h => `< ${h}`), '<');
    if (!head) lines.push(...r.body.split('\n'));
    lines.push(`* Connection #0 to host ${url.host} left intact`);
  } else if (head) {
    lines = [statusLine, ...headerLines, ''];
  } else {
    lines = r.body.split('\n');
  }
  return { lines, event: { ...event, target: ip, ok: r.status < 400, status: r.status }, legs };
}

function opensslCmd(net, dev, args) {
  if (args[0] !== 's_client') return { lines: ['[LAB] En este laboratorio: openssl s_client -connect <equipo>:443'], event: { kind: 'error' } };
  const i = args.indexOf('-connect');
  const m = i >= 0 ? /^([a-z0-9.-]+):(\d{1,5})$/i.exec(args[i + 1] || '') : null;
  if (!m) return { lines: ['s_client: -connect requiere <equipo>:<puerto>, por ejemplo web.lab:443'], event: { kind: 'error' } };
  const host = m[1].toLowerCase(); const port = Number(m[2]);
  const event = { kind: 'tls', port, name: ipToInt(host) === null ? host : undefined };
  const res = resolve(net, dev, host);
  if (res.error) return { lines: [`BIO_lookup_ex:system lib: ${host}: Name or service not known`, 'connect:errno=0'], event: { ...event, ok: false, reason: res.error }, legs: res.legs };
  const ip = intToIp(res.ip);
  const x = exchange(net, dev, res.ip, { proto: 'tcp', port });
  const legs = [...res.legs, ...x.legs];
  if (!x.ok) {
    const errno = x.reason === 'refused' ? 111 : x.reason === 'timeout' || x.reason === 'not-router' ? 110 : 113;
    return { lines: [`40C7B5F0F47F0000:error:8000006F:system library:BIO_connect:${errno === 111 ? 'Connection refused' : errno === 110 ? 'Connection timed out' : 'No route to host'}`, `connect:errno=${errno}`], event: { ...event, target: ip, ok: false, reason: x.reason }, legs };
  }
  if (!x.svc.tls) return { lines: ['CONNECTED(00000003)', '40C7B5F0F47F0000:error:0A00010B:SSL routines:ssl3_get_record:wrong version number', '---', 'no peer certificate available', '---'], event: { ...event, target: ip, ok: false, reason: 'not-tls' }, legs };
  const t = x.svc.tls;
  const lines = [
    'CONNECTED(00000003)', `depth=1 ${t.issuer.replace(/=/g, ' = ')}`, 'verify return:1', `depth=0 ${t.subject.replace(/=/g, ' = ')}`, 'verify return:1', '---',
    'Certificate chain', ` 0 s:${t.subject.replace(/=/g, ' = ')}`, `   i:${t.issuer.replace(/=/g, ' = ')}`, `   v:NotBefore: ${t.notBefore}; NotAfter: ${t.notAfter}`, '---',
    `Server certificate`, `subject=${t.subject.replace(/=/g, ' = ')}`, `issuer=${t.issuer.replace(/=/g, ' = ')}`, '---',
    'SSL handshake has read 1534 bytes and written 393 bytes', 'Verification: OK', '---', 'New, TLSv1.3, Cipher is TLS_AES_256_GCM_SHA384',
    'Protocol: TLSv1.3', '    Verify return code: 0 (ok)', '---', '[LAB] Conexión cerrada (en un Linux real quedaría abierta esperando que escribas).'
  ];
  return { lines, event: { ...event, target: ip, ok: true, subject: t.subject, issuer: t.issuer }, legs };
}

// ip addr add|del <ip/prefijo> dev <interfaz>   ·   ip route add|del <default|red/prefijo> [via <ip>] [dev <interfaz>]
function ipCommand(dev, args) {
  const [obj = '', verb = 'show', ...rest] = args;
  const isAddr = /^a(ddr(ess)?)?$/.test(obj);
  const isRoute = /^r(oute)?$/.test(obj);
  if (!isAddr && !isRoute) return { lines: [obj ? `Object "${obj}" is unknown, try "ip help".` : 'Uso: ip a · ip route'], event: { kind: 'error' } };
  if (verb === 'show' || verb === 'list' || verb === 'ls') {
    return isAddr ? { lines: ipAddrText(dev), event: { kind: 'ip-addr-show' } } : { lines: ipRouteText(dev), event: { kind: 'ip-route-show' } };
  }
  const opt = name => { const i = rest.indexOf(name); return i >= 0 ? rest[i + 1] : undefined; };

  if (isAddr && (verb === 'add' || verb === 'del')) {
    const c = parseCidr(rest[0]);
    if (!c) return { lines: [`Error: any valid prefix is expected rather than "${rest[0] || ''}".`], event: { kind: 'error' } };
    const ifName = opt('dev');
    const iface = dev.ifaces.find(f => f.name === ifName);
    if (!iface) return { lines: [ifName ? `Cannot find device "${ifName}"` : 'Not enough information: "dev" argument is required.'], event: { kind: 'error' } };
    const i = iface.addrs.findIndex(a => a.ip === c.ip && a.prefix === c.prefix);
    if (verb === 'add') {
      if (i >= 0) return { lines: ['Error: ipv4: Address already assigned.'], event: { kind: 'error' } };
      if (iface.addrs.length >= 4) return { lines: ['[LAB] Máximo 4 direcciones por interfaz en este laboratorio.'], event: { kind: 'error' } };
      iface.addrs.push(c);
      return { lines: [], event: { kind: 'ip-addr-add', cidr: cidrText(c.ip, c.prefix), dev: iface.name }, changed: true };
    }
    if (i < 0) return { lines: ['Error: ipv4: Address not found.'], event: { kind: 'error' } };
    iface.addrs.splice(i, 1);
    // Las rutas que salían por esa red dejan de valer (como en Linux).
    dev.routes = dev.routes.filter(r => r.dev !== iface.name || iface.addrs.some(a => inNet(r.via, a.ip, a.prefix)));
    return { lines: [], event: { kind: 'ip-addr-del', cidr: cidrText(c.ip, c.prefix), dev: iface.name }, changed: true };
  }

  if (isRoute && (verb === 'add' || verb === 'del')) {
    const target = rest[0];
    const dest = target === 'default' ? { ip: 0, prefix: 0 } : parseCidr(target);
    if (!dest) return { lines: [`Error: any valid prefix is expected rather than "${target || ''}".`], event: { kind: 'error' } };
    const destNet = netOf(dest.ip, dest.prefix);
    if (verb === 'del') {
      const i = dev.routes.findIndex(r => r.dest === destNet && r.prefix === dest.prefix);
      if (i < 0) return { lines: ['RTNETLINK answers: No such process'], event: { kind: 'error' } };
      dev.routes.splice(i, 1);
      return { lines: [], event: { kind: 'ip-route-del', dest: target }, changed: true };
    }
    const viaText = opt('via');
    const via = viaText !== undefined ? ipToInt(viaText) : null;
    if (viaText !== undefined && via === null) return { lines: [`Error: inet address is expected rather than "${viaText}".`], event: { kind: 'error' } };
    if (via === null) return { lines: ['Error: falta "via <puerta de enlace>" (en este laboratorio).'], event: { kind: 'error' } };
    const out = dev.ifaces.find(f => (!opt('dev') || f.name === opt('dev')) && f.addrs.some(a => inNet(via, a.ip, a.prefix)));
    if (!out) return { lines: ['Error: Nexthop has invalid gateway.'], event: { kind: 'error' } };
    if (dev.routes.some(r => r.dest === destNet && r.prefix === dest.prefix)) return { lines: ['RTNETLINK answers: File exists'], event: { kind: 'error' } };
    if (dev.routes.length >= 12) return { lines: ['[LAB] Máximo 12 rutas por equipo en este laboratorio.'], event: { kind: 'error' } };
    dev.routes.push({ dest: destNet, prefix: dest.prefix, via, dev: out.name });
    return { lines: [], event: { kind: 'ip-route-add', dest: target, via: intToIp(via) }, changed: true };
  }
  return { lines: [`Command "${verb}" is unknown, try "ip ${obj} help".`], event: { kind: 'error' } };
}

export const HELP = [
  'Comandos de este laboratorio:',
  '  ip a  ·  ip route                       tus direcciones IP y tu tabla de rutas',
  '  ip addr add|del <ip/prefijo> dev eth0  poner o quitar una dirección',
  '  ip route add default via <ip>          poner la puerta de enlace (del: quitarla)',
  '  ping [-c N] <equipo>                   ¿llego a ese equipo? (aquí envía 4 paquetes)',
  '  traceroute <equipo>                    por qué routers pasa el camino',
  '  cat /etc/resolv.conf  ·  dig <nombre>  servidor DNS y consultas de nombres',
  '  ss -tlnp  ·  ss -ulnp                  puertos que escucha este equipo',
  '  nc -zv <equipo> <puerto|rango>         ¿está abierto ese puerto?',
  '  curl [-v|-I] http(s)://<equipo>/       hablar HTTP con un servidor web',
  '  openssl s_client -connect <equipo>:443 ver el certificado HTTPS',
  '  hostname · clear · help'
];

/** Ejecuta una línea en la consola de un equipo. Devuelve { lines, event, legs, clear?, changed? }. */
export function runCommand(net, deviceId, line) {
  const dev = net.devices.get(deviceId);
  const text = String(line || '').trim().replace(/\s+/g, ' ').slice(0, 300);
  if (!dev || dev.type === 'switch') return { lines: ['Este equipo no tiene consola.'], event: { kind: 'error' } };
  if (!text) return { lines: [], event: { kind: 'empty' } };
  const [rawCmd, ...args] = text.split(' ');
  const cmd = rawCmd.replace(/^sudo$/, '') || args.shift() || '';
  let res;
  switch (cmd) {
    case 'help': res = { lines: HELP, event: { kind: 'help' } }; break;
    case 'hostname': res = { lines: [dev.name.toLowerCase()], event: { kind: 'hostname' } }; break;
    case 'clear': res = { lines: [], clear: true, event: { kind: 'clear' } }; break;
    case 'ip': res = ipCommand(dev, args); break;
    case 'ifconfig': res = { lines: ['ifconfig está obsoleto en Linux: usa "ip a".'], event: { kind: 'error' } }; break;
    case 'route': res = { lines: ['route está obsoleto en Linux: usa "ip route".'], event: { kind: 'error' } }; break;
    case 'ping': res = pingCmd(net, dev, args); break;
    case 'traceroute': case 'tracepath': res = tracerouteCmd(net, dev, args); break;
    case 'dig': res = digCmd(net, dev, args); break;
    case 'nslookup': res = { lines: ['[LAB] Aquí usamos dig, que muestra la respuesta completa del servidor DNS: dig <nombre>'], event: { kind: 'error' } }; break;
    case 'cat': res = catCmd(net, dev, args); break;
    case 'ss': res = ssCmd(net, dev, args); break;
    case 'netstat': res = { lines: ['netstat está obsoleto en Linux: usa "ss -tlnp".'], event: { kind: 'error' } }; break;
    case 'nc': case 'ncat': case 'netcat': res = ncCmd(net, dev, args); break;
    case 'curl': res = curlCmd(net, dev, args); break;
    case 'openssl': res = opensslCmd(net, dev, args); break;
    default: res = { lines: [`${cmd}: command not found`], event: { kind: 'unknown' } };
  }
  res.event = { ...res.event, device: deviceId, cmd: text };
  res.legs = res.legs || [];
  return res;
}

/** Direcciones de un equipo como texto (para las etiquetas del dibujo). */
export const addressesOf = dev => dev.ifaces.flatMap(f => f.addrs.map(a => cidrText(a.ip, a.prefix)));

// ---------- Guardar y restaurar lo que el alumno cambió (direcciones y rutas) ----------
export function exportNetState(net) {
  const out = {};
  net.devices.forEach(d => {
    if (d.type === 'switch') return;
    out[d.id] = {
      a: Object.fromEntries(d.ifaces.map(f => [f.name, f.addrs.map(a => cidrText(a.ip, a.prefix))])),
      r: d.routes.map(r => [r.prefix === 0 ? 'default' : cidrText(r.dest, r.prefix), intToIp(r.via), r.dev])
    };
  });
  return out;
}

/** Aplica un estado guardado (lo escribe el alumno: se valida todo y se ignora lo que no encaje). */
export function importNetState(net, data) {
  if (!data || typeof data !== 'object') return false;
  let applied = false;
  net.devices.forEach(d => {
    const s = data[d.id];
    if (d.type === 'switch' || !s || typeof s !== 'object') return;
    if (s.a && typeof s.a === 'object') {
      d.ifaces.forEach(f => {
        const list = Array.isArray(s.a[f.name]) ? s.a[f.name].slice(0, 4).map(parseCidr).filter(Boolean) : null;
        if (list) { f.addrs = list; applied = true; }
      });
    }
    if (Array.isArray(s.r)) {
      d.routes = s.r.slice(0, 12).map(row => {
        if (!Array.isArray(row)) return null;
        const [destText, viaText, ifName] = row;
        const dest = destText === 'default' ? { ip: 0, prefix: 0 } : parseCidr(destText);
        const via = ipToInt(viaText);
        const iface = d.ifaces.find(f => f.name === ifName);
        if (!dest || via === null || !iface || !iface.addrs.some(a => inNet(via, a.ip, a.prefix))) return null;
        return { dest: netOf(dest.ip, dest.prefix), prefix: dest.prefix, via, dev: iface.name };
      }).filter(Boolean);
      applied = true;
    }
  });
  return applied;
}
