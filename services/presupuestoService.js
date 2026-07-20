// ============================================================
// FinanzasPro — presupuestoService
// CRUD de presupuestos mensuales y gestión de sus alertas.
// El disparo de alertas al superar 80%/100% NO ocurre aquí: lo hace
// el trigger fn_check_budget_overrun (database/triggers.sql) en cada
// INSERT de un gasto. Este service solo lee/gestiona lo que la base
// de datos ya calculó.
// ============================================================

import { supabase } from '../js/supabase.js';

export function currentMonthISO() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

export async function listPresupuestos(userId, mes = currentMonthISO()) {
  const { data, error } = await supabase
    .from('budgets')
    .select('id, monto_limite, mes, categoria:categories(id, nombre, icono, color)')
    .eq('user_id', userId)
    .eq('mes', mes)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

// Suma de gastos por categoría en el mes indicado. No se reutiliza
// view_gastos_por_categoria_mes_actual porque esa vista está fija al
// mes en curso; aquí se admite cualquier mes.
export async function getGastoPorCategoriaMes(userId, mes = currentMonthISO()) {
  const [anio, mesNum] = mes.split('-').map(Number);
  const fechaInicio = mes;
  const fechaFin = new Date(anio, mesNum, 0).toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from('expenses')
    .select('category_id, monto')
    .eq('user_id', userId)
    .gte('fecha', fechaInicio)
    .lte('fecha', fechaFin);
  if (error) throw error;

  const totals = {};
  for (const row of data ?? []) {
    totals[row.category_id] = (totals[row.category_id] ?? 0) + Number(row.monto);
  }
  return totals;
}

export async function createPresupuesto(payload) {
  const { data, error } = await supabase.from('budgets').insert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function updatePresupuesto(id, payload) {
  const { data, error } = await supabase.from('budgets').update(payload).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deletePresupuesto(id) {
  const { error } = await supabase.from('budgets').delete().eq('id', id);
  if (error) throw error;
}

export async function listAlertasPresupuesto(userId, { soloNoLeidas = true } = {}) {
  let query = supabase
    .from('budget_alerts')
    .select('id, mensaje, porcentaje, leido, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20);
  if (soloNoLeidas) query = query.eq('leido', false);

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function marcarAlertaLeida(id) {
  const { error } = await supabase.from('budget_alerts').update({ leido: true }).eq('id', id);
  if (error) throw error;
}
