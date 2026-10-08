-- CreateEnum
CREATE TYPE "Sede" AS ENUM ('BOGOTA', 'OLARIARI');

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'SUPERVISOR_OLARIARI';

-- AlterEnum
ALTER TYPE "TipoFirma" ADD VALUE 'SUPERVISOR_OLARIARI';

-- AlterTable
ALTER TABLE "Inspection" ADD COLUMN     "observacionesSupervisorOlariari" TEXT,
ADD COLUMN     "revisadaSupervisorOlariariAt" TIMESTAMP(3),
ADD COLUMN     "sede" "Sede",
ADD COLUMN     "supervisorOlariariId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "sede" "Sede";

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_supervisorOlariariId_fkey" FOREIGN KEY ("supervisorOlariariId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill (mismo migration, para que el flujo de hoy no cambie): todos los
-- TRABAJADOR existentes y todas las inspecciones existentes son de Bogota.
-- Los demas roles quedan con sede NULL. Ojo: los valores nuevos de "Role" /
-- "TipoFirma" no se usan en esta transaccion (Postgres no lo permite).
UPDATE "User" SET "sede" = 'BOGOTA' WHERE "role" = 'TRABAJADOR';
UPDATE "Inspection" SET "sede" = 'BOGOTA';
