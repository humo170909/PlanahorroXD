// ============================================================
// FinanzasPro — Vista: /perfil
// ============================================================

import {
  getProfile, updateProfile, updateAuthUser, updatePassword, getSession, getLoginHistory,
} from '../../services/authService.js';
import { formatDate, formatTime, parseUserAgent } from '../helpers.js';
import { sanitizeInput } from '../security.js';
import { validateRequired, validatePassword, validateMatch, applyFormErrors, hasErrors } from '../validation.js';
import { renderAppShell, forceShellRerender } from '../layout.js';
import { icon } from '../icons.js';

export const layout = 'app';
export const requiresAuth = true;
export const title = 'Perfil';

export function render() {
  return `
    <div class="page-header">
      <div>
        <h1 class="page-title">Perfil</h1>
        <p class="page-subtitle">Tus datos de cuenta.</p>
      </div>
    </div>

    <section class="card panel panel-narrow panel-spaced">
      <h2 class="panel-title">Datos personales</h2>

      <div class="goal-card-meta mb-4">
        <span>Correo: <strong id="profile-email" class="text-emphasis"></strong></span>
      </div>
      <div class="goal-card-meta mb-4">
        <span>Miembro desde: <strong id="profile-member-since" class="text-emphasis"></strong></span>
      </div>

      <div id="profile-status" class="alert" role="status" hidden></div>

      <form id="profile-form" class="auth-form" novalidate>
        <div class="form-group">
          <label for="profile-full-name">Nombre completo</label>
          <input class="input" type="text" id="profile-full-name" name="fullName" maxlength="120" required>
          <span class="input-error-msg" data-error-for="fullName"></span>
        </div>
        <button type="submit" class="btn btn-primary">Guardar cambios</button>
      </form>
    </section>

    <section class="card panel panel-narrow">
      <h2 class="panel-title">Cambiar contraseña</h2>

      <div id="password-status" class="alert" role="status" hidden></div>

      <form id="password-form" class="auth-form" novalidate>
        <div class="form-group">
          <label for="new-password">Nueva contraseña</label>
          <input class="input" type="password" id="new-password" name="newPassword" autocomplete="new-password" required>
          <span class="input-error-msg" data-error-for="newPassword"></span>
        </div>
        <div class="form-group">
          <label for="confirm-password">Confirmar contraseña</label>
          <input class="input" type="password" id="confirm-password" name="confirmPassword" autocomplete="new-password" required>
          <span class="input-error-msg" data-error-for="confirmPassword"></span>
        </div>
        <button type="submit" class="btn btn-secondary">Actualizar contraseña</button>
      </form>
    </section>

    <section class="card panel panel-medium panel-spaced-top" aria-label="Historial de accesos">
      <h2 class="panel-title">Historial de accesos</h2>
      <div class="movement-list" id="login-history-list"></div>
      <p class="empty-state" id="login-history-empty" hidden>Aún no hay accesos registrados.</p>
    </section>
  `;
}

export async function init(container, { signal, session }) {
  const userId = session.user.id;

  function showStatus(el, message, type) {
    el.textContent = message;
    el.className = `alert alert-${type}`;
    el.hidden = false;
  }

  async function loadProfile() {
    const profile = await getProfile(userId);
    if (signal.aborted) return;
    container.querySelector('#profile-email').textContent = session.user.email;
    container.querySelector('#profile-member-since').textContent = formatDate(profile.created_at);
    container.querySelector('#profile-form').fullName.value = profile.full_name;
  }

  async function handleProfileSubmit(event) {
    event.preventDefault();
    const form = event.target;
    const fullName = sanitizeInput(form.fullName.value, 120);

    const errors = { fullName: validateRequired(fullName, 'El nombre') };
    applyFormErrors(form, errors);
    if (hasErrors(errors)) return;

    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    const status = container.querySelector('#profile-status');
    try {
      // Dos fuentes que mantener sincronizadas: la metadata de Auth
      // (lo que lee la topbar) y la tabla profiles (lo que usan el
      // resto de consultas). Sin recargar la página: se vuelve a
      // pintar el shell con la sesión ya actualizada.
      await updateAuthUser({ data: { full_name: fullName } });
      await updateProfile(userId, { full_name: fullName });
      const freshSession = await getSession();
      forceShellRerender();
      await renderAppShell(freshSession, '/perfil');
      showStatus(status, 'Perfil actualizado.', 'success');
    } catch {
      showStatus(status, 'No se pudo actualizar. Intenta de nuevo.', 'error');
    } finally {
      submitBtn.disabled = false;
    }
  }

  async function handlePasswordSubmit(event) {
    event.preventDefault();
    const form = event.target;
    const password = form.newPassword.value;
    const confirmPassword = form.confirmPassword.value;

    const errors = {
      newPassword: validatePassword(password),
      confirmPassword: validateMatch(password, confirmPassword, 'La confirmación'),
    };
    applyFormErrors(form, errors);
    if (hasErrors(errors)) return;

    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    const status = container.querySelector('#password-status');
    try {
      await updatePassword(password);
      form.reset();
      showStatus(status, 'Contraseña actualizada.', 'success');
    } catch {
      showStatus(status, 'No se pudo actualizar la contraseña.', 'error');
    } finally {
      submitBtn.disabled = false;
    }
  }

  async function loadLoginHistory() {
    const list = container.querySelector('#login-history-list');
    const empty = container.querySelector('#login-history-empty');

    let attempts = [];
    try {
      attempts = await getLoginHistory(session.user.email);
    } catch {
      // Si falla la consulta, se muestra como historial vacío en vez
      // de romper el resto de la página de Perfil.
    }
    if (signal.aborted) return;

    if (!attempts.length) {
      empty.hidden = false;
      return;
    }
    empty.hidden = true;

    for (const attempt of attempts) {
      const item = document.createElement('div');
      item.className = 'movement-item';

      const statusIcon = document.createElement('span');
      statusIcon.className = `movement-icon ${attempt.success ? 'movement-icon-success' : 'movement-icon-danger'}`;
      statusIcon.appendChild(icon(attempt.success ? 'CircleCheck' : 'CircleX', { width: 18, height: 18 }));

      const info = document.createElement('div');
      info.className = 'movement-info';
      const title = document.createElement('div');
      title.className = 'movement-title';
      title.textContent = attempt.success ? 'Inicio de sesión correcto' : 'Intento fallido';
      const meta = document.createElement('div');
      meta.className = 'movement-meta';
      meta.textContent = `${parseUserAgent(attempt.user_agent)} · ${formatDate(attempt.created_at)} ${formatTime(attempt.created_at)}`;
      info.append(title, meta);

      item.append(statusIcon, info);
      list.appendChild(item);
    }
  }

  await loadProfile();
  await loadLoginHistory();
  if (signal.aborted) return;

  container.querySelector('#profile-form').addEventListener('submit', handleProfileSubmit, { signal });
  container.querySelector('#password-form').addEventListener('submit', handlePasswordSubmit, { signal });
}
