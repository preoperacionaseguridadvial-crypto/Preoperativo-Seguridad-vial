"use server";

import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { requireRole, ForbiddenError } from "@/lib/auth/requireRole";
import { Role, InspectionStatus, TipoFirma } from "@/generated/prisma/client";
import { uploadObject } from "@/lib/storage/s3";

// Server actions de la firma manuscrita digital (Fase D). El formato oficial
// FO-SVS-23 tiene dos líneas de firma ("NOMBRE Y FIRMA DEL CONDUCTOR" /
// "NOMBRE Y FIRMA DEL SUPERVISOR"); ambas comparten toda la lógica de
// subida + inmutabilidad + auditoría (`crearFirma`, no exportada) para no
// duplicarla entre el flujo del trabajador (lib/inspections/actions.ts) y
// el del supervisor (lib/inspections/supervisor-actions.ts) — solo difieren
// en el rol requerido y en qué hace válida a la inspección para firmarse.
// Vive en un archivo propio (no actions.ts ni supervisor-actions.ts) porque
// ambos lados la necesitan por igual.

/**
 * Extrae y valida el PNG de la firma del FormData (campo "firma"), generado
 * en el cliente por `FirmaCanvas` (app/_components/FirmaCanvas.tsx) vía
 * `canvas.toBlob`.
 */
function extraerArchivoFirma(formData: FormData): File {
  const file = formData.get("firma");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Debés dibujar la firma antes de continuar.");
  }
  if (!file.type.startsWith("image/")) {
    throw new Error("La firma debe ser una imagen.");
  }
  return file;
}

/**
 * Sube la imagen a S3 (`firmas/${inspectionId}/${tipo}.png`) y crea el
 * registro `Firma`. Inmutable: si ya existe una firma de ese tipo para esa
 * inspección, rechaza explícitamente el reemplazo (chequeo optimista +
 * `@@unique([inspectionId, tipo])` como garantía real ante una carrera).
 */
async function crearFirma(params: {
  inspectionId: string;
  userId: string;
  tipo: TipoFirma;
  formData: FormData;
  auditAction: string;
}) {
  const { inspectionId, userId, tipo, formData, auditAction } = params;

  const existente = await prisma.firma.findUnique({
    where: { inspectionId_tipo: { inspectionId, tipo } },
  });
  if (existente) {
    throw new Error("Ya existe una firma registrada para esta inspección: no se puede reemplazar.");
  }

  const file = extraerArchivoFirma(formData);
  const buffer = Buffer.from(await file.arrayBuffer());
  const key = `firmas/${inspectionId}/${tipo}.png`;
  await uploadObject({ key, body: buffer, contentType: "image/png" });

  try {
    await prisma.firma.create({ data: { inspectionId, userId, tipo, s3Key: key } });
  } catch {
    // Carrera entre el findUnique de arriba y este create: la restricción
    // @@unique([inspectionId, tipo]) del schema es la garantía real de
    // inmutabilidad, este catch solo la traduce a un mensaje claro.
    throw new Error("Ya existe una firma registrada para esta inspección: no se puede reemplazar.");
  }

  await logAudit({ userId, action: auditAction, entityType: "Inspection", entityId: inspectionId });
}

/**
 * Firma del conductor: solo el TRABAJADOR dueño de la inspección, y solo
 * mientras siga EN_PROCESO — mismo criterio de pertenencia y de estado que
 * el resto de las mutaciones del flujo del trabajador (ver
 * `getOwnInspeccionEnProceso` en lib/inspections/actions.ts).
 */
export async function guardarFirmaConductor(inspectionId: string, formData: FormData) {
  const session = await requireRole([Role.TRABAJADOR]);

  const inspection = await prisma.inspection.findUnique({ where: { id: inspectionId } });
  if (!inspection || inspection.workerId !== session.user.id) {
    throw new ForbiddenError("Esta inspección no pertenece al usuario autenticado.");
  }
  if (inspection.status !== InspectionStatus.EN_PROCESO) {
    throw new Error("La inspección ya no está en proceso: no se puede firmar.");
  }

  await crearFirma({
    inspectionId,
    userId: session.user.id,
    tipo: TipoFirma.CONDUCTOR,
    formData,
    auditAction: "FIRMAR_CONDUCTOR",
  });
}

/**
 * Firma del supervisor: ahora es un paso POSTERIOR a la decisión (no un
 * requisito previo — ver `getInspeccionRevisable` en
 * lib/inspections/supervisor-actions.ts, que ya no la exige). Solo se puede
 * firmar una inspección ya decidida (APROBADA o RECHAZADA), y solo puede
 * firmarla el mismo Supervisor que tomó esa decisión (`supervisorId`) — sin
 * este chequeo, como no hay asignación trabajador→supervisor, cualquier
 * otro Supervisor podría firmar una decisión que no tomó.
 */
export async function guardarFirmaSupervisor(inspectionId: string, formData: FormData) {
  const session = await requireRole([Role.SUPERVISOR]);

  const inspection = await prisma.inspection.findUnique({ where: { id: inspectionId } });
  if (!inspection) {
    throw new Error("Inspección no encontrada.");
  }
  if (
    inspection.status !== InspectionStatus.APROBADA &&
    inspection.status !== InspectionStatus.RECHAZADA
  ) {
    throw new Error("La inspección todavía no fue decidida: no se puede firmar.");
  }
  if (inspection.supervisorId !== session.user.id) {
    throw new ForbiddenError("Solo el supervisor que tomó la decisión puede firmar.");
  }

  await crearFirma({
    inspectionId,
    userId: session.user.id,
    tipo: TipoFirma.SUPERVISOR,
    formData,
    auditAction: "FIRMAR_SUPERVISOR",
  });
}
