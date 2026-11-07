# Eliminar usuarios sin historial (solo Administrador)

## Objective
Let ADMINISTRADOR (and only ADMINISTRADOR) permanently delete a user that has no history. A user with history is never deleted: the system refuses and tells the admin to deactivate it (`activo = false`) instead.

## Problem / why
User request 2026-11-07: the same role that deletes inspections must be able to delete created users. Hard constraint from the user: this change must NOT delete any existing information.

## Rule (user decision 2026-11-07)
- "History" = ANY related row: inspections as worker / conductor / supervisor / supervisor Oleariari, audit logs (includes every `LOGIN`), firmas, AppSetting updates, AutorizacionDatos, habilitaciones received or granted. Consequence: in practice only users that never logged in are deletable (e.g. created by mistake).
- Never delete or modify related data. No schema change, no migration, no new cascades.
- The user's assigned vehicle (if any) is kept untouched (only the user row goes; the FK lives on User).
- An admin cannot delete their own account.
- Deletion is logged in AuditLog (`ELIMINAR_USUARIO`, actor = admin, metadata with name/email/role).

## Checks
Strict TDD on (user global config); runner `npm test` (vitest, test DB localhost:5433). Also `npx tsc --noEmit`, `npm run lint`.

## Tasks
- [x] T1 - Permission helper + server action with history check + admin UI button with confirmation + tests. Route: delegated writer (2+ non-trivial files).
- [x] T2 - Parent spot check, commit.

## Delivery
Branch `feat/eliminar-usuarios` stacked on `feat/eliminar-inspecciones` @ 5585945 (not merged to main yet). Strategy: ask-on-risk.

## Progress / evidence
- T1 (delegated writer): `puedeEliminarUsuarios`, `lib/admin/eliminar-usuario-actions.ts` (history check + delete in one transaction, P2003 mapped to refusal, audit `ELIMINAR_USUARIO`), two-step button in `admin/usuarios/[id]`. RED observed (missing helper/module). Writer: `npm test` 93 files / 1275 passed, tsc + lint clean.
- T2 (parent): re-ran permisos + eliminar-usuario tests, 21 passed; `prisma/` untouched.
- Rule relaxed (user decision 2026-11-07): delete user + own audit, received habilitaciones, autorizacion; AppSetting author nulled. Blocks on inspections, firmas, habilitacion linked to an inspection, or habilitaciones granted to other users (parent added this last guard to honor "do not touch other users data"; RED observed, then GREEN 16/16).

## Next step
Single PR to main with all session work (eliminar-inspecciones + eliminar-usuarios + aprobacion-cualquier-franja), then Railway deploy.
