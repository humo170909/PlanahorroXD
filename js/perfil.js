// ============================================================
// FinanzasPro — Lógica de perfil.html
// ============================================================

import { initAppShell } from './layout.js';
import { getProfile, updateProfile, updateAuthUser, updatePassword } from '../services/authService.js';
import { formatDate } from './helpers.js';
import { sanitizeInput } from './security.js';
import { validateRequired, validatePassword, validateMatch, applyFormErrors, hasErrors } from './validation.js';

let userId = null;

function showStatus(el, message, type) {
  el.textContent = message;
  el.className = `alert alert-${type}`;
  el.hidden = false;
}

async function loadProfile(session) {
  const profile = await getProfile(userId);
  document.getElementById('profile-email').textContent = session.user.email;
  document.getElementById('profile-member-since').textContent = formatDate(profile.created_at);
  document.getElementById('profile-form').fullName.value = profile.full_name;
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
  const status = document.getElementById('profile-status');
  try {
    // Se actualizan dos fuentes: la metadata de Auth (lo que lee la
    // topbar en cada carga de página) y la tabla profiles (lo que usan
    // el resto de consultas). Mantenerlas sincronizadas evita que el
    // nombre se vea distinto según la pantalla.
    await updateAuthUser({ data: { full_name: fullName } });
    await updateProfile(userId, { full_name: fullName });
    showStatus(status, 'Perfil actualizado. Recargando...', 'success');
    setTimeout(() => window.location.reload(), 900);
  } catch {
    showStatus(status, 'No se pudo actualizar. Intenta de nuevo.', 'error');
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
  const status = document.getElementById('password-status');
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

document.addEventListener('DOMContentLoaded', async () => {
  const session = await initAppShell();
  if (!session) return;
  userId = session.user.id;

  await loadProfile(session);

  document.getElementById('profile-form').addEventListener('submit', handleProfileSubmit);
  document.getElementById('password-form').addEventListener('submit', handlePasswordSubmit);
});
