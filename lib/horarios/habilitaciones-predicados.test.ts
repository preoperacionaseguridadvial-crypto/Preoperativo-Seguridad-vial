import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { Role, TipoHabilitacion } from "@/generated/prisma/client";
import {
  exigirHorarioParaContinuar,
  exigirHorarioParaIniciar,
  HorarioBloqueadoError,
  MENSAJE_CONTINUAR_FUERA_DE_HORARIO,
  MENSAJE_INICIO_FUERA_DE_HORARIO,
  puedeContinuarInspeccion,
  puedeIniciarInspeccion,
} from "@/lib/horarios/habilitaciones";
import { crearUsuario, limpiarBaseDeTest } from "@/test/helpers/db";

// Bogotá = UTC-5. Turno 1: 10:45–11:30 UTC.
const EN_VENTANA = new Date("2026-10-20T11:00:00Z");
const DESPUES_DE_CIERRE = new Date("2026-10-20T11:40:00Z");
const INICIADA_EN_TURNO_1 = new Date("2026-10-20T10:50:00Z");

async function habilitar(usuarioId: string, tipo: TipoHabilitacion, desde: Date, hasta: Date) {
  const sst = await crearUsuario(Role.SST);
  return prisma.habilitacionHorario.create({
    data: { tipo, usuarioId, desde, hasta, justificacion: "Prueba", otorgadaPorId: sst.id },
  });
}

beforeEach(async () => {
  await limpiarBaseDeTest();
});

afterAll(async () => {
  await limpiarBaseDeTest();
  await prisma.$disconnect();
});

describe("puedeContinuarInspeccion", () => {
  it("es true si la inspección empezó en la ventana abierta", async () => {
    const worker = await crearUsuario(Role.TRABAJADOR);
    const inspection = { id: "i1", workerId: worker.id, startedAt: INICIADA_EN_TURNO_1 };

    expect(await puedeContinuarInspeccion(inspection, EN_VENTANA)).toBe(true);
  });

  it("es false cuando la ventana cerró y no hay habilitación", async () => {
    const worker = await crearUsuario(Role.TRABAJADOR);
    const inspection = { id: "i1", workerId: worker.id, startedAt: INICIADA_EN_TURNO_1 };

    expect(await puedeContinuarInspeccion(inspection, DESPUES_DE_CIERRE)).toBe(false);
  });

  it("es true fuera de la ventana con habilitación RECORREDOR vigente", async () => {
    const worker = await crearUsuario(Role.TRABAJADOR);
    await habilitar(worker.id, TipoHabilitacion.RECORREDOR, new Date("2026-10-20T11:35:00Z"), new Date("2026-10-20T12:30:00Z"));
    const inspection = { id: "i1", workerId: worker.id, startedAt: INICIADA_EN_TURNO_1 };

    expect(await puedeContinuarInspeccion(inspection, DESPUES_DE_CIERRE)).toBe(true);
  });

  it("no cuenta una habilitación de tipo APROBACION", async () => {
    const worker = await crearUsuario(Role.TRABAJADOR);
    await habilitar(worker.id, TipoHabilitacion.APROBACION, new Date("2026-10-20T11:35:00Z"), new Date("2026-10-20T12:30:00Z"));
    const inspection = { id: "i1", workerId: worker.id, startedAt: INICIADA_EN_TURNO_1 };

    expect(await puedeContinuarInspeccion(inspection, DESPUES_DE_CIERRE)).toBe(false);
  });

  it("no deja auditoría (es una consulta, no un bloqueo)", async () => {
    const worker = await crearUsuario(Role.TRABAJADOR);
    const inspection = { id: "i1", workerId: worker.id, startedAt: INICIADA_EN_TURNO_1 };

    await puedeContinuarInspeccion(inspection, DESPUES_DE_CIERRE);

    expect(await prisma.auditLog.count({ where: { action: "INSPECCION_FUERA_DE_HORARIO_BLOQUEADA" } })).toBe(0);
  });
});

describe("puedeIniciarInspeccion", () => {
  it("es true dentro de la ventana y false fuera sin habilitación", async () => {
    const worker = await crearUsuario(Role.TRABAJADOR);

    expect(await puedeIniciarInspeccion(worker.id, EN_VENTANA)).toBe(true);
    expect(await puedeIniciarInspeccion(worker.id, DESPUES_DE_CIERRE)).toBe(false);
  });

  it("es true fuera de la ventana con habilitación RECORREDOR vigente", async () => {
    const worker = await crearUsuario(Role.TRABAJADOR);
    await habilitar(worker.id, TipoHabilitacion.RECORREDOR, new Date("2026-10-20T11:35:00Z"), new Date("2026-10-20T12:30:00Z"));

    expect(await puedeIniciarInspeccion(worker.id, DESPUES_DE_CIERRE)).toBe(true);
  });
});

describe("HorarioBloqueadoError", () => {
  it("exigirHorarioParaIniciar lanza el error tipado con motivo INICIO y el mismo mensaje", async () => {
    const worker = await crearUsuario(Role.TRABAJADOR);

    const error = await exigirHorarioParaIniciar(worker.id, "prueba", DESPUES_DE_CIERRE).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(HorarioBloqueadoError);
    expect(error).toMatchObject({ motivo: "INICIO", message: MENSAJE_INICIO_FUERA_DE_HORARIO });
  });

  it("exigirHorarioParaContinuar lanza el error tipado con motivo CONTINUAR y deja auditoría", async () => {
    const worker = await crearUsuario(Role.TRABAJADOR);
    const inspection = { id: "i1", workerId: worker.id, startedAt: INICIADA_EN_TURNO_1 };

    const error = await exigirHorarioParaContinuar(inspection, "prueba", DESPUES_DE_CIERRE).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(HorarioBloqueadoError);
    expect(error).toMatchObject({ motivo: "CONTINUAR", message: MENSAJE_CONTINUAR_FUERA_DE_HORARIO });
    expect(await prisma.auditLog.count({ where: { action: "INSPECCION_FUERA_DE_HORARIO_BLOQUEADA" } })).toBe(1);
  });
});
