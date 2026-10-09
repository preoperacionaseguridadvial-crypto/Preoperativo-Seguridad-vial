"use server";

import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { auth } from "@/lib/auth/config";
import { uploadObject } from "@/lib/storage/s3";
import { PERFIL_FIRMA, validarArchivo } from "@/lib/storage/validar-archivo";
import { VERSION_POLITICA_DATOS } from "@/lib/legal/politica-datos";

const YA_AUTORIZO = "Ya registraste tu autorización: no se puede reemplazar.";

/**
 * Registra la autorización del usuario autenticado para el tratamiento de sus
 * datos personales (Ley 1581 de 2012): aceptación expresa (campo "acepto") más
 * firma manuscrita (campo "firma", PNG generado por `FirmaCanvas`). Aplica a
 * todos los roles. Es una única vez e inmutable: un segundo intento se rechaza
 * (chequeo optimista + `userId @unique` como garantía real ante una carrera).
 * Mismo criterio de validación, subida y auditoría que las firmas de inspección
 * (lib/inspections/firma-actions.ts).
 */
export async function registrarAutorizacionDatos(formData: FormData) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Tu sesión venció: iniciá sesión de nuevo.");
  }
  const userId = session.user.id;

  if (formData.get("acepto") !== "si") {
    throw new Error("Debés aceptar la autorización para continuar.");
  }

  if (await prisma.autorizacionDatos.findUnique({ where: { userId } })) {
    throw new Error(YA_AUTORIZO);
  }

  const file = formData.get("firma");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Debés dibujar la firma antes de continuar.");
  }
  const { buffer, contentType, extension } = await validarArchivo(file, PERFIL_FIRMA);
  const key = `autorizaciones/${userId}/firma.${extension}`;
  await uploadObject({ key, body: buffer, contentType });

  try {
    await prisma.autorizacionDatos.create({
      data: { userId, versionPolitica: VERSION_POLITICA_DATOS, firmaS3Key: key },
    });
  } catch {
    throw new Error(YA_AUTORIZO);
  }

  await logAudit({
    userId,
    action: "AUTORIZAR_TRATAMIENTO_DATOS",
    entityType: "User",
    entityId: userId,
    metadata: { versionPolitica: VERSION_POLITICA_DATOS },
  });
}
