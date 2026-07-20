// ============================================================
// FinanzasPro — Paginación reutilizable (Fase 7: tablas modernas)
// Usada por ingresosView.js y gastosView.js para no duplicar la
// misma lógica de "página N de M" en cada vista con tabla.
// ============================================================

import { icon } from './icons.js';

export function paginate(items, page, perPage) {
  const start = (page - 1) * perPage;
  return items.slice(start, start + perPage);
}

export function totalPagesFor(itemCount, perPage) {
  return Math.max(1, Math.ceil(itemCount / perPage));
}

export function clampPage(page, totalPages) {
  return Math.min(Math.max(1, page), totalPages);
}

// Pinta los controles "‹ Página N de M ›" dentro de `container` y
// engancha los clics. `onChange` recibe el nuevo número de página.
export function renderPaginationControls(container, { page, totalPages, onChange, signal }) {
  container.innerHTML = '';
  if (totalPages <= 1) return;

  const prevBtn = document.createElement('button');
  prevBtn.type = 'button';
  prevBtn.className = 'icon-btn';
  prevBtn.disabled = page <= 1;
  prevBtn.setAttribute('aria-label', 'Página anterior');
  prevBtn.appendChild(icon('ChevronLeft', { width: 16, height: 16 }));
  prevBtn.addEventListener('click', () => onChange(page - 1), { signal });

  const info = document.createElement('span');
  info.className = 'pagination-info';
  info.textContent = `Página ${page} de ${totalPages}`;

  const nextBtn = document.createElement('button');
  nextBtn.type = 'button';
  nextBtn.className = 'icon-btn';
  nextBtn.disabled = page >= totalPages;
  nextBtn.setAttribute('aria-label', 'Página siguiente');
  nextBtn.appendChild(icon('ChevronRight', { width: 16, height: 16 }));
  nextBtn.addEventListener('click', () => onChange(page + 1), { signal });

  container.append(prevBtn, info, nextBtn);
}
