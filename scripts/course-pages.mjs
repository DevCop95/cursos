/**
 * Genera una página estática por curso (/pentesting-nmap/, /git-github/) para que Google pueda
 * indexar cada curso por separado (las rutas #/… de la app no se indexan como páginas).
 *
 * Solo usa información pública: js/content.js (curso gratis) y scripts/course-pages.json
 * (ficha pública de los cursos de pago, la misma que muestra el catálogo).
 *
 * Uso: npm run pages   (release.mjs actualiza después la versión de los CSS)
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { COURSE, COURSE_OBJECTIVES, COURSE_VIDEO, LAB_STEPS } from '../js/content.js';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const SITE = 'https://cursos.dev101x.online';
const PERSON = 'https://dev101x.online/#person';
const version = (readFileSync(join(ROOT, 'sw.js'), 'utf8').match(/dev101x-v\d+/) || ['dev101x-v1'])[0];
const { courses } = JSON.parse(readFileSync(join(ROOT, 'scripts/course-pages.json'), 'utf8'));

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const stripModule = t => String(t).replace(/^Módulo \d+:\s*/, '');

function fromContentJs(meta) {
  return {
    ...meta,
    title: COURSE.title,
    category: COURSE.categoryLabel,
    duration: COURSE.duration,
    description: COURSE.description,
    objectives: COURSE_OBJECTIVES,
    modules: COURSE.syllabus.map(m => ({ title: m.module, lessons: m.lessons.length, lessonTitles: m.lessons.map(l => l.title) })),
    labs: LAB_STEPS.length,
    labTitles: LAB_STEPS.map(l => l.title),
    videoAuthor: COURSE_VIDEO.author
  };
}

function page(c, other) {
  const url = `${SITE}/${c.slug}/`;
  const lessons = c.modules.reduce((n, m) => n + m.lessons, 0);
  const cta = c.free
    ? `<a href="/#/aula-interactiva/${esc(c.id)}" class="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl bg-accent hover:bg-accent2 text-white text-sm font-semibold transition-colors"><span class="material-symbols-outlined text-[20px]" aria-hidden="true">play_arrow</span>Empezar gratis</a>`
    : `<a href="/#/explorar-cursos" class="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl bg-accent hover:bg-accent2 text-white text-sm font-semibold transition-colors"><span class="material-symbols-outlined text-[20px]" aria-hidden="true">lock_open</span>Ver en el catálogo</a>
       <p class="text-xs text-muted">Curso de acceso total: entra con Google y pide acceso al administrador.</p>`;

  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Course',
        '@id': `${url}#course`,
        url,
        name: c.title,
        description: c.description,
        inLanguage: 'es',
        isAccessibleForFree: c.free,
        provider: { '@id': `${SITE}/#organization` },
        creator: { '@id': PERSON },
        image: `${SITE}/assets/og-image.jpg?v=2`,
        teaches: c.objectives,
        syllabusSections: c.modules.map(m => ({ '@type': 'Syllabus', name: stripModule(m.title), description: `${m.lessons} lecciones` })),
        hasCourseInstance: { '@type': 'CourseInstance', courseMode: 'Online', courseWorkload: c.workload },
        ...(c.free ? { offers: { '@type': 'Offer', category: 'Free', price: '0', priceCurrency: 'USD', availability: 'https://schema.org/InStock' } } : {})
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Dev101x Cursos', item: `${SITE}/` },
          { '@type': 'ListItem', position: 2, name: c.title, item: url }
        ]
      }
    ]
  };

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' https://static.cloudflareinsights.com; connect-src 'self' https://cloudflareinsights.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; object-src 'none'; base-uri 'self'; form-action 'self'" />
  <meta name="referrer" content="strict-origin-when-cross-origin" />
  <!-- Generado por scripts/course-pages.mjs: no editar a mano -->
  <title>${esc(c.seoTitle)}</title>
  <meta name="description" content="${esc(c.seoDescription)}" />
  <meta name="author" content="Yared Henriquez (Dev101x)" />
  <meta name="robots" content="index, follow, max-image-preview:large" />
  <link rel="canonical" href="${url}" />
  <link rel="author" href="https://dev101x.online/" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${url}" />
  <meta property="og:site_name" content="Dev101x Cursos" />
  <meta property="og:locale" content="es_ES" />
  <meta property="og:title" content="${esc(c.seoTitle)}" />
  <meta property="og:description" content="${esc(c.seoDescription)}" />
  <meta property="og:image" content="${SITE}/assets/og-image.jpg?v=2" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:creator" content="@Devcop101" />
  <script type="application/ld+json">${JSON.stringify(ld)}</script>
  <link rel="icon" type="image/png" sizes="32x32" href="/assets/favicon.png" />
  <link rel="apple-touch-icon" href="/assets/apple-touch-icon.png" />
  <meta name="theme-color" content="#005c38" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap" />
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,400,0,0&icon_names=2d,3d,account_tree,add_circle,admin_panel_settings,arrow_forward,block,bug_report,category,check,check_circle,chevron_right,clear,close,cloud,cloud_off,code,commit,content_copy,csv,cut,description,dns,download,edit,egg,eject,error,expand,expand_more,fact_check,flag,forward,function,gavel,group,groups,hd,help,home,host,hourglass_top,http,iframe,image,info,input,insights,key,label,labs,lan,laptop_windows,lightbulb,link,list,list_alt,local_fire_department,lock,lock_open,login,logout,mail,menu,menu_book,message,more,mouse,open_in_new,output,pending,person,person_remove,play_arrow,play_circle,power_settings_new,print,psychology,query_stats,quiz,radar,radio,radio_button_unchecked,resize,rocket_launch,route,save,schedule_send,school,science,script,search,security,send,shadow,share,shield,shield_person,sleep,smart_display,sort,source,start,step,steps,storage,switch_account,sync,tab,tag,target,task_alt,terminal,tips_and_updates,title,travel_explore,tty,tune,unpublished,usb,verified,verified_user,visibility,warning,watch,wc,wifi_tethering,workspace_premium&display=block" />
  <link rel="stylesheet" href="/css/tailwind.css?v=${version}" />
</head>
<body class="bg-bg font-sans text-ink antialiased min-h-screen">
  <div class="max-w-4xl mx-auto px-4 py-6 sm:py-8 flex flex-col gap-5">
    <header class="flex items-center justify-between gap-3">
      <a href="/" class="flex items-center gap-2.5 font-extrabold text-[17px]"><img src="/assets/icon-192.png" alt="" class="w-9 h-9 rounded-lg" /><span>Dev<em class="not-italic text-accent">101x</em> Cursos</span></a>
      <a href="/" class="text-xs font-semibold text-muted hover:text-accent">Entrar</a>
    </header>

    <nav aria-label="Ruta" class="text-[11px] font-mono text-muted"><a href="/" class="hover:text-accent">Cursos</a> / <span class="text-ink2">${esc(c.title)}</span></nav>

    <main class="flex flex-col gap-5">
      <section class="bg-surface rounded-2xl border border-line p-5 sm:p-8 flex flex-col gap-4">
        <div class="flex items-center gap-2 flex-wrap font-mono text-[10px] font-bold">
          <span class="px-2 py-0.5 rounded-md bg-emerald-50 text-accent border border-emerald-200">${esc(c.category)}</span>
          <span class="px-2 py-0.5 rounded-md ${c.free ? 'bg-emerald-50 text-accent border border-emerald-200' : 'bg-amber-50 text-amber-900 border border-amber-200'}">${c.free ? 'GRATIS' : 'PREMIUM'}</span>
        </div>
        <h1 class="text-[30px] sm:text-[40px] leading-[1.05] font-extrabold tracking-tight">${esc(c.title)}</h1>
        <p class="text-[15px] sm:text-base text-ink2 leading-relaxed max-w-2xl">${esc(c.description)}</p>
        <p class="text-[12px] font-mono text-muted">${esc(String(c.duration).toLowerCase())} · ${lessons} lecciones · ${c.labs} laboratorios · en español</p>
        <div class="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 pt-1">${cta}</div>
      </section>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
        <section class="bg-surface rounded-2xl border border-line p-5 sm:p-6 flex flex-col gap-3">
          <h2 class="text-sm font-bold">Qué aprenderás</h2>
          <ul class="flex flex-col gap-2 text-[13px] text-ink2">
            ${c.objectives.map(o => `<li class="flex gap-2"><span class="material-symbols-outlined text-[16px] text-accent mt-px shrink-0" aria-hidden="true">check_circle</span><span>${esc(o)}</span></li>`).join('\n            ')}
          </ul>
        </section>
        <section class="bg-surface rounded-2xl border border-line p-5 sm:p-6 flex flex-col gap-3">
          <h2 class="text-sm font-bold">Cómo se aprende</h2>
          <ul class="flex flex-col gap-2 text-[13px] text-ink2">
            <li class="flex gap-2"><span class="material-symbols-outlined text-[16px] text-accent mt-px shrink-0" aria-hidden="true">terminal</span><span>Practicas cada comando en una terminal simulada dentro del navegador, sin instalar nada.</span></li>
            <li class="flex gap-2"><span class="material-symbols-outlined text-[16px] text-accent mt-px shrink-0" aria-hidden="true">quiz</span><span>Cada lección termina con una pregunta; el curso cierra con un reto final.</span></li>
            <li class="flex gap-2"><span class="material-symbols-outlined text-[16px] text-accent mt-px shrink-0" aria-hidden="true">science</span><span>${c.labs} laboratorios${c.labTitles ? `: ${esc(c.labTitles.join(', ').toLowerCase())}` : ''}.</span></li>
            <li class="flex gap-2"><span class="material-symbols-outlined text-[16px] text-rose-500 mt-px shrink-0" aria-hidden="true">smart_display</span><span>Video en español de ${esc(c.videoAuthor)}, enlazado por capítulos en cada lección.</span></li>
          </ul>
        </section>
      </div>

      <section class="bg-surface rounded-2xl border border-line p-5 sm:p-6 flex flex-col gap-3">
        <h2 class="text-sm font-bold">Temario</h2>
        <ol class="flex flex-col divide-y divide-line/70">
          ${c.modules.map((m, i) => `<li class="py-3 flex flex-col gap-1.5">
            <div class="flex items-center justify-between gap-3">
              <span class="flex items-center gap-2.5 min-w-0"><span class="font-mono text-muted text-sm">${i + 1}.</span><span class="font-semibold text-[14px]">${esc(stripModule(m.title))}</span></span>
              <span class="text-[11px] text-muted shrink-0">${m.lessons} lecciones</span>
            </div>${m.lessonTitles ? `
            <ul class="pl-7 flex flex-col gap-0.5 text-[12px] text-ink2">${m.lessonTitles.map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
          </li>`).join('\n          ')}
        </ol>
      </section>

      <section class="bg-surface rounded-2xl border border-line p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p class="text-[13px] text-ink2">También te puede interesar: <a href="/${esc(other.slug)}/" class="font-semibold text-accent hover:underline">${esc(other.title)}</a> <span class="text-muted">(${other.free ? 'gratis' : 'premium'})</span></p>
        <a href="/" class="text-[13px] font-semibold text-ink hover:text-accent shrink-0">Todos los cursos →</a>
      </section>
    </main>

    <footer class="text-center text-[11px] text-muted pt-2 pb-4">
      Cursos creados por <a href="https://dev101x.online/" rel="author noopener" class="font-semibold text-ink2 hover:text-accent">Yared Henriquez (Dev101x)</a> · <a href="https://github.com/DevCop95" rel="me noopener" class="font-semibold text-ink2 hover:text-accent">GitHub DevCop95</a>
    </footer>
  </div>
</body>
</html>
`;
}

const list = courses.map(c => (c.source === 'content.js' ? fromContentJs(c) : c));
list.forEach((c, i) => {
  const other = list[(i + 1) % list.length];
  mkdirSync(join(ROOT, c.slug), { recursive: true });
  writeFileSync(join(ROOT, c.slug, 'index.html'), page(c, other));
  console.log(`/${c.slug}/ generada`);
});

// Datos públicos de los cursos para la portada (tarjeta "Más cursos"). Mismo origen que las páginas de arriba:
// al añadir un curso a course-pages.json aparece solo. Nada de contenido de pago.
const cards = list.map(c => ({
  id: c.id,
  slug: c.slug,
  title: c.title,
  category: c.category || '',
  duration: c.duration || '',
  lessons: (c.modules || []).reduce((n, m) => n + (Number(m.lessons) || 0), 0),
  labs: Number(c.labs) || 0,
  free: Boolean(c.free),
  logo: c.logo || ''
}));
writeFileSync(join(ROOT, 'js/lib/public-courses.js'),
  `// Generado por scripts/course-pages.mjs (npm run pages) desde scripts/course-pages.json. No editar a mano.\n` +
  `export const PUBLIC_COURSES = ${JSON.stringify(cards, null, 2)};\n`);
console.log('js/lib/public-courses.js generado');
