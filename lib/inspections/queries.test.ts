import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { Role, TipoVehiculo, TipoFotoInspeccion } from "@/generated/prisma/client";
import {
  getChecklistCatalog,
  getVehiculoDelTrabajador,
  getAdjacentChecklistItemIds,
  getFotosInspeccion,
  getNextStepPath,
  categoriasParaLista,
} from "@/lib/inspections/queries";
import {
  crearCatalogoMinimo,
  crearChecklistItem,
  crearUsuario,
  crearVehiculo,
  limpiarBaseDeTest,
} from "@/test/helpers/db";

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

// Modelo 1:1: cada trabajador tiene UN vehículo (`User.vehicleId`) y ve solo
// ese; ya no elige entre los vehículos activos de su tipo.
describe("getVehiculoDelTrabajador", () => {
  it("devuelve el vehículo del trabajador y no los de otros, aunque sean del mismo tipo", async () => {
    const propio = await crearVehiculo({ tipoVehiculo: TipoVehiculo.MOTO });
    await crearVehiculo({ tipoVehiculo: TipoVehiculo.MOTO });
    const trabajador = await crearUsuario(Role.TRABAJADOR, { vehicleId: propio.id });

    const vehiculo = await getVehiculoDelTrabajador(trabajador.id);

    expect(vehiculo?.id).toBe(propio.id);
  });

  it("devuelve null para un trabajador legacy sin vehículo (aunque existan vehículos de su tipo)", async () => {
    await crearVehiculo({ tipoVehiculo: TipoVehiculo.MOTO });
    const legacy = await crearUsuario(Role.TRABAJADOR, { tipoVehiculo: TipoVehiculo.MOTO });

    expect(await getVehiculoDelTrabajador(legacy.id)).toBeNull();
  });

  it("devuelve el vehículo aunque esté inactivo (la pantalla decide qué mostrar con `activo`)", async () => {
    const inactivo = await crearVehiculo({ activo: false });
    const trabajador = await crearUsuario(Role.TRABAJADOR, { vehicleId: inactivo.id });

    const vehiculo = await getVehiculoDelTrabajador(trabajador.id);

    expect(vehiculo?.activo).toBe(false);
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

async function crearInspeccionEnProceso() {
  const worker = await crearUsuario(Role.TRABAJADOR);
  const vehicle = await crearVehiculo();
  return prisma.inspection.create({
    data: { workerId: worker.id, conductorId: worker.id, vehicleId: vehicle.id },
  });
}

// A7 del design: `FotoInspeccion` mirrorea `Firma` — una por inspección y
// por tipo (LATERAL/PLACA).
describe("getFotosInspeccion", () => {
  it("devuelve null para las fotos que todavía no se subieron", async () => {
    const inspection = await crearInspeccionEnProceso();

    const fotos = await getFotosInspeccion(inspection.id);

    expect(fotos.lateral).toBeNull();
    expect(fotos.placa).toBeNull();
  });

  it("devuelve cada foto en su slot correspondiente por tipo", async () => {
    const inspection = await crearInspeccionEnProceso();
    await prisma.fotoInspeccion.create({
      data: { inspectionId: inspection.id, tipo: TipoFotoInspeccion.LATERAL, s3Key: "x-lateral.jpg" },
    });
    await prisma.fotoInspeccion.create({
      data: { inspectionId: inspection.id, tipo: TipoFotoInspeccion.PLACA, s3Key: "x-placa.jpg" },
    });

    const fotos = await getFotosInspeccion(inspection.id);

    expect(fotos.lateral?.s3Key).toBe("x-lateral.jpg");
    expect(fotos.placa?.s3Key).toBe("x-placa.jpg");
  });
});

// Paradas posteriores al checklist (pedido del dueño de producto,
// 2026-09-18): declaración del conductor (3 preguntas) → fotos diarias →
// resultado → confirmar. Antes las fotos iban primero y la declaración después
// del resultado.
describe("getNextStepPath — paradas después del checklist", () => {
  async function crearInspeccionConChecklistCompleto() {
    const { item } = await crearCatalogoMinimo();
    const inspection = await crearInspeccionEnProceso();
    await prisma.inspection.update({ where: { id: inspection.id }, data: { kilometraje: 100 } });
    await prisma.inspectionItemResponse.create({
      data: { inspectionId: inspection.id, checklistItemId: item.id, valor: "OK" },
    });
    return inspection;
  }

  async function crearFotosDiarias(inspectionId: string) {
    await prisma.fotoInspeccion.create({
      data: { inspectionId, tipo: TipoFotoInspeccion.LATERAL, s3Key: "a.jpg" },
    });
    await prisma.fotoInspeccion.create({
      data: { inspectionId, tipo: TipoFotoInspeccion.PLACA, s3Key: "b.jpg" },
    });
  }

  const declaracionCompleta = { tomaMedicamentos: false, condicionesAptas: true, consumioAlcohol: false };

  it("manda a /estado-conductor apenas termina el checklist, antes de las fotos", async () => {
    const inspection = await crearInspeccionConChecklistCompleto();

    const path = await getNextStepPath(inspection.id);

    expect(path).toBe(`/inspecciones/${inspection.id}/estado-conductor`);
  });

  it("sigue en /estado-conductor mientras falte alguna de las 3 preguntas", async () => {
    const inspection = await crearInspeccionConChecklistCompleto();
    await prisma.inspection.update({
      where: { id: inspection.id },
      data: { tomaMedicamentos: false, condicionesAptas: true },
    });

    expect(await getNextStepPath(inspection.id)).toBe(`/inspecciones/${inspection.id}/estado-conductor`);
  });

  it("manda a /fotos cuando la declaración está completa pero faltan las fotos diarias", async () => {
    const inspection = await crearInspeccionConChecklistCompleto();
    await prisma.inspection.update({ where: { id: inspection.id }, data: declaracionCompleta });

    const path = await getNextStepPath(inspection.id);

    expect(path).toBe(`/inspecciones/${inspection.id}/fotos`);
  });

  it("manda a /resultado cuando ya están la declaración y las 2 fotos", async () => {
    const inspection = await crearInspeccionConChecklistCompleto();
    await prisma.inspection.update({ where: { id: inspection.id }, data: declaracionCompleta });
    await crearFotosDiarias(inspection.id);

    const path = await getNextStepPath(inspection.id);

    expect(path).toBe(`/inspecciones/${inspection.id}/resultado`);
  });

  // `confirmar/page.tsx` vuelve a llamar `getNextStepPath` para redirigir a la
  // primera parada incompleta en vez de renderizar el resumen sin haber pasado
  // por todas — este test prueba la función que hace ese gating (no hay
  // patrón establecido en este proyecto para testear el redirect de una
  // página de App Router directamente).
  it("NUNCA devuelve /confirmar si falta la declaración, las fotos o el resultado, aunque el checklist ya esté completo", async () => {
    const inspection = await crearInspeccionConChecklistCompleto();
    const confirmar = `/inspecciones/${inspection.id}/confirmar`;

    expect(await getNextStepPath(inspection.id)).not.toBe(confirmar);

    await prisma.inspection.update({ where: { id: inspection.id }, data: declaracionCompleta });
    expect(await getNextStepPath(inspection.id)).not.toBe(confirmar);

    await crearFotosDiarias(inspection.id);
    expect(await getNextStepPath(inspection.id)).not.toBe(confirmar);
    expect(await getNextStepPath(inspection.id)).toBe(`/inspecciones/${inspection.id}/resultado`);
  });

  it("manda a /confirmar cuando checklist, declaración, fotos y resultado están completos", async () => {
    const inspection = await crearInspeccionConChecklistCompleto();
    await crearFotosDiarias(inspection.id);
    await prisma.inspection.update({
      where: { id: inspection.id },
      data: { puedeOperar: true, ...declaracionCompleta },
    });

    const path = await getNextStepPath(inspection.id);

    expect(path).toBe(`/inspecciones/${inspection.id}/confirmar`);
  });
});

// Recorrido guiado (pedido del dueño de producto, 2026-09-18): Inspección
// Visual → Fluidos → Equipo de prevención → Documentación → declaración del
// conductor → fotos. Todo va ítem por ítem salvo Documentación, que es la
// única lista (`/checklist`).
describe("getNextStepPath — recorrido guiado del checklist", () => {
  async function crearCatalogoDelRecorrido() {
    const visual = await prisma.checklistCategory.create({ data: { nombre: "Inspección Visual", orden: 1 } });
    const fluidos = await prisma.checklistCategory.create({ data: { nombre: "Fluidos", orden: 2 } });
    const equipo = await prisma.checklistCategory.create({ data: { nombre: "Equipo de prevención", orden: 3 } });
    const documentos = await prisma.checklistCategory.create({ data: { nombre: "Documentación", orden: 4 } });
    return {
      espejos: await crearChecklistItem(visual.id, { nombre: "Espejos", orden: 1 }),
      frenos: await crearChecklistItem(visual.id, { nombre: "Frenos", orden: 2 }),
      soat: await crearChecklistItem(documentos.id, { nombre: "SOAT", orden: 1 }),
      cedula: await crearChecklistItem(documentos.id, { nombre: "Cédula", orden: 2 }),
      nivel: await crearChecklistItem(fluidos.id, { nombre: "Nivel de aceite", orden: 1 }),
      canguro: await crearChecklistItem(equipo.id, { nombre: "Canguro de emergencia vial", orden: 1 }),
    };
  }

  async function responder(inspectionId: string, ...items: { id: string }[]) {
    for (const item of items) {
      await prisma.inspectionItemResponse.create({
        data: { inspectionId, checklistItemId: item.id, valor: "OK" },
      });
    }
  }

  it("una inspección nueva arranca en el primer ítem visual (uno por uno), no en la lista", async () => {
    const items = await crearCatalogoDelRecorrido();
    const inspection = await crearInspeccionEnProceso();
    await prisma.inspection.update({ where: { id: inspection.id }, data: { kilometraje: 100 } });

    const path = await getNextStepPath(inspection.id);

    expect(path).toBe(`/inspecciones/${inspection.id}/checklist/${items.espejos.id}`);
  });

  it("recorre Visual, Fluidos y Equipo ítem por ítem, y recién al final abre la lista de Documentos", async () => {
    const items = await crearCatalogoDelRecorrido();
    const inspection = await crearInspeccionEnProceso();
    await prisma.inspection.update({ where: { id: inspection.id }, data: { kilometraje: 100 } });
    const base = `/inspecciones/${inspection.id}`;

    await responder(inspection.id, items.espejos);
    expect(await getNextStepPath(inspection.id)).toBe(`${base}/checklist/${items.frenos.id}`);

    await responder(inspection.id, items.frenos);
    expect(await getNextStepPath(inspection.id)).toBe(`${base}/checklist/${items.nivel.id}`);

    await responder(inspection.id, items.nivel);
    expect(await getNextStepPath(inspection.id)).toBe(`${base}/checklist/${items.canguro.id}`);

    await responder(inspection.id, items.canguro);
    expect(await getNextStepPath(inspection.id)).toBe(`${base}/checklist`);
  });
});

// La pantalla de lista (`/checklist`) ya no despliega todo el checklist junto:
// solo muestra Documentación (la única categoría sin pantalla por ítem) y
// únicamente mientras tenga documentos pendientes.
describe("categoriasParaLista", () => {
  const catalogo = (estadoDocumentos: "PENDIENTE" | "OK") => [
    { nombre: "Inspección Visual", items: [{ estado: "PENDIENTE" as const }] },
    { nombre: "Documentación", items: [{ estado: estadoDocumentos }, { estado: "OK" as const }] },
    { nombre: "Fluidos", items: [{ estado: "PENDIENTE" as const }] },
  ];

  it("muestra solo Documentación cuando tiene documentos pendientes", () => {
    const visibles = categoriasParaLista(catalogo("PENDIENTE"));

    expect(visibles.map((categoria) => categoria.nombre)).toEqual(["Documentación"]);
  });

  it("no muestra nada cuando los documentos ya están completos (aunque queden otras categorías pendientes)", () => {
    expect(categoriasParaLista(catalogo("OK"))).toEqual([]);
  });
});
