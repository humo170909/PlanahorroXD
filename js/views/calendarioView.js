// ============================================================
// FinanzasPro — Vista: /calendario
//
// Muestra pagos (gastos) y cobros (ingresos) reales por día, tomados
// de la misma consulta que usa Reportes (getMovimientosPeriodo) — no
// hay una tabla de "recordatorios" en el proyecto, así que esta vista
// no inventa datos que no existen; si se agrega esa función más
// adelante, este es el lugar natural para sumarla.
// ============================================================

import { getMovimientosPeriodo } from '../../services/reportesService.js';
import { formatCurrency, formatDate, todayISO } from '../helpers.js';
import { icon } from '../icons.js';

export const layout = 'app';
export const requiresAuth = true;
export const title = 'Calendario';

const WEEKDAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

export function render() {
  return `
    <div class="page-header">
      <div>
        <h1 class="page-title">Calendario</h1>
        <p class="page-subtitle" id="calendario-mes-label"></p>
      </div>
      <div class="calendar-nav">
        <button type="button" class="icon-btn" id="cal-prev" aria-label="Mes anterior">${icon('ChevronLeft', { width: 18, height: 18 }).outerHTML}</button>
        <button type="button" class="btn btn-ghost" id="cal-today">Hoy</button>
        <button type="button" class="icon-btn" id="cal-next" aria-label="Mes siguiente">${icon('ChevronRight', { width: 18, height: 18 }).outerHTML}</button>
      </div>
    </div>

    <div class="calendar-layout">
      <section class="card calendar-grid-card" aria-label="Cuadrícula del mes">
        <div class="calendar-weekdays">
          ${WEEKDAYS.map((d) => `<span>${d}</span>`).join('')}
        </div>
        <div class="calendar-grid" id="calendar-grid"></div>
        <div class="calendar-legend">
          <span class="calendar-legend-item"><span class="calendar-dot calendar-dot-income"></span> Cobro (ingreso)</span>
          <span class="calendar-legend-item"><span class="calendar-dot calendar-dot-expense"></span> Pago (gasto)</span>
        </div>
      </section>

      <section class="card panel calendar-day-panel" aria-label="Movimientos del día">
        <h2 class="panel-title" id="calendar-day-title">—</h2>
        <div class="movement-list" id="calendar-day-list"></div>
        <p class="empty-state" id="calendar-day-empty" hidden>Sin movimientos ese día.</p>
      </section>
    </div>
  `;
}

export async function init(container, { signal, session }) {
  const userId = session.user.id;
  const todayIso = todayISO();
  let viewDate = new Date();
  let selectedDate = todayIso;
  let movementsByDay = new Map();

  function pad(n) {
    return String(n).padStart(2, '0');
  }

  function monthBounds(date) {
    const first = new Date(date.getFullYear(), date.getMonth(), 1);
    const last = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    return {
      firstISO: `${first.getFullYear()}-${pad(first.getMonth() + 1)}-01`,
      lastISO: `${last.getFullYear()}-${pad(last.getMonth() + 1)}-${pad(last.getDate())}`,
      firstDow: first.getDay(),
      daysInMonth: last.getDate(),
      year: first.getFullYear(),
      month: first.getMonth() + 1,
    };
  }

  function renderDayDetail(iso) {
    if (signal.aborted) return;
    const movs = movementsByDay.get(iso) ?? [];
    container.querySelector('#calendar-day-title').textContent = formatDate(iso);

    const list = container.querySelector('#calendar-day-list');
    const empty = container.querySelector('#calendar-day-empty');
    list.innerHTML = '';

    if (!movs.length) {
      empty.hidden = false;
      return;
    }
    empty.hidden = true;

    for (const mov of movs) {
      const item = document.createElement('div');
      item.className = 'movement-item';

      const iconEl = document.createElement('span');
      iconEl.className = `movement-icon ${mov.tipo === 'ingreso' ? 'movement-icon-success' : 'movement-icon-danger'}`;
      iconEl.textContent = mov.categoria_icono ?? '';

      const info = document.createElement('div');
      info.className = 'movement-info';
      const title = document.createElement('div');
      title.className = 'movement-title';
      title.textContent = mov.descripcion?.trim() || mov.categoria;
      const meta = document.createElement('div');
      meta.className = 'movement-meta';
      meta.textContent = mov.categoria ?? '';
      info.append(title, meta);

      const amount = document.createElement('div');
      amount.className = `movement-amount ${mov.tipo === 'ingreso' ? 'income' : 'expense'}`;
      amount.textContent = `${mov.tipo === 'ingreso' ? '+' : '-'} ${formatCurrency(mov.monto)}`;

      item.append(iconEl, info, amount);
      list.appendChild(item);
    }
  }

  function renderGrid() {
    if (signal.aborted) return;
    const { firstDow, daysInMonth, year, month } = monthBounds(viewDate);

    container.querySelector('#calendario-mes-label').textContent =
      new Intl.DateTimeFormat('es-PE', { month: 'long', year: 'numeric', timeZone: 'America/Lima' }).format(viewDate);

    const grid = container.querySelector('#calendar-grid');
    grid.innerHTML = '';

    for (let i = 0; i < firstDow; i++) {
      const empty = document.createElement('div');
      empty.className = 'calendar-cell calendar-cell-empty';
      grid.appendChild(empty);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const iso = `${year}-${pad(month)}-${pad(day)}`;
      const movs = movementsByDay.get(iso) ?? [];
      const hasIngreso = movs.some((mv) => mv.tipo === 'ingreso');
      const hasGasto = movs.some((mv) => mv.tipo === 'gasto');

      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = `calendar-cell${iso === selectedDate ? ' selected' : ''}${iso === todayIso ? ' is-today' : ''}`;
      cell.setAttribute('aria-label', `${day} — ${movs.length} movimiento(s)`);

      const num = document.createElement('span');
      num.className = 'calendar-cell-day';
      num.textContent = String(day);
      cell.appendChild(num);

      if (hasIngreso || hasGasto) {
        const dots = document.createElement('span');
        dots.className = 'calendar-cell-dots';
        if (hasIngreso) {
          const dot = document.createElement('span');
          dot.className = 'calendar-dot calendar-dot-income';
          dots.appendChild(dot);
        }
        if (hasGasto) {
          const dot = document.createElement('span');
          dot.className = 'calendar-dot calendar-dot-expense';
          dots.appendChild(dot);
        }
        cell.appendChild(dots);
      }

      cell.addEventListener('click', () => {
        selectedDate = iso;
        grid.querySelectorAll('.calendar-cell.selected').forEach((el) => el.classList.remove('selected'));
        cell.classList.add('selected');
        renderDayDetail(iso);
      }, { signal });

      grid.appendChild(cell);
    }
  }

  async function loadMonth() {
    const { firstISO, lastISO } = monthBounds(viewDate);
    const movs = await getMovimientosPeriodo(userId, firstISO, lastISO);
    if (signal.aborted) return;

    movementsByDay = new Map();
    for (const mov of movs) {
      const list = movementsByDay.get(mov.fecha) ?? [];
      list.push(mov);
      movementsByDay.set(mov.fecha, list);
    }

    renderGrid();
    renderDayDetail(selectedDate);
  }

  container.querySelector('#cal-prev').addEventListener('click', () => {
    viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1);
    loadMonth();
  }, { signal });

  container.querySelector('#cal-next').addEventListener('click', () => {
    viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1);
    loadMonth();
  }, { signal });

  container.querySelector('#cal-today').addEventListener('click', () => {
    viewDate = new Date();
    selectedDate = todayIso;
    loadMonth();
  }, { signal });

  await loadMonth();
}
