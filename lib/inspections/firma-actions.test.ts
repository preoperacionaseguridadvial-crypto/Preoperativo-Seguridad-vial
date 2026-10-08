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
import { InspectionStatus, Role, Sede, TipoFirma } from "@/generated/prisma/client";
import { guardarFirmaConductor, guardarFirmaSupervisor } from "@/lib/inspections/firma-actions";
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

// Firma del aprobador (roles-oleariari): cada aprobador firma SU decisión con su
// propio tipo de firma; el tipo lo decide el servidor por el rol de la sesión.
describe("guardarFirmaSupervisor — dos etapas", () => {
  async function crearOleariariAprobadaEtapa1() {
    const supOleariari = await crearUsuario(Role.SUPERVISOR_OLEARIARI);
    const worker = await crearUsuario(Role.TRABAJADOR, { sede: Sede.OLEARIARI });
    const vehicle = await crearVehiculo();
    const inspection = await prisma.inspection.create({
      data: {
        workerId: worker.id,
        conductorId: worker.id,
        vehicleId: vehicle.id,
        status: InspectionStatus.PENDIENTE_APROBACION,
        completedAt: new Date(),
        sede: Sede.OLEARIARI,
        revisadaSupervisorOleariariAt: new Date(),
        supervisorOleariariId: supOleariari.id,
      },
    });
    return { supOleariari, inspection };
  }

  const png = () => formDataConFirma(PNG_MINIMO, "image/png");

  it("el Supervisor Oleariari firma su aprobación con el tipo SUPERVISOR_OLEARIARI", async () => {
    const { supOleariari, inspection } = await crearOleariariAprobadaEtapa1();
    mockAuth.mockResolvedValue({ user: { id: supOleariari.id, role: supOleariari.role } });

    await guardarFirmaSupervisor(inspection.id, png());

    expect(mockUploadObject).toHaveBeenCalledWith(
      expect.objectContaining({ key: `firmas/${inspection.id}/SUPERVISOR_OLEARIARI.png` }),
    );
    const firma = await prisma.firma.findUniqueOrThrow({
      where: { inspectionId_tipo: { inspectionId: inspection.id, tipo: TipoFirma.SUPERVISOR_OLEARIARI } },
    });
    expect(firma.userId).toBe(supOleariari.id);
    expect(
      await prisma.auditLog.count({ where: { entityId: inspection.id, action: "FIRMAR_SUPERVISOR_OLEARIARI" } }),
    ).toBe(1);
  });

  it("no puede firmar dos veces", async () => {
    const { supOleariari, inspection } = await crearOleariariAprobadaEtapa1();
    mockAuth.mockResolvedValue({ user: { id: supOleariari.id, role: supOleariari.role } });
    await guardarFirmaSupervisor(inspection.id, png());

    await expect(guardarFirmaSupervisor(inspection.id, png())).rejects.toThrow(/Ya existe una firma/);
  });

  it("no firma si su etapa todavía no fue decidida", async () => {
    const { supOleariari, inspection } = await crearOleariariAprobadaEtapa1();
    await prisma.inspection.update({
      where: { id: inspection.id },
      data: { revisadaSupervisorOleariariAt: null, supervisorOleariariId: null },
    });
    mockAuth.mockResolvedValue({ user: { id: supOleariari.id, role: supOleariari.role } });

    await expect(guardarFirmaSupervisor(inspection.id, png())).rejects.toThrow(/todavía no fue decidida/);
    expect(mockUploadObject).not.toHaveBeenCalled();
  });

  it("otro Supervisor Oleariari no puede firmar una decisión ajena", async () => {
    const { inspection } = await crearOleariariAprobadaEtapa1();
    const otro = await crearUsuario(Role.SUPERVISOR_OLEARIARI);
    mockAuth.mockResolvedValue({ user: { id: otro.id, role: otro.role } });

    await expect(guardarFirmaSupervisor(inspection.id, png())).rejects.toThrow(/Solo el supervisor que tomó la decisión/);
  });

  it("el Director no puede firmar con solo la primera etapa decidida", async () => {
    const { inspection } = await crearOleariariAprobadaEtapa1();
    const director = await crearUsuario(Role.SUPERVISOR);
    mockAuth.mockResolvedValue({ user: { id: director.id, role: director.role } });

    await expect(guardarFirmaSupervisor(inspection.id, png())).rejects.toThrow(/todavía no fue decidida/);
  });

  it("el Director firma su decisión con el tipo SUPERVISOR, como siempre", async () => {
    const { inspection } = await crearOleariariAprobadaEtapa1();
    const director = await crearUsuario(Role.SUPERVISOR);
    await prisma.inspection.update({
      where: { id: inspection.id },
      data: { status: InspectionStatus.APROBADA, reviewedAt: new Date(), supervisorId: director.id },
    });
    mockAuth.mockResolvedValue({ user: { id: director.id, role: director.role } });

    await guardarFirmaSupervisor(inspection.id, png());

    expect(
      await prisma.firma.count({ where: { inspectionId: inspection.id, tipo: TipoFirma.SUPERVISOR } }),
    ).toBe(1);
    expect(
      await prisma.auditLog.count({ where: { entityId: inspection.id, action: "FIRMAR_SUPERVISOR" } }),
    ).toBe(1);
  });
});
