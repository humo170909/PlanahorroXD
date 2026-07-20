// ============================================================
// FinanzasPro — Vista: /configuracion
// ============================================================

import { getProfile, updateProfile } from '../../services/authService.js';
import { setTheme } from '../app.js';
import { validatePositiveAmount, applyFormErrors, hasErrors } from '../validation.js';

const THEME_KEY = 'finanzaspro-theme';

export const layout = 'app';
export const requiresAuth = true;
export const title = 'Configuración';

export function render() {
  return `
    <div class="page-header">
      <div>
        <h1 class="page-title">Configuración</h1>
        <p class="page-subtitle">Apariencia y datos base para tu inteligencia financiera.</p>
      </div>
    </div>

    <section class="card panel panel-narrow panel-spaced">
      <h2 class="panel-title">Apariencia</h2>
      <div class="radio-group">
        <label class="radio-option">
          <input type="radio" name="theme" value="light">
          Claro
        </label>
        <label class="radio-option">
          <input type="radio" name="theme" value="dark">
          Oscuro
        </label>
        <label class="radio-option">
          <input type="radio" name="theme" value="system">
          Sistema
        </label>
      </div>
    </section>

    <section class="card panel panel-narrow">
      <h2 class="panel-title">Datos financieros base</h2>
      <p class="field-hint mb-4">
        Moneda: <strong>PEN (S/)</strong> · Zona horaria: <strong>America/Lima</strong> — fijos en toda la aplicación.
      </p>

      <div id="preferences-status" class="alert" role="status" hidden></div>

      <form id="preferences-form" class="auth-form" novalidate>
        <div class="form-group">
          <label for="sueldo-mensual">Sueldo mensual de referencia (S/, opcional)</label>
          <input class="input" type="number" id="sueldo-mensual" name="sueldoMensual" step="0.01" min="0.01">
          <span class="input-error-msg" data-error-for="sueldoMensual"></span>
        </div>
        <div class="form-group">
          <label for="meta-ahorro-pct">Meta de ahorro mensual (%, opcional)</label>
          <input class="input" type="number" id="meta-ahorro-pct" name="metaAhorroPct" step="1" min="0" max="100">
          <span class="input-error-msg" data-error-for="metaAhorroPct"></span>
          <span class="field-hint">Se usa como referencia en los reportes de inteligencia financiera.</span>
        </div>
        <button type="submit" class="btn btn-primary">Guardar preferencias</button>
      </form>
    </section>
  `;
}

export async function init(container, { signal, session }) {
  const userId = session.user.id;

  function initThemeControls() {
    const saved = localStorage.getItem(THEME_KEY) || 'system';
    const radio = container.querySelector(`input[name="theme"][value="${saved}"]`);
    if (radio) radio.checked = true;

    container.querySelectorAll('input[name="theme"]').forEach((input) => {
      input.addEventListener('change', () => setTheme(input.value), { signal });
    });
  }

  async function loadPreferences() {
    const profile = await getProfile(userId);
    if (signal.aborted) return;
    const form = container.querySelector('#preferences-form');
    form.sueldoMensual.value = profile.sueldo_mensual ?? '';
    form.metaAhorroPct.value = profile.meta_ahorro_pct ?? '';
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const form = event.target;
    const status = container.querySelector('#preferences-status');

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

  initThemeControls();
  await loadPreferences();
  if (signal.aborted) return;

  container.querySelector('#preferences-form').addEventListener('submit', handleSubmit, { signal });
}
