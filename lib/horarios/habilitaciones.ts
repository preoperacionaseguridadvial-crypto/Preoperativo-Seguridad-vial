import "server-only";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { TipoHabilitacion } from "@/generated/prisma/client";
import { ventanaActual, type Ventana } from "@/lib/horarios/ventanas";
import { fueraDeVentanaAprobacion, type DatosPlazo } from "@/lib/horarios/plazo-aprobacion";

// Control de horario del recorredor en el servidor (regla de producto
// 2026-10-20): iniciar exige ventana abierta; continuar y enviar exigen haber
// iniciado en la ventana que sigue abierta. Una habilitación RECORREDOR vigente
// de SST salta ambas reglas.

export const MENSAJE_INICIO_FUERA_DE_HORARIO =
  "Fuera del horario de inspección (5:45 a 6:30 a. m. y 5:45 a 6:30 p. m.). Comuníquese con la Administradora SST para que lo habilite.";

export const MENSAJE_APROBACION_FUERA_DE_PLAZO =
  "Solo puede aprobar o rechazar entre las 5:45 y las 8:00 a. m. o entre las 5:45 y las 8:00 p. m. Comuníquese con la Administradora de SST para habilitar la aprobación.";

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

/** Fin de la habilitación APROBACION vigente del aprobador, o `null` si no tiene (una consulta por pantalla). */
export async function habilitacionAprobacionHasta(aprobadorId: string, ahora: Date): Promise<Date | null> {
  const habilitacion = await habilitacionVigente(aprobadorId, TipoHabilitacion.APROBACION, ahora);
  return habilitacion?.hasta ?? null;
}

/** Motivo del bloqueo por horario; decide qué mensaje muestra la pantalla de bloqueo. */
export type MotivoBloqueoHorario = "INICIO" | "CONTINUAR" | "APROBACION";

/**
 * Error de negocio por horario. Lleva el mismo mensaje de siempre y un
 * `motivo` tipado para que las pantallas distingan este caso de cualquier otro
 * fallo sin comparar textos.
 */
export class HorarioBloqueadoError extends Error {
  constructor(
    readonly motivo: MotivoBloqueoHorario,
    mensaje: string,
  ) {
    super(mensaje);
    this.name = "HorarioBloqueadoError";
  }
}

async function bloquear(params: {
  userId: string;
  entityType: "User" | "Inspection";
  entityId: string;
  accion: string;
  motivo: "INICIO" | "CONTINUAR";
  mensaje: string;
}): Promise<never> {
  const { userId, entityType, entityId, accion, motivo, mensaje } = params;
  await logAudit({
    userId,
    action: "INSPECCION_FUERA_DE_HORARIO_BLOQUEADA",
    entityType,
    entityId,
    metadata: { accion },
  });
  throw new HorarioBloqueadoError(motivo, mensaje);
}

// Predicados sin efectos (no lanzan ni auditan): la regla vive aquí una sola
// vez y la usan tanto los `exigir*` como las pantallas que muestran el bloqueo.

/** Decide si puede iniciar (o descartar) ahora: ventana abierta o habilitación RECORREDOR vigente. */
export async function puedeIniciarInspeccion(trabajadorId: string, ahora: Date): Promise<boolean> {
  if (ventanaActual(ahora) !== null) return true;
  return (await habilitacionVigente(trabajadorId, TipoHabilitacion.RECORREDOR, ahora)) !== null;
}

async function evaluarContinuar(
  inspection: { workerId: string; startedAt: Date },
  ahora: Date,
): Promise<{ permitido: boolean; habilitacionId: string | null }> {
  if (iniciadaEnLaVentana(ventanaActual(ahora), inspection.startedAt)) {
    return { permitido: true, habilitacionId: null };
  }
  const habilitacion = await habilitacionVigente(inspection.workerId, TipoHabilitacion.RECORREDOR, ahora);
  return { permitido: habilitacion !== null, habilitacionId: habilitacion?.id ?? null };
}

/** Decide si la inspección puede continuar: iniciada en la ventana abierta o habilitación RECORREDOR vigente. */
export async function puedeContinuarInspeccion(
  inspection: { workerId: string; startedAt: Date },
  ahora: Date,
): Promise<boolean> {
  return (await evaluarContinuar(inspection, ahora)).permitido;
}

/** Exige ventana abierta o habilitación vigente para iniciar una inspección. */
export async function exigirHorarioParaIniciar(trabajadorId: string, accion: string, ahora: Date) {
  if (await puedeIniciarInspeccion(trabajadorId, ahora)) return;
  await bloquear({
    userId: trabajadorId,
    entityType: "User",
    entityId: trabajadorId,
    accion,
    motivo: "INICIO",
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
  if (await puedeIniciarInspeccion(inspection.workerId, ahora)) return;
  await bloquear({
    userId: inspection.workerId,
    entityType: "Inspection",
    entityId: inspection.id,
    accion,
    motivo: "INICIO",
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
  const { permitido, habilitacionId } = await evaluarContinuar(inspection, ahora);
  if (permitido) return { habilitacionId };
  return bloquear({
    userId: inspection.workerId,
    entityType: "Inspection",
    entityId: inspection.id,
    accion,
    motivo: "CONTINUAR",
    mensaje: MENSAJE_CONTINUAR_FUERA_DE_HORARIO,
  });
}

/**
 * Exige que el aprobador esté dentro de la ventana de aprobación de la etapa
 * pendiente (5:45 a 8:00 a. m. o p. m.; ni antes de que abra ni después de que
 * cierre) o que tenga una habilitación APROBACION vigente (aplica a todas sus
 * inspecciones fuera de ventana). Devuelve el id de la habilitación solo cuando
 * fue ella la que permitió la decisión. Una inspección sin `completedAt` no
 * tiene horario y se deja pasar (no debería ser revisable sin envío).
 */
export async function exigirPlazoParaDecidir(
  inspection: DatosPlazo & { id: string },
  etapa: string,
  aprobadorId: string,
  accion: "APROBAR" | "RECHAZAR",
  ahora: Date,
): Promise<{ habilitacionId: string | null }> {
  if (!fueraDeVentanaAprobacion(inspection, ahora)) return { habilitacionId: null };
  const habilitacion = await habilitacionVigente(aprobadorId, TipoHabilitacion.APROBACION, ahora);
  if (habilitacion) return { habilitacionId: habilitacion.id };
  await logAudit({
    userId: aprobadorId,
    action: "APROBACION_FUERA_DE_PLAZO_BLOQUEADA",
    entityType: "Inspection",
    entityId: inspection.id,
    metadata: { accion, etapa },
  });
  throw new HorarioBloqueadoError("APROBACION", MENSAJE_APROBACION_FUERA_DE_PLAZO);
}
