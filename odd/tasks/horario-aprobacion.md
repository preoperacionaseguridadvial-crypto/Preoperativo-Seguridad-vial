# Horario de aprobacion (5:45-8:00 a. m. / p. m.)

## Objective
Replace the 60-minute approval deadline with fixed approval windows: approvers (Director de Operaciones = `SUPERVISOR`, and Supervisor Oleariari) may approve/reject only between 5:45-8:00 a. m. and 5:45-8:00 p. m. (Bogota time). Outside that, they need an SST `APROBACION` habilitacion (existing mechanism).

## Problem / why
User request 2026-10-28: the approval rule changes from "60 minutes since it reached the inbox" to a fixed schedule. Applies to every approval stage (user confirmed: also Supervisor Oleariari).

## Rule (decided by parent, reversible)
- Approval windows: `[05:45, 08:00)` and `[17:45, 20:00)` Bogota, start included, end excluded.
- Each pending stage is bound to ONE approval window: the first window whose end is after the stage start (`inicioPlazoEtapa`: `completedAt`, or `revisadaSupervisorOleariariAt` for Oleariari stage 2). If the stage starts inside a window -> that window; if it starts outside -> the next window to open.
- Deadline (`vence`) = end of that window. Expired when `ahora >= vence`; it does NOT revive in a later window.
- Can decide without SST only when `ventana.inicio <= ahora < ventana.fin`. Before the window opens (e.g. submitted 10:00 a. m. under SST habilitacion) -> not expired, but blocked unless SST habilitacion.
- Metrics `fueraDePlazo`: decision outside the stage's window.

## Scope
- `lib/horarios/plazo-aprobacion.ts` (+ approval windows), `habilitaciones.ts` (`exigirPlazoParaDecidir`), `estado-plazo-aprobador.ts`, `textos-bloqueo.ts`, `metricas-horario.ts`, `reportes-horario.ts` (DB prefilter), `lib/inicio/pendientes-aprobador.ts`, approver UI texts (queue card, detail, home) mentioning 60 minutes.
- Tests updated/added. No schema changes.

## Constraints
- Strict TDD on (user global config); runner `npm test` (vitest run). Also `npx tsc --noEmit`, `npm run lint`.
- Worker inspection windows (`lib/horarios/ventanas.ts`, 5:45-6:30) unchanged.

## Tasks
- [x] T1 - Approval windows rule + server enforcement + UI texts + metrics/reports + tests. Route: delegated writer (2+ non-trivial files).
- [x] T2 - Parent spot check, commit.

## Progress / evidence
- Branch `feat/horario-aprobacion` from `feat/inicio-aprobadores` @ 880ddc1 (stacked; that branch is not merged to main yet).
- T1 (delegated writer): `PLAZO_APROBACION_MINUTOS` removed; new `ventanaAprobacionDesde`/`fueraDeVentanaAprobacion`; `exigirPlazoParaDecidir` blocks before the window opens and after it closes (same audit action); estado adds `abre`/`fueraDeVentana`; metrics `fueraDePlazo` = decision outside window; reports prefilter `completedAt not null`; texts updated. RED observed on pure tests (32 failing); integration tests rewritten after implementation (not observed RED). `supervisor-actions.test.ts` now freezes Date at 6:30 a. m. Bogota.
- Checks: `npm test` 86 files / 1132 green (parent re-run), `tsc --noEmit` clean, `npm run lint` clean (writer). NOT browser-verified.
- ~520 additions / 190 deletions (mostly tests), single coherent rule change.
- RDD: not run (review mode not assessed in this session).

## Next step
User visual check as approver in/out of window; push/PR (user decision).
