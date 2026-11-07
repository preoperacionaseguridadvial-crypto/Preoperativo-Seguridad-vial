"use server";

import { prisma } from "@/lib/prisma";
import { requireRole, ForbiddenError } from "@/lib/auth/requireRole";
import { puedeEliminarUsuarios } from "@/lib/auth/permisos";
import { ErrorDeUsuario } from "@/lib/admin/error-de-usuario";
import { Role } from "@/generated/prisma/client";

const MENSAJE_CON_HISTORIAL =
  "Este usuario tiene historial en el sistema, por lo que no se puede eliminar. Desactívalo con el interruptor «Usuario activo» en su edición.";

/**
 * Elimina DEFINITIVAMENTE un usuario, solo si no tiene historial alguno
 * (inspecciones en cualquier rol, auditoría —incluye todo LOGIN—, firmas,
 * ajustes, autorización de datos o habilitaciones). Solo ADMINISTRADOR.
 *
 * Nunca se borra ni modifica una fila relacionada: la única fila que sale es
 * la del propio `User`. La verificación y el borrado van en una transacción
 * y, además, las FK de la base rechazan el borrado (P2003) si algo aún
 * referencia al usuario; ese caso se informa igual que el historial. El
 * vehículo asignado se conserva (la FK vive en `User`). Las suscripciones
 * push se borran en cascada por el schema y no cuentan como historial.
 * La auditoría referencia al ADMIN, no al usuario eliminado.
 * La redirección y el `revalidatePath` los hace la página que la invoca.
 */
export async function eliminarUsuario(usuarioId: string): Promise<void> {
  const session = await requireRole([Role.ADMINISTRADOR]);
  if (!puedeEliminarUsuarios(session.user.role)) {
    throw new ForbiddenError();
  }
  if (usuarioId === session.user.id) {
    throw new ErrorDeUsuario("No puedes eliminar tu propia cuenta.");
  }

  try {
    await prisma.$transaction(async (tx) => {
      const usuario = await tx.user.findUnique({
        where: { id: usuarioId },
        select: {
          name: true,
          email: true,
          role: true,
          // 1:1, no entra en `_count`.
          autorizacionDatos: { select: { id: true } },
          _count: {
            select: {
              inspectionsAsWorker: true,
              inspectionsAsSupervisor: true,
              inspectionsAsSupervisorOleariari: true,
              inspectionsAsConductor: true,
              auditLogs: true,
              firmas: true,
              configuracionesActualizadas: true,
              habilitacionesRecibidas: true,
              habilitacionesOtorgadas: true,
            },
          },
        },
      });
      if (!usuario) {
        throw new ErrorDeUsuario("Usuario no encontrado.");
      }
      const tieneHistorial =
        usuario.autorizacionDatos !== null || Object.values(usuario._count).some((n) => n > 0);
      if (tieneHistorial) {
        throw new ErrorDeUsuario(MENSAJE_CON_HISTORIAL);
      }

      await tx.user.delete({ where: { id: usuarioId } });
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: "ELIMINAR_USUARIO",
          entityType: "User",
          entityId: usuarioId,
          metadata: { name: usuario.name, email: usuario.email, role: usuario.role },
        },
      });
    });
  } catch (err) {
    // P2003: una FK aún referencia al usuario (fila creada entre la
    // verificación y el borrado). Nada se borró: misma respuesta que historial.
    if (typeof err === "object" && err !== null && "code" in err && err.code === "P2003") {
      throw new ErrorDeUsuario(MENSAJE_CON_HISTORIAL);
    }
    throw err;
  }
}
