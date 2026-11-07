"use server";

import { prisma } from "@/lib/prisma";
import { requireRole, ForbiddenError } from "@/lib/auth/requireRole";
import { puedeEliminarUsuarios } from "@/lib/auth/permisos";
import { ErrorDeUsuario } from "@/lib/admin/error-de-usuario";
import { Role } from "@/generated/prisma/client";
import { deleteObject } from "@/lib/storage/s3";

const SUGERENCIA_DESACTIVAR = "o desactiva al usuario con el interruptor «Usuario activo» en su edición.";

/**
 * Elimina DEFINITIVAMENTE un usuario junto con SU propio rastro: sus registros
 * de auditoría (sesiones), las habilitaciones que recibió, su
 * autorización de datos y las suscripciones push (cascada del schema). Los
 * ajustes que editó no se borran: solo pierden el autor (`updatedById` null).
 * Solo ADMINISTRADOR.
 *
 * Se BLOQUEA (no se borra nada) si el usuario tiene inspecciones en cualquier
 * rol, firmas, una habilitación ligada a una inspección (borrarla alteraría
 * la inspección de otro usuario) o habilitaciones que otorgó a otros usuarios
 * (son historial de quien las recibió). Esta acción nunca borra inspecciones.
 *
 * Verificación y borrado van en UNA transacción; además las FK rechazan el
 * borrado (P2003) si algo aún referencia al usuario, y eso se informa igual
 * que un bloqueo. El vehículo asignado se conserva (la FK vive en `User`).
 * La auditoría de OTROS usuarios sobre este (p. ej. CREAR_USUARIO) se conserva.
 * El objeto de la firma de la autorización de datos se borra del
 * almacenamiento DESPUÉS del commit y en el mejor esfuerzo.
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

  let claveAutorizacion: string | null = null;
  try {
    claveAutorizacion = await prisma.$transaction(async (tx) => {
      const usuario = await tx.user.findUnique({
        where: { id: usuarioId },
        select: {
          name: true,
          email: true,
          role: true,
          autorizacionDatos: { select: { firmaS3Key: true } },
          _count: {
            select: {
              firmas: true,
            },
          },
        },
      });
      if (!usuario) {
        throw new ErrorDeUsuario("Usuario no encontrado.");
      }

      const propia = { OR: [{ usuarioId }, { otorgadaPorId: usuarioId }] };
      const habilitacionesLigadas = await tx.habilitacionHorario.count({
        where: { ...propia, inspecciones: { some: {} } },
      });
      // Una habilitación que este usuario otorgó a OTRO es historial de ese otro usuario: no se borra.
      const otorgadasAOtros = await tx.habilitacionHorario.count({
        where: { otorgadaPorId: usuarioId, usuarioId: { not: usuarioId } },
      });

      // Inspecciones DISTINTAS en cualquier rol (trabajador y conductor suelen coincidir).
      const inspecciones = await tx.inspection.count({
        where: {
          OR: [
            { workerId: usuarioId },
            { conductorId: usuarioId },
            { supervisorId: usuarioId },
            { supervisorOleariariId: usuarioId },
          ],
        },
      });
      const c = usuario._count;
      const motivos: string[] = [];
      if (inspecciones > 0) {
        motivos.push(
          `tiene ${inspecciones} ${inspecciones === 1 ? "inspección" : "inspecciones"}; elimínalas primero desde Consulta de inspecciones`,
        );
      }
      if (c.firmas > 0) {
        motivos.push(`tiene firmas registradas (${c.firmas})`);
      }
      if (habilitacionesLigadas > 0) {
        motivos.push("una habilitación suya está ligada a una inspección");
      }
      if (otorgadasAOtros > 0) {
        motivos.push(`otorgó ${otorgadasAOtros} ${otorgadasAOtros === 1 ? "habilitación" : "habilitaciones"} a otros usuarios`);
      }
      if (motivos.length > 0) {
        throw new ErrorDeUsuario(`No se puede eliminar este usuario: ${motivos.join("; ")}, ${SUGERENCIA_DESACTIVAR}`);
      }

      // Solo filas propias del usuario; ninguna referenciada por inspecciones (verificado arriba).
      const auditoria = await tx.auditLog.deleteMany({ where: { userId: usuarioId } });
      // Solo las que recibió (incluye las que se otorgó a sí mismo); las otorgadas a otros ya bloquearon arriba.
      const habilitaciones = await tx.habilitacionHorario.deleteMany({ where: { usuarioId } });
      const autorizacion = await tx.autorizacionDatos.deleteMany({ where: { userId: usuarioId } });
      const ajustes = await tx.appSetting.updateMany({
        where: { updatedById: usuarioId },
        data: { updatedById: null },
      });
      await tx.user.delete({ where: { id: usuarioId } });
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: "ELIMINAR_USUARIO",
          entityType: "User",
          entityId: usuarioId,
          metadata: {
            name: usuario.name,
            email: usuario.email,
            role: usuario.role,
            auditoriaEliminada: auditoria.count,
            habilitacionesEliminadas: habilitaciones.count,
            autorizacionDatosEliminada: autorizacion.count,
            ajustesDesvinculados: ajustes.count,
          },
        },
      });
      return usuario.autorizacionDatos?.firmaS3Key ?? null;
    });
  } catch (err) {
    // P2003: una FK aún referencia al usuario (fila creada entre la
    // verificación y el borrado). La transacción se revirtió: nada se borró.
    if (typeof err === "object" && err !== null && "code" in err && err.code === "P2003") {
      throw new ErrorDeUsuario(
        `No se puede eliminar este usuario: tiene registros asociados que lo impiden, ${SUGERENCIA_DESACTIVAR}`,
      );
    }
    throw err;
  }

  if (claveAutorizacion) {
    try {
      await deleteObject(claveAutorizacion);
    } catch (err) {
      console.error(`[eliminarUsuario] No se pudo borrar el objeto ${claveAutorizacion}`, err);
    }
  }
}
