-- Fase A: catálogo real FO-SVS-23 (columna MOTOS).
-- RespuestaChecklist pasa de {CONFORME, NO_CONFORME, NO_APLICA} a {OK, FALLA}
-- (formato oficial binario). Las filas de InspectionItemResponse/Novedad/Photo
-- de prueba local fueron limpiadas antes de esta migración (dev-only, sin
-- datos reales), por lo que el cast de la columna "valor" no tiene filas que
-- convertir.
BEGIN;
CREATE TYPE "RespuestaChecklist_new" AS ENUM ('OK', 'FALLA');
ALTER TABLE "InspectionItemResponse" ALTER COLUMN "valor" TYPE "RespuestaChecklist_new" USING ("valor"::text::"RespuestaChecklist_new");
ALTER TYPE "RespuestaChecklist" RENAME TO "RespuestaChecklist_old";
ALTER TYPE "RespuestaChecklist_new" RENAME TO "RespuestaChecklist";
DROP TYPE "RespuestaChecklist_old";
COMMIT;

-- AlterTable: imagenUrl (una sola imagen) -> imagenesUrl (galería), y se
-- elimina requiereNA (ya no hay N/A) a favor de pideUbicacion (ítem
-- "Rayones", pide "¿Dónde?" siempre).
ALTER TABLE "ChecklistItem" DROP COLUMN "imagenUrl",
DROP COLUMN "requiereNA",
ADD COLUMN     "imagenesUrl" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "pideUbicacion" BOOLEAN NOT NULL DEFAULT false;
