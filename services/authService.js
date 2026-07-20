// ============================================================
// FinanzasPro — authService
// Única capa que habla directamente con Supabase Auth. auth.js (UI)
// nunca llama a `supabase.auth.*` directamente: siempre pasa por aquí.
// Así, si el día de mañana cambia el backend, solo se reescribe este
// archivo.
// ============================================================

import { supabase } from '../js/supabase.js';
import { SUPABASE_URL, SUPABASE_ANON_KEY, LOGIN_AUDIT_EDGE_FUNCTION_ENABLED } from '../js/config.js';

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
    redirectTo: `${window.location.origin}/login`,
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

// ------------------------------------------------------------
// Auditoría de intentos de login (Fase 5 del rediseño premium)
// ------------------------------------------------------------

// Intenta registrar el intento vía la Edge Function (que además
// captura la IP real del lado del servidor); si no está habilitada
// (LOGIN_AUDIT_EDGE_FUNCTION_ENABLED en config.js) o falla, cae a un
// INSERT directo del cliente sin IP. El registro de auditoría nunca
// debe depender de un componente opcional — por eso el login funciona
// igual con o sin la Edge Function.
//
// La bandera en config.js es intencional: sin ella, esta función
// intentaría el fetch() SIEMPRE, y si la Edge Function no está
// desplegada (el caso por defecto), cada login generaría una petición
// que responde 404 — visible como error en la consola aunque el
// respaldo funcione bien. Preguntar primero evita ese 404 innecesario.
export async function logLoginAttempt({ email, success }) {
  const normalizedEmail = String(email).trim().toLowerCase();

  if (LOGIN_AUDIT_EDGE_FUNCTION_ENABLED) {
    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/log-login-attempt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY },
        body: JSON.stringify({ email: normalizedEmail, success }),
      });
      if (response.ok) return;
    } catch {
      // Sin red o CORS bloqueado: seguimos con el respaldo.
    }
  }

  try {
    await supabase.from('login_attempts').insert({
      email: normalizedEmail,
      success,
      user_agent: navigator.userAgent,
    });
  } catch {
    // Si database/audit.sql todavía no se ejecutó en este proyecto de
    // Supabase, la tabla no existe y este insert fallaría con 404/42P01.
    // No debe romper el login: la auditoría es un extra, no un requisito
    // para poder entrar a la cuenta.
  }
}

// Chequeo de bloqueo SERVER-SIDE: a diferencia del contador en
// localStorage (js/auth.js, que cualquiera puede saltarse borrando el
// almacenamiento del navegador), esto consulta la tabla real en
// Postgres. Si la consulta falla, se asume "no bloqueado" — un fallo
// de red nunca debe impedirle a un usuario legítimo iniciar sesión.
export async function getRecentFailedAttempts(email, minutes = 15) {
  const { data, error } = await supabase.rpc('fn_recent_failed_attempts', {
    p_email: String(email).trim().toLowerCase(),
    p_minutes: minutes,
  });
  if (error) return 0;
  return data ?? 0;
}

// Historial de accesos de la propia cuenta (Perfil). RLS
// (login_attempts_select_own) ya garantiza que solo se puedan leer
// los intentos hechos con el correo del usuario autenticado.
export async function getLoginHistory(email, limit = 10) {
  const { data, error } = await supabase
    .from('login_attempts')
    .select('success, user_agent, created_at')
    .eq('email', String(email).trim().toLowerCase())
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}
