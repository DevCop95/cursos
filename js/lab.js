/**
 * Dev101x — Motor del laboratorio (módulo puro, sin DOM).
 *  - runCommand(): simula la salida de la consola y detecta qué pasos del laboratorio se completan.
 *  - computeProgress(): deriva lecciones, labs, porcentaje y habilidades a partir de los pasos.
 */
import { COURSE, LAB_STEPS, LAB_TARGET, LAB_HOST_IP, SKILLS, STEP_HINTS } from './content.js?v=dev101x-v55';

const TARGET_ALIASES = [LAB_TARGET, 'srv-target', 'srv-target.lab', 'srv-target.dev101x.internal', 'srv-target.dev101x.lab'];
const OPEN_PORTS = [
  { port: 80, proto: 'tcp', service: 'http', version: 'nginx/1.24.0 (Windows)' },
  { port: 135, proto: 'tcp', service: 'msrpc', version: 'Microsoft Windows RPC' },
  { port: 443, proto: 'tcp', service: 'ssl/http', version: 'nginx/1.24.0' },
  { port: 445, proto: 'tcp', service: 'microsoft-ds', version: 'Windows Server 2022 (SMBv2/v3)' },
  { port: 3389, proto: 'tcp', service: 'ms-wbt-server', version: 'Microsoft Terminal Services (RDP)' }
];
const OPEN_PORT_NUMBERS = OPEN_PORTS.map(p => p.port);

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
  const hasSV = lower.includes('-sv') || lower.includes('-a');
  const hasOS = lower.includes('-o') || lower.includes('-a');
  const portSpec = flagValue(tokens, '-p');
  const lines = [line(`Starting Nmap 7.95 ( https://nmap.org ) at ${nmapTimestamp(now)}`, 'system')];

  if (!onTarget) {
    lines.push(line('Note: Host seems down. If it is really up, but blocking our ping probes, try -Pn', 'slate'));
    lines.push(line('Nmap done: 1 IP address (0 hosts up) scanned in 3.04 seconds', 'system'));
    lines.push(line(`[LAB] Ese host no está en la red del laboratorio. El objetivo es ${LAB_TARGET}.`, 'hint'));
    return { lines, steps: [] };
  }

  const requested = portSpec ? parsePortList(portSpec) : null;
  const shown = requested ? OPEN_PORTS.filter(p => requested.has(p.port)) : OPEN_PORTS;
  lines.push(line(`Nmap scan report for ${LAB_TARGET} (srv-target.dev101x.lab)`, 'info'));
  lines.push(line('Host is up (0.0018s latency).', 'system'));
  if (requested) {
    const closed = [...requested].filter(p => !OPEN_PORT_NUMBERS.includes(p)).length;
    if (closed > 0) lines.push(line(`Not shown: ${closed} closed tcp ports (reset)`, 'slate'));
  } else {
    lines.push(line('Not shown: 995 closed tcp ports (reset)', 'slate'));
  }
  if (shown.length) {
    lines.push(line(hasSV ? 'PORT     STATE SERVICE       VERSION' : 'PORT     STATE SERVICE', 'system'));
    shown.forEach(p => {
      const portCol = `${p.port}/${p.proto}`.padEnd(9);
      const svc = p.service.padEnd(14);
      lines.push(line(`${portCol}open  ${hasSV ? svc + p.version : p.service}`, 'cmd'));
    });
  }
  if (hasOS) {
    lines.push(line('Device type: general purpose', 'slate'));
    lines.push(line('Running: Microsoft Windows 2022', 'info'));
    lines.push(line('OS details: Microsoft Windows Server 2022 (build 20348)', 'cmd'));
  }
  if (hasSV) lines.push(line('Service Info: OS: Windows; CPE: cpe:/o:microsoft:windows', 'info'));
  lines.push(line(`Nmap done: 1 IP address (1 host up) scanned in ${hasSV || hasOS ? '14.62' : '2.14'} seconds`, 'system'));

  const steps = ['nmap-basic'];
  if (hasSV) steps.push('nmap-sv');
  if (hasOS) steps.push('nmap-os');
  if (!hasSV) lines.push(line('[LAB] Pista: añade -sV para identificar las versiones de los servicios.', 'hint'));
  return { lines, steps };
}

function ipconfig(tokens) {
  const all = tokens.some(t => t.toLowerCase() === '/all');
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
  const lines = [];
  if (lower.includes('/priv') || lower.includes('/all')) {
    lines.push(line('INFORMACIÓN DE PRIVILEGIOS', 'system'));
    lines.push(line('Nombre de privilegio          Descripción                       Estado', 'slate'));
    lines.push(line('============================= ================================= ========', 'slate'));
    lines.push(line('SeChangeNotifyPrivilege       Omitir comprobación de recorrido  Habilitado', 'info'));
    lines.push(line('SeIncreaseWorkingSetPrivilege Aumentar espacio de trabajo       Habilitado', 'info'));
  } else if (lower.includes('/groups')) {
    lines.push(line('INFORMACIÓN DE GRUPO', 'system'));
    lines.push(line('BUILTIN\\Usuarios              Grupo conocido   S-1-5-32-545', 'info'));
    lines.push(line('NT AUTHORITY\\INTERACTIVE      Grupo conocido   S-1-5-4', 'info'));
  } else {
    lines.push(line('dev101x-lab\\analyst01', 'cmd'));
  }
  return { lines, steps: ['whoami'] };
}

function ping(tokens) {
  const host = findHostArg(tokens);
  if (!host) return { lines: [line('Uso: ping [-n count] [-l size] destino', 'slate')], steps: [] };
  const count = Math.min(Math.max(Number(flagValue(tokens, '-n')) || 4, 1), 10);
  const lines = [line(`Haciendo ping a ${host} con 32 bytes de datos:`, 'system')];
  if (!mentionsTarget(tokens) && host !== '10.128.44.1') {
    for (let i = 0; i < count; i++) lines.push(line('Tiempo de espera agotado para esta solicitud.', 'error'));
    lines.push(line(`Estadísticas de ping para ${host}: enviados = ${count}, recibidos = 0, perdidos = ${count} (100% perdidos)`, 'info'));
    lines.push(line(`[LAB] Ese host no responde. El objetivo del laboratorio es ${LAB_TARGET}.`, 'hint'));
    return { lines, steps: [] };
  }
  for (let i = 0; i < count; i++) lines.push(line(`Respuesta desde ${host}: bytes=32 tiempo=${i % 2 ? 2 : 1}ms TTL=128`, 'cmd'));
  lines.push(line(`Estadísticas de ping para ${host}: enviados = ${count}, recibidos = ${count}, perdidos = 0 (0% perdidos)`, 'info'));
  return { lines, steps: mentionsTarget(tokens) ? ['ping'] : [] };
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

function netstat() {
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
  const lines = [
    line('HTTP/1.1 200 OK', 'cmd'),
    line('Server: nginx/1.24.0 (Windows)', 'info'),
    line(`Date: ${now.toUTCString()}`, 'slate'),
    line('Content-Type: text/html; charset=UTF-8', 'slate'),
    line('X-Powered-By: Dev101x-VulnerableLab', 'info')
  ];
  if (!headOnly) {
    lines.push(line('', 'out'));
    lines.push(line('<html><head><title>Dev101x Intranet</title></head>...', 'slate'));
    lines.push(line('[LAB] Pista: con -I solo pides las cabeceras (banner grabbing).', 'hint'));
  }
  return { lines, steps: headOnly ? ['curl'] : [] };
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
  line(`  • nmap [flags] <IP>     : Escaneo de puertos y servicios (ej: nmap -sV -p 80,443,445 ${LAB_TARGET})`, 'info'),
  line('  • ipconfig [/all]       : Muestra adaptadores, IPv4, máscara y puerta de enlace', 'info'),
  line('  • whoami [/priv|/groups]: Muestra usuario activo, grupos y privilegios', 'info'),
  line('  • ping [-n N] <IP>      : Comprueba conectividad ICMP con el objetivo', 'info'),
  line('  • tracert [-d] <IP>     : Traza la ruta de red hacia el servidor objetivo', 'info'),
  line('  • netstat -ano          : Muestra puertos abiertos y conexiones activas locales', 'info'),
  line('  • curl -I <URL>         : Banner grabbing HTTP sobre el objetivo', 'info'),
  line('  • nslookup <host/IP>    : Consulta de resolución de nombres DNS', 'info'),
  line('  • Test-NetConnection    : -ComputerName <IP> -Port <puerto> (alias: tnc)', 'info'),
  line('  • progreso              : Muestra qué pasos del laboratorio te faltan', 'info'),
  line('  • cls / clear           : Limpiar la pantalla de la terminal', 'info')
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
