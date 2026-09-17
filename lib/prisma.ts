import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Singleton de PrismaClient. En desarrollo, Next.js recarga módulos en cada
// cambio (HMR), lo que crearía una nueva conexión por recarga si no se
// reutiliza la instancia guardada en `globalThis`.
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

// Prisma 7 requiere un driver adapter explícito (ya no lee DATABASE_URL
// implícitamente desde el schema). Ver https://pris.ly/d/driver-adapters.
function createPrismaClient() {
  const adapter = new PrismaPg(process.env.DATABASE_URL ?? "");
  return new PrismaClient({ adapter });
}

export const prisma: PrismaClient = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
