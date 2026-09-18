import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { Role, InspectionStatus } from "@/generated/prisma/client";
import * as settingsQueries from "@/lib/settings/queries";
import { CLAVE_FECHA_VIGENCIA, PLACEHOLDER_FECHA_VIGENCIA, setSetting } from "@/lib/settings/queries";
import { getInspeccionParaPdf } from "@/lib/inspections/pdf-queries";
import { crearUsuario, crearVehiculo, limpiarBaseDeTest } from "@/test/helpers/db";

// AppSetting → PDF (fase soporte-moto-carro, Slice 4, ADR A5). Corre contra
// Postgres real (preoperacional_test) — mismo criterio que el resto de
// lib/inspections. Ningún mock salvo `getSetting`, espiado puntualmente
// (`vi.spyOn`) solo en el test de degradación de abajo.

beforeEach(async () => {
  await limpiarBaseDeTest();
});

afterAll(async () => {
  await limpiarBaseDeTest();
  await prisma.$disconnect();
});

async function crearInspeccion() {
  const worker = await crearUsuario(Role.TRABAJADOR);
  const vehicle = await crearVehiculo();
  return prisma.inspection.create({
    data: {
      workerId: worker.id,
      conductorId: worker.id,
      vehicleId: vehicle.id,
      status: InspectionStatus.PENDIENTE_APROBACION,
      puedeOperar: true,
      completedAt: new Date(),
    },
  });
}

// Corrección Slice 4 (hallazgo WARNING reliability): antes de este fix solo
// `getSetting` estaba testeado en aislamiento — ninguna prueba cubría que
// `getInspeccionParaPdf` (la función real invocada por
// app/api/inspecciones/[id]/pdf/route.ts) ensamblara `fechaVigencia`
// correctamente de punta a punta.
describe("getInspeccionParaPdf — fechaVigencia (Slice 4)", () => {
  it("refleja el valor configurado en AppSetting cuando existe", async () => {
    const admin = await crearUsuario(Role.ADMINISTRADOR);
    await setSetting(CLAVE_FECHA_VIGENCIA, "31/12/2027", admin.id);
    const inspection = await crearInspeccion();

    const resultado = await getInspeccionParaPdf(inspection.id);

    expect(resultado?.fechaVigencia).toBe("31/12/2027");
  });

  it("cae al placeholder cuando nadie configuró la fecha todavía", async () => {
    const inspection = await crearInspeccion();

    const resultado = await getInspeccionParaPdf(inspection.id);

    expect(resultado?.fechaVigencia).toBe(PLACEHOLDER_FECHA_VIGENCIA);
  });
});

// Corrección Slice 4 (hallazgo WARNING resilience): `getInspeccionParaPdf`
// tenía una dependencia dura y sin resguardo con `getSetting` — cualquier
// error de la tabla `AppSetting` tumbaba la generación completa del PDF, a
// pesar de que `getSetting` documenta que "siempre devuelve algo
// mostrable". Se prueba acá, a nivel de `getInspeccionParaPdf`, forzando
// una única llamada fallida de `getSetting` con `vi.spyOn` (mismo patrón que
// `lib/inspections/foto-actions.test.ts` para espiar dependencias puntuales
// sin mockear el módulo entero).
describe("getInspeccionParaPdf — degradación ante fallo de AppSetting (Slice 4)", () => {
  it("degrada a PLACEHOLDER_FECHA_VIGENCIA en vez de lanzar cuando getSetting falla", async () => {
    const errorSilenciado = vi.spyOn(console, "error").mockImplementation(() => {});
    const getSettingSpy = vi.spyOn(settingsQueries, "getSetting").mockImplementationOnce(() => {
      throw new Error("Fallo simulado de conexión a AppSetting");
    });
    const inspection = await crearInspeccion();

    const resultado = await getInspeccionParaPdf(inspection.id);

    expect(resultado?.fechaVigencia).toBe(PLACEHOLDER_FECHA_VIGENCIA);
    expect(errorSilenciado).toHaveBeenCalled();

    getSettingSpy.mockRestore();
    errorSilenciado.mockRestore();
  });
});
