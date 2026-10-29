# Eliminar inspecciones (solo Administrador)

## Objetivo
Permitir que el rol ADMINISTRADOR (y solo él) elimine definitivamente una inspección, en cualquier estado, para depurar inspecciones de prueba.

## Problema / por qué
Hay inspecciones de prueba que deben desaparecer del registro. Hoy la regla es la inmutabilidad (nunca se borra). El borrado es irreversible, por eso queda restringido a un único rol y deja rastro en la auditoría.

## Alcance
- Helper `puedeEliminarInspecciones(rol)` en `lib/auth/permisos.ts` (solo ADMINISTRADOR).
- Server action `eliminarInspeccion(id)`: `requireRole([ADMINISTRADOR])`; en una transacción borra Photo → Novedad → InspectionItemResponse → Firma → FotoInspeccion → Inspection; `logAudit` `ELIMINAR_INSPECCION` con metadata (placa, estado, trabajador, fecha); después del commit borra los objetos de almacenamiento (best-effort); `revalidatePath` + `redirect("/consulta-inspecciones")`.
- Botón con confirmación en dos pasos en el detalle `app/(gestion)/consulta-inspecciones/[id]/page.tsx`, visible solo para ADMINISTRADOR.
- Actualizar el comentario de inmutabilidad en `prisma/schema.prisma` (sin migración).

## Decisiones del usuario
- Cualquier estado, incluidas APROBADAS (2026-10-28).
- Solo ADMINISTRADOR; SST y demás roles no.

## Restricciones
- TDD estricto (vitest, `npm test`, BD de test localhost:5433). Sin cambios de esquema.
- UI y textos en español neutro (usted).

## Tareas
- [x] T1 — Permiso + action + botón + tests (ruta: delegado, 2+ archivos no triviales). Evidencia: RED observado (función inexistente), GREEN 13/13; npm test 1258 verde; tsc y lint limpios.

## Criterios de aceptación
- ADMINISTRADOR elimina una inspección con todos sus dependientes; queda AuditLog.
- SST, SUPERVISOR, SUPERVISOR_OLEARIARI, TRABAJADOR y DIRECTOR reciben Forbidden y no se borra nada.
- Un fallo al borrar objetos del almacenamiento no revierte ni rompe el borrado.
- El botón solo se renderiza para ADMINISTRADOR.

## Checks
`npm test`, `npx tsc --noEmit`, `npm run lint`.

## Progreso
- Rama `feat/eliminar-inspecciones` desde main @ 45fce75.
