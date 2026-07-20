// ============================================================
// FinanzasPro — Helpers puros (formateo de moneda/fecha, utilidades)
// Sin dependencias de Supabase ni del DOM: fáciles de reutilizar y
// de probar en cualquier página.
// ============================================================

import { APP_CONFIG } from './config.js';

// 1250.5 -> "S/ 1,250.50"
export function formatCurrency(amount) {
  const value = Number(amount ?? 0);
  return new Intl.NumberFormat(APP_CONFIG.locale, {
    style: 'currency',
    currency: APP_CONFIG.currency,
  }).format(value);
}

// Date -> "19/07/2026" (zona horaria America/Lima, nunca la del navegador)
export function formatDate(date) {
  const d = date instanceof Date ? date : new Date(date);
  return new Intl.DateTimeFormat(APP_CONFIG.locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: APP_CONFIG.timezone,
  }).format(d);
}

// Date -> "14:35" (formato 24 horas, nunca AM/PM)
export function formatTime(date) {
  const d = date instanceof Date ? date : new Date(date);
  return new Intl.DateTimeFormat(APP_CONFIG.locale, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: APP_CONFIG.timezone,
  }).format(d);
}

// "Mozilla/5.0 (Windows NT 10.0...) ... Chrome/120 ..." -> "Chrome en Windows"
// Heurística simple para el historial de accesos (Perfil) — no es
// detección de dispositivo con fines de seguridad, solo un texto
// legible para el usuario.
export function parseUserAgent(userAgent) {
  if (!userAgent) return 'Navegador desconocido';

  let browser = 'Navegador';
  if (/Edg\//.test(userAgent)) browser = 'Edge';
  else if (/OPR\//.test(userAgent)) browser = 'Opera';
  else if (/Firefox\//.test(userAgent)) browser = 'Firefox';
  else if (/Chrome\//.test(userAgent)) browser = 'Chrome';
  else if (/Safari\//.test(userAgent)) browser = 'Safari';

  let os = '';
  if (/Windows/.test(userAgent)) os = 'Windows';
  else if (/Mac OS X/.test(userAgent)) os = 'macOS';
  else if (/Android/.test(userAgent)) os = 'Android';
  else if (/iPhone|iPad/.test(userAgent)) os = 'iOS';
  else if (/Linux/.test(userAgent)) os = 'Linux';

  return os ? `${browser} en ${os}` : browser;
}

// Fecha de HOY en America/Lima como "yyyy-mm-dd", lista para <input type="date">
export function todayISO() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: APP_CONFIG.timezone }).format(new Date());
}

export function debounce(fn, delay = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

// Filas de carga para <tbody> (Fase 9): se pintan mientras la primera
// consulta a Supabase está en curso, en vez de dejar la tabla vacía
// hasta que lleguen los datos reales.
export function renderSkeletonRows(tbody, columns, rowCount = 5) {
  const cells = Array.from({ length: columns }, () => '<td><span class="skeleton skeleton-text"></span></td>').join('');
  tbody.innerHTML = Array.from({ length: rowCount }, () => `<tr>${cells}</tr>`).join('');
}
