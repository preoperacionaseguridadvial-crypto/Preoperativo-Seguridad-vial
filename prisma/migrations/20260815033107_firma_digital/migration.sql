-- CreateEnum
CREATE TYPE "TipoFirma" AS ENUM ('CONDUCTOR', 'SUPERVISOR');

-- CreateTable
CREATE TABLE "Firma" (
    "id" TEXT NOT NULL,
    "inspectionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tipo" "TipoFirma" NOT NULL,
    "s3Key" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Firma_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Firma_inspectionId_tipo_key" ON "Firma"("inspectionId", "tipo");

-- AddForeignKey
ALTER TABLE "Firma" ADD CONSTRAINT "Firma_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "Inspection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Firma" ADD CONSTRAINT "Firma_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
