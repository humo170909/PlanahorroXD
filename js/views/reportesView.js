// ============================================================
// FinanzasPro — Vista: /reportes
// ============================================================

import {
  getBalancePeriodo, getResumenFinanciero, getTopCategoriasGasto,
  getResumenMensual, getMovimientosPeriodo, getGastosPorCategoriaPeriodo,
} from '../../services/reportesService.js';
import { formatCurrency, formatDate, todayISO } from '../helpers.js';
import { renderCategoryDonut, renderBalanceBarChart, renderAreaChart } from '../charts.js';

export const layout = 'app';
export const requiresAuth = true;
export const title = 'Reportes';

export function render() {
  return `
    <div class="page-header">
      <div>
        <h1 class="page-title">Reportes</h1>
        <p class="page-subtitle">Balances, comparaciones e inteligencia financiera.</p>
      </div>
      <div class="export-toolbar" id="export-toolbar">
        <button type="button" class="btn btn-secondary" id="export-csv-btn">CSV</button>
        <button type="button" class="btn btn-secondary" id="export-excel-btn">Excel</button>
        <button type="button" class="btn btn-secondary" id="export-pdf-btn">PDF</button>
        <button type="button" class="btn btn-ghost" id="export-print-btn">Imprimir</button>
      </div>
    </div>

    <form id="filter-form" class="card filters-bar">
      <div class="form-group">
        <label for="filter-fecha-inicio">Desde</label>
        <input class="input" type="date" id="filter-fecha-inicio" name="fechaInicio" required>
      </div>
      <div class="form-group">
        <label for="filter-fecha-fin">Hasta</label>
        <input class="input" type="date" id="filter-fecha-fin" name="fechaFin" required>
      </div>
      <button type="submit" class="btn btn-secondary">Generar reporte</button>
    </form>

    <section class="stats-grid" aria-label="Balance del período">
      <article class="card stat-card">
        <span class="stat-card-label">Ingresos del período</span>
        <span class="stat-card-value" id="kpi-ingresos">S/ 0.00</span>
      </article>
      <article class="card stat-card">
        <span class="stat-card-label">Gastos del período</span>
        <span class="stat-card-value" id="kpi-gastos">S/ 0.00</span>
      </article>
      <article class="card stat-card">
        <span class="stat-card-label">Balance del período</span>
        <span class="stat-card-value" id="kpi-balance">S/ 0.00</span>
      </article>
    </section>

    <section class="card panel panel-spaced" aria-label="Inteligencia financiera">
      <h2 class="panel-title">Inteligencia financiera</h2>
      <div class="insights-list" id="insights-list"></div>
    </section>

    <div class="dashboard-grid">
      <section class="card panel viz-root" aria-label="Balance mensual">
        <h2 class="panel-title">Balance mensual (últimos 6 meses)</h2>
        <div class="chart-container">
          <canvas id="chart-balance-mensual" role="img" aria-label="Gráfico de barras del balance de cada mes, positivo o negativo"></canvas>
        </div>
      </section>

      <section class="card panel viz-root" aria-label="Gastos por categoría del período">
        <h2 class="panel-title">Gastos por categoría (período)</h2>
        <div class="chart-container chart-container-donut">
          <canvas id="chart-categorias-pie" role="img" aria-label="Gráfico circular con la distribución de gastos por categoría"></canvas>
        </div>
        <p class="empty-state" id="chart-categorias-pie-empty" hidden>No hay gastos en este período.</p>
      </section>
    </div>

    <section class="card panel viz-root panel-spaced" aria-label="Evolución del balance acumulado">
      <h2 class="panel-title">Evolución del balance acumulado</h2>
      <div class="chart-container">
        <canvas id="chart-balance-acumulado" role="img" aria-label="Gráfico de área con el balance acumulado mes a mes"></canvas>
      </div>
    </section>

    <section class="card panel panel-spaced" aria-label="Mapa de calor de gastos diarios">
      <h2 class="panel-title">Mapa de calor de gastos (últimas 13 semanas)</h2>
      <div class="heatmap" id="heatmap-grid"></div>
      <div class="heatmap-legend">
        <span>Menos</span>
        <span class="heatmap-cell" data-level="0"></span>
        <span class="heatmap-cell" data-level="1"></span>
        <span class="heatmap-cell" data-level="2"></span>
        <span class="heatmap-cell" data-level="3"></span>
        <span class="heatmap-cell" data-level="4"></span>
        <span>Más</span>
      </div>
    </section>

    <section class="card panel" aria-label="Movimientos del período">
      <h2 class="panel-title">Movimientos del período</h2>
      <div class="table-wrapper">
        <table class="table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Tipo</th>
              <th>Categoría</th>
              <th>Descripción</th>
              <th class="text-right">Monto</th>
            </tr>
          </thead>
          <tbody id="reportes-tbody"></tbody>
        </table>
      </div>
      <p class="empty-state" id="reportes-empty" hidden>No hay movimientos en este período.</p>
    </section>
  `;
}

export async function init(container, { signal, session }) {
  const userId = session.user.id;
  let currentMovimientos = [];
  let currentPeriodo = { fechaInicio: '', fechaFin: '' };

  function firstDayOfMonthISO() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  }

  // Mapa de calor: no depende del filtro de fecha del reporte — es
  // siempre una ventana fija de 13 semanas terminando hoy, como los
  // gráficos de contribuciones que ya conoces de otras herramientas.
  // 100% CSS/DOM (sin plugin de Chart.js): más confiable que sumar una
  // librería de matrix/heatmap externa que no se puede probar aquí en
  // un navegador real antes de entregarla.
  async function loadHeatmap() {
    const days = 91;
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - (days - 1));
    const toISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    const movs = await getMovimientosPeriodo(userId, toISO(start), toISO(end));
    if (signal.aborted) return;

    const totalsByDay = new Map();
    for (const mov of movs) {
      if (mov.tipo !== 'gasto') continue;
      totalsByDay.set(mov.fecha, (totalsByDay.get(mov.fecha) ?? 0) + Number(mov.monto));
    }

    const maxTotal = Math.max(0, ...totalsByDay.values());
    const grid = container.querySelector('#heatmap-grid');
    grid.innerHTML = '';

    // Celdas vacías al inicio para que el primer día real caiga en su
    // fila correcta (domingo=0 ... sábado=6) — así las columnas se
    // leen como semanas de verdad, no como un bloque de 91 días sueltos.
    for (let i = 0; i < start.getDay(); i++) {
      const lead = document.createElement('span');
      lead.className = 'heatmap-cell heatmap-cell-lead';
      grid.appendChild(lead);
    }

    for (let i = 0; i < days; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const iso = toISO(d);
      const total = totalsByDay.get(iso) ?? 0;
      const level = total === 0 ? 0 : Math.min(4, Math.ceil((total / (maxTotal || 1)) * 4));

      const cell = document.createElement('span');
      cell.className = 'heatmap-cell';
      cell.dataset.level = String(level);
      cell.title = `${formatDate(iso)} — ${formatCurrency(total)}`;
      grid.appendChild(cell);
    }
  }

  function renderKPIs(balance) {
    if (signal.aborted) return;
    container.querySelector('#kpi-ingresos').textContent = formatCurrency(balance.total_ingresos);
    container.querySelector('#kpi-gastos').textContent = formatCurrency(balance.total_gastos);
    const balanceEl = container.querySelector('#kpi-balance');
    balanceEl.textContent = formatCurrency(balance.balance);
    balanceEl.className = `stat-card-value ${Number(balance.balance) >= 0 ? 'amount-income' : 'amount-expense'}`;
  }

  function renderMovementsTable(rows) {
    if (signal.aborted) return;
    const tbody = container.querySelector('#reportes-tbody');
    const empty = container.querySelector('#reportes-empty');
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
      badge.className = row.tipo === 'gasto' ? 'badge badge-danger' : 'badge';
      badge.textContent = row.tipo === 'ingreso' ? 'Ingreso' : 'Gasto';
      tdTipo.appendChild(badge);

      const tdCategoria = document.createElement('td');
      tdCategoria.textContent = row.categoria ?? '';

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
    if (signal.aborted) return;
    const insightsContainer = container.querySelector('#insights-list');
    insightsContainer.innerHTML = '';
    const insights = [];

    if (topCategorias.length) {
      const top = topCategorias[0];
      insights.push(
        `Tu categoría con mayor gasto este mes es ${top.nombre}, con ${formatCurrency(top.total)} (${top.pct_del_total}% de tus gastos).`,
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
      card.textContent = text;
      insightsContainer.appendChild(card);
    }
  }

  async function loadCharts() {
    const resumenMensual = await getResumenMensual(userId, 6);
    if (signal.aborted) return;
    const labels = resumenMensual.map((r) =>
      new Intl.DateTimeFormat('es-PE', { month: 'short', timeZone: 'America/Lima' }).format(new Date(r.mes)));

    renderBalanceBarChart(
      container.querySelector('#chart-balance-mensual'),
      labels,
      resumenMensual.map((r) => Number(r.total_ingresos) - Number(r.total_gastos)),
      { signal },
    );

    let acumulado = 0;
    const acumulados = resumenMensual.map((r) => {
      acumulado += Number(r.total_ingresos) - Number(r.total_gastos);
      return acumulado;
    });
    renderAreaChart(container.querySelector('#chart-balance-acumulado'), labels, acumulados, 'Balance acumulado', { signal });

    const categoriasPeriodo = await getGastosPorCategoriaPeriodo(userId, currentPeriodo.fechaInicio, currentPeriodo.fechaFin);
    if (signal.aborted) return;
    const top5 = categoriasPeriodo.slice(0, 5);
    const otros = categoriasPeriodo.slice(5).reduce((sum, c) => sum + c.total, 0);
    const paraPie = otros > 0.01 ? [...top5, { nombre: 'Otros', total: otros }] : top5;

    const pieCanvas = container.querySelector('#chart-categorias-pie');
    const pieEmpty = container.querySelector('#chart-categorias-pie-empty');
    if (paraPie.length) {
      pieCanvas.hidden = false;
      pieEmpty.hidden = true;
      renderCategoryDonut(pieCanvas, paraPie, { cutout: '0%', signal });
    } else {
      pieCanvas.hidden = true;
      pieEmpty.hidden = false;
    }
  }

  async function refresh() {
    currentPeriodo = {
      fechaInicio: container.querySelector('#filter-fecha-inicio').value,
      fechaFin: container.querySelector('#filter-fecha-fin').value,
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
      `Ingresos: ${container.querySelector('#kpi-ingresos').textContent}   ` +
      `Gastos: ${container.querySelector('#kpi-gastos').textContent}   ` +
      `Balance: ${container.querySelector('#kpi-balance').textContent}`,
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

  container.querySelector('#filter-fecha-inicio').value = firstDayOfMonthISO();
  container.querySelector('#filter-fecha-fin').value = todayISO();

  await Promise.all([refresh(), loadHeatmap()]);
  if (signal.aborted) return;

  container.querySelector('#filter-form').addEventListener('submit', (event) => {
    event.preventDefault();
    refresh();
  }, { signal });

  container.querySelector('#export-csv-btn').addEventListener('click', exportCSV, { signal });
  container.querySelector('#export-excel-btn').addEventListener('click', exportExcel, { signal });
  container.querySelector('#export-pdf-btn').addEventListener('click', exportPDF, { signal });
  container.querySelector('#export-print-btn').addEventListener('click', () => window.print(), { signal });

  window.addEventListener('themechange', () => {
    loadCharts();
  }, { signal });
}
