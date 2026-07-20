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

// Carga chartjs-plugin-zoom UNA sola vez (promesa compartida, no una
// por gráfico) y con degradación segura: si el CDN falla o el import
// no resuelve, `zoomReady` queda en false y los gráficos simplemente
// se renderizan sin zoom — nunca rompe el resto del dashboard por un
// plugin opcional.
let zoomReady = false;
const zoomPluginPromise = import('https://cdn.jsdelivr.net/npm/chartjs-plugin-zoom/+esm')
  .then((mod) => {
    Chart.register(mod.default);
    zoomReady = true;
  })
  .catch(() => {
    zoomReady = false;
  });

function zoomOptions() {
  if (!zoomReady) return undefined;
  return {
    pan: { enabled: true, mode: 'x', modifierKey: null },
    zoom: {
      wheel: { enabled: true },
      pinch: { enabled: true },
      drag: { enabled: false },
      mode: 'x',
    },
  };
}

// Animación y tooltip comparten el mismo lenguaje visual en todos los
// gráficos — un solo lugar para ajustar el "feel" general.
const ANIMATION = { duration: 700, easing: 'easeOutQuart' };

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

// Relleno degradado real (canvas gradient), no un color plano con
// alpha: más opaco arriba, transparente hacia la base — el efecto
// "premium" típico de gráficos de área en apps como Linear o Stripe.
function verticalGradient(canvas, color, topAlpha = 0.28) {
  const ctx = canvas.getContext('2d');
  const height = canvas.clientHeight || 220;
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, withAlpha(color, topAlpha));
  gradient.addColorStop(1, withAlpha(color, 0));
  return gradient;
}

// Tooltip consistente: esquinas redondeadas, más padding, marcador de
// color como punto (no como cuadrado) — una lectura más "moderna".
function tooltipStyle(tokens, callbacks) {
  return {
    backgroundColor: tokens.surface,
    titleColor: tokens.textPrimary,
    bodyColor: tokens.textSecondary,
    borderColor: tokens.grid,
    borderWidth: 1,
    cornerRadius: 10,
    padding: 12,
    boxPadding: 6,
    usePointStyle: true,
    callbacks,
  };
}

function legendStyle(tokens) {
  return {
    position: 'bottom',
    labels: { color: tokens.textSecondary, usePointStyle: true, pointStyle: 'circle', boxWidth: 8, padding: 16 },
  };
}

function destroyExisting(canvas) {
  activeCharts.get(canvas)?.destroy();
}

// Registra el chart y, si se pasa un AbortSignal (el de la vista SPA
// actual, ver router.js), lo destruye solo cuando esa vista se cierra.
// Sin esto, cada gráfico dejaría vivo un ResizeObserver interno de
// Chart.js aunque el usuario ya haya navegado a otra pantalla.
function trackChart(canvas, chart, signal) {
  activeCharts.set(canvas, chart);
  if (signal) {
    signal.addEventListener('abort', () => {
      if (activeCharts.get(canvas) === chart) {
        chart.destroy();
        activeCharts.delete(canvas);
      }
    }, { once: true });
  }
}

// Dona (o pastel, con cutout: '0%') de gasto por categoría. El
// llamador debe limitar a lo sumo ~6 rebanadas (top N + "Otros") —
// pasado eso, el color deja de ser una identidad legible para todos
// los usuarios (ver skill dataviz, "series-count ladder").
export function renderCategoryDonut(canvas, items, { cutout = '68%', signal } = {}) {
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
        hoverOffset: 6,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout,
      animation: ANIMATION,
      plugins: {
        legend: legendStyle(tokens),
        tooltip: tooltipStyle(tokens, {
          label: (ctx) => ` ${ctx.label}: ${formatCurrency(ctx.parsed)}`,
        }),
      },
    },
  });

  trackChart(canvas, chart, signal);
  return chart;
}

// Línea: ingresos vs. gastos por mes. Dos series -> identidad por
// color es segura (ver skill dataviz, "series-count ladder").
export function renderIncomeExpenseLine(canvas, labels, ingresos, gastos, { signal } = {}) {
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
          backgroundColor: verticalGradient(canvas, colorIngresos),
          borderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: colorIngresos,
          pointBorderColor: tokens.surface,
          pointBorderWidth: 2,
          tension: 0.35,
          fill: true,
        },
        {
          label: 'Gastos',
          data: gastos,
          borderColor: colorGastos,
          backgroundColor: verticalGradient(canvas, colorGastos),
          borderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: colorGastos,
          pointBorderColor: tokens.surface,
          pointBorderWidth: 2,
          tension: 0.35,
          fill: true,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: ANIMATION,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: legendStyle(tokens),
        tooltip: tooltipStyle(tokens, {
          label: (ctx) => ` ${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y)}`,
        }),
        zoom: zoomOptions(),
      },
      scales: {
        x: { grid: { color: tokens.grid }, ticks: { color: tokens.textMuted } },
        y: { grid: { color: tokens.grid }, ticks: { color: tokens.textMuted }, beginAtZero: true },
      },
    },
  });

  trackChart(canvas, chart, signal);

  // Si el plugin de zoom todavía no había terminado de cargar cuando
  // se creó este chart (típico en la primera carga de la página), se
  // activa en cuanto esté listo — sin volver a construir el gráfico.
  if (!zoomReady) {
    zoomPluginPromise.then(() => {
      if (signal?.aborted || activeCharts.get(canvas) !== chart) return;
      chart.options.plugins.zoom = zoomOptions();
      chart.update();
    });
  }

  return chart;
}

// Barras divergentes: balance por mes (por encima/debajo de S/ 0).
// Esto es una codificación de ESTADO (bien/mal), no de identidad de
// categoría, así que usa la paleta de estado (good/critical) en vez
// de reciclar los tonos categóricos — un color de estado nunca debe
// impersonar una serie (ver skill dataviz, references/palette.md).
export function renderBalanceBarChart(canvas, labels, balances, { signal } = {}) {
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
        hoverBackgroundColor: balances.map((v) => withAlpha(v >= 0 ? tokens.statusGood : tokens.statusCritical, 0.8)),
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: ANIMATION,
      plugins: {
        legend: { display: false },
        tooltip: tooltipStyle(tokens, {
          label: (ctx) => ` ${formatCurrency(ctx.parsed.y)}`,
        }),
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: tokens.textMuted } },
        y: { grid: { color: tokens.grid }, ticks: { color: tokens.textMuted } },
      },
    },
  });

  trackChart(canvas, chart, signal);
  return chart;
}

// Área: evolución de una sola magnitud en el tiempo (ej. balance
// acumulado). Un único hue secuencial — nunca varios colores para una
// sola serie.
export function renderAreaChart(canvas, labels, data, seriesLabel = 'Balance acumulado', { signal } = {}) {
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
        backgroundColor: verticalGradient(canvas, color, 0.35),
        borderWidth: 2,
        pointRadius: 3,
        pointHoverRadius: 6,
        pointBackgroundColor: color,
        pointBorderColor: tokens.surface,
        pointBorderWidth: 2,
        tension: 0.35,
        fill: true,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: ANIMATION,
      plugins: {
        legend: { display: false },
        tooltip: tooltipStyle(tokens, {
          label: (ctx) => ` ${formatCurrency(ctx.parsed.y)}`,
        }),
      },
      scales: {
        x: { grid: { color: tokens.grid }, ticks: { color: tokens.textMuted } },
        y: { grid: { color: tokens.grid }, ticks: { color: tokens.textMuted } },
      },
    },
  });

  trackChart(canvas, chart, signal);
  return chart;
}

// Barras: usada en Reportes para comparaciones categóricas simples.
export function renderBarChart(canvas, labels, data, seriesLabel = 'Total', { signal } = {}) {
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
        hoverBackgroundColor: withAlpha(color, 0.8),
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: ANIMATION,
      plugins: {
        legend: { display: false },
        tooltip: tooltipStyle(tokens, {
          label: (ctx) => ` ${formatCurrency(ctx.parsed.y)}`,
        }),
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: tokens.textMuted } },
        y: { grid: { color: tokens.grid }, ticks: { color: tokens.textMuted }, beginAtZero: true },
      },
    },
  });

  trackChart(canvas, chart, signal);
  return chart;
}

// Sparkline: mini gráfico de tendencia para las tarjetas del
// dashboard. Sin ejes, sin leyenda, sin tooltip — solo la forma de la
// tendencia. `color` por defecto es el primer tono categórico; las
// tarjetas semánticas (ingresos/gastos) pasan el color de estado que
// corresponda para que el sparkline y el valor cuenten la misma historia.
export function renderSparkline(canvas, data, { color, signal } = {}) {
  destroyExisting(canvas);
  const tokens = readVizTokens(canvas);
  const lineColor = color || tokens.series[0];

  const chart = new Chart(canvas, {
    type: 'line',
    data: {
      labels: data.map((_, i) => i),
      datasets: [{
        data,
        borderColor: lineColor,
        backgroundColor: verticalGradient(canvas, lineColor, 0.25),
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 3,
        pointHoverBackgroundColor: lineColor,
        tension: 0.4,
        fill: true,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: ANIMATION,
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      scales: {
        x: { display: false },
        y: { display: false },
      },
    },
  });

  trackChart(canvas, chart, signal);
  return chart;
}

// Radar: presupuestado vs. gastado por categoría — dos series
// (categórico, seguro hasta ~6-8 puntos). Útil precisamente porque
// "por encima de la línea de presupuesto" se lee de un vistazo, algo
// que una tabla no transmite tan rápido.
export function renderBudgetRadar(canvas, labels, presupuestado, gastado, { signal } = {}) {
  destroyExisting(canvas);
  const tokens = readVizTokens(canvas);
  const colorPresupuesto = tokens.series[0];
  const colorGastado = tokens.series[7];

  const chart = new Chart(canvas, {
    type: 'radar',
    data: {
      labels,
      datasets: [
        {
          label: 'Presupuestado',
          data: presupuestado,
          borderColor: colorPresupuesto,
          backgroundColor: withAlpha(colorPresupuesto, 0.15),
          borderWidth: 2,
          pointBackgroundColor: colorPresupuesto,
          pointRadius: 3,
        },
        {
          label: 'Gastado',
          data: gastado,
          borderColor: colorGastado,
          backgroundColor: withAlpha(colorGastado, 0.15),
          borderWidth: 2,
          pointBackgroundColor: colorGastado,
          pointRadius: 3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: ANIMATION,
      plugins: {
        legend: legendStyle(tokens),
        tooltip: tooltipStyle(tokens, {
          label: (ctx) => ` ${ctx.dataset.label}: ${formatCurrency(ctx.parsed.r)}`,
        }),
      },
      scales: {
        r: {
          beginAtZero: true,
          grid: { color: tokens.grid },
          angleLines: { color: tokens.grid },
          pointLabels: { color: tokens.textSecondary, font: { size: 11 } },
          ticks: { color: tokens.textMuted, backdropColor: 'transparent' },
        },
      },
    },
  });

  trackChart(canvas, chart, signal);
  return chart;
}
