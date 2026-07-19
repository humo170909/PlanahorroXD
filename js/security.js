// ============================================================
// FinanzasPro — Utilidades de seguridad (frontend)
//
// Regla de oro: los datos que vienen del usuario NUNCA se insertan
// con innerHTML directamente. Se usa textContent (que no interpreta
// HTML) o, si hace falta insertar HTML propio, se escapan antes los
// valores dinámicos con escapeHtml().
// ============================================================

const HTML_ESCAPE_MAP = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[&<>"']/g, (char) => HTML_ESCAPE_MAP[char]);
}

// Pinta texto en el DOM de forma segura (nunca ejecuta HTML/JS embebido).
export function setTextSafe(element, value) {
  element.textContent = value ?? '';
}

// Recorta espacios y limita longitud antes de guardar/enviar un input.
// La validación de FORMA (email válido, número positivo, etc.) vive en
// validation.js; esto solo previene payloads absurdamente largos y
// espacios accidentales.
export function sanitizeInput(value, maxLength = 1000) {
  return String(value ?? '').trim().slice(0, maxLength);
}
