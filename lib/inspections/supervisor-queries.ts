import "server-only";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { InspectionStatus } from "@/generated/prisma/client";
import { getSignedReadUrl } from "@/lib/storage/s3";

// Queries de la revisión del SUPERVISOR (Fase 3). Cualquier Supervisor puede
// ver y decidir sobre cualquier inspección pendiente — no hay asignación
// trabajador→supervisor (decisión de negocio ya tomada), por eso estas
// queries no filtran por `supervisorId`.

/**
 * Inspecciones pendientes de revisión: `reviewedAt` nulo y estado
 * PENDIENTE_APROBACION o NO_APTA_PARA_OPERAR. Ordenadas por `completedAt`
 * ascendente (las más antiguas primero).
 */
export function getInspeccionesPendientes() {
  return prisma.inspection.findMany({
    where: {
      reviewedAt: null,
      status: {
        in: [InspectionStatus.PENDIENTE_APROBACION, InspectionStatus.NO_APTA_PARA_OPERAR],
      },
    },
    include: {
      worker: true,
      vehicle: true,
    },
    orderBy: { completedAt: "asc" },
  });
}

/**
 * Inspección completa para la pantalla de detalle del Supervisor: trabajador,
 * conductor, vehículo, todas las respuestas del checklist (con su ítem y
 * categoría, para agrupar igual que lo vivió el trabajador) y novedades con
 * sus fotos. Se incluye `conductor` (y los campos de vencimiento de
 * `vehicle`) para que el Supervisor pueda detectar pase/tecnicomecánica
 * vencidos al revisar (formato oficial FO-SVS-23).
 */
function getInspectionForSupervisorRaw(inspectionId: string) {
  return prisma.inspection.findUnique({
    where: { id: inspectionId },
    include: {
      worker: true,
      conductor: true,
      vehicle: true,
      supervisor: true,
      respuestas: {
        include: {
          checklistItem: { include: { category: true } },
          novedad: { include: { photos: true } },
        },
      },
      novedades: {
        include: {
          photos: true,
          inspectionItemResponse: { include: { checklistItem: true } },
        },
      },
    },
  });
}

/**
 * Igual que `getInspectionForSupervisorRaw`, pero además firma la URL de
 * lectura de cada foto (reusando `getSignedReadUrl` de lib/storage/s3.ts) —
 * nunca se persiste esa URL, se genera on-demand en cada request.
 */
export async function getInspectionForSupervisor(inspectionId: string) {
  const inspection = await getInspectionForSupervisorRaw(inspectionId);
  if (!inspection) {
    return null;
  }

  const novedades = await Promise.all(
    inspection.novedades.map(async (novedad) => ({
      ...novedad,
      photos: await Promise.all(
        novedad.photos.map(async (photo) => ({
          ...photo,
          url: await getSignedReadUrl(photo.s3Key),
        })),
      ),
    })),
  );

  return { ...inspection, novedades };
}

export type InspectionForSupervisorConFotos = NonNullable<
  Awaited<ReturnType<typeof getInspectionForSupervisor>>
>;

/**
 * Trae el detalle de una inspección para el Supervisor o dispara
 * `notFound()` si no existe o todavía sigue EN_PROCESO (el trabajador no la
 * envió) — evita que el Supervisor vea una inspección que no le
 * corresponde. A diferencia de la versión original (Fase 3), esto incluye
 * también las ya decididas (APROBADA/RECHAZADA): la misma pantalla de
 * detalle (app/(supervisor)/aprobaciones/[id]/page.tsx) la usa tanto para
 * decidir (Fase 3) como para volver a ver la decisión y la evidencia de
 * firma después (Fase D) — no existía otra pantalla de "detalle ya
 * decidido" en el proyecto, así que se extendió esta en vez de duplicarla.
 */
export async function getInspeccionDetalleOrNotFound(
  inspectionId: string,
): Promise<InspectionForSupervisorConFotos> {
  const inspection = await getInspectionForSupervisor(inspectionId);
  const estadosVisibles: InspectionStatus[] = [
    InspectionStatus.PENDIENTE_APROBACION,
    InspectionStatus.NO_APTA_PARA_OPERAR,
    InspectionStatus.APROBADA,
    InspectionStatus.RECHAZADA,
  ];
  if (!inspection || !estadosVisibles.includes(inspection.status)) {
    notFound();
  }
  return inspection;
}

/**
 * Filtros opcionales de búsqueda para `getAllInspeccionesForOversight`.
 * `conductor`/`placa` son búsqueda parcial insensible a mayúsculas;
 * `fechaDesde`/`fechaHasta` acotan `startedAt` (inclusive de todo el día
 * calendario en `fechaHasta`, ya que llega sin componente de hora desde un
 * `<input type="date">`).
 */
export type FiltrosInspecciones = {
  conductor?: string;
  placa?: string;
  estado?: InspectionStatus;
  fechaDesde?: Date;
  fechaHasta?: Date;
  // Filtros que suma el dashboard ejecutivo (lib/inspections/reportes-queries.ts)
  // — opcionales, no rompen ningún uso existente de esta función.
  workerId?: string;
  supervisorId?: string;
  puedeOperar?: boolean;
};

/**
 * Todas las inspecciones (cualquier estado, cualquier trabajador) para la
 * vista de solo lectura de DIRECTOR/SST/SUPERVISOR (oversight). A diferencia
 * de `getInspeccionesPendientes`, no filtra por `reviewedAt`/`status` salvo
 * que se pida explícitamente vía `filtros`: esta pantalla es de consulta
 * general, no de trabajo pendiente. Ordenadas por `startedAt` descendente
 * (las más recientes primero). Sin `filtros` (u omitiendo el argumento) se
 * comporta exactamente igual que antes: todas las inspecciones, sin `where`.
 */
export function getAllInspeccionesForOversight(filtros?: FiltrosInspecciones) {
  const where: NonNullable<Parameters<typeof prisma.inspection.findMany>[0]>["where"] = {};

  if (filtros?.conductor) {
    where.conductor = { name: { contains: filtros.conductor, mode: "insensitive" } };
  }
  if (filtros?.placa) {
    where.vehicle = { placa: { contains: filtros.placa, mode: "insensitive" } };
  }
  if (filtros?.estado) {
    where.status = filtros.estado;
  }
  if (filtros?.workerId) {
    where.workerId = filtros.workerId;
  }
  if (filtros?.supervisorId) {
    where.supervisorId = filtros.supervisorId;
  }
  if (filtros?.puedeOperar !== undefined) {
    where.puedeOperar = filtros.puedeOperar;
  }
  if (filtros?.fechaDesde || filtros?.fechaHasta) {
    where.startedAt = {
      ...(filtros.fechaDesde && { gte: filtros.fechaDesde }),
      ...(filtros.fechaHasta && {
        lte: new Date(
          Date.UTC(
            filtros.fechaHasta.getUTCFullYear(),
            filtros.fechaHasta.getUTCMonth(),
            filtros.fechaHasta.getUTCDate(),
            23, 59, 59, 999,
          ),
        ),
      }),
    };
  }

  return prisma.inspection.findMany({
    where,
    include: {
      worker: true,
      vehicle: true,
      supervisor: true,
      // Solo el conteo, no las novedades completas — esta lista alimenta la
      // tabla de detalle del dashboard ejecutivo y la exportación a Excel
      // (lib/inspections/reportes-queries.ts / app/api/reportes/excel), que
      // solo necesitan "cuántas", no el detalle de cada una.
      _count: { select: { novedades: true } },
    },
    orderBy: { startedAt: "desc" },
  });
}

/**
 * Igual que `getInspeccionDetalleOrNotFound` (mismo criterio de estados
 * visibles, excluye solo EN_PROCESO), pero sin scoping por dueño/supervisor
 * — DIRECTOR/SST pueden ver el detalle de cualquier inspección completada
 * por cualquier trabajador. Usada por la pantalla de solo lectura de
 * oversight (app/(gestion)/consulta-inspecciones/[id]/page.tsx).
 */
export async function getInspeccionDetalleForOversight(
  inspectionId: string,
): Promise<InspectionForSupervisorConFotos> {
  const inspection = await getInspectionForSupervisor(inspectionId);
  if (!inspection || inspection.status === InspectionStatus.EN_PROCESO) {
    notFound();
  }
  return inspection;
}

/**
 * Métricas del dashboard operativo de DIRECTOR/SST: conteo de inspecciones
 * por estado (los 6 valores de `InspectionStatus`, no solo los 3 "visibles"
 * del alcance de negocio — para que el conteo cuadre siempre con el total
 * real de la tabla), vehículos con tecnicomecánica vencida y conductores
 * activos (`conductorActivo = true`) con pase vencido. "Vencida/o" se
 * calcula contra la hora del servidor (`ahora`), nunca con un valor del
 * cliente. Tres consultas independientes (no comparten tabla base, así que
 * no hay una sola query relacional razonable que las junte), pero cada una
 * es una única consulta agregada — sin N+1.
 */
export async function getDashboardMetrics() {
  const ahora = new Date();

  const [porEstado, vehiculosVencidos, conductoresPaseVencido] = await Promise.all([
    prisma.inspection.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    prisma.vehicle.findMany({
      where: { fechaVencimientoTecnicomecanica: { lt: ahora } },
      select: { id: true, placa: true, fechaVencimientoTecnicomecanica: true },
      orderBy: { fechaVencimientoTecnicomecanica: "asc" },
    }),
    prisma.user.findMany({
      where: {
        conductorActivo: true,
        fechaVencimientoPase: { lt: ahora },
      },
      select: { id: true, name: true, fechaVencimientoPase: true },
      orderBy: { fechaVencimientoPase: "asc" },
    }),
  ]);

  const conteoPorEstado = Object.fromEntries(
    Object.values(InspectionStatus).map((status) => [
      status,
      porEstado.find((row) => row.status === status)?._count._all ?? 0,
    ]),
  ) as Record<InspectionStatus, number>;

  return { conteoPorEstado, vehiculosVencidos, conductoresPaseVencido };
}

