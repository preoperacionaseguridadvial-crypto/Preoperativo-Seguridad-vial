import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

// Mismo patrón de mock que lib/admin/user-actions.test.ts /
// lib/admin/vehicle-actions.test.ts: solo se mockea la sesión de NextAuth,
// el resto (Prisma real) corre contra infraestructura real.
const mockAuth = vi.fn();
vi.mock("@/lib/auth/config", () => ({
  auth: () => mockAuth(),
}));

import { prisma } from "@/lib/prisma";
import { Role } from "@/generated/prisma/client";
import { actualizarConfiguracion } from "@/lib/settings/actions";
import { CLAVE_FECHA_VIGENCIA, getSetting, PLACEHOLDER_FECHA_VIGENCIA } from "@/lib/settings/queries";
import { crearUsuario as crearUsuarioDeTest, limpiarBaseDeTest } from "@/test/helpers/db";

async function loginComoAdmin() {
  const admin = await crearUsuarioDeTest(Role.ADMINISTRADOR);
  mockAuth.mockResolvedValue({ user: { id: admin.id, role: admin.role } });
  return admin;
}

async function loginComo(role: Role) {
  const usuario = await crearUsuarioDeTest(role);
  mockAuth.mockResolvedValue({ user: { id: usuario.id, role: usuario.role } });
  return usuario;
}

beforeEach(async () => {
  await limpiarBaseDeTest();
  mockAuth.mockReset();
});

afterAll(async () => {
  await limpiarBaseDeTest();
  await prisma.$disconnect();
});

describe("actualizarConfiguracion — soporte-moto-carro (Slice 4, ADR A5)", () => {
  it("permite a un Administrador actualizar formato.fechaVigencia", async () => {
    const admin = await loginComoAdmin();

    await actualizarConfiguracion(CLAVE_FECHA_VIGENCIA, "31/12/2027");

    const valor = await getSetting(CLAVE_FECHA_VIGENCIA);
    expect(valor).toBe("31/12/2027");

    const fila = await prisma.appSetting.findUnique({ where: { clave: CLAVE_FECHA_VIGENCIA } });
    expect(fila?.updatedById).toBe(admin.id);
  });

  it("registra la actualización en AuditLog", async () => {
    const admin = await loginComoAdmin();

    await actualizarConfiguracion(CLAVE_FECHA_VIGENCIA, "31/12/2027");

    const entrada = await prisma.auditLog.findFirst({
      where: { entityType: "AppSetting", entityId: CLAVE_FECHA_VIGENCIA },
    });
    expect(entrada).not.toBeNull();
    expect(entrada?.userId).toBe(admin.id);
    expect(entrada?.action).toBe("ACTUALIZAR_CONFIGURACION");
  });

  // SST tiene los mismos permisos que ADMINISTRADOR (decisión del usuario,
  // 2026-09-18), configuración incluida.
  it("permite a SST actualizar formato.fechaVigencia y queda registrado como autor", async () => {
    const sst = await loginComo(Role.SST);

    await actualizarConfiguracion(CLAVE_FECHA_VIGENCIA, "31/12/2028");

    expect(await getSetting(CLAVE_FECHA_VIGENCIA)).toBe("31/12/2028");
    const fila = await prisma.appSetting.findUnique({ where: { clave: CLAVE_FECHA_VIGENCIA } });
    expect(fila?.updatedById).toBe(sst.id);
    const entrada = await prisma.auditLog.findFirst({
      where: { entityType: "AppSetting", entityId: CLAVE_FECHA_VIGENCIA },
    });
    expect(entrada?.userId).toBe(sst.id);
  });

  it.each([Role.TRABAJADOR, Role.SUPERVISOR, Role.DIRECTOR] as const)(
    "rechaza a %s (solo ADMINISTRADOR y SST pueden configurar)",
    async (rol) => {
      await loginComo(rol);

      await expect(actualizarConfiguracion(CLAVE_FECHA_VIGENCIA, "31/12/2027")).rejects.toThrow();

      const valor = await getSetting(CLAVE_FECHA_VIGENCIA);
      expect(valor).toBe(PLACEHOLDER_FECHA_VIGENCIA);
    },
  );

  it("rechaza sin sesión", async () => {
    mockAuth.mockResolvedValue(null);

    await expect(actualizarConfiguracion(CLAVE_FECHA_VIGENCIA, "31/12/2027")).rejects.toThrow();
  });

  it("rechaza un valor vacío", async () => {
    await loginComoAdmin();

    await expect(actualizarConfiguracion(CLAVE_FECHA_VIGENCIA, "   ")).rejects.toThrow();
  });
});
