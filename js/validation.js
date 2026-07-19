// ============================================================
// FinanzasPro — Validadores de formulario reutilizables
//
// Estos validadores son la primera línea de defensa (UX inmediata).
// La segunda línea, obligatoria, son los CHECK constraints en
// Postgres (database/database.sql) — un usuario podría desactivar
// JavaScript o llamar a la API directamente, así que el frontend
// nunca es la única barrera.
// ============================================================

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(email) {
  if (!email) return 'El correo es obligatorio.';
  if (!EMAIL_RE.test(email)) return 'Ingresa un correo válido.';
  return null;
}

export function validatePassword(password) {
  if (!password) return 'La contraseña es obligatoria.';
  if (password.length < 8) return 'Debe tener al menos 8 caracteres.';
  if (!/[A-Z]/.test(password)) return 'Debe incluir al menos una letra mayúscula.';
  if (!/[0-9]/.test(password)) return 'Debe incluir al menos un número.';
  return null;
}

export function validateRequired(value, label) {
  if (value === null || value === undefined || !String(value).trim()) {
    return `${label} es obligatorio.`;
  }
  return null;
}

export function validateMatch(valueA, valueB, label) {
  if (valueA !== valueB) return `${label} no coincide.`;
  return null;
}

export function validatePositiveAmount(value, label = 'El monto') {
  const num = Number(value);
  if (value === '' || value === null || Number.isNaN(num)) return `${label} debe ser un número.`;
  if (num <= 0) return `${label} debe ser mayor a 0.`;
  return null;
}

// Pinta los mensajes de error debajo de cada campo y marca el input
// como inválido. Espera que el formulario tenga, por cada campo:
//   <input name="campo">
//   <span data-error-for="campo"></span>
export function applyFormErrors(form, errors) {
  form.querySelectorAll('[data-error-for]').forEach((el) => { el.textContent = ''; });
  form.querySelectorAll('.input').forEach((el) => el.classList.remove('input-invalid'));

  for (const [field, message] of Object.entries(errors)) {
    if (!message) continue;
    const input = form.querySelector(`[name="${field}"]`);
    const msgEl = form.querySelector(`[data-error-for="${field}"]`);
    if (input) input.classList.add('input-invalid');
    if (msgEl) msgEl.textContent = message;
  }
}

export function hasErrors(errors) {
  return Object.values(errors).some(Boolean);
}
