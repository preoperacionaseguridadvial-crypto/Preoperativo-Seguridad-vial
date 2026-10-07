import { prisma } from "@/lib/prisma";
import { TipoFirma } from "@/generated/prisma/client";
import type { Prisma } from "@/generated/prisma/client";

// Cliente de Prisma o transacción: la anulación debe poder ir dentro de la
// misma transacción que el cambio de datos que la provoca.
type Cliente = Prisma.TransactionClient | typeof prisma;

/**
 * Anula la firma del conductor de una inspección EN_PROCESO cuando el
 * trabajador corrige un dato después de haber firmado (feature
 * correccion-respuestas-inspeccion). La firma es el acto final sobre lo que se
 * ve en la pantalla de confirmar: si los datos cambian, la firma anterior ya no
 * corresponde a lo que se enviaría, así que se elimina (el trabajador vuelve a
 * firmar en `/confirmar`) y queda registrado en la auditoría, con el motivo.
 * Una inspección ya enviada nunca llega acá: las acciones que la usan exigen
 * EN_PROCESO. El objeto en S3 no se borra; la nueva firma sobrescribe la misma
 * key (`firmas/<id>/CONDUCTOR.png`).
 *
 * @returns `true` si había una firma y se anuló.
 */
export async function invalidarFirmaConductor(
  inspectionId: string,
  userId: string,
  motivo: string,
  cliente: Cliente = prisma,
): Promise<boolean> {
  const { count } = await cliente.firma.deleteMany({
    where: { inspectionId, tipo: TipoFirma.CONDUCTOR },
  });
  if (count === 0) return false;

  await cliente.auditLog.create({
    data: {
      userId,
      action: "INVALIDAR_FIRMA_CONDUCTOR",
      entityType: "Inspection",
      entityId: inspectionId,
      metadata: { motivo },
    },
  });
  return true;
}
