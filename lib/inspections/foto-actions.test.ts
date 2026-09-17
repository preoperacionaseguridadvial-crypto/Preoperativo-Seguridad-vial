import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mismo patrón que lib/admin/vehicle-actions.test.ts: solo se mockea la
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
import { crearUsuario, crearVehiculo, limpiarBaseDeTest } from "@/test/helpers/db";

function crearFotoFalsa(nombre = "foto.jpg"): File {
  return new File([Buffer.from("contenido-de-prueba")], nombre, { type: "image/jpeg" });
}

function crearFormDataConFoto(): FormData {
  const fd = new FormData();
  fd.set("file", crearFotoFalsa());
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
