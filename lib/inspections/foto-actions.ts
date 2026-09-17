"use server";

import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { requireRole, ForbiddenError } from "@/lib/auth/requireRole";
import { Role, InspectionStatus, Prisma, TipoFotoInspeccion } from "@/generated/prisma/client";
import { uploadObject } from "@/lib/storage/s3";

// Mismo criterio que `esErrorPlacaDuplicada` en lib/admin/vehicle-actions.ts:
// solo el código P2002 (violación de restricción única) de Prisma identifica
// de forma confiable una carrera contra `@@unique([inspectionId, tipo])`.
function esErrorFotoDuplicada(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

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
  } catch (err) {
    // Carrera entre el findUnique de arriba y este create: la restricción
    // @@unique([inspectionId, tipo]) del schema es la garantía real de
    // inmutabilidad, este catch solo la traduce a un mensaje claro — pero
    // SOLO cuando el error es realmente esa violación de unicidad (P2002).
    // Cualquier otra falla (ej. corte de conectividad con la base justo
    // después de subir la foto a S3) no debe enmascararse como "ya existe":
    // se registra la causa real y se relanza el error original (mismo
    // criterio que `crearVehiculo`/`actualizarVehiculo`,
    // lib/admin/vehicle-actions.ts).
    if (esErrorFotoDuplicada(err)) {
      throw new Error("Ya existe una foto registrada para esta inspección: no se puede reemplazar.");
    }
    console.error("Fallo al crear el registro de FotoInspeccion tras subir la foto a S3.", {
      inspectionId,
      tipo,
      err,
    });
    throw err;
  }

  await logAudit({
    userId: session.user.id,
    action: "SUBIR_FOTO_INSPECCION",
    entityType: "Inspection",
    entityId: inspectionId,
    metadata: { tipo },
  });
}
