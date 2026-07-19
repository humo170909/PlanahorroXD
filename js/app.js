// ============================================================
// FinanzasPro — Bootstrap común, cargado en TODAS las páginas
// Responsabilidades: modo oscuro/claro persistente y resaltar el
// enlace de navegación activo. La lógica específica de cada página
// vive en su propio archivo (auth.js, dashboard.js, etc.).
// ============================================================

const THEME_KEY = 'finanzaspro-theme';

// Aplica el atributo data-theme al <html> y avisa al resto de la app.
// No toca localStorage — eso lo decide quien llama (setTheme vs. modo "sistema").
function setThemeAttribute(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  document.querySelectorAll('[data-theme-toggle]').forEach((btn) => {
    const icon = btn.querySelector('.theme-toggle-icon');
    if (icon) icon.textContent = theme === 'dark' ? '☀️' : '🌙';
  });
  // Los gráficos (charts.js) leen colores desde CSS custom properties y no
  // se redibujan solos al cambiar de tema; las páginas con gráficos
  // escuchan este evento para volver a pintarlos con la paleta correcta.
  window.dispatchEvent(new CustomEvent('themechange', { detail: { theme } }));
}

function initTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved) {
    setThemeAttribute(saved);
    return;
  }
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  setThemeAttribute(prefersDark ? 'dark' : 'light');
}

// theme: 'light' | 'dark' | 'system'. 'system' borra la preferencia
// guardada y vuelve a seguir prefers-color-scheme del sistema operativo.
export function setTheme(theme) {
  if (theme === 'system') {
    localStorage.removeItem(THEME_KEY);
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setThemeAttribute(prefersDark ? 'dark' : 'light');
    return;
  }
  localStorage.setItem(THEME_KEY, theme);
  setThemeAttribute(theme);
}

export function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  setTheme(current === 'dark' ? 'light' : 'dark');
}

function highlightActiveNav() {
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('[data-nav-link]').forEach((link) => {
    const href = link.getAttribute('href');
    link.classList.toggle('active', href === currentPage);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  highlightActiveNav();
  document.querySelectorAll('[data-theme-toggle]').forEach((btn) => {
    btn.addEventListener('click', toggleTheme);
  });
});
