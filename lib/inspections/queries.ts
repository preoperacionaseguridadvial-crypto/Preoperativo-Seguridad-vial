import "server-only";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { InspectionStatus, RespuestaChecklist, TipoFirma } from "@/generated/prisma/client";
import { getSignedReadUrl } from "@/lib/storage/s3";

/**
 * Catálogo completo del checklist, ordenado por `orden` de categoría e
 * ítem. Usado tanto por la UI (para renderizar el flujo guiado) como por
 * `enviarInspeccion` (lib/inspections/actions.ts) para validar que todos
 * los ítems obligatorios tengan respuesta.
 */
export function getChecklistCatalog() {
  return prisma.checklistCategory.findMany({
    orderBy: { orden: "asc" },
    include: {
      items: { orderBy: { orden: "asc" } },
    },
  });
}

/** Estado de un ítem para una inspección puntual: la respuesta ya dada, o
 * `"PENDIENTE"` si todavía no tiene `InspectionItemResponse`.
 *
 * `BUENO`/`BAJO`/`MALO` (agregados al enum `RespuestaChecklist` en la fase
 * soporte-moto-carro, Slice 1) quedan excluidos acá a propósito: ningún
 * `ChecklistItem` usa `tipoRespuesta = TRIESTADO` todavía (llega en el
 * Slice 2, que también actualiza este archivo — ver design del cambio), así
 * que en este slice esos valores nunca ocurren en la práctica. */
export type EstadoChecklistItem = Exclude<RespuestaChecklist, "BUENO" | "BAJO" | "MALO"> | "PENDIENTE";

/**
 * Catálogo completo (reusa `getChecklistCatalog`) más el estado de cada
 * ítem para una inspección puntual — usado por la pantalla de lista del
 * checklist para mostrar el estado de cada ítem agrupado por categoría, sin
 * duplicar la consulta del catálogo.
 */
export async function getChecklistEstadoCompleto(inspectionId: string) {
  const [catalog, responses] = await Promise.all([
    getChecklistCatalog(),
    prisma.inspectionItemResponse.findMany({
      where: { inspectionId },
      select: { checklistItemId: true, valor: true },
    }),
  ]);

  const estadoPorItemId = new Map(responses.map((response) => [response.checklistItemId, response.valor]));

  return catalog.map((category) => ({
    ...category,
    items: category.items.map((item) => ({
      ...item,
      estado: (estadoPorItemId.get(item.id) ?? "PENDIENTE") as EstadoChecklistItem,
    })),
  }));
}

// La categoría "Documentación" (10 ítems: SOAT, cédula, carné, etc.) no usa
// la pantalla de ítem individual con foto — el dueño de producto la
// consideró innecesaria para documentos: se "chulean" todos juntos en la
// pantalla de lista (`/checklist`), con un link chico a la pantalla de
// novedad para reportar el que falte o esté vencido. Ver
// DocumentoCheckItem.tsx y ChecklistListPage.
export const CATEGORIA_SIN_PANTALLA_PROPIA = "Documentación";

/**
 * Siguiente ChecklistItem sin responder (en orden de catálogo), con el
 * nombre de su categoría, o `null` si ya están todos respondidos. Se usa
 * para guiar al trabajador paso a paso por el checklist.
 */
async function getNextUnansweredItem(
  inspectionId: string,
): Promise<{ id: string; categoryNombre: string } | null> {
  const categories = await getChecklistCatalog();
  const responses = await prisma.inspectionItemResponse.findMany({
    where: { inspectionId },
    select: { checklistItemId: true },
  });
  const respondedIds = new Set(responses.map((response) => response.checklistItemId));

  for (const category of categories) {
    for (const item of category.items) {
      if (!respondedIds.has(item.id)) {
        return { id: item.id, categoryNombre: category.nombre };
      }
    }
  }

  return null;
}

/**
 * Ítem anterior y siguiente, dentro de la misma categoría del ítem dado (en
 * el orden de catálogo por `orden`). Se usa para la navegación libre
 * "← Anterior" / "Siguiente →" de la pantalla de ítem individual, que solo
 * aplica a "Inspección Visual" — es independiente del flujo guiado
 * (`getNextStepPath`): permite revisar ítems ya respondidos o saltar a los
 * pendientes sin perder lo ya guardado. `null` en el primer/último ítem de
 * la categoría.
 */
export async function getAdjacentChecklistItemIds(
  itemId: string,
): Promise<{ previousItemId: string | null; nextItemId: string | null }> {
  const categories = await getChecklistCatalog();
  const category = categories.find((cat) => cat.items.some((item) => item.id === itemId));
  if (!category) {
    return { previousItemId: null, nextItemId: null };
  }
  const ids = category.items.map((item) => item.id);
  const index = ids.indexOf(itemId);
  return {
    previousItemId: index > 0 ? ids[index - 1] : null,
    nextItemId: index < ids.length - 1 ? ids[index + 1] : null,
  };
}

/**
 * Inspección con sus relaciones necesarias para la UI del flujo del
 * trabajador (vehículo, conductor, respuestas + novedad + fotos, ítem del
 * checklist). Se incluye `conductor` para poder mostrar en la pantalla de
 * confirmar los datos de vigencia del pase (formato oficial FO-SVS-23).
 */
export function getInspectionForWorker(inspectionId: string) {
  return prisma.inspection.findUnique({
    where: { id: inspectionId },
    include: {
      vehicle: true,
      conductor: true,
      // Nullable hasta que la revise un supervisor (`supervisorId` es null
      // mientras EN_PROCESO) — se agrega acá para que
      // app/(worker)/inspecciones/[id]/enviada/page.tsx pueda mostrar la
      // cédula del supervisor junto a su firma, sin otra query.
      supervisor: true,
      respuestas: {
        include: {
          checklistItem: { include: { category: true } },
          novedad: { include: { photos: true } },
        },
      },
    },
  });
}

export function getVehiculosActivos() {
  return prisma.vehicle.findMany({
    where: { activo: true },
    orderBy: { placa: "asc" },
  });
}

/**
 * Inspecciones EN_PROCESO del trabajador (para poder retomarlas en vez de
 * arrancar una nueva sobre el mismo vehículo).
 */
export function getInspeccionesEnProcesoDelTrabajador(workerId: string) {
  return prisma.inspection.findMany({
    where: { workerId, status: InspectionStatus.EN_PROCESO },
    include: { vehicle: true },
    orderBy: { startedAt: "desc" },
  });
}

export function getNovedadForWorker(novedadId: string) {
  return prisma.novedad.findUnique({
    where: { id: novedadId },
    include: {
      inspection: true,
      photos: { orderBy: { createdAt: "asc" } },
      inspectionItemResponse: { include: { checklistItem: true } },
    },
  });
}

export function getChecklistItemById(id: string) {
  return prisma.checklistItem.findUnique({
    where: { id },
    include: { category: true },
  });
}

/**
 * Firmas manuscritas (Fase D) de una inspección, con URL de lectura firmada
 * on-demand (mismo patrón que las fotos de novedad, ver
 * lib/storage/s3.ts) — nunca se persiste esa URL. Compartida entre el
 * flujo del trabajador y el del supervisor: ambos necesitan mostrar
 * evidencia de ambas firmas (conductor y supervisor) con su fecha/hora.
 */
export async function getFirmasInspeccion(inspectionId: string) {
  const firmas = await prisma.firma.findMany({ where: { inspectionId } });
  const conUrl = await Promise.all(
    firmas.map(async (firma) => ({ ...firma, url: await getSignedReadUrl(firma.s3Key) })),
  );
  return {
    conductor: conUrl.find((firma) => firma.tipo === TipoFirma.CONDUCTOR) ?? null,
    supervisor: conUrl.find((firma) => firma.tipo === TipoFirma.SUPERVISOR) ?? null,
  };
}

/**
 * Defensa en profundidad a nivel de dato: el proxy (proxy.ts) solo filtra
 * por rol a nivel de ruta, nunca sabe de quién es cada inspección. Todas las
 * páginas del flujo del trabajador deben validar acá que la inspección le
 * pertenece antes de mostrar cualquier dato — si no, usa `notFound()` (no
 * revela si el id existe o no).
 */
export async function getOwnInspectionOrNotFound(inspectionId: string, workerId: string) {
  const inspection = await getInspectionForWorker(inspectionId);
  if (!inspection || inspection.workerId !== workerId) {
    notFound();
  }
  return inspection;
}

/**
 * Única fuente de verdad de "cuál es el siguiente paso" del flujo guiado.
 * La usan tanto la página router (`/inspecciones/[id]`) como los wrappers
 * de servidor de cada paso, para no duplicar la lógica de navegación.
 */
export async function getNextStepPath(inspectionId: string): Promise<string> {
  const inspection = await prisma.inspection.findUnique({ where: { id: inspectionId } });
  if (!inspection) {
    notFound();
  }

  const base = `/inspecciones/${inspectionId}`;

  // Cancelada: no hay ningún paso siguiente sensato (nunca se envió, no hay
  // nada que aprobar) — vuelve al punto de entrada del trabajador en vez de
  // caer en /enviada, que asume que la inspección efectivamente se mandó.
  if (inspection.status === InspectionStatus.CANCELADA) {
    return "/inspecciones";
  }
  if (inspection.status !== InspectionStatus.EN_PROCESO) {
    return `${base}/enviada`;
  }
  if (inspection.kilometraje === null) {
    return `${base}/medidas`;
  }

  const nextItem = await getNextUnansweredItem(inspectionId);
  if (nextItem) {
    return nextItem.categoryNombre === CATEGORIA_SIN_PANTALLA_PROPIA
      ? `${base}/checklist`
      : `${base}/checklist/${nextItem.id}`;
  }
  if (inspection.puedeOperar === null) {
    return `${base}/resultado`;
  }
  return `${base}/confirmar`;
}
