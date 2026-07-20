// ============================================================
// FinanzasPro — ingresosService
// CRUD de ingresos. Nunca filtra categorías por user_id "a mano":
// la policy categories_select (RLS) ya limita el resultado a las
// categorías del sistema + las propias del usuario autenticado.
// ============================================================

import { supabase } from '../js/supabase.js';

export async function getCategoriasIngreso() {
  const { data, error } = await supabase
    .from('categories')
    .select('id, nombre, icono, color')
    .eq('tipo', 'ingreso')
    .order('is_system', { ascending: false })
    .order('nombre');
  if (error) throw error;
  return data ?? [];
}

export async function listIngresos(userId, { fechaInicio, fechaFin, categoryId } = {}) {
  let query = supabase
    .from('incomes')
    .select('id, fecha, hora, monto, cliente, descripcion, observaciones, categoria:categories(id, nombre, icono, color)')
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

export async function createIngreso(payload) {
  const { data, error } = await supabase.from('incomes').insert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function updateIngreso(id, payload) {
  const { data, error } = await supabase.from('incomes').update(payload).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteIngreso(id) {
  const { error } = await supabase.from('incomes').delete().eq('id', id);
  if (error) throw error;
}
