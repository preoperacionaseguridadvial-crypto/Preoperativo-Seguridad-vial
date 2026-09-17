import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth/config";
import { RespuestaChecklist } from "@/generated/prisma/client";
import type { TipoNovedad } from "@/generated/prisma/client";
import {
  getOwnInspectionOrNotFound,
  getNextStepPath,
  getChecklistEstadoCompleto,
  CATEGORIA_SIN_PANTALLA_PROPIA,
  type EstadoChecklistItem,
} from "@/lib/inspections/queries";
import { responderItem } from "@/lib/inspections/actions";
import { DocumentoCheckItem } from "@/app/(worker)/inspecciones/_components/DocumentoCheckItem";
import { ProgresoInspeccion } from "@/app/(worker)/inspecciones/_components/ProgresoInspeccion";

// Pantalla de lista: agrupa el catálogo por categoría y muestra el estado
// de cada ítem (✓ OK / 🔴 falla / ○ pendiente — formato binario FO-SVS-23,
// sin N/A). "Inspección Visual" navega a la pantalla de ítem individual
// (con foto de referencia); "Documentación" (CATEGORIA_SIN_PANTALLA_PROPIA)
// se marca acá mismo con un check por documento — el dueño de producto no
// quería una pantalla por documento para los 10 ítems del formato. Cuando
// no queda nada pendiente, esta pantalla es también el punto donde el
// flujo guiado (`getNextStepPath`) deja al trabajador para que termine de
// tildar documentos antes de seguir a "Resultado". Reemplaza a la guía
// visual interactiva de la moto (rechazada por el dueño de producto por
// saturar la interfaz) manteniendo el mismo estilo de barra de progreso
// que ya se usaba.
const ESTADO_ICONO: Record<EstadoChecklistItem, { icon: string; className: string; texto: string }> = {
  OK: { icon: "✓", className: "text-green-600", texto: "OK" },
  FALLA: { icon: "🔴", className: "", texto: "Falla" },
  PENDIENTE: { icon: "○", className: "text-gray-400", texto: "Pendiente" },
};

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
  const conformes = allItems.filter((item) => item.estado === "OK").length;
  const noConformes = allItems.filter((item) => item.estado === "FALLA").length;
  const pendientes = allItems.filter((item) => item.estado === "PENDIENTE").length;
  const revisados = totalItems - pendientes;

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
        {catalogConEstado.map((category) => {
          const esDocumentacion = category.nombre === CATEGORIA_SIN_PANTALLA_PROPIA;
          // Una vez que una categoría queda completa (sin ítems PENDIENTE),
          // deja de mostrarse en la lista — pedido del dueño de producto:
          // al pasar a Documentos no hace falta seguir viendo "Inspección
          // Visual" ya resuelta. Se revisa por categoría (no hardcodeado a
          // "Inspección Visual") para no atarlo a un nombre puntual.
          const categoriaCompleta = category.items.every((item) => item.estado !== "PENDIENTE");
          if (categoriaCompleta) {
            return null;
          }
          return (
          <section key={category.id}>
            {esDocumentacion ? (
              <div className="mb-2">
                <h2 className="text-sm font-semibold text-[#0B3B60]">Documentos</h2>
                <p className="text-xs text-gray-500">
                  Usted porta los siguientes elementos con usted antes de empezar el recorrido.
                </p>
              </div>
            ) : (
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                {category.nombre}
              </h2>
            )}
            <div className="flex flex-col divide-y divide-gray-100 overflow-hidden rounded-lg border border-gray-200 bg-white">
              {esDocumentacion
                ? category.items.map((item) => (
                    <DocumentoCheckItem
                      key={item.id}
                      inspectionId={id}
                      itemId={item.id}
                      nombre={item.nombre}
                      estadoInicial={item.estado}
                      reportarProblema={reportarProblemaDocumento.bind(null, item.id)}
                    />
                  ))
                : category.items.map((item) => {
                    const estilo = ESTADO_ICONO[item.estado];
                    return (
                      <Link
                        key={item.id}
                        href={`/inspecciones/${id}/checklist/${item.id}`}
                        className="flex items-center gap-3 px-4 py-3 active:bg-gray-50"
                      >
                        <span className={`text-lg ${estilo.className}`} aria-hidden="true">
                          {estilo.icon}
                        </span>
                        <span className="flex-1">
                          <span className="block text-sm font-medium text-[#0B3B60]">{item.nombre}</span>
                          <span className="block text-xs text-gray-500">{estilo.texto}</span>
                        </span>
                        <span className="text-gray-300" aria-hidden="true">
                          ›
                        </span>
                      </Link>
                    );
                  })}
            </div>
          </section>
          );
        })}
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
