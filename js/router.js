// ============================================================
// FinanzasPro — Router SPA (History API)
//
// index.html es la única página real del proyecto. Cada ruta apunta
// a un módulo en js/views/ que exporta:
//   - layout: 'auth' | 'app'   -> qué contenedor raíz usar
//   - requiresAuth: boolean    -> guard de navegación
//   - title: string            -> para document.title
//   - render(): string | Promise<string>            -> HTML de la vista
//   - init(container, ctx): void | Promise<void>     -> lógica de la vista
//
// `ctx.signal` es el signal de un AbortController propio de esa
// visita a la vista: TODO listener que la vista registre (incluidos
// los de `window`, como 'themechange') debe pasarlo como tercer
// argumento de addEventListener. Al navegar a otra ruta, el router
// aborta ese controller — así no quedan handlers duplicados ni fugas
// de memoria si el usuario visita la misma vista varias veces.
//
// Todo el resto de la app navega SIEMPRE llamando a navigate(), nunca
// con window.location.href — de lo contrario se perdería el punto
// entero de ser una SPA (recargaría la página completa).
// ============================================================

import { getSession, onAuthStateChange } from '../services/authService.js';
import { renderAppShell } from './layout.js';
import { renderIconPlaceholders } from './icons.js';

const routes = {
  '/login': () => import('./views/loginView.js'),
  '/register': () => import('./views/registerView.js'),
  '/dashboard': () => import('./views/dashboardView.js'),
  '/ingresos': () => import('./views/ingresosView.js'),
  '/gastos': () => import('./views/gastosView.js'),
  '/ahorros': () => import('./views/ahorrosView.js'),
  '/presupuesto': () => import('./views/presupuestoView.js'),
  '/reportes': () => import('./views/reportesView.js'),
  '/calendario': () => import('./views/calendarioView.js'),
  '/configuracion': () => import('./views/configuracionView.js'),
  '/perfil': () => import('./views/perfilView.js'),
};

const DEFAULT_AUTHENTICATED_ROUTE = '/dashboard';
const DEFAULT_PUBLIC_ROUTE = '/login';

let currentController = null;
let currentPath = null;
let isNavigating = false;

function normalizePath(pathname) {
  const clean = pathname.split('?')[0].split('#')[0].replace(/\/+$/, '');
  return clean === '' ? DEFAULT_AUTHENTICATED_ROUTE : clean;
}

export function navigate(path, { replace = false } = {}) {
  const target = normalizePath(path);
  const url = target + window.location.search;
  if (replace) {
    history.replaceState({}, '', url);
  } else {
    history.pushState({}, '', url);
  }
  renderRoute(target);
}

async function renderRoute(rawPath) {
  const path = normalizePath(rawPath);

  // Evita renders solapados si el usuario navega varias veces muy rápido
  // (ej. doble clic en un link) mientras aún se está resolviendo la ruta anterior.
  const requestId = Symbol('nav');
  isNavigating = requestId;

  const loader = routes[path];
  if (!loader) {
    navigate(DEFAULT_AUTHENTICATED_ROUTE, { replace: true });
    return;
  }

  const session = await getSession();
  const view = await loader();
  if (isNavigating !== requestId) return; // se disparó otra navegación mientras esperábamos

  // Guardas: rutas privadas sin sesión -> login; rutas públicas con sesión -> dashboard
  if (view.requiresAuth && !session) {
    navigate(DEFAULT_PUBLIC_ROUTE, { replace: true });
    return;
  }
  if (!view.requiresAuth && session) {
    navigate(DEFAULT_AUTHENTICATED_ROUTE, { replace: true });
    return;
  }

  currentController?.abort();
  currentController = new AbortController();
  const { signal } = currentController;

  currentPath = path;
  document.title = view.title ? `${view.title} — FinanzasPro` : 'FinanzasPro';

  const authRoot = document.getElementById('auth-root');
  const appShell = document.getElementById('app-shell');
  const viewRoot = document.getElementById('view-root');
  const globalThemeToggle = document.getElementById('global-theme-toggle');

  const ctx = { signal, session, navigate };

  // El try/catch es una red de seguridad, no el arreglo en sí: cada
  // vista ya debe revisar `signal.aborted` antes de tocar el DOM tras
  // un await (ver js/views/*.js). Esto solo evita que un error
  // realmente inesperado dentro de una vista deje la SPA a medio
  // pintar sin ningún mensaje en consola.
  try {
    if (view.layout === 'app') {
      authRoot.hidden = true;
      globalThemeToggle.hidden = true;
      appShell.hidden = false;
      await renderAppShell(session, path);
      viewRoot.innerHTML = await view.render(ctx);
      renderIconPlaceholders(viewRoot);
      playEntrance(viewRoot);
      await view.init?.(viewRoot, ctx);
    } else {
      appShell.hidden = true;
      globalThemeToggle.hidden = false;
      authRoot.hidden = false;
      authRoot.innerHTML = await view.render(ctx);
      renderIconPlaceholders(authRoot);
      await view.init?.(authRoot, ctx);
    }
  } catch (error) {
    console.error(`[router] Error al montar la vista "${path}":`, error);
  }

  window.scrollTo(0, 0);
}

// Reinicia la animación fade-in en cada navegación. Volver a poner la
// misma clase no basta (la animación ya "gastada" no se retriggerea
// sola) — se fuerza un reflow de por medio para que el navegador la
// trate como una ejecución nueva.
function playEntrance(el) {
  el.classList.remove('animate-fade-in');
  void el.offsetWidth;
  el.classList.add('animate-fade-in');
}

// Intercepta clics en <a href="/ruta-interna"> para que naveguen sin
// recargar la página. Los enlaces externos, con target="_blank", con
// modificador de teclado (abrir en pestaña nueva, etc.) o a rutas que
// el router no conoce, se dejan pasar sin tocar.
function interceptLinks() {
  document.addEventListener('click', (event) => {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    const link = event.target.closest('a[href]');
    if (!link || link.target === '_blank' || link.hasAttribute('download')) return;

    let url;
    try {
      url = new URL(link.href, window.location.origin);
    } catch {
      return;
    }
    if (url.origin !== window.location.origin) return;
    if (!routes[normalizePath(url.pathname)]) return;

    event.preventDefault();
    navigate(url.pathname);
  });
}

export function startRouter() {
  interceptLinks();
  window.addEventListener('popstate', () => renderRoute(window.location.pathname));

  onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') navigate(DEFAULT_PUBLIC_ROUTE, { replace: true });
  });

  renderRoute(window.location.pathname);
}
