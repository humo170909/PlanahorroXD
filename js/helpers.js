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
