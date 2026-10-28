import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { Role, TipoVehiculo, TipoFotoInspeccion } from "@/generated/prisma/client";
import {
  getChecklistCatalog,
  getVehiculoDelTrabajador,
  getAdjacentChecklistItemIds,
  getFotosInspeccion,
  getNextStepPath,
  getPreviousStepPath,
  getFollowingStepPath,
  categoriasParaLista,
  fotosRequeridasParaEnvio,
} from "@/lib/inspections/queries";
import { llantasDeVehiculo } from "@/lib/inspections/fotos-flujo";
import { CHECKLIST } from "@/prisma/catalogo-checklist";
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
    expect(fotos.llantas.map((l) => [l.tipo, l.foto])).toEqual([
      ["LLANTA_DELANTERA", null],
      ["LLANTA_TRASERA", null],
    ]);
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

  it("devuelve las fotos de las llantas de la MOTO en su propio slot, sin contarlas como lateral ni placa", async () => {
    const inspection = await crearInspeccionEnProceso();
    await prisma.fotoInspeccion.create({
      data: { inspectionId: inspection.id, tipo: TipoFotoInspeccion.LLANTA_TRASERA, s3Key: "x-trasera.jpg" },
    });

    const fotos = await getFotosInspeccion(inspection.id);

    expect(fotos.llantas.map((l) => [l.tipo, l.foto?.s3Key ?? null])).toEqual([
      ["LLANTA_DELANTERA", null],
      ["LLANTA_TRASERA", "x-trasera.jpg"],
    ]);
    expect(fotos.lateral).toBeNull();
    expect(fotos.placa).toBeNull();
  });

  it("CARRO: devuelve los 4 slots de llantas en orden de posición", async () => {
    const worker = await crearUsuario(Role.TRABAJADOR, { tipoVehiculo: TipoVehiculo.CARRO });
    const vehicle = await crearVehiculo({ tipoVehiculo: TipoVehiculo.CARRO });
    const inspection = await prisma.inspection.create({
      data: { workerId: worker.id, conductorId: worker.id, vehicleId: vehicle.id },
    });
    await prisma.fotoInspeccion.create({
      data: { inspectionId: inspection.id, tipo: TipoFotoInspeccion.LLANTA_DELANTERA_DERECHA, s3Key: "dd.jpg" },
    });

    const fotos = await getFotosInspeccion(inspection.id);

    expect(fotos.llantas.map((l) => [l.tipo, l.foto?.s3Key ?? null])).toEqual([
      ["LLANTA_DELANTERA_IZQUIERDA", null],
      ["LLANTA_DELANTERA_DERECHA", "dd.jpg"],
      ["LLANTA_TRASERA_IZQUIERDA", null],
      ["LLANTA_TRASERA_DERECHA", null],
    ]);
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

/// Recorrido guiado (pedido del dueño de producto, 2026-10-23): kilometraje →
// Documentos (la única lista, `/checklist`) → ítems uno por uno en el orden
// GLOBAL de `ChecklistItem.orden` (intercala categorías) → declaración del
// conductor → fotos.
describe("getNextStepPath — recorrido guiado del checklist", () => {
  async function crearCatalogoDelRecorrido() {
    const visual = await prisma.checklistCategory.create({ data: { nombre: "Inspección Visual", orden: 1 } });
    const fluidos = await prisma.checklistCategory.create({ data: { nombre: "Fluidos", orden: 2 } });
    const equipo = await prisma.checklistCategory.create({ data: { nombre: "Equipo de prevención", orden: 3 } });
    const documentos = await prisma.checklistCategory.create({ data: { nombre: "Documentación", orden: 4 } });
    return {
      espejos: await crearChecklistItem(visual.id, { nombre: "Espejos", orden: 90 }),
      frenos: await crearChecklistItem(visual.id, { nombre: "Frenos", orden: 50 }),
      soat: await crearChecklistItem(documentos.id, { nombre: "SOAT", orden: 1 }),
      cedula: await crearChecklistItem(documentos.id, { nombre: "Cédula", orden: 2 }),
      nivel: await crearChecklistItem(fluidos.id, { nombre: "Nivel de aceite", orden: 30 }),
      canguro: await crearChecklistItem(equipo.id, { nombre: "Canguro de emergencia vial", orden: 120 }),
    };
  }

  async function responder(inspectionId: string, ...items: { id: string }[]) {
    for (const item of items) {
      await prisma.inspectionItemResponse.create({
        data: { inspectionId, checklistItemId: item.id, valor: "OK" },
      });
    }
  }

  it("una inspección nueva con kilometraje arranca en la lista de Documentos", async () => {
    await crearCatalogoDelRecorrido();
    const inspection = await crearInspeccionEnProceso();
    await prisma.inspection.update({ where: { id: inspection.id }, data: { kilometraje: 100 } });

    const path = await getNextStepPath(inspection.id);

    expect(path).toBe(`/inspecciones/${inspection.id}/checklist`);
  });

  it("sin kilometraje arranca en medidas, antes que los documentos", async () => {
    await crearCatalogoDelRecorrido();
    const inspection = await crearInspeccionEnProceso();

    expect(await getNextStepPath(inspection.id)).toBe(`/inspecciones/${inspection.id}/medidas`);
  });

  it("Documentos primero y luego los ítems en orden global, intercalando categorías", async () => {
    const items = await crearCatalogoDelRecorrido();
    const inspection = await crearInspeccionEnProceso();
    await prisma.inspection.update({ where: { id: inspection.id }, data: { kilometraje: 100 } });
    const base = `/inspecciones/${inspection.id}`;

    // Con un documento resuelto y otro pendiente sigue mandando a la lista.
    await responder(inspection.id, items.soat);
    expect(await getNextStepPath(inspection.id)).toBe(`${base}/checklist`);

    await responder(inspection.id, items.cedula);
    expect(await getNextStepPath(inspection.id)).toBe(`${base}/checklist/${items.nivel.id}`);

    await responder(inspection.id, items.nivel);
    expect(await getNextStepPath(inspection.id)).toBe(`${base}/checklist/${items.frenos.id}`);

    await responder(inspection.id, items.frenos);
    expect(await getNextStepPath(inspection.id)).toBe(`${base}/checklist/${items.espejos.id}`);

    await responder(inspection.id, items.espejos);
    expect(await getNextStepPath(inspection.id)).toBe(`${base}/checklist/${items.canguro.id}`);

    await responder(inspection.id, items.canguro);
    expect(await getNextStepPath(inspection.id)).toBe(`${base}/estado-conductor`);
  });
});

// Recorrido completo con el catálogo REAL del seed (prisma/catalogo-checklist.ts),
// para MOTO y CARRO: recorre getNextStepPath respondiendo cada paso y compara el
// orden de nombres con el pedido del dueño de producto.
describe("getNextStepPath — recorrido completo con el catálogo sembrado", () => {
  async function sembrarCatalogo() {
    for (const categoria of CHECKLIST) {
      const creada = await prisma.checklistCategory.create({
        data: { nombre: categoria.nombre, orden: categoria.orden },
      });
      for (const item of categoria.items) {
        await prisma.checklistItem.create({
          data: {
            categoryId: creada.id,
            nombre: item.nombre,
            orden: item.orden,
            tipoVehiculo: item.tipoVehiculo ?? null,
            tipoRespuesta: item.tipoRespuesta ?? "BINARIO",
          },
        });
      }
    }
  }

  async function recorrer(tipoVehiculo: TipoVehiculo): Promise<string[]> {
    await sembrarCatalogo();
    const worker = await crearUsuario(Role.TRABAJADOR, { tipoVehiculo });
    const vehicle = await crearVehiculo({ tipoVehiculo });
    const inspection = await prisma.inspection.create({
      data: { workerId: worker.id, conductorId: worker.id, vehicleId: vehicle.id },
    });
    const base = `/inspecciones/${inspection.id}`;
    const vistos: string[] = [];

    expect(await getNextStepPath(inspection.id)).toBe(`${base}/medidas`);
    await prisma.inspection.update({ where: { id: inspection.id }, data: { kilometraje: 100 } });

    for (let i = 0; i < 40; i++) {
      const path = await getNextStepPath(inspection.id);
      if (path === `${base}/checklist`) {
        vistos.push("Documentos");
        const docs = await prisma.checklistItem.findMany({ where: { category: { nombre: "Documentación" } } });
        for (const doc of docs) {
          await prisma.inspectionItemResponse.create({
            data: { inspectionId: inspection.id, checklistItemId: doc.id, valor: "OK" },
          });
        }
        continue;
      }
      if (path === `${base}/foto-llantas`) {
        vistos.push("Foto de las llantas");
        await prisma.fotoInspeccion.createMany({
          data: llantasDeVehiculo(tipoVehiculo).map((tipo) => ({
            inspectionId: inspection.id,
            tipo,
            s3Key: `${tipo}.jpg`,
          })),
        });
        continue;
      }
      const itemId = path.split("/checklist/")[1];
      if (!itemId) break;
      const item = await prisma.checklistItem.findUniqueOrThrow({ where: { id: itemId } });
      vistos.push(item.nombre);
      await prisma.inspectionItemResponse.create({
        data: {
          inspectionId: inspection.id,
          checklistItemId: item.id,
          valor: item.tipoRespuesta === "TRIESTADO" ? "BUENO" : "OK",
        },
      });
    }
    return vistos;
  }

  it("MOTO (con la foto de las llantas justo después de Llantas)", async () => {
    expect(await recorrer(TipoVehiculo.MOTO)).toEqual([
      "Documentos",
      "Luces externas con direccionales",
      "Llantas",
      "Foto de las llantas",
      "Nivel de aceite",
      "Nivel líquido de frenos",
      "Frenos",
      "Nivel refrigerante",
      "Espejos",
      "Canguro de emergencia vial",
      "Casco",
    ]);
  });

  it("CARRO", async () => {
    expect(await recorrer(TipoVehiculo.CARRO)).toEqual([
      "Documentos",
      "Luces altas, bajas, reversa e internas con direccionales",
      "Llantas, incluye repuesto",
      "Foto de las llantas",
      "Nivel de aceite",
      "Nivel líquido de frenos",
      "Frenos",
      "Nivel refrigerante",
      "Cinturones de seguridad",
      "Limpiabrisas",
      "Espejos",
      "Botiquín",
      "Extintor",
    ]);
  });
});

// Fotos de las llantas (feature fotos-llantas-por-posicion): paso propio
// (`/foto-llantas`) entre el ítem de llantas y el siguiente del recorrido; MOTO
// pide 2 fotos, CARRO 4, y el paso sigue hasta que estén todas.
describe("getNextStepPath — fotos de las llantas", () => {
  async function crearCatalogoConLlantas() {
    const visual = await prisma.checklistCategory.create({ data: { nombre: "Inspección Visual", orden: 1 } });
    const fluidos = await prisma.checklistCategory.create({ data: { nombre: "Fluidos", orden: 2 } });
    return {
      llantasMoto: await crearChecklistItem(visual.id, { nombre: "Llantas", orden: 20, tipoVehiculo: TipoVehiculo.MOTO }),
      llantasCarro: await crearChecklistItem(visual.id, {
        nombre: "Llantas, incluye repuesto",
        orden: 21,
        tipoVehiculo: TipoVehiculo.CARRO,
      }),
      aceite: await crearChecklistItem(fluidos.id, { nombre: "Nivel de aceite", orden: 30 }),
    };
  }

  async function inspeccionDe(tipoVehiculo: TipoVehiculo) {
    const worker = await crearUsuario(Role.TRABAJADOR, { tipoVehiculo });
    const vehicle = await crearVehiculo({ tipoVehiculo });
    return prisma.inspection.create({
      data: { workerId: worker.id, conductorId: worker.id, vehicleId: vehicle.id, kilometraje: 100 },
    });
  }

  async function responder(inspectionId: string, itemId: string) {
    await prisma.inspectionItemResponse.create({ data: { inspectionId, checklistItemId: itemId, valor: "OK" } });
  }

  it("MOTO: tras responder Llantas manda a /foto-llantas, antes del siguiente ítem", async () => {
    const items = await crearCatalogoConLlantas();
    const inspection = await inspeccionDe(TipoVehiculo.MOTO);
    await responder(inspection.id, items.llantasMoto.id);

    expect(await getNextStepPath(inspection.id)).toBe(`/inspecciones/${inspection.id}/foto-llantas`);
  });

  async function subirFoto(inspectionId: string, tipo: TipoFotoInspeccion) {
    await prisma.fotoInspeccion.create({ data: { inspectionId, tipo, s3Key: `${tipo}.jpg` } });
  }

  it("MOTO: con solo una de las 2 fotos sigue en /foto-llantas", async () => {
    const items = await crearCatalogoConLlantas();
    const inspection = await inspeccionDe(TipoVehiculo.MOTO);
    await responder(inspection.id, items.llantasMoto.id);
    await subirFoto(inspection.id, TipoFotoInspeccion.LLANTA_DELANTERA);

    expect(await getNextStepPath(inspection.id)).toBe(`/inspecciones/${inspection.id}/foto-llantas`);
  });

  it("MOTO: con las 2 fotos sigue al siguiente ítem", async () => {
    const items = await crearCatalogoConLlantas();
    const inspection = await inspeccionDe(TipoVehiculo.MOTO);
    await responder(inspection.id, items.llantasMoto.id);
    await subirFoto(inspection.id, TipoFotoInspeccion.LLANTA_DELANTERA);
    await subirFoto(inspection.id, TipoFotoInspeccion.LLANTA_TRASERA);

    expect(await getNextStepPath(inspection.id)).toBe(`/inspecciones/${inspection.id}/checklist/${items.aceite.id}`);
  });

  it("MOTO: la foto legado LLANTAS ya no cuenta", async () => {
    const items = await crearCatalogoConLlantas();
    const inspection = await inspeccionDe(TipoVehiculo.MOTO);
    await responder(inspection.id, items.llantasMoto.id);
    await subirFoto(inspection.id, TipoFotoInspeccion.LLANTAS);

    expect(await getNextStepPath(inspection.id)).toBe(`/inspecciones/${inspection.id}/foto-llantas`);
  });

  it("MOTO: sin responder Llantas todavía no pide la foto", async () => {
    const items = await crearCatalogoConLlantas();
    const inspection = await inspeccionDe(TipoVehiculo.MOTO);

    expect(await getNextStepPath(inspection.id)).toBe(`/inspecciones/${inspection.id}/checklist/${items.llantasMoto.id}`);
  });

  it("CARRO: tras responder Llantas manda a /foto-llantas hasta tener las 4 fotos", async () => {
    const items = await crearCatalogoConLlantas();
    const inspection = await inspeccionDe(TipoVehiculo.CARRO);
    await responder(inspection.id, items.llantasCarro.id);
    const base = `/inspecciones/${inspection.id}`;

    expect(await getNextStepPath(inspection.id)).toBe(`${base}/foto-llantas`);
    for (const tipo of llantasDeVehiculo("CARRO").slice(0, 3)) {
      await subirFoto(inspection.id, tipo);
      expect(await getNextStepPath(inspection.id)).toBe(`${base}/foto-llantas`);
    }
    await subirFoto(inspection.id, TipoFotoInspeccion.LLANTA_TRASERA_DERECHA);

    expect(await getNextStepPath(inspection.id)).toBe(`${base}/checklist/${items.aceite.id}`);
  });

  it("fotosRequeridasParaEnvio: lateral y placa más 2 llantas en MOTO o 4 en CARRO", async () => {
    await crearCatalogoConLlantas();
    const moto = fotosRequeridasParaEnvio(await getChecklistCatalog(TipoVehiculo.MOTO), TipoVehiculo.MOTO);
    const carro = fotosRequeridasParaEnvio(await getChecklistCatalog(TipoVehiculo.CARRO), TipoVehiculo.CARRO);

    expect(moto).toEqual(["LATERAL", "PLACA", "LLANTA_DELANTERA", "LLANTA_TRASERA"]);
    expect(carro).toEqual([
      "LATERAL",
      "PLACA",
      "LLANTA_DELANTERA_IZQUIERDA",
      "LLANTA_DELANTERA_DERECHA",
      "LLANTA_TRASERA_IZQUIERDA",
      "LLANTA_TRASERA_DERECHA",
    ]);
  });

  it("Atrás / Siguiente la incluyen en el orden del flujo", async () => {
    const items = await crearCatalogoConLlantas();
    const inspection = await inspeccionDe(TipoVehiculo.MOTO);
    const base = `/inspecciones/${inspection.id}`;

    expect(await getPreviousStepPath(inspection.id, "foto-llantas")).toBe(`${base}/checklist/${items.llantasMoto.id}`);
    expect(await getFollowingStepPath(inspection.id, "foto-llantas")).toBe(`${base}/checklist/${items.aceite.id}`);
    expect(await getPreviousStepPath(inspection.id, `checklist/${items.aceite.id}`)).toBe(`${base}/foto-llantas`);
  });
});

describe("getPreviousStepPath / getFollowingStepPath", () => {
  it("devuelve el paso previo y el siguiente en el orden real del flujo (documentos antes que los ítems)", async () => {
    const visual = await prisma.checklistCategory.create({ data: { nombre: "Inspección Visual", orden: 1 } });
    const documentos = await prisma.checklistCategory.create({ data: { nombre: "Documentación", orden: 2 } });
    const espejos = await crearChecklistItem(visual.id, { nombre: "Espejos", orden: 1 });
    await crearChecklistItem(documentos.id, { nombre: "SOAT", orden: 1 });
    const inspection = await crearInspeccionEnProceso();
    const base = `/inspecciones/${inspection.id}`;

    expect(await getPreviousStepPath(inspection.id, "medidas")).toBeNull();
    expect(await getPreviousStepPath(inspection.id, "checklist")).toBe(`${base}/medidas`);
    expect(await getPreviousStepPath(inspection.id, `checklist/${espejos.id}`)).toBe(`${base}/checklist`);
    expect(await getPreviousStepPath(inspection.id, "estado-conductor?paso=1")).toBe(
      `${base}/checklist/${espejos.id}`,
    );
    expect(await getPreviousStepPath(inspection.id, "fotos")).toBe(`${base}/estado-conductor?paso=3`);
    expect(await getPreviousStepPath(inspection.id, "confirmar")).toBe(`${base}/resultado`);
    expect(await getFollowingStepPath(inspection.id, "checklist")).toBe(`${base}/checklist/${espejos.id}`);
    expect(await getFollowingStepPath(inspection.id, "confirmar")).toBeNull();
  });
});

// La pantalla de lista (`/checklist`) solo muestra Documentación (la única
// categoría sin pantalla por ítem). Se muestra SIEMPRE mientras la inspección
// está EN_PROCESO (con o sin pendientes) para poder revisar y corregir los
// documentos ya resueltos.
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

  it("sigue mostrando Documentación aunque ya esté completa, para poder corregir un documento", () => {
    const visibles = categoriasParaLista(catalogo("OK"));

    expect(visibles.map((categoria) => categoria.nombre)).toEqual(["Documentación"]);
  });

  it("no muestra nada si el catálogo no tiene documentos", () => {
    expect(categoriasParaLista([{ nombre: "Fluidos", items: [{ estado: "OK" as const }] }])).toEqual([]);
  });
});
