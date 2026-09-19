-- DropIndex
DROP INDEX "User_vehicleId_idx";

-- CreateIndex
CREATE UNIQUE INDEX "User_vehicleId_key" ON "User"("vehicleId");
