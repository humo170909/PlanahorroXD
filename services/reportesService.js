// ============================================================
// FinanzasPro — reportesService
// Capa de acceso a datos para balances, resúmenes y movimientos.
// Usada por js/views/dashboardView.js y js/views/reportesView.js.
// Todas las funciones reciben userId explícito y lo pasan a Supabase;
// aunque alguien lo falsee, RLS (database/rls.sql) solo deja ver las
// filas del usuario realmente autenticado.
// ============================================================

import { supabase } from '../js/supabase.js';

export async function getResumenFinanciero(userId, mes) {
  const { data, error } = await supabase.rpc('fn_resumen_financiero', {
    p_user_id: userId,
    ...(mes ? { p_mes: mes } : {}),
  });
  if (error) throw error;
  return data?.[0] ?? null;
}

export async function getTopCategoriasGasto(userId, mes, limite = 5) {
  const { data, error } = await supabase.rpc('fn_top_categorias_gasto', {
    p_user_id: userId,
    ...(mes ? { p_mes: mes } : {}),
    p_limite: limite,
  });
  if (error) throw error;
  return data ?? [];
}

export async function getBalancePeriodo(userId, fechaInicio, fechaFin) {
  const { data, error } = await supabase.rpc('fn_balance_periodo', {
    p_user_id: userId,
    p_fecha_inicio: fechaInicio,
    p_fecha_fin: fechaFin,
  });
  if (error) throw error;
  return data?.[0] ?? null;
}

export async function getMovimientosRecientes(userId, limite = 8) {
  const { data, error } = await supabase
    .from('view_movimientos_recientes')
    .select('*')
    .eq('user_id', userId)
    .order('fecha', { ascending: false })
    .order('hora', { ascending: false })
    .limit(limite);
  if (error) throw error;
  return data ?? [];
}

// Últimos N meses (incluyendo el actual), en orden cronológico ascendente
// — listo para pintar de izquierda a derecha en un gráfico de línea.
export async function getResumenMensual(userId, mesesAtras = 6) {
  const { data, error } = await supabase
    .from('view_resumen_mensual')
    .select('*')
    .eq('user_id', userId)
    .order('mes', { ascending: false })
    .limit(mesesAtras);
  if (error) throw error;
  return (data ?? []).reverse();
}

// Movimientos (ingresos + gastos) de un rango de fechas libre — usada
// por Reportes para la tabla y las exportaciones PDF/Excel/CSV.
export async function getMovimientosPeriodo(userId, fechaInicio, fechaFin) {
  const { data, error } = await supabase
    .from('view_movimientos_recientes')
    .select('*')
    .eq('user_id', userId)
    .gte('fecha', fechaInicio)
    .lte('fecha', fechaFin)
    .order('fecha', { ascending: false })
    .order('hora', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

// Gasto por categoría en un rango de fechas libre (a diferencia de
// view_gastos_por_categoria_mes_actual, que está fija al mes en curso).
export async function getGastosPorCategoriaPeriodo(userId, fechaInicio, fechaFin) {
  const { data, error } = await supabase
    .from('expenses')
    .select('monto, categoria:categories(id, nombre, icono, color)')
    .eq('user_id', userId)
    .gte('fecha', fechaInicio)
    .lte('fecha', fechaFin);
  if (error) throw error;

  const totals = new Map();
  for (const row of data ?? []) {
    const key = row.categoria?.id ?? 'sin-categoria';
    const prev = totals.get(key) ?? {
      nombre: row.categoria?.nombre ?? 'Sin categoría',
      icono: row.categoria?.icono ?? '',
      total: 0,
    };
    prev.total += Number(row.monto);
    totals.set(key, prev);
  }
  return [...totals.values()].sort((a, b) => b.total - a.total);
}

// Búsqueda global (topbar, Fase 4). `term` se limpia a solo
// letras/números/espacios antes de armar el filtro: .or() de
// PostgREST tiene su propia mini-sintaxis (usa "," y "." como
// separadores de condición/operador), así que un término con esos
// caracteres podría alterar el filtro que se arma, no solo el patrón
// de búsqueda — no es SQL injection (todo sigue parametrizado por el
// SDK), pero sí hay que sanear igual antes de interpolar en la
// expresión de filtro.
export async function searchMovimientos(userId, term, limite = 6) {
  const safeTerm = String(term ?? '').replace(/[^\p{L}\p{N}\s]/gu, '').trim();
  if (!safeTerm) return [];

  const pattern = `%${safeTerm}%`;
  const { data, error } = await supabase
    .from('view_movimientos_recientes')
    .select('*')
    .eq('user_id', userId)
    .or(`descripcion.ilike.${pattern},categoria.ilike.${pattern}`)
    .order('fecha', { ascending: false })
    .limit(limite);
  if (error) return [];
  return data ?? [];
}
