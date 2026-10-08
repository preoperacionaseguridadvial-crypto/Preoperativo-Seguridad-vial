import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const mockAuth = vi.fn();
vi.mock("@/lib/auth/config", () => ({
  auth: () => mockAuth(),
}));

import { prisma } from "@/lib/prisma";
import { Role, InspectionStatus, Sede, TipoFirma, RespuestaChecklist } from "@/generated/prisma/client";
import { aprobarInspeccion, rechazarInspeccion } from "@/lib/inspections/supervisor-actions";
import { requiereAtencionEstadoConductor } from "@/lib/inspections/estado-conductor";
import { crearCatalogoMinimo, crearUsuario, crearVehiculo, limpiarBaseDeTest } from "@/test/helpers/db";

function loginComo(user: { id: string; role: Role }) {
  mockAuth.mockResolvedValue({ user: { id: user.id, role: user.role } });
}

async function crearInspeccion(
  status: InspectionStatus,
  overrides: Partial<{
    tomaMedicamentos: boolean | null;
    condicionesAptas: boolean | null;
    consumioAlcohol: boolean | null;
    sede: Sede | null;
    revisadaSupervisorOlariariAt: Date | null;
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
      sede: overrides.sede ?? null,
      revisadaSupervisorOlariariAt: overrides.revisadaSupervisorOlariariAt ?? null,
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

  describe("confirmación al aprobar con novedades", () => {
    async function agregarRespuesta(inspectionId: string, valor: RespuestaChecklist) {
      const { item } = await crearCatalogoMinimo();
      await prisma.inspectionItemResponse.create({
        data: { inspectionId, checklistItemId: item.id, valor },
      });
    }

    async function auditoriaAprobar(inspectionId: string) {
      return prisma.auditLog.findFirstOrThrow({
        where: { entityId: inspectionId, action: "APROBAR_INSPECCION" },
      });
    }

    it("sin motivos aprueba sin confirmación y deja la metadata como siempre", async () => {
      const supervisor = await crearUsuario(Role.SUPERVISOR);
      const inspection = await crearInspeccion(InspectionStatus.PENDIENTE_APROBACION);
      await agregarRespuesta(inspection.id, RespuestaChecklist.OK);
      loginComo(supervisor);

      await aprobarInspeccion(inspection.id, "Todo bien");

      const log = await auditoriaAprobar(inspection.id);
      expect(log.metadata).toEqual({ observacion: "Todo bien" });
    });

    it("con una respuesta FALLA y sin confirmación lanza un error en español y no toca la inspección", async () => {
      const supervisor = await crearUsuario(Role.SUPERVISOR);
      const inspection = await crearInspeccion(InspectionStatus.PENDIENTE_APROBACION);
      await agregarRespuesta(inspection.id, RespuestaChecklist.FALLA);
      loginComo(supervisor);

      await expect(aprobarInspeccion(inspection.id)).rejects.toThrow(
        /novedades reportadas.*confirmar/i,
      );

      const despues = await prisma.inspection.findUniqueOrThrow({ where: { id: inspection.id } });
      expect(despues.status).toBe(InspectionStatus.PENDIENTE_APROBACION);
      expect(despues.approvedAt).toBeNull();
      expect(despues.reviewedAt).toBeNull();
      expect(await prisma.auditLog.count({ where: { entityId: inspection.id } })).toBe(0);
    });

    it("con confirmación aprueba y registra en la auditoría que fue con novedades y cuáles", async () => {
      const supervisor = await crearUsuario(Role.SUPERVISOR);
      const inspection = await crearInspeccion(InspectionStatus.PENDIENTE_APROBACION, {
        consumioAlcohol: true,
      });
      await agregarRespuesta(inspection.id, RespuestaChecklist.MALO);
      loginComo(supervisor);

      const resultado = await aprobarInspeccion(inspection.id, "  Revisado en sitio  ", true);

      expect(resultado.status).toBe(InspectionStatus.APROBADA);
      const log = await auditoriaAprobar(inspection.id);
      const metadata = log.metadata as {
        observacion: string;
        aprobadaConNovedades: boolean;
        motivos: string[];
      };
      expect(metadata.observacion).toBe("Revisado en sitio");
      expect(metadata.aprobadaConNovedades).toBe(true);
      expect(metadata.motivos).toHaveLength(2);
      expect(metadata.motivos[0]).toBe("Item de prueba: Malo");
      expect(metadata.motivos[1]).toMatch(/alcohol/i);
    });

    it("BAJO no exige confirmación", async () => {
      const supervisor = await crearUsuario(Role.SUPERVISOR);
      const inspection = await crearInspeccion(InspectionStatus.PENDIENTE_APROBACION);
      await agregarRespuesta(inspection.id, RespuestaChecklist.BAJO);
      loginComo(supervisor);

      const resultado = await aprobarInspeccion(inspection.id);
      expect(resultado.status).toBe(InspectionStatus.APROBADA);
    });

    it("una inspección NO_APTA_PARA_OPERAR (puedeOperar=false) exige confirmación", async () => {
      const supervisor = await crearUsuario(Role.SUPERVISOR);
      const inspection = await crearInspeccion(InspectionStatus.NO_APTA_PARA_OPERAR);
      loginComo(supervisor);

      await expect(aprobarInspeccion(inspection.id)).rejects.toThrow(/confirmar/i);
      const aprobada = await aprobarInspeccion(inspection.id, undefined, true);
      expect(aprobada.status).toBe(InspectionStatus.APROBADA);
    });

    it("una novedad general (sin ítem) exige confirmación", async () => {
      const supervisor = await crearUsuario(Role.SUPERVISOR);
      const inspection = await crearInspeccion(InspectionStatus.PENDIENTE_APROBACION);
      await prisma.novedad.create({
        data: { inspectionId: inspection.id, tipo: "RAYON", descripcion: "Rayón en el costado" },
      });
      loginComo(supervisor);

      await expect(aprobarInspeccion(inspection.id)).rejects.toThrow(/confirmar/i);
    });
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

    // Sigue sin bloquearse: el Supervisor decide, pero ahora debe confirmar.
    await expect(aprobarInspeccion(inspection.id)).rejects.toThrow(/confirmar/i);
    const resultado = await aprobarInspeccion(inspection.id, undefined, true);

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

// Flujo de dos etapas (roles-olariari): la etapa se decide en el servidor a
// partir de la sede de la inspección y del rol de la sesión; el cliente no
// elige nada.
describe("flujo de dos etapas — Supervisor Olariari (etapa 1)", () => {
  it("aprobar fija la etapa 1 y deja la inspección en la cola del Director, sin cambiar el estado", async () => {
    const supOlariari = await crearUsuario(Role.SUPERVISOR_OLARIARI);
    const inspection = await crearInspeccion(InspectionStatus.PENDIENTE_APROBACION, { sede: Sede.OLARIARI });
    loginComo(supOlariari);

    const antes = Date.now();
    const resultado = await aprobarInspeccion(inspection.id, "  Visto en sitio  ");

    expect(resultado.status).toBe(InspectionStatus.PENDIENTE_APROBACION);
    expect(resultado.reviewedAt).toBeNull();
    expect(resultado.approvedAt).toBeNull();
    expect(resultado.supervisorId).toBeNull();
    expect(resultado.supervisorOlariariId).toBe(supOlariari.id);
    expect(resultado.observacionesSupervisorOlariari).toBe("Visto en sitio");
    expect(resultado.revisadaSupervisorOlariariAt!.getTime()).toBeGreaterThanOrEqual(antes);

    const log = await prisma.auditLog.findFirstOrThrow({
      where: { entityId: inspection.id, action: "APROBAR_INSPECCION_SUPERVISOR_OLARIARI" },
    });
    expect(log.userId).toBe(supOlariari.id);
    expect(log.metadata).toEqual({ observacion: "Visto en sitio" });
  });

  it("mantiene el estado NO_APTA_PARA_OPERAR al pasar al Director", async () => {
    const supOlariari = await crearUsuario(Role.SUPERVISOR_OLARIARI);
    const inspection = await crearInspeccion(InspectionStatus.NO_APTA_PARA_OPERAR, { sede: Sede.OLARIARI });
    loginComo(supOlariari);

    const resultado = await aprobarInspeccion(inspection.id, undefined, true);
    expect(resultado.status).toBe(InspectionStatus.NO_APTA_PARA_OPERAR);
    expect(resultado.revisadaSupervisorOlariariAt).not.toBeNull();
  });

  it("también exige confirmar las novedades antes de aprobar", async () => {
    const supOlariari = await crearUsuario(Role.SUPERVISOR_OLARIARI);
    const inspection = await crearInspeccion(InspectionStatus.PENDIENTE_APROBACION, {
      sede: Sede.OLARIARI,
      consumioAlcohol: true,
    });
    loginComo(supOlariari);

    await expect(aprobarInspeccion(inspection.id)).rejects.toThrow(/confirmar/i);
    const despues = await prisma.inspection.findUniqueOrThrow({ where: { id: inspection.id } });
    expect(despues.revisadaSupervisorOlariariAt).toBeNull();

    await aprobarInspeccion(inspection.id, undefined, true);
    const log = await prisma.auditLog.findFirstOrThrow({
      where: { entityId: inspection.id, action: "APROBAR_INSPECCION_SUPERVISOR_OLARIARI" },
    });
    expect((log.metadata as { aprobadaConNovedades: boolean }).aprobadaConNovedades).toBe(true);
  });

  it("rechazar cierra la inspección y nunca llega al Director", async () => {
    const supOlariari = await crearUsuario(Role.SUPERVISOR_OLARIARI);
    const director = await crearUsuario(Role.SUPERVISOR);
    const inspection = await crearInspeccion(InspectionStatus.PENDIENTE_APROBACION, { sede: Sede.OLARIARI });
    loginComo(supOlariari);

    const resultado = await rechazarInspeccion(inspection.id, "Falta el casco");

    expect(resultado.status).toBe(InspectionStatus.RECHAZADA);
    expect(resultado.rejectedAt).not.toBeNull();
    expect(resultado.reviewedAt).not.toBeNull();
    expect(resultado.revisadaSupervisorOlariariAt).not.toBeNull();
    expect(resultado.supervisorOlariariId).toBe(supOlariari.id);
    expect(resultado.observacionesSupervisorOlariari).toBe("Falta el casco");
    expect(resultado.supervisorId).toBeNull();
    expect(
      await prisma.auditLog.count({
        where: { entityId: inspection.id, action: "RECHAZAR_INSPECCION_SUPERVISOR_OLARIARI" },
      }),
    ).toBe(1);

    loginComo(director);
    await expect(aprobarInspeccion(inspection.id)).rejects.toThrow(/no está en un estado que admita revisión/i);
  });

  it("rechazar exige observación", async () => {
    const supOlariari = await crearUsuario(Role.SUPERVISOR_OLARIARI);
    const inspection = await crearInspeccion(InspectionStatus.PENDIENTE_APROBACION, { sede: Sede.OLARIARI });
    loginComo(supOlariari);

    await expect(rechazarInspeccion(inspection.id, " ")).rejects.toThrow(/la observación es obligatoria/i);
  });

  it("no puede decidir una inspección de Bogotá ni una legacy sin sede", async () => {
    const supOlariari = await crearUsuario(Role.SUPERVISOR_OLARIARI);
    const bogota = await crearInspeccion(InspectionStatus.PENDIENTE_APROBACION, { sede: Sede.BOGOTA });
    const legacy = await crearInspeccion(InspectionStatus.PENDIENTE_APROBACION, { sede: null });
    loginComo(supOlariari);

    for (const inspection of [bogota, legacy]) {
      await expect(aprobarInspeccion(inspection.id)).rejects.toThrow(/no le corresponde/i);
      await expect(rechazarInspeccion(inspection.id, "x")).rejects.toThrow(/no le corresponde/i);
      const despues = await prisma.inspection.findUniqueOrThrow({ where: { id: inspection.id } });
      expect(despues.status).toBe(InspectionStatus.PENDIENTE_APROBACION);
      expect(despues.supervisorOlariariId).toBeNull();
    }
  });

  it("no puede volver a decidir una inspección que ya pasó su etapa", async () => {
    const supOlariari = await crearUsuario(Role.SUPERVISOR_OLARIARI);
    const inspection = await crearInspeccion(InspectionStatus.PENDIENTE_APROBACION, {
      sede: Sede.OLARIARI,
      revisadaSupervisorOlariariAt: new Date(),
    });
    loginComo(supOlariari);

    await expect(aprobarInspeccion(inspection.id)).rejects.toThrow(/no le corresponde/i);
    await expect(rechazarInspeccion(inspection.id, "x")).rejects.toThrow(/no le corresponde/i);
  });

  it("un rol sin facultad de aprobar (Recorredor, SST, Director) es rechazado", async () => {
    const inspection = await crearInspeccion(InspectionStatus.PENDIENTE_APROBACION, { sede: Sede.OLARIARI });
    for (const rol of [Role.TRABAJADOR, Role.SST, Role.DIRECTOR]) {
      loginComo(await crearUsuario(rol));
      await expect(aprobarInspeccion(inspection.id)).rejects.toThrow();
      await expect(rechazarInspeccion(inspection.id, "x")).rejects.toThrow();
    }
  });
});

describe("flujo de dos etapas — Director de Operaciones (etapa 2)", () => {
  it("no puede decidir una inspección de Olariari antes de la primera etapa", async () => {
    const director = await crearUsuario(Role.SUPERVISOR);
    const inspection = await crearInspeccion(InspectionStatus.PENDIENTE_APROBACION, { sede: Sede.OLARIARI });
    loginComo(director);

    await expect(aprobarInspeccion(inspection.id)).rejects.toThrow(/Supervisor Olariari/);
    await expect(rechazarInspeccion(inspection.id, "x")).rejects.toThrow(/Supervisor Olariari/);
    const despues = await prisma.inspection.findUniqueOrThrow({ where: { id: inspection.id } });
    expect(despues.status).toBe(InspectionStatus.PENDIENTE_APROBACION);
    expect(despues.reviewedAt).toBeNull();
    expect(despues.supervisorId).toBeNull();
  });

  it("aprueba una de Olariari ya aprobada por la primera etapa, como siempre", async () => {
    const director = await crearUsuario(Role.SUPERVISOR);
    const inspection = await crearInspeccion(InspectionStatus.PENDIENTE_APROBACION, {
      sede: Sede.OLARIARI,
      revisadaSupervisorOlariariAt: new Date(),
    });
    loginComo(director);

    const resultado = await aprobarInspeccion(inspection.id, "Conforme");
    expect(resultado.status).toBe(InspectionStatus.APROBADA);
    expect(resultado.supervisorId).toBe(director.id);
    expect(resultado.observacionesSupervisor).toBe("Conforme");
    expect(resultado.reviewedAt).not.toBeNull();
  });

  it("rechaza una de Olariari ya aprobada por la primera etapa", async () => {
    const director = await crearUsuario(Role.SUPERVISOR);
    const inspection = await crearInspeccion(InspectionStatus.PENDIENTE_APROBACION, {
      sede: Sede.OLARIARI,
      revisadaSupervisorOlariariAt: new Date(),
    });
    loginComo(director);

    const resultado = await rechazarInspeccion(inspection.id, "No cumple");
    expect(resultado.status).toBe(InspectionStatus.RECHAZADA);
    expect(resultado.supervisorId).toBe(director.id);
  });

  it("sigue decidiendo Bogotá directamente", async () => {
    const director = await crearUsuario(Role.SUPERVISOR);
    const inspection = await crearInspeccion(InspectionStatus.PENDIENTE_APROBACION, { sede: Sede.BOGOTA });
    loginComo(director);

    const resultado = await aprobarInspeccion(inspection.id);
    expect(resultado.status).toBe(InspectionStatus.APROBADA);
  });
});
