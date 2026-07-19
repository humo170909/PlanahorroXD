// ============================================================
// FinanzasPro — Lógica de dashboard.html
// ============================================================

import { initAppShell } from './layout.js';
import {
  getResumenFinanciero,
  getTopCategoriasGasto,
  getMovimientosRecientes,
  getResumenMensual,
} from '../services/reportesService.js';
import { formatCurrency, formatDate } from './helpers.js';
import { renderCategoryDonut, renderIncomeExpenseLine } from './charts.js';
import { supabase } from './supabase.js';

// Se guarda el último dataset pintado para poder redibujar los
// gráficos cuando el usuario cambia de tema (ver evento 'themechange'
// disparado desde app.js).
let lastCategorias = [];
let lastResumenMensual = [];

async function loadBudgetAlerts(userId) {
  const banner = document.getElementById('budget-alert-banner');
  const { data, error } = await supabase
    .from('budget_alerts')
    .select('mensaje')
    .eq('user_id', userId)
    .eq('leido', false)
    .order('created_at', { ascending: false })
    .limit(1);

  if (error || !data?.length) return;
  banner.textContent = `⚠️ ${data[0].mensaje}`;
  banner.hidden = false;
}

function renderStats(resumen) {
  document.getElementById('stat-saldo').textContent = formatCurrency(resumen.balance_mes);
  document.getElementById('stat-ingresos').textContent = formatCurrency(resumen.ingresos_mes);
  document.getElementById('stat-gastos').textContent = formatCurrency(resumen.gastos_mes);
  document.getElementById('stat-gasto-diario').textContent = formatCurrency(resumen.gasto_disponible_dia);
  document.getElementById('stat-gasto-semanal').textContent =
    `${formatCurrency(resumen.gasto_disponible_semana)} disponible esta semana`;

  const deltaEl = document.getElementById('stat-saldo-delta');
  const pct = Number(resumen.pct_ahorro ?? 0);
  deltaEl.textContent = `${pct}% de ahorro este mes`;
  deltaEl.className = `stat-card-delta ${pct >= 0 ? 'positive' : 'negative'}`;
}

function renderMovements(movements) {
  const list = document.getElementById('movement-list');
  const empty = document.getElementById('movement-list-empty');
  list.innerHTML = '';

  if (!movements.length) {
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  for (const mov of movements) {
    const item = document.createElement('div');
    item.className = 'movement-item';

    const icon = document.createElement('span');
    icon.className = 'movement-icon';
    icon.style.background = mov.tipo === 'ingreso' ? 'var(--color-success-soft)' : 'var(--color-danger-soft)';
    icon.textContent = mov.categoria_icono ?? '💰';

    const info = document.createElement('div');
    info.className = 'movement-info';

    const title = document.createElement('div');
    title.className = 'movement-title';
    title.textContent = mov.descripcion?.trim() || mov.categoria;

    const meta = document.createElement('div');
    meta.className = 'movement-meta';
    meta.textContent = `${mov.categoria} · ${formatDate(mov.fecha)}`;

    info.append(title, meta);

    const amount = document.createElement('div');
    amount.className = `movement-amount ${mov.tipo === 'ingreso' ? 'income' : 'expense'}`;
    amount.textContent = `${mov.tipo === 'ingreso' ? '+' : '-'} ${formatCurrency(mov.monto)}`;

    item.append(icon, info, amount);
    list.appendChild(item);
  }
}

function renderCategoriesChart(categorias) {
  lastCategorias = categorias;
  const canvas = document.getElementById('chart-categorias');
  const empty = document.getElementById('chart-categorias-empty');

  if (!categorias.length) {
    canvas.hidden = true;
    empty.hidden = false;
    return;
  }
  canvas.hidden = false;
  empty.hidden = true;
  renderCategoryDonut(canvas, categorias);
}

function renderTrendChart(resumenMensual) {
  lastResumenMensual = resumenMensual;
  const canvas = document.getElementById('chart-tendencia');
  const labels = resumenMensual.map((r) =>
    new Intl.DateTimeFormat('es-PE', { month: 'short', timeZone: 'America/Lima' }).format(new Date(r.mes)));

  renderIncomeExpenseLine(
    canvas,
    labels,
    resumenMensual.map((r) => Number(r.total_ingresos)),
    resumenMensual.map((r) => Number(r.total_gastos)),
  );
}

async function loadDashboard(session) {
  const userId = session.user.id;

  document.getElementById('dashboard-date-range').textContent =
    new Intl.DateTimeFormat('es-PE', { month: 'long', year: 'numeric', timeZone: 'America/Lima' }).format(new Date());

  const [resumen, topCategorias, movimientos, resumenMensual] = await Promise.all([
    getResumenFinanciero(userId),
    getTopCategoriasGasto(userId, undefined, 5),
    getMovimientosRecientes(userId, 8),
    getResumenMensual(userId, 6),
  ]);

  if (resumen) renderStats(resumen);
  renderMovements(movimientos);

  // El gráfico de dona debe representar el 100% del gasto del mes, no
  // solo el top 5: se agrega una rebanada "Otros" con el remanente.
  const sumaTop = topCategorias.reduce((sum, c) => sum + Number(c.total), 0);
  const otros = Math.max(Number(resumen?.gastos_mes ?? 0) - sumaTop, 0);
  const categoriasParaChart = otros > 0.01
    ? [...topCategorias, { nombre: 'Otros', icono: '➕', total: otros }]
    : topCategorias;
  renderCategoriesChart(categoriasParaChart);

  renderTrendChart(resumenMensual);
  await loadBudgetAlerts(userId);
}

document.addEventListener('DOMContentLoaded', async () => {
  const session = await initAppShell();
  if (!session) return; // initAppShell ya redirigió a login.html

  await loadDashboard(session);

  window.addEventListener('themechange', () => {
    if (lastCategorias.length) renderCategoriesChart(lastCategorias);
    if (lastResumenMensual.length) renderTrendChart(lastResumenMensual);
  });
});
