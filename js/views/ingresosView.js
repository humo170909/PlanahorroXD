// ============================================================
// FinanzasPro — Vista: /ingresos
// ============================================================

import {
  getCategoriasIngreso, listIngresos, createIngreso, updateIngreso, deleteIngreso,
} from '../../services/ingresosService.js';
import { formatCurrency, formatDate, todayISO, debounce, renderSkeletonRows } from '../helpers.js';
import { escapeHtml, sanitizeInput } from '../security.js';
import { validateRequired, validatePositiveAmount, applyFormErrors, hasErrors } from '../validation.js';
import { createIconButton, iconHTML } from '../icons.js';
import { paginate, totalPagesFor, clampPage, renderPaginationControls } from '../pagination.js';

const PER_PAGE = 10;

export const layout = 'app';
export const requiresAuth = true;
export const title = 'Ingresos';

export function render() {
  return `
    <div class="page-header">
      <div>
        <h1 class="page-title">Ingresos</h1>
        <p class="page-subtitle">Sueldo, freelance, horas extras, ventas y otros ingresos.</p>
      </div>
      <button type="button" class="btn btn-primary" id="new-ingreso-btn">+ Nuevo ingreso</button>
    </div>

    <form id="filter-form" class="card filters-bar">
      <div class="form-group">
        <label for="filter-fecha-inicio">Desde</label>
        <input class="input" type="date" id="filter-fecha-inicio" name="fechaInicio">
      </div>
      <div class="form-group">
        <label for="filter-fecha-fin">Hasta</label>
        <input class="input" type="date" id="filter-fecha-fin" name="fechaFin">
      </div>
      <div class="form-group">
        <label for="filter-categoria">Categoría</label>
        <select class="input" id="filter-categoria" name="categoryId">
          <option value="">Todas las categorías</option>
        </select>
      </div>
      <button type="submit" class="btn btn-secondary">Filtrar</button>
      <button type="button" class="btn btn-ghost" id="filter-clear">Limpiar</button>
    </form>

    <section class="card panel" aria-label="Listado de ingresos">
      <div class="panel-header">
        <h2 class="panel-title panel-title-tight">Historial</h2>
        <div class="table-search">
          <span class="table-search-icon" aria-hidden="true">${iconHTML('Search', { width: 16, height: 16 })}</span>
          <input type="search" class="input" id="ingresos-table-search" placeholder="Buscar en la tabla..." autocomplete="off" aria-label="Buscar en el historial de ingresos">
        </div>
        <p class="panel-total">Total del período: <strong id="ingresos-total">S/ 0.00</strong></p>
      </div>

      <div class="table-wrapper">
        <table class="table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Categoría</th>
              <th>Descripción</th>
              <th class="text-right">Monto</th>
              <th class="text-right">Acciones</th>
            </tr>
          </thead>
          <tbody id="ingresos-tbody"></tbody>
        </table>
      </div>
      <p class="empty-state" id="ingresos-empty" hidden>No hay ingresos registrados en este período.</p>
      <div class="pagination" id="ingresos-pagination"></div>
    </section>

    <dialog id="ingreso-dialog" class="modal">
      <div class="modal-body">
        <h2 class="modal-title" id="ingreso-dialog-title">Nuevo ingreso</h2>

        <form id="ingreso-form" class="auth-form" novalidate>
          <div class="form-group">
            <label for="form-fecha">Fecha</label>
            <input class="input" type="date" id="form-fecha" name="fecha" required>
            <span class="input-error-msg" data-error-for="fecha"></span>
          </div>

          <div class="form-group">
            <label for="form-hora">Hora</label>
            <input class="input" type="time" id="form-hora" name="hora">
          </div>

          <div class="form-group">
            <label for="form-categoria">Categoría</label>
            <select class="input" id="form-categoria" name="categoryId" required>
              <option value="" disabled selected>Selecciona una categoría</option>
            </select>
            <span class="input-error-msg" data-error-for="categoryId"></span>
          </div>

          <div class="form-group">
            <label for="form-monto">Monto (S/)</label>
            <input class="input" type="number" id="form-monto" name="monto" step="0.01" min="0.01" required>
            <span class="input-error-msg" data-error-for="monto"></span>
          </div>

          <div class="form-group">
            <label for="form-cliente">Cliente (opcional)</label>
            <input class="input" type="text" id="form-cliente" name="cliente" maxlength="120">
          </div>

          <div class="form-group">
            <label for="form-descripcion">Descripción</label>
            <input class="input" type="text" id="form-descripcion" name="descripcion" maxlength="500">
          </div>

          <div class="form-group">
            <label for="form-observaciones">Observaciones</label>
            <textarea class="input" id="form-observaciones" name="observaciones" rows="2" maxlength="500"></textarea>
          </div>

          <div class="modal-actions">
            <button type="button" class="btn btn-ghost" id="ingreso-dialog-cancel">Cancelar</button>
            <button type="submit" class="btn btn-primary">Guardar</button>
          </div>
        </form>
      </div>
    </dialog>
  `;
}

export async function init(container, { signal, session }) {
  const userId = session.user.id;
  let categorias = [];
  let editingId = null;
  let allRows = [];
  let searchTerm = '';
  let currentPage = 1;

  // Ver comentario extenso equivalente en presupuestoView.js: sin esta
  // guarda, una consulta a Supabase que resuelve DESPUÉS de que el
  // usuario ya navegó a otra vista intentaría pintar sobre un
  // #view-root cuyo contenido el router ya reemplazó, y
  // container.querySelector(...) devolvería null.
  function populateCategorySelects() {
    if (signal.aborted) return;
    const options = categorias.map((c) => `<option value="${c.id}">${escapeHtml(c.nombre)}</option>`).join('');
    const filterSelect = container.querySelector('#filter-categoria');
    if (filterSelect) filterSelect.innerHTML = '<option value="">Todas las categorías</option>' + options;
    const formSelect = container.querySelector('#form-categoria');
    if (formSelect) formSelect.innerHTML = '<option value="" disabled selected>Selecciona una categoría</option>' + options;
  }

  function currentFilters() {
    return {
      fechaInicio: container.querySelector('#filter-fecha-inicio').value || undefined,
      fechaFin: container.querySelector('#filter-fecha-fin').value || undefined,
      categoryId: container.querySelector('#filter-categoria').value || undefined,
    };
  }

  // El buscador de la tabla filtra sobre `allRows` (ya cargadas para
  // el rango de fechas/categoría elegido) — no dispara ninguna
  // consulta nueva a Supabase, es puro filtrado en memoria.
  function filteredRows() {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return allRows;
    return allRows.filter((r) =>
      (r.descripcion ?? '').toLowerCase().includes(term) ||
      (r.cliente ?? '').toLowerCase().includes(term) ||
      (r.categoria?.nombre ?? '').toLowerCase().includes(term));
  }

  function renderTable() {
    if (signal.aborted) return;
    const tbody = container.querySelector('#ingresos-tbody');
    const empty = container.querySelector('#ingresos-empty');
    const totalEl = container.querySelector('#ingresos-total');
    const paginationEl = container.querySelector('#ingresos-pagination');
    tbody.innerHTML = '';

    const rows = filteredRows();
    const total = rows.reduce((sum, r) => sum + Number(r.monto), 0);
    totalEl.textContent = formatCurrency(total);

    if (!rows.length) {
      empty.hidden = false;
      paginationEl.innerHTML = '';
      return;
    }
    empty.hidden = true;

    const pages = totalPagesFor(rows.length, PER_PAGE);
    currentPage = clampPage(currentPage, pages);
    const pageRows = paginate(rows, currentPage, PER_PAGE);

    for (const row of pageRows) {
      const tr = document.createElement('tr');

      const tdFecha = document.createElement('td');
      tdFecha.textContent = `${formatDate(row.fecha)} ${row.hora?.slice(0, 5) ?? ''}`;

      const tdCategoria = document.createElement('td');
      const badge = document.createElement('span');
      badge.className = 'badge';
      badge.textContent = row.categoria?.nombre ?? '—';
      tdCategoria.appendChild(badge);

      const tdDescripcion = document.createElement('td');
      tdDescripcion.textContent = row.descripcion || row.cliente || '—';

      const tdMonto = document.createElement('td');
      tdMonto.className = 'text-right amount-income';
      tdMonto.textContent = formatCurrency(row.monto);

      const tdActions = document.createElement('td');
      tdActions.className = 'text-right';

      const editBtn = createIconButton({
        iconName: 'Pencil', label: 'Editar ingreso', onClick: () => openForm(row), signal,
      });
      const deleteBtn = createIconButton({
        iconName: 'Trash2', label: 'Eliminar ingreso', danger: true, onClick: () => confirmDelete(row.id), signal,
      });

      tdActions.append(editBtn, deleteBtn);
      tr.append(tdFecha, tdCategoria, tdDescripcion, tdMonto, tdActions);
      tbody.appendChild(tr);
    }

    renderPaginationControls(paginationEl, {
      page: currentPage,
      totalPages: pages,
      onChange: (page) => { currentPage = page; renderTable(); },
      signal,
    });
  }

  async function refresh() {
    allRows = await listIngresos(userId, currentFilters());
    currentPage = 1;
    renderTable();
  }

  function openForm(row = null) {
    editingId = row?.id ?? null;
    const dialog = container.querySelector('#ingreso-dialog');
    const form = container.querySelector('#ingreso-form');
    form.reset();
    applyFormErrors(form, {});

    container.querySelector('#ingreso-dialog-title').textContent = row ? 'Editar ingreso' : 'Nuevo ingreso';

    if (row) {
      form.fecha.value = row.fecha;
      form.hora.value = row.hora?.slice(0, 5) ?? '00:00';
      form.monto.value = row.monto;
      form.cliente.value = row.cliente ?? '';
      form.descripcion.value = row.descripcion ?? '';
      form.observaciones.value = row.observaciones ?? '';
      form.categoryId.value = row.categoria?.id ?? '';
    } else {
      form.fecha.value = todayISO();
      form.hora.value = new Intl.DateTimeFormat('es-PE', {
        hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Lima',
      }).format(new Date());
    }

    dialog.showModal();
  }

  function closeForm() {
    container.querySelector('#ingreso-dialog').close();
    editingId = null;
  }

  async function confirmDelete(id) {
    if (!window.confirm('¿Eliminar este ingreso? Esta acción no se puede deshacer.')) return;
    await deleteIngreso(id);
    await refresh();
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const form = event.target;

    const payload = {
      fecha: form.fecha.value,
      hora: form.hora.value,
      monto: form.monto.value,
      cliente: sanitizeInput(form.cliente.value, 120) || null,
      descripcion: sanitizeInput(form.descripcion.value, 500) || null,
      observaciones: sanitizeInput(form.observaciones.value, 500) || null,
      category_id: form.categoryId.value,
    };

    const errors = {
      fecha: validateRequired(payload.fecha, 'La fecha'),
      categoryId: validateRequired(payload.category_id, 'La categoría'),
      monto: validatePositiveAmount(payload.monto),
    };
    applyFormErrors(form, errors);
    if (hasErrors(errors)) return;

    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    try {
      if (editingId) {
        await updateIngreso(editingId, payload);
      } else {
        await createIngreso({ ...payload, user_id: userId });
      }
      closeForm();
      await refresh();
    } catch {
      applyFormErrors(form, { monto: 'No se pudo guardar. Intenta de nuevo.' });
    } finally {
      submitBtn.disabled = false;
    }
  }

  renderSkeletonRows(container.querySelector('#ingresos-tbody'), 5);
  categorias = await getCategoriasIngreso();
  populateCategorySelects();
  await refresh();
  if (signal.aborted) return;

  container.querySelector('#new-ingreso-btn').addEventListener('click', () => openForm(), { signal });
  container.querySelector('#ingreso-form').addEventListener('submit', handleSubmit, { signal });
  container.querySelector('#ingreso-dialog-cancel').addEventListener('click', closeForm, { signal });
  container.querySelector('#filter-form').addEventListener('submit', (event) => {
    event.preventDefault();
    refresh();
  }, { signal });
  container.querySelector('#filter-clear').addEventListener('click', () => {
    container.querySelector('#filter-form').reset();
    refresh();
  }, { signal });

  const runSearch = debounce((value) => {
    searchTerm = value;
    currentPage = 1;
    renderTable();
  }, 200);
  container.querySelector('#ingresos-table-search').addEventListener('input', (event) => runSearch(event.target.value), { signal });
}
