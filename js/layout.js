// ============================================================
// FinanzasPro — Shell de la aplicación (sidebar + topbar)
//
// A diferencia de la versión MPA, este módulo YA NO decide
// redirecciones (ni "window.location.href", ni sabe qué hacer si no
// hay sesión) — esa es responsabilidad exclusiva de router.js, para
// que exista un solo lugar que controle la navegación de la SPA.
// renderAppShell() asume que quien lo llama ya validó la sesión.
// ============================================================

import { signOut } from '../services/authService.js';
import { searchMovimientos } from '../services/reportesService.js';
import { listAlertasPresupuesto, marcarAlertaLeida } from '../services/presupuestoService.js';
import { escapeHtml } from './security.js';
import { setTheme } from './app.js';
import { iconHTML, icon } from './icons.js';
import { formatCurrency, formatDate, debounce } from './helpers.js';

// "Perfil" ya no vive en la navegación principal: se accede desde la
// fila de usuario al pie del sidebar (patrón Notion/Linear), que
// libera un ítem y deja la navegación centrada en los módulos
// financieros. "Calendario" es nuevo (ver js/views/calendarioView.js).
const NAV_ITEMS = [
  { href: '/dashboard', label: 'Inicio', icon: 'LayoutDashboard' },
  { href: '/ingresos', label: 'Ingresos', icon: 'TrendingUp' },
  { href: '/gastos', label: 'Gastos', icon: 'Receipt' },
  { href: '/ahorros', label: 'Ahorros', icon: 'PiggyBank' },
  { href: '/presupuesto', label: 'Presupuesto', icon: 'Wallet' },
  { href: '/reportes', label: 'Reportes', icon: 'BarChart3' },
  { href: '/calendario', label: 'Calendario', icon: 'Calendar' },
  { href: '/configuracion', label: 'Configuración', icon: 'Settings' },
];
const NAV_ICON_ATTRS = { width: 18, height: 18 };
const PROFILE_PATH = '/perfil';

// Los listeners de click/tema de abajo están registrados UNA sola vez
// a nivel de módulo, no dentro de renderSidebar/renderTopbar: el
// shell solo se re-pinta cuando cambia de usuario o cuando
// forceShellRerender() lo obliga (ej. tras editar el nombre en
// Perfil), y si vivieran dentro de esas funciones, cada re-render
// agregaría OTRO listener a `window`/`document` sin quitar el
// anterior — una fuga que se acumula por sesión. Viviendo aquí
// arriba, sobreviven a cualquier cantidad de re-renders y siempre
// consultan el DOM actual, nunca uno obsoleto.
window.addEventListener('themechange', (event) => {
  const themeSwitch = document.getElementById('sidebar-theme-switch');
  if (themeSwitch) themeSwitch.checked = event.detail.theme === 'dark';
});

document.addEventListener('click', (event) => {
  const searchWrap = document.querySelector('.topbar-search');
  if (searchWrap && !searchWrap.contains(event.target)) {
    document.getElementById('topbar-search-results')?.setAttribute('hidden', '');
  }
  const notifWrap = document.querySelector('.topbar-notifications');
  if (notifWrap && !notifWrap.contains(event.target)) {
    document.getElementById('topbar-notif-dropdown')?.setAttribute('hidden', '');
  }
});

// Recuerda para qué usuario se pintó el shell por última vez, para no
// reconstruir sidebar/topbar completos en cada navegación (solo se
// actualiza el link activo) — evita parpadeos innecesarios.
let renderedForUserId = null;

function renderSidebar(container, currentPath, session) {
  const fullName = session?.user?.user_metadata?.full_name || session?.user?.email || 'Usuario';
  const initial = fullName.trim().charAt(0).toUpperCase();
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';

  container.innerHTML = `
    <div class="sidebar-brand">
      <span class="brand-badge" aria-hidden="true">${iconHTML('Wallet', { width: 18, height: 18 })}</span>
      <span>FinanzasPro</span>
    </div>
    <hr class="sidebar-divider">
    <nav class="sidebar-nav" aria-label="Navegación principal">
      ${NAV_ITEMS.map((item) => `
        <a href="${item.href}" class="sidebar-link${item.href === currentPath ? ' active' : ''}" data-nav-link>
          <span class="sidebar-link-icon" aria-hidden="true">${iconHTML(item.icon, NAV_ICON_ATTRS)}</span>
          <span>${item.label}</span>
        </a>
      `).join('')}
    </nav>

    <div class="sidebar-footer">
      <button type="button" class="sidebar-logout" id="logout-btn">
        <span class="sidebar-link-icon" aria-hidden="true">${iconHTML('LogOut', NAV_ICON_ATTRS)}</span>
        Cerrar sesión
      </button>

      <label class="theme-switch">
        <input type="checkbox" id="sidebar-theme-switch" ${currentTheme === 'dark' ? 'checked' : ''}>
        <span class="theme-switch-track" aria-hidden="true"><span class="theme-switch-thumb"></span></span>
        <span class="theme-switch-label">Modo oscuro</span>
      </label>

      <hr class="sidebar-divider" style="margin: var(--space-2) 0;">

      <a href="${PROFILE_PATH}" class="sidebar-user${currentPath === PROFILE_PATH ? ' active' : ''}" data-nav-link>
        <span class="sidebar-user-avatar" aria-hidden="true">${escapeHtml(initial)}</span>
        <span class="sidebar-user-info">
          <span class="sidebar-user-name">${escapeHtml(fullName)}</span>
          <span class="sidebar-user-role">Cuenta personal</span>
        </span>
        <span class="sidebar-user-chevron" aria-hidden="true">${iconHTML('ChevronRight', { width: 16, height: 16 })}</span>
      </a>
    </div>
  `;

  document.getElementById('logout-btn')?.addEventListener('click', async () => {
    // No navega manualmente: el listener global de onAuthStateChange
    // en router.js detecta 'SIGNED_OUT' y redirige a /login por sí solo.
    await signOut();
    renderedForUserId = null;
  });

  document.getElementById('sidebar-theme-switch')?.addEventListener('change', (event) => {
    setTheme(event.target.checked ? 'dark' : 'light');
  });

  container.querySelectorAll('.sidebar-link, .sidebar-user').forEach((link) => {
    link.addEventListener('click', () => closeSidebar());
  });
}

// El sidebar (#app-sidebar) y su fondo (#sidebar-backdrop) son nodos
// estáticos de index.html, nunca se recrean — por eso este listener
// vive a nivel de módulo (se registra una sola vez) en vez de dentro
// de renderSidebar()/renderTopbar(), que sí se re-ejecutan.
function closeSidebar() {
  document.getElementById('app-sidebar')?.classList.remove('is-open');
  document.getElementById('sidebar-backdrop')?.setAttribute('hidden', '');
}

document.getElementById('sidebar-backdrop')?.addEventListener('click', closeSidebar);

function renderSearchResults(results) {
  const box = document.getElementById('topbar-search-results');
  if (!box) return;

  if (!results.length) {
    box.innerHTML = '<p class="empty-state" style="padding: var(--space-4);">Sin resultados.</p>';
    box.hidden = false;
    return;
  }

  box.innerHTML = results.map((row) => {
    const targetPage = row.tipo === 'ingreso' ? '/ingresos' : '/gastos';
    const sign = row.tipo === 'ingreso' ? '+' : '-';
    const amountClass = row.tipo === 'ingreso' ? 'income' : 'expense';
    return `
      <a href="${targetPage}" class="topbar-search-result">
        <span class="movement-icon ${row.tipo === 'ingreso' ? 'movement-icon-success' : 'movement-icon-danger'}">${escapeHtml(row.categoria_icono ?? '')}</span>
        <span class="movement-info">
          <span class="movement-title">${escapeHtml(row.descripcion?.trim() || row.categoria || '')}</span>
          <span class="movement-meta">${escapeHtml(row.categoria ?? '')} · ${escapeHtml(formatDate(row.fecha))}</span>
        </span>
        <span class="movement-amount ${amountClass}">${sign} ${escapeHtml(formatCurrency(row.monto))}</span>
      </a>
    `;
  }).join('');
  box.hidden = false;
}

function initTopbarSearch(userId) {
  const input = document.getElementById('topbar-search-input');
  const results = document.getElementById('topbar-search-results');
  if (!input || !results) return;

  const runSearch = debounce(async (term) => {
    if (term.trim().length < 2) {
      results.hidden = true;
      return;
    }
    const rows = await searchMovimientos(userId, term);
    renderSearchResults(rows);
  }, 300);

  input.addEventListener('input', (event) => runSearch(event.target.value));
  input.addEventListener('focus', () => {
    if (input.value.trim().length >= 2) results.hidden = false;
  });
}

function renderNotifications(alerts) {
  const list = document.getElementById('topbar-notif-list');
  const empty = document.getElementById('topbar-notif-empty');
  const badge = document.getElementById('topbar-notif-badge');
  if (!list) return;

  if (badge) {
    badge.textContent = String(alerts.length);
    badge.hidden = alerts.length === 0;
  }

  list.innerHTML = '';
  if (!alerts.length) {
    if (empty) empty.hidden = false;
    return;
  }
  if (empty) empty.hidden = true;

  for (const alert of alerts) {
    const item = document.createElement('a');
    item.href = '/presupuesto';
    item.className = 'movement-item topbar-notif-item';

    const iconEl = document.createElement('span');
    iconEl.className = 'movement-icon movement-icon-warning';
    iconEl.appendChild(icon('TriangleAlert', { width: 16, height: 16 }));

    const info = document.createElement('span');
    info.className = 'movement-info';
    const title = document.createElement('span');
    title.className = 'movement-title';
    title.textContent = alert.mensaje;
    info.appendChild(title);

    item.append(iconEl, info);
    item.addEventListener('click', () => { marcarAlertaLeida(alert.id); });
    list.appendChild(item);
  }
}

async function initTopbarNotifications(userId) {
  const btn = document.getElementById('topbar-notif-btn');
  const dropdown = document.getElementById('topbar-notif-dropdown');
  if (!btn || !dropdown) return;

  const alerts = await listAlertasPresupuesto(userId);
  renderNotifications(alerts);

  btn.addEventListener('click', (event) => {
    event.stopPropagation();
    dropdown.hidden = !dropdown.hidden;
  });
}

function renderTopbar(container, session) {
  const userId = session.user.id;

  container.innerHTML = `
    <button type="button" class="sidebar-mobile-toggle" id="sidebar-mobile-toggle" aria-label="Abrir menú">${iconHTML('Menu', { width: 20, height: 20 })}</button>

    <div class="topbar-search">
      <span class="topbar-search-icon" aria-hidden="true">${iconHTML('Search', { width: 16, height: 16 })}</span>
      <input type="search" id="topbar-search-input" class="topbar-search-input" placeholder="Buscar movimientos..." autocomplete="off" aria-label="Buscar movimientos">
      <div class="topbar-search-results" id="topbar-search-results" hidden></div>
    </div>

    <div class="topbar-spacer"></div>

    <div class="topbar-notifications">
      <button type="button" class="topbar-icon-btn" id="topbar-notif-btn" aria-label="Notificaciones">
        ${iconHTML('Bell', { width: 18, height: 18 })}
        <span class="topbar-badge" id="topbar-notif-badge" hidden></span>
      </button>
      <div class="topbar-notif-dropdown" id="topbar-notif-dropdown" hidden>
        <div class="topbar-notif-header">Notificaciones</div>
        <div class="movement-list" id="topbar-notif-list"></div>
        <p class="empty-state" id="topbar-notif-empty" hidden>Sin notificaciones nuevas.</p>
      </div>
    </div>
  `;

  document.getElementById('sidebar-mobile-toggle')?.addEventListener('click', () => {
    const isOpen = document.getElementById('app-sidebar')?.classList.toggle('is-open');
    document.getElementById('sidebar-backdrop')?.toggleAttribute('hidden', !isOpen);
  });

  initTopbarSearch(userId);
  initTopbarNotifications(userId);
}

// Fuerza que la próxima llamada a renderAppShell() vuelva a pintar el
// sidebar/topbar completos aunque sea el mismo usuario — se usa
// cuando cambia algo que muestran (ej. el nombre en Perfil), sin
// necesidad de recargar la página (eso rompería la SPA).
export function forceShellRerender() {
  renderedForUserId = null;
}

export async function renderAppShell(session, currentPath) {
  const sidebar = document.getElementById('app-sidebar');
  const topbar = document.getElementById('app-topbar');

  if (renderedForUserId !== session.user.id) {
    renderSidebar(sidebar, currentPath, session);
    renderTopbar(topbar, session);
    renderedForUserId = session.user.id;
  } else {
    sidebar.querySelectorAll('.sidebar-link').forEach((link) => {
      link.classList.toggle('active', link.getAttribute('href') === currentPath);
    });
    sidebar.querySelector('.sidebar-user')?.classList.toggle('active', currentPath === PROFILE_PATH);
  }
}
