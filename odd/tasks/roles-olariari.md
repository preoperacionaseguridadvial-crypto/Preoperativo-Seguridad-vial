# Feature: roles-olariari

## Objective
Align the app's roles with ESS's real job titles and add the two-stage approval flow for the Olariari site.

## Problem / Why
User (2026-10-07): the project will be presented to ESS, and the role names must match their positions so nobody gets confused. Recorredores (field workers) from Olariari, a city other than Bogotá, need their inspection approved first by a site supervisor and then by the Director de Operaciones. Bogotá recorredores keep the current single-approval flow.

## Decisions (approved by user: "veo este plan perfecto, empecemos a ejecutarlo")
- **Rename = display labels only.** Internal enum codes stay (`SST`, `SUPERVISOR`, `TRABAJADOR`, `DIRECTOR`, `ADMINISTRADOR`): no data migration and no permission changes. Labels:
  - `SST` → "Administrador SST"
  - `SUPERVISOR` → "Director de Operaciones"
  - `TRABAJADOR` → "Recorredor", shown with its site: "Recorredor Bogotá" / "Recorredor Olariari"
  - `DIRECTOR` → "Director" (UNCHANGED; the user did not answer whether to rename it, so we took the conservative default. One-line change later.)
  - `ADMINISTRADOR` → "Administrador" (unchanged)
  - NEW role code `SUPERVISOR_OLARIARI` → "Supervisor Olariari"
- **Spelling:** "Olariari" everywhere. The user also wrote "Oleariari" once, so keep the display string in ONE constant so it can be changed in one place.
- **Site (sede):** new enum `Sede { BOGOTA OLARIARI }`.
  - `User.sede Sede?`: nullable at the schema level (D4 rule), but required by the server action when role = TRABAJADOR. The migration backfills existing TRABAJADOR users to BOGOTA, so today's flow is unchanged.
  - `Inspection.sede Sede?`: a snapshot of the worker's site, taken when the inspection is created, so a later site change doesn't reroute inspections already in flight. The migration backfills existing inspections to BOGOTA.
- **Two-stage flow without new statuses.** Keep `InspectionStatus` as is (PENDIENTE_APROBACION and NO_APTA_PARA_OPERAR keep their meaning) and add stage fields on `Inspection`: `supervisorOlariariId String?` (relation to User), `revisadaSupervisorOlariariAt DateTime?`, `observacionesSupervisorOlariari String?`.
  - **Pending for SUPERVISOR_OLARIARI:** sede = OLARIARI, reviewedAt null, revisadaSupervisorOlariariAt null, status in (PENDIENTE_APROBACION, NO_APTA_PARA_OPERAR).
  - **Pending for SUPERVISOR (Director de Operaciones):** reviewedAt null, status in (PENDIENTE_APROBACION, NO_APTA_PARA_OPERAR), AND (sede = BOGOTA OR (sede = OLARIARI AND revisadaSupervisorOlariariAt not null)).
  - **Supervisor Olariari approves:** sets revisadaSupervisorOlariariAt, supervisorOlariariId and observations. The status is unchanged, and the inspection moves to the Director's queue.
  - **Supervisor Olariari rejects:** status RECHAZADA, plus reviewedAt / rejectedAt and the stage fields. The inspection is CLOSED and never reaches the Director.
  - **Director approves or rejects:** exactly as today.
  - The "confirm before approving with novedades" dialog (`motivosConfirmacionAprobacion`) applies to both approvers.
- **Signatures:** add `SUPERVISOR_OLARIARI` to `TipoFirma`. Each approver signs right after deciding (same decide → /firma pattern as today). Olariari inspections end up with 3 signatures (conductor, Supervisor Olariari, Director de Operaciones). Bogotá inspections keep 2.
- **Routes:** `/aprobaciones` and `/consulta-inspecciones` are also open to SUPERVISOR_OLARIARI (in `lib/auth/route-roles.ts`). Each list is filtered by role per the rules above, and the server actions re-check them; the UI is never the only gate. The SUPERVISOR_OLARIARI home works like the supervisor home (pending cards), filtered to its queue.
- **Admin user form:** SST and ADMINISTRADOR can create SUPERVISOR_OLARIARI users. When role = TRABAJADOR, sede (Bogotá/Olariari) is required. Role options are shown with the new labels.
- **PDF FO-SVS-23:** Olariari inspections show 3 signature boxes (Conductor, Supervisor Olariari, Director de Operaciones). Bogotá inspections show 2, with the supervisor box labeled "Director de Operaciones".
- **Seed and dev data:** passwords stay `Cambiar123!`. Emails are aligned with the job titles. Existing dev users are renamed in place, so their data is kept:
  - trabajador@ → recorredor.bogota@
  - supervisor@ → director.operaciones@
  - sst@ → admin.sst@
  - director@ stays
  - New users: recorredor.olariari@ (with its own vehicle) and supervisor.olariari@

## Constraints
- Next.js 16 (read `node_modules/next/dist/docs/`), Prisma 7 (`provider = "prisma-client"`). Every migration must be applied to BOTH databases:
  - dev: `npx prisma migrate dev --name X`
  - test: `DATABASE_URL="postgresql://preop:preop@localhost:5433/preoperacional_test" npx prisma migrate deploy`
- Strict TDD, runner `npx vitest run`. RDD off.
- Spanish UI copy and comments, matching the existing code. Mobile-first.
- `.env` / `.env.example` are unreadable (the user's deny rule).
- A production server owned by the parent runs on port 3000. Writers must not build, start or kill servers.

## Tasks
- [x] T1 — Central role-label helper (one source of truth) + apply the new labels across the UI (route: delegated writer)
- [x] T2 — Schema + migration (Role SUPERVISOR_OLARIARI, Sede, User.sede, Inspection.sede + Olariari stage fields, TipoFirma SUPERVISOR_OLARIARI, backfills) on both DBs + route-roles (route: delegated writer)
- [ ] T3 — Admin user create/edit: sede required for Recorredor, new role selectable, label display (route: delegated writer)
- [ ] T4 — Workflow: sede snapshot, role-filtered queues, Supervisor Olariari approve/reject/sign, Director stage 2, home/aprobaciones/consulta displays, worker waiting labels (route: delegated writer)
- [ ] T5 — PDF with 3 signatures for Olariari (route: delegated writer)
- [ ] T6 — Seed + in-place dev email alignment + credentials table (route: delegated writer)

## Acceptance criteria
- A Bogotá recorredor's inspection goes straight to the Director de Operaciones (as today).
- An Olariari recorredor's inspection goes first to the Supervisor Olariari. If approved, it then goes to the Director; if rejected, it is closed and the Director never sees it.
- Each role sees only its own queue, and the server rejects out-of-turn actions.
- The PDF of an approved Olariari inspection has 3 signatures.
- tsc, eslint and npm test pass; the parent verifies live on the production build.

## Checks
TDD: strict / user global config / `npx vitest run`. RDD: off (global).

## Progress / evidence
- T2 (done before T1, so T1's label map is exhaustive from the start): migration `20261008015228_roles_olariari_sede` (enum Sede, Role/TipoFirma SUPERVISOR_OLARIARI, User.sede, Inspection.sede + stage fields, backfill BOGOTA in the same migration). Applied to dev and test DBs. Dev backfill: 4 TRABAJADOR users and 15 inspections -> BOGOTA. RED: `iniciarInspeccion` sede tests failed (Sede undefined in the old client); GREEN after schema + `sede` snapshot in create/replace paths. Route: delegated writer.
- T1: `lib/auth/etiquetas-rol.ts` (etiquetaRol, etiquetaSede, etiquetaUsuario, ROLES_ASIGNABLES, SEDES, NOMBRE_SEDE_OLARIARI); applied to greeting chip (sede via `getDatosInicioTrabajador`), admin list/detail/hoja-de-vida/new-user pages and role selects, created-user screen, copy "Administrador SST". RED: etiquetas-rol.test.ts failed on missing module; sede-in-inicio test failed before the query change. Generic noun copy ("Trabajador" column/field labels in dashboard, approval pages, Excel) left for T4/T5.
- Pre-step: the owner's finished work "confirmacion-aprobar-con-novedades" is committed separately as 5222d55, so this feature starts from a clean base.

## Next step
T1–T3 via delegated writer A; then T4–T6 via delegated writer B.
