import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { Role, TipoVehiculo } from "@/generated/prisma/client";
import {
  getChecklistCatalog,
  getVehiculosActivos,
  getAdjacentChecklistItemIds,
} from "@/lib/inspections/queries";
import { crearChecklistItem, crearUsuario, crearVehiculo, limpiarBaseDeTest } from "@/test/helpers/db";

beforeEach(async () => {
  await limpiarBaseDeTest();
});

afterAll(async () => {
  await limpiarBaseDeTest();
  await prisma.$disconnect();
});

// A1 del design: catálogo branching por `ChecklistItem.tipoVehiculo` (null =
// aplica a ambos). Cubre el requisito modificado "Catalog scoped by vehicle
// type" del spec (checklist-catalog).
describe("getChecklistCatalog", () => {
  async function crearCatalogoConAmbosTipos() {
    const categoria = await prisma.checklistCategory.create({
      data: { nombre: "Inspección Visual", orden: 1 },
    });
    const compartido = await crearChecklistItem(categoria.id, { nombre: "Espejos", orden: 1 });
    const soloMoto = await crearChecklistItem(categoria.id, {
      nombre: "Casco",
      orden: 2,
      tipoVehiculo: TipoVehiculo.MOTO,
    });
    const soloCarro = await crearChecklistItem(categoria.id, {
      nombre: "Cinturones de seguridad",
      orden: 3,
      tipoVehiculo: TipoVehiculo.CARRO,
    });
    return { categoria, compartido, soloMoto, soloCarro };
  }

  it("MOTO incluye los ítems compartidos y los de MOTO, excluye los de CARRO", async () => {
    const { compartido, soloMoto, soloCarro } = await crearCatalogoConAmbosTipos();

    const catalog = await getChecklistCatalog(TipoVehiculo.MOTO);
    const nombres = catalog.flatMap((c) => c.items.map((i) => i.id));

    expect(nombres).toContain(compartido.id);
    expect(nombres).toContain(soloMoto.id);
    expect(nombres).not.toContain(soloCarro.id);
  });

  it("CARRO incluye los ítems compartidos y los de CARRO, excluye los de MOTO", async () => {
    const { compartido, soloMoto, soloCarro } = await crearCatalogoConAmbosTipos();

    const catalog = await getChecklistCatalog(TipoVehiculo.CARRO);
    const nombres = catalog.flatMap((c) => c.items.map((i) => i.id));

    expect(nombres).toContain(compartido.id);
    expect(nombres).toContain(soloCarro.id);
    expect(nombres).not.toContain(soloMoto.id);
  });

  it("excluye una categoría entera si ninguno de sus ítems aplica al tipo pedido", async () => {
    const categoriaSoloCarro = await prisma.checklistCategory.create({
      data: { nombre: "Equipo de prevención", orden: 2 },
    });
    await crearChecklistItem(categoriaSoloCarro.id, {
      nombre: "Botiquín",
      tipoVehiculo: TipoVehiculo.CARRO,
    });

    const catalog = await getChecklistCatalog(TipoVehiculo.MOTO);

    expect(catalog.find((c) => c.id === categoriaSoloCarro.id)).toBeUndefined();
  });
});

describe("getVehiculosActivos", () => {
  it("filtra por tipoVehiculo", async () => {
    const moto = await crearVehiculo({ tipoVehiculo: TipoVehiculo.MOTO });
    const carro = await crearVehiculo({ tipoVehiculo: TipoVehiculo.CARRO });

    const motos = await getVehiculosActivos(TipoVehiculo.MOTO);
    const carros = await getVehiculosActivos(TipoVehiculo.CARRO);

    expect(motos.map((v) => v.id)).toContain(moto.id);
    expect(motos.map((v) => v.id)).not.toContain(carro.id);
    expect(carros.map((v) => v.id)).toContain(carro.id);
    expect(carros.map((v) => v.id)).not.toContain(moto.id);
  });

  it("devuelve lista vacía cuando el trabajador no tiene tipo asignado (null)", async () => {
    await crearVehiculo({ tipoVehiculo: TipoVehiculo.MOTO });

    const vehiculos = await getVehiculosActivos(null);

    expect(vehiculos).toEqual([]);
  });
});

describe("getAdjacentChecklistItemIds", () => {
  it("resuelve el catálogo según el tipo de vehículo de la inspección (A3)", async () => {
    const categoria = await prisma.checklistCategory.create({
      data: { nombre: "Inspección Visual", orden: 1 },
    });
    const item1 = await crearChecklistItem(categoria.id, { nombre: "Espejos", orden: 1 });
    const soloMoto = await crearChecklistItem(categoria.id, {
      nombre: "Casco",
      orden: 2,
      tipoVehiculo: TipoVehiculo.MOTO,
    });

    const worker = await crearUsuario(Role.TRABAJADOR, { tipoVehiculo: TipoVehiculo.MOTO });
    const vehicle = await crearVehiculo({ tipoVehiculo: TipoVehiculo.MOTO });
    const inspection = await prisma.inspection.create({
      data: { workerId: worker.id, conductorId: worker.id, vehicleId: vehicle.id },
    });

    const { nextItemId } = await getAdjacentChecklistItemIds(inspection.id, item1.id);
    expect(nextItemId).toBe(soloMoto.id);
  });
});
