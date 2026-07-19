// ============================================================
// FinanzasPro — Configuración global
//
// ACCIÓN MANUAL REQUERIDA:
// Reemplaza los dos valores de abajo por los de TU proyecto Supabase.
// Los encuentras en: Supabase Dashboard → Project Settings → API
//   - SUPABASE_URL      → "Project URL"
//   - SUPABASE_ANON_KEY → "anon public" key
//
// La anon key es segura de exponer en el frontend: por diseño, todo
// lo que puede hacer está limitado por las políticas RLS que creamos
// en database/rls.sql. NUNCA pongas aquí la "service_role key" —
// esa key salta RLS por completo y solo debe vivir en un backend
// seguro (nunca en código que llega al navegador).
// ============================================================

export const SUPABASE_URL = 'https://mgpunedauyqmskrclthc.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ncHVuZWRhdXlxbXNrcmNsdGhjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ0Nzc2NjcsImV4cCI6MjEwMDA1MzY2N30.3QaYqWBgo-IMCLXQxDz_29icuSNB2-FCHuNEs23LN5g';

export const APP_CONFIG = Object.freeze({
  currency: 'PEN',
  currencySymbol: 'S/',
  locale: 'es-PE',
  timezone: 'America/Lima',
});
