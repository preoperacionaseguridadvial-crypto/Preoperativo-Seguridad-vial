import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

// Mismo patrón que foto-actions.test.ts: solo se mockea la sesión de NextAuth
// y el cliente de S3/MinIO; Prisma y sus constraints corren contra Postgres real.
const mockAuth = vi.fn();
vi.mock("@/lib/auth/config", () => ({
  auth: () => mockAuth(),
}));

const mockUploadObject = vi.fn();
vi.mock("@/lib/storage/s3", () => ({
  uploadObject: (...args: unknown[]) => mockUploadObject(...args),
}));

import { prisma } from "@/lib/prisma";
import { Role, TipoFirma } from "@/generated/prisma/client";
import { guardarFirmaConductor } from "@/lib/inspections/firma-actions";
import { MAX_FIRMA_BYTES } from "@/lib/storage/validar-archivo";
import { crearUsuario, crearVehiculo, limpiarBaseDeTest } from "@/test/helpers/db";

const PNG_MINIMO = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
const JPEG_MINIMO = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);

function formDataConFirma(contenido: BlobPart, tipo: string): FormData {
  const fd = new FormData();
  fd.set("firma", new File([contenido], "firma.png", { type: tipo }));
  return fd;
}

async function crearInspeccionEnProceso() {
  const worker = await crearUsuario(Role.TRABAJADOR);
  const vehicle = await crearVehiculo();
  const inspection = await prisma.inspection.create({
    data: { workerId: worker.id, conductorId: worker.id, vehicleId: vehicle.id },
  });
  mockAuth.mockResolvedValue({ user: { id: worker.id, role: worker.role } });
  return { worker, inspection };
}

beforeEach(async () => {
  await limpiarBaseDeTest();
  mockAuth.mockReset();
  mockUploadObject.mockReset();
  mockUploadObject.mockResolvedValue(undefined);
});

afterAll(async () => {
  await limpiarBaseDeTest();
  await prisma.$disconnect();
});

describe("guardarFirmaConductor — validación del archivo de la firma", () => {
  it("acepta un PNG real, lo sube con contentType image/png y crea la Firma", async () => {
    const { inspection } = await crearInspeccionEnProceso();

    await guardarFirmaConductor(inspection.id, formDataConFirma(PNG_MINIMO, "image/png"));

    expect(mockUploadObject).toHaveBeenCalledWith(
      expect.objectContaining({
        key: `firmas/${inspection.id}/CONDUCTOR.png`,
        contentType: "image/png",
      }),
    );
    const firma = await prisma.firma.findUniqueOrThrow({
      where: { inspectionId_tipo: { inspectionId: inspection.id, tipo: TipoFirma.CONDUCTOR } },
    });
    expect(firma.s3Key).toBe(`firmas/${inspection.id}/CONDUCTOR.png`);
  });

  it.each([
    ["JPEG", JPEG_MINIMO, "image/jpeg", /PNG/],
    ["SVG", Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'/>"), "image/svg+xml", /PNG/],
    ["un PNG declarado cuyo contenido es otro formato", JPEG_MINIMO, "image/png", /no corresponde/i],
    ["texto declarado como PNG", Buffer.from("no-soy-un-png"), "image/png", /no corresponde/i],
  ])("rechaza %s sin subir nada a S3 ni crear la Firma", async (_caso, contenido, tipo, mensaje) => {
    const { inspection } = await crearInspeccionEnProceso();

    await expect(
      guardarFirmaConductor(inspection.id, formDataConFirma(contenido, tipo)),
    ).rejects.toThrow(mensaje);
    expect(mockUploadObject).not.toHaveBeenCalled();
    expect(await prisma.firma.count({ where: { inspectionId: inspection.id } })).toBe(0);
  });

  it("rechaza una firma de más de 1 MB", async () => {
    const { inspection } = await crearInspeccionEnProceso();
    const enorme = Buffer.alloc(MAX_FIRMA_BYTES + 1);
    PNG_MINIMO.copy(enorme);

    await expect(
      guardarFirmaConductor(inspection.id, formDataConFirma(enorme, "image/png")),
    ).rejects.toThrow(/no puede superar 1 MB/);
    expect(mockUploadObject).not.toHaveBeenCalled();
  });

  it("sigue exigiendo que se dibuje la firma (archivo vacío)", async () => {
    const { inspection } = await crearInspeccionEnProceso();

    await expect(
      guardarFirmaConductor(inspection.id, formDataConFirma(new Uint8Array(0), "image/png")),
    ).rejects.toThrow(/dibujar la firma/i);
  });
});
