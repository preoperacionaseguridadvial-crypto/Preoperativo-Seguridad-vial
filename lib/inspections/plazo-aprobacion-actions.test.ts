import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockAuth = vi.fn();
vi.mock("@/lib/auth/config", () => ({
  auth: () => mockAuth(),
}));

import { prisma } from "@/lib/prisma";
import { InspectionStatus, Role, Sede, TipoFirma, TipoHabilitacion } from "@/generated/prisma/client";
import { aprobarInspeccion, rechazarInspeccion } from "@/lib/inspections/supervisor-actions";
import { crearUsuario, crearVehiculo, limpiarBaseDeTest } from "@/test/helpers/db";

// Plazo de 60 minutos por etapa (regla 2026-10-20). Se congela solo `Date`;
// `completedAt` / `revisadaSupervisorOleariariAt` se fijan explícitos.

const ENVIADA = new Date("2026-01-15T11:00:00Z");
const MIN = 60_000;
const en = (base: Date, minutos: number) => new Date(base.getTime() + minutos * MIN);
const MENSAJE =
  /Comuníquese con la Administradora de SST para habilitar la aprobación ya que se superó el tiempo límite\./;

function loginComo(user: { id: string; role: Role }) {
  mockAuth.mockResolvedValue({ user: { id: user.id, role: user.role } });
}

function ahora(date: Date) {
  vi.setSystemTime(date);
}

async function crearInspeccion(overrides: { sede?: Sede | null; revisadaAt?: Date | null; firma?: boolean } = {}) {
  const worker = await crearUsuario(Role.TRABAJADOR);
  const vehicle = await crearVehiculo();
  const inspection = await prisma.inspection.create({
    data: {
      workerId: worker.id,
      conductorId: worker.id,
      vehicleId: vehicle.id,
      status: InspectionStatus.PENDIENTE_APROBACION,
      completedAt: ENVIADA,
      sede: overrides.sede ?? null,
      revisadaSupervisorOleariariAt: overrides.revisadaAt ?? null,
    },
  });
  if (overrides.firma) {
    const so = await crearUsuario(Role.SUPERVISOR_OLEARIARI);
    await prisma.firma.create({
      data: { inspectionId: inspection.id, userId: so.id, tipo: TipoFirma.SUPERVISOR_OLEARIARI, s3Key: "firmas/t.png" },
    });
  }
  return inspection;
}

async function habilitar(
  usuarioId: string,
  desde: Date,
  hasta: Date,
  tipo: TipoHabilitacion = TipoHabilitacion.APROBACION,
) {
  const sst = await crearUsuario(Role.SST);
  return prisma.habilitacionHorario.create({
    data: { tipo, usuarioId, desde, hasta, justificacion: "Prueba", otorgadaPorId: sst.id },
  });
}

async function bloqueos(inspectionId: string) {
  return prisma.auditLog.findMany({
    where: { entityId: inspectionId, action: "APROBACION_FUERA_DE_PLAZO_BLOQUEADA" },
  });
}

async function sinDecidir(inspectionId: string) {
  const i = await prisma.inspection.findUniqueOrThrow({ where: { id: inspectionId } });
  expect(i.reviewedAt).toBeNull();
  expect(i.status).toBe(InspectionStatus.PENDIENTE_APROBACION);
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(ENVIADA);
  await limpiarBaseDeTest();
  mockAuth.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("plazo de 60 minutos — Bogotá (una etapa)", () => {
  it("aprueba a los 59 minutos", async () => {
    const director = await crearUsuario(Role.SUPERVISOR);
    const inspection = await crearInspeccion({ sede: Sede.BOGOTA });
    loginComo(director);
    ahora(en(ENVIADA, 59));

    const resultado = await aprobarInspeccion(inspection.id);
    expect(resultado.status).toBe(InspectionStatus.APROBADA);
    expect(await bloqueos(inspection.id)).toHaveLength(0);
  });

  it("a los 60 minutos bloquea la aprobación, audita y no toca la inspección", async () => {
    const director = await crearUsuario(Role.SUPERVISOR);
    const inspection = await crearInspeccion({ sede: Sede.BOGOTA });
    loginComo(director);
    ahora(en(ENVIADA, 60));

    await expect(aprobarInspeccion(inspection.id)).rejects.toThrow(MENSAJE);

    await sinDecidir(inspection.id);
    const [log] = await bloqueos(inspection.id);
    expect(log.userId).toBe(director.id);
    expect(log.entityType).toBe("Inspection");
    expect(log.metadata).toEqual({ accion: "APROBAR", etapa: "DIRECTOR" });
  });

  it("después del plazo bloquea también el rechazo", async () => {
    const director = await crearUsuario(Role.SUPERVISOR);
    const inspection = await crearInspeccion({ sede: Sede.BOGOTA });
    loginComo(director);
    ahora(en(ENVIADA, 90));

    await expect(rechazarInspeccion(inspection.id, "Motivo")).rejects.toThrow(MENSAJE);

    await sinDecidir(inspection.id);
    const [log] = await bloqueos(inspection.id);
    expect(log.metadata).toEqual({ accion: "RECHAZAR", etapa: "DIRECTOR" });
  });
});

describe("plazo de 60 minutos — Oleariari", () => {
  it("etapa 1 cuenta desde el envío", async () => {
    const so = await crearUsuario(Role.SUPERVISOR_OLEARIARI);
    const inspection = await crearInspeccion({ sede: Sede.OLEARIARI });
    loginComo(so);

    ahora(en(ENVIADA, 59));
    const resultado = await aprobarInspeccion(inspection.id);
    expect(resultado.revisadaSupervisorOleariariAt).not.toBeNull();

    const otra = await crearInspeccion({ sede: Sede.OLEARIARI });
    ahora(en(ENVIADA, 61));
    await expect(rechazarInspeccion(otra.id, "x")).rejects.toThrow(MENSAJE);
    await sinDecidir(otra.id);
    const [log] = await bloqueos(otra.id);
    expect(log.metadata).toEqual({ accion: "RECHAZAR", etapa: "OLEARIARI" });
  });

  it("etapa 2 cuenta desde la revisión del Supervisor Oleariari, no desde el envío", async () => {
    const director = await crearUsuario(Role.SUPERVISOR);
    const revisada = en(ENVIADA, 55);
    const inspection = await crearInspeccion({ sede: Sede.OLEARIARI, revisadaAt: revisada, firma: true });
    loginComo(director);

    // Han pasado 100 min desde el envío pero solo 45 desde la etapa 1.
    ahora(en(ENVIADA, 100));
    const resultado = await aprobarInspeccion(inspection.id);
    expect(resultado.status).toBe(InspectionStatus.APROBADA);
  });

  it("etapa 2 bloquea a los 60 minutos de la revisión", async () => {
    const director = await crearUsuario(Role.SUPERVISOR);
    const revisada = en(ENVIADA, 55);
    const inspection = await crearInspeccion({ sede: Sede.OLEARIARI, revisadaAt: revisada, firma: true });
    loginComo(director);
    ahora(en(revisada, 60));

    await expect(aprobarInspeccion(inspection.id)).rejects.toThrow(MENSAJE);
    await expect(rechazarInspeccion(inspection.id, "x")).rejects.toThrow(MENSAJE);
    await sinDecidir(inspection.id);
    expect(await bloqueos(inspection.id)).toHaveLength(2);
  });
});

describe("habilitación de aprobación", () => {
  it("una habilitación APROBACION vigente permite aprobar y queda en la auditoría", async () => {
    const director = await crearUsuario(Role.SUPERVISOR);
    const inspection = await crearInspeccion({ sede: Sede.BOGOTA });
    loginComo(director);
    ahora(en(ENVIADA, 300));
    const habilitacion = await habilitar(director.id, en(ENVIADA, 290), en(ENVIADA, 400));

    const resultado = await aprobarInspeccion(inspection.id, "Tarde pero autorizada");
    expect(resultado.status).toBe(InspectionStatus.APROBADA);

    const log = await prisma.auditLog.findFirstOrThrow({
      where: { entityId: inspection.id, action: "APROBAR_INSPECCION" },
    });
    expect(log.metadata).toEqual({
      observacion: "Tarde pero autorizada",
      fueraDePlazo: true,
      habilitacionId: habilitacion.id,
    });
    expect(await bloqueos(inspection.id)).toHaveLength(0);
  });

  it("una habilitación vigente permite rechazar y queda en la auditoría", async () => {
    const director = await crearUsuario(Role.SUPERVISOR);
    const inspection = await crearInspeccion({ sede: Sede.BOGOTA });
    loginComo(director);
    ahora(en(ENVIADA, 300));
    const habilitacion = await habilitar(director.id, en(ENVIADA, 290), en(ENVIADA, 400));

    const resultado = await rechazarInspeccion(inspection.id, "No cumple");
    expect(resultado.status).toBe(InspectionStatus.RECHAZADA);

    const log = await prisma.auditLog.findFirstOrThrow({
      where: { entityId: inspection.id, action: "RECHAZAR_INSPECCION" },
    });
    expect(log.metadata).toEqual({
      observacion: "No cumple",
      fueraDePlazo: true,
      habilitacionId: habilitacion.id,
    });
  });

  it("dentro del plazo no se usa la habilitación ni se marca fuera de plazo", async () => {
    const director = await crearUsuario(Role.SUPERVISOR);
    const inspection = await crearInspeccion({ sede: Sede.BOGOTA });
    loginComo(director);
    ahora(en(ENVIADA, 10));
    await habilitar(director.id, en(ENVIADA, 0), en(ENVIADA, 100));

    await aprobarInspeccion(inspection.id);
    const log = await prisma.auditLog.findFirstOrThrow({
      where: { entityId: inspection.id, action: "APROBAR_INSPECCION" },
    });
    expect(log.metadata).toEqual({ observacion: null });
  });

  it("permite decidir varias inspecciones vencidas del mismo aprobador", async () => {
    const director = await crearUsuario(Role.SUPERVISOR);
    const a = await crearInspeccion({ sede: Sede.BOGOTA });
    const b = await crearInspeccion({ sede: Sede.BOGOTA });
    loginComo(director);
    ahora(en(ENVIADA, 300));
    await habilitar(director.id, en(ENVIADA, 290), en(ENVIADA, 400));

    await aprobarInspeccion(a.id);
    await rechazarInspeccion(b.id, "x");
  });

  it("la habilitación RECORREDOR no cuenta", async () => {
    const director = await crearUsuario(Role.SUPERVISOR);
    const inspection = await crearInspeccion({ sede: Sede.BOGOTA });
    loginComo(director);
    ahora(en(ENVIADA, 300));
    await habilitar(director.id, en(ENVIADA, 290), en(ENVIADA, 400), TipoHabilitacion.RECORREDOR);

    await expect(aprobarInspeccion(inspection.id)).rejects.toThrow(MENSAJE);
  });

  it("la habilitación de otro aprobador no cuenta", async () => {
    const director = await crearUsuario(Role.SUPERVISOR);
    const otro = await crearUsuario(Role.SUPERVISOR);
    const inspection = await crearInspeccion({ sede: Sede.BOGOTA });
    loginComo(director);
    ahora(en(ENVIADA, 300));
    await habilitar(otro.id, en(ENVIADA, 290), en(ENVIADA, 400));

    await expect(aprobarInspeccion(inspection.id)).rejects.toThrow(MENSAJE);
  });

  it("una habilitación vencida o futura no cuenta", async () => {
    const director = await crearUsuario(Role.SUPERVISOR);
    const inspection = await crearInspeccion({ sede: Sede.BOGOTA });
    loginComo(director);
    ahora(en(ENVIADA, 300));
    await habilitar(director.id, en(ENVIADA, 200), en(ENVIADA, 300)); // hasta == ahora: excluido
    await habilitar(director.id, en(ENVIADA, 301), en(ENVIADA, 400));

    await expect(aprobarInspeccion(inspection.id)).rejects.toThrow(MENSAJE);
    await expect(rechazarInspeccion(inspection.id, "x")).rejects.toThrow(MENSAJE);
  });
});
