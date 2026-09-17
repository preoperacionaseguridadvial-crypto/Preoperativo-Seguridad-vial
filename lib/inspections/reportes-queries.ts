import "server-only";
import { prisma } from "@/lib/prisma";
import { InspectionStatus, RespuestaChecklist, Role, type TipoNovedad } from "@/generated/prisma/client";
import { esNovedad } from "@/lib/inspections/respuesta";

// Único conjunto de valores que cuentan como "falla real" para reportes,
// derivado de `esNovedad()` (lib/inspections/respuesta.ts) — así este
// archivo nunca mantiene su propia copia divergente de esa regla de
// negocio. Se calcula una sola vez porque `RespuestaChecklist` es un enum
// fijo en tiempo de ejecución (no cambia entre llamadas).
const VALORES_FALLA = Object.values(RespuestaChecklist).filter(esNovedad);

// Queries del dashboard ejecutivo "Informes de Gerencia" (DIRECTOR/SST).
// Ninguna de estas toca el flujo de inspección del trabajador, la
// aprobación del supervisor ni la generación del PDF FO-SVS-23 — son todas
// de solo lectura, agregando datos que ya existen.
//
// El sistema NO tiene ningún concepto de horario/programación de
// trabajador (confirmado contra el schema completo): por eso acá no existe
// "inspecciones esperadas", "a tiempo" ni "fuera de horario". La métrica
// "Cumplimiento" de este dashboard es la TASA DE APROBACIÓN (aprobadas /
// total del período) — no debe confundirse con cumplimiento de horario.

export type FiltrosReporte = {
  fechaDesde?: Date;
  fechaHasta?: Date;
  workerId?: string;
  vehicleId?: string;
  status?: InspectionStatus;
  puedeOperar?: boolean;
  supervisorId?: string;
};

const TREINTA_DIAS_MS = 30 * 24 * 60 * 60 * 1000;
const LIMITE_DIAS_TENDENCIA = 400; // salvaguarda ante un rango absurdamente largo

function finDelDiaUTC(fecha: Date): Date {
  return new Date(Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), fecha.getUTCDate(), 23, 59, 59, 999));
}

/**
 * Sin `fechaDesde`/`fechaHasta` explícitos, default a los últimos 30 días —
 * así la comparación contra "período anterior" (`getKpisReporte`) siempre
 * tiene un rango equivalente, incluso sin filtro de fecha en la URL.
 */
function normalizarRango(filtros: FiltrosReporte): { desde: Date; hasta: Date } {
  const hasta = filtros.fechaHasta ? finDelDiaUTC(filtros.fechaHasta) : new Date();
  const desde = filtros.fechaDesde ?? new Date(hasta.getTime() - TREINTA_DIAS_MS);
  return { desde, hasta };
}

function construirWhereReporte(filtros: FiltrosReporte, rango: { desde: Date; hasta: Date }) {
  const where: NonNullable<Parameters<typeof prisma.inspection.findMany>[0]>["where"] = {
    startedAt: { gte: rango.desde, lte: rango.hasta },
  };
  if (filtros.workerId) where.workerId = filtros.workerId;
  if (filtros.vehicleId) where.vehicleId = filtros.vehicleId;
  if (filtros.status) where.status = filtros.status;
  if (filtros.puedeOperar !== undefined) where.puedeOperar = filtros.puedeOperar;
  if (filtros.supervisorId) where.supervisorId = filtros.supervisorId;
  return where;
}

// ---------------------------------------------------------------------------
// 2a. KPIs + comparación contra el período anterior equivalente
// ---------------------------------------------------------------------------

export type KpisReporte = {
  total: number;
  aprobadas: number;
  rechazadas: number;
  conNovedades: number;
  pendientesAprobacion: number;
  tasaAprobacion: number; // 0-100, un decimal
};

async function calcularKpis(where: ReturnType<typeof construirWhereReporte>): Promise<KpisReporte> {
  const [total, aprobadas, rechazadas, pendientesAprobacion, conNovedades] = await Promise.all([
    prisma.inspection.count({ where }),
    prisma.inspection.count({ where: { ...where, status: InspectionStatus.APROBADA } }),
    prisma.inspection.count({ where: { ...where, status: InspectionStatus.RECHAZADA } }),
    prisma.inspection.count({
      where: {
        ...where,
        reviewedAt: null,
        status: { in: [InspectionStatus.PENDIENTE_APROBACION, InspectionStatus.NO_APTA_PARA_OPERAR] },
      },
    }),
    prisma.inspection.count({ where: { ...where, novedades: { some: {} } } }),
  ]);

  const tasaAprobacion = total === 0 ? 0 : Math.round((aprobadas / total) * 1000) / 10;
  return { total, aprobadas, rechazadas, conNovedades, pendientesAprobacion, tasaAprobacion };
}

export type KpisConComparacion = KpisReporte & { anterior: KpisReporte };

/**
 * KPIs del período filtrado más los mismos KPIs del "período anterior
 * equivalente" (mismo número de días, inmediatamente antes) para poder
 * mostrar la variación (↑/↓) en cada tarjeta.
 */
export async function getKpisReporte(filtros: FiltrosReporte): Promise<KpisConComparacion> {
  const rango = normalizarRango(filtros);
  const where = construirWhereReporte(filtros, rango);

  const duracionMs = rango.hasta.getTime() - rango.desde.getTime();
  const rangoAnterior = {
    desde: new Date(rango.desde.getTime() - duracionMs),
    hasta: new Date(rango.desde.getTime() - 1),
  };
  const whereAnterior = construirWhereReporte(filtros, rangoAnterior);

  const [actual, anterior] = await Promise.all([calcularKpis(where), calcularKpis(whereAnterior)]);
  return { ...actual, anterior };
}

// ---------------------------------------------------------------------------
// 2b. Tendencia diaria (alimenta el gráfico de línea y el heatmap)
// ---------------------------------------------------------------------------

export type PuntoTendencia = { fecha: string; total: number; aprobadas: number; tasaAprobacion: number };

export async function getTendenciaDiaria(filtros: FiltrosReporte): Promise<PuntoTendencia[]> {
  const rango = normalizarRango(filtros);
  const where = construirWhereReporte(filtros, rango);

  const inspecciones = await prisma.inspection.findMany({
    where,
    select: { startedAt: true, status: true },
  });

  const porDia = new Map<string, { total: number; aprobadas: number }>();
  for (const insp of inspecciones) {
    const clave = insp.startedAt.toISOString().slice(0, 10);
    const entry = porDia.get(clave) ?? { total: 0, aprobadas: 0 };
    entry.total += 1;
    if (insp.status === InspectionStatus.APROBADA) entry.aprobadas += 1;
    porDia.set(clave, entry);
  }

  const resultado: PuntoTendencia[] = [];
  const cursor = new Date(Date.UTC(rango.desde.getUTCFullYear(), rango.desde.getUTCMonth(), rango.desde.getUTCDate()));
  const limite = new Date(Date.UTC(rango.hasta.getUTCFullYear(), rango.hasta.getUTCMonth(), rango.hasta.getUTCDate()));
  let dias = 0;
  while (cursor.getTime() <= limite.getTime() && dias < LIMITE_DIAS_TENDENCIA) {
    const clave = cursor.toISOString().slice(0, 10);
    const entry = porDia.get(clave) ?? { total: 0, aprobadas: 0 };
    resultado.push({
      fecha: clave,
      total: entry.total,
      aprobadas: entry.aprobadas,
      tasaAprobacion: entry.total === 0 ? 0 : Math.round((entry.aprobadas / entry.total) * 1000) / 10,
    });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    dias += 1;
  }
  return resultado;
}

// ---------------------------------------------------------------------------
// 2c. Cumplimiento (tasa de aprobación) por trabajador
// ---------------------------------------------------------------------------

export type FilaTrabajador = {
  workerId: string;
  nombre: string;
  total: number;
  aprobadas: number;
  rechazadas: number;
  novedades: number;
  tasaAprobacion: number;
};

export type SortTrabajador = "nombre" | "total" | "aprobadas" | "rechazadas" | "novedades" | "tasaAprobacion";

/** Orden por defecto: tasa de aprobación ascendente — los casos que más necesitan atención primero. */
export async function getCumplimientoPorTrabajador(
  filtros: FiltrosReporte,
  sort: SortTrabajador = "tasaAprobacion",
  dir: "asc" | "desc" = "asc",
): Promise<FilaTrabajador[]> {
  const rango = normalizarRango(filtros);
  const where = construirWhereReporte(filtros, rango);

  const inspecciones = await prisma.inspection.findMany({
    where,
    select: {
      workerId: true,
      worker: { select: { name: true } },
      status: true,
      novedades: { select: { id: true } },
    },
  });

  const porTrabajador = new Map<string, FilaTrabajador>();
  for (const insp of inspecciones) {
    const fila = porTrabajador.get(insp.workerId) ?? {
      workerId: insp.workerId,
      nombre: insp.worker.name,
      total: 0,
      aprobadas: 0,
      rechazadas: 0,
      novedades: 0,
      tasaAprobacion: 0,
    };
    fila.total += 1;
    if (insp.status === InspectionStatus.APROBADA) fila.aprobadas += 1;
    if (insp.status === InspectionStatus.RECHAZADA) fila.rechazadas += 1;
    fila.novedades += insp.novedades.length;
    porTrabajador.set(insp.workerId, fila);
  }

  const filas = [...porTrabajador.values()].map((f) => ({
    ...f,
    tasaAprobacion: f.total === 0 ? 0 : Math.round((f.aprobadas / f.total) * 1000) / 10,
  }));

  return ordenarFilas(filas, sort, dir);
}

// ---------------------------------------------------------------------------
// 2d. Estado por vehículo
// ---------------------------------------------------------------------------

export type FilaVehiculo = {
  vehicleId: string;
  placa: string;
  total: number;
  aprobadas: number;
  rechazadas: number;
  novedades: number;
  ultimaInspeccion: Date;
};

export type SortVehiculo = "placa" | "total" | "aprobadas" | "rechazadas" | "novedades" | "ultimaInspeccion";

export async function getEstadoPorVehiculo(
  filtros: FiltrosReporte,
  sort: SortVehiculo = "novedades",
  dir: "asc" | "desc" = "desc",
): Promise<FilaVehiculo[]> {
  const rango = normalizarRango(filtros);
  const where = construirWhereReporte(filtros, rango);

  const inspecciones = await prisma.inspection.findMany({
    where,
    select: {
      vehicleId: true,
      vehicle: { select: { placa: true } },
      status: true,
      startedAt: true,
      novedades: { select: { id: true } },
    },
  });

  const porVehiculo = new Map<string, FilaVehiculo>();
  for (const insp of inspecciones) {
    const fila = porVehiculo.get(insp.vehicleId) ?? {
      vehicleId: insp.vehicleId,
      placa: insp.vehicle.placa,
      total: 0,
      aprobadas: 0,
      rechazadas: 0,
      novedades: 0,
      ultimaInspeccion: insp.startedAt,
    };
    fila.total += 1;
    if (insp.status === InspectionStatus.APROBADA) fila.aprobadas += 1;
    if (insp.status === InspectionStatus.RECHAZADA) fila.rechazadas += 1;
    fila.novedades += insp.novedades.length;
    if (insp.startedAt.getTime() > fila.ultimaInspeccion.getTime()) fila.ultimaInspeccion = insp.startedAt;
    porVehiculo.set(insp.vehicleId, fila);
  }

  return ordenarFilas([...porVehiculo.values()], sort, dir);
}

function ordenarFilas<T extends Record<string, unknown>>(filas: T[], sort: keyof T, dir: "asc" | "desc"): T[] {
  const factor = dir === "asc" ? 1 : -1;
  return [...filas].sort((a, b) => {
    const va = a[sort];
    const vb = b[sort];
    if (va instanceof Date && vb instanceof Date) return factor * (va.getTime() - vb.getTime());
    if (typeof va === "string" && typeof vb === "string") return factor * va.localeCompare(vb);
    return factor * ((va as number) - (vb as number));
  });
}

// ---------------------------------------------------------------------------
// 2e. Novedades por tipo / elementos con más fallas
// ---------------------------------------------------------------------------

export type NovedadPorTipo = { tipo: TipoNovedad; cantidad: number; porcentaje: number };

export async function getNovedadesPorTipo(filtros: FiltrosReporte): Promise<NovedadPorTipo[]> {
  const rango = normalizarRango(filtros);
  const where = construirWhereReporte(filtros, rango);

  const novedades = await prisma.novedad.findMany({
    where: { inspection: where },
    select: { tipo: true },
  });

  const conteo = new Map<TipoNovedad, number>();
  for (const n of novedades) {
    conteo.set(n.tipo, (conteo.get(n.tipo) ?? 0) + 1);
  }
  const total = novedades.length;
  return [...conteo.entries()]
    .map(([tipo, cantidad]) => ({
      tipo,
      cantidad,
      porcentaje: total === 0 ? 0 : Math.round((cantidad / total) * 1000) / 10,
    }))
    .sort((a, b) => b.cantidad - a.cantidad);
}

export type FallaPorItem = { nombre: string; cantidad: number };

export async function getFallasPorItem(filtros: FiltrosReporte): Promise<FallaPorItem[]> {
  const rango = normalizarRango(filtros);
  const where = construirWhereReporte(filtros, rango);

  // Corrección Slice 2 (hallazgo CRITICAL #4): antes solo filtraba
  // `valor === FALLA`, excluyendo MALO — pero `esNovedad()` trata FALLA
  // (binario) y MALO (triestado, ítems de fluidos) como igual de severos
  // (ambos crean Novedad). Un ítem de fluido en MALO desaparecía
  // silenciosamente de "elementos con más fallas".
  const respuestas = await prisma.inspectionItemResponse.findMany({
    where: { valor: { in: VALORES_FALLA }, inspection: where },
    select: { checklistItem: { select: { nombre: true } } },
  });

  const conteo = new Map<string, number>();
  for (const r of respuestas) {
    conteo.set(r.checklistItem.nombre, (conteo.get(r.checklistItem.nombre) ?? 0) + 1);
  }
  return [...conteo.entries()].map(([nombre, cantidad]) => ({ nombre, cantidad })).sort((a, b) => b.cantidad - a.cantidad);
}

// ---------------------------------------------------------------------------
// 2g. Listas para los <select> de filtro
// ---------------------------------------------------------------------------

export type OpcionFiltro = { id: string; nombre: string };

export async function getTrabajadoresParaFiltro(): Promise<OpcionFiltro[]> {
  const trabajadores = await prisma.user.findMany({
    where: { role: Role.TRABAJADOR },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return trabajadores.map((t) => ({ id: t.id, nombre: t.name }));
}

export async function getSupervisoresParaFiltro(): Promise<OpcionFiltro[]> {
  const supervisores = await prisma.user.findMany({
    where: { role: Role.SUPERVISOR },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return supervisores.map((s) => ({ id: s.id, nombre: s.name }));
}

// ---------------------------------------------------------------------------
// Parser de filtros compartido entre la página del dashboard y la ruta de
// exportación a Excel (app/api/reportes/excel/route.ts) — así los dos leen
// los mismos query params de la misma forma, sin duplicar la lógica.
// ---------------------------------------------------------------------------

const ESTADOS_VALIDOS = new Set<string>(Object.values(InspectionStatus));

export function parseFiltrosDesdeQuery(query: Record<string, string | undefined>): FiltrosReporte {
  const estado = query.estado && ESTADOS_VALIDOS.has(query.estado) ? (query.estado as InspectionStatus) : undefined;
  const puedeOperar = query.resultado === "si" ? true : query.resultado === "no" ? false : undefined;

  return {
    fechaDesde: query.fechaDesde ? new Date(query.fechaDesde) : undefined,
    fechaHasta: query.fechaHasta ? new Date(query.fechaHasta) : undefined,
    workerId: query.trabajador || undefined,
    status: estado,
    puedeOperar,
    supervisorId: query.supervisor || undefined,
  };
}

/** Etiqueta legible de `InspectionStatus` — compartida entre la tabla de detalle y la exportación a Excel. */
export function estadoLegible(status: string): string {
  switch (status) {
    case "APROBADA":
      return "Aprobada";
    case "RECHAZADA":
      return "Rechazada";
    case "NO_APTA_PARA_OPERAR":
      return "No apta";
    case "PENDIENTE_APROBACION":
      return "Pendiente";
    case "ENVIADA":
      return "Enviada";
    case "EN_PROCESO":
      return "En proceso";
    case "CANCELADA":
      return "Cancelada";
    default:
      return status;
  }
}
