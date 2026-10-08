import "server-only";
import { prisma } from "@/lib/prisma";
import { InspectionStatus } from "@/generated/prisma/client";
import { DIAS_POR_VENCER } from "@/lib/admin/vencimientos";
import { WHERE_PENDIENTES } from "@/lib/inspections/supervisor-queries";
import { rangoDiaBogota } from "@/lib/inicio/rango-dia";
import { alertasDocumentosVehiculo } from "@/lib/inicio/vencimientos-vehiculo";

// Resúmenes de la pantalla de inicio por rol (SUPERVISOR, DIRECTOR/SST,
// ADMINISTRADOR/SST). Solo lectura, una consulta agregada por resumen.

/**
 * DIRECTOR/SST: KPIs de hoy (día calendario de Bogotá, por `startedAt` como
 * el dashboard). "Realizadas" excluye EN_PROCESO y CANCELADA (todavía no son
 * una inspección hecha). "Pendientes" es el total que sigue esperando
 * revisión, de cualquier día: es el pendiente real, no solo el de hoy.
 */
export async function getResumenDelDia(ahora: Date = new Date()) {
  const { desde, hasta } = rangoDiaBogota(ahora);
  const hoy = { startedAt: { gte: desde, lte: hasta } };
  const [realizadas, aprobadas, noAptas, pendientes] = await Promise.all([
    prisma.inspection.count({
      where: { ...hoy, status: { notIn: [InspectionStatus.EN_PROCESO, InspectionStatus.CANCELADA] } },
    }),
    prisma.inspection.count({ where: { ...hoy, status: InspectionStatus.APROBADA } }),
    prisma.inspection.count({ where: { ...hoy, status: InspectionStatus.NO_APTA_PARA_OPERAR } }),
    prisma.inspection.count({ where: WHERE_PENDIENTES }),
  ]);
  return { realizadas, aprobadas, noAptas, pendientes };
}

/**
 * ADMINISTRADOR/SST: vehículos activos con SOAT o tecnomecánica vencidos o
 * por vencer (mismo umbral `DIAS_POR_VENCER` que la hoja de vida), con el
 * trabajador dueño para enlazar a su ficha. Los más urgentes primero.
 */
export async function getVehiculosConDocumentosPorVencer(ahora: Date = new Date()) {
  const limite = new Date(ahora.getTime() + DIAS_POR_VENCER * 24 * 60 * 60 * 1000);
  const vehiculos = await prisma.vehicle.findMany({
    where: {
      activo: true,
      OR: [
        { fechaVencimientoSoat: { lte: limite } },
        { fechaVencimientoTecnicomecanica: { lte: limite } },
      ],
    },
    select: {
      id: true,
      placa: true,
      fechaVencimientoSoat: true,
      fechaVencimientoTecnicomecanica: true,
      conductor: { select: { id: true, name: true } },
    },
  });

  return vehiculos
    .map((vehiculo) => ({
      id: vehiculo.id,
      placa: vehiculo.placa,
      conductor: vehiculo.conductor,
      alertas: alertasDocumentosVehiculo(vehiculo, ahora),
    }))
    .filter((vehiculo) => vehiculo.alertas.length > 0)
    .sort((a, b) => Math.min(...a.alertas.map((x) => x.fecha.getTime())) - Math.min(...b.alertas.map((x) => x.fecha.getTime())));
}
