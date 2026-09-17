/*
  Warnings:

  - Changed the type of `tipo` on the `Novedad` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "TipoNovedad" AS ENUM ('RAYON', 'RAYON_FUERTE', 'ABOLLADURA', 'GOLPE_FUERTE', 'FALLA', 'DANO', 'FALTANTE');

-- AlterTable
ALTER TABLE "Novedad" ADD COLUMN     "ubicacion" TEXT,
DROP COLUMN "tipo",
ADD COLUMN     "tipo" "TipoNovedad" NOT NULL;
