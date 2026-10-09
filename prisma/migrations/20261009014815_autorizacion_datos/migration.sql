-- CreateTable
CREATE TABLE "AutorizacionDatos" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "versionPolitica" TEXT NOT NULL,
    "firmaS3Key" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutorizacionDatos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AutorizacionDatos_userId_key" ON "AutorizacionDatos"("userId");

-- AddForeignKey
ALTER TABLE "AutorizacionDatos" ADD CONSTRAINT "AutorizacionDatos_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
