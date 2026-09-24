/**
 * Dev101x — Contenido del curso (temario, laboratorios, fichas de comandos y recursos)
 * Módulo puro: sin acceso al DOM, importable desde los tests.
 */

export const LAB_TARGET = '10.128.44.12';
export const LAB_HOST_IP = '10.128.44.5';

export const COURSE = {
  id: 'pentesting-101',
  title: 'Pentesting 101: Fundamentos desde Windows',
  category: 'cyber',
  categoryLabel: 'CIBERSEGURIDAD',
  duration: '4 Semanas',
  description: 'Reconocimiento y escaneo de puertos con Nmap usando la consola de Windows como plataforma de entrada.',
  badge: 'WIN-PENTEST',
  instructor: 'Dev101x',
  // Una lección se completa con los pasos de `requires`: comandos en la consola, su pregunta (q-…)
  // y, en la evaluación final, las respuestas del reto (f-…). `afterAll`: exige además todas las anteriores.
  // Las respuestas correctas solo existen en el servidor.
  syllabus: [
    {
      module: 'Módulo 1: Reconocimiento y Redes en Windows',
      duration: '1 semana',
      lessons: [
        { id: 'p1-1', title: '1.1 Diagnóstico de interfaz: ipconfig y ping', time: '25 min', requires: ['ipconfig', 'ping', 'q-p1-1'] },
        { id: 'p1-2', title: '1.2 Mapeo de rutas con tracert y netstat', time: '30 min', requires: ['tracert', 'netstat', 'q-p1-2'] },
        { id: 'p1-3', title: '1.3 Identidad y privilegios: whoami y PowerShell', time: '30 min', requires: ['whoami', 'q-p1-3'] }
      ]
    },
    {
      module: 'Módulo 2: Escaneo de Red con Nmap',
      duration: '1 semana',
      lessons: [
        { id: 'p2-1', title: '2.1 Nmap en Windows: instalación y sintaxis base', time: '35 min', requires: ['nmap-basic', 'q-p2-1'] },
        { id: 'p2-2', title: '2.2 Flags esenciales: -sS, -sV, -Pn y rangos', time: '40 min', requires: ['nmap-sv', 'q-p2-2'] },
        { id: 'p2-3', title: '2.3 Detección de versiones y sistemas operativos', time: '35 min', requires: ['nmap-os', 'q-p2-3'] }
      ]
    },
    {
      module: 'Módulo 3: Enumeración de Servicios desde Windows',
      duration: '1 semana',
      lessons: [
        { id: 'p3-1', title: '3.1 Inspección HTTP con curl y banner grabbing', time: '30 min', requires: ['curl', 'q-p3-1'] },
        { id: 'p3-2', title: '3.2 Enumeración de SMB (445) y RPC (135)', time: '40 min', requires: ['smb', 'q-p3-2'] },
        { id: 'p3-3', title: '3.3 Verificación de acceso RDP (3389)', time: '30 min', requires: ['rdp', 'q-p3-3'] }
      ]
    },
    {
      module: 'Módulo 4: Automatización y Laboratorio Práctico',
      duration: '1 semana',
      lessons: [
        { id: 'p4-1', title: '4.1 Cmdlets PowerShell para auditoría (Test-NetConnection)', time: '45 min', requires: ['testnet', 'q-p4-1'] },
        { id: 'p4-2', title: '4.2 Evaluación práctica: Escaneo de target y reporte', time: '50 min', requires: ['f-ports', 'f-web', 'f-build'], afterAll: true }
      ]
    }
  ]
};

// Qué sabrá hacer el alumno al terminar (se muestra en el temario y en el aula).
export const COURSE_OBJECTIVES = [
  'Diagnosticar la red desde la consola de Windows con ipconfig, ping, tracert y netstat.',
  'Escanear puertos y detectar servicios, versiones y sistema operativo con Nmap.',
  'Enumerar servicios expuestos (HTTP, SMB, RPC y RDP) y reconocer su riesgo.',
  'Documentar los hallazgos en un reporte de auditoría básico.'
];

// Video de apoyo en español (YouTube, se inserta con youtube-nocookie). `start` en segundos.
export const COURSE_VIDEO = {
  id: 'qRE0AmeYFi4',
  title: 'Aprende Nmap desde CERO: escaneo de puertos y vulnerabilidades',
  author: 'Anormalix',
  duration: '16:50',
  chapters: [
    { start: 0, label: 'Inicio' },
    { start: 26, label: 'Fases de un ethical hacking' },
    { start: 73, label: '¿Qué es Nmap?' },
    { start: 159, label: 'Host discovery' },
    { start: 171, label: 'Escaneo de puertos' },
    { start: 287, label: 'Three-way handshake' },
    { start: 355, label: '¿Cómo escanea Nmap por defecto?' },
    { start: 464, label: 'Stealth scan (-sS)' },
    { start: 544, label: 'Modo agresivo (-A)' },
    { start: 763, label: 'Evasión de firewall con fragmentación' },
    { start: 833, label: 'Encontrar vulnerabilidades' },
    { start: 952, label: 'Conclusiones' }
  ]
};

// Ficha de cada lección: objetivo, explicación breve y (si aplica) el tramo del video que la cubre.
// La práctica sale de `requires` + STEP_HINTS, así que no se repite aquí.
export const LESSON_DETAILS = {
  'p1-1': {
    objective: 'Conocer la configuración de red de tu equipo y comprobar si el objetivo responde.',
    summary: 'ipconfig /all muestra la IP, la máscara, la puerta de enlace y los DNS de cada interfaz: es tu punto de partida. ping envía paquetes ICMP para medir si el objetivo es alcanzable y con qué latencia. Si no responde no significa que esté apagado: muchos firewalls bloquean ICMP.'
  },
  'p1-2': {
    objective: 'Trazar la ruta hasta el objetivo y ver qué conexiones y puertos tiene abiertos tu propio equipo.',
    summary: 'tracert descubre cada router (salto) entre tu equipo y el objetivo aumentando el TTL de los paquetes. netstat -ano lista las conexiones activas y los puertos en escucha junto al PID del proceso, útil para saber qué expone tu propia máquina.'
  },
  'p1-3': {
    objective: 'Saber con qué identidad y privilegios trabajas antes de lanzar herramientas.',
    summary: 'whoami /priv muestra los privilegios del token de tu sesión. Algunas técnicas (como el escaneo SYN de Nmap) necesitan permisos de administrador, y en una auditoría real conocer tus privilegios define qué puedes y qué no puedes hacer.'
  },
  'p2-1': {
    objective: 'Instalar Nmap en Windows y entender su sintaxis y los estados de un puerto.',
    summary: 'En Windows Nmap se instala junto al driver Npcap. La sintaxis es nmap [opciones] objetivo. Sin opciones escanea los 1000 puertos TCP más comunes y clasifica cada uno como open (abierto), closed (cerrado) o filtered (un firewall no deja saberlo).',
    video: { start: 73, label: '¿Qué es Nmap?' }
  },
  'p2-2': {
    objective: 'Elegir el tipo de escaneo y los flags adecuados para cada situación.',
    summary: '-sS hace un escaneo SYN "medio abierto": no completa el three-way handshake, es rápido y discreto. -sV consulta cada servicio para averiguar su versión. -Pn omite el descubrimiento de host (útil cuando se bloquea ICMP). Con -p eliges puertos (-p 1-1024) y puedes escanear rangos como 10.128.44.0/24.',
    video: { start: 171, label: 'Escaneo de puertos y handshake' }
  },
  'p2-3': {
    objective: 'Identificar versiones de servicios y el sistema operativo del objetivo.',
    summary: '-O compara la forma en que el objetivo responde a paquetes TCP/IP con una base de huellas para adivinar su sistema operativo. El modo agresivo -A combina -sV, -O, scripts NSE y traceroute: da mucha información, pero hace mucho ruido en la red.',
    video: { start: 544, label: 'Modo agresivo (-A)' }
  },
  'p3-1': {
    objective: 'Obtener información de un servidor web a partir de sus cabeceras HTTP.',
    summary: 'curl -I pide solo las cabeceras de la respuesta. Cabeceras como Server o X-Powered-By suelen revelar el software y su versión (banner grabbing), algo que luego puedes cruzar con bases de vulnerabilidades conocidas.'
  },
  'p3-2': {
    objective: 'Detectar SMB (445) y RPC (135) expuestos y entender por qué importan.',
    summary: 'SMB sirve para compartir archivos e impresoras en Windows y ha tenido fallos críticos como EternalBlue (MS17-010). RPC (135) es el mapeador de servicios de Windows. Que estén accesibles desde fuera de la red interna es un hallazgo a reportar.'
  },
  'p3-3': {
    objective: 'Comprobar si el escritorio remoto (RDP) está expuesto.',
    summary: 'RDP (3389) permite controlar el equipo a distancia. Expuesto a Internet es blanco de ataques de fuerza bruta y de vulnerabilidades como BlueKeep (CVE-2019-0708). Test-NetConnection -Port 3389 confirma si el puerto acepta conexiones.'
  },
  'p4-1': {
    objective: 'Auditar puertos con PowerShell sin instalar herramientas adicionales.',
    summary: 'Test-NetConnection viene incluido en Windows. Con -ComputerName y -Port comprueba si un puerto TCP acepta conexiones (TcpTestSucceeded : True). Es ideal cuando no puedes instalar Nmap y se puede automatizar en scripts.'
  },
  'p4-2': {
    objective: 'Aplicar todo el proceso sobre el objetivo y documentar los hallazgos.',
    summary: 'Repite el ciclo completo: reconocimiento, escaneo de puertos, detección de versiones y enumeración de servicios. Por cada hallazgo anota la evidencia (el comando y su salida), el riesgo y una recomendación. Recuerda: estas técnicas solo se usan en sistemas con autorización.'
  }
};

// Pregunta de comprobación de cada lección. La respuesta correcta NO está aquí: la valida el servidor.
export const QUIZZES = {
  'p1-1': { step: 'q-p1-1', question: 'Haces ping al objetivo y no responde. ¿Qué puedes concluir?', options: [
    ['a', 'Que el equipo está apagado.'],
    ['b', 'Que puede estar activo pero bloqueando ICMP con un firewall.'],
    ['c', 'Que la red del laboratorio no existe.'],
    ['d', 'Que tienes que reiniciar tu equipo.']] },
  'p1-2': { step: 'q-p1-2', question: '¿Qué muestra netstat -ano?', options: [
    ['a', 'Los routers (saltos) hasta el objetivo.'],
    ['b', 'La IP pública de tu conexión.'],
    ['c', 'Las conexiones y puertos en escucha de tu equipo, con su PID.'],
    ['d', 'Los usuarios del dominio.']] },
  'p1-3': { step: 'q-p1-3', question: '¿Para qué sirve whoami /priv antes de una auditoría?', options: [
    ['a', 'Para ver los privilegios de la sesión con la que trabajas.'],
    ['b', 'Para cambiar tu contraseña.'],
    ['c', 'Para escanear puertos.'],
    ['d', 'Para elevar tus privilegios automáticamente.']] },
  'p2-1': { step: 'q-p2-1', question: 'Nmap marca un puerto como "filtered". ¿Qué significa?', options: [
    ['a', 'Que está abierto.'],
    ['b', 'Que está cerrado y responde.'],
    ['c', 'Que un firewall impide saber si está abierto o cerrado.'],
    ['d', 'Que el servicio tiene una vulnerabilidad.']] },
  'p2-2': { step: 'q-p2-2', question: 'El objetivo bloquea el ping. ¿Qué flag de Nmap omite el descubrimiento de host?', options: [
    ['a', '-sV'],
    ['b', '-Pn'],
    ['c', '-O'],
    ['d', '-p-']] },
  'p2-3': { step: 'q-p2-3', question: '¿Qué hace el modo agresivo -A de Nmap?', options: [
    ['a', 'Solo acelera el escaneo.'],
    ['b', 'Ataca al objetivo para explotarlo.'],
    ['c', 'Oculta tu dirección IP.'],
    ['d', 'Combina detección de versiones, sistema operativo, scripts y traceroute.']] },
  'p3-1': { step: 'q-p3-1', question: '¿Qué cabecera HTTP suele revelar el software del servidor web?', options: [
    ['a', 'Content-Type'],
    ['b', 'Server'],
    ['c', 'Date'],
    ['d', 'Accept']] },
  'p3-2': { step: 'q-p3-2', question: '¿Por qué tener SMB (445) accesible es un hallazgo a reportar?', options: [
    ['a', 'Expone recursos compartidos y ha tenido fallos críticos como EternalBlue.'],
    ['b', 'Porque hace que la red vaya lenta.'],
    ['c', 'Porque consume mucho ancho de banda.'],
    ['d', 'No es un hallazgo: es un puerto normal.']] },
  'p3-3': { step: 'q-p3-3', question: '¿Qué puerto usa por defecto el Escritorio remoto (RDP)?', options: [
    ['a', '22'],
    ['b', '445'],
    ['c', '3389'],
    ['d', '8080']] },
  'p4-1': { step: 'q-p4-1', question: 'En la salida de Test-NetConnection, ¿qué campo confirma que el puerto acepta conexiones?', options: [
    ['a', 'PingSucceeded'],
    ['b', 'RemoteAddress'],
    ['c', 'InterfaceAlias'],
    ['d', 'TcpTestSucceeded : True']] }
};

// Reto final (lección 4.2): respuestas que solo se obtienen usando la consola sobre el objetivo.
export const FINAL_CHALLENGE = [
  { step: 'f-ports', question: '¿Cuántos puertos TCP abiertos tiene el objetivo?', placeholder: 'Un número' },
  { step: 'f-web', question: '¿Qué software y versión responde como servidor web en el puerto 80?', placeholder: 'Ej.: apache/2.4.1' },
  { step: 'f-build', question: '¿Qué número de build de Windows Server detecta Nmap en el objetivo?', placeholder: 'Un número' }
];

// Pista de nivel 1 (concepto) para cada paso; el nivel 2 es el comando exacto (STEP_HINTS).
export const STEP_CONCEPTS = {
  'ipconfig': 'Revisa la configuración IP completa de tu propia interfaz.',
  'ping': 'Comprueba si el objetivo responde a paquetes ICMP enviando solo unos pocos.',
  'tracert': 'Traza la ruta hasta el objetivo sin resolver nombres DNS.',
  'netstat': 'Lista todas las conexiones y puertos de tu equipo con el PID de cada proceso.',
  'whoami': 'Consulta qué privilegios tiene el usuario con el que trabajas.',
  'nmap-basic': 'Haz un escaneo básico de puertos del objetivo con Nmap.',
  'nmap-sv': 'Vuelve a escanear pidiendo las versiones de los servicios y sin descubrimiento por ping.',
  'nmap-os': 'Pide a Nmap que intente identificar el sistema operativo.',
  'curl': 'Pide solo las cabeceras HTTP del servidor web del objetivo.',
  'smb': 'Comprueba con PowerShell si el puerto de SMB acepta conexiones.',
  'rdp': 'Comprueba con PowerShell si el puerto del Escritorio remoto acepta conexiones.',
  'testnet': 'Prueba con PowerShell la conexión al puerto web (80) del objetivo.'
};

// Información pública del curso (página de inicio antes del login).
export const COURSE_INFO = {
  audience: 'Para quien empieza en ciberseguridad o trabaja en soporte y sistemas con Windows. No necesitas experiencia previa en hacking.',
  requirements: [
    'Saber usar Windows a nivel de usuario.',
    'Una cuenta de Google para entrar.',
    'Nada que instalar: la consola del laboratorio funciona en el navegador.'
  ],
  // Presentación del instructor: edítala con tus datos reales.
  instructor: {
    name: 'Equipo Dev101x',
    bio: 'Formación práctica en ciberseguridad e inteligencia artificial, con laboratorios guiados y contenido en español.'
  },
  faq: [
    ['¿Tengo que instalar algo?', 'No. La terminal del laboratorio es simulada y funciona en el navegador. Si quieres practicar en tu equipo, en Recursos tienes la descarga oficial de Nmap.'],
    ['¿Es legal lo que se practica?', 'Sí, dentro del laboratorio: el objetivo es simulado. Fuera de él, estas técnicas solo se usan en sistemas propios o con autorización expresa.'],
    ['¿Cómo se mide mi avance?', 'Cada lección se completa con sus comandos en la consola y una pregunta de comprobación. El curso termina con un reto final sobre el objetivo.'],
    ['¿Cómo entro?', 'Con tu cuenta de Google. Solo usamos tu nombre, correo y foto de perfil.']
  ]
};

// Pasos que la consola reconoce y qué hay que escribir para conseguirlos (se muestran como pista).
export const STEP_HINTS = {
  'ipconfig': 'ipconfig /all',
  'ping': `ping -n 3 ${LAB_TARGET}`,
  'tracert': `tracert -d ${LAB_TARGET}`,
  'netstat': 'netstat -ano',
  'whoami': 'whoami /priv',
  'nmap-basic': `nmap ${LAB_TARGET}`,
  'nmap-sv': `nmap -sV -Pn ${LAB_TARGET}`,
  'nmap-os': `nmap -O ${LAB_TARGET}`,
  'curl': `curl -I http://${LAB_TARGET}`,
  'smb': `Test-NetConnection -ComputerName ${LAB_TARGET} -Port 445`,
  'rdp': `Test-NetConnection -ComputerName ${LAB_TARGET} -Port 3389`,
  'testnet': `Test-NetConnection -ComputerName ${LAB_TARGET} -Port 80`
};

// Laboratorios: se completan cuando se cumplen todos los pasos de `all` y al menos uno de `any`.
export const LAB_STEPS = [
  { id: 'lab-1', icon: 'radar', title: 'Escaneo de puertos y servicios', hint: `Escanea ${LAB_TARGET} con nmap y detecta versiones (-sV)`, all: ['nmap-basic', 'nmap-sv'], any: [] },
  { id: 'lab-2', icon: 'lan', title: 'Diagnóstico de red y rutas', hint: `Revisa tu interfaz con ipconfig y comprueba la ruta al objetivo con ping o tracert`, all: ['ipconfig'], any: ['ping', 'tracert'] },
  { id: 'lab-3', icon: 'shield_person', title: 'Enumeración y privilegios', hint: 'Revisa tus privilegios con whoami y enumera servicios con netstat, curl o Test-NetConnection', all: ['whoami'], any: ['netstat', 'testnet', 'curl'] }
];

// Habilidades del perfil, calculadas a partir de los pasos completados.
export const SKILLS = [
  { name: 'Nmap Network Scanning', steps: ['nmap-basic', 'nmap-sv', 'nmap-os'] },
  { name: 'Consola Windows & PowerShell', steps: ['ipconfig', 'ping', 'tracert', 'netstat', 'testnet'] },
  { name: 'Enumeración SMB & RDP', steps: ['smb', 'rdp'] },
  { name: 'Banner grabbing HTTP', steps: ['curl'] },
  { name: 'Análisis de Tokens de Seguridad', steps: ['whoami'] }
];

export const NMAP_RESOURCES = [
  {
    category: "Descargas Oficiales & Binarios Windows",
    categoryShort: "Descargas Windows",
    icon: "download",
    items: [
      {
        title: "Portal Oficial de Descargas de Nmap (Windows)",
        desc: "Página web oficial de nmap.org donde se publican los instaladores para Windows, notas de versión y sumas de verificación SHA-256.",
        url: "https://nmap.org/download.html#windows",
        badge: "PORTAL NMAP",
        badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-300"
      },
      {
        title: "Portal Oficial de Binarios Portables Windows",
        desc: "Página oficial para obtener paquetes ZIP independientes y utilidades CLI sin necesidad de instalador en Windows.",
        url: "https://nmap.org/download.html#windows",
        badge: "PORTAL NMAP",
        badgeClass: "bg-sky-100 text-sky-800 border-sky-300"
      },
      {
        title: "Npcap Driver Oficial (Captura de Paquetes en Windows)",
        desc: "Controlador y biblioteca de bajo nivel para captura e inyección de paquetes en Windows. Obligatorio para escaneos SYN y raw sockets.",
        url: "https://npcap.com/#download",
        badge: "DRIVER NPCAP",
        badgeClass: "bg-amber-100 text-amber-800 border-amber-300"
      },
      {
        title: "Zenmap GUI Oficial para Windows",
        desc: "Interfaz gráfica oficial de Nmap multiplataforma con visor interactivo de topologías de red y perfiles predefinidos.",
        url: "https://nmap.org/zenmap/",
        badge: "GUI ZENMAP",
        badgeClass: "bg-purple-100 text-purple-800 border-purple-300"
      },
      {
        title: "Ncat: La Navaja Suiza de Red para Windows",
        desc: "Reimplementación moderna de Netcat por el equipo de Nmap con soporte nativo de SSL/TLS, proxies y redirección de puertos.",
        url: "https://nmap.org/ncat/",
        badge: "NCAT CLI",
        badgeClass: "bg-slate-100 text-slate-800 border-slate-300"
      },
      {
        title: "Ndiff: Comparador de Resultados XML",
        desc: "Herramienta CLI para comparar dos escaneos Nmap en formato XML e identificar cambios en puertos y servicios de la red.",
        url: "https://nmap.org/ndiff/",
        badge: "DIFF TOOL",
        badgeClass: "bg-slate-100 text-slate-800 border-slate-300"
      },
      {
        title: "Nping: Generador de Paquetes y Diagnóstico",
        desc: "Utilidad de generación arbitraria de paquetes TCP, UDP, ICMP y análisis de respuestas de firewall y latencia.",
        url: "https://nmap.org/nping/",
        badge: "NPING CLI",
        badgeClass: "bg-slate-100 text-slate-800 border-slate-300"
      }
    ]
  },
  {
    category: "Documentación Oficial & Libro Canónico",
    categoryShort: "Libro & Documentación",
    icon: "menu_book",
    items: [
      {
        title: "Libro Oficial: 'Nmap Network Scanning' (Gordon Fyodor)",
        desc: "Obra canónica completa de 500+ páginas escrita por el creador de Nmap sobre teoría de redes y auditoría ofensiva.",
        url: "https://nmap.org/book/",
        badge: "LIBRO COMPLETO",
        badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-300"
      },
      {
        title: "Guía de Referencia Oficial de Nmap en Español",
        desc: "Manual completo traducido al español (man page) con la totalidad de banderas, parámetros y opciones documentadas.",
        url: "https://nmap.org/man/es/",
        badge: "MANUAL ESPAÑOL",
        badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-300"
      },
      {
        title: "Guía de Instalación Específica en Microsoft Windows",
        desc: "Capítulo dedicado a la instalación, dependencias de registro, integración con PowerShell y troubleshooting en Windows.",
        url: "https://nmap.org/book/inst-windows.html",
        badge: "WINDOWS GUIDE",
        badgeClass: "bg-sky-100 text-sky-800 border-sky-300"
      },
      {
        title: "Técnicas de Escaneo de Puertos (-sS, -sT, -sU, -sA)",
        desc: "Documentación exhaustiva sobre cómo Nmap manipula los flags TCP (SYN, ACK, FIN, Xmas, Null) para determinar estados de puerto.",
        url: "https://nmap.org/book/man-port-scanning-techniques.html",
        badge: "TÉCNICAS TCP/UDP",
        badgeClass: "bg-indigo-100 text-indigo-800 border-indigo-300"
      },
      {
        title: "Detección de Versiones y Banners (-sV)",
        desc: "Metodología del motor de detección de servicios y firmas de software mediante la base de datos nmap-service-probes.",
        url: "https://nmap.org/book/man-version-detection.html",
        badge: "VERSION PROBE",
        badgeClass: "bg-amber-100 text-amber-800 border-amber-300"
      },
      {
        title: "Detección Remota de Sistema Operativo (-O)",
        desc: "Análisis del fingerprinting TCP/IP stack: cómo Nmap deduce el kernel remoto mediante sondas ISN, TCP options y ventana.",
        url: "https://nmap.org/book/man-os-detection.html",
        badge: "OS DETECTION",
        badgeClass: "bg-purple-100 text-purple-800 border-purple-300"
      },
      {
        title: "Evasión de Firewalls e IDS/IPS (-f, -D, --mtu)",
        desc: "Técnicas de fragmentación de paquetes, señuelos (decoys), falsificación de dirección MAC/origen y payloads personalizados.",
        url: "https://nmap.org/book/man-bypass-firewalls-ids.html",
        badge: "EVASIÓN FIREWALL",
        badgeClass: "bg-rose-100 text-rose-800 border-rose-300"
      },
      {
        title: "Formatos de Salida para Reportes (-oA, -oX, -oN, -oG)",
        desc: "Exportación de hallazgos en formato Normal, XML, Grepable o script-kiddie para procesamiento en pipelines de auditoría.",
        url: "https://nmap.org/book/man-output.html",
        badge: "REPORTES XML",
        badgeClass: "bg-slate-100 text-slate-800 border-slate-300"
      }
    ]
  },
  {
    category: "Nmap Scripting Engine (NSE) & Scripts Críticos",
    categoryShort: "Scripts NSE & CVEs",
    icon: "code",
    items: [
      {
        title: "Portal Oficial de Documentación de Scripts NSE (NSEdoc)",
        desc: "Directorio completo con los más de 600 scripts Lua integrados en Nmap, categorizados y con ejemplos de sintaxis.",
        url: "https://nmap.org/nsedoc/",
        badge: "NSEDOC OFICIAL",
        badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-300"
      },
      {
        title: "Categoría 'vuln' (Detección de Vulnerabilidades)",
        desc: "Colección de scripts para verificar fallos conocidos específicos como MS17-010, SSL Heartbleed, Log4j y otros.",
        url: "https://nmap.org/nsedoc/categories/vuln.html",
        badge: "NSE VULN",
        badgeClass: "bg-red-100 text-red-800 border-red-300"
      },
      {
        title: "Categoría 'discovery' (Mapeo y Enumeración)",
        desc: "Scripts para interrogar registros de Active Directory, recursos compartidos SMB, tablas de rutas y nombres NetBIOS.",
        url: "https://nmap.org/nsedoc/categories/discovery.html",
        badge: "NSE DISCOVERY",
        badgeClass: "bg-sky-100 text-sky-800 border-sky-300"
      },
      {
        title: "Categoría 'auth' (Auditoría de Credenciales)",
        desc: "Verificación de credenciales por defecto o ataques de diccionario en SSH, Telnet, SMB, RDP, MySQL y MSSQL.",
        url: "https://nmap.org/nsedoc/categories/auth.html",
        badge: "NSE AUTH",
        badgeClass: "bg-amber-100 text-amber-800 border-amber-300"
      },
      {
        title: "Categoría 'safe' (Scripts No Invasivos)",
        desc: "Scripts diseñados para entornos de producción de alta disponibilidad que no generan caídas ni sobrecarga de red.",
        url: "https://nmap.org/nsedoc/categories/safe.html",
        badge: "NSE SAFE",
        badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-300"
      },
      {
        title: "Script: smb-os-discovery.nse (Enumeración Windows)",
        desc: "Extrae el nombre de dominio, versión de Windows Server, edición de build y hora del servidor a través de SMB (puerto 445).",
        url: "https://nmap.org/nsedoc/scripts/smb-os-discovery.html",
        badge: "SMB ENUM",
        badgeClass: "bg-teal-100 text-teal-800 border-teal-300"
      },
      {
        title: "Script: smb-vuln-ms17-010.nse (Auditoría EternalBlue)",
        desc: "Comprueba si un sistema Windows Server es vulnerable al exploit EternalBlue en el protocolo SMBv1.",
        url: "https://nmap.org/nsedoc/scripts/smb-vuln-ms17-010.html",
        badge: "MS17-010",
        badgeClass: "bg-rose-100 text-rose-800 border-rose-300"
      },
      {
        title: "Script: vulners.nse (Integración de CVEs de Vulners)",
        desc: "Mapea las versiones de servicios detectadas con las bases de datos de vulnerabilidades CVE de Vulners.com.",
        url: "https://github.com/vulnersCom/nmap-vulners",
        badge: "CVE VULNERS",
        badgeClass: "bg-purple-100 text-purple-800 border-purple-300"
      },
      {
        title: "Script: http-enum.nse (Fuzzing y Enumeración Web)",
        desc: "Enumera directorios, paneles de administración y aplicaciones web estándar en servidores HTTP/HTTPS.",
        url: "https://nmap.org/nsedoc/scripts/http-enum.html",
        badge: "HTTP ENUM",
        badgeClass: "bg-indigo-100 text-indigo-800 border-indigo-300"
      },
      {
        title: "Script: ssl-enum-ciphers.nse (Auditoría de Cifrados SSL)",
        desc: "Inspecciona los algoritmos de cifrado y versiones TLS soportadas por el servidor web para detectar cifrados débiles.",
        url: "https://nmap.org/nsedoc/scripts/ssl-enum-ciphers.html",
        badge: "SSL CIPHERS",
        badgeClass: "bg-cyan-100 text-cyan-800 border-cyan-300"
      }
    ]
  },
  {
    category: "Cheat Sheets, Repositorios & Estándares RFC",
    categoryShort: "Cheat Sheets & RFCs",
    icon: "terminal",
    items: [
      {
        title: "Repositorio Oficial de Nmap en GitHub",
        desc: "Código fuente abierto de Nmap en C/C++ y scripts Lua mantenido por Gordon Lyon y la comunidad global de seguridad.",
        url: "https://github.com/nmap/nmap",
        badge: "GITHUB NMAP",
        badgeClass: "bg-slate-100 text-slate-800 border-slate-300"
      },
      {
        title: "Repositorio de Npcap en GitHub",
        desc: "Código fuente y rastreador de incidencias del controlador de captura de paquetes Npcap para Windows.",
        url: "https://github.com/nmap/npcap",
        badge: "GITHUB NPCAP",
        badgeClass: "bg-slate-100 text-slate-800 border-slate-300"
      },
      {
        title: "SANS Institute Nmap Cheat Sheet Oficial",
        desc: "Póster de referencia técnica rápida de SANS con los comandos más utilizados en auditorías y defensas de red.",
        url: "https://www.sans.org/posters/nmap-cheat-sheet/",
        badge: "SANS POSTER",
        badgeClass: "bg-indigo-100 text-indigo-800 border-indigo-300"
      },
      {
        title: "StationX Nmap Cheat Sheet Completo",
        desc: "Guía interactiva completa con sintaxis rápida, flags esenciales y casos de uso en pruebas de penetración.",
        url: "https://www.stationx.net/nmap-cheat-sheet/",
        badge: "STATIONX GUÍA",
        badgeClass: "bg-sky-100 text-sky-800 border-sky-300"
      },
      {
        title: "RFC 793 - Protocolo de Control de Transmisión (TCP)",
        desc: "Especificación formal de los estados TCP (SYN, ACK, RST, FIN, LISTEN) en los que se basan los escaneos de Nmap.",
        url: "https://www.ietf.org/rfc/rfc793.txt",
        badge: "RFC 793 TCP",
        badgeClass: "bg-slate-100 text-slate-800 border-slate-300"
      },
      {
        title: "RFC 792 - Protocolo de Mensajes de Control de Internet (ICMP)",
        desc: "Estándar formal para paquetes Echo Request / Echo Reply y mensajes de Host/Port Unreachable.",
        url: "https://www.ietf.org/rfc/rfc792.txt",
        badge: "RFC 792 ICMP",
        badgeClass: "bg-slate-100 text-slate-800 border-slate-300"
      }
    ]
  }
];

// ==========================================
// COMANDOS Y EXPLICACIONES TÉCNICAS (PENTESTING EN WINDOWS)
// ==========================================
export const PENTESTING_COMMANDS = {
  nmap: {
    key: "nmap",
    name: "nmap.exe",
    cmd: "nmap -sV -sS -Pn 10.128.44.12",
    badge: "ESCÁNER OFENSIVO",
    badgeClass: "bg-emerald-100 text-emerald-800 border border-emerald-300",
    title: "Nmap: Escaneo Sigiloso de Puertos y Detección de Versiones",
    category: "Fase 2: Escaneo & Detección Activa",
    purpose: "Escanear puertos TCP de forma no intrusiva mediante paquetes SYN y determinar los nombres exactos y versiones de los demonios/servicios en escucha en el servidor objetivo, sin completar el handshake TCP de 3 vías.",
    flags: [
      { flag: "-sS", name: "SYN Stealth Scan", desc: "Escaneo sigiloso medio abierto: envía paquetes SYN y responde con RST al recibir SYN-ACK, evitando la conexión completa y reduciendo registros en el host remoto." },
      { flag: "-sV", name: "Version Detection", desc: "Interroga activamente los puertos abiertos con firmas de aplicación para identificar versiones exactas (ej: Nginx 1.24.0, Windows SMB)." },
      { flag: "-Pn", name: "No Ping Probe", desc: "Asume que el host está activo y omite la verificación previa por ICMP, indispensable contra firewalls de Windows que descartan pings." },
      { flag: "-p <puertos>", name: "Rango de Puertos", desc: "Especifica puertos objetivo concretos (ej: -p 80,443,445,3389) para ahorrar tiempo y ancho de banda en la auditoría." }
    ],
    officialLinks: [
      { label: "Portal de Descargas Windows (nmap.org)", url: "https://nmap.org/download.html#windows", icon: "download", badge: "PORTAL" },
      { label: "Npcap Driver Oficial (Kernel)", url: "https://npcap.com/#download", icon: "download", badge: "NPCAP" },
      { label: "Libro Oficial: Escaneo SYN (-sS)", url: "https://nmap.org/book/man-port-scanning-techniques.html", icon: "menu_book", badge: "BOOK" },
      { label: "Libro Oficial: Detección Versiones (-sV)", url: "https://nmap.org/book/man-version-detection.html", icon: "menu_book", badge: "BOOK" },
      { label: "Libro Oficial: Omitir Ping (-Pn)", url: "https://nmap.org/book/man-bypass-firewalls-ids.html", icon: "menu_book", badge: "BOOK" },
      { label: "Guía Instalación en Windows", url: "https://nmap.org/book/inst-windows.html", icon: "laptop_windows", badge: "DOC" },
      { label: "Directorio Oficial Scripts NSE (600+)", url: "https://nmap.org/nsedoc/", icon: "code", badge: "NSE" }
    ],
    windowsContext: "En Windows, Nmap aprovecha el controlador de captura e inyección Npcap (modo WinPcap compatible). Ejecutarlo desde PowerShell permite a un auditor evaluar la red corporativa directamente desde una estación interna autorizada, sin alertar a los switches con dispositivos no reconocidos.",
    findings: "El escaneo sobre 10.128.44.12 expone los puertos 80/443 (Nginx 1.24.0 en Windows), 135 (RPC) y notablemente 445 (SMB Windows Server 2022) y 3389 (RDP). El puerto 445 es el vector primario para auditorías de autenticación NTLM y recursos compartidos.",
    sampleOutput: "80/tcp open http (nginx/1.24.0) | 445/tcp open microsoft-ds (Windows Server 2022) | 3389/tcp open RDP"
  },
  ipconfig: {
    key: "ipconfig",
    name: "ipconfig.exe",
    cmd: "ipconfig /all",
    badge: "HOST LOCAL",
    badgeClass: "bg-sky-100 text-sky-800 border border-sky-300",
    title: "ipconfig: Diagnóstico de Adaptadores y Segmentación de Red",
    category: "Fase 1: Reconocimiento Local",
    purpose: "Determinar la dirección IPv4 local del auditor, la máscara de subred, el gateway predeterminado, servidores DNS corporativos y sufijos de dominio interno.",
    flags: [
      { flag: "/all", name: "Configuración Completa", desc: "Muestra la configuración exhaustiva de todos los adaptadores físicos y virtuales, direcciones MAC y asignación DHCP." },
      { flag: "/displaydns", name: "Caché DNS", desc: "Inspecciona la memoria caché de resolución DNS local de Windows para identificar dominios y servicios recientemente consultados." },
      { flag: "/flushdns", name: "Vaciar Caché", desc: "Purga las entradas DNS locales obligando al sistema a enviar nuevas consultas a los servidores DNS autoritativos." }
    ],
    windowsContext: "Binario nativo presente en System32 de todas las versiones de Windows. Es el primer comando que un auditor ejecuta al obtener acceso para calcular el rango CIDR de la subred local (ej: 10.128.44.0/24) y definir el alcance del escaneo de Nmap.",
    findings: "La estación de auditoría posee la IP 10.128.44.5 con máscara 255.255.255.0 y gateway 10.128.44.1. Esto establece que el target 10.128.44.12 se encuentra en el mismo segmento L2 sin cortafuegos de salto intermedio.",
    sampleOutput: "IPv4: 10.128.44.5 | Máscara: 255.255.255.0 | Gateway: 10.128.44.1 | DNS: lab.dev101x.internal"
  },
  whoami: {
    key: "whoami",
    name: "whoami.exe",
    cmd: "whoami /priv",
    badge: "TOKENS & PRIVILEGIOS",
    badgeClass: "bg-amber-100 text-amber-800 border border-amber-300",
    title: "whoami: Identidad y Tabla de Privilegios del Token de Seguridad",
    category: "Fase 1: Enumeración de Privilegios",
    purpose: "Identificar el usuario y dominio activo, y auditar los privilegios de seguridad asignados al Access Token del proceso en el subsistema LSASS de Windows.",
    flags: [
      { flag: "/priv", name: "Privilegios del Token", desc: "Lista todos los privilegios asignados al token (ej: SeImpersonatePrivilege, SeDebugPrivilege) y su estado (Habilitado/Deshabilitado)." },
      { flag: "/groups", name: "Grupos de Seguridad", desc: "Muestra las membresías de grupos locales y de dominio (ej: Administrators, Remote Desktop Users)." },
      { flag: "/all", name: "Información Total", desc: "Vuelca simultáneamente identidad, SID del usuario, grupos y tabla completa de privilegios." }
    ],
    windowsContext: "En Windows, el modelo de control de acceso se basa en privilegios del token y no únicamente en el ID de usuario. La presencia de privilegios como SeImpersonatePrivilege habilita la escalada vertical directa a SYSTEM mediante técnicas como JuicyPotato o PrintSpoofer.",
    findings: "El usuario dev101x-lab\\analyst01 opera bajo un token estándar con privilegios restringidos (SeChangeNotifyPrivilege). Esto descarta la suplantación directa de token local y define que la vía de compromiso pasa por explotar servicios de red vulnerables.",
    sampleOutput: "dev101x-lab\\analyst01 | SeChangeNotifyPrivilege: Habilitado | Token: Estándar (No Elevado)"
  },
  ping: {
    key: "ping",
    name: "ping.exe",
    cmd: "ping -n 3 10.128.44.12",
    badge: "SONDEO ICMP",
    badgeClass: "bg-indigo-100 text-indigo-800 border border-indigo-300",
    title: "ping: Conectividad ICMP y Detección de Sistema Operativo por TTL",
    category: "Fase 1: Descubrimiento de Red",
    purpose: "Evaluar la disponibilidad y latencia del objetivo mediante paquetes ICMP Echo Request y deducir la familia de sistema operativo a partir del valor TTL (Time To Live).",
    flags: [
      { flag: "-n <conteo>", name: "Número de Pings", desc: "En Windows envía 4 paquetes por defecto; con -n se especifica el conteo exacto para acelerar la auditoría." },
      { flag: "-l <bytes>", name: "Tamaño de Buffer", desc: "Define el tamaño del payload de datos en bytes para evaluar MTU y reglas de fragmentación de paquetes." },
      { flag: "-a", name: "Resolución Inversa", desc: "Intenta resolver la dirección IP a su nombre NetBIOS o DNS inverso." }
    ],
    windowsContext: "El kernel de Windows responde de manera nativa con un TTL inicial de 128 para paquetes ICMP (a diferencia de Linux que usa 64 y routers Cisco que usan 255). Esto permite al auditor identificar el tipo de SO remoto de manera casi instantánea y pasiva.",
    findings: "El servidor 10.128.44.12 responde con tiempo=1ms y TTL=128, confirmando de inmediato que el objetivo está encendido, responde a ICMP y ejecuta un sistema operativo de la familia Windows NT.",
    sampleOutput: "Respuesta desde 10.128.44.12: bytes=32 tiempo=1ms TTL=128 (Windows NT Kernel)"
  },
  tracert: {
    key: "tracert",
    name: "tracert.exe",
    cmd: "tracert -d 10.128.44.12",
    badge: "ENRUTAMIENTO",
    badgeClass: "bg-purple-100 text-purple-800 border border-purple-300",
    title: "tracert: Mapeo de Rutas y Saltos Intermedios",
    category: "Fase 1: Topología de Red",
    purpose: "Identificar los routers, pasarelas y saltos intermedios entre la estación Windows del auditor y el servidor destino.",
    flags: [
      { flag: "-d", name: "Sin Resolución DNS", desc: "Evita resolver las IPs intermedias en nombres de host, acelerando sustancialmente la traza de varios minutos a 1-2 segundos." },
      { flag: "-h <saltos>", name: "Límite de Saltos", desc: "Fija la cantidad máxima de saltos de búsqueda antes de detener la traza (por defecto 30)." },
      { flag: "-w <ms>", name: "Timeout", desc: "Milisegundos de espera para cada respuesta antes de marcar tiempo de espera agotado (*)." }
    ],
    windowsContext: "A diferencia del traceroute en Linux (que usa UDP por defecto), el tracert nativo de Windows envía paquetes ICMP Echo Request incrementando el campo TTL. Es esencial comprender esto porque los firewalls corporativos suelen tratar ICMP y UDP con reglas distintas.",
    findings: "La traza muestra un primer salto en 10.128.44.1 (gw-edge.lab) y el segundo salto directo en 10.128.44.12. No existen firewalls perimetrales intermedios bloqueando paquetes TTL expirados.",
    sampleOutput: "Salto 1: 10.128.44.1 (gw-edge) <1ms | Salto 2: 10.128.44.12 (srv-target) 1ms"
  },
  netstat: {
    key: "netstat",
    name: "netstat.exe",
    cmd: "netstat -ano",
    badge: "SOCKETS & CONEXIONES",
    badgeClass: "bg-cyan-100 text-cyan-800 border border-cyan-300",
    title: "netstat: Auditoría de Sockets, Conexiones Activas y PIDs",
    category: "Fase 2: Conexiones & Sockets",
    purpose: "Listar todos los puertos locales en escucha (LISTENING), conexiones activas (ESTABLISHED) hacia objetivos remotos y el PID del proceso responsable en Windows.",
    flags: [
      { flag: "-a", name: "Todas las Conexiones", desc: "Muestra todas las conexiones TCP/UDP activas y todos los puertos en estado de escucha del equipo." },
      { flag: "-n", name: "Formato Numérico", desc: "Muestra direcciones y puertos numéricamente sin consultar DNS, asegurando máxima rapidez." },
      { flag: "-o", name: "PID del Proceso", desc: "Despliega el Process ID (PID) de Windows asignado a cada conexión, permitiendo cruzarlo con 'tasklist'." },
      { flag: "-b", name: "Binario Responsable", desc: "(Requiere consola elevada) Muestra el nombre exacto del ejecutable .exe o servicio asociado al socket." }
    ],
    windowsContext: "Herramienta fundamental para detectar listeners ocultos, túneles SOCKS, backdoors o sesiones SMB activas establecidas por el auditor o por procesos sospechosos en el host Windows.",
    findings: "Se detecta una conexión ESTABLISHED desde 10.128.44.5:49712 hacia 10.128.44.12:445 vinculada al PID 4120. Esto confirma una sesión de transporte SMB activa contra el servidor objetivo.",
    sampleOutput: "TCP 10.128.44.5:49712 -> 10.128.44.12:445 ESTABLISHED (PID: 4120)"
  },
  curl: {
    key: "curl",
    name: "curl.exe",
    cmd: "curl -I http://10.128.44.12",
    badge: "BANNER GRABBING",
    badgeClass: "bg-emerald-100 text-emerald-800 border border-emerald-300",
    title: "curl: Banner Grabbing HTTP e Inspección de Cabeceras",
    category: "Fase 3: Enumeración Web",
    purpose: "Obtener las cabeceras HTTP de respuesta del servidor web sin descargar el cuerpo HTML completo, identificando tecnologías y versiones en producción.",
    flags: [
      { flag: "-I", name: "Head Request", desc: "Envía una petición HTTP HEAD solicitando únicamente los headers del servidor (Server, Content-Type, X-Powered-By)." },
      { flag: "-v", name: "Modo Detallado", desc: "Muestra la negociación completa de conexión TCP, handshake TLS y cabeceras enviadas y recibidas." },
      { flag: "-k", name: "Insecure (Ignorar SSL)", desc: "Permite conectarse a servicios HTTPS con certificados autofirmados o inválidos en laboratorios." },
      { flag: "-s", name: "Silent", desc: "Suprime medidores de progreso y errores para facilitar el parseo en scripts de PowerShell." }
    ],
    windowsContext: "curl.exe está integrado de forma nativa en System32 en Windows 10/11. Proporciona una herramienta CLI potente para auditar endpoints HTTP/REST y autenticaciones API sin instalar software adicional ni navegadores.",
    findings: "El objetivo responde con Server: nginx/1.24.0 (Windows) y X-Powered-By: Dev101x-VulnerableLab. Conocer la versión exacta 1.24.0 en Windows permite buscar vulnerabilidades de path traversal o denegación de servicio documentadas.",
    sampleOutput: "Server: nginx/1.24.0 (Windows) | X-Powered-By: Dev101x-VulnerableLab | HTTP 200 OK"
  },
  testnet: {
    key: "testnet",
    name: "Test-NetConnection",
    cmd: "Test-NetConnection -ComputerName 10.128.44.12 -Port 445",
    badge: "LIVING OFF THE LAND",
    badgeClass: "bg-teal-100 text-teal-800 border border-teal-300",
    title: "Test-NetConnection: Sondeo de Puertos Nativo en PowerShell",
    category: "Fase 3: Reconocimiento Sin Herramientas Externas",
    purpose: "Validar la apertura y accesibilidad de un puerto TCP específico usando únicamente PowerShell y binarios nativos firmados de Windows, sin descargar herramientas de terceros.",
    flags: [
      { flag: "-ComputerName", name: "Host Destino", desc: "Especifica la dirección IPv4 o nombre FQDN de la máquina remota a auditar." },
      { flag: "-Port", name: "Puerto TCP", desc: "Define el número del puerto TCP a comprobar (ej. 445 para SMB, 3389 para RDP, 80 para HTTP)." },
      { flag: "-InformationLevel Detailed", name: "Diagnóstico Completo", desc: "Devuelve información extendida sobre la interfaz de salida, gateway y resolución DNS." },
      { flag: "-CommonTCPPort", name: "Puerto Estándar", desc: "Permite usar alias como 'SMB', 'HTTP', 'RDP' en lugar de números de puerto." }
    ],
    windowsContext: "Técnica por excelencia Living-off-the-Land (LotL). En entornos corporativos donde AppLocker o el EDR bloquean la instalación de Nmap.exe, Test-NetConnection permite escanear y confirmar puertos abiertos utilizando una utilidad oficial y legítima de Microsoft.",
    findings: "TcpTestSucceeded: True en el puerto 445 confirma conectividad TCP directa hacia el servicio SMB de Windows Server 2022 en el objetivo, validando la ruta para pruebas de autenticación y recursos compartidos.",
    sampleOutput: "ComputerName: 10.128.44.12 | RemotePort: 445 | TcpTestSucceeded: True"
  }
};
