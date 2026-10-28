import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { InspectionStatus, Role, Sede, TipoHabilitacion } from "@/generated/prisma/client";
import { getReporteHorarios } from "@/lib/horarios/reportes-horario";
import { crearUsuario, crearVehiculo, limpiarBaseDeTest } from "@/test/helpers/db";

beforeEach(async () => {
  await limpiarBaseDeTest();
});
afterEach(() => {
  vi.useRealTimers();
});
afterAll(async () => {
  await limpiarBaseDeTest();
  await prisma.$disconnect();
});

const t = (dia: string, hhmm: string) => new Date(`2026-10-${dia}T${hhmm}:00Z`);
// Rango 10..12 de octubre (días de Bogotá).
const RANGO = { fechaDesde: new Date("2026-10-10"), fechaHasta: new Date("2026-10-12") };

type Extra = Record<string, unknown>;
async function inspeccion(workerId: string, vehicleId: string, extra: Extra) {
  return prisma.inspection.create({
    data: {
      workerId,
      conductorId: workerId,
      vehicleId,
      status: InspectionStatus.PENDIENTE_APROBACION,
      ...extra,
    } as never,
  });
}

describe("getReporteHorarios", () => {
  it("1. fuera de horario por recorredor: enviadas bajo habilitación + intentos bloqueados, filtrado por fecha y sede", async () => {
    const w = await crearUsuario(Role.TRABAJADOR, { name: "Ana", sede: Sede.BOGOTA });
    const w2 = await crearUsuario(Role.TRABAJADOR, { name: "Beto", sede: Sede.OLEARIARI });
    const v = await crearVehiculo();
    await inspeccion(w.id, v.id, { startedAt: t("10", "10:00"), completedAt: t("10", "10:20"), enviadaFueraDeHorario: true, sede: Sede.BOGOTA });
    await inspeccion(w.id, v.id, { startedAt: t("11", "10:00"), completedAt: t("11", "10:20"), enviadaFueraDeHorario: false, sede: Sede.BOGOTA });
    // fuera de rango
    await inspeccion(w.id, v.id, { startedAt: t("20", "10:00"), completedAt: t("20", "10:20"), enviadaFueraDeHorario: true, sede: Sede.BOGOTA });
    await inspeccion(w2.id, v.id, { startedAt: t("10", "10:00"), completedAt: t("10", "10:20"), enviadaFueraDeHorario: true, sede: Sede.OLEARIARI });
    const audit = (userId: string, createdAt: Date, action = "INSPECCION_FUERA_DE_HORARIO_BLOQUEADA") =>
      prisma.auditLog.create({
        data: { userId, action, entityType: "Inspection", entityId: "x", createdAt, metadata: { accion: "ENVIAR" } },
      });
    await audit(w.id, t("10", "12:00"));
    await audit(w.id, t("11", "12:00"));
    await audit(w.id, t("25", "12:00")); // fuera de rango
    await audit(w2.id, t("10", "12:00"));
    await audit(w.id, t("10", "12:00"), "OTRA_ACCION");

    const r = await getReporteHorarios(RANGO);
    expect(r.fueraDeHorario.find((f) => f.workerId === w.id)).toMatchObject({
      nombre: "Ana",
      enviadasFueraDeHorario: 1,
      intentosBloqueados: 2,
    });
    expect(r.fueraDeHorario.find((f) => f.workerId === w2.id)).toMatchObject({
      enviadasFueraDeHorario: 1,
      intentosBloqueados: 1,
    });

    const soloOle = await getReporteHorarios({ ...RANGO, sede: Sede.OLEARIARI });
    expect(soloOle.fueraDeHorario.map((f) => f.workerId)).toEqual([w2.id]);
  });

  it("2. duración promedio por recorredor (startedAt -> completedAt), solo enviadas", async () => {
    const w = await crearUsuario(Role.TRABAJADOR, { name: "Ana", sede: Sede.BOGOTA });
    const v = await crearVehiculo();
    await inspeccion(w.id, v.id, { startedAt: t("10", "10:00"), completedAt: t("10", "10:10"), sede: Sede.BOGOTA });
    await inspeccion(w.id, v.id, { startedAt: t("11", "10:00"), completedAt: t("11", "10:25"), sede: Sede.BOGOTA });
    await inspeccion(w.id, v.id, {
      startedAt: t("11", "11:00"),
      completedAt: null,
      status: InspectionStatus.EN_PROCESO,
      sede: Sede.BOGOTA,
    });
    const r = await getReporteHorarios(RANGO);
    expect(r.duracionPorRecorredor).toEqual([{ workerId: w.id, nombre: "Ana", inspecciones: 2, promedioMinutos: 17.5 }]);
    expect((await getReporteHorarios({ ...RANGO, sede: Sede.OLEARIARI })).duracionPorRecorredor).toEqual([]);
  });

  it("3 y 4. respuesta por etapa/aprobador y vencidas por aprobador", async () => {
    const w = await crearUsuario(Role.TRABAJADOR, { sede: Sede.BOGOTA });
    const dir = await crearUsuario(Role.SUPERVISOR, { name: "Dir" });
    const so = await crearUsuario(Role.SUPERVISOR_OLEARIARI, { name: "SO", sede: Sede.OLEARIARI });
    const v = await crearVehiculo();
    // Ventana de aprobación de la mañana: 5:45-8:00 a. m. de Bogotá = 10:45-13:00 UTC.
    // Bogotá: 20 min, aprobada dentro de la ventana
    await inspeccion(w.id, v.id, {
      sede: Sede.BOGOTA,
      startedAt: t("10", "10:50"),
      completedAt: t("10", "11:00"),
      approvedAt: t("10", "11:20"),
      reviewedAt: t("10", "11:20"),
      status: InspectionStatus.APROBADA,
      supervisorId: dir.id,
    });
    // Bogotá: 90 min, rechazada después de las 8:00 a. m. (fuera de plazo)
    await inspeccion(w.id, v.id, {
      sede: Sede.BOGOTA,
      startedAt: t("10", "11:50"),
      completedAt: t("10", "12:00"),
      rejectedAt: t("10", "13:30"),
      reviewedAt: t("10", "13:30"),
      status: InspectionStatus.RECHAZADA,
      supervisorId: dir.id,
    });
    // Oleariari: etapa 1 10 min (so), etapa 2 40 min (dir)
    await inspeccion(w.id, v.id, {
      sede: Sede.OLEARIARI,
      startedAt: t("11", "10:50"),
      completedAt: t("11", "11:00"),
      revisadaSupervisorOleariariAt: t("11", "11:10"),
      supervisorOleariariId: so.id,
      approvedAt: t("11", "11:50"),
      reviewedAt: t("11", "11:50"),
      status: InspectionStatus.APROBADA,
      supervisorId: dir.id,
    });
    const insp = await inspeccion(w.id, v.id, {
      sede: Sede.BOGOTA,
      startedAt: t("12", "09:00"),
      completedAt: t("12", "09:10"),
    });
    const bloq = (userId: string, entityId: string) =>
      prisma.auditLog.create({
        data: {
          userId,
          action: "APROBACION_FUERA_DE_PLAZO_BLOQUEADA",
          entityType: "Inspection",
          entityId,
          createdAt: t("10", "14:00"),
          metadata: { accion: "APROBAR", etapa: "OLEARIARI" },
        },
      });
    await bloq(dir.id, insp.id);
    await bloq(dir.id, insp.id);

    const r = await getReporteHorarios(RANGO);
    expect(r.respuestaPorAprobador.find((x) => x.aprobadorId === dir.id && x.etapa === "SUPERVISOR")).toMatchObject({
      nombre: "Dir",
      decisiones: 3,
      promedioMinutos: 50,
    });
    expect(r.respuestaPorAprobador.find((x) => x.aprobadorId === so.id)).toMatchObject({
      etapa: "SUPERVISOR_OLEARIARI",
      decisiones: 1,
      promedioMinutos: 10,
    });
    expect(r.respuestaPorEtapa).toEqual(
      expect.arrayContaining([
        { etapa: "SUPERVISOR", decisiones: 3, promedioMinutos: 50 },
        { etapa: "SUPERVISOR_OLEARIARI", decisiones: 1, promedioMinutos: 10 },
      ]),
    );
    expect(r.vencidasPorAprobador).toEqual([
      { aprobadorId: dir.id, nombre: "Dir", decididasFueraDePlazo: 1, intentosBloqueados: 2 },
    ]);

    const ole = await getReporteHorarios({ ...RANGO, sede: Sede.OLEARIARI });
    expect(ole.respuestaPorAprobador.map((x) => x.aprobadorId).sort()).toEqual([dir.id, so.id].sort());
    expect(ole.vencidasPorAprobador).toEqual([]);
    const bog = await getReporteHorarios({ ...RANGO, sede: Sede.BOGOTA });
    expect(bog.vencidasPorAprobador[0]).toMatchObject({ aprobadorId: dir.id, intentosBloqueados: 2 });
  });

  it("4b. pendientes con plazo vencido ahora, por etapa (ignora el rango de fechas)", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(t("20", "23:00")); // 6:00 p. m. de Bogotá: ventana 5:45-8:00 p. m. abierta
    const w = await crearUsuario(Role.TRABAJADOR, { sede: Sede.BOGOTA });
    const v = await crearVehiculo();
    // Bogotá vencida (ventana de las 8:00 a. m. ya cerró) y vigente (enviada 5:50 p. m.)
    await inspeccion(w.id, v.id, { sede: Sede.BOGOTA, completedAt: t("20", "12:00") });
    await inspeccion(w.id, v.id, { sede: Sede.BOGOTA, completedAt: t("20", "22:50") });
    // Oleariari etapa 1 vencida
    await inspeccion(w.id, v.id, { sede: Sede.OLEARIARI, completedAt: t("20", "12:30") });
    // Oleariari etapa 2: revisión a las 5:30 p. m. (ventana de la tarde, vigente) aunque se envió en la mañana
    await inspeccion(w.id, v.id, {
      sede: Sede.OLEARIARI,
      completedAt: t("20", "11:00"),
      revisadaSupervisorOleariariAt: t("20", "22:30"),
    });
    // Oleariari etapa 2 vencida (revisada a las 7:00 a. m.)
    await inspeccion(w.id, v.id, {
      sede: Sede.OLEARIARI,
      completedAt: t("20", "11:00"),
      revisadaSupervisorOleariariAt: t("20", "12:00"),
    });

    const r = await getReporteHorarios(RANGO);
    expect(r.pendientesVencidas).toEqual({ SUPERVISOR_OLEARIARI: 1, SUPERVISOR: 2 });
    const ole = await getReporteHorarios({ ...RANGO, sede: Sede.OLEARIARI });
    expect(ole.pendientesVencidas).toEqual({ SUPERVISOR_OLEARIARI: 1, SUPERVISOR: 1 });
  });

  it("5. lista de habilitaciones por createdAt, con filtro de sede por beneficiario", async () => {
    const w = await crearUsuario(Role.TRABAJADOR, { name: "Ana", sede: Sede.BOGOTA });
    const so = await crearUsuario(Role.SUPERVISOR_OLEARIARI, { name: "SO", sede: Sede.OLEARIARI });
    const sst = await crearUsuario(Role.SST, { name: "Sandra" });
    const mk = (usuarioId: string, tipo: TipoHabilitacion, createdAt: Date) =>
      prisma.habilitacionHorario.create({
        data: {
          usuarioId,
          tipo,
          desde: t("10", "05:00"),
          hasta: t("10", "07:00"),
          justificacion: "Motivo suficiente",
          otorgadaPorId: sst.id,
          createdAt,
        },
      });
    await mk(w.id, TipoHabilitacion.RECORREDOR, t("10", "08:00"));
    await mk(so.id, TipoHabilitacion.APROBACION, t("11", "08:00"));
    await mk(w.id, TipoHabilitacion.RECORREDOR, t("28", "08:00")); // fuera de rango

    const r = await getReporteHorarios(RANGO);
    expect(r.habilitaciones).toHaveLength(2);
    expect(r.habilitaciones[0]).toMatchObject({
      tipo: "APROBACION",
      beneficiario: "SO",
      otorgadaPor: "Sandra",
      justificacion: "Motivo suficiente",
    });
    const ole = await getReporteHorarios({ ...RANGO, sede: Sede.OLEARIARI });
    expect(ole.habilitaciones.map((h) => h.beneficiario)).toEqual(["SO"]);
  });
});
