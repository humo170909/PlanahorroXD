// ============================================================
// FinanzasPro — Shell de la aplicación (sidebar + topbar)
//
// Cada página protegida trae en su HTML dos contenedores vacíos:
//   <aside id="app-sidebar"></aside>
//   <header id="app-topbar"></header>
// initAppShell() los rellena y, de paso, actúa como GUARD DE SESIÓN:
// si no hay usuario autenticado, redirige a login.html antes de que
// la página muestre ningún dato. Así ninguna página privada depende
// de "acordarse" de revisar la sesión por su cuenta.
// ============================================================

import { getSession, signOut, onAuthStateChange } from '../services/authService.js';
import { escapeHtml } from './security.js';
import { toggleTheme } from './app.js';

const NAV_ITEMS = [
  { href: 'dashboard.html', label: 'Dashboard', icon: '🏠' },
  { href: 'ingresos.html', label: 'Ingresos', icon: '💵' },
  { href: 'gastos.html', label: 'Gastos', icon: '🧾' },
  { href: 'ahorros.html', label: 'Ahorros', icon: '🎯' },
  { href: 'presupuesto.html', label: 'Presupuesto', icon: '📊' },
  { href: 'reportes.html', label: 'Reportes', icon: '📈' },
  { href: 'configuracion.html', label: 'Configuración', icon: '⚙️' },
  { href: 'perfil.html', label: 'Perfil', icon: '👤' },
];

function currentPage() {
  return window.location.pathname.split('/').pop() || 'dashboard.html';
}

function renderSidebar(container) {
  const page = currentPage();

  container.innerHTML = `
    <div class="sidebar-brand">
      <span aria-hidden="true">💰</span>
      <span>FinanzasPro</span>
    </div>
    <nav class="sidebar-nav" aria-label="Navegación principal">
      ${NAV_ITEMS.map((item) => `
        <a href="${item.href}" class="sidebar-link${item.href === page ? ' active' : ''}" data-nav-link>
          <span class="sidebar-link-icon" aria-hidden="true">${item.icon}</span>
          <span>${item.label}</span>
        </a>
      `).join('')}
    </nav>
    <button type="button" class="sidebar-logout" id="logout-btn">
      <span aria-hidden="true">🚪</span> Cerrar sesión
    </button>
  `;

  document.getElementById('logout-btn')?.addEventListener('click', async () => {
    await signOut();
    window.location.href = 'login.html';
  });

  container.querySelectorAll('.sidebar-link').forEach((link) => {
    link.addEventListener('click', () => container.classList.remove('is-open'));
  });
}

function renderTopbar(container, session) {
  const fullName = session?.user?.user_metadata?.full_name || session?.user?.email || 'Usuario';
  const initial = fullName.trim().charAt(0).toUpperCase();
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';

  container.innerHTML = `
    <button type="button" class="sidebar-mobile-toggle" id="sidebar-mobile-toggle" aria-label="Abrir menú">☰</button>
    <div class="topbar-spacer"></div>
    <button type="button" class="theme-toggle theme-toggle-inline" data-theme-toggle aria-label="Cambiar tema">
      <span class="theme-toggle-icon" aria-hidden="true">${currentTheme === 'dark' ? '☀️' : '🌙'}</span>
    </button>
    <div class="topbar-user">
      <span class="topbar-user-avatar" aria-hidden="true">${escapeHtml(initial)}</span>
      <span class="topbar-user-name">${escapeHtml(fullName)}</span>
    </div>
  `;

  document.getElementById('sidebar-mobile-toggle')?.addEventListener('click', () => {
    document.getElementById('app-sidebar')?.classList.toggle('is-open');
  });

  container.querySelector('[data-theme-toggle]')?.addEventListener('click', toggleTheme);
}

export async function initAppShell() {
  const sidebar = document.getElementById('app-sidebar');
  const topbar = document.getElementById('app-topbar');
  if (!sidebar && !topbar) return null; // página sin shell (login/register)

  const session = await getSession();
  if (!session) {
    window.location.href = 'login.html';
    return null;
  }

  if (sidebar) renderSidebar(sidebar);
  if (topbar) renderTopbar(topbar, session);

  onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') window.location.href = 'login.html';
  });

  return session;
}
