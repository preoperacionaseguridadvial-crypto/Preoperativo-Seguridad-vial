import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const mockAuth = vi.fn();
vi.mock("@/lib/auth/config", () => ({
  auth: () => mockAuth(),
}));

const mockDeleteObject = vi.fn();
vi.mock("@/lib/storage/s3", () => ({
  deleteObject: (...args: unknown[]) => mockDeleteObject(...args),
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
  mockDeleteObject.mockReset();
  mockDeleteObject.mockResolvedValue(undefined);
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

  it("elimina al usuario con SU propio rastro y deja intacto lo de los demás", async () => {
    const admin = await crearUsuario(Role.ADMINISTRADOR);
    const vehiculo = await crearVehiculo();
    const objetivo = await crearUsuario(Role.TRABAJADOR, { vehicleId: vehiculo.id });
    const otro = await crearUsuario(Role.SST);
    await prisma.auditLog.create({
      data: { userId: objetivo.id, action: "LOGIN", entityType: "User", entityId: objetivo.id },
    });
    // Auditoría de OTRO usuario sobre el objetivo (p. ej. CREAR_USUARIO del admin): se conserva.
    await prisma.auditLog.create({
      data: { userId: admin.id, action: "CREAR_USUARIO", entityType: "User", entityId: objetivo.id },
    });
    await prisma.auditLog.create({
      data: { userId: otro.id, action: "LOGIN", entityType: "User", entityId: otro.id },
    });
    const hab = (usuarioId: string, otorgadaPorId: string) => ({
      tipo: "RECORREDOR" as const,
      usuarioId,
      desde: new Date(),
      hasta: new Date(Date.now() + 3600_000),
      justificacion: "prueba",
      otorgadaPorId,
    });
    await prisma.habilitacionHorario.create({ data: hab(objetivo.id, otro.id) }); // recibida
    await prisma.habilitacionHorario.create({ data: hab(objetivo.id, objetivo.id) }); // propia (se la otorgó a sí mismo)
    const ajena = await crearUsuario(Role.TRABAJADOR);
    await prisma.habilitacionHorario.create({ data: hab(ajena.id, otro.id) }); // de otros
    await prisma.autorizacionDatos.create({
      data: { userId: objetivo.id, versionPolitica: "v1", firmaS3Key: "autorizaciones/obj.png" },
    });
    await prisma.autorizacionDatos.create({
      data: { userId: otro.id, versionPolitica: "v1", firmaS3Key: "autorizaciones/otro.png" },
    });
    await prisma.appSetting.create({ data: { clave: "k", valor: "1", updatedById: objetivo.id } });
    loginComo(admin);

    await eliminarUsuario(objetivo.id);

    expect(await prisma.user.findUnique({ where: { id: objetivo.id } })).toBeNull();
    expect(await prisma.auditLog.count({ where: { userId: objetivo.id } })).toBe(0);
    expect(
      await prisma.habilitacionHorario.count({
        where: { OR: [{ usuarioId: objetivo.id }, { otorgadaPorId: objetivo.id }] },
      }),
    ).toBe(0);
    expect(await prisma.autorizacionDatos.count({ where: { userId: objetivo.id } })).toBe(0);
    const ajuste = await prisma.appSetting.findUnique({ where: { clave: "k" } });
    expect(ajuste).not.toBeNull();
    expect(ajuste?.updatedById).toBeNull();
    expect(await prisma.vehicle.findUnique({ where: { id: vehiculo.id } })).not.toBeNull();

    // Lo de los demás, intacto.
    expect(await prisma.auditLog.count({ where: { userId: otro.id } })).toBe(1);
    expect(await prisma.auditLog.count({ where: { action: "CREAR_USUARIO", entityId: objetivo.id } })).toBe(1);
    expect(await prisma.habilitacionHorario.count()).toBe(1);
    expect(await prisma.autorizacionDatos.count({ where: { userId: otro.id } })).toBe(1);

    const auditoria = await prisma.auditLog.findMany({ where: { action: "ELIMINAR_USUARIO", entityId: objetivo.id } });
    expect(auditoria).toHaveLength(1);
    expect(auditoria[0].userId).toBe(admin.id);
    expect(auditoria[0].metadata).toMatchObject({
      role: "TRABAJADOR",
      auditoriaEliminada: 1,
      habilitacionesEliminadas: 2,
      autorizacionDatosEliminada: 1,
      ajustesDesvinculados: 1,
    });
    expect(mockDeleteObject).toHaveBeenCalledTimes(1);
    expect(mockDeleteObject).toHaveBeenCalledWith("autorizaciones/obj.png");
  });

  it("un fallo al borrar el objeto de almacenamiento no hace fallar la acción", async () => {
    const admin = await crearUsuario(Role.ADMINISTRADOR);
    const objetivo = await crearUsuario(Role.TRABAJADOR);
    await prisma.autorizacionDatos.create({ data: { userId: objetivo.id, versionPolitica: "v1", firmaS3Key: "k.png" } });
    loginComo(admin);
    mockDeleteObject.mockRejectedValue(new Error("MinIO caído"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(eliminarUsuario(objetivo.id)).resolves.toBeUndefined();

    expect(await prisma.user.findUnique({ where: { id: objetivo.id } })).toBeNull();
    spy.mockRestore();
  });

  describe("bloqueos: rechaza explicando el motivo y no toca nada", () => {
    async function verificarRechazo(objetivoId: string, admin: { id: string; role: Role }, motivo: RegExp) {
      loginComo(admin);
      const antes = await contarTodo();

      await expect(eliminarUsuario(objetivoId)).rejects.toThrow(motivo);

      expect(await contarTodo()).toEqual(antes);
      expect(await prisma.user.findUnique({ where: { id: objetivoId } })).not.toBeNull();
      expect(await prisma.auditLog.count({ where: { action: "ELIMINAR_USUARIO" } })).toBe(0);
      expect(mockDeleteObject).not.toHaveBeenCalled();
    }

    it("tiene una inspección como trabajador", async () => {
      const admin = await crearUsuario(Role.ADMINISTRADOR);
      const objetivo = await crearUsuario(Role.TRABAJADOR);
      await prisma.auditLog.create({
        data: { userId: objetivo.id, action: "LOGIN", entityType: "User", entityId: objetivo.id },
      });
      await crearInspeccion(objetivo.id);
      await verificarRechazo(objetivo.id, admin, /1 inspecci.*Consulta de inspecciones/i);
    });

    it("tiene una inspección como supervisor", async () => {
      const admin = await crearUsuario(Role.ADMINISTRADOR);
      const trabajador = await crearUsuario(Role.TRABAJADOR);
      const supervisor = await crearUsuario(Role.SUPERVISOR);
      await crearInspeccion(trabajador.id, { supervisorId: supervisor.id });
      await verificarRechazo(supervisor.id, admin, /inspecci.*Consulta de inspecciones/i);
    });

    it("tiene una firma", async () => {
      const admin = await crearUsuario(Role.ADMINISTRADOR);
      const trabajador = await crearUsuario(Role.TRABAJADOR);
      const firmante = await crearUsuario(Role.SUPERVISOR);
      const inspeccion = await crearInspeccion(trabajador.id);
      await prisma.firma.create({
        data: { inspectionId: inspeccion.id, userId: firmante.id, tipo: TipoFirma.CONDUCTOR, s3Key: "firmas/x.png" },
      });
      await verificarRechazo(firmante.id, admin, /firmas/i);
    });

    it("tiene una habilitación ligada a la inspección de otro usuario", async () => {
      const admin = await crearUsuario(Role.ADMINISTRADOR);
      const trabajador = await crearUsuario(Role.TRABAJADOR);
      const otorgante = await crearUsuario(Role.SST);
      const habilitacion = await prisma.habilitacionHorario.create({
        data: {
          tipo: "RECORREDOR",
          usuarioId: trabajador.id,
          desde: new Date(),
          hasta: new Date(Date.now() + 3600_000),
          justificacion: "prueba",
          otorgadaPorId: otorgante.id,
        },
      });
      await crearInspeccion(trabajador.id, { habilitacionId: habilitacion.id });
      // El otorgante no tiene inspecciones propias: solo lo frena la habilitación ligada.
      await verificarRechazo(otorgante.id, admin, /habilitaci.*ligada a una inspecci/i);
    });

    it("otorgó una habilitación (no usada) a otro usuario: es historial de ese usuario", async () => {
      const admin = await crearUsuario(Role.ADMINISTRADOR);
      const beneficiario = await crearUsuario(Role.SUPERVISOR);
      const otorgante = await crearUsuario(Role.SST);
      await prisma.habilitacionHorario.create({
        data: {
          tipo: "APROBACION",
          usuarioId: beneficiario.id,
          desde: new Date(),
          hasta: new Date(Date.now() + 3600_000),
          justificacion: "prueba",
          otorgadaPorId: otorgante.id,
        },
      });
      await verificarRechazo(otorgante.id, admin, /otorg.*habilitaci.*otros usuarios/i);
    });
  });
});
