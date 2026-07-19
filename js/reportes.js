// ============================================================
// FinanzasPro — Lógica de reportes.html
// ============================================================

import { initAppShell } from './layout.js';
import {
  getBalancePeriodo, getResumenFinanciero, getTopCategoriasGasto,
  getResumenMensual, getMovimientosPeriodo, getGastosPorCategoriaPeriodo,
} from '../services/reportesService.js';
import { formatCurrency, formatDate, todayISO } from './helpers.js';
import { renderCategoryDonut, renderBalanceBarChart, renderAreaChart } from './charts.js';

let userId = null;
let currentMovimientos = [];
let currentPeriodo = { fechaInicio: '', fechaFin: '' };

function firstDayOfMonthISO() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

function renderKPIs(balance) {
  document.getElementById('kpi-ingresos').textContent = formatCurrency(balance.total_ingresos);
  document.getElementById('kpi-gastos').textContent = formatCurrency(balance.total_gastos);
  const balanceEl = document.getElementById('kpi-balance');
  balanceEl.textContent = formatCurrency(balance.balance);
  balanceEl.className = `stat-card-value ${Number(balance.balance) >= 0 ? 'amount-income' : 'amount-expense'}`;
}

function renderMovementsTable(rows) {
  const tbody = document.getElementById('reportes-tbody');
  const empty = document.getElementById('reportes-empty');
  tbody.innerHTML = '';

  if (!rows.length) {
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  for (const row of rows) {
    const tr = document.createElement('tr');

    const tdFecha = document.createElement('td');
    tdFecha.textContent = formatDate(row.fecha);

    const tdTipo = document.createElement('td');
    const badge = document.createElement('span');
    badge.className = 'badge';
    if (row.tipo === 'gasto') { badge.style.background = 'var(--color-danger-soft)'; badge.style.color = 'var(--color-danger)'; }
    badge.textContent = row.tipo === 'ingreso' ? 'Ingreso' : 'Gasto';
    tdTipo.appendChild(badge);

    const tdCategoria = document.createElement('td');
    tdCategoria.textContent = `${row.categoria_icono ?? ''} ${row.categoria ?? ''}`;

    const tdDescripcion = document.createElement('td');
    tdDescripcion.textContent = row.descripcion || '—';

    const tdMonto = document.createElement('td');
    tdMonto.className = `text-right ${row.tipo === 'ingreso' ? 'amount-income' : 'amount-expense'}`;
    tdMonto.textContent = `${row.tipo === 'ingreso' ? '+' : '-'} ${formatCurrency(row.monto)}`;

    tr.append(tdFecha, tdTipo, tdCategoria, tdDescripcion, tdMonto);
    tbody.appendChild(tr);
  }
}

function renderInsights(resumen, topCategorias) {
  const container = document.getElementById('insights-list');
  container.innerHTML = '';
  const insights = [];

  if (topCategorias.length) {
    const top = topCategorias[0];
    insights.push(
      `Tu categoría con mayor gasto este mes es ${top.icono} ${top.nombre}, con ${formatCurrency(top.total)} (${top.pct_del_total}% de tus gastos).`,
    );
  }

  const pctAhorro = Number(resumen?.pct_ahorro ?? 0);
  if (pctAhorro >= 20) {
    insights.push(`Estás ahorrando el ${pctAhorro}% de tus ingresos este mes. Los expertos recomiendan al menos 20% — ¡vas muy bien!`);
  } else if (pctAhorro >= 10) {
    insights.push(`Ahorras el ${pctAhorro}% de tus ingresos. Estás cerca de la meta recomendada de 20%; intenta recortar un poco más en tu categoría de mayor gasto.`);
  } else {
    insights.push(`Solo estás ahorrando el ${pctAhorro}% de tus ingresos este mes. Revisa tus gastos en ${topCategorias[0]?.nombre ?? 'tu categoría principal'} para liberar más margen.`);
  }

  if (resumen) {
    insights.push(`A tu ritmo actual de gasto, proyectamos que terminarás el mes con un saldo de ${formatCurrency(resumen.prediccion_saldo_fin_mes)}.`);
    insights.push(`Puedes gastar hasta ${formatCurrency(resumen.gasto_disponible_dia)} por día (${formatCurrency(resumen.gasto_disponible_semana)} por semana) sin quedarte sin saldo este mes.`);
  }

  for (const text of insights) {
    const card = document.createElement('div');
    card.className = 'insight-card';
    card.textContent = `💡 ${text}`;
    container.appendChild(card);
  }
}

async function loadCharts() {
  const resumenMensual = await getResumenMensual(userId, 6);
  const labels = resumenMensual.map((r) =>
    new Intl.DateTimeFormat('es-PE', { month: 'short', timeZone: 'America/Lima' }).format(new Date(r.mes)));

  renderBalanceBarChart(
    document.getElementById('chart-balance-mensual'),
    labels,
    resumenMensual.map((r) => Number(r.total_ingresos) - Number(r.total_gastos)),
  );

  let acumulado = 0;
  const acumulados = resumenMensual.map((r) => {
    acumulado += Number(r.total_ingresos) - Number(r.total_gastos);
    return acumulado;
  });
  renderAreaChart(document.getElementById('chart-balance-acumulado'), labels, acumulados);

  const categoriasPeriodo = await getGastosPorCategoriaPeriodo(userId, currentPeriodo.fechaInicio, currentPeriodo.fechaFin);
  const top5 = categoriasPeriodo.slice(0, 5);
  const otros = categoriasPeriodo.slice(5).reduce((sum, c) => sum + c.total, 0);
  const paraPie = otros > 0.01 ? [...top5, { nombre: 'Otros', icono: '➕', total: otros }] : top5;

  const pieCanvas = document.getElementById('chart-categorias-pie');
  const pieEmpty = document.getElementById('chart-categorias-pie-empty');
  if (paraPie.length) {
    pieCanvas.hidden = false;
    pieEmpty.hidden = true;
    renderCategoryDonut(pieCanvas, paraPie, { cutout: '0%' });
  } else {
    pieCanvas.hidden = true;
    pieEmpty.hidden = false;
  }
}

async function refresh() {
  currentPeriodo = {
    fechaInicio: document.getElementById('filter-fecha-inicio').value,
    fechaFin: document.getElementById('filter-fecha-fin').value,
  };

  const [balance, resumen, topCategorias, movimientos] = await Promise.all([
    getBalancePeriodo(userId, currentPeriodo.fechaInicio, currentPeriodo.fechaFin),
    getResumenFinanciero(userId),
    getTopCategoriasGasto(userId, undefined, 3),
    getMovimientosPeriodo(userId, currentPeriodo.fechaInicio, currentPeriodo.fechaFin),
  ]);

  currentMovimientos = movimientos;
  renderKPIs(balance);
  renderMovementsTable(movimientos);
  renderInsights(resumen, topCategorias);
  await loadCharts();
}

// ------------------------------------------------------------
// Exportaciones
// ------------------------------------------------------------
function csvEscape(value) {
  const str = String(value ?? '');
  return /[",\n]/.test(str) ? `"${str.replaceAll('"', '""')}"` : str;
}

function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function exportCSV() {
  const header = ['Fecha', 'Tipo', 'Categoría', 'Descripción', 'Monto'];
  const lines = [header.map(csvEscape).join(',')];
  for (const row of currentMovimientos) {
    lines.push([
      formatDate(row.fecha),
      row.tipo === 'ingreso' ? 'Ingreso' : 'Gasto',
      row.categoria ?? '',
      row.descripcion ?? '',
      Number(row.monto).toFixed(2),
    ].map(csvEscape).join(','));
  }
  downloadFile(lines.join('\n'), 'finanzaspro-reporte.csv', 'text/csv;charset=utf-8;');
}

async function exportExcel() {
  const XLSX = await import('https://cdn.jsdelivr.net/npm/xlsx/+esm');
  const data = currentMovimientos.map((row) => ({
    Fecha: formatDate(row.fecha),
    Tipo: row.tipo === 'ingreso' ? 'Ingreso' : 'Gasto',
    Categoría: row.categoria ?? '',
    Descripción: row.descripcion ?? '',
    Monto: Number(row.monto),
  }));
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Movimientos');
  XLSX.writeFile(workbook, 'finanzaspro-reporte.xlsx');
}

async function exportPDF() {
  const { jsPDF } = await import('https://cdn.jsdelivr.net/npm/jspdf/+esm');
  const autoTableModule = await import('https://cdn.jsdelivr.net/npm/jspdf-autotable/+esm');
  const autoTable = autoTableModule.default;

  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text('FinanzasPro — Reporte financiero', 14, 18);
  doc.setFontSize(10);
  doc.text(`Período: ${formatDate(currentPeriodo.fechaInicio)} a ${formatDate(currentPeriodo.fechaFin)}`, 14, 26);
  doc.text(
    `Ingresos: ${document.getElementById('kpi-ingresos').textContent}   ` +
    `Gastos: ${document.getElementById('kpi-gastos').textContent}   ` +
    `Balance: ${document.getElementById('kpi-balance').textContent}`,
    14, 32,
  );

  autoTable(doc, {
    startY: 38,
    head: [['Fecha', 'Tipo', 'Categoría', 'Descripción', 'Monto']],
    body: currentMovimientos.map((row) => [
      formatDate(row.fecha),
      row.tipo === 'ingreso' ? 'Ingreso' : 'Gasto',
      row.categoria ?? '',
      row.descripcion ?? '',
      formatCurrency(row.monto),
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [99, 102, 241] },
  });

  doc.save('finanzaspro-reporte.pdf');
}

document.addEventListener('DOMContentLoaded', async () => {
  const session = await initAppShell();
  if (!session) return;
  userId = session.user.id;

  document.getElementById('filter-fecha-inicio').value = firstDayOfMonthISO();
  document.getElementById('filter-fecha-fin').value = todayISO();

  await refresh();

  document.getElementById('filter-form').addEventListener('submit', (event) => {
    event.preventDefault();
    refresh();
  });

  document.getElementById('export-csv-btn').addEventListener('click', exportCSV);
  document.getElementById('export-excel-btn').addEventListener('click', exportExcel);
  document.getElementById('export-pdf-btn').addEventListener('click', exportPDF);
  document.getElementById('export-print-btn').addEventListener('click', () => window.print());

  window.addEventListener('themechange', () => {
    loadCharts();
  });
});
