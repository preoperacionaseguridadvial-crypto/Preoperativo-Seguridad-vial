import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

// Mismo patrón de mock que lib/admin/user-actions.test.ts /
// lib/inspections/actions.test.ts: solo se mockea la sesión de NextAuth,
// el resto (Prisma, S3/MinIO real) corre contra infraestructura real.
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
import { Role, TipoVehiculo } from "@/generated/prisma/client";
import { actualizarVehiculo, crearVehiculo } from "@/lib/admin/vehicle-actions";
import {
  crearUsuario as crearUsuarioDeTest,
  crearVehiculo as crearVehiculoDeTest,
  limpiarBaseDeTest,
} from "@/test/helpers/db";

function crearFotoFalsa(nombre = "foto.jpg"): File {
  return new File([Buffer.from("contenido-de-prueba")], nombre, { type: "image/jpeg" });
}

function datosHojaDeVida(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    placa: `TEST-${Date.now()}`,
    tipo: "Motocicleta",
    tipoVehiculo: TipoVehiculo.MOTO,
    marca: "Yamaha",
    modelo: "FZ",
    color: "Negro",
    numeroMotor: "MOT-123",
    numeroChasis: "CHA-456",
    fechaVencimientoSoat: new Date("2027-01-01"),
    fechaVencimientoTarjetaTransito: new Date("2027-01-01"),
    foto: crearFotoFalsa(),
    ...overrides,
  };
}

async function loginComoAdmin() {
  const admin = await crearUsuarioDeTest(Role.ADMINISTRADOR);
  mockAuth.mockResolvedValue({ user: { id: admin.id, role: admin.role } });
  return admin;
}

beforeEach(async () => {
  await limpiarBaseDeTest();
  mockAuth.mockReset();
  mockUploadObject.mockReset();
  mockUploadObject.mockResolvedValue("vehiculos/fake-key.jpg");
  mockDeleteObject.mockReset();
  mockDeleteObject.mockResolvedValue(undefined);
});

afterAll(async () => {
  await limpiarBaseDeTest();
  await prisma.$disconnect();
});

describe("crearVehiculo — soporte-moto-carro (Slice 1, hoja de vida)", () => {
  it("rechaza crear un vehículo sin foto", async () => {
    await loginComoAdmin();
    const datos = datosHojaDeVida({ foto: undefined });

    await expect(crearVehiculo(datos)).rejects.toThrow(/foto/i);
    expect(mockUploadObject).not.toHaveBeenCalled();
  });

  it("rechaza crear un vehículo sin marca", async () => {
    await loginComoAdmin();
    const datos = datosHojaDeVida({ marca: "" });

    await expect(crearVehiculo(datos)).rejects.toThrow(/marca/i);
  });

  it("crea un vehículo con hoja de vida completa y sube la foto a S3", async () => {
    await loginComoAdmin();
    const datos = datosHojaDeVida();

    const vehiculo = await crearVehiculo(datos);

    expect(vehiculo.tipoVehiculo).toBe(TipoVehiculo.MOTO);
    expect(vehiculo.marca).toBe("Yamaha");
    expect(vehiculo.modelo).toBe("FZ");
    expect(vehiculo.color).toBe("Negro");
    expect(vehiculo.numeroMotor).toBe("MOT-123");
    expect(vehiculo.numeroChasis).toBe("CHA-456");
    expect(vehiculo.fotoS3Key).toMatch(/^vehiculos\/.+\.jpg$/);
    expect(mockUploadObject).toHaveBeenCalledTimes(1);
  });
});

describe("actualizarVehiculo — soporte-moto-carro (Slice 1, hoja de vida)", () => {
  it("rechaza editar sin marca (hoja de vida sigue siendo obligatoria)", async () => {
    await loginComoAdmin();
    const vehiculo = await crearVehiculo(datosHojaDeVida());
    mockUploadObject.mockClear();

    await expect(
      actualizarVehiculo(vehiculo.id, {
        placa: vehiculo.placa,
        tipo: vehiculo.tipo,
        activo: true,
        tipoVehiculo: TipoVehiculo.MOTO,
        marca: "",
        modelo: "FZ",
        color: "Negro",
        numeroMotor: "MOT-123",
        numeroChasis: "CHA-456",
      }),
    ).rejects.toThrow(/marca/i);
  });

  it("permite editar sin volver a subir foto (conserva el fotoS3Key existente)", async () => {
    await loginComoAdmin();
    const vehiculo = await crearVehiculo(datosHojaDeVida());
    const keyOriginal = vehiculo.fotoS3Key;
    mockUploadObject.mockClear();

    const actualizado = await actualizarVehiculo(vehiculo.id, {
      placa: vehiculo.placa,
      tipo: vehiculo.tipo,
      activo: true,
      tipoVehiculo: TipoVehiculo.CARRO,
      marca: "Chevrolet",
      modelo: "NPR",
      color: "Blanco",
      numeroMotor: "MOT-123",
      numeroChasis: "CHA-456",
    });

    expect(actualizado.tipoVehiculo).toBe(TipoVehiculo.CARRO);
    expect(actualizado.marca).toBe("Chevrolet");
    expect(actualizado.fotoS3Key).toBe(keyOriginal);
    expect(mockUploadObject).not.toHaveBeenCalled();
  });
});

describe("actualizarVehiculo — vehículos legacy sin hoja de vida (fix: no bloquear edición/desactivación retroactiva)", () => {
  it("permite desactivar un vehículo legacy sin hoja de vida sin exigir que la complete", async () => {
    await loginComoAdmin();
    const legacy = await crearVehiculoDeTest({ activo: true });

    const actualizado = await actualizarVehiculo(legacy.id, {
      placa: legacy.placa,
      tipo: legacy.tipo,
      activo: false,
      tipoVehiculo: TipoVehiculo.MOTO,
    });

    expect(actualizado.activo).toBe(false);
    expect(actualizado.marca).toBeNull();
    expect(mockUploadObject).not.toHaveBeenCalled();
  });

  it("normaliza a null los campos de hoja de vida enviados como string vacío (forma real de FormData en un formulario sin completar)", async () => {
    await loginComoAdmin();
    const legacy = await crearVehiculoDeTest({ activo: true });

    // Un input de texto vacío en el formulario HTML llega como "" via
    // FormData.get(), no como undefined — a diferencia del resto de tests
    // de este bloque, que omiten las claves directamente.
    const actualizado = await actualizarVehiculo(legacy.id, {
      placa: legacy.placa,
      tipo: legacy.tipo,
      activo: true,
      tipoVehiculo: TipoVehiculo.MOTO,
      marca: "",
      modelo: "",
      color: "",
      numeroMotor: "",
      numeroChasis: "",
    });

    expect(actualizado.marca).toBeNull();
    expect(actualizado.modelo).toBeNull();
    expect(actualizado.color).toBeNull();
    expect(actualizado.numeroMotor).toBeNull();
    expect(actualizado.numeroChasis).toBeNull();
  });

  it("rechaza una hoja de vida a medias en un vehículo legacy (no acepta datos parciales)", async () => {
    await loginComoAdmin();
    const legacy = await crearVehiculoDeTest({ activo: true });

    await expect(
      actualizarVehiculo(legacy.id, {
        placa: legacy.placa,
        tipo: legacy.tipo,
        activo: true,
        tipoVehiculo: TipoVehiculo.MOTO,
        marca: "Yamaha",
      }),
    ).rejects.toThrow(/modelo/i);
  });
});

describe("subirFotoVehiculo — validación de tipo MIME (fix: solo imágenes)", () => {
  it("rechaza una foto que no es imagen al crear un vehículo", async () => {
    await loginComoAdmin();
    const datos = datosHojaDeVida({
      foto: new File([Buffer.from("contenido")], "documento.pdf", { type: "application/pdf" }),
    });

    await expect(crearVehiculo(datos)).rejects.toThrow(/imagen/i);
    expect(mockUploadObject).not.toHaveBeenCalled();
  });

  it("rechaza una foto que no es imagen al editar un vehículo", async () => {
    await loginComoAdmin();
    const vehiculo = await crearVehiculo(datosHojaDeVida());
    mockUploadObject.mockClear();

    await expect(
      actualizarVehiculo(vehiculo.id, {
        placa: vehiculo.placa,
        tipo: vehiculo.tipo,
        activo: true,
        tipoVehiculo: TipoVehiculo.MOTO,
        marca: "Yamaha",
        modelo: "FZ",
        color: "Negro",
        numeroMotor: "MOT-123",
        numeroChasis: "CHA-456",
        foto: new File([Buffer.from("contenido")], "documento.pdf", { type: "application/pdf" }),
      }),
    ).rejects.toThrow(/imagen/i);
    expect(mockUploadObject).not.toHaveBeenCalled();
  });
});

describe("subirFotoVehiculo — sanitización de la key de S3 (fix: placa/nombre de archivo no confiables)", () => {
  it("sanea la placa usada en la key de S3 (no permite escapar el prefijo vehiculos/<placa>/)", async () => {
    await loginComoAdmin();
    const datos = datosHojaDeVida({ placa: "../../etc" });

    const vehiculo = await crearVehiculo(datos);

    expect(vehiculo.fotoS3Key).not.toContain("..");
    expect(vehiculo.fotoS3Key).not.toContain("/../");
    expect(vehiculo.fotoS3Key?.startsWith("vehiculos/")).toBe(true);
  });

  it("deriva la extensión de la key del tipo MIME validado, no del nombre de archivo", async () => {
    await loginComoAdmin();
    const fotoConNombreSospechoso = new File([Buffer.from("contenido")], "foto.png.exe", {
      type: "image/png",
    });
    const datos = datosHojaDeVida({ foto: fotoConNombreSospechoso });

    const vehiculo = await crearVehiculo(datos);

    expect(vehiculo.fotoS3Key).toMatch(/\.png$/);
  });
});

describe("crearVehiculo/actualizarVehiculo — limpieza de S3 si falla la escritura en base de datos (fix: objetos huérfanos)", () => {
  it("borra la foto subida a S3 si crearVehiculo falla por placa duplicada", async () => {
    await loginComoAdmin();
    // El factory de test genera la placa en minúsculas (`randomUUID()` no
    // se uppercasea) — se fuerza acá una placa ya en mayúsculas para que
    // coincida exactamente con `placaLimpia` (`.trim().toUpperCase()`) y
    // sí dispare la colisión P2002 que este test necesita.
    const existente = await crearVehiculoDeTest({ placa: "TEST-DUPLICADA" });
    const datos = datosHojaDeVida({ placa: existente.placa });

    await expect(crearVehiculo(datos)).rejects.toThrow(/ya existe un vehículo/i);

    expect(mockDeleteObject).toHaveBeenCalledTimes(1);
  });

  it("borra la foto subida a S3 si actualizarVehiculo falla por placa duplicada", async () => {
    await loginComoAdmin();
    const otro = await crearVehiculoDeTest({ placa: "TEST-OTRA-DUPLICADA" });
    const vehiculo = await crearVehiculo(datosHojaDeVida());
    mockUploadObject.mockClear();
    mockDeleteObject.mockClear();

    await expect(
      actualizarVehiculo(vehiculo.id, {
        placa: otro.placa,
        tipo: vehiculo.tipo,
        activo: true,
        tipoVehiculo: TipoVehiculo.MOTO,
        marca: "Yamaha",
        modelo: "FZ",
        color: "Negro",
        numeroMotor: "MOT-123",
        numeroChasis: "CHA-456",
        foto: crearFotoFalsa(),
      }),
    ).rejects.toThrow(/ya existe un vehículo/i);

    expect(mockDeleteObject).toHaveBeenCalledTimes(1);
  });
});
