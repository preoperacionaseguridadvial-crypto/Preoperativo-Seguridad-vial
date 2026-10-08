"use server";

import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/requireRole";
import { Role, InspectionStatus } from "@/generated/prisma/client";
import { motivosConfirmacionAprobacion } from "@/lib/inspections/motivos-confirmacion-aprobacion";
import { etapaParaRol, type EtapaAprobacion, type RolAprobador } from "@/lib/inspections/cola-aprobacion";
import { etiquetaRol } from "@/lib/auth/etiquetas-rol";

// Server actions de la revisión de los aprobadores (Fase 3 + roles-olariari).
// Hay dos aprobadores: el Director de Operaciones (rol SUPERVISOR), que decide
// cualquier inspección que le toque, y el Supervisor Olariari, primera etapa de
// las inspecciones de la sede Olariari. La etapa se decide SIEMPRE en el
// servidor, a partir de la sede de la inspección y del rol de la sesión (ver
// lib/inspections/cola-aprobacion.ts): el cliente no elige etapa y una
// decisión fuera de turno se rechaza. No hay asignación trabajador→supervisor.
//
// Reglas heredadas que se respetan acá: los timestamps oficiales
// (`approvedAt`/`rejectedAt`/`reviewedAt`) siempre se generan con `new
// Date()` del servidor, nunca se reciben del cliente; una inspección ya
// decidida (`reviewedAt` no nulo) es inmutable — no se puede volver a
// decidir; toda decisión se audita vía `logAudit`.

const ROLES_APROBADORES: Role[] = [Role.SUPERVISOR, Role.SUPERVISOR_OLARIARI];

/**
 * Valida que la inspección exista, esté en un estado revisable
 * (PENDIENTE_APROBACION o NO_APTA_PARA_OPERAR), que todavía no haya sido
 * decidida (`reviewedAt` nulo) y que LE TOQUE a este rol (etapa). La firma del
 * aprobador no es requisito previo para decidir — es un paso posterior (ver
 * `guardarFirmaSupervisor` en lib/inspections/firma-actions.ts).
 */
async function getInspeccionRevisable(inspectionId: string, role: RolAprobador) {
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

  const etapa = etapaParaRol(role, inspection);
  if (etapa === null) {
    // Distinguimos el caso más común (el Director intentando adelantarse) para
    // dar un mensaje útil; el resto es "no le corresponde".
    if (role === Role.SUPERVISOR) {
      throw new Error(
        `Esta inspección todavía está pendiente del ${etiquetaRol(Role.SUPERVISOR_OLARIARI)}: aún no le corresponde.`,
      );
    }
    throw new Error("Esta inspección no le corresponde a su rol o ya pasó por su etapa.");
  }

  return { inspection, etapa };
}

function rolAprobadorDe(session: { user: { role: Role } }): RolAprobador {
  return session.user.role === Role.SUPERVISOR_OLARIARI ? Role.SUPERVISOR_OLARIARI : Role.SUPERVISOR;
}

/**
 * Aprueba una inspección pendiente. La observación es opcional.
 *
 * Si la inspección tiene algo reportado (ver `motivosConfirmacionAprobacion`)
 * exige `confirmadoConNovedades = true` — el aprobador sigue decidiendo, pero
 * no puede aprobar "a ciegas". Los motivos se recalculan acá desde la base de
 * datos: el flag del cliente es solo un acuse de recibo, nunca la fuente de la
 * lista. Con confirmación, la auditoría guarda que se aprobó con novedades y
 * cuáles eran.
 *
 * Etapa 1 (Supervisor Olariari): no cambia el `status` ni fija `reviewedAt`;
 * solo registra su revisión y la inspección pasa a la cola del Director.
 * Etapa 2 (Director de Operaciones): aprueba de forma definitiva.
 */
export async function aprobarInspeccion(
  inspectionId: string,
  observacion?: string,
  confirmadoConNovedades = false,
) {
  const session = await requireRole(ROLES_APROBADORES);
  const { etapa } = await getInspeccionRevisable(inspectionId, rolAprobadorDe(session));

  const paraConfirmar = await prisma.inspection.findUniqueOrThrow({
    where: { id: inspectionId },
    include: {
      respuestas: { include: { checklistItem: { include: { category: true } } } },
      novedades: true,
    },
  });
  const motivos = motivosConfirmacionAprobacion(paraConfirmar);
  if (motivos.length > 0 && !confirmadoConNovedades) {
    throw new Error(
      "Esta inspección tiene novedades reportadas. Debe confirmar la aprobación para continuar.",
    );
  }

  const observacionLimpia = observacion?.trim() || null;
  const now = new Date();

  const updated = await prisma.inspection.update({
    where: { id: inspectionId },
    data:
      etapa === "OLARIARI"
        ? {
            revisadaSupervisorOlariariAt: now,
            supervisorOlariariId: session.user.id,
            observacionesSupervisorOlariari: observacionLimpia,
          }
        : {
            status: InspectionStatus.APROBADA,
            approvedAt: now,
            reviewedAt: now,
            supervisorId: session.user.id,
            observacionesSupervisor: observacionLimpia,
          },
  });

  await logAudit({
    userId: session.user.id,
    action: accionAuditoria("APROBAR", etapa),
    entityType: "Inspection",
    entityId: inspectionId,
    metadata:
      motivos.length > 0
        ? { observacion: observacionLimpia, aprobadaConNovedades: true, motivos }
        : { observacion: observacionLimpia },
  });

  return updated;
}

/**
 * Rechaza una inspección pendiente. La observación es obligatoria (debe
 * quedar registrado por qué se rechazó). Un rechazo del Supervisor Olariari
 * cierra la inspección: nunca llega al Director.
 */
export async function rechazarInspeccion(inspectionId: string, observacion: string) {
  const session = await requireRole(ROLES_APROBADORES);
  const { etapa } = await getInspeccionRevisable(inspectionId, rolAprobadorDe(session));

  const observacionLimpia = observacion?.trim() || "";
  if (!observacionLimpia) {
    throw new Error("La observación es obligatoria para rechazar una inspección.");
  }

  const now = new Date();

  const updated = await prisma.inspection.update({
    where: { id: inspectionId },
    data:
      etapa === "OLARIARI"
        ? {
            status: InspectionStatus.RECHAZADA,
            rejectedAt: now,
            reviewedAt: now,
            revisadaSupervisorOlariariAt: now,
            supervisorOlariariId: session.user.id,
            observacionesSupervisorOlariari: observacionLimpia,
          }
        : {
            status: InspectionStatus.RECHAZADA,
            rejectedAt: now,
            reviewedAt: now,
            supervisorId: session.user.id,
            observacionesSupervisor: observacionLimpia,
          },
  });

  await logAudit({
    userId: session.user.id,
    action: accionAuditoria("RECHAZAR", etapa),
    entityType: "Inspection",
    entityId: inspectionId,
    metadata: { observacion: observacionLimpia },
  });

  return updated;
}

/** La etapa del Director conserva los nombres históricos; la primera etapa lleva sufijo. */
function accionAuditoria(verbo: "APROBAR" | "RECHAZAR", etapa: EtapaAprobacion) {
  return etapa === "OLARIARI" ? `${verbo}_INSPECCION_SUPERVISOR_OLARIARI` : `${verbo}_INSPECCION`;
}
