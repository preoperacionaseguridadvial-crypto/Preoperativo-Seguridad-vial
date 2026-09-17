-- CreateEnum
CREATE TYPE "Role" AS ENUM ('TRABAJADOR', 'SUPERVISOR', 'DIRECTOR', 'SST');

-- CreateEnum
CREATE TYPE "InspectionStatus" AS ENUM ('EN_PROCESO', 'ENVIADA', 'PENDIENTE_APROBACION', 'APROBADA', 'RECHAZADA', 'NO_APTA_PARA_OPERAR');

-- CreateEnum
CREATE TYPE "RespuestaChecklist" AS ENUM ('CONFORME', 'NO_CONFORME', 'NO_APLICA');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL,
    "placa" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inspection" (
    "id" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "supervisorId" TEXT,
    "status" "InspectionStatus" NOT NULL DEFAULT 'EN_PROCESO',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "kilometraje" INTEGER,
    "nivelCombustible" TEXT,
    "presionLlantas" TEXT,
    "puedeOperar" BOOLEAN,
    "justificacionNoOperar" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Inspection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistCategory" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "orden" INTEGER NOT NULL,

    CONSTRAINT "ChecklistCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistItem" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "orden" INTEGER NOT NULL,
    "requiereNA" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InspectionItemResponse" (
    "id" TEXT NOT NULL,
    "inspectionId" TEXT NOT NULL,
    "checklistItemId" TEXT NOT NULL,
    "valor" "RespuestaChecklist" NOT NULL,
    "observacion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InspectionItemResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Novedad" (
    "id" TEXT NOT NULL,
    "inspectionId" TEXT NOT NULL,
    "inspectionItemResponseId" TEXT,
    "descripcion" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Novedad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Photo" (
    "id" TEXT NOT NULL,
    "novedadId" TEXT NOT NULL,
    "s3Key" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Photo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_placa_key" ON "Vehicle"("placa");

-- CreateIndex
CREATE INDEX "Inspection_workerId_idx" ON "Inspection"("workerId");

-- CreateIndex
CREATE INDEX "Inspection_vehicleId_idx" ON "Inspection"("vehicleId");

-- CreateIndex
CREATE INDEX "Inspection_status_idx" ON "Inspection"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ChecklistCategory_nombre_key" ON "ChecklistCategory"("nombre");

-- CreateIndex
CREATE INDEX "ChecklistCategory_orden_idx" ON "ChecklistCategory"("orden");

-- CreateIndex
CREATE INDEX "ChecklistItem_categoryId_idx" ON "ChecklistItem"("categoryId");

-- CreateIndex
CREATE INDEX "InspectionItemResponse_inspectionId_idx" ON "InspectionItemResponse"("inspectionId");

-- CreateIndex
CREATE UNIQUE INDEX "InspectionItemResponse_inspectionId_checklistItemId_key" ON "InspectionItemResponse"("inspectionId", "checklistItemId");

-- CreateIndex
CREATE UNIQUE INDEX "Novedad_inspectionItemResponseId_key" ON "Novedad"("inspectionItemResponseId");

-- CreateIndex
CREATE INDEX "Novedad_inspectionId_idx" ON "Novedad"("inspectionId");

-- CreateIndex
CREATE INDEX "Photo_novedadId_idx" ON "Photo"("novedadId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistItem" ADD CONSTRAINT "ChecklistItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ChecklistCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionItemResponse" ADD CONSTRAINT "InspectionItemResponse_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "Inspection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionItemResponse" ADD CONSTRAINT "InspectionItemResponse_checklistItemId_fkey" FOREIGN KEY ("checklistItemId") REFERENCES "ChecklistItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Novedad" ADD CONSTRAINT "Novedad_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "Inspection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Novedad" ADD CONSTRAINT "Novedad_inspectionItemResponseId_fkey" FOREIGN KEY ("inspectionItemResponseId") REFERENCES "InspectionItemResponse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_novedadId_fkey" FOREIGN KEY ("novedadId") REFERENCES "Novedad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
