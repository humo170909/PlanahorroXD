// ============================================================
// FinanzasPro — Vista: /register
// ============================================================

import { signUp } from '../../services/authService.js';
import { validateEmail, validatePassword, validateRequired, validateMatch, applyFormErrors, hasErrors } from '../validation.js';
import { sanitizeInput } from '../security.js';
import { iconHTML } from '../icons.js';
import { showAlert, setLoading, renderAuthIllustration } from '../auth.js';

export const layout = 'auth';
export const requiresAuth = false;
export const title = 'Crear cuenta';

export function render() {
  return `
    ${renderAuthIllustration()}
    <div class="auth-form-panel">
      <section class="auth-card card-glass" aria-labelledby="register-title">
        <div class="auth-brand">
          <span class="brand-badge" aria-hidden="true">${iconHTML('Wallet', { width: 20, height: 20 })}</span>
          <span class="auth-brand-name">FinanzasPro</span>
        </div>

        <h1 id="register-title" class="auth-title">Crea tu cuenta</h1>
        <p class="auth-subtitle">Empieza a controlar tus ingresos, gastos y ahorros hoy mismo.</p>

        <div id="register-alert" class="alert" role="alert" hidden></div>

        <form id="register-form" class="auth-form" novalidate>
          <div class="form-group">
            <label for="register-name">Nombre completo</label>
            <input class="input" type="text" id="register-name" name="fullName" autocomplete="name" required>
            <span class="input-error-msg" data-error-for="fullName"></span>
          </div>

          <div class="form-group">
            <label for="register-email">Correo electrónico</label>
            <input class="input" type="email" id="register-email" name="email" autocomplete="email" required>
            <span class="input-error-msg" data-error-for="email"></span>
          </div>

          <div class="form-group">
            <label for="register-password">Contraseña</label>
            <input class="input" type="password" id="register-password" name="password" autocomplete="new-password" required>
            <span class="input-error-msg" data-error-for="password"></span>
          </div>

          <div class="form-group">
            <label for="register-confirm">Confirmar contraseña</label>
            <input class="input" type="password" id="register-confirm" name="confirmPassword" autocomplete="new-password" required>
            <span class="input-error-msg" data-error-for="confirmPassword"></span>
          </div>

          <label class="checkbox-row">
            <input type="checkbox" name="terms">
            Acepto los términos y el tratamiento de mis datos financieros.
          </label>
          <span class="input-error-msg" data-error-for="terms"></span>

          <button type="submit" class="btn btn-primary btn-block">Crear cuenta</button>
        </form>

        <p class="auth-footer">¿Ya tienes cuenta? <a href="/login">Inicia sesión</a></p>
      </section>
    </div>
  `;
}

export function init(container, { signal }) {
  const form = container.querySelector('#register-form');
  const alertBox = container.querySelector('#register-alert');
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
  }, { signal });
}
