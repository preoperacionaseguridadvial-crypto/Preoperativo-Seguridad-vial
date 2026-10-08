# Feature: oleariari-y-hora-colombia

## Objective
1. Fix the site name spelling to OLEARIARI everywhere.
2. Make every displayed date and time exact in Colombia time (America/Bogota), independent of the server's timezone.

## Problem / Why
User (2026-10-07):
- "de la palabra es OLEARIARI corrige si hubo algún error ortográfico". The previous feature used "Olariari" (about 497 references).
- "la idea es que registre bien las horas ya que son turnos rotativos y las horas deben ser exactas".

Evidence:
- Timestamps are stored correctly (server `now()`, UTC instants).
- 21 of the 25 `Intl.DateTimeFormat` / `toLocale*` usages set no `timeZone`, so they render in the SERVER's timezone. On a cloud server (usually UTC), every time on screens, PDF and Excel would be off by 5 h.
- The dashboard groups days in UTC, so it flips at 19:00 Bogotá.
- Date-only fields (SOAT / tecnomecánica expiry, stored as UTC midnight) intentionally format with `timeZone: "UTC"`. That is correct; keep it.

## Scope (authorized by user)
- **T1: OLEARIARI rename.** Display strings become "Oleariari" (title case in UI copy; the PDF uses uppercase where the official form does).
  - Internal identifiers are renamed for consistency:
    - enum values via migration: `Sede.OLARIARI` → `OLEARIARI` and `Role.SUPERVISOR_OLARIARI` → `SUPERVISOR_OLEARIARI` (`TipoFirma` too), using Postgres `ALTER TYPE ... RENAME VALUE`, which is data-safe;
    - Prisma fields (`supervisorOlariariId` → `supervisorOleariariId`, etc.) via column rename in the migration;
    - TS identifiers, file names, tests, comments, README and odd docs.
  - Dev data: rename `recorredor.olariari@ess.local` → `recorredor.oleariari@ess.local` and `supervisor.olariari@ess.local` → `supervisor.oleariari@ess.local` in place (ids kept), in the seed, the alignment script and the README. The plate OLA123 stays.
  - Historical, already-merged odd docs (`odd/tasks/roles-olariari.md`) may keep their file name, but add a note that the spelling was corrected.
- **T2: Colombia time everywhere.**
  - One shared formatting module (e.g. `lib/fechas/formato.ts`) with fixed `timeZone: "America/Bogota"` and locale `es-CO`: `formatFechaHora`, `formatHora`, `formatFecha`, and an explicit `formatFechaSoloDia` for date-only UTC-midnight fields.
  - Replace every ad-hoc formatter with it, in screens, PDF (dates, times, signature timestamps), Excel export (date/time cells or strings in Colombia time), dashboard and consulta filters.
  - Dashboard and "today" day boundaries computed in Colombia time. There is already Bogotá-day logic for the home KPIs; reuse or unify it.
  - The `tiempoTranscurrido` relative times are TZ-independent and are left alone.

## Constraints
- Strict TDD, runner `npx vitest run`. Tests must prove TZ independence, e.g. run the formatter with `process.env.TZ` set to `"UTC"` and to another zone, or format a known UTC instant and assert the Bogotá wall-clock string.
- Every migration is applied to BOTH databases (dev via `migrate dev`, test via `migrate deploy` with the test DATABASE_URL).
- Don't touch `.env`, `.atl/*`, `docs/`. A production server owned by the parent runs on port 3000; writers do not build, start or kill servers.
- Spanish UI copy and comments, matching the codebase.

## Tasks
- [x] T1: OLEARIARI rename (enums + columns migration, identifiers, UI copy, PDF, seed, dev data, README) (route: delegated writer)
- [ ] T2: Colombia-time formatting module, applied everywhere, plus dashboard day boundaries in Bogotá (route: delegated writer)

## Acceptance criteria
- `rg -i olariari` finds no matches outside the historical odd doc note and the migration that renames it.
- With the production server started with `TZ=UTC`, screens, PDF and Excel show the same wall-clock times as in Bogotá. The parent verifies this live.
- An inspection sent at 19:30 Bogotá counts as "today" in the dashboard.
- tsc, eslint and npm test pass; migrate status is up to date on both DBs.

## Checks
TDD: strict / user global config / `npx vitest run`. RDD: off.

## Progress / evidence
- T1 (delegated writer, TDD): RED = tests renamed first, 77 failures; GREEN = 50 files / 708 tests. Migration `20261008120000_oleariari` (RENAME VALUE x3, RENAME COLUMN x3, RENAME CONSTRAINT fkey; no drop). Applied to dev and test; `migrate diff` no drift. Dev users renamed in place via `scripts/alinear-usuarios-ess.ts` (ids kept, idempotent). No old audit rows in dev. tsc and eslint clean. Remaining `rg -i olariari`: historical odd doc, old migration, and the rename mapping in `prisma/seed-usuarios.ts` / `scripts/alinear-usuarios-ess.ts`.

## Next step
T1–T2 via one delegated writer on branch `fix/oleariari-y-hora-colombia` (from main ad07219).
