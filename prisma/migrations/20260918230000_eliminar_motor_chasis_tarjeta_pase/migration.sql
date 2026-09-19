-- AlterTable
ALTER TABLE "User" DROP COLUMN "fechaVencimientoPase";

-- AlterTable
ALTER TABLE "Vehicle" DROP COLUMN "fechaVencimientoTarjetaTransito",
DROP COLUMN "numeroChasis",
DROP COLUMN "numeroMotor";
