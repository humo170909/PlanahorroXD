// ============================================================
// FinanzasPro — Bootstrap de la SPA
// Vive en su propio archivo (en vez de <script> inline en index.html)
// para que la Content-Security-Policy pueda seguir prohibiendo
// script-src 'unsafe-inline' sin excepciones (ver vercel.json).
// ============================================================

import { startRouter } from './router.js';

startRouter();
