// ============================================================
// FinanzasPro — authService
// Única capa que habla directamente con Supabase Auth. auth.js (UI)
// nunca llama a `supabase.auth.*` directamente: siempre pasa por aquí.
// Así, si el día de mañana cambia el backend, solo se reescribe este
// archivo.
// ============================================================

import { supabase } from '../js/supabase.js';

export async function signUp({ email, password, fullName }) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });
  if (error) throw error;
  return data;
}

export async function signIn({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function sendPasswordReset(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/login.html`,
  });
  if (error) throw error;
}

export async function updatePassword(newPassword) {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

// Actualiza metadata del usuario en Supabase Auth (ej. full_name), que
// es lo que layout.js lee para el nombre mostrado en la topbar. Se usa
// junto a updateProfile() para mantener auth.users y public.profiles
// sincronizados — son dos fuentes de verdad distintas para el mismo dato.
export async function updateAuthUser(payload) {
  const { data, error } = await supabase.auth.updateUser(payload);
  if (error) throw error;
  return data;
}

export async function getProfile(userId) {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
  if (error) throw error;
  return data;
}

export async function updateProfile(userId, payload) {
  const { data, error } = await supabase.from('profiles').update(payload).eq('id', userId).select().single();
  if (error) throw error;
  return data;
}

export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export function onAuthStateChange(callback) {
  return supabase.auth.onAuthStateChange((event, session) => callback(event, session));
}
