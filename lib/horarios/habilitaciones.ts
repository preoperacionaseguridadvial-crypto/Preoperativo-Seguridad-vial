import "server-only";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { TipoHabilitacion } from "@/generated/prisma/client";
import { ventanaActual, type Ventana } from "@/lib/horarios/ventanas";

// Control de horario del recorredor en el servidor (regla de producto
// 2026-10-20): iniciar exige ventana abierta; continuar y enviar exigen haber
// iniciado en la ventana que sigue abierta. Una habilitación RECORREDOR vigente
// de SST salta ambas reglas.

export const MENSAJE_INICIO_FUERA_DE_HORARIO =
  "Fuera del horario de inspección (5:45 a 6:30 a. m. y 5:45 a 6:30 p. m.). Comuníquese con la Administradora SST para que lo habilite.";

export const MENSAJE_CONTINUAR_FUERA_DE_HORARIO =
  "Superó el horario para realizar la inspección. Comuníquese con la Administradora SST para que la habilite y pueda enviarla fuera de horario.";

/** Una inspección sigue en horario si empezó en la ventana abierta ahora. */
export function iniciadaEnLaVentana(ventana: Ventana | null, startedAt: Date): boolean {
  return ventana !== null && startedAt >= ventana.inicio;
}

/** Habilitación vigente (`desde` incluido, `hasta` excluido) del usuario. */
export function habilitacionVigente(usuarioId: string, tipo: TipoHabilitacion, ahora: Date) {
  return prisma.habilitacionHorario.findFirst({
    where: { usuarioId, tipo, desde: { lte: ahora }, hasta: { gt: ahora } },
    orderBy: { hasta: "desc" },
  });
}

async function bloquear(params: {
  userId: string;
  entityType: "User" | "Inspection";
  entityId: string;
  accion: string;
  mensaje: string;
}): Promise<never> {
  const { userId, entityType, entityId, accion, mensaje } = params;
  await logAudit({
    userId,
    action: "INSPECCION_FUERA_DE_HORARIO_BLOQUEADA",
    entityType,
    entityId,
    metadata: { accion },
  });
  throw new Error(mensaje);
}

/** Exige ventana abierta o habilitación vigente para iniciar una inspección. */
export async function exigirHorarioParaIniciar(trabajadorId: string, accion: string, ahora: Date) {
  if (ventanaActual(ahora) !== null) return;
  if (await habilitacionVigente(trabajadorId, TipoHabilitacion.RECORREDOR, ahora)) return;
  await bloquear({
    userId: trabajadorId,
    entityType: "User",
    entityId: trabajadorId,
    accion,
    mensaje: MENSAJE_INICIO_FUERA_DE_HORARIO,
  });
}

/**
 * Exige ventana abierta (cualquiera) o habilitación vigente para descartar una
 * inspección en proceso. A diferencia de continuar, no importa en qué ventana
 * se inició: descartarla no agrega datos a la inspección.
 */
export async function exigirHorarioParaCancelar(
  inspection: { id: string; workerId: string },
  accion: string,
  ahora: Date,
) {
  if (ventanaActual(ahora) !== null) return;
  if (await habilitacionVigente(inspection.workerId, TipoHabilitacion.RECORREDOR, ahora)) return;
  await bloquear({
    userId: inspection.workerId,
    entityType: "Inspection",
    entityId: inspection.id,
    accion,
    mensaje: MENSAJE_INICIO_FUERA_DE_HORARIO,
  });
}

/**
 * Exige que la inspección siga en horario (iniciada en la ventana abierta) o
 * que el trabajador tenga una habilitación vigente. Devuelve el id de la
 * habilitación solo cuando fue ella la que permitió la acción.
 */
export async function exigirHorarioParaContinuar(
  inspection: { id: string; workerId: string; startedAt: Date },
  accion: string,
  ahora: Date,
): Promise<{ habilitacionId: string | null }> {
  if (iniciadaEnLaVentana(ventanaActual(ahora), inspection.startedAt)) {
    return { habilitacionId: null };
  }
  const habilitacion = await habilitacionVigente(inspection.workerId, TipoHabilitacion.RECORREDOR, ahora);
  if (habilitacion) return { habilitacionId: habilitacion.id };
  return bloquear({
    userId: inspection.workerId,
    entityType: "Inspection",
    entityId: inspection.id,
    accion,
    mensaje: MENSAJE_CONTINUAR_FUERA_DE_HORARIO,
  });
}
