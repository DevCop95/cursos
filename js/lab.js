/**
 * Dev101x — Motor del laboratorio (módulo puro, sin DOM).
 *  - runCommand(): simula la salida de la consola y detecta qué pasos del laboratorio se completan.
 *  - computeProgress(): deriva lecciones, labs, porcentaje y habilidades a partir de los pasos.
 */
import { COURSE, LAB_STEPS, LAB_TARGET, LAB_HOST_IP, SKILLS, STEP_HINTS } from './content.js?v=dev101x-v85';

const TARGET_ALIASES = [LAB_TARGET, 'srv-target', 'srv-target.lab', 'srv-target.dev101x.internal', 'srv-target.dev101x.lab'];
const OPEN_PORTS = [
  { port: 80, proto: 'tcp', service: 'http', version: 'nginx/1.24.0 (Windows)' },
  { port: 135, proto: 'tcp', service: 'msrpc', version: 'Microsoft Windows RPC' },
  { port: 443, proto: 'tcp', service: 'ssl/http', version: 'nginx/1.24.0' },
  { port: 445, proto: 'tcp', service: 'microsoft-ds', version: 'Windows Server 2022 (SMBv2/v3)' },
  { port: 3389, proto: 'tcp', service: 'ms-wbt-server', version: 'Microsoft Terminal Services (RDP)' }
];
const OPEN_PORT_NUMBERS = OPEN_PORTS.map(p => p.port);
const TOTAL_TCP_PORTS = 65535;

// Puertos UDP abiertos (para -sU): distintos de los TCP para que el alumno vea la diferencia.
const OPEN_UDP_PORTS = [
  { port: 137, service: 'netbios-ns' },
  { port: 138, service: 'netbios-dgm' },
  { port: 3389, service: 'ms-wbt-server' }
];

// Resultados de scripts NSE (para -A, -sC y --script) por puerto.
const SCRIPT_OUTPUT = {
  80: ['| http-title: Dev101x Intranet', '| http-server-header: nginx/1.24.0 (Windows)'],
  443: ['| ssl-cert: Subject: commonName=srv-target.dev101x.lab', '| tls-alpn: http/1.1'],
  445: [
    '| smb-os-discovery:',
    '|   OS: Windows Server 2022 (build 20348)',
    '|   Computer name: srv-target',
    '|   Domain name: dev101x.lab',
    '|_  NetBIOS computer name: SRV-TARGET',
    '| smb2-security-mode:',
    '|_  Message signing enabled but not required'
  ],
  3389: ['| rdp-ntlm-info:', '|   Target_Name: DEV101X', '|_  Product_Version: 10.0.20348']
};

export const MAX_TERMINAL_LINES = 300;

function pad(n) { return String(n).padStart(2, '0'); }
function nmapTimestamp(now) {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

export function tokenize(raw) {
  return String(raw || '').trim().split(/\s+/).filter(Boolean);
}

function mentionsTarget(tokens) {
  return tokens.some(t => {
    const clean = t.toLowerCase().replace(/^https?:\/\//, '').replace(/[/:].*$/, '');
    return TARGET_ALIASES.includes(clean);
  });
}

function findHostArg(tokens) {
  // Primer argumento que parece host/IP (no empieza por guion ni es valor de -p / -n etc.)
  const valueFlags = ['-p', '-n', '-l', '-h', '-w', '-computername', '-port', '--script', '-commontcpport'];
  for (let i = 1; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.startsWith('-') || t.startsWith('/')) continue;
    if (valueFlags.includes(tokens[i - 1].toLowerCase())) {
      if (tokens[i - 1].toLowerCase() === '-computername') return t;
      continue;
    }
    return t.replace(/^https?:\/\//, '').replace(/[/:].*$/, '');
  }
  return null;
}

function parsePortList(spec) {
  const ports = new Set();
  String(spec || '').split(',').forEach(part => {
    const m = part.match(/^(\d+)(?:-(\d+))?$/);
    if (!m) return;
    const a = Number(m[1]);
    const b = m[2] ? Number(m[2]) : a;
    for (let p = a; p <= Math.min(b, a + 65535); p++) ports.add(p);
  });
  return ports;
}

function flagValue(tokens, name) {
  const idx = tokens.findIndex(t => t.toLowerCase() === name.toLowerCase());
  if (idx >= 0 && tokens[idx + 1]) return tokens[idx + 1];
  const joined = tokens.find(t => t.toLowerCase().startsWith(name.toLowerCase()) && t.length > name.length);
  return joined ? joined.slice(name.length) : null;
}

function line(text, type = 'out') { return { text, type }; }

// ---------------------------------------------------------------------------
// Comandos simulados
// ---------------------------------------------------------------------------
function nmap(tokens, now) {
  const lower = tokens.map(t => t.toLowerCase());
  const host = findHostArg(tokens);
  if (!host) {
    return {
      lines: [
        line('Nmap 7.95 ( https://nmap.org )', 'system'),
        line('Usage: nmap [Scan Type(s)] [Options] {target specification}', 'slate'),
        line('Ejemplo: nmap -sV -Pn ' + LAB_TARGET, 'info')
      ],
      steps: []
    };
  }
  const onTarget = mentionsTarget(tokens);
  const lines = [line(`Starting Nmap 7.95 ( https://nmap.org ) at ${nmapTimestamp(now)}`, 'system')];

  // -A implica -sV, -O, scripts y traceroute.
  const hasA = lower.includes('-a');
  const hasSV = lower.includes('-sv') || hasA;
  // Ojo: la consola pasa los tokens a minúsculas para el resto, pero -O y -o son distintos en Nmap.
  const hasOS = tokens.includes('-O') || hasA;
  const hasScripts = hasA || lower.includes('-sc') || lower.some(t => t === '--script' || t.startsWith('--script='));
  const udpScan = lower.includes('-su');
  const pingSweep = lower.includes('-sn');
  const traceroute = hasA || lower.includes('--traceroute');

  // -o en minúscula NO es detección de SO (eso es -O). -oN/-oX/-oG/-oA son formatos de salida.
  if (tokens.includes('-o')) {
    lines.push(line("nmap: opción '-o' no reconocida. Para detectar el sistema operativo usa -O (mayúscula); -oN/-oX guardan la salida en un archivo.", 'error'));
    return { lines, steps: [] };
  }

  // Barrido de una subred (CIDR) del laboratorio: descubre los hosts vivos.
  const cidr = tokens.find(t => /^10\.128\.44\.\d{1,3}\/\d{1,2}$/.test(t));
  if (cidr) {
    const hosts = [
      { ip: '10.128.44.1', name: 'gw-edge.lab' },
      { ip: LAB_HOST_IP, name: 'win-analyst (tu equipo)' },
      { ip: LAB_TARGET, name: 'srv-target.dev101x.lab' }
    ];
    hosts.forEach(h => {
      lines.push(line(`Nmap scan report for ${h.ip}${h.name ? ` (${h.name})` : ''}`, 'info'));
      lines.push(line('Host is up (0.0016s latency).', 'system'));
    });
    lines.push(line(`Nmap done: 256 IP addresses (${hosts.length} hosts up) scanned in 6.71 seconds`, 'system'));
    lines.push(line(`[LAB] El barrido encuentra ${hosts.length} equipos vivos. Ahora escanea el objetivo ${LAB_TARGET} para ver sus puertos.`, 'hint'));
    return { lines, steps: [] };
  }

  if (!onTarget) {
    lines.push(line('Note: Host seems down. If it is really up, but blocking our ping probes, try -Pn', 'slate'));
    lines.push(line('Nmap done: 1 IP address (0 hosts up) scanned in 3.04 seconds', 'system'));
    lines.push(line(`[LAB] Ese host no está en la red del laboratorio. El objetivo es ${LAB_TARGET}.`, 'hint'));
    return { lines, steps: [] };
  }

  lines.push(line(`Nmap scan report for ${LAB_TARGET} (srv-target.dev101x.lab)`, 'info'));
  lines.push(line('Host is up (0.0018s latency).', 'system'));

  // -sn: solo descubrimiento de host, sin escaneo de puertos.
  if (pingSweep) {
    lines.push(line('Nmap done: 1 IP address (1 host up) scanned in 0.42 seconds', 'system'));
    lines.push(line('[LAB] -sn solo comprueba si el host está vivo (no escanea puertos). Quita -sn para ver los puertos abiertos.', 'hint'));
    return { lines, steps: [] };
  }

  // -sU: escaneo UDP (puertos distintos a los TCP).
  if (udpScan) {
    lines.push(line(`Not shown: 995 closed udp ports (port-unreach)`, 'slate'));
    lines.push(line('PORT     STATE SERVICE', 'system'));
    OPEN_UDP_PORTS.forEach(p => {
      lines.push(line(`${`${p.port}/udp`.padEnd(9)}open  ${p.service}`, 'cmd'));
    });
    lines.push(line('Nmap done: 1 IP address (1 host up) scanned in 22.31 seconds', 'system'));
    lines.push(line('[LAB] El escaneo UDP (-sU) es lento y ve puertos distintos a los TCP. Para el reto usa el escaneo TCP normal.', 'hint'));
    return { lines, steps: ['nmap-basic'] };
  }

  const portSpec = portFlag(tokens);
  const allPorts = portSpec === '-';
  const requested = portSpec && !allPorts ? parsePortList(portSpec) : null;
  const shown = requested ? OPEN_PORTS.filter(p => requested.has(p.port)) : OPEN_PORTS;

  if (requested) {
    const closed = [...requested].filter(p => !OPEN_PORT_NUMBERS.includes(p)).length;
    if (closed > 0) lines.push(line(`Not shown: ${closed} closed tcp ports (reset)`, 'slate'));
  } else if (allPorts) {
    lines.push(line(`Not shown: ${TOTAL_TCP_PORTS - OPEN_PORT_NUMBERS.length} closed tcp ports (reset)`, 'slate'));
  } else {
    lines.push(line('Not shown: 995 closed tcp ports (reset)', 'slate'));
  }

  // Nota del tipo de escaneo elegido (para que -sS y -sT no den la misma salida "muda").
  if (lower.includes('-ss')) lines.push(line('Scan type: SYN Stealth Scan (medio abierto)', 'slate'));
  else if (lower.includes('-st')) lines.push(line('Scan type: TCP Connect Scan (handshake completo)', 'slate'));

  if (shown.length) {
    lines.push(line(hasSV ? 'PORT     STATE SERVICE       VERSION' : 'PORT     STATE SERVICE', 'system'));
    shown.forEach(p => {
      const portCol = `${p.port}/${p.proto}`.padEnd(9);
      const svc = p.service.padEnd(14);
      lines.push(line(`${portCol}open  ${hasSV ? svc + p.version : p.service}`, 'cmd'));
      if (hasScripts && SCRIPT_OUTPUT[p.port]) SCRIPT_OUTPUT[p.port].forEach(s => lines.push(line(s, 'info')));
    });
  }
  if (hasOS) {
    lines.push(line('Device type: general purpose', 'slate'));
    lines.push(line('Running: Microsoft Windows 2022', 'info'));
    lines.push(line('OS details: Microsoft Windows Server 2022 (build 20348)', 'cmd'));
  }
  if (hasSV) lines.push(line('Service Info: OS: Windows; CPE: cpe:/o:microsoft:windows', 'info'));
  if (traceroute) {
    lines.push(line('TRACEROUTE (using port 80/tcp)', 'system'));
    lines.push(line('HOP RTT     ADDRESS', 'slate'));
    lines.push(line('1   0.30 ms 10.128.44.1 (gw-edge.lab)', 'cmd'));
    lines.push(line(`2   1.10 ms ${LAB_TARGET} (srv-target.dev101x.lab)`, 'cmd'));
  }
  lines.push(line(`Nmap done: 1 IP address (1 host up) scanned in ${hasSV || hasOS || hasScripts || allPorts ? '14.62' : '2.14'} seconds`, 'system'));

  const steps = ['nmap-basic'];
  if (hasSV) steps.push('nmap-sv');
  if (hasOS) steps.push('nmap-os');
  if (!hasSV) lines.push(line('[LAB] Pista: añade -sV para identificar las versiones de los servicios.', 'hint'));
  else if (!hasOS) lines.push(line('[LAB] Pista: añade -O para que Nmap intente detectar el sistema operativo y su build.', 'hint'));
  return { lines, steps };
}

// Valor del flag -p (lista de puertos). '-p-' devuelve '-' (todos los puertos).
// No confunde -Pn ni otros flags que empiecen por -p con la lista de puertos.
function portFlag(tokens) {
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t === '-p-' || t.toLowerCase() === '-p-') return '-';
    if (t.toLowerCase() === '-p') return tokens[i + 1] || null;
    // Forma pegada -p80,443: el resto debe empezar por dígito (así -Pn no cuenta).
    if (/^-p\d/i.test(t)) return t.slice(2);
  }
  return null;
}

function ipconfig(tokens) {
  const lower = tokens.map(t => t.toLowerCase());
  if (lower.includes('/flushdns')) {
    return { lines: [
      line('Configuración IP de Windows', 'system'),
      line('Se vació correctamente la caché de resolución de DNS.', 'cmd')
    ], steps: ['ipconfig'] };
  }
  if (lower.includes('/displaydns')) {
    return { lines: [
      line('Configuración IP de Windows', 'system'),
      line('    srv-target.dev101x.internal', 'info'),
      line('    ----------------------------------------', 'slate'),
      line('    Nombre de registro. . . . . : srv-target.dev101x.internal', 'slate'),
      line('    Tipo de registro. . . . . . : 1', 'slate'),
      line(`    Registro (host) A . . . . . : ${LAB_TARGET}`, 'cmd'),
      line('    gw-edge.lab', 'info'),
      line('    ----------------------------------------', 'slate'),
      line('    Registro (host) A . . . . . : 10.128.44.1', 'cmd')
    ], steps: ['ipconfig'] };
  }
  const all = lower.includes('/all');
  const lines = [
    line('Configuración IP de Windows', 'system'),
    line('Adaptador Ethernet vEthernet (Labs-Internal):', 'info'),
    line('   Sufijo DNS específico para la conexión. . : lab.dev101x.internal', 'slate')
  ];
  if (all) {
    lines.push(line('   Descripción . . . . . . . . . . . . . . . : Hyper-V Virtual Ethernet Adapter', 'slate'));
    lines.push(line('   Dirección física. . . . . . . . . . . . . : 00-15-5D-2C-44-05', 'slate'));
    lines.push(line('   DHCP habilitado . . . . . . . . . . . . . : No', 'slate'));
  }
  lines.push(line(`   Dirección IPv4. . . . . . . . . . . . . . : ${LAB_HOST_IP}`, 'cmd'));
  lines.push(line('   Máscara de subred . . . . . . . . . . . . : 255.255.255.0', 'slate'));
  lines.push(line('   Puerta de enlace predeterminada . . . . . : 10.128.44.1', 'cmd'));
  if (all) lines.push(line('   Servidores DNS. . . . . . . . . . . . . . : 10.128.44.1', 'slate'));
  return { lines, steps: ['ipconfig'] };
}

function whoami(tokens) {
  const lower = tokens.map(t => t.toLowerCase());
  const all = lower.includes('/all');
  const lines = [];
  const userBlock = () => {
    lines.push(line('INFORMACIÓN DE USUARIO', 'system'));
    lines.push(line('Nombre de usuario   SID', 'slate'));
    lines.push(line('=================== ==============================================', 'slate'));
    lines.push(line('dev101x-lab\\analyst01 S-1-5-21-1004336348-1177238915-682003330-1103', 'cmd'));
  };
  const groupBlock = () => {
    lines.push(line('INFORMACIÓN DE GRUPO', 'system'));
    lines.push(line('Nombre de grupo               Tipo             SID', 'slate'));
    lines.push(line('============================= ================ ==============', 'slate'));
    lines.push(line('BUILTIN\\Usuarios              Grupo conocido   S-1-5-32-545', 'info'));
    lines.push(line('NT AUTHORITY\\INTERACTIVE      Grupo conocido   S-1-5-4', 'info'));
    lines.push(line('NT AUTHORITY\\Usuarios autentic. Grupo conocido S-1-5-11', 'info'));
  };
  const privBlock = () => {
    lines.push(line('INFORMACIÓN DE PRIVILEGIOS', 'system'));
    lines.push(line('Nombre de privilegio          Descripción                       Estado', 'slate'));
    lines.push(line('============================= ================================= ========', 'slate'));
    lines.push(line('SeChangeNotifyPrivilege       Omitir comprobación de recorrido  Habilitado', 'info'));
    lines.push(line('SeIncreaseWorkingSetPrivilege Aumentar espacio de trabajo       Habilitado', 'info'));
  };
  if (all) { userBlock(); groupBlock(); privBlock(); }
  else if (lower.includes('/priv')) privBlock();
  else if (lower.includes('/groups')) groupBlock();
  else lines.push(line('dev101x-lab\\analyst01', 'cmd'));
  return { lines, steps: ['whoami'] };
}

function ping(tokens) {
  const lower = tokens.map(t => t.toLowerCase());
  const host = findHostArg(tokens);
  if (!host) return { lines: [line('Uso: ping [-a] [-n count] [-l size] destino', 'slate')], steps: [] };
  const count = Math.min(Math.max(Number(flagValue(tokens, '-n')) || 4, 1), 10);
  const size = Math.min(Math.max(Number(flagValue(tokens, '-l')) || 32, 1), 65500);
  const resolve = lower.includes('-a'); // -a: resolución inversa del nombre
  const onTarget = mentionsTarget(tokens);
  const shownHost = resolve && onTarget ? `srv-target.dev101x.internal [${LAB_TARGET}]` : host;
  const lines = [line(`Haciendo ping a ${shownHost} con ${size} bytes de datos:`, 'system')];
  if (!onTarget && host !== '10.128.44.1') {
    for (let i = 0; i < count; i++) lines.push(line('Tiempo de espera agotado para esta solicitud.', 'error'));
    lines.push(line(`Estadísticas de ping para ${host}: enviados = ${count}, recibidos = 0, perdidos = ${count} (100% perdidos)`, 'info'));
    lines.push(line(`[LAB] Ese host no responde. El objetivo del laboratorio es ${LAB_TARGET}.`, 'hint'));
    return { lines, steps: [] };
  }
  for (let i = 0; i < count; i++) lines.push(line(`Respuesta desde ${host}: bytes=${size} tiempo=${i % 2 ? 2 : 1}ms TTL=128`, 'cmd'));
  lines.push(line(`Estadísticas de ping para ${host}: enviados = ${count}, recibidos = ${count}, perdidos = 0 (0% perdidos)`, 'info'));
  if (onTarget) lines.push(line('[LAB] TTL=128 es la huella típica de Windows (Linux usa 64).', 'hint'));
  return { lines, steps: onTarget ? ['ping'] : [] };
}

function tracert(tokens) {
  const host = findHostArg(tokens);
  if (!host) return { lines: [line('Uso: tracert [-d] [-h saltos_máximos] [-w tiempo_de_espera] destino', 'slate')], steps: [] };
  const numeric = tokens.some(t => t.toLowerCase() === '-d');
  if (!mentionsTarget(tokens)) {
    return {
      lines: [
        line(`Traza a ${host} sobre un máximo de 30 saltos:`, 'system'),
        line(`  1    <1 ms    <1 ms    <1 ms  10.128.44.1${numeric ? '' : ' [gw-edge.lab]'}`, 'cmd'),
        line('  2     *        *        *     Tiempo de espera agotado para esta solicitud.', 'error'),
        line(`[LAB] El objetivo del laboratorio es ${LAB_TARGET}.`, 'hint')
      ],
      steps: []
    };
  }
  return {
    lines: [
      line(`Traza a la dirección ${LAB_TARGET} sobre un máximo de 30 saltos:`, 'system'),
      line(`  1    <1 ms    <1 ms    <1 ms  10.128.44.1${numeric ? '' : ' [gw-edge.lab]'}`, 'cmd'),
      line(`  2     1 ms     1 ms     1 ms  ${LAB_TARGET}${numeric ? '' : ' [srv-target.lab]'}`, 'cmd'),
      line('Traza completa.', 'system')
    ],
    steps: ['tracert']
  };
}

function netstat(tokens) {
  const lower = tokens.map(t => t.toLowerCase());
  // -r: tabla de rutas (equivale a route print).
  if (lower.includes('-r')) {
    return {
      lines: [
        line('Tabla de rutas', 'system'),
        line('===========================================================================', 'slate'),
        line('Rutas activas:', 'info'),
        line('Destino de red    Máscara de red   Puerta de enlace  Interfaz     Métrica', 'slate'),
        line('        0.0.0.0          0.0.0.0      10.128.44.1    10.128.44.5     25', 'cmd'),
        line('    10.128.44.0    255.255.255.0       En vínculo     10.128.44.5    281', 'cmd'),
        line('    10.128.44.5  255.255.255.255       En vínculo     10.128.44.5    281', 'cmd')
      ],
      steps: ['netstat']
    };
  }
  return {
    lines: [
      line('Conexiones activas', 'system'),
      line('  Proto  Dirección local          Dirección remota        Estado          PID', 'slate'),
      line('  TCP    0.0.0.0:135              0.0.0.0:0               LISTENING       940', 'cmd'),
      line(`  TCP    ${LAB_HOST_IP}:49712        ${LAB_TARGET}:445        ESTABLISHED     4120`, 'cmd'),
      line('  TCP    0.0.0.0:3389             0.0.0.0:0               LISTENING       1124', 'cmd')
    ],
    steps: ['netstat']
  };
}

function routePrint() {
  return netstat(['netstat', '-r']);
}

function arp() {
  return {
    lines: [
      line('Interfaz: 10.128.44.5 --- 0xb', 'system'),
      line('  Dirección de Internet     Dirección física      Tipo', 'slate'),
      line('  10.128.44.1               00-15-5d-2c-44-01     dinámico', 'cmd'),
      line(`  ${LAB_TARGET}              00-15-5d-2c-44-0c     dinámico`, 'cmd'),
      line('  10.128.44.255             ff-ff-ff-ff-ff-ff     estático', 'slate')
    ],
    steps: []
  };
}

function hostname() {
  return { lines: [line('win-analyst', 'cmd')], steps: [] };
}

function systeminfo() {
  return {
    lines: [
      line('Nombre de host:                     WIN-ANALYST', 'cmd'),
      line('Nombre del sistema operativo:       Microsoft Windows 11 Pro', 'info'),
      line('Versión del sistema operativo:      10.0.22631 N/D compilación 22631', 'slate'),
      line('Fabricante del sistema operativo:   Microsoft Corporation', 'slate'),
      line('Miembro de dominio:                 dev101x-lab', 'slate'),
      line('Memoria física total:               16.384 MB', 'slate'),
      line('[LAB] systeminfo describe TU equipo (el del auditor), no el objetivo.', 'hint')
    ],
    steps: []
  };
}

function curl(tokens, now) {
  const lower = tokens.map(t => t.toLowerCase());
  const host = findHostArg(tokens);
  if (!host) return { lines: [line('curl: try \'curl --help\' for more information', 'slate')], steps: [] };
  if (!mentionsTarget(tokens)) {
    return {
      lines: [
        line(`curl: (6) Could not resolve host: ${host}`, 'error'),
        line(`[LAB] Prueba con http://${LAB_TARGET}`, 'hint')
      ],
      steps: []
    };
  }
  const headOnly = lower.includes('-i') || lower.includes('--head');
  const verbose = lower.includes('-v') || lower.includes('--verbose');
  const lines = [];
  if (verbose) {
    // Negociación de conexión que muestra -v antes de las cabeceras.
    lines.push(line(`* Trying ${LAB_TARGET}:80...`, 'slate'));
    lines.push(line(`* Connected to ${LAB_TARGET} (${LAB_TARGET}) port 80`, 'slate'));
    lines.push(line('> GET / HTTP/1.1', 'info'));
    lines.push(line(`> Host: ${LAB_TARGET}`, 'info'));
    lines.push(line('> User-Agent: curl/8.4.0', 'info'));
    lines.push(line('>', 'slate'));
  }
  const pfx = verbose ? '< ' : '';
  lines.push(line(`${pfx}HTTP/1.1 200 OK`, 'cmd'));
  lines.push(line(`${pfx}Server: nginx/1.24.0 (Windows)`, 'info'));
  lines.push(line(`${pfx}Date: ${now.toUTCString()}`, 'slate'));
  lines.push(line(`${pfx}Content-Type: text/html; charset=UTF-8`, 'slate'));
  lines.push(line(`${pfx}X-Powered-By: Dev101x-VulnerableLab`, 'info'));
  if (!headOnly) {
    lines.push(line('', 'out'));
    lines.push(line('<html><head><title>Dev101x Intranet</title></head>...', 'slate'));
    lines.push(line('[LAB] Pista: con -I solo pides las cabeceras (banner grabbing).', 'hint'));
  }
  // El paso "curl" se consigue viendo solo las cabeceras (-I) o con -v (banner grabbing).
  return { lines, steps: headOnly || verbose ? ['curl'] : [] };
}

function nslookup(tokens) {
  const host = findHostArg(tokens) || LAB_TARGET;
  return {
    lines: [
      line('Servidor:  dns.dev101x.internal', 'system'),
      line('Address:  10.128.44.1', 'slate'),
      line(mentionsTarget(tokens) || !findHostArg(tokens) ? 'Nombre:   srv-target.dev101x.internal' : `*** dns.dev101x.internal no encuentra ${host}: Non-existent domain`, mentionsTarget(tokens) ? 'info' : 'error'),
      ...(mentionsTarget(tokens) ? [line(`Address:  ${LAB_TARGET}`, 'cmd')] : [])
    ],
    steps: []
  };
}

const COMMON_TCP_PORTS = { http: 80, rdp: 3389, smb: 445, winrm: 5985 };

function testNetConnection(tokens) {
  const host = flagValue(tokens, '-ComputerName') || findHostArg(tokens);
  if (!host) return { lines: [line('Uso: Test-NetConnection -ComputerName <host> -Port <puerto>', 'slate')], steps: [] };
  const common = flagValue(tokens, '-CommonTCPPort');
  const port = Number(flagValue(tokens, '-Port')) || (common ? COMMON_TCP_PORTS[common.toLowerCase()] : 0) || 0;
  const onTarget = mentionsTarget([host]);
  const lines = [line(`ComputerName     : ${host}`, 'info'), line(`RemoteAddress    : ${onTarget ? LAB_TARGET : host}`, 'info')];
  if (port) {
    const ok = onTarget && OPEN_PORT_NUMBERS.includes(port);
    lines.push(line(`RemotePort       : ${port}`, 'info'));
    lines.push(line('InterfaceAlias   : vEthernet (Labs-Internal)', 'slate'));
    lines.push(line(`TcpTestSucceeded : ${ok ? 'True' : 'False'}`, ok ? 'cmd' : 'error'));
  } else {
    lines.push(line('InterfaceAlias   : vEthernet (Labs-Internal)', 'slate'));
    lines.push(line(`PingSucceeded    : ${onTarget ? 'True' : 'False'}`, onTarget ? 'cmd' : 'error'));
  }
  if (!onTarget) {
    lines.push(line(`[LAB] El objetivo del laboratorio es ${LAB_TARGET}.`, 'hint'));
    return { lines, steps: [] };
  }
  const steps = ['testnet'];
  if (port === 445) steps.push('smb');
  if (port === 3389) steps.push('rdp');
  return { lines, steps };
}

const HELP_LINES = [
  line('[COMANDOS PENTESTING 101 - WINDOWS HOST]', 'system'),
  line(`  • nmap [flags] <IP>     : Escaneo de puertos (ej: nmap -sV -p 80,443,445 ${LAB_TARGET})`, 'info'),
  line('       flags: -sS SYN sigiloso · -sV versiones · -O sistema operativo · -A todo · -Pn sin ping · -p puertos · -sU UDP · -sn solo descubrir', 'slate'),
  line('  • ipconfig [/all|/displaydns] : Adaptadores, IPv4, máscara, puerta de enlace y caché DNS', 'info'),
  line('  • whoami [/priv|/groups|/all] : Usuario activo, grupos y privilegios del token', 'info'),
  line('  • ping [-a] [-n N] <IP>  : Conectividad ICMP con el objetivo (TTL revela el SO)', 'info'),
  line('  • tracert [-d] <IP>      : Traza la ruta de red hacia el servidor objetivo', 'info'),
  line('  • netstat -ano | -r      : Conexiones y puertos locales, o la tabla de rutas', 'info'),
  line('  • curl -I | -v <URL>     : Banner grabbing HTTP sobre el objetivo', 'info'),
  line('  • nslookup <host/IP>     : Consulta de resolución de nombres DNS', 'info'),
  line('  • Test-NetConnection     : -ComputerName <IP> -Port <puerto> (alias: tnc)', 'info'),
  line('  • arp -a · route print · hostname · systeminfo : reconocimiento local del equipo', 'info'),
  line('  • progreso               : Muestra qué pasos del laboratorio te faltan', 'info'),
  line('  • cls / clear            : Limpiar la pantalla de la terminal', 'info')
];

// Mapa comando → clave de la ficha técnica en PENTESTING_COMMANDS
export const EXPLANATION_KEYS = {
  nmap: 'nmap', 'nmap.exe': 'nmap',
  ipconfig: 'ipconfig', 'ipconfig.exe': 'ipconfig',
  whoami: 'whoami', 'whoami.exe': 'whoami',
  ping: 'ping', 'ping.exe': 'ping',
  tracert: 'tracert', 'tracert.exe': 'tracert',
  netstat: 'netstat', 'netstat.exe': 'netstat',
  curl: 'curl', 'curl.exe': 'curl',
  'test-netconnection': 'testnet', tnc: 'testnet'
};

/**
 * Ejecuta un comando simulado.
 * @returns {{ lines: {text:string,type:string}[], steps: string[], explanationKey: string|null, clear: boolean, showProgress: boolean }}
 */
export function runCommand(raw, { now = new Date() } = {}) {
  const tokens = tokenize(raw);
  const result = { lines: [], steps: [], explanationKey: null, clear: false, showProgress: false };
  if (!tokens.length) return result;
  const name = tokens[0].toLowerCase();
  result.explanationKey = EXPLANATION_KEYS[name] || null;

  let out;
  switch (name) {
    case 'clear': case 'cls': result.clear = true; return result;
    case 'help': case '/?': case 'get-help': out = { lines: HELP_LINES.slice(), steps: [] }; break;
    case 'progreso': case 'progress': result.showProgress = true; return result;
    case 'nmap': case 'nmap.exe': out = nmap(tokens, now); break;
    case 'ipconfig': case 'ipconfig.exe': out = ipconfig(tokens); break;
    case 'whoami': case 'whoami.exe': out = whoami(tokens); break;
    case 'ping': case 'ping.exe': out = ping(tokens); break;
    case 'tracert': case 'tracert.exe': out = tracert(tokens); break;
    case 'netstat': case 'netstat.exe': out = netstat(tokens); break;
    case 'curl': case 'curl.exe': out = curl(tokens, now); break;
    case 'nslookup': out = nslookup(tokens); break;
    case 'test-netconnection': case 'tnc': out = testNetConnection(tokens); break;
    case 'arp': case 'arp.exe': out = arp(); break;
    case 'hostname': case 'hostname.exe': out = hostname(); break;
    case 'systeminfo': case 'systeminfo.exe': out = systeminfo(); break;
    case 'route': case 'route.exe': out = routePrint(); break;
    default:
      out = { lines: [line(`'${tokens[0]}' no se reconoce como un comando interno o externo, programa o archivo por lotes ejecutable. Escribe 'help' para ver comandos disponibles.`, 'error')], steps: [] };
  }
  result.lines = out.lines;
  result.steps = out.steps;
  return result;
}

// ---------------------------------------------------------------------------
// Progreso
// ---------------------------------------------------------------------------
const ALL_LESSONS = COURSE.syllabus.flatMap(m => m.lessons);
export const TOTAL_LESSONS = ALL_LESSONS.length;

// Pasos de comando (consola) frente a preguntas (q-…) y respuestas del reto final (f-…).
export function isCommandStep(step) {
  return !/^(q|f)-/.test(step);
}

export function isLessonDone(lesson, steps) {
  if (lesson.afterAll && !ALL_LESSONS.filter(l => !l.afterAll).every(l => isLessonDone(l, steps))) return false;
  return lesson.requires.every(s => Boolean(steps[s]));
}

export function isLabDone(lab, steps) {
  return lab.all.every(s => Boolean(steps[s])) && (lab.any.length === 0 || lab.any.some(s => Boolean(steps[s])));
}

export function computeProgress(steps = {}) {
  const lessonsDone = ALL_LESSONS.filter(l => isLessonDone(l, steps)).map(l => l.id);
  const labsDone = LAB_STEPS.filter(l => isLabDone(l, steps)).map(l => l.id);
  const nextLesson = ALL_LESSONS.find(l => !lessonsDone.includes(l.id)) || null;
  const currentModule = nextLesson ? COURSE.syllabus.find(m => m.lessons.includes(nextLesson)) : COURSE.syllabus[COURSE.syllabus.length - 1];
  const percent = Math.round((lessonsDone.length / TOTAL_LESSONS) * 100);
  const skills = SKILLS.map(s => {
    const done = s.steps.filter(k => steps[k]).length;
    const pct = Math.round((done / s.steps.length) * 100);
    const level = pct === 100 ? 'Completado' : pct >= 50 ? 'En curso' : pct > 0 ? 'Iniciado' : 'Pendiente';
    return { name: s.name, pct, level };
  });
  return { lessonsDone, labsDone, percent, nextLesson, currentModule, skills, complete: percent === 100 };
}

// Comandos que faltan para la siguiente lección (las preguntas se responden en la ficha de la lección).
export function pendingHints(steps = {}) {
  const { nextLesson } = computeProgress(steps);
  if (!nextLesson) return [];
  return nextLesson.requires
    .filter(s => isCommandStep(s) && !steps[s])
    .map(s => ({ step: s, command: STEP_HINTS[s] }));
}

// Preguntas o respuestas del reto que faltan en la siguiente lección.
export function pendingChecks(steps = {}) {
  const { nextLesson } = computeProgress(steps);
  if (!nextLesson) return [];
  return nextLesson.requires.filter(s => !isCommandStep(s) && !steps[s]);
}

// Une dos registros de pasos conservando la fecha más antigua de cada uno.
// Reinicio hecho por el admin (student_progress.reset_at): descarta los pasos locales anteriores a esa fecha
// para que el navegador no vuelva a subirlos. Devuelve el registro nuevo, o null si no hay reinicio pendiente.
export function applyProgressReset(record = {}, resetAt) {
  const since = Date.parse(resetAt || '');
  if (!since || (record.resetAt && Date.parse(record.resetAt) >= since)) return null;
  const steps = Object.fromEntries(Object.entries(record.steps || {}).filter(([, t]) => Date.parse(t) > since));
  return { ...record, steps, completedAt: null, resetAt };
}

export function mergeSteps(a = {}, b = {}) {
  const out = { ...a };
  Object.entries(b || {}).forEach(([k, v]) => {
    if (!v) return;
    if (!out[k] || String(v) < String(out[k])) out[k] = v;
  });
  return out;
}
