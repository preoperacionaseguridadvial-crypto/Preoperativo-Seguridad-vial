import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/prisma";
import {
  Role,
  TipoVehiculo,
  TipoRespuestaItem,
  RespuestaChecklist,
  TipoNovedad,
  TipoFotoInspeccion,
  InspectionStatus,
} from "@/generated/prisma/client";
import { getInspeccionParaPdf } from "@/lib/inspections/pdf-queries";
import { InspeccionPdfDocument } from "@/lib/pdf/InspeccionPdfDocument";
import { crearUsuario, crearVehiculo, limpiarBaseDeTest } from "@/test/helpers/db";

// Corrección Slice 5 (hallazgo WARNING reliability): antes de este fix,
// ninguna prueba automatizada ejercitaba el `InspeccionPdfDocument` real —
// la única verificación de punta a punta (renderizar un PDF real para una
// inspección MOTO/CARRO real) fue un script descartable, borrado tras su
// uso (convención de este repo para scripts puntuales de DB). CI corre
// `tsc --noEmit`/`eslint`/`vitest run`, sin `next build` ni ningún paso de
// render — una regresión futura que rompa el render (una excepción real,
// no solo un valor incorrecto de una función pura) pasaría desapercibida.
//
// Este test es PERMANENTE (no un script descartable): llama a
// `renderToBuffer(InspeccionPdfDocument({ data }))` (mismo patrón exacto que
// app/api/inspecciones/[id]/pdf/route.ts) para una inspección MOTO y una
// CARRO, sembradas contra Postgres real (mismo criterio que el resto de
// lib/inspections) con un catálogo realista (luces + estado general +
// documentación + fluidos triestado + equipo de prevención), una novedad
// con foto, las 2 fotos diarias obligatorias y una declaración de estado
// "preocupante" (para ejercitar el texto de alerta). No se verifica el
// contenido exacto del PDF (sería frágil): solo que el resultado sea un
// Buffer no vacío, con la firma mágica "%PDF-" y un tamaño dentro de un
// rango razonable — prueba de regresión de que el árbol de componentes
// renderiza sin lanzar, no de pixel-perfect output.
describe("InspeccionPdfDocument — render real (regresión permanente)", () => {
  beforeEach(async () => {
    await limpiarBaseDeTest();
  });

  afterAll(async () => {
    await limpiarBaseDeTest();
    await prisma.$disconnect();
  });

  /**
   * Catálogo mínimo pero realista: cubre las 4 secciones fijas del PDF
   * (luces, estado general, documentación) más una categoría genérica
   * (Fluidos, TRIESTADO) — mismas categorías que `prisma/seed.ts` real,
   * suficiente para ejercitar `clasificarInspeccionVisual`,
   * `categoriasGenericasPdf` y `formatoValorItemPdf` (BINARIO + TRIESTADO)
   * dentro del componente real, no solo en aislamiento (ver
   * lib/pdf/pdf-helpers.test.ts).
   */
  async function crearCatalogoRealista(tipoVehiculo: TipoVehiculo) {
    const visual = await prisma.checklistCategory.create({
      data: { nombre: "Inspección Visual", orden: 1 },
    });
    const luces = await prisma.checklistItem.create({
      data: { categoryId: visual.id, nombre: "Luces externas", orden: 1, tipoVehiculo },
    });
    const espejos = await prisma.checklistItem.create({
      data: { categoryId: visual.id, nombre: "Espejos", orden: 2, tipoVehiculo },
    });

    const documentacion = await prisma.checklistCategory.create({
      data: { nombre: "Documentación", orden: 2 },
    });
    const soat = await prisma.checklistItem.create({
      data: { categoryId: documentacion.id, nombre: "SOAT", orden: 1 },
    });

    const fluidos = await prisma.checklistCategory.create({
      data: { nombre: "Fluidos", orden: 3 },
    });
    const aceite = await prisma.checklistItem.create({
      data: {
        categoryId: fluidos.id,
        nombre: "Nivel de aceite",
        orden: 1,
        tipoRespuesta: TipoRespuestaItem.TRIESTADO,
      },
    });

    return { luces, espejos, soat, aceite };
  }

  async function crearInspeccionCompleta(tipoVehiculo: TipoVehiculo) {
    const worker = await crearUsuario(Role.TRABAJADOR, { tipoVehiculo });
    const supervisor = await crearUsuario(Role.SUPERVISOR);
    const vehicle = await crearVehiculo({ tipoVehiculo });
    const { luces, espejos, soat, aceite } = await crearCatalogoRealista(tipoVehiculo);

    const inspection = await prisma.inspection.create({
      data: {
        workerId: worker.id,
        conductorId: worker.id,
        vehicleId: vehicle.id,
        supervisorId: supervisor.id,
        status: InspectionStatus.APROBADA,
        startedAt: new Date(),
        completedAt: new Date(),
        reviewedAt: new Date(),
        observacionesSupervisor: "Todo en orden.",
        kilometraje: 12345,
        puedeOperar: true,
        // Declaración "preocupante" a propósito: ejercita el texto de
        // alerta ("REQUIERE ATENCIÓN", ver corrección Slice 5 hallazgo
        // WARNING resilience del glifo ⚠) dentro del render real.
        tomaMedicamentos: true,
        condicionesAptas: true,
        consumioAlcohol: false,
        declaracionEstadoAt: new Date(),
      },
    });

    const respuestaLuces = await prisma.inspectionItemResponse.create({
      data: { inspectionId: inspection.id, checklistItemId: luces.id, valor: RespuestaChecklist.FALLA },
    });
    await prisma.inspectionItemResponse.create({
      data: { inspectionId: inspection.id, checklistItemId: espejos.id, valor: RespuestaChecklist.OK },
    });
    await prisma.inspectionItemResponse.create({
      data: { inspectionId: inspection.id, checklistItemId: soat.id, valor: RespuestaChecklist.OK },
    });
    await prisma.inspectionItemResponse.create({
      data: { inspectionId: inspection.id, checklistItemId: aceite.id, valor: RespuestaChecklist.BAJO },
    });

    // Novedad + foto: ejercita la sección "NOVEDADES" y la página separada
    // de "EVIDENCIA FOTOGRÁFICA" (<Image src=... /> con una URL firmada
    // real apuntando al MinIO local de test — ver test/setup.ts). No hace
    // falta que el objeto exista de verdad en el bucket: un fetch fallido
    // se degrada con un console.warn dentro de @react-pdf/layout
    // (fetchImage), nunca tumba el render (confirmado leyendo
    // node_modules/@react-pdf/layout).
    await prisma.novedad.create({
      data: {
        inspectionId: inspection.id,
        inspectionItemResponseId: respuestaLuces.id,
        descripcion: "Luz direccional derecha no enciende.",
        tipo: TipoNovedad.FALLA,
        ubicacion: "Lateral derecho",
        photos: { create: [{ s3Key: `novedades/${inspection.id}/foto-1.jpg` }] },
      },
    });

    // Fotos diarias obligatorias (Slice 5, A7).
    await prisma.fotoInspeccion.create({
      data: {
        inspectionId: inspection.id,
        tipo: TipoFotoInspeccion.LATERAL,
        s3Key: `fotos-inspeccion/${inspection.id}/LATERAL.jpg`,
      },
    });
    await prisma.fotoInspeccion.create({
      data: {
        inspectionId: inspection.id,
        tipo: TipoFotoInspeccion.PLACA,
        s3Key: `fotos-inspeccion/${inspection.id}/PLACA.jpg`,
      },
    });

    // Sin firmas a propósito: ejercita la rama "Sin firma registrada" de
    // `FirmaCaja` (InspeccionPdfDocument.tsx), que no depende de ningún
    // fetch de imagen.

    return inspection;
  }

  async function renderizarPdfDe(tipoVehiculo: TipoVehiculo) {
    const inspection = await crearInspeccionCompleta(tipoVehiculo);
    const data = await getInspeccionParaPdf(inspection.id);
    if (!data) {
      throw new Error("getInspeccionParaPdf devolvió null para una inspección recién creada.");
    }

    // Mismo patrón exacto que app/api/inspecciones/[id]/pdf/route.ts:
    // `InspeccionPdfDocument({ data })` se llama como función plana (no
    // JSX) porque este es un archivo `.ts`, no `.tsx` — `vitest.config.ts`
    // solo incluye `**/*.test.ts` (confirmado por la revisión, sin plugin
    // de render de React), así que este test permanece `.ts` aunque
    // ejercite un componente `.tsx`: llamar al componente como función
    // sigue siendo TypeScript válido, sin necesitar sintaxis JSX.
    return renderToBuffer(InspeccionPdfDocument({ data }));
  }

  function esperarPdfValido(buffer: Buffer) {
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(0);
    expect(buffer.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    // Rango razonable: un PDF de 1-2 páginas con la fuente + logo
    // embebidos pesa más que unos pocos KB, pero no debería acercarse a
    // decenas de MB para una sola inspección de prueba — no se verifica
    // byte a byte (sería frágil), solo que el tamaño sea sano.
    expect(buffer.length).toBeGreaterThan(1_000);
    expect(buffer.length).toBeLessThan(5_000_000);
  }

  it("renderiza sin lanzar un PDF válido para una inspección MOTO real", async () => {
    const buffer = await renderizarPdfDe(TipoVehiculo.MOTO);
    esperarPdfValido(buffer);
  });

  it("renderiza sin lanzar un PDF válido para una inspección CARRO real", async () => {
    const buffer = await renderizarPdfDe(TipoVehiculo.CARRO);
    esperarPdfValido(buffer);
  });

  // Layout del bloque final (pedido del dueño de producto, 2026-09-18): el
  // texto instructivo ("LA UNIDAD DEBE SER REVISADA...") va DEBAJO de las
  // firmas, a todo el ancho. A la derecha le quitaba espacio a las firmas.
  // El PDF no se puede leer píxel a píxel acá, así que se inspecciona el árbol
  // de elementos que produce el componente (sin renderizarlo).
  describe("bloque de resultado y firmas", () => {
    type Elemento = { props?: { style?: unknown; children?: unknown; titulo?: string } };
    type Visita = { elemento: Elemento; ancestros: Elemento[] };

    function recorrer(nodo: unknown, ancestros: Elemento[] = [], visitas: Visita[] = []): Visita[] {
      if (Array.isArray(nodo)) {
        nodo.forEach((hijo) => recorrer(hijo, ancestros, visitas));
      } else if (nodo && typeof nodo === "object" && "props" in nodo) {
        const elemento = nodo as Elemento;
        visitas.push({ elemento, ancestros });
        recorrer(elemento.props?.children, [...ancestros, elemento], visitas);
      }
      return visitas;
    }

    const estiloDe = (elemento: Elemento): Record<string, unknown> => {
      const estilo = elemento.props?.style;
      return Array.isArray(estilo) ? Object.assign({}, ...estilo.flat()) : ((estilo as Record<string, unknown>) ?? {});
    };
    const hijosDe = (elemento: Elemento): unknown[] => [elemento.props?.children].flat(Infinity);
    const contiene = (raiz: unknown, objetivo: Elemento): boolean =>
      raiz === objetivo || (typeof raiz === "object" && raiz !== null && recorrer(raiz).some((v) => v.elemento === objetivo));

    it("pone el texto instructivo debajo de las firmas, a todo el ancho", async () => {
      const inspection = await crearInspeccionCompleta(TipoVehiculo.MOTO);
      const data = await getInspeccionParaPdf(inspection.id);
      if (!data) throw new Error("getInspeccionParaPdf devolvió null para una inspección recién creada.");

      const visitas = recorrer(InspeccionPdfDocument({ data }));
      const instructivo = visitas.find(
        (v) => typeof v.elemento.props?.children === "string" && v.elemento.props.children.startsWith("LA UNIDAD DEBE SER REVISADA"),
      );
      const firmaConductor = visitas.find((v) => v.elemento.props?.titulo === "NOMBRE Y FIRMA DEL CONDUCTOR");
      expect(instructivo, "texto instructivo").toBeDefined();
      expect(firmaConductor, "firma del conductor").toBeDefined();

      // El bloque es el ancestro común más cercano de las firmas y el texto.
      const banda = [...instructivo!.ancestros].reverse().find((a) => firmaConductor!.ancestros.includes(a));
      expect(banda, "bloque de resultado").toBeDefined();
      expect(estiloDe(banda!).flexDirection, "el bloque no debe ser una fila (texto a la derecha)").not.toBe("row");

      // Cada rama directa del bloque: la de las firmas va antes que la del texto…
      const ramas = hijosDe(banda!).filter((r): r is Elemento => typeof r === "object" && r !== null);
      const ramaFirmas = ramas.findIndex((r) => contiene(r, firmaConductor!.elemento));
      const ramaTexto = ramas.findIndex((r) => contiene(r, instructivo!.elemento));
      expect(ramaFirmas).toBeGreaterThanOrEqual(0);
      expect(ramaTexto).toBeGreaterThan(ramaFirmas);
      // …y la rama de las firmas ocupa todo el ancho (sin un porcentaje fijo).
      expect(estiloDe(ramas[ramaFirmas]).width).toBeUndefined();
    });
  });
});
