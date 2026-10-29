"use server";

import { prisma } from "@/lib/prisma";
import { requireRole, ForbiddenError } from "@/lib/auth/requireRole";
import { puedeEliminarInspecciones } from "@/lib/auth/permisos";
import { Role } from "@/generated/prisma/client";
import { deleteObject } from "@/lib/storage/s3";

/**
 * Elimina DEFINITIVAMENTE una inspección con todo lo que cuelga de ella
 * (respuestas, novedades con sus fotos, firmas y fotos de la inspección).
 * Solo ADMINISTRADOR, en cualquier estado. Es irreversible, por eso queda un
 * registro en la auditoría (la tabla no tiene FK, sobrevive al borrado).
 *
 * Los objetos del almacenamiento se borran DESPUÉS del commit y en el mejor
 * esfuerzo: si fallan, el borrado en base se mantiene (quedan objetos
 * huérfanos, que es preferible a una inspección a medio borrar).
 * La redirección y el `revalidatePath` los hace la página que la invoca.
 */
export async function eliminarInspeccion(inspectionId: string): Promise<void> {
  const session = await requireRole([Role.ADMINISTRADOR]);
  if (!puedeEliminarInspecciones(session.user.role)) {
    throw new ForbiddenError();
  }

  const inspection = await prisma.inspection.findUnique({
    where: { id: inspectionId },
    include: {
      vehicle: { select: { placa: true } },
      worker: { select: { name: true } },
      firmas: { select: { s3Key: true } },
      fotos: { select: { s3Key: true } },
      novedades: { select: { photos: { select: { s3Key: true } } } },
      _count: { select: { respuestas: true, novedades: true } },
    },
  });
  if (!inspection) {
    throw new Error("Inspección no encontrada.");
  }

  const keys = [
    ...inspection.novedades.flatMap((n) => n.photos.map((p) => p.s3Key)),
    ...inspection.firmas.map((f) => f.s3Key),
    ...inspection.fotos.map((f) => f.s3Key),
  ];

  await prisma.$transaction(async (tx) => {
    await tx.photo.deleteMany({ where: { novedad: { inspectionId } } });
    await tx.novedad.deleteMany({ where: { inspectionId } });
    await tx.inspectionItemResponse.deleteMany({ where: { inspectionId } });
    await tx.firma.deleteMany({ where: { inspectionId } });
    await tx.fotoInspeccion.deleteMany({ where: { inspectionId } });
    await tx.inspection.delete({ where: { id: inspectionId } });
    await tx.auditLog.create({
      data: {
        userId: session.user.id,
        action: "ELIMINAR_INSPECCION",
        entityType: "Inspection",
        entityId: inspectionId,
        metadata: {
          placa: inspection.vehicle.placa,
          estado: inspection.status,
          trabajador: inspection.worker.name,
          fecha: (inspection.completedAt ?? inspection.startedAt).toISOString(),
          respuestas: inspection._count.respuestas,
          novedades: inspection._count.novedades,
          objetosAlmacenamiento: keys.length,
        },
      },
    });
  });

  const resultados = await Promise.allSettled(keys.map((key) => deleteObject(key)));
  resultados.forEach((resultado, i) => {
    if (resultado.status === "rejected") {
      console.error(`[eliminarInspeccion] No se pudo borrar el objeto ${keys[i]}`, resultado.reason);
    }
  });
}
