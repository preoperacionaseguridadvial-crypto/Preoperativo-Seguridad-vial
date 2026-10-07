# Feature: panel-inicio-por-rol

## Objective
Replace the Phase-1 placeholder home (`app/page.tsx`) with a mobile-first, role-aware home panel.

## Problem / Why
The home screen still says "Fase 1 (cimientos)", shows the raw role enum, and only offers one button per role. ADMINISTRADOR has dashboard access (`proxy.ts`) but no link to it; nobody gets a shortcut to Consulta de inspecciones. Most users open the app on a phone.

## Scope (authorized by user, 2026-10-07: "avanzá con el panel por rol")
- Shared shell: AppHeader with logo, greeting with first name, human-readable role label, date, logout in the header; remove "Fase 1" text.
- TRABAJADOR: vehicle card (photo + plate) with a state-driven primary action for the latest inspection (start / continue / sent-awaiting / approved / rejected with supervisor note / no apta); SOAT and tecnomecánica expiry alerts; last 3 inspections.
- SUPERVISOR: pending count + requiring-attention count, big link to Aprobaciones, link to Consulta.
- DIRECTOR / SST: 3–4 KPIs for today (done, approved, no apta, pending), shortcuts to Dashboard + Consulta; SST also Administración.
- ADMINISTRADOR: shortcuts to Usuarios, Configuración, Dashboard, Consulta; vehicles with documents expiring soon.
- Every shortcut must respect `ROLE_ROUTE_PREFIXES` in `proxy.ts`.

## Constraints
- Next.js 16 (read `node_modules/next/dist/docs/` before using unfamiliar APIs). Server components; Prisma via `@/lib/prisma`.
- Reuse existing helpers (e.g. `lib/admin/vencimientos.ts`, dashboard queries, `requiereAtencionEstadoConductor`, `tiempoTranscurrido`, `getSignedReadUrl`), design tokens in `app/globals.css` (status-*, ink, surface, border).
- UI copy in Spanish (project language). No schema changes.
- TDD: strict, runner `npx vitest run` (source: user global config "Strict TDD Mode: enabled"). Pure helpers get tests first (RED → GREEN).

## Tasks
- [x] T0 — Commit approvals list redesign separately (route: inline) — commit `5cdd265`
- [x] T1 — Shared shell + role shortcuts (SUPERVISOR, DIRECTOR/SST, ADMINISTRADOR) + role label helper, fixes missing ADMIN links (route: delegated writer — 2+ non-trivial files)
- [ ] T2 — TRABAJADOR panel: latest inspection state CTA, expiry alerts, last 3 inspections (route: delegated writer)
- [ ] T3 — Data summaries: SUPERVISOR pending counts, DIRECTOR/SST today KPIs, ADMIN expiring documents (route: delegated writer)

## Acceptance criteria
- Each of the 5 roles sees only links it is allowed to open, and every link resolves (HTTP 200 for that role).
- Worker CTA matches the actual status of their latest inspection.
- Layout readable at 360px width; no "Fase 1" text remains.
- `npx tsc --noEmit`, `npx eslint`, `npm test` green; live curl check per role.

## Checks
TDD: strict / user global config / `npx vitest run`. RDD: off (global) — ordinary checks only.

## Progress / evidence
- T0 done: `5cdd265`.
- T1 done (route: delegated writer, triggers: 2+ non-trivial files). RED: `npx vitest run lib/inicio/atajos.test.ts` failed on missing `@/lib/auth/route-roles`; GREEN: 13/13. `ROLE_ROUTE_PREFIXES` moved from `proxy.ts` to `lib/auth/route-roles.ts` (same map, no behavior change; proxy imports `getRequiredRoles`). Checks: tsc clean, eslint clean, npm test 33 files / 511 tests pass. Live curl (5 seed roles): `/` 200 with greeting + role label + date, every shortcut 200 without redirect, no "Fase 1" text. Commit: see git log (`feat(inicio): ...shell`).

## Next step
T1–T3 via one delegated writer, one commit per task.
