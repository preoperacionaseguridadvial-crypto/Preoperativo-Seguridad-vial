import "server-only";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Sede } from "@/generated/prisma/client";
import { enviarAUsuarios, pushConfigurado } from "@/lib/notificaciones/push";
import {
  construirMensaje,
  planDeEvento,
  type Audiencia,
  type EventoInspeccion,
} from "@/lib/notificaciones/mensajes-inspeccion";

// Avisos push de los movimientos de una inspección. Se llaman desde las server
// actions DESPUÉS de que la escritura en la base salió bien y nunca afectan su
// resultado: todo es best-effort y no lanza.

export type ExtrasNotificacion = {
  /** Cargo de quien decidió, p. ej. "Director de Operaciones". */
  decididoPor?: string;
  observacion?: string | null;
};

type GrupoDestinatarios = { audiencia: Audiencia; userIds: string[] };

/**
 * Usuarios activos que deben enterarse del evento, por audiencia. Excluye al
 * actor (quien hizo la acción) y omite los grupos vacíos.
 */
export async function resolverDestinatarios(
  evento: EventoInspeccion,
  inspeccion: { sede: Sede | null; workerId: string },
  actorId: string,
): Promise<GrupoDestinatarios[]> {
  const grupos: GrupoDestinatarios[] = [];
  for (const { audiencia, roles } of planDeEvento(evento, inspeccion.sede)) {
    const usuarios = await prisma.user.findMany({
      where:
        audiencia === "TRABAJADOR"
          ? { id: inspeccion.workerId, activo: true }
          : { role: { in: roles }, activo: true },
      select: { id: true },
    });
    const userIds = usuarios.map((u) => u.id).filter((id) => id !== actorId);
    if (userIds.length > 0) grupos.push({ audiencia, userIds });
  }
  return grupos;
}

/** Arma y envía los avisos del evento. Nunca lanza. */
export async function enviarNotificacionInspeccion(
  evento: EventoInspeccion,
  inspectionId: string,
  actorId: string,
  extras: ExtrasNotificacion = {},
): Promise<void> {
  try {
    if (!pushConfigurado()) return;

    const inspeccion = await prisma.inspection.findUnique({
      where: { id: inspectionId },
      select: {
        id: true,
        sede: true,
        workerId: true,
        puedeOperar: true,
        vehicle: { select: { placa: true } },
        worker: { select: { name: true } },
      },
    });
    if (!inspeccion) return;

    const grupos = await resolverDestinatarios(evento, inspeccion, actorId);
    await Promise.all(
      grupos.map(({ audiencia, userIds }) =>
        enviarAUsuarios(
          userIds,
          construirMensaje(evento, audiencia, {
            inspectionId: inspeccion.id,
            placa: inspeccion.vehicle.placa,
            trabajador: inspeccion.worker.name,
            noApta: inspeccion.puedeOperar === false,
            decididoPor: extras.decididoPor,
            observacion: extras.observacion,
          }),
        ),
      ),
    );
  } catch (error) {
    console.error("[push] No se pudo notificar el movimiento de la inspección", error);
  }
}

/**
 * Programa el aviso para después de responder (`after`), sin demorar la
 * respuesta de la server action. Fuera de una request (tests, scripts)
 * `after` no existe: se dispara igual, sin esperar.
 */
export function notificarInspeccion(
  evento: EventoInspeccion,
  inspectionId: string,
  actorId: string,
  extras?: ExtrasNotificacion,
): void {
  const tarea = () => enviarNotificacionInspeccion(evento, inspectionId, actorId, extras);
  try {
    after(tarea);
  } catch {
    void tarea();
  }
}
