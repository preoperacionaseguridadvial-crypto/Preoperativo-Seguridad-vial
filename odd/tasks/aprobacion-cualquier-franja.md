# Aprobacion en cualquier franja abierta

## Objective
Approvers (Director de Operaciones = `SUPERVISOR`, Supervisor Oleariari) may approve/reject a pending inspection during ANY open approval window (`[05:45, 08:00)` or `[17:45, 20:00)` Bogota), for as long as it stays pending. Outside every window they still need an SST `APROBACION` habilitacion.

## Problem / why
Client report 2026-11-07: approvers could not approve inside the 5:45-8:00 hours. Cause (PR #23 rule): each pending stage was bound to ONE window and did not revive in a later window, so an inspection sent at 6:20 a. m. was blocked at 6:00 p. m. User decision 2026-11-07: "cualquier franja abierta".

## Rule
- Can decide without SST iff `ahora` is inside any approval window.
- No expiry: a pending stage never becomes "vencido" by time.
- Metrics `fueraDePlazo`: decision made outside every approval window.
- Worker inspection windows (`lib/horarios/ventanas.ts`) unchanged. No schema changes.

## Scope
`lib/horarios/plazo-aprobacion.ts`, `estado-plazo-aprobador.ts`, `habilitaciones.ts` (`exigirPlazoParaDecidir`), `metricas-horario.ts`, `reportes-horario.ts`, `lib/inicio/pendientes-aprobador.ts`, approver UI texts mentioning expiry, and their tests.

## Checks
Strict TDD on (user global config); runner `npm test` (vitest run). Also `npx tsc --noEmit`, `npm run lint`.

## Tasks
- [x] T1 - New rule + server enforcement + UI texts + metrics + tests. Route: delegated writer (2+ non-trivial files).
- [x] T2 - Parent spot check, commit.

## Delivery
Branch `fix/aprobacion-cualquier-franja` from `main` @ 45fce75. Strategy: ask-on-risk.

## Progress / evidence
- T1 (delegated writer, inline route would exceed writer trigger): new pure API `ventanaAprobacionAbierta` / `enVentanaAprobacion` / `proximaVentanaAprobacion`; single-window binding and expiry ("vencido", "por vencer", pendientes vencidas) removed from rule, UI, dashboard and Excel. RED observed: 24 failing pure tests before implementation; GREEN after.
- T2 (parent): Postgres test DB restarted; `npm test` 91 files / 1232 passed, `npx tsc --noEmit` clean, `npm run lint` clean. 16 files, +234/-540. NOT browser-verified.
- RDD: not run in this session.

## Next step
Push + PR (user decision); approver visual check in a window.
