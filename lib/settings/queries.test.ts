import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { limpiarBaseDeTest, crearUsuario as crearUsuarioDeTest } from "@/test/helpers/db";
import { Role } from "@/generated/prisma/client";
import {
  CLAVE_FECHA_VIGENCIA,
  PLACEHOLDER_FECHA_VIGENCIA,
  getSetting,
  setSetting,
} from "@/lib/settings/queries";

// AppSetting — almacén genérico de configuración (fase soporte-moto-carro,
// Slice 4, ADR A5). Corre contra Postgres real (preoperacional_test), sin
// mocks — mismo criterio que el resto de lib/inspections y lib/admin.

beforeEach(async () => {
  await limpiarBaseDeTest();
});

afterAll(async () => {
  await limpiarBaseDeTest();
  await prisma.$disconnect();
});

describe("getSetting — soporte-moto-carro (Slice 4)", () => {
  it("devuelve el placeholder cuando la clave todavía no fue configurada", async () => {
    const valor = await getSetting(CLAVE_FECHA_VIGENCIA);

    expect(valor).toBe(PLACEHOLDER_FECHA_VIGENCIA);
  });

  it("devuelve el valor real una vez que fue configurado", async () => {
    const admin = await crearUsuarioDeTest(Role.ADMINISTRADOR);
    await setSetting(CLAVE_FECHA_VIGENCIA, "31/12/2027", admin.id);

    const valor = await getSetting(CLAVE_FECHA_VIGENCIA);

    expect(valor).toBe("31/12/2027");
  });

  it("devuelve cadena vacía para una clave sin placeholder registrado y sin fila", async () => {
    const valor = await getSetting("clave.inexistente.sin.default");

    expect(valor).toBe("");
  });
});

describe("setSetting — soporte-moto-carro (Slice 4)", () => {
  it("permite actualizar un valor ya configurado (upsert, no crea filas duplicadas)", async () => {
    const admin = await crearUsuarioDeTest(Role.ADMINISTRADOR);
    await setSetting(CLAVE_FECHA_VIGENCIA, "01/01/2027", admin.id);

    await setSetting(CLAVE_FECHA_VIGENCIA, "01/06/2027", admin.id);

    const filas = await prisma.appSetting.findMany({ where: { clave: CLAVE_FECHA_VIGENCIA } });
    expect(filas).toHaveLength(1);
    expect(filas[0]?.valor).toBe("01/06/2027");
  });

  it("registra quién hizo el último cambio (updatedById)", async () => {
    const admin = await crearUsuarioDeTest(Role.ADMINISTRADOR);

    await setSetting(CLAVE_FECHA_VIGENCIA, "01/01/2027", admin.id);

    const fila = await prisma.appSetting.findUnique({ where: { clave: CLAVE_FECHA_VIGENCIA } });
    expect(fila?.updatedById).toBe(admin.id);
  });
});
