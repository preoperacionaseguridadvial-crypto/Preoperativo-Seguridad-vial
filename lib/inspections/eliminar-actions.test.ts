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
import { InspectionStatus, RespuestaChecklist, Role, TipoFirma, TipoFotoInspeccion } from "@/generated/prisma/client";
import { eliminarInspeccion } from "@/lib/inspections/eliminar-actions";
import { crearCatalogoMinimo, crearUsuario, crearVehiculo, limpiarBaseDeTest } from "@/test/helpers/db";

function loginComo(user: { id: string; role: Role }) {
  mockAuth.mockResolvedValue({ user: { id: user.id, role: user.role } });
}

async function crearInspeccionCompleta(sufijo: string) {
  const worker = await crearUsuario(Role.TRABAJADOR);
  const vehicle = await crearVehiculo();
  const { item } = await crearCatalogoMinimo();
  const inspection = await prisma.inspection.create({
    data: {
      workerId: worker.id,
      conductorId: worker.id,
      vehicleId: vehicle.id,
      status: InspectionStatus.APROBADA,
      puedeOperar: true,
      completedAt: new Date(),
    },
  });
  const respuesta = await prisma.inspectionItemResponse.create({
    data: { inspectionId: inspection.id, checklistItemId: item.id, valor: RespuestaChecklist.OK },
  });
  const novedad = await prisma.novedad.create({
    data: { inspectionId: inspection.id, inspectionItemResponseId: respuesta.id, descripcion: "Novedad de prueba", tipo: "RAYON" },
  });
  await prisma.photo.create({ data: { novedadId: novedad.id, s3Key: `novedades/${sufijo}.jpg` } });
  await prisma.firma.create({
    data: { inspectionId: inspection.id, userId: worker.id, tipo: TipoFirma.CONDUCTOR, s3Key: `firmas/${sufijo}.png` },
  });
  await prisma.fotoInspeccion.create({
    data: { inspectionId: inspection.id, tipo: TipoFotoInspeccion.PLACA, s3Key: `fotos/${sufijo}.jpg` },
  });
  return { inspection, vehicle, worker, keys: [`novedades/${sufijo}.jpg`, `firmas/${sufijo}.png`, `fotos/${sufijo}.jpg`] };
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

describe("eliminarInspeccion", () => {
  it("ADMINISTRADOR elimina una inspección APROBADA con todos sus dependientes y deja auditoría", async () => {
    const objetivo = await crearInspeccionCompleta("a");
    const otra = await crearInspeccionCompleta("b");
    const admin = await crearUsuario(Role.ADMINISTRADOR);
    loginComo(admin);

    await eliminarInspeccion(objetivo.inspection.id);

    const id = objetivo.inspection.id;
    expect(await prisma.inspection.findUnique({ where: { id } })).toBeNull();
    expect(await prisma.inspectionItemResponse.count({ where: { inspectionId: id } })).toBe(0);
    expect(await prisma.novedad.count({ where: { inspectionId: id } })).toBe(0);
    expect(await prisma.firma.count({ where: { inspectionId: id } })).toBe(0);
    expect(await prisma.fotoInspeccion.count({ where: { inspectionId: id } })).toBe(0);
    expect(await prisma.photo.count({ where: { s3Key: "novedades/a.jpg" } })).toBe(0);

    // La otra inspección queda intacta.
    expect(await prisma.inspection.findUnique({ where: { id: otra.inspection.id } })).not.toBeNull();
    expect(await prisma.photo.count({ where: { s3Key: "novedades/b.jpg" } })).toBe(1);
    expect(await prisma.firma.count({ where: { inspectionId: otra.inspection.id } })).toBe(1);

    const auditoria = await prisma.auditLog.findMany({ where: { action: "ELIMINAR_INSPECCION", entityId: id } });
    expect(auditoria).toHaveLength(1);
    expect(auditoria[0].userId).toBe(admin.id);
    expect(auditoria[0].entityType).toBe("Inspection");
    expect(auditoria[0].metadata).toMatchObject({ placa: objetivo.vehicle.placa, estado: "APROBADA" });

    expect(mockDeleteObject).toHaveBeenCalledTimes(3);
    for (const key of objetivo.keys) expect(mockDeleteObject).toHaveBeenCalledWith(key);
  });

  it.each([Role.SST, Role.SUPERVISOR, Role.SUPERVISOR_OLEARIARI, Role.DIRECTOR, Role.TRABAJADOR])(
    "%s no puede eliminar y no se borra nada",
    async (rol) => {
      const objetivo = await crearInspeccionCompleta("x");
      const usuario = await crearUsuario(rol);
      loginComo(usuario);

      await expect(eliminarInspeccion(objetivo.inspection.id)).rejects.toThrow(/no tiene permiso/i);

      expect(await prisma.inspection.findUnique({ where: { id: objetivo.inspection.id } })).not.toBeNull();
      expect(await prisma.firma.count({ where: { inspectionId: objetivo.inspection.id } })).toBe(1);
      expect(await prisma.auditLog.count({ where: { action: "ELIMINAR_INSPECCION" } })).toBe(0);
      expect(mockDeleteObject).not.toHaveBeenCalled();
    },
  );

  it("sin sesión rechaza", async () => {
    const objetivo = await crearInspeccionCompleta("s");
    mockAuth.mockResolvedValue(null);
    await expect(eliminarInspeccion(objetivo.inspection.id)).rejects.toThrow();
    expect(await prisma.inspection.findUnique({ where: { id: objetivo.inspection.id } })).not.toBeNull();
  });

  it("falla si la inspección no existe", async () => {
    loginComo(await crearUsuario(Role.ADMINISTRADOR));
    await expect(eliminarInspeccion("no-existe")).rejects.toThrow(/no encontrada/i);
  });

  it("un fallo al borrar objetos del almacenamiento no lanza y el borrado en base se mantiene", async () => {
    const objetivo = await crearInspeccionCompleta("f");
    loginComo(await crearUsuario(Role.ADMINISTRADOR));
    mockDeleteObject.mockRejectedValue(new Error("MinIO caído"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(eliminarInspeccion(objetivo.inspection.id)).resolves.toBeUndefined();

    expect(await prisma.inspection.findUnique({ where: { id: objetivo.inspection.id } })).toBeNull();
    expect(mockDeleteObject).toHaveBeenCalledTimes(3);
    spy.mockRestore();
  });
});
