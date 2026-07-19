// ============================================================
// FinanzasPro — Puerta de entrada (index.html)
// Vive en su propio archivo (en vez de <script> inline en el HTML)
// para que la Content-Security-Policy pueda prohibir script-src
// 'unsafe-inline' sin excepciones (ver vercel.json, Fase 10).
// ============================================================

import { supabase } from './supabase.js';

const { data } = await supabase.auth.getSession();
window.location.replace(data.session ? 'dashboard.html' : 'login.html');
