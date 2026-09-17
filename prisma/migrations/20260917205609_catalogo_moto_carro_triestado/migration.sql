-- AlterTable
ALTER TABLE "ChecklistItem" ADD COLUMN     "tipoRespuesta" "TipoRespuestaItem" NOT NULL DEFAULT 'BINARIO',
ADD COLUMN     "tipoVehiculo" "TipoVehiculo";
