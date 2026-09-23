/**
 * Dev101x - Application Logic & Reactive Router
 * Diseño limpio, nav unificado y sin mención de versiones
 */

(function () {
  'use strict';

  const STATE_KEY = 'dev101x_state';

  // ==========================================
  // CONFIGURACIÓN DE GOOGLE IDENTITY SERVICES (GIS SDK)
  // ==========================================
  const GOOGLE_AUTH_CONFIG = {
    defaultClientId: '41363425322-c9n72qus0d8jj3g3vqc5icd371p7ju1f.apps.googleusercontent.com',
    getClientId() {
      return localStorage.getItem('dev101x_google_client_id') || this.defaultClientId;
    },
    setClientId(id) {
      if (id && id.trim()) {
        localStorage.setItem('dev101x_google_client_id', id.trim());
      } else {
        localStorage.removeItem('dev101x_google_client_id');
      }
    }
  };

  // Decodificador y Validador de Tokens JWT (RFC 7519 / OpenID Connect)
  function parseJwt(token) {
    try {
      if (!token || typeof token !== 'string') return null;
      const parts = token.trim().split('.');
      if (parts.length !== 3) return null;
      const base64Url = parts[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(function (c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      return JSON.parse(jsonPayload);
    } catch (e) {
      console.warn("Error al decodificar JWT:", e);
      return null;
    }
  }

  function validateGoogleCredential(jwtCredential, expectedClientId) {
    if (!jwtCredential) {
      return { valid: false, error: "No se proporcionó ningún token JWT." };
    }
    const parts = jwtCredential.trim().split('.');
    if (parts.length !== 3) {
      return { valid: false, error: "Formato JWT inválido: debe contener 3 partes separadas por puntos (header.payload.signature)." };
    }

    let header = null;
    try {
      header = JSON.parse(atob(parts[0].replace(/-/g, '+').replace(/_/g, '/')));
    } catch (e) {
      return { valid: false, error: "Header del JWT inválido o mal codificado." };
    }

    const payload = parseJwt(jwtCredential);
    if (!payload) {
      return { valid: false, error: "No fue posible interpretar el payload JSON del JWT." };
    }

    // 1. Validar emisor canónico de Google (iss)
    const validIssuers = ['accounts.google.com', 'https://accounts.google.com'];
    if (!validIssuers.includes(payload.iss)) {
      return { valid: false, error: `Emisor no reconocido (${payload.iss}). Debe ser 'accounts.google.com'.`, payload, header };
    }

    // 2. Validar expiración (exp)
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return { valid: false, error: `El token JWT de Google ha expirado (exp: ${payload.exp}, actual: ${now}).`, payload, header };
    }

    // 3. Validar email_verified por Google
    if (payload.email_verified !== true && payload.email_verified !== "true") {
      return { valid: false, error: "La cuenta de Google no tiene el correo electrónico verificado.", payload, header };
    }

    // 4. Validar aud si hay Client ID especificado
    if (expectedClientId && payload.aud && payload.aud !== expectedClientId && !expectedClientId.includes('TU_GOOGLE_CLIENT_ID')) {
      return { valid: false, error: `La audiencia (aud: ${payload.aud}) no coincide con el Client ID configurado (${expectedClientId}).`, payload, header };
    }

    // 5. Determinar rol en base al correo verificado (Único administrador: yared.henriquezb@gmail.com)
    const email = (payload.email || '').toLowerCase().trim();
    const isAdmin = email === 'yared.henriquezb@gmail.com';
    const role = isAdmin ? 'admin' : 'student';

    return {
      valid: true,
      role: role,
      header: header,
      payload: payload,
      user: {
        name: payload.name || payload.given_name || email.split('@')[0],
        email: email,
        avatar: payload.picture || (window.Identicon ? window.Identicon.dataUri(payload.name || email) : 'assets/dev101x_identicon.svg'),
        sub: payload.sub
      }
    };
  }

  function getDefaultState() {
    return {
      authRole: 'guest',
      currentUser: null,
      googleTokenInfo: null,
      enabledCourses: ['pentesting-101'],
      activeCommandKey: 'nmap',
      activeNmapCategory: 0,
      terminalLines: [
        { text: "Windows PowerShell [Entorno Ofensivo Dev101x - Host Windows 11]", type: "system" },
        { text: "(c) Microsoft Corporation. Terminal Activa en C:\\Users\\Student\\Labs", type: "slate" },
        { text: "[INFO] Red de laboratorio conectada: 10.128.44.0/24. Target objetivo: 10.128.44.12", type: "info" },
        { text: "Escribe 'help' o 'nmap -sV 10.128.44.12' para comenzar el reconocimiento.", type: "cmd" }
      ],
      verificationTab: 'validador'
    };
  }

  function loadState() {
    try {
      const stored = localStorage.getItem(STATE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.googleTokenInfo && parsed.currentUser && parsed.currentUser.email && parsed.currentUser.email !== 'dev101x@gmail.com') {
          const state = Object.assign(getDefaultState(), parsed);
          state.enabledCourses = ['pentesting-101'];
          return state;
        }
      }
    } catch (e) {
      console.warn("Estado inicial:", e);
    }
    return getDefaultState();
  }

  function saveState(state) {
    try {
      localStorage.setItem(STATE_KEY, JSON.stringify(state));
    } catch (e) {}
  }

  let appState = loadState();

  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    const bgClass = type === 'success' ? 'bg-primary text-white' : type === 'error' ? 'bg-error text-white' : 'bg-slate-900 text-white';
    toast.className = `fixed bottom-6 right-6 z-50 px-3.5 py-2 rounded shadow-lg text-xs flex items-center gap-2 modal-enter ${bgClass}`;
    toast.innerHTML = `
      <span class="material-symbols-outlined text-sm">${type === 'success' ? 'check_circle' : type === 'error' ? 'warning' : 'info'}</span>
      <span>${message}</span>
    `;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.2s ease';
      setTimeout(() => toast.remove(), 200);
    }, 2500);
  }

  function isUserAuthenticated() {
    return Boolean(
      appState &&
      appState.authRole &&
      appState.authRole !== 'guest' &&
      appState.currentUser &&
      appState.currentUser.email &&
      appState.googleTokenInfo
    );
  }

  function getRoute() {
    // Si no está autenticado, la única ruta visible es login
    if (!isUserAuthenticated()) {
      if (window.location.hash !== '#/login') {
        window.location.hash = '#/login';
      }
      return { route: 'login', param: null };
    }

    const hash = window.location.hash || '#/mis-cursos';
    const parts = hash.replace(/^#\/?/, '').split('/');
    let route = parts[0] || 'mis-cursos';
    let param = parts[1] || (route === 'aula-interactiva' ? 'pentesting-101' : null);

    // Protección estricta: Si un alumno intenta acceder al panel de administración, se deniega y se redirige
    if (route === 'panel-admin' && appState.authRole !== 'admin') {
      showToast("Acceso restringido: Se requieren permisos de Administrador", "error");
      window.location.hash = '#/mis-cursos';
      return { route: 'mis-cursos', param: null };
    }

    if (route === 'login') {
      window.location.hash = '#/mis-cursos';
      return { route: 'mis-cursos', param: null };
    }

    return { route, param };
  }

  function updateNavigationUI(currentRoute) {
    const mainHeader = document.getElementById('main-header');
    const appFooter = document.getElementById('app-footer');
    const waterWrapper = document.getElementById('water-bg-wrapper');

    if (!isUserAuthenticated() || currentRoute === 'login' || currentRoute === 'panel-admin') {
      if (mainHeader) mainHeader.classList.add('hidden');
      if (appFooter) appFooter.classList.add('hidden');
      if (waterWrapper) waterWrapper.classList.toggle('hidden', currentRoute === 'panel-admin');
    } else {
      if (mainHeader) mainHeader.classList.remove('hidden');
      if (appFooter) appFooter.classList.remove('hidden');
      if (waterWrapper) waterWrapper.classList.add('hidden');
    }

    const navLinks = document.querySelectorAll('header nav a');
    navLinks.forEach(link => {
      const path = link.getAttribute('data-path');
      const isMatch = (path === currentRoute) ||
        (path === 'aula-interactiva' && currentRoute === 'aula-interactiva') ||
        (path === 'mis-cursos' && currentRoute === 'mis-cursos') ||
        (path === 'verificacion' && (currentRoute === 'verificacion' || currentRoute === 'validador-hash' || currentRoute === 'directorio-egresados'));

      if (isMatch) {
        link.classList.add('bg-surface-container-low', 'text-primary', 'font-semibold');
        link.classList.remove('text-on-surface-variant');
      } else {
        link.classList.remove('bg-surface-container-low', 'text-primary', 'font-semibold');
        link.classList.add('text-on-surface-variant');
      }
    });

    const userNameBadge = document.getElementById('header-user-name');
    const dropdownName = document.getElementById('dropdown-user-name');
    const dropdownEmail = document.getElementById('dropdown-user-email');
    const headerAvatar = document.getElementById('header-user-avatar');
    const dropdownAvatar = document.getElementById('dropdown-user-avatar');
    const adminDropdownLink = document.getElementById('dropdown-admin-link');
    const adminFooterLink = document.getElementById('footer-admin-link');

    const isAdmin = appState && appState.authRole === 'admin';
    if (adminDropdownLink) {
      adminDropdownLink.classList.toggle('hidden', !isAdmin);
    }
    if (adminFooterLink) {
      adminFooterLink.classList.toggle('hidden', !isAdmin);
    }

    const curUser = appState.currentUser;
    if (curUser) {
      const name = curUser.name || (isAdmin ? "Administrador" : "Estudiante");
      const email = curUser.email || "";
      const identiconUri = curUser.avatar && !curUser.avatar.includes('identicon.svg')
        ? curUser.avatar
        : (window.Identicon ? window.Identicon.dataUri(name || email) : 'assets/dev101x_identicon.svg');

      if (headerAvatar) headerAvatar.src = identiconUri;
      if (dropdownAvatar) dropdownAvatar.src = identiconUri;
      if (userNameBadge) userNameBadge.textContent = name;
      if (dropdownName) dropdownName.textContent = name;
      if (dropdownEmail) dropdownEmail.textContent = email;
    }
  }

  function renderView() {
    const { route, param } = getRoute();
    const appContainer = document.getElementById('app-view');
    if (!appContainer) return;

    window.scrollTo(0, 0);
    updateNavigationUI(route);

    if (route === 'login' || !isUserAuthenticated()) {
      appContainer.className = "w-full min-h-screen flex-1 flex flex-col justify-center items-center px-4 py-8";
      renderLogin(appContainer);
      return;
    }

    appContainer.className = "w-full pt-20 pb-12 max-w-[1280px] mx-auto px-gutter flex-1 flex flex-col";

    switch (route) {
      case 'aula-interactiva':
        renderAulaInteractiva(appContainer, param);
        break;
      case 'mis-cursos':
        renderMisCursos(appContainer);
        break;
      case 'explorar-cursos':
      case 'inicio':
        renderExplorarCursos(appContainer);
        break;
      case 'panel-admin':
        if (appState.authRole !== 'admin') {
          showToast("Acceso restringido: Se requieren permisos de Administrador", "error");
          window.location.hash = '#/aula-interactiva/pentesting-101';
          renderAulaInteractiva(appContainer, 'pentesting-101');
          return;
        }
        renderPanelAdmin(appContainer);
        break;
      case 'perfil':
        renderPerfil(appContainer);
        break;
      case 'diploma':
      case 'verificacion-diploma':
        renderDiploma(appContainer);
        break;
      case 'verificacion':
      case 'directorio-egresados':
      case 'validador-hash':
        renderVerificacion(appContainer, route === 'directorio-egresados' ? 'directorio' : 'validador');
        break;
      case 'alerta-fraude':
        renderAlertaFraude(appContainer);
        break;
      default:
        renderAulaInteractiva(appContainer, 'pentesting-101');
        break;
    }
  }

  // ==========================================
  // VIEW 1: EXPLORAR CURSOS
  // ==========================================
  function renderExplorarCursos(container) {
    const coursesHtml = DEV101X_DATA.courses.map(course => {
      const isEnrolled = appState.enabledCourses.includes(course.id);
      return `
        <div class="course-card bg-white rounded-lg p-4 border border-[#E2E8F0] shadow-sm flex flex-col justify-between gap-3 hover:border-primary transition-all" data-category="${course.category}">
          <div class="flex flex-col gap-1.5">
            <div class="flex items-center justify-between text-xs">
              <span class="px-2 py-0.5 bg-emerald-50 text-emerald-800 font-semibold rounded">${course.categoryLabel}</span>
              <span class="text-slate-400 font-mono">${course.duration}</span>
            </div>
            <h3 class="text-sm text-slate-900 font-bold">${course.title}</h3>
            <p class="text-xs text-slate-500 line-clamp-2">${course.description}</p>
            <div class="flex items-center justify-between text-[11px] font-mono text-slate-400 pt-1 border-t border-slate-100">
              <span>Alumnos: ${course.totalEnrolled}</span>
              <span>${course.labsCount} labs</span>
            </div>
          </div>
          <div class="flex items-center gap-2 pt-1">
            ${isEnrolled ? `
              <a href="#/aula-interactiva/${course.id}" class="w-full py-1.5 bg-primary-container hover:bg-primary text-white text-center rounded text-xs font-semibold">
                Entrar al Aula
              </a>
            ` : `
              <button onclick="window.Dev101x.openCourseDetail('${course.id}')" class="w-1/2 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded text-xs font-semibold border border-[#E2E8F0]" type="button">
                Temario
              </button>
              <button onclick="window.Dev101x.requestEnrollment('${course.id}')" class="w-1/2 py-1.5 bg-primary-container hover:bg-primary text-white rounded text-xs font-semibold" type="button">
                Solicitar
              </button>
            `}
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = `
      <div class="flex flex-col w-full py-6 gap-6">
        <!-- Hero Conciso -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-[#E2E8F0] shadow-sm">
          <div class="flex flex-col gap-2 max-w-xl">
            <div class="flex items-center gap-2">
              <span class="px-2.5 py-0.5 rounded font-mono text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 uppercase">Especialidad Activa</span>
              <span class="text-xs text-slate-500 font-mono">Consola Windows & Nmap</span>
            </div>
            <h1 class="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Pentesting 101: Fundamentos desde Windows
            </h1>
            <p class="text-xs sm:text-sm text-slate-600">
              Reconocimiento de red, puertos y servicios con Nmap usando la consola de Windows y PowerShell como plataforma de entrada.
            </p>
            <div class="flex items-center gap-2 pt-2">
              <a href="#/aula-interactiva/pentesting-101" class="h-9 px-3.5 bg-primary-container hover:bg-primary text-white rounded text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors">
                <span class="material-symbols-outlined text-sm">terminal</span>
                <span>Entrar al Aula y Terminal</span>
              </a>
              <a href="#/login" class="h-9 px-3.5 bg-white text-slate-800 rounded text-xs font-semibold flex items-center gap-2 border border-[#E2E8F0] shadow-sm hover:bg-slate-50 transition-colors">
                <svg class="w-3.5 h-3.5" viewBox="0 0 24 24">
                  <path d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z" fill="#4285F4"></path>
                  <path d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z" fill="#34A853"></path>
                  <path d="M5.28 14.27A7.16 7.16 0 0 1 4.9 12c0-.79.14-1.57.38-2.27V6.58H1.25A11.96 11.96 0 0 0 0 12c0 1.92.45 3.74 1.25 5.42l4.03-3.15z" fill="#FBBC05"></path>
                  <path d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z" fill="#EA4335"></path>
                </svg>
                <span>Acceso Google</span>
              </a>
            </div>
          </div>
          <div class="flex items-center gap-6 text-center border-t sm:border-t-0 sm:border-l border-slate-100 pt-3 sm:pt-0 sm:pl-6">
            <div>
              <span class="font-mono text-xl font-bold text-slate-900 block">05</span>
              <span class="text-[11px] text-slate-500">Labs</span>
            </div>
            <div>
              <span class="font-mono text-xl font-bold text-primary block">100%</span>
              <span class="text-[11px] text-slate-500">Práctico</span>
            </div>
            <div>
              <span class="font-mono text-xl font-bold text-slate-900 block">27+</span>
              <span class="text-[11px] text-slate-500">Enlaces</span>
            </div>
          </div>
        </div>

        <!-- Catálogo -->
        <div class="flex flex-col gap-3" id="catalogo-cursos">
          <div class="flex items-center justify-between">
            <h2 class="text-base font-bold text-slate-900">Programa Especializado</h2>
            <div class="flex items-center gap-2 font-mono text-xs">
              <span class="px-2.5 py-0.5 rounded bg-emerald-50 text-emerald-800 font-bold border border-emerald-200">1 Curso Oficial</span>
            </div>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4" id="course-grid">
            ${coursesHtml}
          </div>
        </div>
      </div>
    `;
  }

  // ==========================================
  // VIEW 2: MIS CURSOS
  // ==========================================
  function renderMisCursos(container) {
    if (appState.authRole === 'guest') {
      window.location.hash = '#/login';
      return;
    }
    const student = appState.currentUser || DEV101X_DATA.currentUser;
    const enrolled = DEV101X_DATA.courses.filter(c => appState.enabledCourses.includes(c.id));
    const identiconUri = student.avatar && !student.avatar.includes('identicon.svg')
      ? student.avatar
      : (window.Identicon ? window.Identicon.dataUri(student.name || student.email) : 'assets/dev101x_identicon.svg');
    const studentId = student.sub ? student.sub.substring(0, 10) : 'DEV-STU-001';

    const coursesListHtml = enrolled.map(c => `
      <div class="p-5 bg-[#fdfcf9] rounded-2xl border border-[#d3cec5] shadow-xs hover:border-[#005c38] transition-all flex flex-col justify-between gap-4">
        <div class="flex flex-col gap-2">
          <div class="flex items-center justify-between text-xs font-mono">
            <span class="px-2.5 py-0.5 rounded-full bg-emerald-50 text-[#005c38] font-semibold border border-emerald-200">${c.categoryLabel}</span>
            <span class="text-[#80857e] font-bold text-[11px]">${c.certified ? 'DIPLOMA EMITIDO' : 'EN CURSO'}</span>
          </div>
          <h3 class="text-base font-bold text-[#0c0d0e] mt-1 font-sans">${c.title}</h3>
          <p class="text-xs text-[#80857e] font-sans">${c.userCurrentLesson}</p>
          <div class="w-full bg-[#f3f0ea] h-2 rounded-full overflow-hidden mt-1 border border-[#d3cec5]/40">
            <div class="bg-[#005c38] h-full rounded-full transition-all duration-500" style="width: ${c.userProgress}%;"></div>
          </div>
        </div>
        <div class="flex items-center gap-2 pt-3 border-t border-[#d3cec5]/60">
          <a href="#/aula-interactiva/${c.id}" class="flex-1 py-2 px-4 bg-[#005c38] hover:bg-[#003f27] text-white text-center rounded-xl text-xs font-semibold shadow-xs transition-all flex items-center justify-center gap-1.5">
            <span class="material-symbols-outlined text-sm">terminal</span>
            <span>${c.certified ? 'Repasar Material' : 'Entrar al Aula'}</span>
          </a>
          ${c.certified ? `
            <a href="#/diploma" class="py-2 px-3.5 bg-white text-[#0c0d0e] hover:bg-[#f3f0ea] rounded-xl text-xs font-semibold border border-[#d3cec5] shadow-xs transition-all">
              Diploma
            </a>
          ` : ''}
        </div>
      </div>
    `).join('');

    container.innerHTML = `
      <div class="flex flex-col w-full py-6 gap-6">
        <!-- Tarjeta de Perfil del Estudiante -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-[#fdfcf9] rounded-2xl border border-[#d3cec5] shadow-xs">
          <div class="flex items-center gap-3.5">
            <img class="w-12 h-12 rounded-xl object-cover border border-[#d3cec5]" src="${identiconUri}" alt="${student.name}" />
            <div>
              <div class="flex items-center gap-2">
                <h1 class="text-lg font-bold text-[#0c0d0e] font-sans">${student.name}</h1>
                <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold ${appState.authRole === 'admin' ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-emerald-100 text-[#005c38] border border-emerald-300'}">
                  ${appState.authRole === 'admin' ? 'ADMIN' : 'ESTUDIANTE'}
                </span>
              </div>
              <span class="text-xs text-[#80857e] font-mono">${student.email || 'ID: ' + studentId}</span>
            </div>
          </div>
          <div class="flex gap-6 text-center font-mono text-xs">
            <div class="bg-[#f3f0ea] px-3.5 py-2 rounded-xl border border-[#d3cec5]/60">
              <span class="font-bold text-[#0c0d0e] text-sm block">0${enrolled.length}</span>
              <span class="text-[#80857e] text-[11px]">Cursos</span>
            </div>
            <div class="bg-[#f3f0ea] px-3.5 py-2 rounded-xl border border-[#d3cec5]/60">
              <span class="font-bold text-[#0c0d0e] text-sm block">03/03</span>
              <span class="text-[#80857e] text-[11px]">Labs</span>
            </div>
          </div>
        </div>

        <!-- Lista de Cursos -->
        <div class="flex flex-col gap-3">
          <div class="flex items-center justify-between">
            <h2 class="text-sm font-bold text-[#0c0d0e] font-sans tracking-tight">Cursos Disponibles en tu Aula</h2>
            <span class="text-xs font-mono text-[#80857e]">${enrolled.length} curso(s) matriculado(s)</span>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            ${coursesListHtml}
          </div>
        </div>
      </div>
    `;
  }

  // ==========================================
  // ECOSISTEMA Y RECURSOS OFICIALES DE NMAP (COMPLETO)
  // ==========================================
  const NMAP_RESOURCES = [
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
  const PENTESTING_COMMANDS = {
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

  function renderNmapResourcesHtml(activeIdx = 0) {
    const cat = NMAP_RESOURCES[activeIdx] || NMAP_RESOURCES[0];
    return `
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        ${cat.items.map(item => `
          <a href="${item.url}" target="_blank" rel="noopener noreferrer" class="p-3 bg-white hover:bg-slate-50 border border-slate-200 hover:border-primary/50 rounded-lg flex flex-col justify-between gap-2 transition-all shadow-xs group">
            <div class="flex items-start justify-between gap-2">
              <div class="flex items-center gap-2">
                <span class="material-symbols-outlined text-primary text-base shrink-0 group-hover:scale-110 transition-transform">${cat.icon}</span>
                <h4 class="font-bold text-slate-900 group-hover:text-primary transition-colors text-xs leading-snug">${item.title}</h4>
              </div>
              <span class="text-[9px] px-1.5 py-0.5 rounded font-mono font-bold shrink-0 ${item.badgeClass}">${item.badge}</span>
            </div>
            <p class="text-slate-600 text-[11px] leading-relaxed">${item.desc}</p>
            <div class="flex items-center justify-between text-[10px] font-mono text-slate-400 pt-1.5 border-t border-slate-100">
              <span class="truncate max-w-[200px] text-primary/80">${item.url.replace('https://', '')}</span>
              <span class="inline-flex items-center gap-0.5 text-primary font-semibold">
                <span>Abrir recurso</span>
                <span class="material-symbols-outlined text-xs">open_in_new</span>
              </span>
            </div>
          </a>
        `).join('')}
      </div>
    `;
  }

  function getExplanationCardHtml(key) {
    const data = PENTESTING_COMMANDS[key] || PENTESTING_COMMANDS['nmap'];
    return `
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <div class="flex items-center gap-2 mb-1">
            <span class="px-2 py-0.5 rounded font-mono text-[10px] font-bold ${data.badgeClass}">${data.badge}</span>
            <span class="text-slate-500 font-mono text-[11px]">${data.category}</span>
          </div>
          <h3 class="text-base font-bold text-slate-900">${data.title}</h3>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <button onclick="window.Dev101x.copyCommandText('${data.cmd.replace(/'/g, "\\'")}')" class="px-3 py-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 font-mono text-xs font-semibold flex items-center gap-1 border border-slate-200 transition-colors">
            <span class="material-symbols-outlined text-sm">content_copy</span>
            <span>Copiar</span>
          </button>
          <button onclick="window.Dev101x.executeTerminalCommand(null, '${data.cmd.replace(/'/g, "\\'")}')" class="px-3 py-1.5 rounded bg-primary hover:bg-primary-container text-white font-mono text-xs font-semibold flex items-center gap-1 shadow-sm transition-colors">
            <span class="material-symbols-outlined text-sm">terminal</span>
            <span>Ejecutar en Consola</span>
          </button>
        </div>
      </div>

      <!-- Sintaxis de Ejecución en Windows -->
      <div class="bg-slate-950 p-3 rounded-lg border border-slate-800 text-slate-100 font-mono text-xs flex items-center justify-between gap-2 overflow-x-auto">
        <div class="flex items-center gap-2">
          <span class="text-emerald-400 select-none font-bold">PS C:\\Users\\Dev101x\\Labs&gt;</span>
          <span class="text-emerald-300 font-bold">${data.cmd}</span>
        </div>
        <span class="text-[10px] text-slate-400 bg-slate-900 px-2 py-0.5 rounded shrink-0 border border-slate-800">PowerShell Windows</span>
      </div>

      <!-- Propósito en Pentesting -->
      <div class="space-y-1">
        <h4 class="font-bold text-slate-900 uppercase font-mono text-[11px] flex items-center gap-1.5 text-primary">
          <span class="material-symbols-outlined text-sm">flag</span>
          <span>1. Propósito Ofensivo y Uso en Auditoría</span>
        </h4>
        <p class="text-slate-700 leading-relaxed text-xs pl-5 border-l-2 border-primary/40">${data.purpose}</p>
      </div>

      <!-- Desglose de Flags y Parámetros -->
      <div class="space-y-2">
        <h4 class="font-bold text-slate-900 uppercase font-mono text-[11px] flex items-center gap-1.5 text-primary">
          <span class="material-symbols-outlined text-sm">tune</span>
          <span>2. Desglose de Flags y Parámetros</span>
        </h4>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
          ${data.flags.map(f => `
            <div class="bg-slate-50 p-2.5 rounded border border-slate-200 flex flex-col gap-1">
              <div class="flex items-center justify-between">
                <code class="font-mono font-bold text-emerald-700 bg-emerald-100/70 px-1.5 py-0.5 rounded text-[11px]">${f.flag}</code>
                <span class="text-[10px] font-mono text-slate-500 font-semibold">${f.name}</span>
              </div>
              <p class="text-slate-600 text-[11px] leading-snug">${f.desc}</p>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Por qué desde Windows y Relevancia Operativa -->
      <div class="space-y-1">
        <h4 class="font-bold text-slate-900 uppercase font-mono text-[11px] flex items-center gap-1.5 text-primary">
          <span class="material-symbols-outlined text-sm">laptop_windows</span>
          <span>3. ¿Por qué desde Windows? (Arquitectura & Relevancia)</span>
        </h4>
        <p class="text-slate-700 leading-relaxed text-xs pl-5 border-l-2 border-emerald-500/40">${data.windowsContext}</p>
      </div>

      <!-- Análisis de Hallazgos en el Laboratorio -->
      <div class="p-3.5 bg-emerald-50/70 rounded-lg border border-emerald-200 space-y-1.5">
        <div class="flex items-center justify-between">
          <h4 class="font-bold text-emerald-950 font-mono text-[11px] flex items-center gap-1.5">
            <span class="material-symbols-outlined text-sm text-emerald-700">fact_check</span>
            <span>4. Análisis de Hallazgos en el Output de Laboratorio</span>
          </h4>
          <span class="text-[10px] font-mono text-emerald-700 font-semibold bg-emerald-100 px-2 py-0.5 rounded">Target: 10.128.44.12</span>
        </div>
        <p class="text-emerald-900 text-xs leading-relaxed">${data.findings}</p>
        <div class="mt-2 pt-2 border-t border-emerald-200/80 font-mono text-[11px] text-emerald-800 flex items-center gap-1 flex-wrap">
          <span class="font-bold">Firma detectada:</span>
          <code class="bg-emerald-100 px-1.5 py-0.5 rounded text-[10px] text-emerald-900">${data.sampleOutput}</code>
        </div>
      </div>

      ${data.officialLinks ? `
        <!-- Enlaces Oficiales Nmap.org Directos -->
        <div class="p-3.5 bg-slate-900 text-white rounded-lg border border-slate-800 space-y-2">
          <div class="flex items-center justify-between">
            <h4 class="font-bold text-emerald-400 font-mono text-[11px] flex items-center gap-1.5">
              <span class="material-symbols-outlined text-sm">link</span>
              <span>5. Enlaces Oficiales de Documentación Nmap.org</span>
            </h4>
            <span class="text-[10px] text-slate-400 font-mono">Gordon Fyodor / nmap.org</span>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
            ${data.officialLinks.map(l => `
              <a href="${l.url}" target="_blank" rel="noopener noreferrer" class="px-2.5 py-1.5 rounded bg-slate-800/90 hover:bg-slate-800 text-slate-200 hover:text-emerald-300 flex items-center justify-between text-[11px] font-mono transition-colors border border-slate-700/50">
                <span class="flex items-center gap-1.5 truncate">
                  <span class="material-symbols-outlined text-xs text-primary">${l.icon}</span>
                  <span class="truncate">${l.label}</span>
                </span>
                <span class="text-[9px] px-1 py-0.2 rounded bg-slate-700 text-emerald-300 shrink-0 ml-1.5">${l.badge}</span>
              </a>
            `).join('')}
          </div>
        </div>
      ` : ''}
    `;
  }

  function updateExplanationCard(key) {
    const card = document.getElementById('command-explanation-card');
    if (card) {
      card.innerHTML = getExplanationCardHtml(key);
    }
    document.querySelectorAll('.cmd-tab-btn').forEach(btn => {
      const tabKey = btn.getAttribute('data-cmd-key');
      if (tabKey === key) {
        btn.className = "cmd-tab-btn px-2.5 py-1 rounded font-bold transition-all bg-primary-container text-white shadow-sm";
      } else {
        btn.className = "cmd-tab-btn px-2.5 py-1 rounded font-semibold transition-all bg-slate-200/70 hover:bg-slate-300 text-slate-700";
      }
    });
  }

  // ==========================================
  // VIEW 3: AULA INTERACTIVA (COMANDOS Y EXPLICACIONES)
  // ==========================================
  function renderAulaInteractiva(container, courseId) {
    const course = DEV101X_DATA.courses[0];
    const activeModule = course.syllabus ? (course.syllabus.find(m => m.current) || course.syllabus[0]) : { module: "Módulo Activo", lessons: [{ title: "Laboratorio Práctico", time: "30 min", active: true }] };
    const activeLesson = activeModule.lessons ? (activeModule.lessons.find(l => l.active) || activeModule.lessons[0]) : { title: "Sesión Interactiva", time: "30 min" };

    const activeCmdKey = appState.activeCommandKey || 'nmap';
    const activeCatIdx = appState.activeNmapCategory || 0;

    container.innerHTML = `
      <div class="flex flex-col w-full py-4 gap-4">
        <!-- Header Exclusivo Pentesting 101 -->
        <div class="flex items-center justify-between gap-3 bg-white p-3.5 rounded-lg border border-[#E2E8F0] shadow-sm flex-wrap">
          <div class="flex items-center gap-2">
            <span class="px-2 py-0.5 rounded bg-primary-container text-white font-mono text-xs font-bold">DEV101X LABS</span>
            <span class="text-xs font-bold text-slate-900 font-mono">${course.title}</span>
          </div>
          <div class="flex items-center gap-2">
            <a href="#seccion-recursos-nmap" class="px-2.5 py-1 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-mono text-xs font-bold border border-emerald-300 flex items-center gap-1 transition-colors">
              <span class="material-symbols-outlined text-xs">link</span>
              <span>27+ Enlaces Nmap</span>
            </a>
            <span class="font-mono text-xs text-slate-500 bg-slate-50 px-2.5 py-1 rounded border border-slate-200 shrink-0">${course.activeStudents || 7} alumnos activos</span>
          </div>
        </div>

        <!-- Banner de Contexto y Sesión Activa -->
        <div class="bg-white p-3.5 rounded-lg border border-[#E2E8F0] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
          <div>
            <div class="flex items-center gap-2 font-mono">
              <span class="text-primary font-bold">${course.title}</span>
              <span class="text-slate-300">•</span>
              <span class="text-slate-600">${activeModule.module}</span>
            </div>
            <h1 class="text-base font-bold text-slate-900 mt-0.5">${activeLesson.title}</h1>
            <div class="flex items-center gap-2 mt-1 font-mono text-[11px] text-slate-500 flex-wrap">
              <span class="inline-flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>Host Auditor: Windows 11 (10.128.44.5)</span>
              <span class="text-slate-300">•</span>
              <span class="text-slate-700 font-bold">Target: 10.128.44.12 (srv-target.dev101x.lab)</span>
              <span class="text-slate-300">•</span>
              <span class="text-slate-600">Herramientas: Nmap.exe + Npcap + CLI Windows</span>
            </div>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <span class="px-2.5 py-1 bg-emerald-50 text-emerald-800 rounded font-mono text-xs font-bold border border-emerald-200">${course.badge}</span>
            <span class="px-2.5 py-1 bg-slate-900 text-emerald-400 rounded font-mono text-xs font-semibold">LAB OFENSIVO</span>
          </div>
        </div>

        <!-- Grid Principal: Consola + Explicaciones + Recursos | Guía Rápida + Syllabus -->
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          
          <!-- Columna Izquierda (8 cols): Consola, Explicación Técnica y Directorio Nmap -->
          <div class="lg:col-span-8 flex flex-col gap-4">
            
            <!-- Terminal Windows PowerShell -->
            <div class="bg-slate-950 rounded-lg border border-slate-800 overflow-hidden font-mono text-xs shadow-md">
              <div class="p-2.5 bg-slate-900 text-slate-300 flex items-center justify-between text-[11px] border-b border-slate-800">
                <div class="flex items-center gap-2">
                  <span class="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span class="font-bold text-slate-100">Consola Windows: PowerShell 7</span>
                  <span class="text-slate-400">• IP: 10.128.44.5</span>
                </div>
                <div class="flex items-center gap-2">
                  <span class="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 text-[10px] font-bold border border-emerald-800/50">Target: 10.128.44.12</span>
                  <button onclick="window.Dev101x.executeTerminalCommand(null, 'cls')" class="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] transition-colors" title="Limpiar pantalla">cls</button>
                  <button onclick="window.Dev101x.executeTerminalCommand(null, 'help')" class="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 text-[10px] transition-colors" title="Ver comandos disponibles">help</button>
                </div>
              </div>

              <!-- Quick Command Chips -->
              <div class="bg-slate-900/95 px-3 py-1.5 border-b border-slate-800 flex items-center gap-1.5 overflow-x-auto text-[11px]">
                <span class="text-slate-400 text-[10px] uppercase font-bold shrink-0">Ejecutar:</span>
                <button onclick="window.Dev101x.selectExplanation('nmap', true)" class="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-emerald-400 whitespace-nowrap">nmap -sV</button>
                <button onclick="window.Dev101x.selectExplanation('ipconfig', true)" class="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-sky-300 whitespace-nowrap">ipconfig /all</button>
                <button onclick="window.Dev101x.selectExplanation('whoami', true)" class="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 whitespace-nowrap">whoami /priv</button>
                <button onclick="window.Dev101x.selectExplanation('ping', true)" class="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-indigo-300 whitespace-nowrap">ping -n 3</button>
                <button onclick="window.Dev101x.selectExplanation('tracert', true)" class="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-purple-300 whitespace-nowrap">tracert -d</button>
                <button onclick="window.Dev101x.selectExplanation('netstat', true)" class="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 whitespace-nowrap">netstat -ano</button>
                <button onclick="window.Dev101x.selectExplanation('curl', true)" class="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-emerald-300 whitespace-nowrap">curl -I</button>
                <button onclick="window.Dev101x.selectExplanation('testnet', true)" class="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-teal-300 whitespace-nowrap">Test-NetConnection</button>
              </div>

              <!-- Terminal Output Screen -->
              <div id="terminal-screen" class="p-3.5 h-64 overflow-y-auto space-y-1 text-slate-200">
                ${appState.terminalLines.map(l => `<div class="${l.type === 'error' ? 'text-red-400' : l.type === 'cmd' ? 'text-emerald-400 font-bold' : l.type === 'info' ? 'text-sky-300' : l.type === 'slate' ? 'text-slate-400' : 'text-slate-200'}">${l.text}</div>`).join('')}
              </div>

              <!-- Terminal Input Form -->
              <form onsubmit="window.Dev101x.executeTerminalCommand(event)" class="p-2.5 bg-black border-t border-slate-800 flex items-center gap-2">
                <span class="text-emerald-400 text-xs shrink-0 select-none font-bold">PS C:\\Users\\Dev101x\\Labs&gt;</span>
                <input id="terminal-input" type="text" placeholder="Ej: nmap -sV 10.128.44.12, ipconfig /all, whoami /priv, ping, tracert, netstat, curl, help..." class="flex-1 bg-transparent text-emerald-300 text-xs outline-none font-mono" autofocus />
                <button type="submit" class="px-3.5 py-1 bg-primary hover:bg-primary-container rounded text-white text-xs font-semibold shrink-0">Ejecutar</button>
              </form>
            </div>

            <!-- Panel de Explicación Técnica en Profundidad -->
            <div class="bg-white rounded-lg border border-[#E2E8F0] shadow-sm overflow-hidden">
              <div class="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2 flex-wrap">
                <div class="flex items-center gap-1.5">
                  <span class="material-symbols-outlined text-primary text-base">psychology</span>
                  <h2 class="text-xs font-bold text-slate-900 uppercase font-mono tracking-wider">Explicación Técnica del Comando</h2>
                </div>
                <div class="flex items-center gap-1 overflow-x-auto pb-0.5 max-w-full font-mono text-[11px]">
                  ${Object.keys(PENTESTING_COMMANDS).map(k => `
                    <button onclick="window.Dev101x.selectExplanation('${k}', false)" data-cmd-key="${k}" class="cmd-tab-btn px-2.5 py-1 rounded transition-all ${k === activeCmdKey ? 'font-bold bg-primary-container text-white shadow-sm' : 'font-semibold bg-slate-200/70 hover:bg-slate-300 text-slate-700'}">
                      ${PENTESTING_COMMANDS[k].name}
                    </button>
                  `).join('')}
                </div>
              </div>

              <!-- Contenedor Dinámico de la Explicación -->
              <div id="command-explanation-card" class="p-4 sm:p-5 flex flex-col gap-4 text-xs">
                ${getExplanationCardHtml(activeCmdKey)}
              </div>
            </div>

            <!-- Directorio Completo de Recursos & Enlaces Oficiales de Nmap -->
            <div id="seccion-recursos-nmap" class="bg-white rounded-lg border border-[#E2E8F0] shadow-sm overflow-hidden flex flex-col gap-3 p-4 sm:p-5">
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200">
                <div>
                  <div class="flex items-center gap-2 mb-1">
                    <span class="px-2 py-0.5 rounded font-mono text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">TODO ENLACES NMAP</span>
                    <span class="text-slate-500 font-mono text-[11px]">27+ Fuentes Oficiales & Documentación Canónica</span>
                  </div>
                  <h3 class="text-base font-bold text-slate-900">Ecosistema Completo y Recursos Oficiales de Nmap</h3>
                </div>
                <a href="https://nmap.org" target="_blank" rel="noopener noreferrer" class="px-3 py-1.5 bg-slate-900 hover:bg-black text-emerald-400 font-mono text-xs rounded font-bold flex items-center gap-1.5 shrink-0 transition-colors shadow-sm">
                  <span>Portal nmap.org</span>
                  <span class="material-symbols-outlined text-xs">open_in_new</span>
                </a>
              </div>

              <!-- Selector de Categorías Nmap -->
              <div class="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full font-mono text-xs">
                ${NMAP_RESOURCES.map((c, i) => `
                  <button onclick="window.Dev101x.switchNmapCategory(${i})" class="nmap-cat-btn px-2.5 py-1 rounded text-xs transition-all whitespace-nowrap ${i === activeCatIdx ? 'font-bold bg-primary-container text-white shadow-xs' : 'font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700'}">
                    ${c.categoryShort}
                  </button>
                `).join('')}
              </div>

              <!-- Grid Dinámico de Enlaces Nmap -->
              <div id="nmap-resources-container">
                ${renderNmapResourcesHtml(activeCatIdx)}
              </div>
            </div>

          </div>

          <!-- Columna Lateral (4 cols): Enlaces Rápidos + Guía de Comandos + Temario -->
          <div class="lg:col-span-4 flex flex-col gap-4">
            
            <!-- Accesos Oficiales Nmap Destacados -->
            <div class="bg-slate-900 text-white p-4 rounded-lg border border-slate-800 shadow-sm flex flex-col gap-2.5 font-mono text-xs">
              <div class="flex items-center justify-between pb-1.5 border-b border-slate-800">
                <span class="font-bold text-emerald-400 text-xs flex items-center gap-1">
                  <span class="material-symbols-outlined text-sm">download</span>
                  <span>Descargas & Manuales</span>
                </span>
                <span class="text-[10px] text-slate-400">Oficial</span>
              </div>
              <div class="flex flex-col gap-1.5">
                <a href="https://nmap.org/download.html#windows" target="_blank" rel="noopener noreferrer" class="p-1.5 rounded bg-slate-800/80 hover:bg-slate-800 flex items-center justify-between text-slate-200 hover:text-emerald-300 transition-colors">
                  <span class="truncate">Portal Descargas (nmap.org)</span>
                  <span class="text-[10px] text-emerald-400 font-bold">Oficial</span>
                </a>
                <a href="https://npcap.com/#download" target="_blank" rel="noopener noreferrer" class="p-1.5 rounded bg-slate-800/80 hover:bg-slate-800 flex items-center justify-between text-slate-200 hover:text-emerald-300 transition-colors">
                  <span class="truncate">Npcap Kernel Driver</span>
                  <span class="text-[10px] text-amber-400 font-bold">Windows</span>
                </a>
                <a href="https://nmap.org/book/" target="_blank" rel="noopener noreferrer" class="p-1.5 rounded bg-slate-800/80 hover:bg-slate-800 flex items-center justify-between text-slate-200 hover:text-emerald-300 transition-colors">
                  <span class="truncate">Libro Oficial de Gordon</span>
                  <span class="text-[10px] text-sky-400 font-bold">500+ pág</span>
                </a>
                <a href="https://nmap.org/nsedoc/" target="_blank" rel="noopener noreferrer" class="p-1.5 rounded bg-slate-800/80 hover:bg-slate-800 flex items-center justify-between text-slate-200 hover:text-emerald-300 transition-colors">
                  <span class="truncate">Catálogo Scripts NSE</span>
                  <span class="text-[10px] text-purple-400 font-bold">600+</span>
                </a>
                <a href="https://www.sans.org/posters/nmap-cheat-sheet/" target="_blank" rel="noopener noreferrer" class="p-1.5 rounded bg-slate-800/80 hover:bg-slate-800 flex items-center justify-between text-slate-200 hover:text-emerald-300 transition-colors">
                  <span class="truncate">SANS Nmap Cheat Sheet</span>
                  <span class="text-[10px] text-rose-400 font-bold">PDF</span>
                </a>
              </div>
            </div>

            <!-- Guía Rápida de Comandos Pentesting -->
            <div class="bg-white p-4 rounded-lg border border-[#E2E8F0] shadow-sm flex flex-col gap-3">
              <div class="flex items-center justify-between pb-2 border-b border-slate-100">
                <div class="flex items-center gap-1.5">
                  <span class="material-symbols-outlined text-primary text-base">terminal</span>
                  <h3 class="text-xs font-bold text-slate-900 uppercase font-mono">Guía Rápida de Comandos</h3>
                </div>
                <span class="text-[10px] font-mono text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">8 Comandos</span>
              </div>

              <div class="flex flex-col gap-2 font-mono text-xs">
                ${Object.keys(PENTESTING_COMMANDS).map(k => {
                  const item = PENTESTING_COMMANDS[k];
                  return `
                    <div class="border border-slate-200 rounded p-2.5 bg-slate-50/70 hover:bg-slate-50 transition-colors flex flex-col gap-1.5">
                      <div class="flex items-center justify-between">
                        <code class="font-bold text-emerald-800 text-[11px] truncate mr-1">${item.name}</code>
                        <span class="text-[9px] px-1.5 py-0.5 rounded font-mono font-bold ${item.badgeClass}">${item.badge.split('//')[0].trim()}</span>
                      </div>
                      <p class="text-slate-600 text-[10px] font-sans line-clamp-1">${item.title}</p>
                      <div class="flex items-center justify-between pt-1 border-t border-slate-200/60 text-[10px]">
                        <span class="text-slate-400 truncate max-w-[130px]">${item.cmd}</span>
                        <div class="flex items-center gap-1 shrink-0">
                          <button onclick="window.Dev101x.selectExplanation('${k}', false)" class="px-1.5 py-0.5 rounded bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold text-[10px]">Explicar</button>
                          <button onclick="window.Dev101x.selectExplanation('${k}', true)" class="px-1.5 py-0.5 rounded bg-primary hover:bg-primary-container text-white font-semibold text-[10px]">Ejecutar</button>
                        </div>
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>

            <!-- Temario / Plan de Estudio -->
            <div class="bg-white p-4 rounded-lg border border-[#E2E8F0] shadow-sm flex flex-col gap-3">
              <div class="flex items-center justify-between pb-2 border-b border-slate-100">
                <h3 class="text-xs font-bold text-slate-900 uppercase font-mono">Plan de Estudio</h3>
                <span class="text-[11px] text-slate-400 font-mono">${course.duration}</span>
              </div>
              <div class="flex flex-col gap-2 font-mono text-xs">
                ${course.syllabus.map(m => `
                  <div class="border border-slate-200 rounded-lg p-2.5 bg-slate-50">
                    <div class="flex items-center justify-between mb-1.5">
                      <span class="font-bold text-slate-900 text-[11px]">${m.module}</span>
                      <span class="text-[10px] text-slate-400">${m.completed ? '✓ Completado' : m.current ? 'En progreso' : 'Pendiente'}</span>
                    </div>
                    <div class="flex flex-col gap-1">
                      ${m.lessons.map(l => `
                        <div class="flex items-center justify-between py-1 px-1.5 rounded transition-colors ${l.active ? 'bg-emerald-100/70 text-primary font-bold' : l.done ? 'text-slate-600' : 'text-slate-400'}">
                          <span class="truncate mr-2">${l.title}</span>
                          <span class="text-[10px] shrink-0 font-mono">${l.time}</span>
                        </div>
                      `).join('')}
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>

          </div>
        </div>
      </div>
    `;
  }

  // ==========================================
  // VIEW 4: VERIFICACIÓN (UNIFICADA: VALIDAR HASH + DIRECTORIO)
  // ==========================================
  function renderVerificacion(container, initialTab = 'validador') {
    appState.verificationTab = initialTab;
    const certs = DEV101X_DATA.certificates;
    const validCert = certs[0];

    container.innerHTML = `
      <div class="flex flex-col w-full py-6 max-w-4xl mx-auto gap-6">
        
        <!-- Header & Segmented Tab Switch -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E2E8F0] pb-4">
          <div>
            <h1 class="text-xl font-bold text-slate-900">Centro de Verificación</h1>
            <p class="text-xs text-slate-500 font-mono">Consulta de validez de diplomas y registro público de egresados</p>
          </div>
          <!-- 2 Tabs en un solo lugar -->
          <div class="flex p-1 bg-slate-100 rounded-lg text-xs font-mono">
            <button onclick="window.Dev101x.switchVerifyTab('validador')" id="tab-btn-validador" class="px-3 py-1.5 rounded-md font-semibold ${initialTab === 'validador' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'} transition-all">
              Validar por Hash
            </button>
            <button onclick="window.Dev101x.switchVerifyTab('directorio')" id="tab-btn-directorio" class="px-3 py-1.5 rounded-md font-semibold ${initialTab === 'directorio' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'} transition-all">
              Directorio de Egresados
            </button>
          </div>
        </div>

        <!-- Section 1: Validador Hash -->
        <div id="section-validador" class="${initialTab === 'validador' ? '' : 'hidden'} flex flex-col gap-4">
          <div class="bg-white p-6 rounded-xl border border-[#E2E8F0] shadow-sm flex flex-col gap-4">
            <div>
              <h2 class="text-sm font-bold text-slate-900">Comprobar Autenticidad de Certificado</h2>
              <p class="text-xs text-slate-500 mt-1">Introduce el folio (ej: D101X-LLM-89210) o el hash SHA-256 impreso en el documento.</p>
            </div>
            <form onsubmit="window.Dev101x.handleValidateHash(event)" class="flex flex-col gap-3">
              <input id="hash-eval-input" type="text" value="${validCert.hash}" placeholder="Hash SHA-256 o Folio..." class="h-10 px-3 bg-slate-50 rounded font-mono text-xs border border-slate-200 outline-none focus:bg-white" />
              <div class="flex items-center gap-2">
                <button type="submit" class="h-9 px-4 bg-primary-container text-white rounded text-xs font-semibold">
                  Validar Certificado
                </button>
                <button type="button" onclick="document.getElementById('hash-eval-input').value = '${validCert.hash}'; window.Dev101x.handleValidateHash(event);" class="text-xs text-primary hover:underline font-mono">
                  Probar Hash Válido
                </button>
                <span class="text-slate-300 font-mono">|</span>
                <button type="button" onclick="document.getElementById('hash-eval-input').value = '0x_hash_alterado'; window.Dev101x.handleValidateHash(event);" class="text-xs text-rose-600 hover:underline font-mono">
                  Probar Hash Inválido
                </button>
              </div>
            </form>
          </div>
        </div>

        <!-- Section 2: Directorio de Egresados -->
        <div id="section-directorio" class="${initialTab === 'directorio' ? '' : 'hidden'} flex flex-col gap-4">
          <div class="flex items-center justify-between">
            <span class="text-xs text-slate-500 font-mono">Diplomas emitidos registrados</span>
            <button onclick="window.Dev101x.downloadTransparencyCSV()" class="px-3 py-1.5 bg-slate-900 text-white rounded text-xs font-semibold">
              Descargar Reporte CSV
            </button>
          </div>
          <div class="bg-white rounded-lg border border-[#E2E8F0] shadow-sm overflow-hidden text-xs">
            <table class="w-full text-left border-collapse">
              <thead class="bg-slate-50 border-b border-[#E2E8F0] font-mono text-slate-500">
                <tr>
                  <th class="p-3">EGRESADO</th>
                  <th class="p-3">CURSO</th>
                  <th class="p-3">FOLIO</th>
                  <th class="p-3">ESTADO</th>
                  <th class="p-3 text-right">DIPLOMA</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-[#EAECF0]">
                ${certs.map(c => {
                  const avatarUri = window.Identicon ? window.Identicon.dataUri(c.avatarSeed || c.studentName) : (c.avatar || 'assets/dev101x_identicon.svg');
                  return `
                  <tr class="hover:bg-slate-50">
                    <td class="p-3 flex items-center gap-2">
                      <img src="${avatarUri}" class="w-6 h-6 rounded-md object-cover border border-slate-200" />
                      <span class="font-bold text-slate-900">${c.studentName}</span>
                    </td>
                    <td class="p-3">${c.courseTitle}</td>
                    <td class="p-3 font-mono font-bold text-primary">${c.folio}</td>
                    <td class="p-3 font-mono text-emerald-700 font-semibold">${c.status}</td>
                    <td class="p-3 text-right">
                      <a href="#/diploma" class="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded text-[11px] font-semibold">
                        Ver
                      </a>
                    </td>
                  </tr>
                `}).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  // ==========================================
  // VIEW 5: DIPLOMA OFICIAL (CONCISO)
  // ==========================================
  function renderDiploma(container) {
    const cert = DEV101X_DATA.certificates[0];

    container.innerHTML = `
      <div class="flex flex-col w-full py-4 gap-4 max-w-4xl mx-auto">
        <div class="bg-white p-3.5 rounded-lg border border-[#E2E8F0] shadow-sm flex items-center justify-between text-xs no-print">
          <div class="flex items-center gap-2 font-mono">
            <span class="material-symbols-outlined text-primary text-base">verified</span>
            <span class="font-bold text-slate-900">Diploma Verificado</span>
            <span class="text-slate-400">•</span>
            <span class="text-slate-600 font-bold">${cert.folio}</span>
          </div>
          <div class="flex items-center gap-2">
            <button onclick="window.print()" class="px-3 py-1.5 bg-slate-900 text-white rounded text-xs font-semibold flex items-center gap-1">
              <span class="material-symbols-outlined text-sm">print</span>
              <span>Imprimir</span>
            </button>
            <a href="#/verificacion" class="px-3 py-1.5 bg-slate-100 text-slate-700 rounded text-xs font-semibold border border-slate-200">
              Centro de Verificación
            </a>
          </div>
        </div>

        <div id="diploma-printable" class="bg-white rounded-lg border-2 border-[#005D42] p-8 sm:p-10 shadow-sm flex flex-col gap-6">
          <div class="flex items-center justify-between border-b border-slate-200 pb-3">
            <div class="flex items-center gap-2.5">
              <img src="assets/icon.svg" alt="Dev101x" class="h-8 w-8 rounded-lg" />
              <span class="font-extrabold text-sm text-slate-900">DEV101X ACADEMY</span>
            </div>
            <span class="font-mono text-xs text-slate-500 font-bold">${cert.folio}</span>
          </div>

          <div class="text-center py-4 flex flex-col items-center gap-1.5">
            <span class="text-xs text-slate-400 uppercase font-mono tracking-wider">Certifica que:</span>
            <h2 class="text-2xl sm:text-3xl text-slate-900 font-extrabold tracking-tight">${cert.studentName}</h2>
            <p class="text-xs text-slate-500 max-w-md mt-1">Ha completado satisfactoriamente la especialización técnica:</p>
            <h3 class="text-lg sm:text-xl text-primary font-bold">${cert.courseTitle}</h3>
            <span class="px-2.5 py-0.5 rounded bg-emerald-50 text-emerald-800 font-mono text-xs font-semibold mt-1">
              ${cert.grade} • ${cert.hoursCompleted}
            </span>
          </div>

          <div class="grid grid-cols-2 gap-8 pt-4 border-t border-slate-200 text-center font-mono text-xs">
            <div>
              <div class="w-28 border-b border-slate-300 pb-1 mb-1 mx-auto italic text-slate-700">Dev101x</div>
              <span class="font-bold text-slate-900">${cert.instructor}</span>
            </div>
            <div>
              <div class="w-28 border-b border-slate-300 pb-1 mb-1 mx-auto italic text-slate-700">Dev101x Academy</div>
              <span class="font-bold text-slate-900">${cert.director}</span>
            </div>
          </div>

          <div class="bg-slate-50 p-2.5 rounded border border-slate-200 flex items-center justify-between font-mono text-[11px] text-slate-500">
            <span class="truncate">SHA-256: <strong class="text-slate-800">${cert.hash}</strong></span>
            <span class="text-emerald-700 font-bold ml-2 shrink-0">✓ Sellado Ed25519</span>
          </div>
        </div>
      </div>
    `;
  }

  // ==========================================
  // VIEW 6: PANEL ADMIN
  // ==========================================
  function renderPanelAdmin(container) {
    if (appState.authRole !== 'admin') {
      showToast("Acceso restringido: Se requieren permisos de Administrador", "error");
      window.location.hash = '#/aula-interactiva/pentesting-101';
      renderView();
      return;
    }
    const students = DEV101X_DATA.adminStudents;

    container.innerHTML = `
      <div class="min-h-screen flex bg-surface">
        <aside class="w-52 bg-white border-r border-[#E2E8F0] p-4 flex flex-col justify-between">
          <div class="flex flex-col gap-4">
            <div class="flex items-center gap-2">
              <img src="assets/icon.svg" alt="Dev101x" class="h-6 w-6 rounded" />
              <span class="font-bold text-sm text-slate-900">Admin</span>
            </div>
            <nav class="flex flex-col gap-1 text-xs font-mono">
              <a href="#/panel-admin" class="p-2 bg-slate-100 rounded text-primary font-bold">Control de Accesos</a>
              <a href="#/verificacion" class="p-2 text-slate-600 hover:bg-slate-50 rounded">Verificación</a>
            </nav>
          </div>
          <a href="#/explorar-cursos" class="text-xs text-slate-400 hover:text-slate-800">← Volver</a>
        </aside>

        <main class="flex-1 p-6 flex flex-col gap-4">
          <div class="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
            <h1 class="text-lg font-bold text-slate-900">Control de Accesos a Cursos</h1>
            <button onclick="window.Dev101x.downloadTransparencyCSV()" class="px-3 py-1.5 bg-slate-100 rounded text-xs font-semibold">
              Exportar CSV
            </button>
          </div>

          <div class="bg-white rounded-lg border border-[#E2E8F0] shadow-sm overflow-hidden text-xs">
            <table class="w-full text-left border-collapse">
              <thead class="bg-slate-50 border-b border-[#E2E8F0] font-mono text-slate-500">
                <tr>
                  <th class="p-3">ALUMNO</th>
                  <th class="p-3">ESTADO</th>
                  <th class="p-3">PENTESTING 101 (WINDOWS)</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-[#EAECF0]">
                ${students.map(s => {
                  const isUser = s.id === 'STU-101-DEV';
                  const hasP101 = isUser ? appState.enabledCourses.includes('pentesting-101') : (s.enrolledCourses && s.enrolledCourses.includes('pentesting-101'));
                  const studentAvatar = window.Identicon ? window.Identicon.dataUri(s.avatarSeed || s.name) : (s.avatar || 'assets/dev101x_identicon.svg');
                  return `
                    <tr class="hover:bg-slate-50">
                      <td class="p-3 flex items-center gap-2">
                        <img src="${studentAvatar}" class="w-7 h-7 rounded-md object-cover border border-slate-200" />
                        <div>
                          <span class="font-bold text-slate-900">${s.name}</span>
                          <span class="text-[11px] text-slate-400 block font-mono">${s.email}</span>
                        </div>
                      </td>
                      <td class="p-3 font-mono">${s.statusLabel}</td>
                      <td class="p-3">
                        <label class="inline-flex items-center cursor-pointer gap-2">
                          <input type="checkbox" ${hasP101 ? 'checked' : ''} onchange="window.Dev101x.toggleCourseAccess('${s.id}', 'pentesting-101', this.checked)" class="accent-primary" />
                          <span class="font-mono text-[11px]">${hasP101 ? 'Activo' : 'Inactivo'}</span>
                        </label>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </main>
      </div>
    `;
  }

  // ==========================================
  // VIEW 7: PERFIL
  // ==========================================
  function renderPerfil(container) {
    const student = DEV101X_DATA.currentUser;
    const cert = DEV101X_DATA.certificates[0];

    container.innerHTML = `
      <div class="flex flex-col w-full py-6 gap-4 max-w-3xl mx-auto">
        <div class="bg-white p-5 rounded-lg border border-[#E2E8F0] shadow-sm flex items-center justify-between">
          <div class="flex items-center gap-3">
            <img src="${window.Identicon ? window.Identicon.dataUri(student.name) : student.avatar}" class="w-12 h-12 rounded-lg object-cover border border-slate-200" />
            <div>
              <h1 class="text-base font-bold text-slate-900">${student.name}</h1>
              <p class="text-xs text-slate-400 font-mono">${student.email} • ID: ${student.id}</p>
            </div>
          </div>
          <a href="#/diploma" class="px-3 py-1.5 bg-primary-container text-white rounded text-xs font-semibold">
            Ver Diploma
          </a>
        </div>

        <div class="bg-white p-4 rounded-lg border border-[#E2E8F0] shadow-sm text-xs font-mono">
          <span class="font-bold text-slate-900 block mb-2 font-sans text-sm">Habilidades Técnicas</span>
          <div class="space-y-1">
            ${student.skills.map(s => `<div class="flex justify-between p-1.5 bg-slate-50 rounded"><span>${s.name}</span><strong class="text-primary">${s.level}</strong></div>`).join('')}
          </div>
        </div>
      </div>
    `;
  }

  // ==========================================
  // VIEW 8: ALERTA FRAUDE
  // ==========================================
  function renderAlertaFraude(container) {
    container.innerHTML = `
      <div class="flex flex-col w-full py-10 max-w-md mx-auto text-center">
        <div class="bg-white p-6 rounded-xl border border-red-300 shadow-sm flex flex-col items-center gap-3">
          <span class="material-symbols-outlined text-3xl text-red-500">gpp_bad</span>
          <h1 class="text-base font-bold text-slate-900">Diploma No Encontrado</h1>
          <p class="text-xs text-slate-500">El hash ingresado no corresponde a ningún registro oficial de Dev101x.</p>
          <a href="#/verificacion" class="mt-2 px-4 py-2 bg-primary-container text-white rounded text-xs font-semibold">
            Volver a Verificación
          </a>
        </div>
      </div>
    `;
  }

  // ==========================================
  // VIEW 9: LOGIN EXCLUSIVO GOOGLE SSO
  // ==========================================
  // VIEW 9: LOGIN EXCLUSIVO GOOGLE SSO CON VERIFICACIÓN INTERACTIVA
  // ==========================================
  function renderLogin(container) {
    const activeClientId = GOOGLE_AUTH_CONFIG.getClientId();

    container.innerHTML = `
      <div class="relative w-full min-h-[82vh] flex flex-col items-center justify-center py-10 px-4 z-10">
        
        <!-- Tarjeta de Login Editorial Dev101x -->
        <div class="login-card-editorial w-full max-w-[420px] rounded-[28px] p-8 sm:p-10 flex flex-col items-center gap-7 modal-enter">
          
          <!-- Logo & Título Oficial Dev101x -->
          <div class="flex flex-col items-center text-center gap-3.5">
            <div class="relative group cursor-default">
              <div class="absolute -inset-2 rounded-2xl bg-gradient-to-tr from-[#005c38]/20 via-[#9ffdd3]/30 to-[#005c38]/10 blur-md opacity-60 group-hover:opacity-100 transition-all duration-500"></div>
              <div class="relative w-16 h-16 rounded-2xl bg-white border border-[#d3cec5] flex items-center justify-center p-2.5 shadow-sm group-hover:scale-105 transition-transform duration-300">
                <img src="assets/favicon.png" alt="Dev101x" class="w-11 h-11 rounded-lg object-contain" />
              </div>
            </div>
            <div>
              <h1 class="text-3xl sm:text-[32px] font-extrabold text-[#0c0d0e] tracking-tight font-sans">
                Acceso a Dev<em class="not-italic text-[#005c38]">101x</em>
              </h1>
            </div>
          </div>

          <!-- Botón Estilizado Google SSO -->
          <div class="w-full flex flex-col items-center gap-3">
            <span class="text-xs text-[#282b29] font-medium text-center font-sans">Inicia sesión con tu cuenta de Google:</span>
            
            <div class="w-full flex justify-center items-center py-1">
              <div id="real-google-btn-container" class="google-btn-frame transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98]">
                <!-- Botón estilizado con logo multicolor oficial de Google -->
                <div class="w-[300px] h-[48px] flex items-center justify-center gap-3 px-5 py-2.5 rounded-full bg-white border border-[#d3cec5] text-xs font-semibold text-[#0c0d0e] shadow-xs hover:border-[#005c38] hover:shadow-md transition-all cursor-pointer">
                  <svg class="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                  </svg>
                  <span>Continuar con Google</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Pie Mínimo OpenID Oficial -->
          <div class="w-full pt-4 border-t border-[#d3cec5]/70 flex items-center justify-between text-[11px] text-[#80857e] font-mono">
            <span class="text-[#282b29] font-medium tracking-tight">Plataforma Académica</span>
            <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#f3f0ea] border border-[#d3cec5]/80 text-[#005c38] font-bold text-[10px] tracking-wide">
              <span class="w-1.5 h-1.5 rounded-full bg-[#005c38] animate-pulse"></span>
              <span>OpenID Connect</span>
            </span>
          </div>

        </div>

        <div class="w-full max-w-[420px] mt-5 text-center">
          <p class="text-[11px] text-[#80857e] font-sans">
            &copy; 2026 Dev<em class="not-italic text-[#005c38] font-bold">101x</em> &bull; Plataforma Oficial de Aprendizaje
          </p>
        </div>
      </div>
    `;

    // Renderizado reactivo del botón oficial de Google Identity Services con shape pill
    let renderAttempts = 0;
    const maxRenderAttempts = 40;

    function renderGoogleLiveButton() {
      const el = document.getElementById('real-google-btn-container');
      if (!el) return;

      if (window.google && window.google.accounts && window.google.accounts.id && activeClientId) {
        try {
          google.accounts.id.initialize({
            client_id: activeClientId,
            callback: (resp) => window.Dev101x.handleGoogleCredentialResponse(resp),
            auto_select: false,
            cancel_on_tap_outside: true
          });
          el.innerHTML = '';
          google.accounts.id.renderButton(el, {
            theme: 'outline',
            size: 'large',
            width: 300,
            text: 'continue_with',
            shape: 'pill',
            logo_alignment: 'left'
          });
        } catch (e) {
          console.error("Error inicializando Google Identity Services:", e);
          el.innerHTML = `<span class="text-xs text-rose-600 font-mono">Error al inicializar Google SSO: ${e.message}</span>`;
        }
      } else if (renderAttempts < maxRenderAttempts) {
        renderAttempts++;
        setTimeout(renderGoogleLiveButton, 100);
      } else {
        el.innerHTML = `<span class="text-xs text-amber-700">El SDK de Google tardó en cargar. Por favor recarga la página.</span>`;
      }
    }

    renderGoogleLiveButton();
  }

  // --- Global Public API ---
  window.Dev101x = {
    showToast,
    toggleProfileDropdown(force) {
      if (appState.authRole === 'guest') {
        window.location.hash = '#/login';
        return;
      }
      const dd = document.getElementById('profile-dropdown');
      if (!dd) return;
      if (typeof force === 'boolean') {
        dd.classList.toggle('hidden', !force);
      } else {
        dd.classList.toggle('hidden');
      }
    },
    switchVerifyTab(tab) {
      appState.verificationTab = tab;
      const valBtn = document.getElementById('tab-btn-validador');
      const dirBtn = document.getElementById('tab-btn-directorio');
      const valSec = document.getElementById('section-validador');
      const dirSec = document.getElementById('section-directorio');

      if (tab === 'validador') {
        valBtn.className = "px-3 py-1.5 rounded-md font-semibold bg-white text-slate-900 shadow-xs transition-all";
        dirBtn.className = "px-3 py-1.5 rounded-md font-semibold text-slate-600 transition-all";
        valSec.classList.remove('hidden');
        dirSec.classList.add('hidden');
      } else {
        dirBtn.className = "px-3 py-1.5 rounded-md font-semibold bg-white text-slate-900 shadow-xs transition-all";
        valBtn.className = "px-3 py-1.5 rounded-md font-semibold text-slate-600 transition-all";
        dirSec.classList.remove('hidden');
        valSec.classList.add('hidden');
      }
    },
    openAuthModal() {
      window.location.hash = '#/login';
    },
    closeAuthModal() {
      const m = document.getElementById('google-auth-modal');
      if (m) m.classList.add('hidden');
    },

    // Callback canónico de Google Identity Services (GIS SDK)
    handleGoogleCredentialResponse(response) {
      if (!response || !response.credential) {
        showToast("Error: No se recibió credencial de Google", "error");
        return;
      }
      const expectedClientId = GOOGLE_AUTH_CONFIG.getClientId();
      const result = validateGoogleCredential(response.credential, expectedClientId);
      
      if (!result.valid) {
        showToast(`Error de validación Google: ${result.error}`, "error");
        console.error("Fallo validación JWT Google:", result);
        return;
      }

      // Credencial válida y verificada
      appState.authRole = result.role;
      appState.currentUser = {
        name: result.user.name,
        email: result.user.email,
        avatar: result.user.avatar,
        sub: result.user.sub
      };
      appState.googleTokenInfo = {
        jwt: response.credential,
        header: result.header,
        payload: result.payload,
        validatedAt: new Date().toLocaleTimeString(),
        source: response.isSimulated ? "Google OpenID Connect" : "Google Identity Services Live"
      };
      saveState(appState);

      showToast(`✓ Bienvenido, ${result.user.name}! Sesión verificada con Google`, "success");
      window.location.hash = '#/mis-cursos';
      renderView();
    },

    // Función principal para iniciar sesión con Google
    loginWithGoogle() {
      window.location.hash = '#/login';
    },

    loginWithTestGoogleAccount(role) {
      window.location.hash = '#/login';
    },

    loginAs(role) {
      window.location.hash = '#/login';
    },
    logout() {
      appState = getDefaultState();
      try {
        localStorage.removeItem(STATE_KEY);
      } catch (e) {
        console.warn("Error removing state:", e);
      }
      if (window.google && window.google.accounts && window.google.accounts.id) {
        try {
          google.accounts.id.disableAutoSelect();
        } catch (e) {}
      }
      this.closeAuthModal();
      showToast('Sesión cerrada correctamente', 'info');
      window.location.hash = '#/login';
      renderView();
    },
    filterCourses(cat, btn) {
      document.querySelectorAll('.course-filter-btn').forEach(b => {
        b.className = "course-filter-btn px-2 py-0.5 rounded text-slate-600";
      });
      if (btn) btn.className = "course-filter-btn px-2 py-0.5 rounded bg-white font-semibold text-slate-900 shadow-xs";
      document.querySelectorAll('.course-card').forEach(card => {
        card.style.display = (cat === 'all' || card.getAttribute('data-category') === cat) ? 'flex' : 'none';
      });
    },
    openCourseDetail(courseId) {
      const course = DEV101X_DATA.courses.find(c => c.id === courseId) || DEV101X_DATA.courses[0];
      const m = document.getElementById('course-detail-modal');
      if (!m) return;
      document.getElementById('modal-course-title').textContent = course.title;
      document.getElementById('modal-course-desc').textContent = course.description;
      document.getElementById('modal-course-instructor').textContent = course.instructor;
      document.getElementById('modal-course-duration').textContent = course.duration;
      m.classList.remove('hidden');
    },
    closeCourseDetail() {
      const m = document.getElementById('course-detail-modal');
      if (m) m.classList.add('hidden');
    },
    requestEnrollment(courseId) {
      showToast("Solicitud enviada al Administrador", "success");
    },
    executeTerminalCommand(e, customCmd) {
      if (e) e.preventDefault();
      const input = document.getElementById('terminal-input');
      const screen = document.getElementById('terminal-screen');
      if (!screen) return;
      const cmd = (customCmd !== undefined && customCmd !== null) ? String(customCmd).trim() : (input ? input.value.trim() : '');
      if (!cmd) return;

      const promptPrefix = "PS C:\\Users\\Student\\Labs> ";
      appState.terminalLines.push({ text: `${promptPrefix}${cmd}`, type: 'cmd' });
      const lower = cmd.toLowerCase().trim();

      if (lower === 'clear' || lower === 'cls') {
        appState.terminalLines = [];
      } else if (lower === 'help' || lower === '/?') {
        appState.terminalLines.push({ text: "[COMANDOS PENTESTING 101 - WINDOWS HOST]", type: "system" });
        appState.terminalLines.push({ text: "  • nmap [flags] <IP>     : Escaneo de puertos y servicios (ej: nmap -sV -p 80,443,445 10.128.44.12)", type: "info" });
        appState.terminalLines.push({ text: "  • ipconfig [/all]       : Muestra adaptadores, IPv4, máscara y puerta de enlace", type: "info" });
        appState.terminalLines.push({ text: "  • whoami [/priv]        : Muestra usuario activo y privilegios en el sistema", type: "info" });
        appState.terminalLines.push({ text: "  • ping <IP>             : Comprueba conectividad ICMP con el objetivo", type: "info" });
        appState.terminalLines.push({ text: "  • tracert <IP>          : Traza la ruta de red hacia el servidor objetivo", type: "info" });
        appState.terminalLines.push({ text: "  • netstat -ano          : Muestra puertos abiertos y conexiones activas locales", type: "info" });
        appState.terminalLines.push({ text: "  • curl -I <URL>         : Banner grabbing HTTP sobre el objetivo", type: "info" });
        appState.terminalLines.push({ text: "  • nslookup <host/IP>    : Consulta de resolución de nombres DNS", type: "info" });
        appState.terminalLines.push({ text: "  • Test-NetConnection    : Cmdlet PowerShell para prueba de puerto TCP", type: "info" });
        appState.terminalLines.push({ text: "  • cls / clear           : Limpiar la pantalla de la terminal", type: "info" });
      } else if (lower.startsWith('nmap')) {
        appState.terminalLines.push({ text: "Starting Nmap ( https://nmap.org ) at 2026-09-23 10:58 EST", type: "system" });
        appState.terminalLines.push({ text: "Nmap scan report for 10.128.44.12 (srv-target.dev101x.lab)", type: "info" });
        appState.terminalLines.push({ text: "Host is up (0.0018s latency).", type: "system" });
        appState.terminalLines.push({ text: "Not shown: 995 closed tcp ports (reset)", type: "slate" });
        appState.terminalLines.push({ text: "PORT     STATE SERVICE       VERSION", type: "system" });
        appState.terminalLines.push({ text: "80/tcp   open  http          nginx/1.24.0 (Windows)", type: "cmd" });
        appState.terminalLines.push({ text: "135/tcp  open  msrpc         Microsoft Windows RPC", type: "cmd" });
        appState.terminalLines.push({ text: "443/tcp  open  ssl/http      nginx/1.24.0", type: "cmd" });
        appState.terminalLines.push({ text: "445/tcp  open  microsoft-ds  Windows Server 2022 (SMBv2/v3)", type: "cmd" });
        appState.terminalLines.push({ text: "3389/tcp open  ms-wbt-server Microsoft Terminal Services (RDP)", type: "cmd" });
        appState.terminalLines.push({ text: "Service Info: OS: Windows; CPE: cpe:/o:microsoft:windows", type: "info" });
        appState.terminalLines.push({ text: "Nmap done: 1 IP address (1 host up) scanned in 2.14 seconds", type: "system" });
      } else if (lower.startsWith('ipconfig')) {
        appState.terminalLines.push({ text: "Configuración IP de Windows", type: "system" });
        appState.terminalLines.push({ text: "Adaptador Ethernet vEthernet (Labs-Internal):", type: "info" });
        appState.terminalLines.push({ text: "   Sufijo DNS específico para la conexión. . : lab.dev101x.internal", type: "slate" });
        appState.terminalLines.push({ text: "   Dirección IPv4. . . . . . . . . . . . . . : 10.128.44.5", type: "cmd" });
        appState.terminalLines.push({ text: "   Máscara de subred . . . . . . . . . . . . : 255.255.255.0", type: "slate" });
        appState.terminalLines.push({ text: "   Puerta de enlace predeterminada . . . . . : 10.128.44.1", type: "cmd" });
      } else if (lower.startsWith('whoami')) {
        if (lower.includes('/priv')) {
          appState.terminalLines.push({ text: "INFORMACIÓN DE PRIVILEGIOS", type: "system" });
          appState.terminalLines.push({ text: "Nombre de privilegio          Descripción                       Estado", type: "slate" });
          appState.terminalLines.push({ text: "============================= ================================= ========", type: "slate" });
          appState.terminalLines.push({ text: "SeChangeNotifyPrivilege       Omitir comprobación de recorrido  Habilitado", type: "info" });
          appState.terminalLines.push({ text: "SeIncreaseWorkingSetPrivilege Aumentar espacio de trabajo       Habilitado", type: "info" });
        } else {
          appState.terminalLines.push({ text: "dev101x-lab\\analyst01", type: "cmd" });
        }
      } else if (lower.startsWith('ping')) {
        const target = cmd.split(' ')[1] || '10.128.44.12';
        appState.terminalLines.push({ text: `Haciendo ping a ${target} con 32 bytes de datos:`, type: "system" });
        appState.terminalLines.push({ text: `Respuesta desde ${target}: bytes=32 tiempo=1ms TTL=128`, type: "cmd" });
        appState.terminalLines.push({ text: `Respuesta desde ${target}: bytes=32 tiempo=2ms TTL=128`, type: "cmd" });
        appState.terminalLines.push({ text: `Respuesta desde ${target}: bytes=32 tiempo=1ms TTL=128`, type: "cmd" });
        appState.terminalLines.push({ text: `Estadísticas de ping: Paquetes: enviados = 3, recibidos = 3, perdidos = 0 (0% perdidos)`, type: "info" });
      } else if (lower.startsWith('tracert')) {
        appState.terminalLines.push({ text: "Traza a la dirección 10.128.44.12 sobre un máximo de 30 saltos:", type: "system" });
        appState.terminalLines.push({ text: "  1    <1 ms    <1 ms    <1 ms  10.128.44.1 [gw-edge.lab]", type: "cmd" });
        appState.terminalLines.push({ text: "  2     1 ms     1 ms     1 ms  10.128.44.12 [srv-target.lab]", type: "cmd" });
        appState.terminalLines.push({ text: "Traza completa.", type: "system" });
      } else if (lower.startsWith('netstat')) {
        appState.terminalLines.push({ text: "Conexiones activas", type: "system" });
        appState.terminalLines.push({ text: "  Proto  Dirección local          Dirección remota        Estado          PID", type: "slate" });
        appState.terminalLines.push({ text: "  TCP    0.0.0.0:135              0.0.0.0:0               LISTENING       940", type: "cmd" });
        appState.terminalLines.push({ text: "  TCP    10.128.44.5:49712        10.128.44.12:445        ESTABLISHED     4120", type: "cmd" });
        appState.terminalLines.push({ text: "  TCP    0.0.0.0:3389             0.0.0.0:0               LISTENING       1124", type: "cmd" });
      } else if (lower.startsWith('curl')) {
        appState.terminalLines.push({ text: "HTTP/1.1 200 OK", type: "cmd" });
        appState.terminalLines.push({ text: "Server: nginx/1.24.0 (Windows)", type: "info" });
        appState.terminalLines.push({ text: "Date: Wed, 23 Sep 2026 10:55:00 GMT", type: "slate" });
        appState.terminalLines.push({ text: "Content-Type: text/html; charset=UTF-8", type: "slate" });
        appState.terminalLines.push({ text: "X-Powered-By: Dev101x-VulnerableLab", type: "info" });
      } else if (lower.startsWith('nslookup')) {
        appState.terminalLines.push({ text: "Servidor:  dns.dev101x.internal", type: "system" });
        appState.terminalLines.push({ text: "Address:  10.128.44.1", type: "slate" });
        appState.terminalLines.push({ text: "Nombre:   srv-target.dev101x.internal", type: "info" });
        appState.terminalLines.push({ text: "Address:  10.128.44.12", type: "cmd" });
      } else if (lower.includes('test-netconnection')) {
        appState.terminalLines.push({ text: "ComputerName     : 10.128.44.12", type: "info" });
        appState.terminalLines.push({ text: "RemotePort       : 445", type: "info" });
        appState.terminalLines.push({ text: "InterfaceAlias   : vEthernet (Labs-Internal)", type: "slate" });
        appState.terminalLines.push({ text: "TcpTestSucceeded : True", type: "cmd" });
      } else if (lower.startsWith('nuclei')) {
        appState.terminalLines.push({ text: "[CVE-2023-38606] Verificado en http://10.128.44.12/api/v1/auth", type: "cmd" });
      } else {
        appState.terminalLines.push({ text: `'${cmd}' no se reconoce como un comando interno o externo, programa o archivo por lotes ejecutable. Escribe 'help' para ver comandos disponibles.`, type: "error" });
      }

      // Sincronizar explicación técnica del comando ejecutado
      let detectedKey = null;
      if (lower.startsWith('nmap')) detectedKey = 'nmap';
      else if (lower.startsWith('ipconfig')) detectedKey = 'ipconfig';
      else if (lower.startsWith('whoami')) detectedKey = 'whoami';
      else if (lower.startsWith('ping')) detectedKey = 'ping';
      else if (lower.startsWith('tracert')) detectedKey = 'tracert';
      else if (lower.startsWith('netstat')) detectedKey = 'netstat';
      else if (lower.startsWith('curl')) detectedKey = 'curl';
      else if (lower.includes('test-netconnection')) detectedKey = 'testnet';

      if (detectedKey) {
        appState.activeCommandKey = detectedKey;
        updateExplanationCard(detectedKey);
      }

      if (input) input.value = '';
      saveState(appState);
      screen.innerHTML = appState.terminalLines.map(l => `<div class="${l.type === 'error' ? 'text-red-400' : l.type === 'cmd' ? 'text-emerald-400 font-bold' : l.type === 'info' ? 'text-sky-300' : l.type === 'slate' ? 'text-slate-400' : 'text-slate-200'}">${l.text}</div>`).join('');
      screen.scrollTop = screen.scrollHeight;
    },
    selectExplanation(key, autoRun = false) {
      if (!PENTESTING_COMMANDS[key]) return;
      appState.activeCommandKey = key;
      saveState(appState);
      updateExplanationCard(key);
      if (autoRun) {
        this.executeTerminalCommand(null, PENTESTING_COMMANDS[key].cmd);
      }
    },
    switchNmapCategory(idx) {
      appState.activeNmapCategory = idx;
      saveState(appState);
      const container = document.getElementById('nmap-resources-container');
      if (container) {
        container.innerHTML = renderNmapResourcesHtml(idx);
      }
      document.querySelectorAll('.nmap-cat-btn').forEach((btn, i) => {
        btn.className = (i === idx)
          ? "nmap-cat-btn px-2.5 py-1 rounded text-xs transition-all whitespace-nowrap font-bold bg-primary-container text-white shadow-xs"
          : "nmap-cat-btn px-2.5 py-1 rounded text-xs transition-all whitespace-nowrap font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700";
      });
    },
    copyCommandText(cmdText) {
      if (!cmdText) return;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(cmdText).then(() => {
          showToast("Comando copiado al portapapeles", "success");
        }).catch(() => {
          showToast("Comando listo en portapapeles", "info");
        });
      } else {
        const ta = document.createElement('textarea');
        ta.value = cmdText;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        showToast("Comando copiado al portapapeles", "success");
      }
    },
    toggleCourseAccess(studentId, courseId, isChecked) {
      if (appState.authRole !== 'admin') {
        showToast("Acción no autorizada: Solo el Administrador puede modificar permisos", "error");
        return;
      }
      if (studentId === 'STU-101-DEV' || studentId === 'STU-9924-ALX') {
        if (isChecked && !appState.enabledCourses.includes(courseId)) {
          appState.enabledCourses.push(courseId);
        } else if (!isChecked) {
          appState.enabledCourses = appState.enabledCourses.filter(c => c !== courseId);
        }
        saveState(appState);
      }
      showToast(`Permiso para ${courseId}: ${isChecked ? 'Habilitado' : 'Revocado'}`, 'success');
    },
    handleValidateHash(e) {
      if (e) e.preventDefault();
      const input = document.getElementById('hash-eval-input');
      const val = input ? input.value.trim().toLowerCase() : '';
      if (val.includes('4f82') || val.includes('d101x-llm') || val.includes('89210')) {
        window.location.hash = '#/diploma';
        showToast("Diploma verificado", "success");
      } else {
        window.location.hash = '#/alerta-fraude';
      }
    },
    downloadTransparencyCSV() {
      if (appState.authRole !== 'admin') {
        showToast("Acción no autorizada: Solo el Administrador puede exportar datos", "error");
        return;
      }
      const csv = "Folio,Alumno,Curso,Calificacion,Horas\nD101X-LLM-89210,Dev101x,Arquitectura y Fine-Tuning de LLMs,92%,32\n";
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = "dev101x_registro.csv";
      a.click();
      showToast("CSV descargado", "success");
    }
  };

  // Close dropdown on click outside
  window.addEventListener('click', function (e) {
    const btn = document.getElementById('user-menu-btn');
    const dd = document.getElementById('profile-dropdown');
    if (dd && !dd.contains(e.target) && btn && !btn.contains(e.target)) {
      dd.classList.add('hidden');
    }
  });

  window.addEventListener('hashchange', renderView);
  window.addEventListener('DOMContentLoaded', renderView);
})();
