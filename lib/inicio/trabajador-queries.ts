import "server-only";
import { prisma } from "@/lib/prisma";
import { InspectionStatus } from "@/generated/prisma/client";
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
        fotos: { where: { tipo: "LATERAL" }, take: 1, select: { s3Key: true } },
      },
    }),
    // Sede: se muestra junto al rol ("Recorredor Olariari") en el saludo.
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
      observacionesSupervisor: inspeccion.observacionesSupervisor,
    })),
    fotoVehiculoUrl,
  };
}
