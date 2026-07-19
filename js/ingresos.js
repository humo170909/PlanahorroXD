// ============================================================
// FinanzasPro — Lógica de ingresos.html
// ============================================================

import { initAppShell } from './layout.js';
import {
  getCategoriasIngreso, listIngresos, createIngreso, updateIngreso, deleteIngreso,
} from '../services/ingresosService.js';
import { formatCurrency, formatDate, todayISO } from './helpers.js';
import { escapeHtml, sanitizeInput } from './security.js';
import { validateRequired, validatePositiveAmount, applyFormErrors, hasErrors } from './validation.js';

let userId = null;
let categorias = [];
let editingId = null;

function populateCategorySelects() {
  const options = categorias.map((c) => `<option value="${c.id}">${c.icono} ${escapeHtml(c.nombre)}</option>`).join('');

  const filterSelect = document.getElementById('filter-categoria');
  if (filterSelect) filterSelect.innerHTML = '<option value="">Todas las categorías</option>' + options;

  const formSelect = document.getElementById('form-categoria');
  if (formSelect) formSelect.innerHTML = '<option value="" disabled selected>Selecciona una categoría</option>' + options;
}

function currentFilters() {
  return {
    fechaInicio: document.getElementById('filter-fecha-inicio').value || undefined,
    fechaFin: document.getElementById('filter-fecha-fin').value || undefined,
    categoryId: document.getElementById('filter-categoria').value || undefined,
  };
}

function renderTable(rows) {
  const tbody = document.getElementById('ingresos-tbody');
  const empty = document.getElementById('ingresos-empty');
  const totalEl = document.getElementById('ingresos-total');
  tbody.innerHTML = '';

  const total = rows.reduce((sum, r) => sum + Number(r.monto), 0);
  totalEl.textContent = formatCurrency(total);

  if (!rows.length) {
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  for (const row of rows) {
    const tr = document.createElement('tr');

    const tdFecha = document.createElement('td');
    tdFecha.textContent = `${formatDate(row.fecha)} ${row.hora?.slice(0, 5) ?? ''}`;

    const tdCategoria = document.createElement('td');
    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.textContent = `${row.categoria?.icono ?? '💰'} ${row.categoria?.nombre ?? '—'}`;
    tdCategoria.appendChild(badge);

    const tdDescripcion = document.createElement('td');
    tdDescripcion.textContent = row.descripcion || row.cliente || '—';

    const tdMonto = document.createElement('td');
    tdMonto.className = 'text-right amount-income';
    tdMonto.textContent = formatCurrency(row.monto);

    const tdActions = document.createElement('td');
    tdActions.className = 'text-right';

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'icon-btn';
    editBtn.setAttribute('aria-label', 'Editar ingreso');
    editBtn.textContent = '✏️';
    editBtn.addEventListener('click', () => openForm(row));

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'icon-btn icon-btn-danger';
    deleteBtn.setAttribute('aria-label', 'Eliminar ingreso');
    deleteBtn.textContent = '🗑️';
    deleteBtn.addEventListener('click', () => confirmDelete(row.id));

    tdActions.append(editBtn, deleteBtn);
    tr.append(tdFecha, tdCategoria, tdDescripcion, tdMonto, tdActions);
    tbody.appendChild(tr);
  }
}

async function refresh() {
  const rows = await listIngresos(userId, currentFilters());
  renderTable(rows);
}

function openForm(row = null) {
  editingId = row?.id ?? null;
  const dialog = document.getElementById('ingreso-dialog');
  const form = document.getElementById('ingreso-form');
  form.reset();
  applyFormErrors(form, {});

  document.getElementById('ingreso-dialog-title').textContent = row ? 'Editar ingreso' : 'Nuevo ingreso';

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
  document.getElementById('ingreso-dialog').close();
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

document.addEventListener('DOMContentLoaded', async () => {
  const session = await initAppShell();
  if (!session) return;
  userId = session.user.id;

  categorias = await getCategoriasIngreso();
  populateCategorySelects();
  await refresh();

  document.getElementById('new-ingreso-btn').addEventListener('click', () => openForm());
  document.getElementById('ingreso-form').addEventListener('submit', handleSubmit);
  document.getElementById('ingreso-dialog-cancel').addEventListener('click', closeForm);
  document.getElementById('filter-form').addEventListener('submit', (event) => {
    event.preventDefault();
    refresh();
  });
  document.getElementById('filter-clear').addEventListener('click', () => {
    document.getElementById('filter-form').reset();
    refresh();
  });
});
