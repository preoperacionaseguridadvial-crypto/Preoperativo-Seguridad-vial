"use server";

import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/requireRole";
import { Role, InspectionStatus } from "@/generated/prisma/client";

// Server actions de la revisión del SUPERVISOR (Fase 3). Decisión de negocio
// ya tomada: cualquier Supervisor puede ver y decidir sobre cualquier
// inspección pendiente — no hay asignación trabajador→supervisor.
//
// Reglas heredadas que se respetan acá: los timestamps oficiales
// (`approvedAt`/`rejectedAt`/`reviewedAt`) siempre se generan con `new
// Date()` del servidor, nunca se reciben del cliente; una inspección ya
// decidida (`reviewedAt` no nulo) es inmutable — no se puede volver a
// decidir; toda decisión se audita vía `logAudit`.

/**
 * Valida que la inspección exista, esté en un estado revisable
 * (PENDIENTE_APROBACION o NO_APTA_PARA_OPERAR) y que todavía no haya sido
 * decidida (`reviewedAt` nulo). La firma del supervisor ya NO es requisito
 * previo para decidir — pasó a ser un paso posterior (ver
 * `guardarFirmaSupervisor` en lib/inspections/firma-actions.ts, que ahora
 * exige lo inverso: que la inspección YA esté decidida). Cualquier
 * Supervisor puede decidir sobre cualquier inspección en ese estado — no
 * hay asignación por trabajador.
 */
async function getInspeccionRevisable(inspectionId: string) {
  const inspection = await prisma.inspection.findUnique({ where: { id: inspectionId } });

  if (!inspection) {
    throw new Error("Inspección no encontrada.");
  }
  if (
    inspection.status !== InspectionStatus.PENDIENTE_APROBACION &&
    inspection.status !== InspectionStatus.NO_APTA_PARA_OPERAR
  ) {
    throw new Error("Esta inspección no está en un estado que admita revisión.");
  }
  if (inspection.reviewedAt !== null) {
    throw new Error("Esta inspección ya fue revisada: no se puede volver a decidir.");
  }

  return inspection;
}

/**
 * Aprueba una inspección pendiente. La observación es opcional.
 */
export async function aprobarInspeccion(inspectionId: string, observacion?: string) {
  const session = await requireRole([Role.SUPERVISOR]);
  await getInspeccionRevisable(inspectionId);

  const observacionLimpia = observacion?.trim() || null;
  const now = new Date();

  const updated = await prisma.inspection.update({
    where: { id: inspectionId },
    data: {
      status: InspectionStatus.APROBADA,
      approvedAt: now,
      reviewedAt: now,
      supervisorId: session.user.id,
      observacionesSupervisor: observacionLimpia,
    },
  });

  await logAudit({
    userId: session.user.id,
    action: "APROBAR_INSPECCION",
    entityType: "Inspection",
    entityId: inspectionId,
    metadata: { observacion: observacionLimpia },
  });

  return updated;
}

/**
 * Rechaza una inspección pendiente. La observación es obligatoria (debe
 * quedar registrado por qué se rechazó).
 */
export async function rechazarInspeccion(inspectionId: string, observacion: string) {
  const session = await requireRole([Role.SUPERVISOR]);
  await getInspeccionRevisable(inspectionId);

  const observacionLimpia = observacion?.trim() || "";
  if (!observacionLimpia) {
    throw new Error("La observación es obligatoria para rechazar una inspección.");
  }

  const now = new Date();

  const updated = await prisma.inspection.update({
    where: { id: inspectionId },
    data: {
      status: InspectionStatus.RECHAZADA,
      rejectedAt: now,
      reviewedAt: now,
      supervisorId: session.user.id,
      observacionesSupervisor: observacionLimpia,
    },
  });

  await logAudit({
    userId: session.user.id,
    action: "RECHAZAR_INSPECCION",
    entityType: "Inspection",
    entityId: inspectionId,
    metadata: { observacion: observacionLimpia },
  });

  return updated;
}
