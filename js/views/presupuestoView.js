// ============================================================
// FinanzasPro — Vista: /presupuesto
// ============================================================

import {
  currentMonthISO, listPresupuestos, getGastoPorCategoriaMes, createPresupuesto,
  updatePresupuesto, deletePresupuesto, listAlertasPresupuesto, marcarAlertaLeida,
} from '../../services/presupuestoService.js';
import { getCategoriasGasto } from '../../services/gastosService.js';
import { formatCurrency } from '../helpers.js';
import { escapeHtml, sanitizeInput } from '../security.js';
import { validateRequired, validatePositiveAmount, applyFormErrors, hasErrors } from '../validation.js';
import { icon, createIconButton } from '../icons.js';
import { renderBudgetRadar } from '../charts.js';

export const layout = 'app';
export const requiresAuth = true;
export const title = 'Presupuesto';

export function render() {
  return `
    <div class="page-header">
      <div>
        <h1 class="page-title">Presupuesto</h1>
        <p class="page-subtitle" id="presupuesto-mes"></p>
      </div>
      <button type="button" class="btn btn-primary" id="new-budget-btn">+ Nuevo presupuesto</button>
    </div>

    <section class="goals-grid" id="budgets-grid" aria-label="Presupuestos por categoría"></section>
    <p class="empty-state" id="budgets-empty" hidden>Aún no configuras presupuestos este mes. Crea el primero con "+ Nuevo presupuesto".</p>

    <section class="card panel panel-spaced-top viz-root" id="budget-radar-panel" aria-label="Presupuestado vs. gastado" hidden>
      <h2 class="panel-title">Presupuestado vs. gastado</h2>
      <div class="chart-container">
        <canvas id="chart-budget-radar" role="img" aria-label="Gráfico de radar comparando el límite presupuestado y lo gastado por categoría"></canvas>
      </div>
    </section>

    <section class="card panel panel-spaced-top" aria-label="Alertas de presupuesto">
      <h2 class="panel-title">Alertas</h2>
      <div class="movement-list" id="alerts-list"></div>
      <p class="empty-state" id="alerts-empty" hidden>No tienes alertas pendientes.</p>
    </section>

    <dialog id="budget-dialog" class="modal">
      <div class="modal-body">
        <h2 class="modal-title" id="budget-dialog-title">Nuevo presupuesto</h2>

        <form id="budget-form" class="auth-form" novalidate>
          <div class="form-group">
            <label for="form-categoria">Categoría</label>
            <select class="input" id="form-categoria" name="categoryId" required>
              <option value="" disabled selected>Selecciona una categoría</option>
            </select>
            <span class="input-error-msg" data-error-for="categoryId"></span>
          </div>

          <div class="form-group">
            <label for="form-monto-limite">Límite mensual (S/)</label>
            <input class="input" type="number" id="form-monto-limite" name="montoLimite" step="0.01" min="0.01" required>
            <span class="input-error-msg" data-error-for="montoLimite"></span>
          </div>

          <div class="modal-actions">
            <button type="button" class="btn btn-ghost" id="budget-dialog-cancel">Cancelar</button>
            <button type="submit" class="btn btn-primary">Guardar</button>
          </div>
        </form>
      </div>
    </dialog>
  `;
}

export async function init(container, { signal, session }) {
  const userId = session.user.id;
  const mesActual = currentMonthISO();
  let categorias = [];
  let editingId = null;
  let lastBudgets = [];
  let lastGastosPorCategoria = {};

  // Guarda de montaje: si el usuario navegó a otra vista mientras una
  // consulta a Supabase seguía en curso, `signal.aborted` ya es true
  // cuando esa promesa resuelve. Sin este chequeo, la función seguiría
  // intentando pintar dentro de un #view-root que el router ya
  // reemplazó por la vista nueva — y container.querySelector(...)
  // devuelve null porque ese nodo específico ya no existe (aunque
  // #view-root en sí sigue en el DOM). De ahí el
  // "Cannot set properties of null (setting 'innerHTML')".
  function populateCategorySelect() {
    if (signal.aborted) return;
    const select = container.querySelector('#form-categoria');
    select.innerHTML = '<option value="" disabled selected>Selecciona una categoría</option>' +
      categorias.map((c) => `<option value="${c.id}">${escapeHtml(c.nombre)}</option>`).join('');
  }

  function budgetProgressClass(pct) {
    if (pct >= 100) return 'danger';
    if (pct >= 80) return 'warning';
    return '';
  }

  function renderBudgets(budgets, gastosPorCategoria) {
    if (signal.aborted) return;
    const grid = container.querySelector('#budgets-grid');
    const empty = container.querySelector('#budgets-empty');
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
      const categoryIcon = document.createElement('span');
      categoryIcon.className = 'goal-card-icon';
      categoryIcon.textContent = budget.categoria?.icono ?? '';
      const name = document.createElement('span');
      name.className = 'goal-card-name';
      name.textContent = budget.categoria?.nombre ?? '—';
      header.append(categoryIcon, name);

      if (pct >= 100) {
        const badge = document.createElement('span');
        badge.className = 'badge badge-danger';
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

      const editBtn = createIconButton({
        iconName: 'Pencil', label: 'Editar presupuesto', onClick: () => openForm(budget), signal,
      });
      const deleteBtn = createIconButton({
        iconName: 'Trash2', label: 'Eliminar presupuesto', danger: true, onClick: () => confirmDelete(budget.id), signal,
      });

      actions.append(editBtn, deleteBtn);
      card.append(header, amounts, bar, meta, actions);
      grid.appendChild(card);
    }
  }

  function renderAlerts(alerts) {
    if (signal.aborted) return;
    const list = container.querySelector('#alerts-list');
    const empty = container.querySelector('#alerts-empty');
    list.innerHTML = '';

    if (!alerts.length) {
      empty.hidden = false;
      return;
    }
    empty.hidden = true;

    for (const alert of alerts) {
      const item = document.createElement('div');
      item.className = 'movement-item';

      const alertIcon = document.createElement('span');
      alertIcon.className = 'movement-icon movement-icon-warning';
      alertIcon.appendChild(icon('TriangleAlert', { width: 18, height: 18 }));

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
      }, { signal });

      item.append(alertIcon, info, dismissBtn);
      list.appendChild(item);
    }
  }

  async function refreshAlerts() {
    const alerts = await listAlertasPresupuesto(userId);
    renderAlerts(alerts);
  }

  // El radar necesita al menos 3 puntos para leerse bien — con 1-2
  // categorías es solo una línea, así que el panel se queda oculto
  // hasta que haya suficientes presupuestos configurados.
  function renderBudgetRadarChart(budgets, gastosPorCategoria) {
    if (signal.aborted) return;
    lastBudgets = budgets;
    lastGastosPorCategoria = gastosPorCategoria;
    const panel = container.querySelector('#budget-radar-panel');
    if (budgets.length < 3) {
      panel.hidden = true;
      return;
    }
    panel.hidden = false;
    renderBudgetRadar(
      container.querySelector('#chart-budget-radar'),
      budgets.map((b) => b.categoria?.nombre ?? '—'),
      budgets.map((b) => Number(b.monto_limite)),
      budgets.map((b) => gastosPorCategoria[b.categoria?.id] ?? 0),
      { signal },
    );
  }

  async function refresh() {
    const [budgets, gastosPorCategoria] = await Promise.all([
      listPresupuestos(userId, mesActual),
      getGastoPorCategoriaMes(userId, mesActual),
    ]);
    renderBudgets(budgets, gastosPorCategoria);
    renderBudgetRadarChart(budgets, gastosPorCategoria);
    await refreshAlerts();
  }

  function openForm(budget = null) {
    editingId = budget?.id ?? null;
    const dialog = container.querySelector('#budget-dialog');
    const form = container.querySelector('#budget-form');
    form.reset();
    applyFormErrors(form, {});
    container.querySelector('#budget-dialog-title').textContent = budget ? 'Editar presupuesto' : 'Nuevo presupuesto';

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
    container.querySelector('#budget-dialog').close();
    container.querySelector('#form-categoria').disabled = false;
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

  container.querySelector('#presupuesto-mes').textContent =
    new Intl.DateTimeFormat('es-PE', { month: 'long', year: 'numeric', timeZone: 'America/Lima' }).format(new Date());

  categorias = await getCategoriasGasto();
  populateCategorySelect();
  await refresh();

  // Misma guarda que en populateCategorySelect/renderBudgets/renderAlerts:
  // si la vista ya no está montada tras los await anteriores, no
  // intentes engancharle listeners a elementos que ya no existen.
  if (signal.aborted) return;

  container.querySelector('#new-budget-btn').addEventListener('click', () => openForm(), { signal });
  container.querySelector('#budget-form').addEventListener('submit', handleSubmit, { signal });
  container.querySelector('#budget-dialog-cancel').addEventListener('click', closeForm, { signal });

  window.addEventListener('themechange', () => {
    if (lastBudgets.length) renderBudgetRadarChart(lastBudgets, lastGastosPorCategoria);
  }, { signal });
}
