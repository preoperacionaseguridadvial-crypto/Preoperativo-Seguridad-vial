import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const mockAuth = vi.fn();
vi.mock("@/lib/auth/config", () => ({
  auth: () => mockAuth(),
}));

import { prisma } from "@/lib/prisma";
import { Role, TipoHabilitacion } from "@/generated/prisma/client";
import {
  otorgarHabilitacion,
  otorgarHabilitacionDesdeFormulario,
} from "@/lib/horarios/habilitacion-actions";
import { crearUsuario, limpiarBaseDeTest } from "@/test/helpers/db";

const JUSTIFICACION = "Falla del aplicativo durante el turno";

function loginComo(user: { id: string; role: Role }) {
  mockAuth.mockResolvedValue({ user: { id: user.id, role: user.role } });
}

function datos(usuarioId: string, overrides: Record<string, unknown> = {}) {
  return {
    tipo: TipoHabilitacion.RECORREDOR,
    usuarioId,
    fecha: "2099-01-05",
    horaDesde: "06:30",
    horaHasta: "08:00",
    justificacion: JUSTIFICACION,
    ...overrides,
  };
}

describe("otorgarHabilitacion", () => {
  beforeEach(async () => {
    await limpiarBaseDeTest();
    mockAuth.mockReset();
  });

  afterAll(async () => {
    await limpiarBaseDeTest();
    await prisma.$disconnect();
  });

  it("SST otorga una habilitación RECORREDOR en hora de Bogotá y la audita", async () => {
    const sst = await crearUsuario(Role.SST);
    const trabajador = await crearUsuario(Role.TRABAJADOR);
    loginComo(sst);

    const creada = await otorgarHabilitacion(datos(trabajador.id));

    const fila = await prisma.habilitacionHorario.findUniqueOrThrow({ where: { id: creada.id } });
    expect(fila.tipo).toBe(TipoHabilitacion.RECORREDOR);
    expect(fila.usuarioId).toBe(trabajador.id);
    expect(fila.otorgadaPorId).toBe(sst.id);
    expect(fila.desde.toISOString()).toBe("2099-01-05T11:30:00.000Z");
    expect(fila.hasta.toISOString()).toBe("2099-01-05T13:00:00.000Z");
    expect(fila.justificacion).toBe(JUSTIFICACION);

    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { action: "OTORGAR_HABILITACION_HORARIO", entityId: creada.id },
    });
    expect(audit.userId).toBe(sst.id);
    expect(audit.entityType).toBe("HabilitacionHorario");
    expect(audit.metadata).toMatchObject({
      tipo: "RECORREDOR",
      usuarioId: trabajador.id,
      desde: "2099-01-05T11:30:00.000Z",
      hasta: "2099-01-05T13:00:00.000Z",
    });
  });

  it("ADMINISTRADOR también otorga una habilitación y queda como otorgante", async () => {
    const admin = await crearUsuario(Role.ADMINISTRADOR);
    const trabajador = await crearUsuario(Role.TRABAJADOR);
    loginComo(admin);

    const creada = await otorgarHabilitacion(datos(trabajador.id));

    const fila = await prisma.habilitacionHorario.findUniqueOrThrow({ where: { id: creada.id } });
    expect(fila.otorgadaPorId).toBe(admin.id);
  });

  it.each([Role.SUPERVISOR, Role.SUPERVISOR_OLEARIARI])(
    "SST otorga una habilitación APROBACION a %s",
    async (rol) => {
      const sst = await crearUsuario(Role.SST);
      const aprobador = await crearUsuario(rol);
      loginComo(sst);

      const creada = await otorgarHabilitacion(
        datos(aprobador.id, { tipo: TipoHabilitacion.APROBACION }),
      );

      expect(creada.tipo).toBe(TipoHabilitacion.APROBACION);
      expect(await prisma.auditLog.count({ where: { action: "OTORGAR_HABILITACION_HORARIO" } })).toBe(1);
    },
  );

  it.each([Role.TRABAJADOR, Role.SUPERVISOR, Role.DIRECTOR])(
    "rechaza a %s como otorgante",
    async (rol) => {
      const quien = await crearUsuario(rol);
      const trabajador = await crearUsuario(Role.TRABAJADOR);
      loginComo(quien);

      await expect(otorgarHabilitacion(datos(trabajador.id))).rejects.toThrow();
      expect(await prisma.habilitacionHorario.count()).toBe(0);
    },
  );

  it("rechaza un beneficiario con rol incorrecto para el tipo", async () => {
    const sst = await crearUsuario(Role.SST);
    const aprobador = await crearUsuario(Role.SUPERVISOR);
    const trabajador = await crearUsuario(Role.TRABAJADOR);
    loginComo(sst);

    await expect(otorgarHabilitacion(datos(aprobador.id))).rejects.toThrow(/recorredor/i);
    await expect(
      otorgarHabilitacion(datos(trabajador.id, { tipo: TipoHabilitacion.APROBACION })),
    ).rejects.toThrow(/aprobador/i);
    expect(await prisma.habilitacionHorario.count()).toBe(0);
  });

  it("rechaza un beneficiario inexistente o inactivo", async () => {
    const sst = await crearUsuario(Role.SST);
    const inactivo = await crearUsuario(Role.TRABAJADOR);
    await prisma.user.update({ where: { id: inactivo.id }, data: { activo: false } });
    loginComo(sst);

    await expect(otorgarHabilitacion(datos(inactivo.id))).rejects.toThrow(/inactivo/i);
    await expect(otorgarHabilitacion(datos("no-existe"))).rejects.toThrow(/no existe/i);
    expect(await prisma.habilitacionHorario.count()).toBe(0);
  });

  it("rechaza un rango donde hasta no es posterior a desde", async () => {
    const sst = await crearUsuario(Role.SST);
    const trabajador = await crearUsuario(Role.TRABAJADOR);
    loginComo(sst);

    await expect(
      otorgarHabilitacion(datos(trabajador.id, { horaDesde: "08:00", horaHasta: "08:00" })),
    ).rejects.toThrow(/posterior/i);
    await expect(
      otorgarHabilitacion(datos(trabajador.id, { horaDesde: "09:00", horaHasta: "08:00" })),
    ).rejects.toThrow(/posterior/i);
  });

  it("rechaza fecha u hora inválidas", async () => {
    const sst = await crearUsuario(Role.SST);
    const trabajador = await crearUsuario(Role.TRABAJADOR);
    loginComo(sst);

    await expect(otorgarHabilitacion(datos(trabajador.id, { fecha: "" }))).rejects.toThrow(/fecha/i);
    await expect(otorgarHabilitacion(datos(trabajador.id, { horaDesde: "" }))).rejects.toThrow(/hora/i);
  });

  it("rechaza un rango que ya terminó", async () => {
    const sst = await crearUsuario(Role.SST);
    const trabajador = await crearUsuario(Role.TRABAJADOR);
    loginComo(sst);

    await expect(
      otorgarHabilitacion(datos(trabajador.id, { fecha: "2020-01-05" })),
    ).rejects.toThrow(/terminó/i);
    expect(await prisma.habilitacionHorario.count()).toBe(0);
  });

  it("acepta un rango que ya empezó pero aún no termina", async () => {
    const sst = await crearUsuario(Role.SST);
    const trabajador = await crearUsuario(Role.TRABAJADOR);
    loginComo(sst);
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      vi.setSystemTime(new Date("2099-01-05T12:00:00Z")); // 07:00 en Bogotá
      await expect(otorgarHabilitacion(datos(trabajador.id))).resolves.toMatchObject({
        usuarioId: trabajador.id,
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("rechaza una justificación vacía o menor a 10 caracteres y recorta espacios", async () => {
    const sst = await crearUsuario(Role.SST);
    const trabajador = await crearUsuario(Role.TRABAJADOR);
    loginComo(sst);

    await expect(otorgarHabilitacion(datos(trabajador.id, { justificacion: "   " }))).rejects.toThrow(
      /justificación/i,
    );
    await expect(
      otorgarHabilitacion(datos(trabajador.id, { justificacion: "  corta  " })),
    ).rejects.toThrow(/10 caracteres/);

    const creada = await otorgarHabilitacion(
      datos(trabajador.id, { justificacion: `  ${JUSTIFICACION}  ` }),
    );
    expect(creada.justificacion).toBe(JUSTIFICACION);
  });
});

describe("otorgarHabilitacionDesdeFormulario", () => {
  beforeEach(async () => {
    await limpiarBaseDeTest();
    mockAuth.mockReset();
  });

  afterAll(async () => {
    await limpiarBaseDeTest();
    await prisma.$disconnect();
  });

  function formulario(usuarioId: string, overrides: Record<string, string> = {}) {
    const fd = new FormData();
    const base: Record<string, string> = {
      tipo: "RECORREDOR",
      usuarioId,
      fecha: "2099-01-05",
      horaDesde: "06:30",
      horaHasta: "08:00",
      justificacion: JUSTIFICACION,
      ...overrides,
    };
    for (const [k, v] of Object.entries(base)) fd.set(k, v);
    return fd;
  }

  it("devuelve ok en éxito", async () => {
    const sst = await crearUsuario(Role.SST);
    const trabajador = await crearUsuario(Role.TRABAJADOR);
    loginComo(sst);

    const estado = await otorgarHabilitacionDesdeFormulario(null, formulario(trabajador.id));

    expect(estado.ok).toBe(true);
    expect(await prisma.habilitacionHorario.count()).toBe(1);
  });

  it("devuelve el mensaje de dominio y repuebla los valores en error", async () => {
    const sst = await crearUsuario(Role.SST);
    const trabajador = await crearUsuario(Role.TRABAJADOR);
    loginComo(sst);

    const estado = await otorgarHabilitacionDesdeFormulario(
      null,
      formulario(trabajador.id, { justificacion: "corta" }),
    );

    expect(estado).toMatchObject({ ok: false, valores: { justificacion: "corta", usuarioId: trabajador.id } });
    if (!estado.ok) expect(estado.error).toMatch(/10 caracteres/);
  });

  it("devuelve un mensaje genérico ante un error inesperado", async () => {
    const sst = await crearUsuario(Role.SST);
    loginComo(sst);
    const consola = vi.spyOn(console, "error").mockImplementation(() => {});

    const estado = await otorgarHabilitacionDesdeFormulario(null, formulario("x", { tipo: "OTRO" }));

    expect(estado.ok).toBe(false);
    consola.mockRestore();
  });
});
