import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const mockAuth = vi.fn();
vi.mock("@/lib/auth/config", () => ({
  auth: () => mockAuth(),
}));

const mockUploadObject = vi.fn();
const mockDeleteObject = vi.fn();
vi.mock("@/lib/storage/s3", () => ({
  uploadObject: (...args: unknown[]) => mockUploadObject(...args),
  deleteObject: (...args: unknown[]) => mockDeleteObject(...args),
}));

import { prisma } from "@/lib/prisma";
import { InspectionStatus, Role, TipoFotoInspeccion } from "@/generated/prisma/client";
import { POST } from "@/app/(worker)/inspecciones/[id]/fotos/[tipo]/subir/route";
import { crearUsuario, crearVehiculo, limpiarBaseDeTest } from "@/test/helpers/db";

const JPEG_MINIMO = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);

function llamar(id: string, tipo: string, conArchivo = true) {
  const fd = new FormData();
  if (conArchivo) fd.set("file", new File([JPEG_MINIMO], "foto.jpg", { type: "image/jpeg" }));
  return POST(
    new Request(`http://localhost/inspecciones/${id}/fotos/${tipo}/subir`, { method: "POST", body: fd }),
    { params: Promise.resolve({ id, tipo }) },
  );
}

async function inspeccionDe(
  role: Role = Role.TRABAJADOR,
  status: InspectionStatus = InspectionStatus.EN_PROCESO,
) {
  const worker = await crearUsuario(role);
  const vehicle = await crearVehiculo();
  const inspection = await prisma.inspection.create({
    data: { workerId: worker.id, conductorId: worker.id, vehicleId: vehicle.id, status },
  });
  return { worker, inspection };
}

describe("POST /inspecciones/[id]/fotos/[tipo]/subir", () => {
  beforeEach(async () => {
    await limpiarBaseDeTest();
    mockAuth.mockReset();
    mockUploadObject.mockReset().mockResolvedValue(undefined);
    mockDeleteObject.mockReset().mockResolvedValue(undefined);
  });

  afterAll(async () => {
    await limpiarBaseDeTest();
    await prisma.$disconnect();
  });

  it("dueño + EN_PROCESO: guarda la foto y responde { ok: true }", async () => {
    const { worker, inspection } = await inspeccionDe();
    mockAuth.mockResolvedValue({ user: { id: worker.id, role: worker.role } });
    const res = await llamar(inspection.id, "lateral");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    const fila = await prisma.fotoInspeccion.findUnique({
      where: { inspectionId_tipo: { inspectionId: inspection.id, tipo: TipoFotoInspeccion.LATERAL } },
    });
    expect(fila?.s3Key).toBe(`fotos-inspeccion/${inspection.id}/LATERAL.jpg`);
    expect(mockUploadObject).toHaveBeenCalledOnce();
  });

  it("tipo desconocido: 404 y no sube nada", async () => {
    const { worker, inspection } = await inspeccionDe();
    mockAuth.mockResolvedValue({ user: { id: worker.id, role: worker.role } });
    const res = await llamar(inspection.id, "frontal");
    expect(res.status).toBe(404);
    expect((await res.json()).ok).toBe(false);
    expect(mockUploadObject).not.toHaveBeenCalled();
  });

  it("sin sesión: 401", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await llamar(randomUUID(), "placa");
    expect(res.status).toBe(401);
    expect((await res.json()).ok).toBe(false);
  });

  it("rol distinto de TRABAJADOR: 403", async () => {
    const { worker, inspection } = await inspeccionDe(Role.SUPERVISOR);
    mockAuth.mockResolvedValue({ user: { id: worker.id, role: worker.role } });
    const res = await llamar(inspection.id, "placa");
    expect(res.status).toBe(403);
    expect(mockUploadObject).not.toHaveBeenCalled();
  });

  it("inspección de otro trabajador: 403", async () => {
    const { inspection } = await inspeccionDe();
    const otro = await crearUsuario(Role.TRABAJADOR);
    mockAuth.mockResolvedValue({ user: { id: otro.id, role: otro.role } });
    const res = await llamar(inspection.id, "placa");
    expect(res.status).toBe(403);
    expect(mockUploadObject).not.toHaveBeenCalled();
  });

  it("inspección no EN_PROCESO: 400 con mensaje en español", async () => {
    const { worker, inspection } = await inspeccionDe(Role.TRABAJADOR, InspectionStatus.ENVIADA);
    mockAuth.mockResolvedValue({ user: { id: worker.id, role: worker.role } });
    const res = await llamar(inspection.id, "placa");
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toMatch(/ya no está en proceso/);
  });

  it("sin archivo: 400", async () => {
    const { worker, inspection } = await inspeccionDe();
    mockAuth.mockResolvedValue({ user: { id: worker.id, role: worker.role } });
    const res = await llamar(inspection.id, "placa", false);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/tomar la foto/);
  });

  it("falla de S3: 500 genérico sin filtrar el detalle", async () => {
    const { worker, inspection } = await inspeccionDe();
    mockAuth.mockResolvedValue({ user: { id: worker.id, role: worker.role } });
    mockUploadObject.mockRejectedValue(
      Object.assign(new Error("ECONNREFUSED 10.0.0.1"), { $metadata: {} }),
    );
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await llamar(inspection.id, "placa");
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("No se pudo guardar la foto. Intentá de nuevo.");
  });
});
