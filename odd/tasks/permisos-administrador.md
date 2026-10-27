# Administrator permissions

## Objective
User decision 2026-10-27: ADMINISTRADOR has every SST permission plus managing administrator accounts. SST keeps everything it has today except creating or modifying ADMINISTRADOR accounts. ADMINISTRADOR does NOT get worker (recorredor) or approver flows.

## Problem
- SST can create ADMINISTRADOR users, change roles to/from ADMINISTRADOR, deactivate them and reset their passwords (`lib/admin/user-actions.ts` never checks the target/assigned role; test `user-actions.test.ts:216` encodes SST parity).
- Several features are SST-only and ADMINISTRADOR lacks them: granting habilitaciones (`lib/horarios/habilitacion-actions.ts:40`, `admin/habilitaciones/page.tsx:48`), PDF routes and `lib/inspections/pdf-acceso.ts`, Excel report (`app/api/reportes/excel/route.ts:34`), SST-only UI in consulta, dashboard table, home, shortcuts.

## Scope
- Central helpers (e.g. `tienePermisosSst(role)` = SST or ADMINISTRADOR; `puedeGestionarAdministradores(role)` = ADMINISTRADOR) and use them at every SST-only check.
- User actions: SST cannot create a user with role ADMINISTRADOR, cannot update a user whose current role is ADMINISTRADOR, cannot assign ADMINISTRADOR on update, cannot reset an ADMINISTRADOR password. ADMINISTRADOR can do all of it.
- UI: role selector hides ADMINISTRADOR for SST; SST cannot open/edit an administrator (read-only or no edit/reset actions).
- Out of scope: inspections/approvals for ADMINISTRADOR; schedule rules.

## Constraints
- No schema changes. Rule by role, not hardcoded email.
- Strict TDD (`npm test`, Vitest + Postgres test DB `preoperacional_test`).
- Do not touch the user's uncommitted `lib/inspections/supervisor-queries*`.
- RDD off (global).

## Tasks
- [x] T1 - Helpers + server-side rules (user actions, habilitaciones, PDF, Excel) with tests. Route: delegated writer.
- [x] T2 - UI parity (selector, edit/reset for admins, SST-only UI, home/shortcuts) + checks + commit. Route: same delegated writer.

## Progress / evidence
- Branch `feat/inicio-aprobadores` (ships together with previous work).
- T1+T2 (delegated writer): lib/auth/permisos.ts (tienePermisosSst, puedeGestionarAdministradores); user-actions exigirGestionDeAdministradores on create/update(current or new role)/reset; ADMINISTRADOR widened on habilitaciones, PDF single+lote, Excel, consulta, dashboard table/quick actions, SST home + shortcuts (+Configuracion). UI: selector hides ADMINISTRADOR for SST; SST sees admin detail read-only. List unchanged. Old test "SST puede crear un ADMINISTRADOR" inverted.
- RED: 4 user-action tests + 5 habilitaciones/pdf-acceso/atajos/acciones-rapidas tests failed first; GREEN all. permisos.test.ts written with impl (no separate RED).
- Checks: npm test 1105/1105, tsc, lint clean (writer); parent spot check lib/admin+lib/auth+habilitacion-actions 152/152, tsc clean. UI not verified live.
- RDD off (global): no review.

## Next step
User visual check as SST and as ADMINISTRADOR; push/PR.
