import "server-only";
import { auth } from "@/lib/auth/config";
import type { Role } from "@/generated/prisma/client";

export class UnauthenticatedError extends Error {
  constructor(message = "No autenticado") {
    super(message);
    this.name = "UnauthenticatedError";
  }
}

export class ForbiddenError extends Error {
  constructor(message = "No autorizado para esta acción") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/**
 * Helper reutilizable para validar rol dentro de server actions / route
 * handlers. El middleware (`middleware.ts`) es solo la primera barrera a
 * nivel de ruta; la validación de negocio real (qué rol puede ejecutar qué
 * acción) vive acá y debe llamarse en TODA mutación/consulta sensible,
 * porque el frontend nunca es una fuente confiable de permisos.
 *
 * @throws {UnauthenticatedError} si no hay sesión.
 * @throws {ForbiddenError} si el rol de la sesión no está en `allowedRoles`.
 */
export async function requireRole(allowedRoles: readonly Role[]) {
  const session = await auth();

  if (!session?.user) {
    throw new UnauthenticatedError();
  }

  if (!allowedRoles.includes(session.user.role)) {
    throw new ForbiddenError(
      `El rol '${session.user.role}' no tiene permiso para esta acción.`,
    );
  }

  return session;
}
