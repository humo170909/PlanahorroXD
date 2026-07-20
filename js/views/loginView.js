// ============================================================
// FinanzasPro — Vista: /login
// ============================================================

import {
  signIn, sendPasswordReset, updatePassword, logLoginAttempt, getRecentFailedAttempts,
} from '../../services/authService.js';
import { validateEmail, validatePassword, validateRequired, validateMatch, applyFormErrors, hasErrors } from '../validation.js';
import { sanitizeInput } from '../security.js';
import { iconHTML } from '../icons.js';
import {
  checkLockout, registerFailedAttempt, clearAttempts, showAlert, setLoading, AUTH_LOCKOUT, renderAuthIllustration,
} from '../auth.js';

export const layout = 'auth';
export const requiresAuth = false;
export const title = 'Iniciar sesión';

export function render() {
  return `
    ${renderAuthIllustration()}
    <div class="auth-form-panel">
      <section class="auth-card card-glass" aria-labelledby="login-title">
        <div class="auth-brand">
          <span class="brand-badge" aria-hidden="true">${iconHTML('Wallet', { width: 20, height: 20 })}</span>
          <span class="auth-brand-name">FinanzasPro</span>
        </div>

        <h1 id="login-title" class="auth-title">Bienvenido de vuelta</h1>
        <p class="auth-subtitle">Ingresa a tu cuenta para continuar controlando tus finanzas.</p>

        <div id="login-alert" class="alert" role="alert" hidden></div>

        <form id="login-form" class="auth-form" novalidate>
          <div class="form-group">
            <label for="login-email">Correo electrónico</label>
            <input class="input" type="email" id="login-email" name="email" autocomplete="email" required>
            <span class="input-error-msg" data-error-for="email"></span>
          </div>

          <div class="form-group">
            <label for="login-password">Contraseña</label>
            <input class="input" type="password" id="login-password" name="password" autocomplete="current-password" required>
            <span class="input-error-msg" data-error-for="password"></span>
          </div>

          <div class="auth-form-row">
            <a href="#" id="forgot-password-link" class="link-muted">¿Olvidaste tu contraseña?</a>
          </div>

          <button type="submit" class="btn btn-primary btn-block">Iniciar sesión</button>
        </form>

        <form id="forgot-password-form" class="auth-form" novalidate hidden>
          <p class="auth-subtitle">Ingresa tu correo y te enviaremos un enlace para restablecer tu contraseña.</p>
          <div class="form-group">
            <label for="forgot-email">Correo electrónico</label>
            <input class="input" type="email" id="forgot-email" name="email" autocomplete="email" required>
            <span class="input-error-msg" data-error-for="email"></span>
          </div>
          <button type="submit" class="btn btn-primary btn-block">Enviar enlace</button>
          <a href="#" id="back-to-login-link" class="link-muted auth-form-row">Volver a iniciar sesión</a>
        </form>

        <form id="recovery-form" class="auth-form" novalidate hidden>
          <p class="auth-subtitle">Crea tu nueva contraseña.</p>
          <div class="form-group">
            <label for="recovery-password">Nueva contraseña</label>
            <input class="input" type="password" id="recovery-password" name="password" autocomplete="new-password" required>
            <span class="input-error-msg" data-error-for="password"></span>
          </div>
          <div class="form-group">
            <label for="recovery-confirm">Confirmar contraseña</label>
            <input class="input" type="password" id="recovery-confirm" name="confirmPassword" autocomplete="new-password" required>
            <span class="input-error-msg" data-error-for="confirmPassword"></span>
          </div>
          <button type="submit" class="btn btn-primary btn-block">Guardar contraseña</button>
        </form>

        <p class="auth-footer">¿No tienes cuenta? <a href="/register">Regístrate</a></p>
      </section>
    </div>
  `;
}

export function init(container, { signal, navigate }) {
  const form = container.querySelector('#login-form');
  const alertBox = container.querySelector('#login-alert');
  const submitBtn = form.querySelector('button[type="submit"]');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    alertBox.hidden = true;

    // Dos capas de bloqueo: la de localStorage responde al instante
    // pero cualquiera la salta borrando el almacenamiento; la de
    // Supabase (fn_recent_failed_attempts) es la que de verdad importa
    // porque vive en la base de datos, no en el navegador de quien
    // ataca. Si la consulta al servidor falla, no se bloquea por eso
    // — un problema de red nunca debe dejar afuera a un usuario real.
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
      const recentFailures = await getRecentFailedAttempts(email);
      if (recentFailures >= AUTH_LOCKOUT.MAX_ATTEMPTS) {
        showAlert(alertBox, 'Demasiados intentos fallidos recientes para esta cuenta. Intenta de nuevo en unos minutos.');
        return;
      }

      await signIn({ email, password });
      clearAttempts();
      await logLoginAttempt({ email, success: true });
      navigate('/dashboard');
    } catch {
      registerFailedAttempt();
      await logLoginAttempt({ email, success: false });
      showAlert(alertBox, 'Correo o contraseña incorrectos.');
    } finally {
      setLoading(submitBtn, false);
    }
  }, { signal });

  initForgotPasswordFlow(container, form, alertBox, signal);
  initRecoveryFlow(container, alertBox, navigate, signal);
}

function initForgotPasswordFlow(container, loginForm, alertBox, signal) {
  const forgotLink = container.querySelector('#forgot-password-link');
  const forgotForm = container.querySelector('#forgot-password-form');
  const backLink = container.querySelector('#back-to-login-link');
  if (!forgotLink || !forgotForm) return;

  forgotLink.addEventListener('click', (event) => {
    event.preventDefault();
    loginForm.hidden = true;
    forgotForm.hidden = false;
  }, { signal });

  backLink?.addEventListener('click', (event) => {
    event.preventDefault();
    forgotForm.hidden = true;
    loginForm.hidden = false;
  }, { signal });

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
      // Intencional: nunca revelamos si el correo existe o no
      // (evita que este formulario se use para enumerar usuarios).
    } finally {
      setLoading(btn, false);
      forgotForm.hidden = true;
      loginForm.hidden = false;
      showAlert(alertBox, 'Si el correo existe en el sistema, te enviamos un enlace para restablecer tu contraseña.', 'success');
    }
  }, { signal });
}

// Supabase redirige aquí (/login) con #type=recovery en la URL después
// de que el usuario hace clic en el enlace del correo. supabase.js
// (detectSessionInUrl) ya procesó el token; solo mostramos el
// formulario de "nueva contraseña".
function initRecoveryFlow(container, alertBox, navigate, signal) {
  if (!window.location.hash.includes('type=recovery')) return;

  const loginForm = container.querySelector('#login-form');
  const recoveryForm = container.querySelector('#recovery-form');
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
      navigate('/dashboard');
    } catch {
      showAlert(alertBox, 'No se pudo actualizar la contraseña. El enlace pudo haber expirado, solicita uno nuevo.');
    } finally {
      setLoading(btn, false);
    }
  }, { signal });
}
