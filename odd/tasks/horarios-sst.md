# Feature: horarios-sst

## Objective

Enforce inspection time windows for workers, a 60-minute decision deadline per
approval stage, an SST module to grant justified out-of-hours exceptions, and
metrics about schedule compliance.

## Problem

Today a worker can inspect at any time and approvers can decide at any time. The
client requires fixed inspection windows, a strict decision deadline, and a
controlled, audited exception path owned by the SST administrator.

## Product rules (owner decisions, 2026-10-20)

- Worker windows (America/Bogota): 05:45–06:30 (turn 1) and 17:45–18:30 (turn 2).
  Proposed boundaries: start inclusive, end exclusive.
- The worker must start AND submit inside the window. If the window closes mid
  inspection, the worker cannot continue nor submit until SST grants an exception.
- When the window closes while the worker is inspecting, a banner appears
  automatically at the top (no reload): "Superó el horario de las 6:30 para realizar
  la inspección. Comuníquese con la Administradora SST para que la habilite y pueda
  enviarla fuera de horario." (6:30 pm wording for turn 2.)
- Worker exception (SST): worker + date + time range + justification. Inside the
  range the worker can start, continue and submit. Daily windows are unchanged.
- An inspection submitted under a worker exception is flagged; the approver sees an
  in-app alert (queue + detail): "Enviada fuera de horario, pendiente de revisión.
  Tiene 60 minutos para aprobar o rechazar." No push notifications (possible
  future delivery 5).
- Decision deadline: 60 minutes per stage. Bogota / single stage: from submission.
  Oleariari: Supervisor Oleariari has 60 min from submission; the final approver
  has 60 min from the Supervisor Oleariari approval.
- After the deadline the inspection stays in the queue with: "Comuníquese con la
  Administradora de SST para habilitar la aprobación ya que se superó el tiempo
  límite." Approve and reject are blocked server-side.
- Approval exception (SST): approver + date + time range + justification. Inside
  the range that approver can decide all of their expired inspections.
- Every exception is audited (`logAudit`).
- Metrics (dashboard + Excel, filtered by date range and sede):
  1. Out-of-hours per worker: submissions under exception and blocked attempts.
  2. Average inspection duration per worker (start → submit).
  3. Average approver response time per stage and approver.
  4. Expired approvals (>60 min) per approver.
  5. Full list of SST exceptions (who, granted by, when, justification).

## Scope

Windows + worker enforcement + banner, 60-minute deadline, SST exceptions module,
metrics. Out of scope: push notifications, changing existing approval rules.

## Constraints

- TDD: enabled (source: user global config "Strict TDD Mode: enabled"). Runner:
  `npm test` (Vitest against Postgres test DB on port 5433). RED observed first.
- Vitest runs `**/*.test.ts` in node: no component tests; time via
  `vi.useFakeTimers` + `vi.setSystemTime`.
- Next.js with breaking changes: read `node_modules/next/dist/docs/` first.
- Timezone helpers in `lib/fechas/formato.ts` (`ZONA_COLOMBIA`).
- UI copy in neutral Spanish, matching the app.
- Server-side enforcement in every server action (`requireRole` is the real gate).
- Delivery: branch `feat/horarios-sst` (stacked on `fix/fluidos-sin-malo`),
  one work-unit commit per task; push/merge are the owner's decision.
- Checks per task: `npx tsc --noEmit`, `npx eslint app lib`, `npm test`.

## Tasks

- [x] T1 — Pure window domain (`lib/horarios/`): current window, closing time,
  is-inside-window, tests with fixed Bogota times. Route: inline (1–2 files).
- [x] T2 — Schema: exception model (type WORKER | APPROVAL, beneficiary, from, to,
  justification, grantedBy) + inspection out-of-hours flag; migration (dev + test).
- [x] T3 — Worker enforcement in start / save-progress / submit actions, honoring
  active exceptions; flag inspection when submitted under exception. Route:
  delegated (4+ files).
- [x] T4 — Auto banner in the worker inspection flow when the window closes.
- [x] T5 — 60-minute deadline domain per stage + enforcement in approve/reject,
  honoring active approval exceptions.
- [x] T6 — Approver UI: expired message, out-of-hours alert in queue and detail.
- [x] T7 — SST module: grant worker / approver exceptions with justification,
  list them, audit. Route via `/admin` + SST shortcut.
- [ ] T8 — Metrics queries + dashboard + Excel.

## Acceptance criteria

- Outside a window (and without exception) a worker cannot start, save nor submit.
- Banner appears automatically when the window closes during an inspection.
- Approve/reject fail after 60 min of the stage unless an approval exception is
  active for that approver now.
- SST can grant both exception types; each grant is audited.
- The 5 metrics are visible and exportable.

## Progress

- Branch `feat/horarios-sst` created from `7a1808c`.
- T1 done: commit `fa0eac7`. Checks: tsc OK, eslint OK, npm test 61 files / 834 tests green. RED observed (missing module) before GREEN.
- T2 done: model HabilitacionHorario + Inspection.enviadaFueraDeHorario/habilitacionId, migration 20261020145546_horarios_sst (dev + test). Checks: tsc, eslint, npm test 834 green. No RED (schema-only; behavior tests in T3).
- T3 done (delegated writer, trigger: 4+ files): guards in iniciarInspeccion, registrarKilometraje, responderItem, registrarResultado, registrarRespuestaEstadoConductor, subirFotoNovedad, guardarFirmaConductor, subirFotoInspeccion, enviarInspeccion; blocked attempts audited as INSPECCION_FUERA_DE_HORARIO_BLOQUEADA. cancelarInspeccion guarded too (owner 2026-10-20): any open window or habilitación. RED observed (8/9 new integration tests failing). Checks: tsc, eslint, npm test 63 files / 853 green (parent spot check reran all).
- T3b (owner option B, 2026-10-20): pending EN_PROCESO resumed only within the same turn (`esReutilizable` = startedAt >= `inicioUltimaVentana`); 24h reuse rule removed; other-turn pending auto-cancelled and replaced. Delegated writer (trigger: 2+ non-trivial files). RED observed (15 failing). Checks: tsc, eslint, npm test 865 green (parent spot check).
- T4 done (delegated writer): `cierreDelAviso` (lib/horarios/aviso-cierre.ts) + `[id]/layout.tsx` + client `AvisoCierreHorario` (server-computed ms remaining, setTimeout, hidden on /enviada). RED observed (missing module). Checks: tsc, eslint, npm test 871 green (parent spot check). NOT verified in a browser (none available). Known limit: if SST grants a habilitación while the banner is visible, it stays until reload.
- T5 done (delegated writer): `lib/horarios/plazo-aprobacion.ts` (pure, 60 min, deadline instant counts as expired) + `exigirPlazoParaDecidir` in approve/reject, audit APROBACION_FUERA_DE_PLAZO_BLOQUEADA, metadata fueraDePlazo/habilitacionId when unlocked. RED observed for integration tests (9 failing); pure module tests written with implementation (no separate RED). Checks: tsc, eslint, npm test 891 green (parent spot check). Note: inspections already pending >60 min get blocked on deploy.
- T6 done (delegated writer): `estadoPlazoParaAprobador` (pure) + queue card (deadline, expired chip, out-of-hours alert) + detail (alert, deadline, SST notice replacing forms, "Habilitado por SST hasta"). RED observed (missing module). Checks: tsc, eslint, npm test 900 green (parent spot check). NOT browser-verified.
- T7 done (delegated writer): `otorgarHabilitacion` (SST only, justification >= 10 chars, hasta > desde, hasta > now, beneficiary active with matching role), audit OTORGAR_HABILITACION_HORARIO; page /admin/habilitaciones + SST shortcut. RED observed. Checks: tsc, eslint, npm test 931 green (parent spot check). NOT browser-verified. Pending owner decision: should ADMINISTRADOR also grant?
- Delivery forecast: well above 400 authored lines; owner practice is direct
  merge of the branch, commits per task.

## Next step

T8.
