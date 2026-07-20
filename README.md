# FinanzasPro — Plataforma Inteligente de Administración Financiera Personal

Aplicación web (SPA de una sola página, sin frameworks) para controlar ingresos, gastos, ahorros, presupuestos y flujo de caja personal, con análisis financiero automático. Construida con HTML/CSS/JS puro (ES2025), Supabase (PostgreSQL + Auth) y desplegada en Vercel.

Moneda: **PEN (S/)** · Zona horaria: **America/Lima** · Formato de fecha: **dd/mm/yyyy** · Hora: **24h**

---

## Estado del proyecto — Roadmap por fases

Cada fase debe quedar 100% funcional y documentada antes de avanzar a la siguiente. Este checklist es la fuente de verdad del progreso.

- [x] Fase 1 — Arquitectura y planificación
- [x] Fase 2 — Base de datos (schema, RLS, functions, triggers, views)
- [x] Fase 3 — Autenticación (registro, login, logout, recuperar contraseña)
- [x] Fase 4 — Dashboard
- [x] Fase 5 — Ingresos
- [x] Fase 6 — Gastos
- [x] Fase 7 — Ahorros
- [x] Fase 8 — Presupuesto
- [x] Fase 9 — Reportes (PDF/Excel/CSV)
- [x] Fase 10 — Seguridad (headers, rate limiting, hardening)
- [x] Fase 11 — Optimización
- [x] Fase 12 — Despliegue en Vercel
- [x] Fase 13 — Manual completo
- [x] **Rediseño premium** — SPA, sistema de iconos Lucide, dashboard con mini-gráficos, auditoría de login (ver [REDISENO.md](REDISENO.md))

Ver [ARCHITECTURE.md](ARCHITECTURE.md) para el diseño técnico completo (stack, estructura de carpetas, modelo de datos conceptual, modelo de seguridad) y [REDISENO.md](REDISENO.md) para el detalle fase a fase del rediseño visual/arquitectónico.

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | HTML5, CSS3 moderno (sin frameworks), JavaScript ES2025 (módulos nativos), SPA con router propio (History API) |
| Iconos | Lucide |
| Backend / DB | Supabase (PostgreSQL, Auth, RLS) |
| Gráficos | Chart.js |
| Reportes | jsPDF (PDF), SheetJS (Excel/CSV) |
| Hosting | Vercel |
| Control de versiones | Git + GitHub |

## Cómo se enseña este proyecto

Cada fase viene acompañada de una explicación: qué se construyó, por qué se tomó esa decisión técnica, y cómo funciona cada archivo/función nueva. El manual final (Fase 13, `MANUAL_COMPLETO.md`) consolida instalación, uso y despliegue paso a paso para quien no haya seguido el desarrollo en vivo.
