// ============================================================
// FinanzasPro — ahorrosService
// CRUD de metas de ahorro y sus aportes. monto_actual y el % de
// avance NUNCA se calculan ni se envían desde aquí: los mantiene la
// base de datos (trigger fn_sync_goal_amount + view_metas_progreso).
// ============================================================

import { supabase } from '../js/supabase.js';

export async function listMetas(userId) {
  const { data, error } = await supabase
    .from('view_metas_progreso')
    .select('*')
    .eq('user_id', userId)
    .order('estado', { ascending: true })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createMeta(payload) {
  const { data, error } = await supabase.from('savings_goals').insert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function updateMeta(id, payload) {
  const { data, error } = await supabase.from('savings_goals').update(payload).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteMeta(id) {
  const { error } = await supabase.from('savings_goals').delete().eq('id', id);
  if (error) throw error;
}

export async function listAportes(goalId) {
  const { data, error } = await supabase
    .from('savings_contributions')
    .select('id, monto, fecha, descripcion')
    .eq('goal_id', goalId)
    .order('fecha', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createAporte(payload) {
  const { data, error } = await supabase.from('savings_contributions').insert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function deleteAporte(id) {
  const { error } = await supabase.from('savings_contributions').delete().eq('id', id);
  if (error) throw error;
}
