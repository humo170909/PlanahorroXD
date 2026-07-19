// ============================================================
// FinanzasPro — Lógica de presupuesto.html
// ============================================================

import { initAppShell } from './layout.js';
import {
  currentMonthISO, listPresupuestos, getGastoPorCategoriaMes, createPresupuesto,
  updatePresupuesto, deletePresupuesto, listAlertasPresupuesto, marcarAlertaLeida,
} from '../services/presupuestoService.js';
import { getCategoriasGasto } from '../services/gastosService.js';
import { formatCurrency } from './helpers.js';
import { escapeHtml, sanitizeInput } from './security.js';
import { validateRequired, validatePositiveAmount, applyFormErrors, hasErrors } from './validation.js';

let userId = null;
let categorias = [];
let editingId = null;
const mesActual = currentMonthISO();

function populateCategorySelect() {
  const select = document.getElementById('form-categoria');
  select.innerHTML = '<option value="" disabled selected>Selecciona una categoría</option>' +
    categorias.map((c) => `<option value="${c.id}">${c.icono} ${escapeHtml(c.nombre)}</option>`).join('');
}

function budgetProgressClass(pct) {
  if (pct >= 100) return 'danger';
  if (pct >= 80) return 'warning';
  return '';
}

function renderBudgets(budgets, gastosPorCategoria) {
  const grid = document.getElementById('budgets-grid');
  const empty = document.getElementById('budgets-empty');
  grid.innerHTML = '';

  if (!budgets.length) {
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  for (const budget of budgets) {
    const gastado = gastosPorCategoria[budget.categoria?.id] ?? 0;
    const limite = Number(budget.monto_limite);
    const pct = limite > 0 ? Math.round((gastado / limite) * 100) : 0;
    const restante = Math.max(limite - gastado, 0);

    const card = document.createElement('article');
    card.className = 'card goal-card';

    const header = document.createElement('div');
    header.className = 'goal-card-header';
    const icon = document.createElement('span');
    icon.className = 'goal-card-icon';
    icon.textContent = budget.categoria?.icono ?? '📊';
    const name = document.createElement('span');
    name.className = 'goal-card-name';
    name.textContent = budget.categoria?.nombre ?? '—';
    header.append(icon, name);

    if (pct >= 100) {
      const badge = document.createElement('span');
      badge.className = 'badge';
      badge.style.background = 'var(--color-danger-soft)';
      badge.style.color = 'var(--color-danger)';
      badge.textContent = 'Superado';
      header.appendChild(badge);
    }

    const amounts = document.createElement('div');
    amounts.className = 'goal-card-amounts';
    const current = document.createElement('span');
    current.className = 'goal-card-current';
    current.textContent = formatCurrency(gastado);
    const target = document.createElement('span');
    target.className = 'goal-card-target';
    target.textContent = `de ${formatCurrency(limite)}`;
    amounts.append(current, target);

    const bar = document.createElement('div');
    bar.className = 'progress-bar';
    const fill = document.createElement('div');
    fill.className = `progress-bar-fill ${budgetProgressClass(pct)}`;
    fill.style.width = `${Math.min(pct, 100)}%`;
    bar.appendChild(fill);

    const meta = document.createElement('div');
    meta.className = 'goal-card-meta';
    const pctSpan = document.createElement('span');
    pctSpan.textContent = `${pct}% usado`;
    const restSpan = document.createElement('span');
    restSpan.textContent = restante > 0 ? `Quedan ${formatCurrency(restante)}` : 'Sin margen';
    meta.append(pctSpan, restSpan);

    const actions = document.createElement('div');
    actions.className = 'goal-card-actions';

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'icon-btn';
    editBtn.setAttribute('aria-label', 'Editar presupuesto');
    editBtn.textContent = '✏️';
    editBtn.addEventListener('click', () => openForm(budget));

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'icon-btn icon-btn-danger';
    deleteBtn.setAttribute('aria-label', 'Eliminar presupuesto');
    deleteBtn.textContent = '🗑️';
    deleteBtn.addEventListener('click', () => confirmDelete(budget.id));

    actions.append(editBtn, deleteBtn);
    card.append(header, amounts, bar, meta, actions);
    grid.appendChild(card);
  }
}

function renderAlerts(alerts) {
  const list = document.getElementById('alerts-list');
  const empty = document.getElementById('alerts-empty');
  list.innerHTML = '';

  if (!alerts.length) {
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  for (const alert of alerts) {
    const item = document.createElement('div');
    item.className = 'movement-item';

    const icon = document.createElement('span');
    icon.className = 'movement-icon';
    icon.style.background = 'var(--color-warning-soft)';
    icon.textContent = '⚠️';

    const info = document.createElement('div');
    info.className = 'movement-info';
    const title = document.createElement('div');
    title.className = 'movement-title';
    title.textContent = alert.mensaje;
    info.appendChild(title);

    const dismissBtn = document.createElement('button');
    dismissBtn.type = 'button';
    dismissBtn.className = 'btn btn-ghost';
    dismissBtn.textContent = 'Marcar leída';
    dismissBtn.addEventListener('click', async () => {
      await marcarAlertaLeida(alert.id);
      await refreshAlerts();
    });

    item.append(icon, info, dismissBtn);
    list.appendChild(item);
  }
}

async function refreshAlerts() {
  const alerts = await listAlertasPresupuesto(userId);
  renderAlerts(alerts);
}

async function refresh() {
  const [budgets, gastosPorCategoria] = await Promise.all([
    listPresupuestos(userId, mesActual),
    getGastoPorCategoriaMes(userId, mesActual),
  ]);
  renderBudgets(budgets, gastosPorCategoria);
  await refreshAlerts();
}

function openForm(budget = null) {
  editingId = budget?.id ?? null;
  const dialog = document.getElementById('budget-dialog');
  const form = document.getElementById('budget-form');
  form.reset();
  applyFormErrors(form, {});
  document.getElementById('budget-dialog-title').textContent = budget ? 'Editar presupuesto' : 'Nuevo presupuesto';

  if (budget) {
    form.categoryId.value = budget.categoria?.id ?? '';
    form.categoryId.disabled = true;
    form.montoLimite.value = budget.monto_limite;
  } else {
    form.categoryId.disabled = false;
  }

  dialog.showModal();
}

function closeForm() {
  document.getElementById('budget-dialog').close();
  document.getElementById('form-categoria').disabled = false;
  editingId = null;
}

async function confirmDelete(id) {
  if (!window.confirm('¿Eliminar este presupuesto?')) return;
  await deletePresupuesto(id);
  await refresh();
}

async function handleSubmit(event) {
  event.preventDefault();
  const form = event.target;

  const errors = {
    categoryId: editingId ? null : validateRequired(form.categoryId.value, 'La categoría'),
    montoLimite: validatePositiveAmount(form.montoLimite.value, 'El límite'),
  };
  applyFormErrors(form, errors);
  if (hasErrors(errors)) return;

  const payload = editingId
    ? { monto_limite: form.montoLimite.value }
    : {
      category_id: form.categoryId.value,
      monto_limite: form.montoLimite.value,
      mes: mesActual,
      user_id: userId,
    };

  const submitBtn = form.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  try {
    if (editingId) {
      await updatePresupuesto(editingId, payload);
    } else {
      await createPresupuesto(payload);
    }
    closeForm();
    await refresh();
  } catch (error) {
    const message = error?.message?.includes('duplicate')
      ? 'Ya existe un presupuesto para esa categoría este mes.'
      : 'No se pudo guardar. Intenta de nuevo.';
    applyFormErrors(form, { montoLimite: sanitizeInput(message, 200) });
  } finally {
    submitBtn.disabled = false;
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const session = await initAppShell();
  if (!session) return;
  userId = session.user.id;

  document.getElementById('presupuesto-mes').textContent =
    new Intl.DateTimeFormat('es-PE', { month: 'long', year: 'numeric', timeZone: 'America/Lima' }).format(new Date());

  categorias = await getCategoriasGasto();
  populateCategorySelect();
  await refresh();

  document.getElementById('new-budget-btn').addEventListener('click', () => openForm());
  document.getElementById('budget-form').addEventListener('submit', handleSubmit);
  document.getElementById('budget-dialog-cancel').addEventListener('click', closeForm);
});
