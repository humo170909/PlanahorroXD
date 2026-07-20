// ============================================================
// FinanzasPro — Vista: /dashboard
// ============================================================

import {
  getResumenFinanciero, getTopCategoriasGasto, getMovimientosRecientes, getResumenMensual,
} from '../../services/reportesService.js';
import { currentMonthISO, listPresupuestos, getGastoPorCategoriaMes } from '../../services/presupuestoService.js';
import { listMetas } from '../../services/ahorrosService.js';
import { formatCurrency, formatDate } from '../helpers.js';
import { renderCategoryDonut, renderIncomeExpenseLine, renderSparkline } from '../charts.js';
import { iconHTML } from '../icons.js';
import { supabase } from '../supabase.js';

export const layout = 'app';
export const requiresAuth = true;
export const title = 'Dashboard';

const TREND_ICON_ATTRS = { width: 14, height: 14 };

export function render() {
  return `
    <div class="page-header">
      <div>
        <h1 class="page-title">Dashboard</h1>
        <p class="page-subtitle" id="dashboard-date-range"></p>
      </div>
    </div>

    <div id="budget-alert-banner" class="alert alert-warning" role="alert" hidden></div>

    <section class="stats-grid" aria-label="Resumen financiero del mes">
      <article class="card stat-card viz-root" style="--stat-index:0; --stat-glow: var(--color-accent);">
        <div class="stat-card-top">
          <span class="stat-card-icon stat-card-icon-accent" aria-hidden="true">${iconHTML('Wallet', { width: 20, height: 20 })}</span>
          <span class="stat-card-trend" id="trend-saldo" hidden></span>
        </div>
        <span class="stat-card-label">Saldo disponible</span>
        <span class="stat-card-value skeleton" id="stat-saldo">S/ 0.00</span>
        <div class="stat-card-spark"><canvas id="spark-saldo"></canvas></div>
      </article>

      <article class="card stat-card viz-root" style="--stat-index:1; --stat-glow: var(--color-success);">
        <div class="stat-card-top">
          <span class="stat-card-icon stat-card-icon-success" aria-hidden="true">${iconHTML('TrendingUp', { width: 20, height: 20 })}</span>
          <span class="stat-card-trend" id="trend-ingresos" hidden></span>
        </div>
        <span class="stat-card-label">Ingresos del mes</span>
        <span class="stat-card-value skeleton" id="stat-ingresos">S/ 0.00</span>
        <div class="stat-card-spark"><canvas id="spark-ingresos"></canvas></div>
      </article>

      <article class="card stat-card viz-root" style="--stat-index:2; --stat-glow: var(--color-danger);">
        <div class="stat-card-top">
          <span class="stat-card-icon stat-card-icon-danger" aria-hidden="true">${iconHTML('TrendingDown', { width: 20, height: 20 })}</span>
          <span class="stat-card-trend" id="trend-gastos" hidden></span>
        </div>
        <span class="stat-card-label">Gastos del mes</span>
        <span class="stat-card-value skeleton" id="stat-gastos">S/ 0.00</span>
        <div class="stat-card-spark"><canvas id="spark-gastos"></canvas></div>
      </article>

      <article class="card stat-card" style="--stat-index:3; --stat-glow: var(--color-warning);">
        <div class="stat-card-top">
          <span class="stat-card-icon stat-card-icon-warning" aria-hidden="true">${iconHTML('Zap', { width: 20, height: 20 })}</span>
        </div>
        <span class="stat-card-label">Puedes gastar hoy</span>
        <span class="stat-card-value skeleton" id="stat-gasto-diario">S/ 0.00</span>
        <div class="stat-card-meter">
          <div class="meter-track"><div class="meter-fill" id="meter-gasto-fill"></div></div>
          <span class="meter-label" id="meter-gasto-label"></span>
        </div>
      </article>

      <article class="card stat-card" style="--stat-index:4; --stat-glow: var(--color-purple);">
        <div class="stat-card-top">
          <span class="stat-card-icon stat-card-icon-purple" aria-hidden="true">${iconHTML('PiggyBank', { width: 20, height: 20 })}</span>
        </div>
        <span class="stat-card-label">Ahorros del mes</span>
        <span class="stat-card-value skeleton" id="stat-ahorros">S/ 0.00</span>
        <span class="stat-card-delta" id="stat-ahorros-subtitle"></span>
      </article>

      <article class="card stat-card" style="--stat-index:5; --stat-glow: var(--color-blue);">
        <div class="stat-card-top">
          <span class="stat-card-icon stat-card-icon-blue" aria-hidden="true">${iconHTML('Landmark', { width: 20, height: 20 })}</span>
        </div>
        <span class="stat-card-label">Presupuesto restante</span>
        <span class="stat-card-value skeleton" id="stat-presupuesto">S/ 0.00</span>
        <span class="stat-card-delta" id="stat-presupuesto-subtitle"></span>
      </article>

      <article class="card stat-card" style="--stat-index:6; --stat-glow: var(--color-orange);">
        <div class="stat-card-top">
          <span class="stat-card-icon stat-card-icon-orange" aria-hidden="true">${iconHTML('Target', { width: 20, height: 20 })}</span>
        </div>
        <span class="stat-card-label">Objetivos</span>
        <span class="stat-card-value skeleton" id="stat-objetivos">—</span>
        <span class="stat-card-delta" id="stat-objetivos-subtitle"></span>
      </article>
    </section>

    <div class="dashboard-grid">
      <section class="card panel viz-root" aria-label="Tendencia de ingresos y gastos">
        <div class="panel-header">
          <h2 class="panel-title panel-title-tight">Ingresos vs. gastos</h2>
          <div class="chart-toolbar">
            <select class="input chart-period-select" id="trend-period-select" aria-label="Rango de meses">
              <option value="6">Últimos 6 meses</option>
              <option value="12">Últimos 12 meses</option>
            </select>
            <button type="button" class="btn btn-ghost btn-icon-sm" id="trend-reset-zoom" title="Restablecer zoom">${iconHTML('RotateCcw', { width: 14, height: 14 })}</button>
          </div>
        </div>
        <p class="field-hint" style="margin-bottom: var(--space-3);">Usa la rueda del mouse o pellizca para hacer zoom.</p>
        <div class="chart-container">
          <canvas id="chart-tendencia" role="img" aria-label="Gráfico de línea comparando ingresos y gastos mensuales"></canvas>
        </div>
      </section>

      <section class="card panel viz-root" aria-label="Gastos por categoría">
        <h2 class="panel-title">Gastos por categoría (este mes)</h2>
        <div class="chart-container chart-container-donut">
          <canvas id="chart-categorias" role="img" aria-label="Gráfico de dona con la distribución de gastos por categoría"></canvas>
        </div>
        <p class="empty-state" id="chart-categorias-empty" hidden>Aún no registras gastos este mes.</p>
      </section>
    </div>

    <section class="card panel" aria-label="Movimientos recientes">
      <h2 class="panel-title">Movimientos recientes</h2>
      <div class="movement-list" id="movement-list"></div>
      <p class="empty-state" id="movement-list-empty" hidden>Todavía no tienes movimientos registrados.</p>
    </section>
  `;
}

// current/previous vienen de los últimos dos puntos de resumen mensual.
// Sin mes anterior (cuenta nueva) o con base 0, no hay porcentaje
// honesto que mostrar — se oculta el badge en vez de inventar un dato.
function computeTrend(current, previous) {
  if (previous === null || previous === undefined || previous === 0) return null;
  const pct = ((current - previous) / Math.abs(previous)) * 100;
  return { pct: Math.round(pct), up: pct >= 0 };
}

export async function init(container, { signal, session }) {
  const userId = session.user.id;
  let lastCategorias = [];
  let lastResumenMensual = [];
  let trendChart = null;

  async function loadBudgetAlerts() {
    const { data, error } = await supabase
      .from('budget_alerts')
      .select('mensaje')
      .eq('user_id', userId)
      .eq('leido', false)
      .order('created_at', { ascending: false })
      .limit(1);

    // signal.aborted cubre el caso de que el usuario haya navegado a
    // otra vista mientras esta consulta seguía en curso — sin esto,
    // container.querySelector devolvería null (ver nota extensa en
    // presupuestoView.js) porque #view-root ya tiene el HTML de la
    // vista nueva.
    if (error || !data?.length || signal.aborted) return;
    const banner = container.querySelector('#budget-alert-banner');
    banner.textContent = data[0].mensaje;
    banner.hidden = false;
  }

  // goodDirection: 'up' si más es mejor (saldo, ingresos) o 'down' si
  // más es peor (gastos) — así un aumento de gasto se pinta en rojo
  // aunque la flecha apunte hacia arriba (ver skill dataviz, stat-tile: "delta color = direction × whether up is good").
  function renderTrendBadge(id, trend, goodDirection = 'up') {
    const el = container.querySelector(id);
    if (!trend) {
      el.hidden = true;
      return;
    }
    const isGood = goodDirection === 'up' ? trend.up : !trend.up;
    el.hidden = false;
    el.className = `stat-card-trend ${isGood ? 'positive' : 'negative'}`;
    el.innerHTML = `${iconHTML(trend.up ? 'ArrowUpRight' : 'ArrowDownRight', TREND_ICON_ATTRS)}<span>${Math.abs(trend.pct)}%</span>`;
  }

  // Además de pintar el valor real, quita el shimmer de carga puesto
  // en render() (ver css/animations.css .skeleton, Fase 9) — sin esto,
  // el texto real quedaría con color:transparent para siempre.
  function setStatValue(selector, text) {
    const el = container.querySelector(selector);
    el.textContent = text;
    el.classList.remove('skeleton');
  }

  function renderStats(resumen, resumenMensual) {
    if (signal.aborted) return;
    setStatValue('#stat-saldo', formatCurrency(resumen.balance_mes));
    setStatValue('#stat-ingresos', formatCurrency(resumen.ingresos_mes));
    setStatValue('#stat-gastos', formatCurrency(resumen.gastos_mes));
    setStatValue('#stat-gasto-diario', formatCurrency(resumen.gasto_disponible_dia));

    const actual = resumenMensual[resumenMensual.length - 1];
    const anterior = resumenMensual[resumenMensual.length - 2];
    if (actual && anterior) {
      const balanceActual = Number(actual.total_ingresos) - Number(actual.total_gastos);
      const balanceAnterior = Number(anterior.total_ingresos) - Number(anterior.total_gastos);
      renderTrendBadge('#trend-saldo', computeTrend(balanceActual, balanceAnterior), 'up');
      renderTrendBadge('#trend-ingresos', computeTrend(Number(actual.total_ingresos), Number(anterior.total_ingresos)), 'up');
      renderTrendBadge('#trend-gastos', computeTrend(Number(actual.total_gastos), Number(anterior.total_gastos)), 'down');
    }

    // Medidor: % de los ingresos del mes ya comprometido en gastos.
    const ingresos = Number(resumen.ingresos_mes);
    const pctComprometido = ingresos > 0 ? Math.min((Number(resumen.gastos_mes) / ingresos) * 100, 100) : 0;
    const fill = container.querySelector('#meter-gasto-fill');
    fill.style.width = `${pctComprometido}%`;
    fill.className = `meter-fill${pctComprometido >= 90 ? ' danger' : pctComprometido >= 70 ? ' warning' : ''}`;
    container.querySelector('#meter-gasto-label').textContent =
      `${Math.round(pctComprometido)}% de tus ingresos ya gastado · ${formatCurrency(resumen.gasto_disponible_semana)} disponible esta semana`;
  }

  // Ahorros / Presupuesto restante / Objetivos — las 3 tarjetas nuevas
  // de la Fase 5. Reutilizan datos que Ahorros y Presupuesto ya
  // consultan (fn_resumen_financiero, listPresupuestos,
  // getGastoPorCategoriaMes, listMetas): cero queries nuevas al
  // backend, solo se reusan aquí.
  function renderExtraStats(resumen, presupuestos, gastosPorCategoria, metas) {
    if (signal.aborted) return;

    setStatValue('#stat-ahorros', formatCurrency(resumen.ahorro_mes));
    container.querySelector('#stat-ahorros-subtitle').textContent =
      `${resumen.pct_ahorro}% de tus ingresos este mes`;

    const totalLimite = presupuestos.reduce((sum, p) => sum + Number(p.monto_limite), 0);
    const totalGastado = presupuestos.reduce((sum, p) => sum + (gastosPorCategoria[p.categoria?.id] ?? 0), 0);
    const restante = totalLimite - totalGastado;
    const presupuestoEl = container.querySelector('#stat-presupuesto');
    presupuestoEl.textContent = formatCurrency(restante);
    presupuestoEl.className = `stat-card-value ${restante < 0 ? 'amount-expense' : ''}`;
    container.querySelector('#stat-presupuesto-subtitle').textContent = totalLimite > 0
      ? `de ${formatCurrency(totalLimite)} presupuestado`
      : 'Sin presupuestos configurados este mes';

    const activas = metas.filter((m) => m.estado === 'activa');
    const objetivosEl = container.querySelector('#stat-objetivos');
    const subtitleEl = container.querySelector('#stat-objetivos-subtitle');
    objetivosEl.classList.remove('skeleton');
    if (!activas.length) {
      objetivosEl.textContent = '—';
      subtitleEl.textContent = 'Sin metas activas';
    } else {
      const avgPct = Math.round(activas.reduce((sum, m) => sum + Number(m.porcentaje_avance), 0) / activas.length);
      objetivosEl.textContent = `${avgPct}%`;
      subtitleEl.textContent = `${activas.length} meta${activas.length === 1 ? '' : 's'} activa${activas.length === 1 ? '' : 's'} · avance promedio`;
    }
  }

  function renderMovements(movements) {
    if (signal.aborted) return;
    const list = container.querySelector('#movement-list');
    const empty = container.querySelector('#movement-list-empty');
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
      icon.className = `movement-icon ${mov.tipo === 'ingreso' ? 'movement-icon-success' : 'movement-icon-danger'}`;
      icon.textContent = mov.categoria_icono ?? '';

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
    if (signal.aborted) return;
    lastCategorias = categorias;
    const canvas = container.querySelector('#chart-categorias');
    const empty = container.querySelector('#chart-categorias-empty');

    if (!categorias.length) {
      canvas.hidden = true;
      empty.hidden = false;
      return;
    }
    canvas.hidden = false;
    empty.hidden = true;
    renderCategoryDonut(canvas, categorias, { signal });
  }

  function renderTrendChart(resumenMensual) {
    if (signal.aborted) return;
    lastResumenMensual = resumenMensual;
    const canvas = container.querySelector('#chart-tendencia');
    const labels = resumenMensual.map((r) =>
      new Intl.DateTimeFormat('es-PE', { month: 'short', timeZone: 'America/Lima' }).format(new Date(r.mes)));

    trendChart = renderIncomeExpenseLine(
      canvas,
      labels,
      resumenMensual.map((r) => Number(r.total_ingresos)),
      resumenMensual.map((r) => Number(r.total_gastos)),
      { signal },
    );
  }

  async function reloadTrendForPeriod(meses) {
    const data = await getResumenMensual(userId, meses);
    if (signal.aborted) return;
    renderTrendChart(data);
    renderSparklines(data);
  }

  function renderSparklines(resumenMensual) {
    if (signal.aborted) return;
    // --color-success/--color-danger son invariantes entre modos claro
    // y oscuro (igual que la paleta de estado de charts.js), así que
    // leerlas de :root alcanza sin duplicar hex aquí.
    const rootStyles = getComputedStyle(document.documentElement);
    const successColor = rootStyles.getPropertyValue('--color-success').trim();
    const dangerColor = rootStyles.getPropertyValue('--color-danger').trim();

    const balances = resumenMensual.map((r) => Number(r.total_ingresos) - Number(r.total_gastos));
    const ingresos = resumenMensual.map((r) => Number(r.total_ingresos));
    const gastos = resumenMensual.map((r) => Number(r.total_gastos));

    renderSparkline(container.querySelector('#spark-saldo'), balances, { signal });
    renderSparkline(container.querySelector('#spark-ingresos'), ingresos, { color: successColor, signal });
    renderSparkline(container.querySelector('#spark-gastos'), gastos, { color: dangerColor, signal });
  }

  container.querySelector('#dashboard-date-range').textContent =
    new Intl.DateTimeFormat('es-PE', { month: 'long', year: 'numeric', timeZone: 'America/Lima' }).format(new Date());

  const mesActual = currentMonthISO();
  const [resumen, topCategorias, movimientos, resumenMensual, presupuestos, gastosPorCategoria, metas] = await Promise.all([
    getResumenFinanciero(userId),
    getTopCategoriasGasto(userId, undefined, 5),
    getMovimientosRecientes(userId, 8),
    getResumenMensual(userId, 6),
    listPresupuestos(userId, mesActual),
    getGastoPorCategoriaMes(userId, mesActual),
    listMetas(userId),
  ]);

  if (resumen) {
    renderStats(resumen, resumenMensual);
    renderExtraStats(resumen, presupuestos, gastosPorCategoria, metas);
  }
  renderMovements(movimientos);

  const sumaTop = topCategorias.reduce((sum, c) => sum + Number(c.total), 0);
  const otros = Math.max(Number(resumen?.gastos_mes ?? 0) - sumaTop, 0);
  const categoriasParaChart = otros > 0.01
    ? [...topCategorias, { nombre: 'Otros', total: otros }]
    : topCategorias;
  renderCategoriesChart(categoriasParaChart);

  renderTrendChart(resumenMensual);
  renderSparklines(resumenMensual);
  await loadBudgetAlerts();

  window.addEventListener('themechange', () => {
    if (lastCategorias.length) renderCategoriesChart(lastCategorias);
    if (lastResumenMensual.length) {
      renderTrendChart(lastResumenMensual);
      renderSparklines(lastResumenMensual);
    }
  }, { signal });

  container.querySelector('#trend-period-select').addEventListener('change', (event) => {
    reloadTrendForPeriod(Number(event.target.value));
  }, { signal });

  container.querySelector('#trend-reset-zoom').addEventListener('click', () => {
    trendChart?.resetZoom?.();
  }, { signal });
}
