import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const mockAuth = vi.fn();
vi.mock("@/lib/auth/config", () => ({
  auth: () => mockAuth(),
}));

import { prisma } from "@/lib/prisma";
import { Role, InspectionStatus, TipoFirma } from "@/generated/prisma/client";
import { aprobarInspeccion, rechazarInspeccion } from "@/lib/inspections/supervisor-actions";
import { requiereAtencionEstadoConductor } from "@/lib/inspections/estado-conductor";
import { crearUsuario, crearVehiculo, limpiarBaseDeTest } from "@/test/helpers/db";

function loginComo(user: { id: string; role: Role }) {
  mockAuth.mockResolvedValue({ user: { id: user.id, role: user.role } });
}

async function crearInspeccion(
  status: InspectionStatus,
  overrides: Partial<{
    tomaMedicamentos: boolean | null;
    condicionesAptas: boolean | null;
    consumioAlcohol: boolean | null;
  }> = {},
) {
  const worker = await crearUsuario(Role.TRABAJADOR);
  const vehicle = await crearVehiculo();
  return prisma.inspection.create({
    data: {
      workerId: worker.id,
      conductorId: worker.id,
      vehicleId: vehicle.id,
      status,
      puedeOperar: status !== InspectionStatus.NO_APTA_PARA_OPERAR,
      completedAt: status === InspectionStatus.EN_PROCESO ? null : new Date(),
      tomaMedicamentos: overrides.tomaMedicamentos ?? null,
      condicionesAptas: overrides.condicionesAptas ?? null,
      consumioAlcohol: overrides.consumioAlcohol ?? null,
    },
  });
}

async function firmarComoSupervisor(inspectionId: string, userId: string) {
  await prisma.firma.create({
    data: { inspectionId, userId, tipo: TipoFirma.SUPERVISOR, s3Key: "firmas/test-sup.png" },
  });
}

beforeEach(async () => {
  await limpiarBaseDeTest();
  mockAuth.mockReset();
});

afterAll(async () => {
  await limpiarBaseDeTest();
  await prisma.$disconnect();
});

describe("aprobarInspeccion", () => {
  it("aprueba sin necesidad de firma previa del supervisor (la firma es un paso posterior, ver firma-actions.ts)", async () => {
    const supervisor = await crearUsuario(Role.SUPERVISOR);
    const inspection = await crearInspeccion(InspectionStatus.PENDIENTE_APROBACION);
    loginComo(supervisor);

    const resultado = await aprobarInspeccion(inspection.id);
    expect(resultado.status).toBe(InspectionStatus.APROBADA);
  });

  it("rechaza aprobar una inspección que sigue EN_PROCESO", async () => {
    const supervisor = await crearUsuario(Role.SUPERVISOR);
    const inspection = await crearInspeccion(InspectionStatus.EN_PROCESO);
    await firmarComoSupervisor(inspection.id, supervisor.id);
    loginComo(supervisor);

    await expect(aprobarInspeccion(inspection.id)).rejects.toThrow(
      /no está en un estado que admita revisión/i,
    );
  });

  it("aprueba una inspección PENDIENTE_APROBACION con firma, fijando approvedAt/reviewedAt server-side", async () => {
    const supervisor = await crearUsuario(Role.SUPERVISOR);
    const inspection = await crearInspeccion(InspectionStatus.PENDIENTE_APROBACION);
    await firmarComoSupervisor(inspection.id, supervisor.id);
    loginComo(supervisor);

    const antes = Date.now();
    const resultado = await aprobarInspeccion(inspection.id, "Todo en orden");
    const despues = Date.now();

    expect(resultado.status).toBe(InspectionStatus.APROBADA);
    expect(resultado.approvedAt).not.toBeNull();
    expect(resultado.reviewedAt).not.toBeNull();
    expect(resultado.approvedAt!.getTime()).toBeGreaterThanOrEqual(antes);
    expect(resultado.approvedAt!.getTime()).toBeLessThanOrEqual(despues);
    expect(resultado.supervisorId).toBe(supervisor.id);
  });

  it("rechaza volver a aprobar una inspección ya APROBADA", async () => {
    const supervisor = await crearUsuario(Role.SUPERVISOR);
    const inspection = await crearInspeccion(InspectionStatus.PENDIENTE_APROBACION);
    await firmarComoSupervisor(inspection.id, supervisor.id);
    loginComo(supervisor);
    await aprobarInspeccion(inspection.id);

    await expect(aprobarInspeccion(inspection.id)).rejects.toThrow(
      /no está en un estado que admita revisión/i,
    );
  });
});

describe("rechazarInspeccion", () => {
  it("rechaza sin observación (obligatoria)", async () => {
    const supervisor = await crearUsuario(Role.SUPERVISOR);
    const inspection = await crearInspeccion(InspectionStatus.PENDIENTE_APROBACION);
    await firmarComoSupervisor(inspection.id, supervisor.id);
    loginComo(supervisor);

    await expect(rechazarInspeccion(inspection.id, "  ")).rejects.toThrow(
      /la observación es obligatoria/i,
    );
  });

  it("rechaza sin necesidad de firma previa del supervisor (la firma es un paso posterior, ver firma-actions.ts)", async () => {
    const supervisor = await crearUsuario(Role.SUPERVISOR);
    const inspection = await crearInspeccion(InspectionStatus.PENDIENTE_APROBACION);
    loginComo(supervisor);

    const resultado = await rechazarInspeccion(inspection.id, "Le falta el espejo");
    expect(resultado.status).toBe(InspectionStatus.RECHAZADA);
  });

  it("rechaza una inspección PENDIENTE_APROBACION con firma y observación, fijando rejectedAt/reviewedAt server-side", async () => {
    const supervisor = await crearUsuario(Role.SUPERVISOR);
    const inspection = await crearInspeccion(InspectionStatus.PENDIENTE_APROBACION);
    await firmarComoSupervisor(inspection.id, supervisor.id);
    loginComo(supervisor);

    const resultado = await rechazarInspeccion(inspection.id, "Le falta el espejo retrovisor");

    expect(resultado.status).toBe(InspectionStatus.RECHAZADA);
    expect(resultado.rejectedAt).not.toBeNull();
    expect(resultado.reviewedAt).not.toBeNull();
  });

  it("rechaza volver a decidir una inspección ya revisada (reviewedAt no nulo)", async () => {
    const supervisor = await crearUsuario(Role.SUPERVISOR);
    const inspection = await crearInspeccion(InspectionStatus.PENDIENTE_APROBACION);
    await firmarComoSupervisor(inspection.id, supervisor.id);
    loginComo(supervisor);
    await rechazarInspeccion(inspection.id, "Motivo inicial");

    await expect(rechazarInspeccion(inspection.id, "Otro motivo")).rejects.toThrow(
      /no está en un estado que admita revisión/i,
    );
  });
});

// Slice 3 (spec driver-state-declaration, D8/A6): una declaración de estado
// del conductor "preocupante" surge como advertencia derivada para el
// Supervisor, pero NUNCA bloquea ni auto-transiciona el estado de la
// inspección — el Supervisor sigue siendo el único que decide
// aprobar/rechazar (`aprobarInspeccion`/`rechazarInspeccion` no miran estos
// campos en absoluto).
describe("declaración de estado del conductor — advertencia derivada, nunca auto-bloqueo", () => {
  it("requiereAtencionEstadoConductor detecta la inspección como preocupante", async () => {
    const inspection = await crearInspeccion(InspectionStatus.PENDIENTE_APROBACION, {
      tomaMedicamentos: true,
      condicionesAptas: true,
      consumioAlcohol: false,
    });

    expect(requiereAtencionEstadoConductor(inspection)).toBe(true);
  });

  it("aprobarInspeccion aprueba igual una inspección con declaración preocupante (el Supervisor decide)", async () => {
    const supervisor = await crearUsuario(Role.SUPERVISOR);
    const inspection = await crearInspeccion(InspectionStatus.PENDIENTE_APROBACION, {
      tomaMedicamentos: true,
      condicionesAptas: true,
      consumioAlcohol: false,
    });
    loginComo(supervisor);

    const resultado = await aprobarInspeccion(inspection.id);

    expect(resultado.status).toBe(InspectionStatus.APROBADA);
  });

  it("una declaración sin respuestas preocupantes no requiere atención", async () => {
    const inspection = await crearInspeccion(InspectionStatus.PENDIENTE_APROBACION, {
      tomaMedicamentos: false,
      condicionesAptas: true,
      consumioAlcohol: false,
    });

    expect(requiereAtencionEstadoConductor(inspection)).toBe(false);
  });
});
