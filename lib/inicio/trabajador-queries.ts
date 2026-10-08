import "server-only";
import { prisma } from "@/lib/prisma";
import { InspectionStatus, TipoFirma } from "@/generated/prisma/client";
import { getVehiculoDelTrabajador } from "@/lib/inspections/queries";
import { getSignedReadUrl } from "@/lib/storage/s3";

/**
 * Datos del inicio del TRABAJADOR: su vehículo (1:1), sus últimas 3
 * inspecciones no canceladas (la primera es "la última" para la acción
 * principal) y la URL firmada de la foto del vehículo. La miniatura es la
 * foto LATERAL de la última inspección si existe, o la de la hoja de vida;
 * si no hay foto o la firma falla, devuelve null y la UI cae al ícono.
 */
export async function getDatosInicioTrabajador(workerId: string) {
  const [vehiculo, inspecciones, usuario] = await Promise.all([
    getVehiculoDelTrabajador(workerId),
    prisma.inspection.findMany({
      where: { workerId, status: { not: InspectionStatus.CANCELADA } },
      orderBy: { startedAt: "desc" },
      take: 3,
      select: {
        id: true,
        status: true,
        startedAt: true,
        completedAt: true,
        reviewedAt: true,
        observacionesSupervisor: true,
        observacionesSupervisorOleariari: true,
        sede: true,
        revisadaSupervisorOleariariAt: true,
        _count: { select: { firmas: { where: { tipo: TipoFirma.SUPERVISOR_OLEARIARI } } } },
        fotos: { where: { tipo: "LATERAL" }, take: 1, select: { s3Key: true } },
      },
    }),
    // Sede: se muestra junto al rol ("Recorredor Oleariari") en el saludo.
    prisma.user.findUnique({ where: { id: workerId }, select: { sede: true } }),
  ]);

  const s3Key = inspecciones[0]?.fotos[0]?.s3Key ?? vehiculo?.fotoS3Key ?? null;
  const fotoVehiculoUrl = s3Key ? await getSignedReadUrl(s3Key).catch(() => null) : null;

  return {
    vehiculo,
    sede: usuario?.sede ?? null,
    inspecciones: inspecciones.map((inspeccion) => ({
      id: inspeccion.id,
      status: inspeccion.status,
      startedAt: inspeccion.startedAt,
      completedAt: inspeccion.completedAt,
      reviewedAt: inspeccion.reviewedAt,
      // Una rechazada en la primera etapa lleva la observación del Supervisor Oleariari.
      observacionesSupervisor: inspeccion.observacionesSupervisor ?? inspeccion.observacionesSupervisorOleariari,
      sede: inspeccion.sede,
      revisadaSupervisorOleariariAt: inspeccion.revisadaSupervisorOleariariAt,
      firmaSupervisorOleariari: inspeccion._count.firmas > 0,
    })),
    fotoVehiculoUrl,
  };
}
