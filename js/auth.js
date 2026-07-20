// ============================================================
// FinanzasPro — Helpers compartidos de autenticación
// Usado por js/views/loginView.js y js/views/registerView.js.
// La lógica específica de cada formulario vive en esas vistas — este
// módulo solo trae lo que ambas comparten: el contador anti fuerza
// bruta, utilidades pequeñas de UI (alertas, estado de carga) y el
// panel ilustrado compartido (Fase 3 del rediseño premium).
// ============================================================

import { iconHTML } from './icons.js';

// Panel izquierdo de login/register: 100% CSS/HTML (gradiente + una
// tarjeta "mock" del dashboard con barras), no una imagen — este
// proyecto no tiene herramientas de generación de imágenes, así que
// en vez de fingir una ilustración 3D se construyó un mock de
// producto real, que es exactamente lo que Stripe/Linear/Vercel
// muestran en sus propias pantallas de login.
export function renderAuthIllustration() {
  const barHeights = [40, 65, 45, 80, 55, 70];
  return `
    <aside class="auth-illustration" aria-hidden="true">
      <div class="auth-illustration-glow auth-illustration-glow-1"></div>
      <div class="auth-illustration-glow auth-illustration-glow-2"></div>
      <div class="auth-illustration-content">
        <span class="brand-badge auth-illustration-badge">${iconHTML('Wallet', { width: 22, height: 22 })}</span>
        <h2 class="auth-illustration-title">Controla tus finanzas,<br>alcanza tus metas.</h2>
        <p class="auth-illustration-subtitle">Ingresos, gastos, ahorros y presupuesto en un solo lugar — con inteligencia financiera real, no solo números.</p>

        <div class="auth-mock-card">
          <div class="auth-mock-card-header">
            <span>Balance disponible</span>
            <span class="auth-mock-trend">+12.5%</span>
          </div>
          <div class="auth-mock-card-value">S/ 1,857.00</div>
          <div class="auth-mock-bars">
            ${barHeights.map((h, i) => `<span style="height:${h}%; animation-delay:${i * 60}ms;"></span>`).join('')}
          </div>
        </div>
      </div>
    </aside>
  `;
}

// ------------------------------------------------------------
// Protección anti fuerza bruta (cliente).
// Esto es un DETERRENTE de UX, no la protección real: Supabase Auth
// ya aplica rate limiting del lado del servidor sobre los intentos de
// login. Este contador solo evita que un usuario/bot machaque el botón
// de "Iniciar sesión" sin pausa, y da feedback claro. La Fase 5 de este
// rediseño agrega, además, un registro de auditoría en Supabase.
// ------------------------------------------------------------
const LOCKOUT_KEY = 'finanzaspro-login-attempts';
const MAX_ATTEMPTS = 5;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000;

function readAttempts() {
  try {
    return JSON.parse(localStorage.getItem(LOCKOUT_KEY)) ?? { count: 0, first: Date.now() };
  } catch {
    return { count: 0, first: Date.now() };
  }
}

export function registerFailedAttempt() {
  const state = readAttempts();
  const now = Date.now();
  if (now - state.first > LOCKOUT_WINDOW_MS) {
    localStorage.setItem(LOCKOUT_KEY, JSON.stringify({ count: 1, first: now }));
    return 1;
  }
  const count = state.count + 1;
  localStorage.setItem(LOCKOUT_KEY, JSON.stringify({ count, first: state.first }));
  return count;
}

export function clearAttempts() {
  localStorage.removeItem(LOCKOUT_KEY);
}

export function checkLockout() {
  const state = readAttempts();
  const now = Date.now();
  if (now - state.first > LOCKOUT_WINDOW_MS) return { locked: false };
  if (state.count >= MAX_ATTEMPTS) {
    const remainingMs = LOCKOUT_WINDOW_MS - (now - state.first);
    return { locked: true, remainingMinutes: Math.ceil(remainingMs / 60000) };
  }
  return { locked: false };
}

export const AUTH_LOCKOUT = { MAX_ATTEMPTS, LOCKOUT_WINDOW_MS };

// ------------------------------------------------------------
// Helpers de UI
// ------------------------------------------------------------
export function showAlert(container, message, type = 'error') {
  if (!container) return;
  container.textContent = message;
  container.className = `alert alert-${type}`;
  container.hidden = false;
}

export function setLoading(button, loading) {
  if (!button) return;
  button.disabled = loading;
  button.classList.toggle('is-loading', loading);
}
