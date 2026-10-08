import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { InspectionStatus, Role, RespuestaChecklist, TipoRespuestaItem } from "@/generated/prisma/client";
import { getFallasPorItem, getTendenciaDiaria, normalizarRango } from "@/lib/inspections/reportes-queries";
import {
  crearCatalogoMinimo,
  crearChecklistItem,
  crearUsuario,
  crearVehiculo,
  limpiarBaseDeTest,
} from "@/test/helpers/db";

beforeEach(async () => {
  await limpiarBaseDeTest();
});

afterAll(async () => {
  await limpiarBaseDeTest();
  await prisma.$disconnect();
});

// Corrección Slice 2 (hallazgo CRITICAL #4): "elementos con más fallas" solo
// contaba `valor === FALLA`, mientras que `esNovedad()`
// (lib/inspections/respuesta.ts) — la única fuente de verdad de "esto es una
// falla real" — también trata MALO (ítems TRIESTADO de fluidos) como
// falla. Un ítem de fluido en MALO desaparecía silenciosamente de este
// reporte gerencial.
describe("getFallasPorItem", () => {
  it("cuenta tanto FALLA (binario) como MALO (triestado) — mismo criterio que esNovedad()", async () => {
    const worker = await crearUsuario(Role.TRABAJADOR);
    const vehicle = await crearVehiculo();
    const { categoria } = await crearCatalogoMinimo();
    const itemBinario = await crearChecklistItem(categoria.id, { nombre: "Frenos" });
    const itemFluido = await crearChecklistItem(categoria.id, {
      nombre: "Nivel de aceite",
      tipoRespuesta: TipoRespuestaItem.TRIESTADO,
    });

    const inspection = await prisma.inspection.create({
      data: { workerId: worker.id, conductorId: worker.id, vehicleId: vehicle.id },
    });

    await prisma.inspectionItemResponse.create({
      data: { inspectionId: inspection.id, checklistItemId: itemBinario.id, valor: RespuestaChecklist.FALLA },
    });
    await prisma.inspectionItemResponse.create({
      data: { inspectionId: inspection.id, checklistItemId: itemFluido.id, valor: RespuestaChecklist.MALO },
    });

    const fallas = await getFallasPorItem({});

    const nombres = fallas.map((f) => f.nombre);
    expect(nombres).toContain("Frenos");
    expect(nombres).toContain("Nivel de aceite");
  });

  it("no cuenta BAJO (triestado) — no es una falla, solo dato/advertencia", async () => {
    const worker = await crearUsuario(Role.TRABAJADOR);
    const vehicle = await crearVehiculo();
    const { categoria } = await crearCatalogoMinimo();
    const itemFluido = await crearChecklistItem(categoria.id, {
      nombre: "Nivel refrigerante",
      tipoRespuesta: TipoRespuestaItem.TRIESTADO,
    });

    const inspection = await prisma.inspection.create({
      data: { workerId: worker.id, conductorId: worker.id, vehicleId: vehicle.id },
    });
    await prisma.inspectionItemResponse.create({
      data: { inspectionId: inspection.id, checklistItemId: itemFluido.id, valor: RespuestaChecklist.BAJO },
    });

    const fallas = await getFallasPorItem({});

    expect(fallas.map((f) => f.nombre)).not.toContain("Nivel refrigerante");
  });
});

// "Inspecciones recientes" del dashboard mostraba las 5 más nuevas de todos los
// tiempos mientras KPIs, tendencia y heatmap miraban solo los últimos 30 días:
// la página necesita el MISMO rango efectivo que usan las agregaciones.
describe("normalizarRango", () => {
  const AHORA = new Date("2026-09-19T15:00:00.000Z");

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(AHORA);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("sin fechas explícitas devuelve los últimos 30 días hasta ahora", () => {
    const { desde, hasta } = normalizarRango({});

    expect(hasta.toISOString()).toBe("2026-09-19T15:00:00.000Z");
    expect(desde.toISOString()).toBe("2026-08-20T15:00:00.000Z");
  });

  it("fechaDesde/fechaHasta son días de Bogotá: de 00:00 a 23:59:59.999 hora de Colombia", () => {
    const { desde, hasta } = normalizarRango({
      fechaDesde: new Date("2026-09-01T00:00:00.000Z"),
      fechaHasta: new Date("2026-09-10T00:00:00.000Z"),
    });

    expect(desde.toISOString()).toBe("2026-09-01T05:00:00.000Z");
    expect(hasta.toISOString()).toBe("2026-09-11T04:59:59.999Z");
  });

  it("con solo fechaHasta cuenta 30 días hacia atrás desde ese fin de día", () => {
    const { desde, hasta } = normalizarRango({ fechaHasta: new Date("2026-09-10T00:00:00.000Z") });

    expect(hasta.toISOString()).toBe("2026-09-11T04:59:59.999Z");
    expect(desde.toISOString()).toBe("2026-08-12T04:59:59.999Z");
  });
});

// Los días del dashboard son días de Bogotá: una inspección enviada a las
// 19:30 en Colombia (00:30 UTC del día siguiente) cuenta en el día local.
describe("getTendenciaDiaria (días de Bogotá)", () => {
  it("agrupa por día de Bogotá, no por día UTC", async () => {
    const worker = await crearUsuario(Role.TRABAJADOR);
    const vehicle = await crearVehiculo();
    const base = { workerId: worker.id, conductorId: worker.id, vehicleId: vehicle.id, status: InspectionStatus.APROBADA };
    // 7 oct 19:30 Bogotá = 8 oct 00:30 UTC
    await prisma.inspection.create({ data: { ...base, startedAt: new Date("2026-10-08T00:30:00Z") } });
    // 8 oct 00:30 Bogotá = 8 oct 05:30 UTC
    await prisma.inspection.create({ data: { ...base, startedAt: new Date("2026-10-08T05:30:00Z") } });

    const tendencia = await getTendenciaDiaria({
      fechaDesde: new Date("2026-10-06T00:00:00Z"),
      fechaHasta: new Date("2026-10-08T00:00:00Z"),
    });

    expect(tendencia.map((p) => [p.fecha, p.total])).toEqual([
      ["2026-10-06", 0],
      ["2026-10-07", 1],
      ["2026-10-08", 1],
    ]);
  });
});
