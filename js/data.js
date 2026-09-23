/**
 * Dev101x Platform - Master Data Repository
 * Sin menciones de versiones ni textos inflados
 */

const DEV101X_DATA = {
  telemetry: {
    status: "Activo",
    latency: "18ms",
    consensus: "Ed25519",
    standard: "ISO/IEC 17024",
    enclave: "AWS Nitro",
    rootLedgerHash: "0x81fa99...bc12"
  },

  currentUser: {
    id: "STU-101-DEV",
    name: "Dev101x",
    email: "dev101x@gmail.com",
    role: "student",
    avatar: "assets/dev101x_identicon.svg",
    level: "Especialista",
    adminStatus: "Activo",
    authProvider: "Google SSO",
    enabledCourseIds: ["pentesting-101"],
    completedLabs: 3,
    totalLabs: 5,
    practiceHours: 12,
    evalAverage: "94%",
    sessionSecurity: "Cifrado Seguro",
    skills: [
      { name: "Nmap Network Scanning", level: "Avanzado" },
      { name: "Consola Windows & PowerShell", level: "Avanzado" },
      { name: "Enumeración SMB & RPC", level: "Avanzado" },
      { name: "Scripts NSE (Vuln & Discovery)", level: "Intermedio" },
      { name: "Análisis de Tokens de Seguridad", level: "Avanzado" }
    ]
  },

  adminUser: {
    id: "ADM-101-ROOT",
    name: "Dev101x (Admin)",
    email: "admin@dev101x.io",
    role: "admin",
    avatar: "assets/dev101x_identicon.svg",
    title: "Administrador",
    authProvider: "Google SSO"
  },

  courses: [
    {
      id: "pentesting-101",
      title: "Pentesting 101: Fundamentos desde Windows",
      category: "cyber",
      categoryLabel: "CIBERSEGURIDAD",
      duration: "4 Semanas",
      description: "Reconocimiento y escaneo de puertos con Nmap usando la consola de Windows como plataforma de entrada.",
      badge: "WIN-PENTEST",
      totalEnrolled: "21",
      activeStudents: "7",
      percentCompleted: 40,
      userProgress: 40,
      userCurrentLesson: "2.2: Flags esenciales: -sS, -sV, -Pn",
      lessonId: "lesson-p2-2",
      activeModule: "Módulo 2: Escaneo con Nmap",
      modulesCount: 4,
      labsCount: 5,
      instructor: "Dev101x",
      syllabus: [
        {
          module: "Módulo 1: Reconocimiento y Redes en Windows",
          duration: "1 semana",
          completed: true,
          lessons: [
            { id: "p1-1", title: "1.1 Diagnóstico de interfaz: ipconfig y ping", done: true, time: "25 min" },
            { id: "p1-2", title: "1.2 Mapeo de rutas con tracert y netstat", done: true, time: "30 min" },
            { id: "p1-3", title: "1.3 Identidad y privilegios: whoami y PowerShell", done: true, time: "30 min" }
          ]
        },
        {
          module: "Módulo 2: Escaneo de Red con Nmap",
          duration: "1 semana",
          completed: false,
          current: true,
          lessons: [
            { id: "p2-1", title: "2.1 Nmap en Windows: instalación y sintaxis base", done: true, time: "35 min" },
            { id: "p2-2", title: "2.2 Flags esenciales: -sS, -sV, -Pn y rangos", done: false, active: true, time: "40 min" },
            { id: "p2-3", title: "2.3 Detección de versiones y sistemas operativos", done: false, time: "35 min" }
          ]
        },
        {
          module: "Módulo 3: Enumeración de Servicios desde Windows",
          duration: "1 semana",
          completed: false,
          lessons: [
            { id: "p3-1", title: "3.1 Inspección HTTP con curl y banner grabbing", done: false, time: "30 min" },
            { id: "p3-2", title: "3.2 Enumeración de SMB (445) y RPC (135)", done: false, time: "40 min" },
            { id: "p3-3", title: "3.3 Verificación de acceso RDP (3389)", done: false, time: "30 min" }
          ]
        },
        {
          module: "Módulo 4: Automatización y Laboratorio Práctico",
          duration: "1 semana",
          completed: false,
          lessons: [
            { id: "p4-1", title: "4.1 Cmdlets PowerShell para auditoría (Test-NetConnection)", done: false, time: "45 min" },
            { id: "p4-2", title: "4.2 Evaluación práctica: Escaneo de target y reporte", done: false, time: "50 min" }
          ]
        }
      ]
    }
  ],

  adminStudents: [
    {
      id: "STU-101-DEV",
      name: "Dev101x",
      email: "dev101x@gmail.com",
      avatarSeed: "Dev101x",
      role: "student",
      status: "active",
      statusLabel: "Activo",
      enrolledCourses: ["pentesting-101"],
      labsFinished: 3,
      lastLogin: "Hace 2 min"
    },
    {
      id: "STU-8812-SCH",
      name: "Sofia Chen",
      email: "sofia.chen@gmail.com",
      avatarSeed: "Sofia Chen",
      role: "student",
      status: "active",
      statusLabel: "Activo",
      enrolledCourses: ["pentesting-101"],
      labsFinished: 2,
      lastLogin: "Hoy"
    },
    {
      id: "STU-7721-CVN",
      name: "Carlos Vance",
      email: "carlos.vance@gmail.com",
      avatarSeed: "Carlos Vance",
      role: "student",
      status: "pending",
      statusLabel: "Pendiente",
      enrolledCourses: [],
      labsFinished: 0,
      lastLogin: "Ayer"
    }
  ],

  certificates: [
    {
      folio: "D101X-LLM-89210",
      hash: "0x4f82a93c72b891e840aef1c9b209d84e201bfa8294cd0182ec83912d32b",
      studentName: "Dev101x",
      studentId: "STU-101-DEV",
      studentEmail: "dev101x@gmail.com",
      avatarSeed: "Dev101x",
      courseId: "llm-architecture",
      courseTitle: "Arquitectura y Fine-Tuning de LLMs",
      specialization: "Inteligencia Artificial",
      issueDate: "Agosto",
      validUntil: "Vigente",
      grade: "Aprobado (92%)",
      hoursCompleted: "32 Horas Prácticas",
      instructor: "Dev101x",
      director: "Dev101x Academy",
      status: "VÁLIDO",
      signatureAlgorithm: "Ed25519 / SHA-256",
      enclaveId: "AWS Nitro Enclave",
      merkleRoot: "0x81fa99...bc12",
      qrVerifyUrl: "https://cursos.dev101x.com/#/diploma/D101X-LLM-89210"
    },
    {
      folio: "D101X-RED-74192",
      hash: "0x9a83b12f67c4e2098a7190d4567e9128394af18274cb0198ec82319d45e",
      studentName: "Sofia Chen",
      studentId: "STU-8812-SCH",
      studentEmail: "sofia.chen@gmail.com",
      avatarSeed: "Sofia Chen",
      courseId: "red-teaming",
      courseTitle: "Hacking Ético & Red Teaming",
      specialization: "Ciberseguridad",
      issueDate: "Septiembre",
      validUntil: "Vigente",
      grade: "Aprobado (90%)",
      hoursCompleted: "40 Horas Prácticas",
      instructor: "Dev101x",
      director: "Dev101x Academy",
      status: "VÁLIDO",
      signatureAlgorithm: "Ed25519 / SHA-256",
      enclaveId: "AWS Nitro Enclave",
      merkleRoot: "0x81fa99...bc12",
      qrVerifyUrl: "https://cursos.dev101x.com/#/diploma/D101X-RED-74192"
    }
  ],

  fraudCase: {
    caseId: "REV-8841",
    testedHash: "0x8a1f79b209e44c21980af81249b012894cd12498fa01824ec98129d4432190bb",
    status: "HASH NO VÁLIDO",
    evaluationDate: "Reciente",
    verdict: "El hash no existe en el registro oficial de diplomas emitidos por Dev101x.",
    telemetryNotice: "Alerta de seguridad registrada",
    incidentCode: "ERR_HASH_NOT_FOUND",
    socAlertStatus: "Rechazado"
  }
};
