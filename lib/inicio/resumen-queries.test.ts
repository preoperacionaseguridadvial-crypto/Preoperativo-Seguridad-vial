import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { InspectionStatus, Role } from "@/generated/prisma/client";
import {
  getResumenDelDia,
  getVehiculosConDocumentosPorVencer,
} from "@/lib/inicio/resumen-queries";
import { crearUsuario, crearVehiculo, limpiarBaseDeTest } from "@/test/helpers/db";

const DIA = 24 * 60 * 60 * 1000;

async function crearInspeccion(
  status: InspectionStatus,
  extra: Partial<{
    startedAt: Date;
    reviewedAt: Date | null;
    consumioAlcohol: boolean;
  }> = {},
) {
  const vehicle = await crearVehiculo();
  const worker = await crearUsuario(Role.TRABAJADOR, { vehicleId: vehicle.id });
  return prisma.inspection.create({
    data: { workerId: worker.id, conductorId: worker.id, vehicleId: vehicle.id, status, ...extra },
  });
}

describe("getResumenDelDia", () => {
  beforeEach(async () => {
    await limpiarBaseDeTest();
  });

  it("cuenta las inspecciones del día de Bogotá y los pendientes totales", async () => {
    const ahora = new Date("2026-10-07T15:00:00Z");
    const hoy = new Date("2026-10-07T12:00:00Z");
    const ayer = new Date(hoy.getTime() - DIA);
    await crearInspeccion(InspectionStatus.APROBADA, { startedAt: hoy });
    await crearInspeccion(InspectionStatus.APROBADA, { startedAt: hoy });
    await crearInspeccion(InspectionStatus.NO_APTA_PARA_OPERAR, { startedAt: hoy });
    await crearInspeccion(InspectionStatus.PENDIENTE_APROBACION, { startedAt: hoy });
    await crearInspeccion(InspectionStatus.RECHAZADA, { startedAt: hoy });
    // No son "realizadas": en proceso y cancelada.
    await crearInspeccion(InspectionStatus.EN_PROCESO, { startedAt: hoy });
    await crearInspeccion(InspectionStatus.CANCELADA, { startedAt: hoy });
    // De ayer: no cuenta en el día, pero su pendiente sí en el total de pendientes.
    await crearInspeccion(InspectionStatus.APROBADA, { startedAt: ayer });
    await crearInspeccion(InspectionStatus.PENDIENTE_APROBACION, { startedAt: ayer });

    expect(await getResumenDelDia(ahora)).toEqual({
      realizadas: 5,
      aprobadas: 2,
      noAptas: 1,
      pendientes: 3,
    });
  });
});

describe("getVehiculosConDocumentosPorVencer", () => {
  beforeEach(async () => {
    await limpiarBaseDeTest();
  });

  it("lista solo vehículos activos con SOAT o tecnomecánica vencidos o por vencer, los más urgentes primero", async () => {
    const ahora = new Date("2026-10-07T15:00:00Z");
    const en = (dias: number) => new Date(ahora.getTime() + dias * DIA);
    const vencido = await crearVehiculo({ placa: "VEN001" });
    const porVencer = await crearVehiculo({ placa: "POR001" });
    const vigente = await crearVehiculo({ placa: "OK0001" });
    const inactivo = await crearVehiculo({ placa: "INA001", activo: false });
    const sinFechas = await crearVehiculo({ placa: "SIN001" });
    await prisma.vehicle.update({ where: { id: vencido.id }, data: { fechaVencimientoSoat: en(-2), fechaVencimientoTecnicomecanica: en(200) } });
    await prisma.vehicle.update({ where: { id: porVencer.id }, data: { fechaVencimientoSoat: en(300), fechaVencimientoTecnicomecanica: en(10) } });
    await prisma.vehicle.update({ where: { id: vigente.id }, data: { fechaVencimientoSoat: en(300), fechaVencimientoTecnicomecanica: en(300) } });
    await prisma.vehicle.update({ where: { id: inactivo.id }, data: { fechaVencimientoSoat: en(-5) } });
    expect(sinFechas.id).toBeTruthy();
    const dueno = await crearUsuario(Role.TRABAJADOR, { vehicleId: vencido.id, name: "Dueño Vencido" });

    const lista = await getVehiculosConDocumentosPorVencer(ahora);

    expect(lista.map((v) => v.placa)).toEqual(["VEN001", "POR001"]);
    expect(lista[0].alertas.map((a) => a.documento)).toEqual(["SOAT"]);
    expect(lista[0].conductor).toEqual({ id: dueno.id, name: "Dueño Vencido" });
    expect(lista[1].conductor).toBeNull();
  });
});
