// ============================================================
// FinanzasPro — Bootstrap común de la SPA (se carga una sola vez,
// vía <script> en index.html — nunca por página, porque ya no hay
// una página por vista).
// Responsabilidad: modo oscuro/claro persistente. El resaltado del
// link activo lo hace layout.js en cada navegación (conoce la ruta
// actual del router); la lógica de cada vista vive en js/views/*.js.
// ============================================================

import { icon as renderIcon, renderIconPlaceholders } from './icons.js';
import './ripple.js';

const THEME_KEY = 'finanzaspro-theme';

// Aplica el atributo data-theme al <html> y avisa al resto de la app.
// No toca localStorage — eso lo decide quien llama (setTheme vs. modo "sistema").
function setThemeAttribute(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  document.querySelectorAll('[data-theme-toggle]').forEach((btn) => {
    const iconEl = btn.querySelector('.theme-toggle-icon');
    if (iconEl) iconEl.replaceChildren(renderIcon(theme === 'dark' ? 'Sun' : 'Moon', { width: 18, height: 18 }));
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

// Se ejecuta al nivel superior del módulo, NO dentro de un listener de
// DOMContentLoaded: los scripts type="module" ya son diferidos por el
// navegador (se ejecutan después de parsear el HTML), y este archivo
// se declara antes que main.js en index.html — así que data-theme
// queda fijado en <html> ANTES de que main.js arranque el router y
// renderice la primera vista. Si esto viviera dentro de
// DOMContentLoaded, la primera vista podría pintarse (y layout.js leer
// el tema para elegir el ícono sol/luna) antes de que initTheme() corra.
initTheme();
renderIconPlaceholders();
document.querySelectorAll('[data-theme-toggle]').forEach((btn) => {
  btn.addEventListener('click', toggleTheme);
});
