-- A lo sumo UNA inspeccion EN_PROCESO por (trabajador, vehiculo).
--
-- Antes, `iniciarInspeccion` (lib/inspections/actions.ts) hacia un
-- check-then-create sin restriccion en base: dos requests verdaderamente
-- simultaneas podian crear dos filas EN_PROCESO para el mismo trabajador y
-- vehiculo. El indice unico PARCIAL cierra esa carrera a nivel de base de
-- datos; las inspecciones CANCELADA / enviadas / aprobadas / etc. del mismo par
-- no cuentan, pueden ser muchas.
--
-- NOTA: Prisma no puede expresar un indice parcial (`WHERE`) en schema.prisma,
-- por eso este indice existe SOLO en SQL (ver el comentario sobre `Inspection`
-- en prisma/schema.prisma).
--
-- Paso 1: dedupe de datos existentes. Si ya hay pares con mas de una fila
-- EN_PROCESO, CREATE UNIQUE INDEX fallaria. Para cada par (workerId,
-- vehicleId) se conserva la inspeccion con `startedAt` mas reciente (desempate:
-- `id` mas alto) y las demas pasan a CANCELADA. Es el mismo cambio que hace la
-- accion `cancelarInspeccion`: `status = 'CANCELADA'` (mas `updatedAt`, que
-- Prisma rellena por cliente con @updatedAt y en SQL crudo hay que poner a
-- mano). No se borra nada (regla de inmutabilidad del proyecto).
--
-- No se insertan filas en "AuditLog": su `userId` es NOT NULL con FK a User y
-- una migracion no tiene un actor real al que atribuir la cancelacion; inventar
-- uno falsearia la auditoria. El rastro queda en la propia fila (status
-- CANCELADA con `updatedAt` = momento de esta migracion).
UPDATE "Inspection" AS i
SET "status" = 'CANCELADA',
    "updatedAt" = CURRENT_TIMESTAMP
WHERE i."status" = 'EN_PROCESO'
  AND EXISTS (
    SELECT 1
    FROM "Inspection" AS o
    WHERE o."workerId" = i."workerId"
      AND o."vehicleId" = i."vehicleId"
      AND o."status" = 'EN_PROCESO'
      AND o."id" <> i."id"
      AND (o."startedAt", o."id") > (i."startedAt", i."id")
  );

-- Paso 2: el indice unico parcial.
CREATE UNIQUE INDEX "Inspection_workerId_vehicleId_en_proceso_key"
  ON "Inspection" ("workerId", "vehicleId")
  WHERE "status" = 'EN_PROCESO';
