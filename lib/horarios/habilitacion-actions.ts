"use server";

import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { requireRole, ForbiddenError } from "@/lib/auth/requireRole";
import { ErrorDeUsuario, esErrorDeUsuario } from "@/lib/admin/error-de-usuario";
import { Role, TipoHabilitacion } from "@/generated/prisma/client";
import { instanteBogota } from "@/lib/horarios/habilitacion-fechas";

// Módulo SST "Inspecciones fuera de horario" (regla de producto 2026-10-20):
// el Administrador SST otorga habilitaciones justificadas y auditadas.
// ADMINISTRADOR también otorga (tiene todos los permisos de SST, decisión del
// usuario 2026-10-27).

const JUSTIFICACION_MINIMA = 10;

const ROLES_POR_TIPO: Record<TipoHabilitacion, { roles: Role[]; error: string }> = {
  RECORREDOR: {
    roles: [Role.TRABAJADOR],
    error: "La habilitación de inspección debe asignarse a un recorredor.",
  },
  APROBACION: {
    roles: [Role.SUPERVISOR, Role.SUPERVISOR_OLEARIARI],
    error: "La habilitación de aprobación debe asignarse a un aprobador.",
  },
};

export type DatosHabilitacion = {
  tipo: TipoHabilitacion;
  usuarioId: string;
  /** "YYYY-MM-DD" (día en Bogotá). */
  fecha: string;
  /** "HH:MM" (hora de Bogotá). */
  horaDesde: string;
  horaHasta: string;
  justificacion: string;
};

export async function otorgarHabilitacion(data: DatosHabilitacion) {
  const session = await requireRole([Role.SST, Role.ADMINISTRADOR]);

  const regla = ROLES_POR_TIPO[data.tipo];
  if (!regla) throw new ErrorDeUsuario("El tipo de habilitación no es válido.");

  const justificacion = data.justificacion.trim();
  if (!justificacion) throw new ErrorDeUsuario("La justificación es obligatoria.");
  if (justificacion.length < JUSTIFICACION_MINIMA) {
    throw new ErrorDeUsuario(`La justificación debe tener al menos ${JUSTIFICACION_MINIMA} caracteres.`);
  }

  const desde = instanteBogota(data.fecha, data.horaDesde);
  if (!desde) throw new ErrorDeUsuario("Indica una fecha y una hora de inicio válidas.");
  const hasta = instanteBogota(data.fecha, data.horaHasta);
  if (!hasta) throw new ErrorDeUsuario("Indica una hora de fin válida.");
  if (hasta <= desde) throw new ErrorDeUsuario("La hora de fin debe ser posterior a la hora de inicio.");
  if (hasta <= new Date()) {
    throw new ErrorDeUsuario("El rango ya terminó. Indica un rango que no haya terminado.");
  }

  const beneficiario = await prisma.user.findUnique({ where: { id: data.usuarioId } });
  if (!beneficiario) throw new ErrorDeUsuario("El usuario no existe.");
  if (!beneficiario.activo) throw new ErrorDeUsuario("El usuario está inactivo.");
  if (!regla.roles.includes(beneficiario.role)) throw new ErrorDeUsuario(regla.error);

  const creada = await prisma.habilitacionHorario.create({
    data: {
      tipo: data.tipo,
      usuarioId: beneficiario.id,
      desde,
      hasta,
      justificacion,
      otorgadaPorId: session.user.id,
    },
  });

  await logAudit({
    userId: session.user.id,
    action: "OTORGAR_HABILITACION_HORARIO",
    entityType: "HabilitacionHorario",
    entityId: creada.id,
    metadata: {
      tipo: data.tipo,
      usuarioId: beneficiario.id,
      desde: desde.toISOString(),
      hasta: hasta.toISOString(),
    },
  });

  return creada;
}

export type OtorgarHabilitacionEstado =
  | { ok: true; id: string }
  | { ok: false; error: string; valores: Record<string, string> };

const CAMPOS_REPOBLABLES = ["tipo", "usuarioId", "fecha", "horaDesde", "horaHasta", "justificacion"] as const;

const MENSAJE_ERROR_INESPERADO =
  "No se pudo guardar la habilitación. Intenta de nuevo o contacta a soporte.";

/**
 * Adaptador de `otorgarHabilitacion` para `useActionState`. Devuelve el
 * mensaje (solo de errores de dominio) en vez de lanzar, para no perder lo
 * escrito en el formulario; los errores inesperados devuelven uno genérico.
 */
export async function otorgarHabilitacionDesdeFormulario(
  _estadoPrevio: OtorgarHabilitacionEstado | null,
  formData: FormData,
): Promise<OtorgarHabilitacionEstado> {
  const texto = (campo: string) => formData.get(campo)?.toString() ?? "";
  try {
    const creada = await otorgarHabilitacion({
      tipo: texto("tipo") as TipoHabilitacion,
      usuarioId: texto("usuarioId"),
      fecha: texto("fecha"),
      horaDesde: texto("horaDesde"),
      horaHasta: texto("horaHasta"),
      justificacion: texto("justificacion"),
    });
    return { ok: true, id: creada.id };
  } catch (err) {
    const valores = Object.fromEntries(CAMPOS_REPOBLABLES.map((campo) => [campo, texto(campo)]));
    if (esErrorDeUsuario(err) || err instanceof ForbiddenError) {
      return { ok: false, error: err.message, valores };
    }
    console.error("Fallo inesperado al otorgar una habilitación de horario.", err);
    return { ok: false, error: MENSAJE_ERROR_INESPERADO, valores };
  }
}
