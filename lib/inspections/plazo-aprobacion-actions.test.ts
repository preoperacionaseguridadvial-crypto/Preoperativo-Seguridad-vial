import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockAuth = vi.fn();
vi.mock("@/lib/auth/config", () => ({
  auth: () => mockAuth(),
}));

import { prisma } from "@/lib/prisma";
import { InspectionStatus, Role, Sede, TipoFirma, TipoHabilitacion } from "@/generated/prisma/client";
import { aprobarInspeccion, rechazarInspeccion } from "@/lib/inspections/supervisor-actions";
import { crearUsuario, crearVehiculo, limpiarBaseDeTest } from "@/test/helpers/db";

// Horario de aprobación por etapa (regla 2026-10-28): 5:45-8:00 a. m. y
// 5:45-8:00 p. m. de Bogotá. Se congela solo `Date`; `completedAt` /
// `revisadaSupervisorOleariariAt` se fijan explícitos.

// 6:00 a. m. de Bogotá: la ventana de su etapa es 5:45-8:00 a. m. del mismo día.
const ENVIADA = new Date("2026-01-15T06:00:00-05:00");
const MIN = 60_000;
const en = (base: Date, minutos: number) => new Date(base.getTime() + minutos * MIN);
const MENSAJE =
  /Solo puede aprobar o rechazar entre las 5:45 y las 8:00 a\. m\. o entre las 5:45 y las 8:00 p\. m\. Comuníquese con la Administradora de SST para habilitar la aprobación\./;

function loginComo(user: { id: string; role: Role }) {
  mockAuth.mockResolvedValue({ user: { id: user.id, role: user.role } });
}

function ahora(date: Date) {
  vi.setSystemTime(date);
}

async function crearInspeccion(
  overrides: { sede?: Sede | null; revisadaAt?: Date | null; firma?: boolean; completedAt?: Date } = {},
) {
  const worker = await crearUsuario(Role.TRABAJADOR);
  const vehicle = await crearVehiculo();
  const inspection = await prisma.inspection.create({
    data: {
      workerId: worker.id,
      conductorId: worker.id,
      vehicleId: vehicle.id,
      status: InspectionStatus.PENDIENTE_APROBACION,
      completedAt: overrides.completedAt ?? ENVIADA,
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

describe("horario de aprobación — Bogotá (una etapa)", () => {
  it("aprueba a las 7:59, dentro de la ventana", async () => {
    const director = await crearUsuario(Role.SUPERVISOR);
    const inspection = await crearInspeccion({ sede: Sede.BOGOTA });
    loginComo(director);
    ahora(en(ENVIADA, 119));

    const resultado = await aprobarInspeccion(inspection.id);
    expect(resultado.status).toBe(InspectionStatus.APROBADA);
    expect(await bloqueos(inspection.id)).toHaveLength(0);
  });

  it("a las 8:00 bloquea la aprobación, audita y no toca la inspección", async () => {
    const director = await crearUsuario(Role.SUPERVISOR);
    const inspection = await crearInspeccion({ sede: Sede.BOGOTA });
    loginComo(director);
    ahora(en(ENVIADA, 120));

    await expect(aprobarInspeccion(inspection.id)).rejects.toThrow(MENSAJE);

    await sinDecidir(inspection.id);
    const [log] = await bloqueos(inspection.id);
    expect(log.userId).toBe(director.id);
    expect(log.entityType).toBe("Inspection");
    expect(log.metadata).toEqual({ accion: "APROBAR", etapa: "DIRECTOR" });
  });

  it("después de la ventana bloquea también el rechazo", async () => {
    const director = await crearUsuario(Role.SUPERVISOR);
    const inspection = await crearInspeccion({ sede: Sede.BOGOTA });
    loginComo(director);
    ahora(en(ENVIADA, 150));

    await expect(rechazarInspeccion(inspection.id, "Motivo")).rejects.toThrow(MENSAJE);

    await sinDecidir(inspection.id);
    const [log] = await bloqueos(inspection.id);
    expect(log.metadata).toEqual({ accion: "RECHAZAR", etapa: "DIRECTOR" });
  });

  it("no revive en la ventana de la tarde: a las 6:00 p. m. sigue bloqueada", async () => {
    const director = await crearUsuario(Role.SUPERVISOR);
    const inspection = await crearInspeccion({ sede: Sede.BOGOTA });
    loginComo(director);
    ahora(en(ENVIADA, 12 * 60));

    await expect(aprobarInspeccion(inspection.id)).rejects.toThrow(MENSAJE);
    await sinDecidir(inspection.id);
  });

  it("enviada a las 10:00 a. m.: bloquea a las 3:00 p. m. (aún no abre) y deja decidir a las 5:45 p. m.", async () => {
    const director = await crearUsuario(Role.SUPERVISOR);
    const enviada = en(ENVIADA, 4 * 60); // 10:00 a. m.
    const inspection = await crearInspeccion({ sede: Sede.BOGOTA, completedAt: enviada });
    loginComo(director);

    ahora(en(ENVIADA, 9 * 60)); // 3:00 p. m.
    await expect(aprobarInspeccion(inspection.id)).rejects.toThrow(MENSAJE);
    await sinDecidir(inspection.id);
    const [log] = await bloqueos(inspection.id);
    expect(log.metadata).toEqual({ accion: "APROBAR", etapa: "DIRECTOR" });

    ahora(en(ENVIADA, 11 * 60 + 45)); // 5:45 p. m.
    const resultado = await aprobarInspeccion(inspection.id);
    expect(resultado.status).toBe(InspectionStatus.APROBADA);
  });

  it("enviada a las 9:00 p. m.: la ventana es la de la mañana siguiente", async () => {
    const director = await crearUsuario(Role.SUPERVISOR);
    const inspection = await crearInspeccion({ sede: Sede.BOGOTA, completedAt: en(ENVIADA, 15 * 60) });
    loginComo(director);

    ahora(en(ENVIADA, 17 * 60)); // 11:00 p. m.
    await expect(aprobarInspeccion(inspection.id)).rejects.toThrow(MENSAJE);

    ahora(en(ENVIADA, 24 * 60)); // 6:00 a. m. del día siguiente
    const resultado = await aprobarInspeccion(inspection.id);
    expect(resultado.status).toBe(InspectionStatus.APROBADA);
  });
});

describe("horario de aprobación — Oleariari", () => {
  it("etapa 1 cuenta desde el envío", async () => {
    const so = await crearUsuario(Role.SUPERVISOR_OLEARIARI);
    const inspection = await crearInspeccion({ sede: Sede.OLEARIARI });
    loginComo(so);

    ahora(en(ENVIADA, 119));
    const resultado = await aprobarInspeccion(inspection.id);
    expect(resultado.revisadaSupervisorOleariariAt).not.toBeNull();

    const otra = await crearInspeccion({ sede: Sede.OLEARIARI });
    ahora(en(ENVIADA, 121));
    await expect(rechazarInspeccion(otra.id, "x")).rejects.toThrow(MENSAJE);
    await sinDecidir(otra.id);
    const [log] = await bloqueos(otra.id);
    expect(log.metadata).toEqual({ accion: "RECHAZAR", etapa: "OLEARIARI" });
  });

  it("etapa 2 usa la ventana de la revisión del Supervisor Oleariari, no la del envío", async () => {
    const director = await crearUsuario(Role.SUPERVISOR);
    const revisada = en(ENVIADA, 11 * 60 + 50); // 5:50 p. m.
    const inspection = await crearInspeccion({ sede: Sede.OLEARIARI, revisadaAt: revisada, firma: true });
    loginComo(director);

    // La ventana del envío (hasta las 8:00 a. m.) ya cerró, pero la de la etapa 2 va hasta las 8:00 p. m.
    ahora(en(ENVIADA, 13 * 60));
    const resultado = await aprobarInspeccion(inspection.id);
    expect(resultado.status).toBe(InspectionStatus.APROBADA);
  });

  it("etapa 2 bloquea a las 8:00 p. m., cuando cierra la ventana de la revisión", async () => {
    const director = await crearUsuario(Role.SUPERVISOR);
    const revisada = en(ENVIADA, 11 * 60 + 50); // 5:50 p. m.
    const inspection = await crearInspeccion({ sede: Sede.OLEARIARI, revisadaAt: revisada, firma: true });
    loginComo(director);
    ahora(en(ENVIADA, 14 * 60));

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

  it("una habilitación vigente permite decidir antes de que abra la ventana", async () => {
    const director = await crearUsuario(Role.SUPERVISOR);
    const inspection = await crearInspeccion({ sede: Sede.BOGOTA, completedAt: en(ENVIADA, 4 * 60) });
    loginComo(director);
    ahora(en(ENVIADA, 9 * 60)); // 3:00 p. m.; su ventana abre a las 5:45 p. m.
    const habilitacion = await habilitar(director.id, en(ENVIADA, 8 * 60), en(ENVIADA, 10 * 60));

    const resultado = await aprobarInspeccion(inspection.id);
    expect(resultado.status).toBe(InspectionStatus.APROBADA);
    const log = await prisma.auditLog.findFirstOrThrow({
      where: { entityId: inspection.id, action: "APROBAR_INSPECCION" },
    });
    expect(log.metadata).toMatchObject({ fueraDePlazo: true, habilitacionId: habilitacion.id });
  });

  it("dentro de la ventana no se usa la habilitación ni se marca fuera de plazo", async () => {
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
