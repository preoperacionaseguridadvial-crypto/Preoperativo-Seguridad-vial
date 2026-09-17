import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

interface LogAuditParams {
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Prisma.InputJsonValue;
}

/**
 * Registra una entrada de auditoría (quién, qué acción, cuándo, sobre qué
 * entidad). `createdAt` usa el default `now()` de la base de datos definido
 * en el schema de Prisma — nunca se recibe ni se confía en un timestamp
 * enviado por el cliente.
 */
export async function logAudit({
  userId,
  action,
  entityType,
  entityId,
  metadata,
}: LogAuditParams) {
  return prisma.auditLog.create({
    data: {
      userId,
      action,
      entityType,
      entityId,
      metadata,
    },
  });
}
