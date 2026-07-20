// ============================================================
// FinanzasPro — Vista: /gastos
// ============================================================

import {
  getCategoriasGasto, listGastos, createGasto, updateGasto, deleteGasto, getUltimaAlertaPresupuesto,
} from '../../services/gastosService.js';
import { formatCurrency, formatDate, todayISO, debounce, renderSkeletonRows } from '../helpers.js';
import { escapeHtml, sanitizeInput } from '../security.js';
import { validateRequired, validatePositiveAmount, applyFormErrors, hasErrors } from '../validation.js';
import { createIconButton, iconHTML } from '../icons.js';
import { paginate, totalPagesFor, clampPage, renderPaginationControls } from '../pagination.js';

export const layout = 'app';
export const requiresAuth = true;
export const title = 'Gastos';

const PER_PAGE = 10;

export function render() {
  return `
    <div class="page-header">
      <div>
        <h1 class="page-title">Gastos</h1>
        <p class="page-subtitle">Alimentación, servicios, transporte, salud y más.</p>
      </div>
      <button type="button" class="btn btn-primary" id="new-gasto-btn">+ Nuevo gasto</button>
    </div>

    <div id="budget-alert-banner" class="alert alert-warning" role="alert" hidden></div>

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

    <section class="card panel" aria-label="Listado de gastos">
      <div class="panel-header">
        <h2 class="panel-title panel-title-tight">Historial</h2>
        <div class="table-search">
          <span class="table-search-icon" aria-hidden="true">${iconHTML('Search', { width: 16, height: 16 })}</span>
          <input type="search" class="input" id="gastos-table-search" placeholder="Buscar en la tabla..." autocomplete="off" aria-label="Buscar en el historial de gastos">
        </div>
        <p class="panel-total">Total del período: <strong id="gastos-total">S/ 0.00</strong></p>
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
          <tbody id="gastos-tbody"></tbody>
        </table>
      </div>
      <p class="empty-state" id="gastos-empty" hidden>No hay gastos registrados en este período.</p>
      <div class="pagination" id="gastos-pagination"></div>
    </section>

    <dialog id="gasto-dialog" class="modal">
      <div class="modal-body">
        <h2 class="modal-title" id="gasto-dialog-title">Nuevo gasto</h2>

        <form id="gasto-form" class="auth-form" novalidate>
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
            <label for="form-descripcion">Descripción</label>
            <input class="input" type="text" id="form-descripcion" name="descripcion" maxlength="500">
          </div>

          <div class="form-group">
            <label for="form-comprobante">Comprobante (enlace, opcional)</label>
            <input class="input" type="url" id="form-comprobante" name="comprobante" maxlength="500" placeholder="https://...">
          </div>

          <div class="form-group">
            <label for="form-observaciones">Observaciones</label>
            <textarea class="input" id="form-observaciones" name="observaciones" rows="2" maxlength="500"></textarea>
          </div>

          <div class="modal-actions">
            <button type="button" class="btn btn-ghost" id="gasto-dialog-cancel">Cancelar</button>
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
      (r.categoria?.nombre ?? '').toLowerCase().includes(term));
  }

  function renderTable() {
    if (signal.aborted) return;
    const tbody = container.querySelector('#gastos-tbody');
    const empty = container.querySelector('#gastos-empty');
    const totalEl = container.querySelector('#gastos-total');
    const paginationEl = container.querySelector('#gastos-pagination');
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
      tdDescripcion.textContent = row.descripcion || '—';

      const tdMonto = document.createElement('td');
      tdMonto.className = 'text-right amount-expense';
      tdMonto.textContent = formatCurrency(row.monto);

      const tdActions = document.createElement('td');
      tdActions.className = 'text-right';

      const editBtn = createIconButton({
        iconName: 'Pencil', label: 'Editar gasto', onClick: () => openForm(row), signal,
      });
      const deleteBtn = createIconButton({
        iconName: 'Trash2', label: 'Eliminar gasto', danger: true, onClick: () => confirmDelete(row.id), signal,
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
    allRows = await listGastos(userId, currentFilters());
    currentPage = 1;
    renderTable();
  }

  function openForm(row = null) {
    editingId = row?.id ?? null;
    const dialog = container.querySelector('#gasto-dialog');
    const form = container.querySelector('#gasto-form');
    form.reset();
    applyFormErrors(form, {});

    container.querySelector('#gasto-dialog-title').textContent = row ? 'Editar gasto' : 'Nuevo gasto';

    if (row) {
      form.fecha.value = row.fecha;
      form.hora.value = row.hora?.slice(0, 5) ?? '00:00';
      form.monto.value = row.monto;
      form.descripcion.value = row.descripcion ?? '';
      form.comprobante.value = row.comprobante_url ?? '';
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
    container.querySelector('#gasto-dialog').close();
    editingId = null;
  }

  async function confirmDelete(id) {
    if (!window.confirm('¿Eliminar este gasto? Esta acción no se puede deshacer.')) return;
    await deleteGasto(id);
    await refresh();
  }

  async function checkBudgetAlert() {
    const alert = await getUltimaAlertaPresupuesto(userId);
    if (!alert || signal.aborted) return;
    const ageMs = Date.now() - new Date(alert.created_at).getTime();
    if (ageMs > 15000) return;

    const banner = container.querySelector('#budget-alert-banner');
    banner.textContent = alert.mensaje;
    banner.hidden = false;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const form = event.target;

    const payload = {
      fecha: form.fecha.value,
      hora: form.hora.value,
      monto: form.monto.value,
      descripcion: sanitizeInput(form.descripcion.value, 500) || null,
      comprobante_url: sanitizeInput(form.comprobante.value, 500) || null,
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
        await updateGasto(editingId, payload);
      } else {
        await createGasto({ ...payload, user_id: userId });
        await checkBudgetAlert();
      }
      closeForm();
      await refresh();
    } catch {
      applyFormErrors(form, { monto: 'No se pudo guardar. Intenta de nuevo.' });
    } finally {
      submitBtn.disabled = false;
    }
  }

  renderSkeletonRows(container.querySelector('#gastos-tbody'), 5);
  categorias = await getCategoriasGasto();
  populateCategorySelects();
  await refresh();
  if (signal.aborted) return;

  container.querySelector('#new-gasto-btn').addEventListener('click', () => openForm(), { signal });
  container.querySelector('#gasto-form').addEventListener('submit', handleSubmit, { signal });
  container.querySelector('#gasto-dialog-cancel').addEventListener('click', closeForm, { signal });
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
  container.querySelector('#gastos-table-search').addEventListener('input', (event) => runSearch(event.target.value), { signal });
}
