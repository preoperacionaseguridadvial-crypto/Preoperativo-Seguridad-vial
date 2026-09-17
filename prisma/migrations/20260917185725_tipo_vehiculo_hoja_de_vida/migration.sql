-- CreateEnum
CREATE TYPE "TipoVehiculo" AS ENUM ('MOTO', 'CARRO');

-- CreateEnum
CREATE TYPE "TipoRespuestaItem" AS ENUM ('BINARIO', 'TRIESTADO');

-- CreateEnum
CREATE TYPE "TipoFotoInspeccion" AS ENUM ('LATERAL', 'PLACA');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "RespuestaChecklist" ADD VALUE 'BUENO';
ALTER TYPE "RespuestaChecklist" ADD VALUE 'BAJO';
ALTER TYPE "RespuestaChecklist" ADD VALUE 'MALO';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "puestoAsignado" TEXT,
ADD COLUMN     "tipoVehiculo" "TipoVehiculo";

-- AlterTable
ALTER TABLE "Vehicle" ADD COLUMN     "color" TEXT,
ADD COLUMN     "fechaVencimientoSoat" TIMESTAMP(3),
ADD COLUMN     "fechaVencimientoTarjetaTransito" TIMESTAMP(3),
ADD COLUMN     "fotoS3Key" TEXT,
ADD COLUMN     "marca" TEXT,
ADD COLUMN     "modelo" TEXT,
ADD COLUMN     "numeroChasis" TEXT,
ADD COLUMN     "numeroMotor" TEXT,
ADD COLUMN     "tipoVehiculo" "TipoVehiculo";

-- Backfill: el sistema era exclusivamente de motos antes de este cambio
-- (soporte-moto-carro), así que todo vehículo existente se marca MOTO acá,
-- en la propia migración (no en código de aplicación) para que quede hecho
-- una sola vez y de forma atómica con la migración. Vehículos creados
-- después de este punto llevan el tipo que declare el formulario de alta
-- (crearVehiculo la exige). Es seguro usar el valor 'MOTO' en la misma
-- transacción porque TipoVehiculo se CREA en esta misma migración (no es un
-- ALTER TYPE ... ADD VALUE, que sí tiene la restricción de commit previo).
UPDATE "Vehicle" SET "tipoVehiculo" = 'MOTO' WHERE "tipoVehiculo" IS NULL;
