# Feature: confirmacion-aprobar-con-novedades

## Objective

When a supervisor approves an inspection in which the worker reported a problem, a
confirmation dialog must list what was reported and ask for explicit confirmation.
Inspections with nothing reported are approved exactly as today.

## Problem

`aprobarInspeccion` (`lib/inspections/supervisor-actions.ts`) only validates role and
status. The "Aprobar" button in `app/(supervisor)/aprobaciones/[id]/page.tsx` submits
directly. Nothing reminds the supervisor of the reported problems, and the audit log
keeps no trace that the approval happened despite them. Flagged as a gap in
`docs/informe-cumplimiento-pesv.md`.

## Product rule (owner decision, 2026-10-07)

- The supervisor still decides. Nothing is blocked.
- The confirmation applies only to inspections with something reported.
- Triggers (accepted recommendation):
  1. Checklist answers in `FALLA` or `MALO`, and general novedades (no checklist item).
  2. The worker declared `puedeOperar === false`.
  3. Driver declaration needing attention (`tomaMedicamentos === true`,
     `condicionesAptas === false`, `consumioAlcohol === true`).
- `BAJO` (fluids) is NOT a trigger; the app already treats it as a warning.

## Scope

- Pure helper that derives the list of confirmation reasons from an inspection.
- `aprobarInspeccion` rejects an approval with reasons unless confirmation is passed,
  and records the reasons in the audit metadata.
- Client confirmation dialog on the supervisor detail page.

Out of scope: blocking the vehicle, novedad follow-up/closure, schema changes,
changes to rejection, changes to the worker flow.

## Constraints

- TDD: enabled (source: user global config "Strict TDD Mode: enabled"). Runner:
  `npx vitest run`. RED must be observed before implementation.
- Vitest only includes `**/*.test.ts` in a node environment: no component tests.
- Next.js version has breaking changes: read `node_modules/next/dist/docs/` first.
- UI copy in neutral Spanish, matching the existing app.
- Delivery: direct commits to `main` (established practice), only when the owner
  says so. No commit is made by the writer.

## Tasks

- [x] T1 — Helper `motivosConfirmacionAprobacion` + unit tests. Route: delegated
  (writer trigger: 3+ non-trivial files in this feature). Evidence: RED observed
  (module missing), then 10 unit tests green.
- [x] T2 — `aprobarInspeccion` requires confirmation when there are reasons; audit
  metadata records them; integration tests. Route: delegated. Evidence: RED observed
  (4 new tests failing), then green.
- [x] T3 — Client confirmation dialog wired into the supervisor detail page.
  Route: delegated. Implemented (`app/_components/AprobarInspeccionForm.tsx`), but
  NOT exercised in a browser: stays open until the owner tries it.

## Acceptance criteria

- Approving an inspection with no reasons works with no confirmation (unchanged).
- Approving an inspection with reasons and no confirmation fails with a clear
  Spanish message and leaves the inspection unchanged.
- Approving with confirmation succeeds; the `APROBAR_INSPECCION` audit row records
  that it was approved with novedades and which ones.
- The dialog lists each reason and appears only when there are reasons.

## Checks

- `npx vitest run` (requires Docker: `preop-postgres` on 5433)
- `npx tsc --noEmit`
- `npx eslint`

## Forecast

About 250-350 authored changed lines. Delivery strategy: `ask-on-risk`; under budget,
single commit expected.

## Progress

- 2026-10-07: document created.
- 2026-10-07: T1-T3 implemented by one delegated writer, uncommitted. Parent re-ran
  the checks: `npx vitest run` 492 passed (31 files), `npx tsc --noEmit` exit 0,
  `npx eslint` exit 0. Parent fix after readback: list keys in the dialog use the
  index, because two reasons can have identical text.
- Signature: `aprobarInspeccion(inspectionId, observacion?, confirmadoConNovedades = false)`.
  Audit metadata with reasons: `{ observacion, aprobadaConNovedades: true, motivos }`;
  without reasons it is unchanged (`{ observacion }`).
- Accepted change to an existing test: "aprueba igual una inspección con declaración
  preocupante" now asserts the unconfirmed approval is refused and the confirmed one
  succeeds, since the driver declaration is a trigger under the product rule.
- Review: native review unavailable (the `gentle-ai` binary is blocked by a Windows
  Application Control policy). Not reviewed.
- Commit: pending the owner's go-ahead. Authored lines: about 450 added (about 160
  of them tests), about 30 removed.

## Next step

Owner tries the dialog in a browser (open, cancel, Escape, confirm, phone width),
then commit.

- 2026-10-07: owner tested the dialog on a real phone and approved it ("funciona, me gusta"). The dialog was restyled as an alert (red header, ⚠, red per-reason boxes, "⚠ Sí, aprobar con novedades" button, focus stays on Cancelar) at the owner's request. Committed.
