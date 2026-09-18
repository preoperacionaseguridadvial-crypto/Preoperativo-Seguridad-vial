import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { Role, TipoFotoInspeccion } from "@/generated/prisma/client";
import { getInspectionForSupervisor } from "@/lib/inspections/supervisor-queries";
import { crearUsuario, crearVehiculo, limpiarBaseDeTest } from "@/test/helpers/db";

// Fase soporte-moto-carro, Slice 5 (A7): `getInspectionForSupervisor` (usada
// tanto por el Supervisor como por `getInspeccionParaPdf`) todavía no traía
// las fotos diarias (LATERAL/PLACA, modelo `FotoInspeccion`) — el PDF no
// tiene forma de dibujarlas. Mismo criterio que `getFirmasInspeccion`: la
// URL de lectura se firma on-demand, nunca se persiste.
describe("getInspectionForSupervisor — fotos diarias", () => {
  beforeEach(async () => {
    await limpiarBaseDeTest();
  });

  async function crearInspeccionConFotos(tipos: TipoFotoInspeccion[]) {
    const worker = await crearUsuario(Role.TRABAJADOR);
    const vehicle = await crearVehiculo();
    const inspection = await prisma.inspection.create({
      data: { workerId: worker.id, conductorId: worker.id, vehicleId: vehicle.id },
    });
    for (const tipo of tipos) {
      await prisma.fotoInspeccion.create({
        data: { inspectionId: inspection.id, tipo, s3Key: `fotos-inspeccion/${inspection.id}/${tipo}.jpg` },
      });
    }
    return inspection;
  }

  it("trae ambas fotos diarias con una URL de lectura firmada no vacía", async () => {
    const inspection = await crearInspeccionConFotos([TipoFotoInspeccion.LATERAL, TipoFotoInspeccion.PLACA]);

    const resultado = await getInspectionForSupervisor(inspection.id);

    expect(resultado?.fotos).toHaveLength(2);
    const lateral = resultado?.fotos.find((f) => f.tipo === TipoFotoInspeccion.LATERAL);
    const placa = resultado?.fotos.find((f) => f.tipo === TipoFotoInspeccion.PLACA);
    expect(lateral?.url).toBeTruthy();
    expect(placa?.url).toBeTruthy();
    expect(typeof lateral?.url).toBe("string");
  });

  it("una inspección sin fotos todavía devuelve el arreglo vacío, no undefined ni un error", async () => {
    const inspection = await crearInspeccionConFotos([]);

    const resultado = await getInspectionForSupervisor(inspection.id);

    expect(resultado?.fotos).toEqual([]);
  });
});
