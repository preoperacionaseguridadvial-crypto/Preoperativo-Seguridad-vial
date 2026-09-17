/*
  Warnings:

  - Added the required column `conductorId` to the `Inspection` table without a default value. This is not possible if the table is not empty.

  Ajustado a mano: la columna se agrega nullable, se backfillea con
  `workerId` (datos de desarrollo, no hay producción en este ambiente — ver
  prisma/seed.ts) y recién después se marca NOT NULL, para no perder las
  filas existentes.
*/
-- AlterTable
ALTER TABLE "Inspection" ADD COLUMN     "conductorId" TEXT;

-- Backfill: en el flujo actual, quien hace la inspección es siempre el
-- conductor responsable de la unidad (ver iniciarInspeccion en
-- lib/inspections/actions.ts).
UPDATE "Inspection" SET "conductorId" = "workerId" WHERE "conductorId" IS NULL;

-- AlterTable
ALTER TABLE "Inspection" ALTER COLUMN "conductorId" SET NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "conductorActivo" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "fechaVencimientoPase" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Vehicle" ADD COLUMN     "fechaVencimientoTecnicomecanica" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Inspection_conductorId_idx" ON "Inspection"("conductorId");

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_conductorId_fkey" FOREIGN KEY ("conductorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
