-- CreateEnum
CREATE TYPE "TipoHabilitacion" AS ENUM ('RECORREDOR', 'APROBACION');

-- AlterTable
ALTER TABLE "Inspection" ADD COLUMN     "enviadaFueraDeHorario" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "habilitacionId" TEXT;

-- CreateTable
CREATE TABLE "HabilitacionHorario" (
    "id" TEXT NOT NULL,
    "tipo" "TipoHabilitacion" NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "desde" TIMESTAMP(3) NOT NULL,
    "hasta" TIMESTAMP(3) NOT NULL,
    "justificacion" TEXT NOT NULL,
    "otorgadaPorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HabilitacionHorario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HabilitacionHorario_usuarioId_tipo_desde_idx" ON "HabilitacionHorario"("usuarioId", "tipo", "desde");

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_habilitacionId_fkey" FOREIGN KEY ("habilitacionId") REFERENCES "HabilitacionHorario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HabilitacionHorario" ADD CONSTRAINT "HabilitacionHorario_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HabilitacionHorario" ADD CONSTRAINT "HabilitacionHorario_otorgadaPorId_fkey" FOREIGN KEY ("otorgadaPorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
