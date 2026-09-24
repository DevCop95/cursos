/**
 * Enrutado por hash (módulo puro).
 */
export const ROUTES = ['mis-cursos', 'aula-interactiva', 'explorar-cursos', 'perfil', 'panel-admin'];
export const DEFAULT_ROUTE = 'mis-cursos';

/**
 * Traduce el hash a una ruta. Devuelve `redirect` cuando la URL debe normalizarse.
 */
export function resolveRoute(hash, { authenticated, admin }) {
  if (!authenticated) {
    return { route: 'login', param: null, redirect: hash === '#/login' ? null : '#/login' };
  }
  const parts = String(hash || '').replace(/^#\/?/, '').split('/').filter(Boolean);
  let route = parts[0] || DEFAULT_ROUTE;
  if (route === 'inicio') route = 'explorar-cursos';
  const param = parts[1] || (route === 'aula-interactiva' ? 'pentesting-101' : null);

  if (route === 'login' || !ROUTES.includes(route)) {
    return { route: DEFAULT_ROUTE, param: null, redirect: '#/' + DEFAULT_ROUTE };
  }
  if (route === 'panel-admin' && !admin) {
    return { route: DEFAULT_ROUTE, param: null, redirect: '#/' + DEFAULT_ROUTE, denied: true };
  }
  return { route, param, redirect: null };
}
