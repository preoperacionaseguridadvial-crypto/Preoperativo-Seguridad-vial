-- AlterTable
ALTER TABLE "Inspection" ADD COLUMN     "condicionesAptas" BOOLEAN,
ADD COLUMN     "consumioAlcohol" BOOLEAN,
ADD COLUMN     "declaracionEstadoAt" TIMESTAMP(3),
ADD COLUMN     "tomaMedicamentos" BOOLEAN;

-- CreateTable
CREATE TABLE "FotoInspeccion" (
    "id" TEXT NOT NULL,
    "inspectionId" TEXT NOT NULL,
    "tipo" "TipoFotoInspeccion" NOT NULL,
    "s3Key" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FotoInspeccion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FotoInspeccion_inspectionId_tipo_key" ON "FotoInspeccion"("inspectionId", "tipo");

-- AddForeignKey
ALTER TABLE "FotoInspeccion" ADD CONSTRAINT "FotoInspeccion_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "Inspection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
