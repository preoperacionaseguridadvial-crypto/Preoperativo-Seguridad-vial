# Themed out-of-schedule block screen

## Objective
Replace the generic Next error/404 that recorredores and approvers see when the schedule rule (inspection windows) or the 60-minute approval deadline blocks them, with a themed SST/ESS screen telling them to contact the Administradora SST to get a habilitación. Business rules stay unchanged (user request 2026-10-27).

## Problem
`lib/horarios/habilitaciones.ts` `exigir*` throw `Error` inside server actions. Several worker step pages (checklist, checklist item, novedad, medidas, novedad foto, resultado, no-puede-operar) do not catch it, so production shows Next's generic error screen. No `error.tsx`/`not-found.tsx` exists in `app/`.

## Scope
- Shared themed component (ESS logo, SST look, message, back-home button).
- Worker: `[id]/layout.tsx` renders the block screen for an EN_PROCESO inspection that can no longer be continued (not started in the open window and no RECORREDOR habilitación).
- Worker: starting out of schedule leads to the block screen instead of the inline red banner.
- Approver: `aprobaciones/[id]` and `aprobaciones/[id]/firma` render the block screen when the 60-minute deadline expired and there is no APROBACION habilitación.
- Safety net: `error.tsx` boundaries for the worker inspection segment and the approver segment, showing the same themed screen.
- Real not-found (missing / not owner / other sede) keeps `notFound()`.

## Constraints
- No schema changes; rules and audit logging unchanged.
- Strict TDD for pure/server logic (`npm test`, Vitest + Postgres test DB). Pages have no tests.
- Do not touch the user's uncommitted `lib/inspections/supervisor-queries*` changes.
- RDD: off (global).

## Tasks
- [x] T1 - Non-throwing predicates + themed component + worker/approver gating + error boundaries. Route: delegated writer (2+ non-trivial files).
- [x] T2 - Checks (test, tsc, lint), commit.

## Progress / evidence
- Branch `feat/inicio-aprobadores` (user wants it before pushing).
- T1 (delegated writer): HorarioBloqueadoError (motivo INICIO/CONTINUAR/APROBACION) + puedeIniciarInspeccion/puedeContinuarInspeccion; exigir* reuse them (messages/audit unchanged). PantallaBloqueoHorario + textos-bloqueo; worker [id]/layout gate; /inspecciones/fuera-de-horario for blocked start/cancel; approver detail gate (only the approver whose turn it is, undecided, expired, no habilitación); error.tsx in worker [id] and aprobaciones (Next passes `retry`). Firma page NOT gated: signing has no deadline check and comes after the decision.
- RED: habilitaciones-predicados.test.ts 9/9 failing before; GREEN lib/horarios + horarios-actions 132/132.
- Checks: npm test 1092/1092, tsc clean, lint clean (writer); parent spot check tsc + lib/horarios 112/112. Not verified live (no browser).
- RDD off (global): no review.

## Next step
User visual check of the block screen in a real out-of-schedule case; push/PR together with inicio-aprobadores.
