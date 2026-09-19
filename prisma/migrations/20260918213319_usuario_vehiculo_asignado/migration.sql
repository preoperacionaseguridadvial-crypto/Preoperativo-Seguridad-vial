-- AlterTable
ALTER TABLE "User" ADD COLUMN     "vehicleId" TEXT;

-- CreateIndex
CREATE INDEX "User_vehicleId_idx" ON "User"("vehicleId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
