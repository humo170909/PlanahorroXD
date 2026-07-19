// ============================================================
// FinanzasPro — Wrappers de Chart.js
//
// Los colores NO se eligen a ojo aquí: se leen de las variables CSS
// definidas en el bloque .viz-root de dashboard.css, que a su vez usan
// la paleta categórica validada para daltonismo (8 tonos, orden fijo,
// nunca ciclados) y los tokens de superficie/texto claros y oscuros.
// Esto mantiene una sola fuente de verdad de color entre CSS y JS, y
// permite que un mismo gráfico se redibuje correcto en modo oscuro.
// ============================================================

import { Chart, registerables } from 'https://cdn.jsdelivr.net/npm/chart.js/+esm';
import { formatCurrency } from './helpers.js';

Chart.register(...registerables);

const activeCharts = new WeakMap();

function readVizTokens(canvas) {
  const root = canvas.closest('.viz-root') ?? document.body;
  const styles = getComputedStyle(root);
  const read = (name) => styles.getPropertyValue(name).trim();
  return {
    surface: read('--chart-surface') || '#ffffff',
    textPrimary: read('--chart-text-primary') || '#111114',
    textSecondary: read('--chart-text-secondary') || '#63636d',
    textMuted: read('--chart-text-muted') || '#9a9aa5',
    grid: read('--chart-grid') || '#e1e0d9',
    statusGood: read('--status-good') || '#0ca30c',
    statusCritical: read('--status-critical') || '#d03b3b',
    series: [1, 2, 3, 4, 5, 6, 7, 8].map((n) => read(`--series-${n}`)),
  };
}

function withAlpha(hex, alpha) {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function destroyExisting(canvas) {
  activeCharts.get(canvas)?.destroy();
}

// Dona (o pastel, con cutout: '0%') de gasto por categoría. El
// llamador debe limitar a lo sumo ~6 rebanadas (top N + "Otros") —
// pasado eso, el color deja de ser una identidad legible para todos
// los usuarios (ver skill dataviz, "series-count ladder").
export function renderCategoryDonut(canvas, items, { cutout = '68%' } = {}) {
  destroyExisting(canvas);
  const tokens = readVizTokens(canvas);

  const chart = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: items.map((i) => i.nombre),
      datasets: [{
        data: items.map((i) => Number(i.total)),
        backgroundColor: items.map((_, idx) => tokens.series[idx % tokens.series.length]),
        borderColor: tokens.surface,
        borderWidth: 2,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: tokens.textSecondary, usePointStyle: true, boxWidth: 8, padding: 16 },
        },
        tooltip: {
          backgroundColor: tokens.surface,
          titleColor: tokens.textPrimary,
          bodyColor: tokens.textSecondary,
          borderColor: tokens.grid,
          borderWidth: 1,
          padding: 10,
          callbacks: {
            label: (ctx) => ` ${ctx.label}: ${formatCurrency(ctx.parsed)}`,
          },
        },
      },
    },
  });

  activeCharts.set(canvas, chart);
  return chart;
}

// Línea: ingresos vs. gastos por mes. Dos series -> identidad por
// color es segura (ver skill dataviz, "series-count ladder").
export function renderIncomeExpenseLine(canvas, labels, ingresos, gastos) {
  destroyExisting(canvas);
  const tokens = readVizTokens(canvas);
  const colorIngresos = tokens.series[1]; // verde
  const colorGastos = tokens.series[7]; // rojo

  const chart = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Ingresos',
          data: ingresos,
          borderColor: colorIngresos,
          backgroundColor: withAlpha(colorIngresos, 0.1),
          borderWidth: 2,
          pointRadius: 4,
          pointBackgroundColor: colorIngresos,
          pointBorderColor: tokens.surface,
          pointBorderWidth: 2,
          tension: 0.3,
          fill: true,
        },
        {
          label: 'Gastos',
          data: gastos,
          borderColor: colorGastos,
          backgroundColor: withAlpha(colorGastos, 0.1),
          borderWidth: 2,
          pointRadius: 4,
          pointBackgroundColor: colorGastos,
          pointBorderColor: tokens.surface,
          pointBorderWidth: 2,
          tension: 0.3,
          fill: true,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: tokens.textSecondary, usePointStyle: true, boxWidth: 8, padding: 16 },
        },
        tooltip: {
          backgroundColor: tokens.surface,
          titleColor: tokens.textPrimary,
          bodyColor: tokens.textSecondary,
          borderColor: tokens.grid,
          borderWidth: 1,
          padding: 10,
          callbacks: {
            label: (ctx) => ` ${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y)}`,
          },
        },
      },
      scales: {
        x: { grid: { color: tokens.grid }, ticks: { color: tokens.textMuted } },
        y: { grid: { color: tokens.grid }, ticks: { color: tokens.textMuted }, beginAtZero: true },
      },
    },
  });

  activeCharts.set(canvas, chart);
  return chart;
}

// Barras divergentes: balance por mes (por encima/debajo de S/ 0).
// Esto es una codificación de ESTADO (bien/mal), no de identidad de
// categoría, así que usa la paleta de estado (good/critical) en vez
// de reciclar los tonos categóricos — un color de estado nunca debe
// impersonar una serie (ver skill dataviz, references/palette.md).
export function renderBalanceBarChart(canvas, labels, balances) {
  destroyExisting(canvas);
  const tokens = readVizTokens(canvas);

  const chart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Balance',
        data: balances,
        backgroundColor: balances.map((v) => (v >= 0 ? tokens.statusGood : tokens.statusCritical)),
        borderRadius: 4,
        maxBarThickness: 24,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: tokens.surface,
          titleColor: tokens.textPrimary,
          bodyColor: tokens.textSecondary,
          borderColor: tokens.grid,
          borderWidth: 1,
          padding: 10,
          callbacks: { label: (ctx) => ` ${formatCurrency(ctx.parsed.y)}` },
        },
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: tokens.textMuted } },
        y: { grid: { color: tokens.grid }, ticks: { color: tokens.textMuted } },
      },
    },
  });

  activeCharts.set(canvas, chart);
  return chart;
}

// Área: evolución de una sola magnitud en el tiempo (ej. balance
// acumulado). Un único hue secuencial — nunca varios colores para una
// sola serie.
export function renderAreaChart(canvas, labels, data, seriesLabel = 'Balance acumulado') {
  destroyExisting(canvas);
  const tokens = readVizTokens(canvas);
  const color = tokens.series[0];

  const chart = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: seriesLabel,
        data,
        borderColor: color,
        backgroundColor: withAlpha(color, 0.15),
        borderWidth: 2,
        pointRadius: 3,
        pointBackgroundColor: color,
        pointBorderColor: tokens.surface,
        pointBorderWidth: 2,
        tension: 0.3,
        fill: true,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: tokens.surface,
          titleColor: tokens.textPrimary,
          bodyColor: tokens.textSecondary,
          borderColor: tokens.grid,
          borderWidth: 1,
          padding: 10,
          callbacks: { label: (ctx) => ` ${formatCurrency(ctx.parsed.y)}` },
        },
      },
      scales: {
        x: { grid: { color: tokens.grid }, ticks: { color: tokens.textMuted } },
        y: { grid: { color: tokens.grid }, ticks: { color: tokens.textMuted } },
      },
    },
  });

  activeCharts.set(canvas, chart);
  return chart;
}

// Barras: usada en Reportes (Fase 9) para comparaciones categóricas simples.
export function renderBarChart(canvas, labels, data, seriesLabel = 'Total') {
  destroyExisting(canvas);
  const tokens = readVizTokens(canvas);
  const color = tokens.series[0]; // azul, hue por defecto para magnitud

  const chart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: seriesLabel,
        data,
        backgroundColor: color,
        borderRadius: 4,
        maxBarThickness: 24,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: tokens.surface,
          titleColor: tokens.textPrimary,
          bodyColor: tokens.textSecondary,
          borderColor: tokens.grid,
          borderWidth: 1,
          padding: 10,
          callbacks: {
            label: (ctx) => ` ${formatCurrency(ctx.parsed.y)}`,
          },
        },
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: tokens.textMuted } },
        y: { grid: { color: tokens.grid }, ticks: { color: tokens.textMuted }, beginAtZero: true },
      },
    },
  });

  activeCharts.set(canvas, chart);
  return chart;
}
