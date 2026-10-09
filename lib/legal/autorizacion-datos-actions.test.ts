import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

// Mismo patrón que firma-actions.test.ts: solo se mockea la sesión de NextAuth
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
import { Role } from "@/generated/prisma/client";
import { registrarAutorizacionDatos } from "@/lib/legal/autorizacion-datos-actions";
import { getAutorizacionDatos, tieneAutorizacionDatos } from "@/lib/legal/autorizacion-datos";
import { VERSION_POLITICA_DATOS } from "@/lib/legal/politica-datos";
import { crearUsuario, limpiarBaseDeTest } from "@/test/helpers/db";

const PNG_MINIMO = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
const JPEG_MINIMO = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);

function formData({ acepto = true, firma = PNG_MINIMO as BlobPart | null, tipo = "image/png" } = {}): FormData {
  const fd = new FormData();
  if (acepto) fd.set("acepto", "si");
  if (firma) fd.set("firma", new File([firma], "firma.png", { type: tipo }));
  return fd;
}

async function usuarioConSesion(role: Role = Role.TRABAJADOR) {
  const user = await crearUsuario(role);
  mockAuth.mockResolvedValue({ user: { id: user.id, role: user.role } });
  return user;
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

describe("registrarAutorizacionDatos", () => {
  it("guarda la autorización con la firma, la versión de la política y la fecha del servidor", async () => {
    const user = await usuarioConSesion();

    await registrarAutorizacionDatos(formData());

    expect(mockUploadObject).toHaveBeenCalledWith(
      expect.objectContaining({ key: `autorizaciones/${user.id}/firma.png`, contentType: "image/png" }),
    );
    const registro = await getAutorizacionDatos(user.id);
    expect(registro).toMatchObject({
      userId: user.id,
      versionPolitica: VERSION_POLITICA_DATOS,
      firmaS3Key: `autorizaciones/${user.id}/firma.png`,
    });
    expect(registro?.createdAt).toBeInstanceOf(Date);
    expect(await tieneAutorizacionDatos(user.id)).toBe(true);
  });

  it("deja rastro en el audit log", async () => {
    const user = await usuarioConSesion();

    await registrarAutorizacionDatos(formData());

    const log = await prisma.auditLog.findFirst({ where: { userId: user.id, action: "AUTORIZAR_TRATAMIENTO_DATOS" } });
    expect(log).toMatchObject({ entityType: "User", entityId: user.id });
  });

  it.each([Role.SUPERVISOR, Role.DIRECTOR, Role.SST, Role.ADMINISTRADOR, Role.SUPERVISOR_OLEARIARI])(
    "aplica a todos los roles (%s)",
    async (role) => {
      const user = await usuarioConSesion(role);
      await registrarAutorizacionDatos(formData());
      expect(await tieneAutorizacionDatos(user.id)).toBe(true);
    },
  );

  it("rechaza sin sesión", async () => {
    mockAuth.mockResolvedValue(null);
    await expect(registrarAutorizacionDatos(formData())).rejects.toThrow(/sesión/i);
    expect(mockUploadObject).not.toHaveBeenCalled();
  });

  it("exige la aceptación expresa: sin la casilla marcada no guarda nada", async () => {
    const user = await usuarioConSesion();

    await expect(registrarAutorizacionDatos(formData({ acepto: false }))).rejects.toThrow(/aceptar/i);

    expect(mockUploadObject).not.toHaveBeenCalled();
    expect(await tieneAutorizacionDatos(user.id)).toBe(false);
  });

  it("exige la firma", async () => {
    const user = await usuarioConSesion();

    await expect(registrarAutorizacionDatos(formData({ firma: null }))).rejects.toThrow(/firma/i);

    expect(await tieneAutorizacionDatos(user.id)).toBe(false);
  });

  it("rechaza una firma que no es PNG sin subir nada", async () => {
    const user = await usuarioConSesion();

    await expect(
      registrarAutorizacionDatos(formData({ firma: JPEG_MINIMO, tipo: "image/jpeg" })),
    ).rejects.toThrow(/PNG/);

    expect(mockUploadObject).not.toHaveBeenCalled();
    expect(await tieneAutorizacionDatos(user.id)).toBe(false);
  });

  it("es una única vez: un segundo intento se rechaza y no reemplaza el registro", async () => {
    const user = await usuarioConSesion();
    await registrarAutorizacionDatos(formData());
    const original = await getAutorizacionDatos(user.id);
    mockUploadObject.mockClear();

    await expect(registrarAutorizacionDatos(formData())).rejects.toThrow(/ya/i);

    expect(mockUploadObject).not.toHaveBeenCalled();
    expect(await getAutorizacionDatos(user.id)).toEqual(original);
    expect(await prisma.autorizacionDatos.count()).toBe(1);
  });
});

describe("tieneAutorizacionDatos", () => {
  it("es false para un usuario que nunca autorizó", async () => {
    const user = await crearUsuario(Role.TRABAJADOR);
    expect(await tieneAutorizacionDatos(user.id)).toBe(false);
    expect(await getAutorizacionDatos(user.id)).toBeNull();
  });
});
