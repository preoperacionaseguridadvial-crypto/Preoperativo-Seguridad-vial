import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const mockAuth = vi.fn();
vi.mock("@/lib/auth/config", () => ({
  auth: () => mockAuth(),
}));

import { prisma } from "@/lib/prisma";
import { InspectionStatus, Role, TipoFirma } from "@/generated/prisma/client";
import { eliminarUsuario } from "@/lib/admin/eliminar-usuario-actions";
import { crearUsuario, crearVehiculo, limpiarBaseDeTest } from "@/test/helpers/db";

function loginComo(user: { id: string; role: Role }) {
  mockAuth.mockResolvedValue({ user: { id: user.id, role: user.role } });
}

async function crearInspeccion(workerId: string, extra: Record<string, string> = {}) {
  const vehicle = await crearVehiculo();
  return prisma.inspection.create({
    data: {
      workerId,
      conductorId: workerId,
      vehicleId: vehicle.id,
      status: InspectionStatus.APROBADA,
      puedeOperar: true,
      completedAt: new Date(),
      ...extra,
    },
  });
}

async function contarTodo() {
  return {
    usuarios: await prisma.user.count(),
    inspecciones: await prisma.inspection.count(),
    vehiculos: await prisma.vehicle.count(),
    auditoria: await prisma.auditLog.count(),
    firmas: await prisma.firma.count(),
    habilitaciones: await prisma.habilitacionHorario.count(),
    autorizaciones: await prisma.autorizacionDatos.count(),
    ajustes: await prisma.appSetting.count(),
  };
}

beforeEach(async () => {
  await limpiarBaseDeTest();
  mockAuth.mockReset();
});

afterAll(async () => {
  await limpiarBaseDeTest();
  await prisma.$disconnect();
});

describe("eliminarUsuario", () => {
  it("ADMINISTRADOR elimina un usuario sin historial, conserva su vehículo y deja auditoría", async () => {
    const vehiculo = await crearVehiculo();
    const objetivo = await crearUsuario(Role.TRABAJADOR, { vehicleId: vehiculo.id, name: "Creado por error" });
    const otro = await crearUsuario(Role.TRABAJADOR);
    const admin = await crearUsuario(Role.ADMINISTRADOR);
    loginComo(admin);

    await eliminarUsuario(objetivo.id);

    expect(await prisma.user.findUnique({ where: { id: objetivo.id } })).toBeNull();
    expect(await prisma.user.findUnique({ where: { id: otro.id } })).not.toBeNull();
    expect(await prisma.vehicle.findUnique({ where: { id: vehiculo.id } })).not.toBeNull();

    const auditoria = await prisma.auditLog.findMany({ where: { action: "ELIMINAR_USUARIO", entityId: objetivo.id } });
    expect(auditoria).toHaveLength(1);
    expect(auditoria[0].userId).toBe(admin.id);
    expect(auditoria[0].entityType).toBe("User");
    expect(auditoria[0].metadata).toMatchObject({ name: "Creado por error", email: objetivo.email, role: "TRABAJADOR" });
  });

  it.each([Role.SST, Role.SUPERVISOR, Role.SUPERVISOR_OLEARIARI, Role.DIRECTOR, Role.TRABAJADOR])(
    "%s no puede eliminar usuarios y no se borra nada",
    async (rol) => {
      const objetivo = await crearUsuario(Role.TRABAJADOR);
      const actor = await crearUsuario(rol);
      loginComo(actor);
      const antes = await contarTodo();

      await expect(eliminarUsuario(objetivo.id)).rejects.toThrow(/no tiene permiso/i);

      expect(await contarTodo()).toEqual(antes);
      expect(await prisma.user.findUnique({ where: { id: objetivo.id } })).not.toBeNull();
    },
  );

  it("sin sesión rechaza", async () => {
    const objetivo = await crearUsuario(Role.TRABAJADOR);
    mockAuth.mockResolvedValue(null);
    await expect(eliminarUsuario(objetivo.id)).rejects.toThrow();
    expect(await prisma.user.findUnique({ where: { id: objetivo.id } })).not.toBeNull();
  });

  it("un administrador no puede eliminar su propia cuenta", async () => {
    const admin = await crearUsuario(Role.ADMINISTRADOR);
    loginComo(admin);

    await expect(eliminarUsuario(admin.id)).rejects.toThrow(/propia cuenta/i);

    expect(await prisma.user.findUnique({ where: { id: admin.id } })).not.toBeNull();
    expect(await prisma.auditLog.count({ where: { action: "ELIMINAR_USUARIO" } })).toBe(0);
  });

  it("falla si el usuario no existe", async () => {
    loginComo(await crearUsuario(Role.ADMINISTRADOR));
    await expect(eliminarUsuario("no-existe")).rejects.toThrow(/no encontrado/i);
  });

  describe("con historial: rechaza, indica desactivar y no toca nada", () => {
    async function verificarRechazo(objetivoId: string, admin: { id: string; role: Role }) {
      loginComo(admin);
      const antes = await contarTodo();

      await expect(eliminarUsuario(objetivoId)).rejects.toThrow(/historial.*desact/i);

      expect(await contarTodo()).toEqual(antes);
      expect(await prisma.user.findUnique({ where: { id: objetivoId } })).not.toBeNull();
      expect(await prisma.auditLog.count({ where: { action: "ELIMINAR_USUARIO" } })).toBe(0);
    }

    it("tiene una inspección como trabajador", async () => {
      const admin = await crearUsuario(Role.ADMINISTRADOR);
      const objetivo = await crearUsuario(Role.TRABAJADOR);
      await crearInspeccion(objetivo.id);
      await verificarRechazo(objetivo.id, admin);
    });

    it("tiene una inspección como supervisor", async () => {
      const admin = await crearUsuario(Role.ADMINISTRADOR);
      const trabajador = await crearUsuario(Role.TRABAJADOR);
      const supervisor = await crearUsuario(Role.SUPERVISOR);
      await crearInspeccion(trabajador.id, { supervisorId: supervisor.id });
      await verificarRechazo(supervisor.id, admin);
    });

    it("tiene un registro de auditoría (LOGIN)", async () => {
      const admin = await crearUsuario(Role.ADMINISTRADOR);
      const objetivo = await crearUsuario(Role.SST);
      await prisma.auditLog.create({
        data: { userId: objetivo.id, action: "LOGIN", entityType: "User", entityId: objetivo.id },
      });
      await verificarRechazo(objetivo.id, admin);
    });

    it("tiene una firma", async () => {
      const admin = await crearUsuario(Role.ADMINISTRADOR);
      const trabajador = await crearUsuario(Role.TRABAJADOR);
      const firmante = await crearUsuario(Role.SUPERVISOR);
      const inspeccion = await crearInspeccion(trabajador.id);
      await prisma.firma.create({
        data: { inspectionId: inspeccion.id, userId: firmante.id, tipo: TipoFirma.CONDUCTOR, s3Key: "firmas/x.png" },
      });
      await verificarRechazo(firmante.id, admin);
    });

    it("tiene una habilitación otorgada", async () => {
      const admin = await crearUsuario(Role.ADMINISTRADOR);
      const beneficiario = await crearUsuario(Role.TRABAJADOR);
      const otorgante = await crearUsuario(Role.SST);
      await prisma.habilitacionHorario.create({
        data: {
          tipo: "RECORREDOR",
          usuarioId: beneficiario.id,
          desde: new Date(),
          hasta: new Date(Date.now() + 3600_000),
          justificacion: "prueba",
          otorgadaPorId: otorgante.id,
        },
      });
      await verificarRechazo(otorgante.id, admin);
    });

    it("tiene una habilitación recibida", async () => {
      const admin = await crearUsuario(Role.ADMINISTRADOR);
      const beneficiario = await crearUsuario(Role.TRABAJADOR);
      const otorgante = await crearUsuario(Role.SST);
      await prisma.habilitacionHorario.create({
        data: {
          tipo: "RECORREDOR",
          usuarioId: beneficiario.id,
          desde: new Date(),
          hasta: new Date(Date.now() + 3600_000),
          justificacion: "prueba",
          otorgadaPorId: otorgante.id,
        },
      });
      await verificarRechazo(beneficiario.id, admin);
    });

    it("tiene autorización de datos o ajustes actualizados", async () => {
      const admin = await crearUsuario(Role.ADMINISTRADOR);
      const a = await crearUsuario(Role.TRABAJADOR);
      await prisma.autorizacionDatos.create({ data: { userId: a.id, versionPolitica: "v1", firmaS3Key: "k" } });
      await verificarRechazo(a.id, admin);

      const b = await crearUsuario(Role.SST);
      await prisma.appSetting.create({ data: { clave: "x", valor: "1", updatedById: b.id } });
      await verificarRechazo(b.id, admin);
    });
  });
});
