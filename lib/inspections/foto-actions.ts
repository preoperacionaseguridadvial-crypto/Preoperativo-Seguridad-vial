"use server";

import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { requireRole, ForbiddenError } from "@/lib/auth/requireRole";
import { Role, InspectionStatus, TipoFotoInspeccion } from "@/generated/prisma/client";
import { uploadObject } from "@/lib/storage/s3";

// Server action de las fotos diarias obligatorias (Fase soporte-moto-carro,
// Slice 3, A7). `FotoInspeccion` mirroa el patrón ya probado de `Firma`
// (lib/inspections/firma-actions.ts): inmutable, `@@unique([inspectionId,
// tipo])` como garantía real ante una carrera además del chequeo optimista
// de acá. Vive en su propio archivo (no actions.ts) por el mismo motivo que
// firma-actions.ts: es un concepto propio (evidencia fotográfica diaria),
// no una respuesta de checklist.

/**
 * Sube una de las dos fotos diarias obligatorias (LATERAL o PLACA) y crea el
 * registro `FotoInspeccion`. Solo el TRABAJADOR dueño de la inspección,
 * mientras siga EN_PROCESO — mismo criterio de pertenencia y de estado que
 * el resto de las mutaciones del flujo del trabajador (ver
 * `getOwnInspeccionEnProceso`, lib/inspections/actions.ts).
 */
export async function subirFotoInspeccion(
  inspectionId: string,
  tipo: TipoFotoInspeccion,
  formData: FormData,
) {
  const session = await requireRole([Role.TRABAJADOR]);

  const inspection = await prisma.inspection.findUnique({ where: { id: inspectionId } });
  if (!inspection || inspection.workerId !== session.user.id) {
    throw new ForbiddenError("Esta inspección no pertenece al usuario autenticado.");
  }
  if (inspection.status !== InspectionStatus.EN_PROCESO) {
    throw new Error("La inspección ya no está en proceso: no se pueden agregar fotos.");
  }

  const existente = await prisma.fotoInspeccion.findUnique({
    where: { inspectionId_tipo: { inspectionId, tipo } },
  });
  if (existente) {
    throw new Error("Ya existe una foto registrada para esta inspección: no se puede reemplazar.");
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Debés tomar la foto antes de continuar.");
  }
  if (!file.type.startsWith("image/")) {
    throw new Error("La foto debe ser una imagen.");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const key = `fotos-inspeccion/${inspectionId}/${tipo}.jpg`;
  await uploadObject({ key, body: buffer, contentType: file.type });

  try {
    await prisma.fotoInspeccion.create({ data: { inspectionId, tipo, s3Key: key } });
  } catch {
    // Carrera entre el findUnique de arriba y este create: la restricción
    // @@unique([inspectionId, tipo]) del schema es la garantía real de
    // inmutabilidad, este catch solo la traduce a un mensaje claro.
    throw new Error("Ya existe una foto registrada para esta inspección: no se puede reemplazar.");
  }

  await logAudit({
    userId: session.user.id,
    action: "SUBIR_FOTO_INSPECCION",
    entityType: "Inspection",
    entityId: inspectionId,
    metadata: { tipo },
  });
}
