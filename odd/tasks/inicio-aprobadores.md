# Inicio de aprobadores - rediseno

## Objective
Redesign the home `/` for approver roles (SUPERVISOR, SUPERVISOR_OLEARIARI, DIRECTOR — whatever `esRolAprobador` covers) following the user's mockup (2026-10-23).

## Scope
- Greeting "Hola, <nombre completo>" + role chip with icon + date chip with calendar icon.
- Prominent "Cerrar sesión" (`CerrarSesionForm destacado`), like the SST home.
- Decision banner (existing `AvisoDecision`, e.g. "Inspección CDF254F aprobada y firmada.") restyled: green, check icon, close "×".
- "Pendientes por revisar" card: header icon + title + counters (N pendientes, N con novedades, N vencidas); one row per pending inspection: photo thumbnail, yellow plate chip, vehicle type icon + label, worker name, "Enviada hace X · fecha", "Plazo vencido a las … / habilitado hasta …" line, chips (Vencida / Por vencer, N novedades, Prioridad alta), "Revisar inspección" primary button + chevron.
- "Accesos rápidos" with the role's existing shortcuts in the new card style. NO "Historial" card (user: not needed).
- Other roles' homes unchanged.

## Constraints
- Reuse existing queries/ordering (`getPendientesConFoto`, `ordenarPendientesPorAtencion`, `habilitacionAprobacionHasta`, plazo/priority helpers). No schema changes.
- Strict TDD on for pure logic; `npm test`.

## Tasks
- [x] T1 - Approver home redesign. Route: delegated writer.
- [x] T2 - Checks, live check as approver, commit.

## Progress / evidence
- Branch `feat/inicio-aprobadores` from `main` @ ecdeebe (all previous branches merged: #19 inicio-recorredor incl. checklist, #20 consulta).

- 986f8d9: approver home (esRolAprobador = SUPERVISOR "Director de Operaciones" + SUPERVISOR_OLEARIARI); helper lib/inicio/pendientes-aprobador.ts (+test, RED->GREEN 11/11); POR_VENCER_MINUTOS=15 (new threshold, pending user confirmation); AvisoDecision client with dismiss; ResumenSupervisor removed. npm test 1082, tsc/lint clean. Live as temp SUPERVISOR/OLEARIARI/ADMINISTRADOR OK; temp rows cleaned by tag. Not verified: photos, dismiss click, mobile layout.

## Next step
User visual check; push/PR.
