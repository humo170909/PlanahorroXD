// ============================================================
// FinanzasPro — Lógica de UI para login.html y register.html
// ============================================================

import { signUp, signIn, sendPasswordReset, updatePassword, getSession } from '../services/authService.js';
import { validateEmail, validatePassword, validateRequired, validateMatch, applyFormErrors, hasErrors } from './validation.js';
import { sanitizeInput } from './security.js';

// ------------------------------------------------------------
// Protección anti fuerza bruta (cliente).
// Esto es un DETERRENTE de UX, no la protección real: Supabase Auth
// ya aplica rate limiting del lado del servidor sobre los intentos de
// login. Este contador solo evita que un usuario/bot machaque el botón
// de "Iniciar sesión" sin pausa, y da feedback claro. Ver Fase 10 para
// más contexto sobre defensas server-side (CAPTCHA, WAF).
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

function registerFailedAttempt() {
  const state = readAttempts();
  const now = Date.now();
  if (now - state.first > LOCKOUT_WINDOW_MS) {
    localStorage.setItem(LOCKOUT_KEY, JSON.stringify({ count: 1, first: now }));
    return;
  }
  localStorage.setItem(LOCKOUT_KEY, JSON.stringify({ count: state.count + 1, first: state.first }));
}

function clearAttempts() {
  localStorage.removeItem(LOCKOUT_KEY);
}

function checkLockout() {
  const state = readAttempts();
  const now = Date.now();
  if (now - state.first > LOCKOUT_WINDOW_MS) return { locked: false };
  if (state.count >= MAX_ATTEMPTS) {
    const remainingMs = LOCKOUT_WINDOW_MS - (now - state.first);
    return { locked: true, remainingMinutes: Math.ceil(remainingMs / 60000) };
  }
  return { locked: false };
}

// ------------------------------------------------------------
// Helpers de UI
// ------------------------------------------------------------
function showAlert(container, message, type = 'error') {
  if (!container) return;
  container.textContent = message;
  container.className = `alert alert-${type}`;
  container.hidden = false;
}

function setLoading(button, loading) {
  if (!button) return;
  button.disabled = loading;
  button.classList.toggle('is-loading', loading);
}

async function redirectIfAuthenticated() {
  const session = await getSession();
  if (session) window.location.href = 'dashboard.html';
}

// ------------------------------------------------------------
// login.html
// ------------------------------------------------------------
function initLoginForm() {
  const form = document.getElementById('login-form');
  if (!form) return;

  redirectIfAuthenticated();

  const alertBox = document.getElementById('login-alert');
  const submitBtn = form.querySelector('button[type="submit"]');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    alertBox.hidden = true;

    const lockout = checkLockout();
    if (lockout.locked) {
      showAlert(alertBox, `Demasiados intentos fallidos. Intenta de nuevo en ${lockout.remainingMinutes} min.`);
      return;
    }

    const email = sanitizeInput(form.email.value);
    const password = form.password.value;

    const errors = {
      email: validateEmail(email),
      password: validateRequired(password, 'La contraseña'),
    };
    applyFormErrors(form, errors);
    if (hasErrors(errors)) return;

    setLoading(submitBtn, true);
    try {
      await signIn({ email, password });
      clearAttempts();
      window.location.href = 'dashboard.html';
    } catch {
      registerFailedAttempt();
      showAlert(alertBox, 'Correo o contraseña incorrectos.');
    } finally {
      setLoading(submitBtn, false);
    }
  });

  initForgotPasswordFlow(form, alertBox);
}

function initForgotPasswordFlow(loginForm, alertBox) {
  const forgotLink = document.getElementById('forgot-password-link');
  const forgotForm = document.getElementById('forgot-password-form');
  const backLink = document.getElementById('back-to-login-link');
  if (!forgotLink || !forgotForm) return;

  forgotLink.addEventListener('click', (event) => {
    event.preventDefault();
    loginForm.hidden = true;
    forgotForm.hidden = false;
  });

  backLink?.addEventListener('click', (event) => {
    event.preventDefault();
    forgotForm.hidden = true;
    loginForm.hidden = false;
  });

  forgotForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = sanitizeInput(forgotForm.email.value);
    const errors = { email: validateEmail(email) };
    applyFormErrors(forgotForm, errors);
    if (hasErrors(errors)) return;

    const btn = forgotForm.querySelector('button[type="submit"]');
    setLoading(btn, true);
    try {
      await sendPasswordReset(email);
    } catch {
      // Se ignora intencionalmente: nunca revelamos si el correo existe o no
      // (evita que un atacante use este formulario para enumerar usuarios).
    } finally {
      setLoading(btn, false);
      forgotForm.hidden = true;
      loginForm.hidden = false;
      showAlert(alertBox, 'Si el correo existe en el sistema, te enviamos un enlace para restablecer tu contraseña.', 'success');
    }
  });
}

// ------------------------------------------------------------
// Flujo de recuperación: Supabase redirige aquí (login.html) con
// #type=recovery en la URL después de que el usuario hace clic en el
// enlace del correo. detectSessionInUrl (supabase.js) ya procesó el
// token; solo mostramos el formulario de "nueva contraseña".
// ------------------------------------------------------------
function initRecoveryFlow() {
  if (!window.location.hash.includes('type=recovery')) return;

  const loginForm = document.getElementById('login-form');
  const recoveryForm = document.getElementById('recovery-form');
  const alertBox = document.getElementById('login-alert');
  if (!recoveryForm) return;

  if (loginForm) loginForm.hidden = true;
  recoveryForm.hidden = false;

  recoveryForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const password = recoveryForm.password.value;
    const confirmPassword = recoveryForm.confirmPassword.value;

    const errors = {
      password: validatePassword(password),
      confirmPassword: validateMatch(password, confirmPassword, 'La confirmación'),
    };
    applyFormErrors(recoveryForm, errors);
    if (hasErrors(errors)) return;

    const btn = recoveryForm.querySelector('button[type="submit"]');
    setLoading(btn, true);
    try {
      await updatePassword(password);
      window.location.href = 'dashboard.html';
    } catch {
      showAlert(alertBox, 'No se pudo actualizar la contraseña. El enlace pudo haber expirado, solicita uno nuevo.');
    } finally {
      setLoading(btn, false);
    }
  });
}

// ------------------------------------------------------------
// register.html
// ------------------------------------------------------------
function initRegisterForm() {
  const form = document.getElementById('register-form');
  if (!form) return;

  redirectIfAuthenticated();

  const alertBox = document.getElementById('register-alert');
  const submitBtn = form.querySelector('button[type="submit"]');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    alertBox.hidden = true;

    const fullName = sanitizeInput(form.fullName.value, 120);
    const email = sanitizeInput(form.email.value);
    const password = form.password.value;
    const confirmPassword = form.confirmPassword.value;
    const termsAccepted = form.terms.checked;

    const errors = {
      fullName: validateRequired(fullName, 'El nombre'),
      email: validateEmail(email),
      password: validatePassword(password),
      confirmPassword: validateMatch(password, confirmPassword, 'La confirmación'),
      terms: termsAccepted ? null : 'Debes aceptar los términos para continuar.',
    };
    applyFormErrors(form, errors);
    if (hasErrors(errors)) return;

    setLoading(submitBtn, true);
    try {
      await signUp({ email, password, fullName });
      showAlert(alertBox, 'Cuenta creada. Revisa tu correo para confirmarla antes de iniciar sesión.', 'success');
      form.reset();
    } catch (error) {
      const message = error?.message?.includes('already registered')
        ? 'Ya existe una cuenta con ese correo.'
        : 'No se pudo crear la cuenta. Intenta de nuevo.';
      showAlert(alertBox, message);
    } finally {
      setLoading(submitBtn, false);
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initLoginForm();
  initRecoveryFlow();
  initRegisterForm();
});
