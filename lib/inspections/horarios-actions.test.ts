import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockAuth = vi.fn();
vi.mock("@/lib/auth/config", () => ({
  auth: () => mockAuth(),
}));

vi.mock("@/lib/storage/s3", () => ({
  uploadObject: vi.fn().mockResolvedValue(undefined),
  deleteObject: vi.fn().mockResolvedValue(undefined),
}));

import { prisma } from "@/lib/prisma";
import {
  InspectionStatus,
  Role,
  TipoFirma,
  TipoFotoInspeccion,
  TipoHabilitacion,
  TipoVehiculo,
  RespuestaChecklist,
} from "@/generated/prisma/client";
import {
  cancelarInspeccion,
  enviarInspeccion,
  iniciarInspeccion,
  registrarKilometraje,
} from "@/lib/inspections/actions";
import {
  crearCatalogoMinimo,
  crearUsuario,
  crearVehiculo,
  limpiarBaseDeTest,
} from "@/test/helpers/db";

// Bogotá = UTC-5. Turno 1: 10:45–11:30 UTC. Turno 2: 22:45–23:30 UTC.
const EN_VENTANA = new Date("2026-10-20T11:00:00Z");
const CIERRE_TURNO_1 = new Date("2026-10-20T11:30:00Z");
const DESPUES_DE_CIERRE = new Date("2026-10-20T11:40:00Z");
const EN_VENTANA_TURNO_2 = new Date("2026-10-20T23:00:00Z");
const FUERA_DE_VENTANA = new Date("2026-10-20T14:00:00Z");

const MSG_INICIO = /fuera del horario de inspección/i;
const MSG_CONTINUAR = /superó el horario para realizar la inspección/i;

function loginComo(user: { id: string; role: Role }) {
  mockAuth.mockResolvedValue({ user: { id: user.id, role: user.role } });
}

function enHora(instante: Date) {
  vi.setSystemTime(instante);
}

async function crearTrabajadorConVehiculo() {
  const vehicle = await crearVehiculo({ tipoVehiculo: TipoVehiculo.MOTO });
  const worker = await crearUsuario(Role.TRABAJADOR, {
    tipoVehiculo: TipoVehiculo.MOTO,
    vehicleId: vehicle.id,
  });
  return { worker, vehicle };
}

async function crearInspeccion(startedAt: Date, completa = false) {
  const { worker, vehicle } = await crearTrabajadorConVehiculo();
  const inspection = await prisma.inspection.create({
    data: {
      workerId: worker.id,
      conductorId: worker.id,
      vehicleId: vehicle.id,
      startedAt,
      ...(completa
        ? {
            puedeOperar: true,
            tomaMedicamentos: false,
            condicionesAptas: true,
            consumioAlcohol: false,
            declaracionEstadoAt: startedAt,
          }
        : {}),
    },
  });
  if (completa) {
    const item = await prisma.checklistItem.findFirstOrThrow();
    await prisma.inspectionItemResponse.create({
      data: { inspectionId: inspection.id, checklistItemId: item.id, valor: RespuestaChecklist.OK },
    });
    await prisma.firma.create({
      data: { inspectionId: inspection.id, userId: worker.id, tipo: TipoFirma.CONDUCTOR, s3Key: "firmas/t.png" },
    });
    for (const tipo of [TipoFotoInspeccion.LATERAL, TipoFotoInspeccion.PLACA]) {
      await prisma.fotoInspeccion.create({
        data: { inspectionId: inspection.id, tipo, s3Key: `fotos-inspeccion/${tipo}.jpg` },
      });
    }
  }
  return { worker, vehicle, inspection };
}

async function habilitar(
  usuarioId: string,
  desde: Date,
  hasta: Date,
  tipo: TipoHabilitacion = TipoHabilitacion.RECORREDOR,
) {
  const sst = await crearUsuario(Role.SST);
  return prisma.habilitacionHorario.create({
    data: { tipo, usuarioId, desde, hasta, justificacion: "Prueba", otorgadaPorId: sst.id },
  });
}

async function auditoriasBloqueadas() {
  return prisma.auditLog.findMany({ where: { action: "INSPECCION_FUERA_DE_HORARIO_BLOQUEADA" } });
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(EN_VENTANA);
  await limpiarBaseDeTest();
  await crearCatalogoMinimo();
  mockAuth.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

afterAll(async () => {
  await limpiarBaseDeTest();
  await prisma.$disconnect();
});

describe("iniciarInspeccion — horario", () => {
  it("permite iniciar dentro de la ventana y fija startedAt con la hora del chequeo", async () => {
    const { worker, vehicle } = await crearTrabajadorConVehiculo();
    loginComo(worker);

    const inspection = await iniciarInspeccion(vehicle.id);

    expect(inspection.startedAt).toEqual(EN_VENTANA);
    expect(await auditoriasBloqueadas()).toHaveLength(0);
  });

  it("bloquea fuera de la ventana y deja auditoría sobre el usuario", async () => {
    const { worker, vehicle } = await crearTrabajadorConVehiculo();
    loginComo(worker);
    enHora(FUERA_DE_VENTANA);

    await expect(iniciarInspeccion(vehicle.id)).rejects.toThrow(MSG_INICIO);

    expect(await prisma.inspection.count({ where: { workerId: worker.id } })).toBe(0);
    const auditorias = await auditoriasBloqueadas();
    expect(auditorias).toHaveLength(1);
    expect(auditorias[0]).toMatchObject({
      userId: worker.id,
      entityType: "User",
      entityId: worker.id,
      metadata: { accion: "iniciarInspeccion" },
    });
  });

  it("bloquea a las 6:30 exactas (fin excluido)", async () => {
    const { worker, vehicle } = await crearTrabajadorConVehiculo();
    loginComo(worker);
    enHora(CIERRE_TURNO_1);

    await expect(iniciarInspeccion(vehicle.id)).rejects.toThrow(MSG_INICIO);
  });

  it("permite iniciar fuera de la ventana con una habilitación RECORREDOR vigente", async () => {
    const { worker, vehicle } = await crearTrabajadorConVehiculo();
    loginComo(worker);
    enHora(FUERA_DE_VENTANA);
    await habilitar(worker.id, new Date("2026-10-20T13:00:00Z"), new Date("2026-10-20T15:00:00Z"));

    const inspection = await iniciarInspeccion(vehicle.id);

    expect(inspection.workerId).toBe(worker.id);
  });

  it("no cuenta una habilitación vencida, futura, de tipo APROBACION ni de otro usuario", async () => {
    const { worker, vehicle } = await crearTrabajadorConVehiculo();
    const otro = await crearUsuario(Role.TRABAJADOR);
    loginComo(worker);
    enHora(FUERA_DE_VENTANA);
    await habilitar(worker.id, new Date("2026-10-20T12:00:00Z"), new Date("2026-10-20T13:59:59Z"));
    await habilitar(worker.id, new Date("2026-10-20T14:00:01Z"), new Date("2026-10-20T16:00:00Z"));
    await habilitar(
      worker.id,
      new Date("2026-10-20T13:00:00Z"),
      new Date("2026-10-20T15:00:00Z"),
      TipoHabilitacion.APROBACION,
    );
    await habilitar(otro.id, new Date("2026-10-20T13:00:00Z"), new Date("2026-10-20T15:00:00Z"));

    await expect(iniciarInspeccion(vehicle.id)).rejects.toThrow(MSG_INICIO);
  });

  it("la habilitación termina en `hasta` (fin excluido)", async () => {
    const { worker, vehicle } = await crearTrabajadorConVehiculo();
    loginComo(worker);
    enHora(FUERA_DE_VENTANA);
    await habilitar(worker.id, new Date("2026-10-20T13:00:00Z"), FUERA_DE_VENTANA);

    await expect(iniciarInspeccion(vehicle.id)).rejects.toThrow(MSG_INICIO);
  });
});

describe("iniciarInspeccion — reuso por turno", () => {
  it("devuelve la misma EN_PROCESO iniciada en el turno en curso", async () => {
    const { worker, vehicle, inspection } = await crearInspeccion(new Date("2026-10-20T10:50:00Z"));
    loginComo(worker);

    const devuelta = await iniciarInspeccion(vehicle.id);

    expect(devuelta.id).toBe(inspection.id);
    expect(devuelta.status).toBe(InspectionStatus.EN_PROCESO);
  });

  it("al iniciar en el turno 2 cancela la pendiente del turno 1 y abre una nueva", async () => {
    const { worker, vehicle, inspection } = await crearInspeccion(new Date("2026-10-20T11:00:00Z"));
    loginComo(worker);
    enHora(EN_VENTANA_TURNO_2);

    const nueva = await iniciarInspeccion(vehicle.id);

    expect(nueva.id).not.toBe(inspection.id);
    expect(nueva.startedAt).toEqual(EN_VENTANA_TURNO_2);
    const vieja = await prisma.inspection.findUniqueOrThrow({ where: { id: inspection.id } });
    expect(vieja.status).toBe(InspectionStatus.CANCELADA);
    const cancelacion = await prisma.auditLog.findFirstOrThrow({
      where: { action: "CANCELAR_INSPECCION", entityId: inspection.id },
    });
    expect(cancelacion.metadata).toEqual({ motivo: "abandonada", reemplazadaPor: nueva.id });
  });

  it("con habilitación, fuera de la ventana retoma la del turno que acaba de cerrar", async () => {
    const { worker, vehicle, inspection } = await crearInspeccion(new Date("2026-10-20T11:20:00Z"));
    loginComo(worker);
    enHora(DESPUES_DE_CIERRE);
    await habilitar(worker.id, new Date("2026-10-20T11:30:00Z"), new Date("2026-10-20T13:00:00Z"));

    const devuelta = await iniciarInspeccion(vehicle.id);

    expect(devuelta.id).toBe(inspection.id);
  });
});

describe("continuar una inspección — horario", () => {
  it("permite guardar dentro de la misma ventana en que se inició", async () => {
    const { worker, inspection } = await crearInspeccion(new Date("2026-10-20T10:50:00Z"));
    loginComo(worker);

    const actualizada = await registrarKilometraje(inspection.id, { kilometraje: 1200 });

    expect(actualizada.kilometraje).toBe(1200);
  });

  it("bloquea guardar cuando la ventana ya cerró y deja auditoría sobre la inspección", async () => {
    const { worker, inspection } = await crearInspeccion(new Date("2026-10-20T10:50:00Z"));
    loginComo(worker);
    enHora(DESPUES_DE_CIERRE);

    await expect(registrarKilometraje(inspection.id, { kilometraje: 1200 })).rejects.toThrow(MSG_CONTINUAR);

    const despues = await prisma.inspection.findUniqueOrThrow({ where: { id: inspection.id } });
    expect(despues.kilometraje).toBeNull();
    const auditorias = await auditoriasBloqueadas();
    expect(auditorias).toHaveLength(1);
    expect(auditorias[0]).toMatchObject({
      userId: worker.id,
      entityType: "Inspection",
      entityId: inspection.id,
      metadata: { accion: "registrarKilometraje" },
    });
  });

  it("bloquea en una ventana posterior una inspección iniciada en una anterior", async () => {
    const { worker, inspection } = await crearInspeccion(new Date("2026-10-20T10:50:00Z"));
    loginComo(worker);
    enHora(EN_VENTANA_TURNO_2);

    await expect(registrarKilometraje(inspection.id, { kilometraje: 1200 })).rejects.toThrow(MSG_CONTINUAR);
  });

  it("permite guardar fuera de la ventana con una habilitación RECORREDOR vigente", async () => {
    const { worker, inspection } = await crearInspeccion(new Date("2026-10-20T10:50:00Z"));
    loginComo(worker);
    enHora(DESPUES_DE_CIERRE);
    await habilitar(worker.id, new Date("2026-10-20T11:35:00Z"), new Date("2026-10-20T12:30:00Z"));

    const actualizada = await registrarKilometraje(inspection.id, { kilometraje: 1200 });

    expect(actualizada.kilometraje).toBe(1200);
  });
});

describe("cancelarInspeccion — horario", () => {
  it("bloquea cancelar fuera de las ventanas y deja auditoría sobre la inspección", async () => {
    const { worker, inspection } = await crearInspeccion(new Date("2026-10-20T10:50:00Z"));
    loginComo(worker);
    enHora(FUERA_DE_VENTANA);

    await expect(cancelarInspeccion(inspection.id)).rejects.toThrow(MSG_INICIO);

    const despues = await prisma.inspection.findUniqueOrThrow({ where: { id: inspection.id } });
    expect(despues.status).toBe(InspectionStatus.EN_PROCESO);
    const auditorias = await auditoriasBloqueadas();
    expect(auditorias).toHaveLength(1);
    expect(auditorias[0]).toMatchObject({
      entityType: "Inspection",
      entityId: inspection.id,
      metadata: { accion: "cancelarInspeccion" },
    });
  });

  it("permite cancelar dentro de cualquier ventana, aunque la inspección sea de una anterior", async () => {
    const { worker, inspection } = await crearInspeccion(new Date("2026-10-20T10:50:00Z"));
    loginComo(worker);
    enHora(EN_VENTANA_TURNO_2);

    const cancelada = await cancelarInspeccion(inspection.id);

    expect(cancelada.status).toBe(InspectionStatus.CANCELADA);
  });

  it("permite cancelar fuera de las ventanas con una habilitación RECORREDOR vigente", async () => {
    const { worker, inspection } = await crearInspeccion(new Date("2026-10-20T10:50:00Z"));
    loginComo(worker);
    enHora(FUERA_DE_VENTANA);
    await habilitar(worker.id, new Date("2026-10-20T13:00:00Z"), new Date("2026-10-20T15:00:00Z"));

    const cancelada = await cancelarInspeccion(inspection.id);

    expect(cancelada.status).toBe(InspectionStatus.CANCELADA);
  });
});

describe("enviarInspeccion — horario", () => {
  it("dentro de su propia ventana no marca la inspección como fuera de horario", async () => {
    const { worker, inspection } = await crearInspeccion(new Date("2026-10-20T10:50:00Z"), true);
    loginComo(worker);

    const enviada = await enviarInspeccion(inspection.id);

    expect(enviada.enviadaFueraDeHorario).toBe(false);
    expect(enviada.habilitacionId).toBeNull();
  });

  it("dentro de su ventana ignora una habilitación vigente: no la marca", async () => {
    const { worker, inspection } = await crearInspeccion(new Date("2026-10-20T10:50:00Z"), true);
    loginComo(worker);
    await habilitar(worker.id, new Date("2026-10-20T10:00:00Z"), new Date("2026-10-20T12:00:00Z"));

    const enviada = await enviarInspeccion(inspection.id);

    expect(enviada.enviadaFueraDeHorario).toBe(false);
    expect(enviada.habilitacionId).toBeNull();
  });

  it("bloquea el envío después de cerrar la ventana y deja auditoría", async () => {
    const { worker, inspection } = await crearInspeccion(new Date("2026-10-20T10:50:00Z"), true);
    loginComo(worker);
    enHora(DESPUES_DE_CIERRE);

    await expect(enviarInspeccion(inspection.id)).rejects.toThrow(MSG_CONTINUAR);

    const despues = await prisma.inspection.findUniqueOrThrow({ where: { id: inspection.id } });
    expect(despues.status).toBe("EN_PROCESO");
    const auditorias = await auditoriasBloqueadas();
    expect(auditorias).toHaveLength(1);
    expect(auditorias[0].metadata).toMatchObject({ accion: "enviarInspeccion" });
  });

  it("con habilitación vigente envía fuera de horario y guarda bandera y habilitacionId", async () => {
    const { worker, inspection } = await crearInspeccion(new Date("2026-10-20T10:50:00Z"), true);
    loginComo(worker);
    enHora(DESPUES_DE_CIERRE);
    const habilitacion = await habilitar(
      worker.id,
      new Date("2026-10-20T11:35:00Z"),
      new Date("2026-10-20T12:30:00Z"),
    );

    const enviada = await enviarInspeccion(inspection.id);

    expect(enviada.status).toBe("PENDIENTE_APROBACION");
    expect(enviada.enviadaFueraDeHorario).toBe(true);
    expect(enviada.habilitacionId).toBe(habilitacion.id);
  });
});
