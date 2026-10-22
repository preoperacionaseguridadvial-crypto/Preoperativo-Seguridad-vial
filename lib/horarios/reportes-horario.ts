import "server-only";
import { prisma } from "@/lib/prisma";
import { InspectionStatus, type Sede, type TipoHabilitacion } from "@/generated/prisma/client";
import { normalizarRango, type FiltrosReporte } from "@/lib/inspections/reportes-queries";
import { plazoVencido, PLAZO_APROBACION_MINUTOS } from "@/lib/horarios/plazo-aprobacion";
import {
  decisionesDeInspeccion,
  minutosEntre,
  promedioMinutos,
  type EtapaAprobacion,
} from "@/lib/horarios/metricas-horario";

// Métricas de cumplimiento de horarios (dashboard + Excel). Usa los mismos
// filtros que el resto del dashboard (`FiltrosReporte`: rango de fechas con el
// default de 30 días de `normalizarRango`, y `sede`); el resto de filtros
// (recorredor, placa, estado...) no aplica a estas métricas.
//
// Fecha sobre la que filtra el rango, por métrica:
// - Inspecciones (envíos fuera de horario, duración, tiempos de respuesta y
//   decisiones fuera de plazo): `completedAt` (fecha de envío). Una decisión
//   cuenta en el período en que se ENVIÓ la inspección, no en el que se decidió.
// - Intentos bloqueados (AuditLog): `createdAt` del registro.
// - Habilitaciones SST: `createdAt` (fecha en que se otorgó, no el rango desde/hasta).
// - Pendientes con plazo vencido: estado ACTUAL; ignora el rango de fechas (solo
//   aplica la sede), porque describe lo que está pendiente ahora.
//
// Sede: inspecciones por su `sede` (snapshot). Intentos bloqueados de recorredor
// y habilitaciones por la sede actual del usuario; intentos bloqueados de
// aprobación por la sede de la inspección. Los aprobadores sin sede (Director)
// aparecen en ambas sedes porque deciden inspecciones de las dos.

export type FiltrosHorarios = Pick<FiltrosReporte, "fechaDesde" | "fechaHasta" | "sede">;

export type FilaFueraDeHorario = {
  workerId: string;
  nombre: string;
  enviadasFueraDeHorario: number;
  intentosBloqueados: number;
};
export type FilaDuracion = { workerId: string; nombre: string; inspecciones: number; promedioMinutos: number };
export type FilaRespuestaAprobador = {
  aprobadorId: string;
  nombre: string;
  etapa: EtapaAprobacion;
  decisiones: number;
  promedioMinutos: number;
};
export type FilaRespuestaEtapa = { etapa: EtapaAprobacion; decisiones: number; promedioMinutos: number };
export type FilaVencidas = {
  aprobadorId: string;
  nombre: string;
  decididasFueraDePlazo: number;
  intentosBloqueados: number;
};
export type FilaHabilitacion = {
  id: string;
  tipo: TipoHabilitacion;
  beneficiario: string;
  desde: Date;
  hasta: Date;
  justificacion: string;
  otorgadaPor: string;
  createdAt: Date;
};

export type ReporteHorarios = {
  fueraDeHorario: FilaFueraDeHorario[];
  duracionPorRecorredor: FilaDuracion[];
  respuestaPorAprobador: FilaRespuestaAprobador[];
  respuestaPorEtapa: FilaRespuestaEtapa[];
  vencidasPorAprobador: FilaVencidas[];
  pendientesVencidas: Record<EtapaAprobacion, number>;
  habilitaciones: FilaHabilitacion[];
};

const ACCION_INSPECCION_BLOQUEADA = "INSPECCION_FUERA_DE_HORARIO_BLOQUEADA";
const ACCION_APROBACION_BLOQUEADA = "APROBACION_FUERA_DE_PLAZO_BLOQUEADA";

export async function getReporteHorarios(filtros: FiltrosHorarios): Promise<ReporteHorarios> {
  const rango = normalizarRango(filtros);
  const sede: Sede | undefined = filtros.sede;
  const ahora = new Date();
  const rangoCompletado = { gte: rango.desde, lte: rango.hasta };
  const rangoCreado = { gte: rango.desde, lte: rango.hasta };

  const [inspecciones, pendientes, auditorias, habilitacionesDb] = await Promise.all([
    prisma.inspection.findMany({
      where: { completedAt: rangoCompletado, ...(sede && { sede }) },
      select: {
        workerId: true,
        worker: { select: { name: true } },
        sede: true,
        startedAt: true,
        completedAt: true,
        approvedAt: true,
        rejectedAt: true,
        revisadaSupervisorOleariariAt: true,
        supervisorId: true,
        supervisor: { select: { name: true } },
        supervisorOleariariId: true,
        supervisorOleariari: { select: { name: true } },
        enviadaFueraDeHorario: true,
      },
    }),
    prisma.inspection.findMany({
      where: {
        status: { in: [InspectionStatus.PENDIENTE_APROBACION, InspectionStatus.NO_APTA_PARA_OPERAR] },
        reviewedAt: null,
        // El plazo nunca vence antes de 60 min desde el envío: prefiltro en BD.
        completedAt: { not: null, lte: new Date(ahora.getTime() - PLAZO_APROBACION_MINUTOS * 60_000) },
        ...(sede && { sede }),
      },
      select: { sede: true, completedAt: true, revisadaSupervisorOleariariAt: true },
    }),
    prisma.auditLog.findMany({
      where: {
        action: { in: [ACCION_INSPECCION_BLOQUEADA, ACCION_APROBACION_BLOQUEADA] },
        createdAt: rangoCreado,
      },
      select: {
        action: true,
        entityId: true,
        userId: true,
        user: { select: { name: true, sede: true } },
      },
    }),
    prisma.habilitacionHorario.findMany({
      where: { createdAt: rangoCreado },
      orderBy: { createdAt: "desc" },
      include: { usuario: { select: { name: true, sede: true } }, otorgadaPor: { select: { name: true } } },
    }),
  ]);

  // 1. Fuera de horario por recorredor.
  const fuera = new Map<string, FilaFueraDeHorario>();
  const filaFuera = (workerId: string, nombre: string) => {
    const fila = fuera.get(workerId) ?? { workerId, nombre, enviadasFueraDeHorario: 0, intentosBloqueados: 0 };
    fuera.set(workerId, fila);
    return fila;
  };
  for (const i of inspecciones) {
    if (i.enviadaFueraDeHorario) filaFuera(i.workerId, i.worker.name).enviadasFueraDeHorario += 1;
  }

  // Sede de las inspecciones citadas por los bloqueos de aprobación (una sola consulta).
  const auditAprobacion = auditorias.filter((a) => a.action === ACCION_APROBACION_BLOQUEADA);
  const sedePorInspeccion = new Map<string, Sede | null>();
  if (sede && auditAprobacion.length > 0) {
    const ids = [...new Set(auditAprobacion.map((a) => a.entityId))];
    const filas = await prisma.inspection.findMany({ where: { id: { in: ids } }, select: { id: true, sede: true } });
    for (const f of filas) sedePorInspeccion.set(f.id, f.sede);
  }

  for (const a of auditorias) {
    if (a.action !== ACCION_INSPECCION_BLOQUEADA) continue;
    if (sede && a.user.sede !== sede) continue;
    filaFuera(a.userId, a.user.name).intentosBloqueados += 1;
  }

  // 2. Duración promedio de inspección por recorredor.
  const duraciones = new Map<string, { nombre: string; minutos: number[] }>();
  for (const i of inspecciones) {
    if (i.completedAt === null) continue;
    const e = duraciones.get(i.workerId) ?? { nombre: i.worker.name, minutos: [] };
    e.minutos.push(minutosEntre(i.startedAt, i.completedAt));
    duraciones.set(i.workerId, e);
  }

  // 3 y 4. Tiempos de respuesta y decisiones fuera de plazo.
  const porAprobador = new Map<string, { aprobadorId: string; nombre: string; etapa: EtapaAprobacion; minutos: number[] }>();
  const porEtapa = new Map<EtapaAprobacion, number[]>();
  const vencidas = new Map<string, FilaVencidas>();
  const filaVencidas = (aprobadorId: string, nombre: string) => {
    const fila = vencidas.get(aprobadorId) ?? { aprobadorId, nombre, decididasFueraDePlazo: 0, intentosBloqueados: 0 };
    vencidas.set(aprobadorId, fila);
    return fila;
  };
  for (const i of inspecciones) {
    for (const d of decisionesDeInspeccion(i)) {
      const nombre = (d.etapa === "SUPERVISOR_OLEARIARI" ? i.supervisorOleariari?.name : i.supervisor?.name) ?? "";
      const clave = `${d.aprobadorId}|${d.etapa}`;
      const e = porAprobador.get(clave) ?? { aprobadorId: d.aprobadorId, nombre, etapa: d.etapa, minutos: [] };
      e.minutos.push(d.minutos);
      porAprobador.set(clave, e);
      porEtapa.set(d.etapa, [...(porEtapa.get(d.etapa) ?? []), d.minutos]);
      if (d.fueraDePlazo) filaVencidas(d.aprobadorId, nombre).decididasFueraDePlazo += 1;
    }
  }
  for (const a of auditAprobacion) {
    if (sede && sedePorInspeccion.get(a.entityId) !== sede) continue;
    filaVencidas(a.userId, a.user.name).intentosBloqueados += 1;
  }

  // Pendientes con plazo vencido ahora, por etapa.
  const pendientesVencidas: Record<EtapaAprobacion, number> = { SUPERVISOR_OLEARIARI: 0, SUPERVISOR: 0 };
  for (const p of pendientes) {
    if (!plazoVencido(p, ahora)) continue;
    const etapa: EtapaAprobacion =
      p.sede === "OLEARIARI" && p.revisadaSupervisorOleariariAt === null ? "SUPERVISOR_OLEARIARI" : "SUPERVISOR";
    pendientesVencidas[etapa] += 1;
  }

  // 5. Habilitaciones (filtro de sede por la sede actual del beneficiario).
  const habilitaciones: FilaHabilitacion[] = habilitacionesDb
    .filter((h) => !sede || h.usuario.sede === sede)
    .map((h) => ({
      id: h.id,
      tipo: h.tipo,
      beneficiario: h.usuario.name,
      desde: h.desde,
      hasta: h.hasta,
      justificacion: h.justificacion,
      otorgadaPor: h.otorgadaPor.name,
      createdAt: h.createdAt,
    }));

  return {
    fueraDeHorario: [...fuera.values()].sort(
      (a, b) => b.enviadasFueraDeHorario + b.intentosBloqueados - (a.enviadasFueraDeHorario + a.intentosBloqueados),
    ),
    duracionPorRecorredor: [...duraciones.entries()]
      .map(([workerId, e]) => ({
        workerId,
        nombre: e.nombre,
        inspecciones: e.minutos.length,
        promedioMinutos: promedioMinutos(e.minutos) ?? 0,
      }))
      .sort((a, b) => b.promedioMinutos - a.promedioMinutos),
    respuestaPorAprobador: [...porAprobador.values()]
      .map((e) => ({
        aprobadorId: e.aprobadorId,
        nombre: e.nombre,
        etapa: e.etapa,
        decisiones: e.minutos.length,
        promedioMinutos: promedioMinutos(e.minutos) ?? 0,
      }))
      .sort((a, b) => b.promedioMinutos - a.promedioMinutos),
    respuestaPorEtapa: [...porEtapa.entries()].map(([etapa, minutos]) => ({
      etapa,
      decisiones: minutos.length,
      promedioMinutos: promedioMinutos(minutos) ?? 0,
    })),
    vencidasPorAprobador: [...vencidas.values()].sort(
      (a, b) => b.decididasFueraDePlazo + b.intentosBloqueados - (a.decididasFueraDePlazo + a.intentosBloqueados),
    ),
    pendientesVencidas,
    habilitaciones,
  };
}
