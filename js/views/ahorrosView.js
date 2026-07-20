// ============================================================
// FinanzasPro — Vista: /ahorros
// ============================================================

import { listMetas, createMeta, updateMeta, deleteMeta, createAporte } from '../../services/ahorrosService.js';
import { formatCurrency, formatDate, todayISO } from '../helpers.js';
import { sanitizeInput } from '../security.js';
import { validateRequired, validatePositiveAmount, applyFormErrors, hasErrors } from '../validation.js';
import { createIconButton } from '../icons.js';

export const layout = 'app';
export const requiresAuth = true;
export const title = 'Ahorros';

export function render() {
  return `
    <div class="page-header">
      <div>
        <h1 class="page-title">Ahorros</h1>
        <p class="page-subtitle">Tus metas: laptop, casa, auto, viaje, emergencia y más.</p>
      </div>
      <button type="button" class="btn btn-primary" id="new-goal-btn">+ Nueva meta</button>
    </div>

    <section class="goals-grid" id="goals-grid" aria-label="Metas de ahorro"></section>
    <p class="empty-state" id="goals-empty" hidden>Todavía no tienes metas de ahorro. Crea la primera con "+ Nueva meta".</p>

    <dialog id="goal-dialog" class="modal">
      <div class="modal-body">
        <h2 class="modal-title" id="goal-dialog-title">Nueva meta</h2>

        <form id="goal-form" class="auth-form" novalidate>
          <div class="form-group">
            <label for="form-nombre">Nombre de la meta</label>
            <input class="input" type="text" id="form-nombre" name="nombre" maxlength="100" placeholder="Laptop nueva" required>
            <span class="input-error-msg" data-error-for="nombre"></span>
          </div>

          <div class="form-group">
            <label for="form-icono">Ícono</label>
            <input class="input" type="text" id="form-icono" name="icono" maxlength="8" placeholder="🎯">
          </div>

          <div class="form-group">
            <label for="form-monto-objetivo">Monto objetivo (S/)</label>
            <input class="input" type="number" id="form-monto-objetivo" name="montoObjetivo" step="0.01" min="0.01" required>
            <span class="input-error-msg" data-error-for="montoObjetivo"></span>
          </div>

          <div class="form-group">
            <label for="form-fecha-limite">Fecha límite (opcional)</label>
            <input class="input" type="date" id="form-fecha-limite" name="fechaLimite">
          </div>

          <div class="modal-actions">
            <button type="button" class="btn btn-ghost" id="goal-dialog-cancel">Cancelar</button>
            <button type="submit" class="btn btn-primary">Guardar</button>
          </div>
        </form>
      </div>
    </dialog>

    <dialog id="contribute-dialog" class="modal">
      <div class="modal-body">
        <h2 class="modal-title" id="contribute-dialog-title">Aportar</h2>

        <form id="contribute-form" class="auth-form" novalidate>
          <div class="form-group">
            <label for="contribute-monto">Monto (S/)</label>
            <input class="input" type="number" id="contribute-monto" name="monto" step="0.01" min="0.01" required>
            <span class="input-error-msg" data-error-for="monto"></span>
          </div>

          <div class="form-group">
            <label for="contribute-fecha">Fecha</label>
            <input class="input" type="date" id="contribute-fecha" name="fecha" required>
            <span class="input-error-msg" data-error-for="fecha"></span>
          </div>

          <div class="form-group">
            <label for="contribute-descripcion">Descripción (opcional)</label>
            <input class="input" type="text" id="contribute-descripcion" name="descripcion" maxlength="300">
          </div>

          <div class="modal-actions">
            <button type="button" class="btn btn-ghost" id="contribute-dialog-cancel">Cancelar</button>
            <button type="submit" class="btn btn-primary">Registrar aporte</button>
          </div>
        </form>
      </div>
    </dialog>
  `;
}

export async function init(container, { signal, session }) {
  const userId = session.user.id;
  let editingId = null;
  let contributingGoalId = null;

  function progressClass(estado) {
    return estado === 'completada' ? 'success' : '';
  }

  function renderGoals(goals) {
    if (signal.aborted) return;
    const grid = container.querySelector('#goals-grid');
    const empty = container.querySelector('#goals-empty');
    grid.innerHTML = '';

    if (!goals.length) {
      empty.hidden = false;
      return;
    }
    empty.hidden = true;

    for (const goal of goals) {
      const card = document.createElement('article');
      card.className = `card goal-card${goal.estado === 'completada' ? ' is-completed' : ''}`;

      const header = document.createElement('div');
      header.className = 'goal-card-header';
      const goalIcon = document.createElement('span');
      goalIcon.className = 'goal-card-icon';
      goalIcon.textContent = goal.icono;
      const name = document.createElement('span');
      name.className = 'goal-card-name';
      name.textContent = goal.nombre;
      header.append(goalIcon, name);
      if (goal.estado === 'completada') {
        const badge = document.createElement('span');
        badge.className = 'badge';
        badge.textContent = 'Lista';
        header.appendChild(badge);
      }

      const amounts = document.createElement('div');
      amounts.className = 'goal-card-amounts';
      const current = document.createElement('span');
      current.className = 'goal-card-current';
      current.textContent = formatCurrency(goal.monto_actual);
      const target = document.createElement('span');
      target.className = 'goal-card-target';
      target.textContent = `de ${formatCurrency(goal.monto_objetivo)}`;
      amounts.append(current, target);

      const bar = document.createElement('div');
      bar.className = 'progress-bar';
      const fill = document.createElement('div');
      fill.className = `progress-bar-fill ${progressClass(goal.estado)}`;
      fill.style.width = `${Math.min(Number(goal.porcentaje_avance), 100)}%`;
      bar.appendChild(fill);

      const meta = document.createElement('div');
      meta.className = 'goal-card-meta';
      const pctSpan = document.createElement('span');
      pctSpan.textContent = `${goal.porcentaje_avance}% avanzado`;
      const restSpan = document.createElement('span');
      restSpan.textContent = Number(goal.monto_restante) > 0
        ? `Faltan ${formatCurrency(goal.monto_restante)}`
        : '¡Meta cumplida!';
      meta.append(pctSpan, restSpan);

      card.append(header, amounts, bar, meta);

      if (goal.fecha_limite) {
        const fechaInfo = document.createElement('div');
        fechaInfo.className = 'goal-card-meta';
        const fechaLabel = document.createElement('span');
        fechaLabel.textContent = `Meta: ${formatDate(goal.fecha_limite)}`;
        fechaInfo.appendChild(fechaLabel);
        if (goal.avance_mensual_requerido) {
          const avanceLabel = document.createElement('span');
          avanceLabel.textContent = `${formatCurrency(goal.avance_mensual_requerido)}/mes`;
          fechaInfo.appendChild(avanceLabel);
        }
        card.appendChild(fechaInfo);
      }

      const actions = document.createElement('div');
      actions.className = 'goal-card-actions';

      const contributeBtn = document.createElement('button');
      contributeBtn.type = 'button';
      contributeBtn.className = 'btn btn-secondary';
      contributeBtn.textContent = '+ Aportar';
      contributeBtn.addEventListener('click', () => openContributeForm(goal), { signal });

      const editBtn = createIconButton({
        iconName: 'Pencil', label: 'Editar meta', onClick: () => openGoalForm(goal), signal,
      });
      const deleteBtn = createIconButton({
        iconName: 'Trash2', label: 'Eliminar meta', danger: true, onClick: () => confirmDeleteGoal(goal.id), signal,
      });

      actions.append(contributeBtn, editBtn, deleteBtn);
      card.appendChild(actions);
      grid.appendChild(card);
    }
  }

  async function refresh() {
    const goals = await listMetas(userId);
    renderGoals(goals);
  }

  function openGoalForm(goal = null) {
    editingId = goal?.id ?? null;
    const dialog = container.querySelector('#goal-dialog');
    const form = container.querySelector('#goal-form');
    form.reset();
    applyFormErrors(form, {});
    container.querySelector('#goal-dialog-title').textContent = goal ? 'Editar meta' : 'Nueva meta';

    if (goal) {
      form.nombre.value = goal.nombre;
      form.icono.value = goal.icono;
      form.montoObjetivo.value = goal.monto_objetivo;
      form.fechaLimite.value = goal.fecha_limite ?? '';
    } else {
      form.icono.value = '🎯';
    }

    dialog.showModal();
  }

  function closeGoalForm() {
    container.querySelector('#goal-dialog').close();
    editingId = null;
  }

  async function confirmDeleteGoal(id) {
    if (!window.confirm('¿Eliminar esta meta y todo su historial de aportes? Esta acción no se puede deshacer.')) return;
    await deleteMeta(id);
    await refresh();
  }

  async function handleGoalSubmit(event) {
    event.preventDefault();
    const form = event.target;

    const payload = {
      nombre: sanitizeInput(form.nombre.value, 100),
      icono: sanitizeInput(form.icono.value, 8) || '🎯',
      monto_objetivo: form.montoObjetivo.value,
      fecha_limite: form.fechaLimite.value || null,
    };

    const errors = {
      nombre: validateRequired(payload.nombre, 'El nombre'),
      montoObjetivo: validatePositiveAmount(payload.monto_objetivo, 'El monto objetivo'),
    };
    applyFormErrors(form, errors);
    if (hasErrors(errors)) return;

    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    try {
      if (editingId) {
        await updateMeta(editingId, payload);
      } else {
        await createMeta({ ...payload, user_id: userId });
      }
      closeGoalForm();
      await refresh();
    } catch {
      applyFormErrors(form, { montoObjetivo: 'No se pudo guardar. Intenta de nuevo.' });
    } finally {
      submitBtn.disabled = false;
    }
  }

  function openContributeForm(goal) {
    contributingGoalId = goal.id;
    const dialog = container.querySelector('#contribute-dialog');
    const form = container.querySelector('#contribute-form');
    form.reset();
    applyFormErrors(form, {});
    container.querySelector('#contribute-dialog-title').textContent = `Aportar a "${goal.nombre}"`;
    form.fecha.value = todayISO();
    dialog.showModal();
  }

  function closeContributeForm() {
    container.querySelector('#contribute-dialog').close();
    contributingGoalId = null;
  }

  async function handleContributeSubmit(event) {
    event.preventDefault();
    const form = event.target;

    const payload = {
      goal_id: contributingGoalId,
      user_id: userId,
      monto: form.monto.value,
      fecha: form.fecha.value,
      descripcion: sanitizeInput(form.descripcion.value, 300) || null,
    };

    const errors = {
      monto: validatePositiveAmount(payload.monto),
      fecha: validateRequired(payload.fecha, 'La fecha'),
    };
    applyFormErrors(form, errors);
    if (hasErrors(errors)) return;

    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    try {
      await createAporte(payload);
      closeContributeForm();
      await refresh();
    } catch {
      applyFormErrors(form, { monto: 'No se pudo registrar el aporte. Intenta de nuevo.' });
    } finally {
      submitBtn.disabled = false;
    }
  }

  await refresh();
  if (signal.aborted) return;

  container.querySelector('#new-goal-btn').addEventListener('click', () => openGoalForm(), { signal });
  container.querySelector('#goal-form').addEventListener('submit', handleGoalSubmit, { signal });
  container.querySelector('#goal-dialog-cancel').addEventListener('click', closeGoalForm, { signal });
  container.querySelector('#contribute-form').addEventListener('submit', handleContributeSubmit, { signal });
  container.querySelector('#contribute-dialog-cancel').addEventListener('click', closeContributeForm, { signal });
}
