import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mismo patrón que lib/admin/user-actions.test.ts: solo se mockea la
// sesión de NextAuth y el cliente de S3/MinIO (subir un `File` real no tiene
// sentido en un test unitario) — el resto (Prisma, constraints) corre contra
// Postgres real.
const mockAuth = vi.fn();
vi.mock("@/lib/auth/config", () => ({
  auth: () => mockAuth(),
}));

const mockUploadObject = vi.fn();
vi.mock("@/lib/storage/s3", () => ({
  uploadObject: (...args: unknown[]) => mockUploadObject(...args),
}));

import { prisma } from "@/lib/prisma";
import { Role, TipoFotoInspeccion } from "@/generated/prisma/client";
import { subirFotoInspeccion } from "@/lib/inspections/foto-actions";
import { MAX_FOTO_INSPECCION_BYTES } from "@/lib/storage/validar-archivo";
import { crearUsuario, crearVehiculo, limpiarBaseDeTest } from "@/test/helpers/db";

// Cabeceras mínimas con los magic bytes reales (el validador inspecciona el
// contenido, no solo `file.type`).
const JPEG_MINIMO = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
const PNG_MINIMO = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);

function crearFotoFalsa(nombre = "foto.jpg"): File {
  return new File([JPEG_MINIMO], nombre, { type: "image/jpeg" });
}

function crearFormDataConFoto(archivo: File = crearFotoFalsa()): FormData {
  const fd = new FormData();
  fd.set("file", archivo);
  return fd;
}

async function crearInspeccionEnProcesoDeTrabajador() {
  const worker = await crearUsuario(Role.TRABAJADOR);
  const vehicle = await crearVehiculo();
  const inspection = await prisma.inspection.create({
    data: { workerId: worker.id, conductorId: worker.id, vehicleId: vehicle.id },
  });
  mockAuth.mockResolvedValue({ user: { id: worker.id, role: worker.role } });
  return { worker, vehicle, inspection };
}

beforeEach(async () => {
  await limpiarBaseDeTest();
  mockAuth.mockReset();
  mockUploadObject.mockReset();
  mockUploadObject.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(async () => {
  await limpiarBaseDeTest();
  await prisma.$disconnect();
});

// Hardening (#2): tipo, tamaño y contenido real (magic bytes) se validan antes
// de subir nada a S3; la key y el contentType salen del tipo validado.
describe("subirFotoInspeccion — validación del archivo", () => {
  it("sube una foto válida con la key y el contentType derivados del tipo validado, no del nombre", async () => {
    const { inspection } = await crearInspeccionEnProcesoDeTrabajador();
    const png = new File([PNG_MINIMO], "foto.jpg", { type: "image/png" });

    await subirFotoInspeccion(inspection.id, TipoFotoInspeccion.LATERAL, crearFormDataConFoto(png));

    expect(mockUploadObject).toHaveBeenCalledTimes(1);
    expect(mockUploadObject).toHaveBeenCalledWith(
      expect.objectContaining({
        key: `fotos-inspeccion/${inspection.id}/LATERAL.png`,
        contentType: "image/png",
      }),
    );
    const enBase = await prisma.fotoInspeccion.findUniqueOrThrow({
      where: { inspectionId_tipo: { inspectionId: inspection.id, tipo: TipoFotoInspeccion.LATERAL } },
    });
    expect(enBase.s3Key).toBe(`fotos-inspeccion/${inspection.id}/LATERAL.png`);
  });

  it.each([
    ["contenido que no es una imagen aunque declare image/jpeg", "contenido-de-prueba", "image/jpeg", /no corresponde/i],
    ["SVG", "<svg xmlns='http://www.w3.org/2000/svg'/>", "image/svg+xml", /JPG, PNG o WEBP/],
    ["GIF", "GIF89a", "image/gif", /JPG, PNG o WEBP/],
    ["PDF", "%PDF-1.7", "application/pdf", /JPG, PNG o WEBP/],
  ])("rechaza %s sin subir nada a S3 ni crear el registro", async (_caso, contenido, tipo, mensaje) => {
    const { inspection } = await crearInspeccionEnProcesoDeTrabajador();
    const archivo = new File([contenido], "foto.jpg", { type: tipo });

    await expect(
      subirFotoInspeccion(inspection.id, TipoFotoInspeccion.LATERAL, crearFormDataConFoto(archivo)),
    ).rejects.toThrow(mensaje);
    expect(mockUploadObject).not.toHaveBeenCalled();
    expect(await prisma.fotoInspeccion.count({ where: { inspectionId: inspection.id } })).toBe(0);
  });

  it("rechaza una foto de más de 8 MB sin subir nada a S3", async () => {
    const { inspection } = await crearInspeccionEnProcesoDeTrabajador();
    const enorme = Buffer.alloc(MAX_FOTO_INSPECCION_BYTES + 1);
    JPEG_MINIMO.copy(enorme);
    const archivo = new File([enorme], "grande.jpg", { type: "image/jpeg" });

    await expect(
      subirFotoInspeccion(inspection.id, TipoFotoInspeccion.PLACA, crearFormDataConFoto(archivo)),
    ).rejects.toThrow(/no puede superar 8 MB/);
    expect(mockUploadObject).not.toHaveBeenCalled();
  });
});

// Fix (WARNING corroborado por resilience + reliability, foto-actions.ts):
// el catch de `prisma.fotoInspeccion.create` antes traducía CUALQUIER error a
// "ya existe una foto registrada", enmascarando fallas reales (ej. un corte
// de conectividad justo después de que la foto ya se subió a S3). Ahora solo
// traduce el código P2002 (violación real de `@@unique([inspectionId,
// tipo])`) — cualquier otra falla se loguea y se relanza sin modificar.
describe("subirFotoInspeccion — discriminación de errores al crear FotoInspeccion", () => {
  it("una violación real de unicidad (P2002) en el create sigue devolviendo el mensaje amigable de 'ya existe'", async () => {
    const { inspection } = await crearInspeccionEnProcesoDeTrabajador();
    // Fotos ya existente en base para forzar un P2002 real en el `create`
    // de más abajo.
    await prisma.fotoInspeccion.create({
      data: { inspectionId: inspection.id, tipo: TipoFotoInspeccion.LATERAL, s3Key: "ya-existe.jpg" },
    });
    // Simula la ventana de carrera que el comentario del código describe:
    // el `findUnique` del chequeo optimista no ve la foto que sí existe
    // (llega tarde), así que la función sigue de largo hasta el `create`
    // real — que es el que efectivamente dispara el P2002 que este fix
    // discrimina.
    vi.spyOn(prisma.fotoInspeccion, "findUnique").mockResolvedValueOnce(null);

    await expect(
      subirFotoInspeccion(inspection.id, TipoFotoInspeccion.LATERAL, crearFormDataConFoto()),
    ).rejects.toThrow(/ya existe una foto registrada/i);
  });

  it("una falla distinta a P2002 (ej. corte de conectividad tras subir a S3) NO se enmascara como 'ya existe' — se loguea y se relanza la causa real", async () => {
    const { inspection } = await crearInspeccionEnProcesoDeTrabajador();
    const errorReal = new Error("Connection terminated unexpectedly");
    vi.spyOn(prisma.fotoInspeccion, "create").mockRejectedValueOnce(errorReal);
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      subirFotoInspeccion(inspection.id, TipoFotoInspeccion.PLACA, crearFormDataConFoto()),
    ).rejects.toThrow("Connection terminated unexpectedly");
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
  });
});
