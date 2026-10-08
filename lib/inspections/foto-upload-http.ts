import { Prisma, TipoFotoInspeccion } from "@/generated/prisma/client";
import { ForbiddenError, UnauthenticatedError } from "@/lib/auth/requireRole";

// Traducción HTTP de la subida de fotos diarias (route handler
// app/(worker)/inspecciones/[id]/fotos/[tipo]/subir/route.ts). Sin
// dependencias de servidor para poder probarse en aislamiento.

export const MENSAJE_ERROR_GENERICO_FOTO = "No se pudo guardar la foto. Intentá de nuevo.";

/** `lateral`/`placa` (cualquier caja) -> enum; cualquier otra cosa -> `null`. */
export function parseTipoFoto(raw: string): TipoFotoInspeccion | null {
  const valor = raw.toUpperCase();
  return valor === TipoFotoInspeccion.LATERAL || valor === TipoFotoInspeccion.PLACA ? valor : null;
}

function esErrorDeInfraestructura(err: unknown): boolean {
  if (!(err instanceof Error)) return true;
  if (
    err instanceof Prisma.PrismaClientKnownRequestError ||
    err instanceof Prisma.PrismaClientUnknownRequestError ||
    err instanceof Prisma.PrismaClientInitializationError ||
    err instanceof Prisma.PrismaClientValidationError ||
    err instanceof Prisma.PrismaClientRustPanicError
  ) {
    return true;
  }
  // Los errores del SDK de AWS llevan `$metadata`.
  return "$metadata" in err;
}

/**
 * Estado HTTP y mensaje para el cliente. Los errores de negocio/validación de
 * `subirFotoInspeccion` ya traen un mensaje en español pensado para el
 * usuario (400); los de infraestructura (Prisma, S3) no se filtran: 500 con un
 * mensaje genérico.
 */
export function errorFotoAHttp(err: unknown): { status: number; message: string } {
  if (err instanceof UnauthenticatedError) {
    return { status: 401, message: "Tu sesión venció: volvé a iniciar sesión." };
  }
  if (err instanceof ForbiddenError) {
    return { status: 403, message: err.message };
  }
  if (esErrorDeInfraestructura(err)) {
    return { status: 500, message: MENSAJE_ERROR_GENERICO_FOTO };
  }
  return { status: 400, message: (err as Error).message };
}
