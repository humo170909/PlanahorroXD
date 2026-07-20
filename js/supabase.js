// ============================================================
// FinanzasPro — Cliente Supabase (punto único de conexión)
//
// Se importa la librería oficial desde un CDN como módulo ES: no hay
// paso de build/npm en este proyecto, así que cargamos el paquete ya
// compilado. Cuando configuremos vercel.json (Fase 12) hay que
// permitir este host en la Content-Security-Policy (script-src).
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true, // necesario para el enlace de recuperación de contraseña
  },
});
