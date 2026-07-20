// ============================================================
// FinanzasPro — gastosService
// CRUD de gastos. Igual que ingresosService: las categorías no se
// filtran por user_id a mano, RLS ya se encarga.
// ============================================================

import { supabase } from '../js/supabase.js';

export async function getCategoriasGasto() {
  const { data, error } = await supabase
    .from('categories')
    .select('id, nombre, icono, color')
    .eq('tipo', 'gasto')
    .order('is_system', { ascending: false })
    .order('nombre');
  if (error) throw error;
  return data ?? [];
}

export async function listGastos(userId, { fechaInicio, fechaFin, categoryId } = {}) {
  let query = supabase
    .from('expenses')
    .select('id, fecha, hora, monto, descripcion, comprobante_url, observaciones, categoria:categories(id, nombre, icono, color)')
    .eq('user_id', userId)
    .order('fecha', { ascending: false })
    .order('hora', { ascending: false });

  if (fechaInicio) query = query.gte('fecha', fechaInicio);
  if (fechaFin) query = query.lte('fecha', fechaFin);
  if (categoryId) query = query.eq('category_id', categoryId);

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function createGasto(payload) {
  const { data, error } = await supabase.from('expenses').insert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function updateGasto(id, payload) {
  const { data, error } = await supabase.from('expenses').update(payload).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteGasto(id) {
  const { error } = await supabase.from('expenses').delete().eq('id', id);
  if (error) throw error;
}

// Se consulta justo después de crear un gasto para saber si el trigger
// fn_check_budget_overrun (database/triggers.sql) generó una alerta.
export async function getUltimaAlertaPresupuesto(userId) {
  const { data, error } = await supabase
    .from('budget_alerts')
    .select('mensaje, created_at')
    .eq('user_id', userId)
    .eq('leido', false)
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) throw error;
  return data?.[0] ?? null;
}
