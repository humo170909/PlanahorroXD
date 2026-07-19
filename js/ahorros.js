// ============================================================
// FinanzasPro — Lógica de ahorros.html
// ============================================================

import { initAppShell } from './layout.js';
import { listMetas, createMeta, updateMeta, deleteMeta, createAporte } from '../services/ahorrosService.js';
import { formatCurrency, formatDate, todayISO } from './helpers.js';
import { sanitizeInput } from './security.js';
import { validateRequired, validatePositiveAmount, applyFormErrors, hasErrors } from './validation.js';

let userId = null;
let editingId = null;
let contributingGoalId = null;

function progressClass(estado) {
  return estado === 'completada' ? 'success' : '';
}

function renderGoals(goals) {
  const grid = document.getElementById('goals-grid');
  const empty = document.getElementById('goals-empty');
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
    const icon = document.createElement('span');
    icon.className = 'goal-card-icon';
    icon.textContent = goal.icono;
    const name = document.createElement('span');
    name.className = 'goal-card-name';
    name.textContent = goal.nombre;
    header.append(icon, name);
    if (goal.estado === 'completada') {
      const badge = document.createElement('span');
      badge.className = 'badge';
      badge.textContent = '✅ Lista';
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
    contributeBtn.addEventListener('click', () => openContributeForm(goal));

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'icon-btn';
    editBtn.setAttribute('aria-label', 'Editar meta');
    editBtn.textContent = '✏️';
    editBtn.addEventListener('click', () => openGoalForm(goal));

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'icon-btn icon-btn-danger';
    deleteBtn.setAttribute('aria-label', 'Eliminar meta');
    deleteBtn.textContent = '🗑️';
    deleteBtn.addEventListener('click', () => confirmDeleteGoal(goal.id));

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
  const dialog = document.getElementById('goal-dialog');
  const form = document.getElementById('goal-form');
  form.reset();
  applyFormErrors(form, {});
  document.getElementById('goal-dialog-title').textContent = goal ? 'Editar meta' : 'Nueva meta';

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
  document.getElementById('goal-dialog').close();
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
  const dialog = document.getElementById('contribute-dialog');
  const form = document.getElementById('contribute-form');
  form.reset();
  applyFormErrors(form, {});
  document.getElementById('contribute-dialog-title').textContent = `Aportar a "${goal.nombre}"`;
  form.fecha.value = todayISO();
  dialog.showModal();
}

function closeContributeForm() {
  document.getElementById('contribute-dialog').close();
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

document.addEventListener('DOMContentLoaded', async () => {
  const session = await initAppShell();
  if (!session) return;
  userId = session.user.id;

  await refresh();

  document.getElementById('new-goal-btn').addEventListener('click', () => openGoalForm());
  document.getElementById('goal-form').addEventListener('submit', handleGoalSubmit);
  document.getElementById('goal-dialog-cancel').addEventListener('click', closeGoalForm);
  document.getElementById('contribute-form').addEventListener('submit', handleContributeSubmit);
  document.getElementById('contribute-dialog-cancel').addEventListener('click', closeContributeForm);
});
