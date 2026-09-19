import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth/config";
import { RespuestaChecklist } from "@/generated/prisma/client";
import type { TipoNovedad } from "@/generated/prisma/client";
import {
  getOwnInspectionOrNotFound,
  getNextStepPath,
  getChecklistEstadoCompleto,
  categoriasParaLista,
} from "@/lib/inspections/queries";
import { responderItem } from "@/lib/inspections/actions";
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

  // Sin documentos pendientes esta lista no tiene nada que mostrar: si aún
  // quedan ítems, se sigue el flujo guiado (siguiente ítem, uno por uno).
  const categoriasVisibles = categoriasParaLista(catalogConEstado);
  if (categoriasVisibles.length === 0 && pendientes > 0) {
    redirect(await getNextStepPath(id));
  }

  // Reporte inline de un documento (sin navegar a otra pantalla): se
  // bindea con el `checklistItemId` de cada fila al pasarlo a
  // `DocumentoCheckItem` más abajo. Al no llamar `redirect`, Next.js
  // revalida esta misma ruta y el `<details>` que la disparó vuelve a
  // renderizar con el ítem ya resuelto.
  async function reportarProblemaDocumento(checklistItemId: string, formData: FormData) {
    "use server";
    const tipo = formData.get("tipo")?.toString() as TipoNovedad;
    const observacion = formData.get("observacion")?.toString() ?? "";
    await responderItem(id, checklistItemId, RespuestaChecklist.FALLA, observacion, tipo);
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 py-6">
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

      {pendientes === 0 && <ContinuarLink inspectionId={id} />}
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
