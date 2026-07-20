// ============================================================
// FinanzasPro — Efecto ripple en botones (Fase 9)
// Un solo listener delegado en document, registrado una vez al
// arrancar la app: como los botones se crean y destruyen constantemente
// con cada vista de la SPA, enganchar uno por uno se rompería en cada
// navegación (y con cada re-render de tablas/paneles).
// ============================================================

const RIPPLE_SELECTOR = '.btn, .icon-btn, .topbar-icon-btn';

document.addEventListener('click', (event) => {
  const target = event.target.closest(RIPPLE_SELECTOR);
  if (!target || target.disabled) return;

  const rect = target.getBoundingClientRect();
  const span = document.createElement('span');
  span.className = 'ripple';
  span.style.setProperty('--ripple-x', `${event.clientX - rect.left}px`);
  span.style.setProperty('--ripple-y', `${event.clientY - rect.top}px`);
  span.addEventListener('animationend', () => span.remove());
  target.appendChild(span);
});
