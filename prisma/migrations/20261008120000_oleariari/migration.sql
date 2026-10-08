-- Correccion ortografica OLARIARI -> OLEARIARI. Solo renombra: ningun dato se
-- borra ni se recrea (RENAME VALUE / RENAME COLUMN / RENAME CONSTRAINT).

-- AlterEnum
ALTER TYPE "Sede" RENAME VALUE 'OLARIARI' TO 'OLEARIARI';

-- AlterEnum
ALTER TYPE "Role" RENAME VALUE 'SUPERVISOR_OLARIARI' TO 'SUPERVISOR_OLEARIARI';

-- AlterEnum
ALTER TYPE "TipoFirma" RENAME VALUE 'SUPERVISOR_OLARIARI' TO 'SUPERVISOR_OLEARIARI';

-- AlterTable
ALTER TABLE "Inspection" RENAME COLUMN "supervisorOlariariId" TO "supervisorOleariariId";
ALTER TABLE "Inspection" RENAME COLUMN "revisadaSupervisorOlariariAt" TO "revisadaSupervisorOleariariAt";
ALTER TABLE "Inspection" RENAME COLUMN "observacionesSupervisorOlariari" TO "observacionesSupervisorOleariari";

-- RenameForeignKey
ALTER TABLE "Inspection" RENAME CONSTRAINT "Inspection_supervisorOlariariId_fkey" TO "Inspection_supervisorOleariariId_fkey";
