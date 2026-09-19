import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth/config";
import { RespuestaChecklist, TipoRespuestaItem } from "@/generated/prisma/client";
import type { TipoNovedad } from "@/generated/prisma/client";
import {
  getOwnInspectionOrNotFound,
  getNextStepPath,
  getChecklistItemById,
  getAdjacentChecklistItemIds,
  getChecklistEstadoCompleto,
} from "@/lib/inspections/queries";
import { responderItem } from "@/lib/inspections/actions";
import { imagenesDelItem } from "@/lib/inspections/imagenes";
import { GaleriaReferencia } from "@/app/(worker)/inspecciones/_components/GaleriaReferencia";
import { RespuestaChecklistItem } from "@/app/(worker)/inspecciones/_components/RespuestaChecklistItem";
import { RespuestaTriestadoItem } from "@/app/(worker)/inspecciones/_components/RespuestaTriestadoItem";
import { ProgresoInspeccion } from "@/app/(worker)/inspecciones/_components/ProgresoInspeccion";

// Un ítem por pantalla, botones grandes, poco texto: respuesta rápida
// binaria (✓ OK / ✕ FALLA-DAÑO-FALTANTE), formato oficial FO-SVS-23 — sin
// N/A. "FALLA" manda a la pantalla de novedad (requiere descripción antes
// de guardar la respuesta), igual que "No conforme" antes.
//
// Vuelve al concepto original de "una imagen por elemento": la guía visual
// interactiva de la moto completa con hotspots se probó y el dueño de
// producto la rechazó explícitamente por saturar la interfaz (ver
// MotoInteractiva.tsx en el historial de git, eliminado en esta reversión).
export default async function ChecklistItemPage({
  params,
}: {
  params: Promise<{ id: string; itemId: string }>;
}) {
  const { id, itemId } = await params;
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

  const item = await getChecklistItemById(itemId);
  if (!item) {
    notFound();
  }

  const { previousItemId, nextItemId } = await getAdjacentChecklistItemIds(id, itemId);

  // Mismo cálculo que la pantalla de lista (checklist/page.tsx) — misma
  // fuente de verdad (getChecklistEstadoCompleto), para que el progreso
  // nunca pueda desincronizarse entre las dos pantallas.
  const catalogConEstado = await getChecklistEstadoCompleto(id);
  const allItems = catalogConEstado.flatMap((category) => category.items);
  const totalItems = allItems.length;
  const conformes = allItems.filter((i) => i.estado === "OK" || i.estado === "BUENO").length;
  const noConformes = allItems.filter((i) => i.estado === "FALLA" || i.estado === "MALO").length;
  const pendientes = allItems.filter((i) => i.estado === "PENDIENTE").length;
  const revisados = totalItems - pendientes;

  /**
   * Marca el ítem como OK, sin pedir ubicación — ni siquiera para "Rayones":
   * si no hay falla no hay nada que ubicar (ver comentario en
   * lib/inspections/actions.ts).
   */
  async function marcarOk() {
    "use server";
    await responderItem(id, itemId, RespuestaChecklist.OK);
    redirect(await getNextStepPath(id));
  }

  /**
   * Solo se usa para ítems con `pideUbicacion`: el "¿Dónde?" ya capturado
   * en esta misma pantalla viaja como `Novedad.ubicacion` (Fase C, no se
   * pide el mismo dato dos veces en la pantalla de novedad genérica); el
   * `tipo` se elige acá mismo (ver RespuestaChecklistItem, subconjunto
   * RAYON/RAYON_FUERTE/ABOLLADURA/GOLPE_FUERTE — es el ítem de las
   * convenciones de dibujo del formato oficial). De ahí sigue al mismo
   * flujo de foto que usa la pantalla de novedad genérica. El resto de los
   * ítems usa el Link a la pantalla de novedad existente (pide su propia
   * descripción, tipo y ubicación) — ver RespuestaChecklistItem.
   */
  async function marcarFallaConUbicacion(formData: FormData) {
    "use server";
    const ubicacion = formData.get("ubicacion")?.toString();
    const tipo = formData.get("tipo")?.toString() as TipoNovedad;
    const { novedad } = await responderItem(id, itemId, RespuestaChecklist.FALLA, ubicacion, tipo);
    if (novedad) {
      redirect(`/inspecciones/${id}/novedades/${novedad.id}/foto`);
    }
    redirect(await getNextStepPath(id));
  }

  /**
   * Ítems de fluidos (`tipoRespuesta = TRIESTADO`, fase soporte-moto-carro
   * Slice 2, A2). "Bueno" y "Bajo" se guardan directo, sin pedir nada — BAJO
   * no crea Novedad ni bloquea el envío (decisión confirmada: solo dato
   * queryable con badge de advertencia, ver lib/inspections/respuesta.ts).
   * "Malo" usa el Link a la pantalla de novedad (RespuestaTriestadoItem),
   * igual que "Falla" para ítems binarios.
   */
  async function marcarBueno() {
    "use server";
    await responderItem(id, itemId, RespuestaChecklist.BUENO);
    redirect(await getNextStepPath(id));
  }

  async function marcarBajo() {
    "use server";
    await responderItem(id, itemId, RespuestaChecklist.BAJO);
    redirect(await getNextStepPath(id));
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 py-6">
      <ProgresoInspeccion
        revisados={revisados}
        total={totalItems}
        conformes={conformes}
        noConformes={noConformes}
        pendientes={pendientes}
      />

      <div className="flex flex-col gap-5 rounded-[14px] border border-[#D9E2EA] bg-white p-4 shadow-sm">
        <GaleriaReferencia
          srcs={imagenesDelItem(item, inspection.vehicle.tipoVehiculo)}
          alt={`Referencia visual: ${item.nombre}`}
        />

        <div>
          <p className="text-xs uppercase text-[#66788A]">{item.category.nombre}</p>
          <h1 className="text-2xl font-semibold text-[#17324D]">{item.nombre}</h1>
        </div>

        {item.tipoRespuesta === TipoRespuestaItem.TRIESTADO ? (
          <RespuestaTriestadoItem
            idInspeccion={id}
            itemId={itemId}
            marcarBueno={marcarBueno}
            marcarBajo={marcarBajo}
          />
        ) : (
          <RespuestaChecklistItem
            idInspeccion={id}
            itemId={itemId}
            pideUbicacion={item.pideUbicacion}
            marcarOk={marcarOk}
            marcarFallaConUbicacion={item.pideUbicacion ? marcarFallaConUbicacion : undefined}
          />
        )}
      </div>

      <div className="flex items-center justify-between gap-3">
        {previousItemId ? (
          <Link
            href={`/inspecciones/${id}/checklist/${previousItemId}`}
            className="flex-1 rounded-md border border-[#D9E2EA] bg-white px-4 py-3 text-center text-sm font-medium text-[#005B96] hover:bg-gray-50"
          >
            ← Anterior
          </Link>
        ) : (
          <span className="flex-1" />
        )}
        {nextItemId ? (
          <Link
            href={`/inspecciones/${id}/checklist/${nextItemId}`}
            className="flex-1 rounded-md border border-[#D9E2EA] bg-white px-4 py-3 text-center text-sm font-medium text-[#005B96] hover:bg-gray-50"
          >
            Siguiente →
          </Link>
        ) : (
          <span className="flex-1" />
        )}
      </div>
    </main>
  );
}
