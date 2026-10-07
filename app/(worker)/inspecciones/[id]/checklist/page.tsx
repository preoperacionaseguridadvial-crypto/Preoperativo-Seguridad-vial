import { redirect } from "next/navigation";
import Link from "next/link";
import { refresh } from "next/cache";
import { auth } from "@/lib/auth/config";
import { RespuestaChecklist } from "@/generated/prisma/client";
import type { TipoNovedad } from "@/generated/prisma/client";
import {
  getOwnInspectionOrNotFound,
  getNextStepPath,
  getPreviousStepPath,
  getChecklistEstadoCompleto,
  categoriasParaLista,
} from "@/lib/inspections/queries";
import { responderItem } from "@/lib/inspections/actions";
import { BotonAtras } from "@/app/(worker)/inspecciones/_components/BotonAtras";
import { DocumentoCheckItem } from "@/app/(worker)/inspecciones/_components/DocumentoCheckItem";
import { ProgresoInspeccion } from "@/app/(worker)/inspecciones/_components/ProgresoInspeccion";

// Pantalla de lista de Documentación: los documentos (SOAT, cédula, etc.) no
// tienen pantalla por ítem (el dueño de producto no quería una pantalla por
// documento), así que se marcan acá mismo con un check por documento. El resto
// del checklist (Inspección Visual, Fluidos, Equipo de prevención) NO se lista
// acá: se recorre ítem por ítem con el flujo guiado (`getNextStepPath`), que es
// lo que esta pantalla deja seguir cuando no queda ningún documento pendiente.
// Reemplaza a la guía visual interactiva de la moto (rechazada por el dueño de
// producto por saturar la interfaz) manteniendo la misma barra de progreso.

export default async function ChecklistListPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const inspection = await getOwnInspectionOrNotFound(id, session.user.id);
  if (inspection.status !== "EN_PROCESO") {
    redirect(await getNextStepPath(id));
  }
  if (inspection.kilometraje === null) {
    redirect(`/inspecciones/${id}/medidas`);
  }

  const catalogConEstado = await getChecklistEstadoCompleto(id);
  const allItems = catalogConEstado.flatMap((category) => category.items);
  const totalItems = allItems.length;
  const conformes = allItems.filter((item) => item.estado === "OK" || item.estado === "BUENO").length;
  const noConformes = allItems.filter((item) => item.estado === "FALLA" || item.estado === "MALO").length;
  const pendientes = allItems.filter((item) => item.estado === "PENDIENTE").length;
  const revisados = totalItems - pendientes;

  // La lista se muestra siempre (EN_PROCESO), aun sin documentos pendientes:
  // el trabajador puede llegar acá con "Atrás" para corregir un documento ya
  // resuelto. Antes redirigía al siguiente ítem cuando no quedaba nada
  // pendiente, lo que bloqueaba volver. Si no hay documentos en el catálogo,
  // no hay nada que mostrar y se sigue el flujo guiado.
  const categoriasVisibles = categoriasParaLista(catalogConEstado);
  if (categoriasVisibles.length === 0) {
    redirect(await getNextStepPath(id));
  }
  const documentosPendientes = categoriasVisibles
    .flatMap((category) => category.items)
    .filter((item) => item.estado === "PENDIENTE").length;
  const hrefAtras = (await getPreviousStepPath(id, "checklist")) ?? `/inspecciones/${id}/medidas`;

  // Reporte inline de un documento (sin navegar a otra pantalla): se
  // bindea con el `checklistItemId` de cada fila al pasarlo a
  // `DocumentoCheckItem` más abajo. Una Server Action NO re-renderiza la
  // ruta por sí sola: sin `refresh()` la novedad quedaba guardada pero la
  // pantalla seguía mostrando el documento como pendiente (el trabajador
  // pensaba que "Guardar" no hacía nada). `refresh()` (next/cache) refresca
  // el router del cliente y la fila vuelve con el ítem ya resuelto.
  async function reportarProblemaDocumento(checklistItemId: string, formData: FormData) {
    "use server";
    const tipo = formData.get("tipo")?.toString() as TipoNovedad;
    const observacion = formData.get("observacion")?.toString() ?? "";
    await responderItem(id, checklistItemId, RespuestaChecklist.FALLA, observacion, tipo);
    refresh();
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 py-6">
      <BotonAtras href={hrefAtras} />
      <div>
        <p className="text-xs uppercase text-gray-400">{inspection.vehicle.placa}</p>
        <h1 className="text-xl font-semibold text-[#0B3B60]">Checklist de inspección</h1>
      </div>

      <ProgresoInspeccion
        revisados={revisados}
        total={totalItems}
        conformes={conformes}
        noConformes={noConformes}
        pendientes={pendientes}
      />

      <div className="flex flex-col gap-5">
        {categoriasVisibles.map((category) => (
          <section key={category.id}>
            <div className="mb-2">
              <h2 className="text-sm font-semibold text-[#0B3B60]">Documentos</h2>
              <p className="text-xs text-gray-500">
                Usted porta los siguientes elementos con usted antes de empezar el recorrido.
              </p>
            </div>
            <div className="flex flex-col divide-y divide-gray-100 overflow-hidden rounded-lg border border-gray-200 bg-white">
              {category.items.map((item) => (
                <DocumentoCheckItem
                  key={item.id}
                  inspectionId={id}
                  itemId={item.id}
                  nombre={item.nombre}
                  estadoInicial={item.estado}
                  reportarProblema={reportarProblemaDocumento.bind(null, item.id)}
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      {documentosPendientes === 0 && <ContinuarLink inspectionId={id} />}
    </main>
  );
}

async function ContinuarLink({ inspectionId }: { inspectionId: string }) {
  const next = await getNextStepPath(inspectionId);
  return (
    <Link
      href={next}
      className="block w-full rounded-md bg-[#0B3B60] px-4 py-4 text-center text-base font-semibold text-white hover:bg-[#0B3B60]/90"
    >
      Continuar
    </Link>
  );
}
