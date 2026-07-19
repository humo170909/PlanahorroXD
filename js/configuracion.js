// ============================================================
// FinanzasPro — Lógica de configuracion.html
// ============================================================

import { initAppShell } from './layout.js';
import { getProfile, updateProfile } from '../services/authService.js';
import { setTheme } from './app.js';
import { validatePositiveAmount, applyFormErrors, hasErrors } from './validation.js';

const THEME_KEY = 'finanzaspro-theme';
let userId = null;

function initThemeControls() {
  const saved = localStorage.getItem(THEME_KEY) || 'system';
  const radio = document.querySelector(`input[name="theme"][value="${saved}"]`);
  if (radio) radio.checked = true;

  document.querySelectorAll('input[name="theme"]').forEach((input) => {
    input.addEventListener('change', () => setTheme(input.value));
  });
}

async function loadPreferences() {
  const profile = await getProfile(userId);
  const form = document.getElementById('preferences-form');
  form.sueldoMensual.value = profile.sueldo_mensual ?? '';
  form.metaAhorroPct.value = profile.meta_ahorro_pct ?? '';
}

async function handleSubmit(event) {
  event.preventDefault();
  const form = event.target;
  const status = document.getElementById('preferences-status');

  const sueldo = form.sueldoMensual.value;
  const metaPct = form.metaAhorroPct.value;

  const errors = {
    sueldoMensual: sueldo ? validatePositiveAmount(sueldo, 'El sueldo') : null,
    metaAhorroPct: metaPct && (Number(metaPct) < 0 || Number(metaPct) > 100)
      ? 'Debe estar entre 0 y 100.'
      : null,
  };
  applyFormErrors(form, errors);
  if (hasErrors(errors)) return;

  const submitBtn = form.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  try {
    await updateProfile(userId, {
      sueldo_mensual: sueldo || null,
      meta_ahorro_pct: metaPct || null,
    });
    status.textContent = 'Preferencias guardadas.';
    status.className = 'alert alert-success';
    status.hidden = false;
  } catch {
    status.textContent = 'No se pudo guardar. Intenta de nuevo.';
    status.className = 'alert alert-error';
    status.hidden = false;
  } finally {
    submitBtn.disabled = false;
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const session = await initAppShell();
  if (!session) return;
  userId = session.user.id;

  initThemeControls();
  await loadPreferences();

  document.getElementById('preferences-form').addEventListener('submit', handleSubmit);
});
