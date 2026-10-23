import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth/config";
import { RespuestaChecklist, TipoRespuestaItem } from "@/generated/prisma/client";
import type { TipoNovedad } from "@/generated/prisma/client";
import {
  getOwnInspectionOrNotFound,
  getNextStepPath,
  getChecklistItemById,
  CATEGORIA_SIN_PANTALLA_PROPIA,
} from "@/lib/inspections/queries";
import { guardarNovedadConFoto } from "@/lib/inspections/actions";
import { BotonAtras } from "@/app/(worker)/inspecciones/_components/BotonAtras";
import {
  BotonGuardarNovedad,
  CampoFotoNovedad,
} from "@/app/(worker)/inspecciones/_components/CampoFotoNovedad";
import { getTiposNovedadParaItem, TIPO_NOVEDAD_LABELS } from "@/lib/inspections/novedad-tipo";
import { etiquetaRespuesta } from "@/lib/inspections/etiquetas-respuesta";

// Pantalla de novedad (sección 11 del brief): textarea obligatoria. La foto
// (opcional) se toma en esta misma pantalla: queda comprimida y en vista
// previa, y un único "Continuar" guarda la novedad y la adjunta
// (guardarNovedadConFoto). Si la novedad ya tenía foto (corrección) solo se
// muestra que está adjunta; una sola foto por novedad.
//
// Para la categoría "Documentación" (SOAT, licencia, etc.) esta pantalla se
// adapta: el tipo se acota a TIPOS_NOVEDAD_DOCUMENTO (vencido/dañado/no lo
// porta — ninguno de los tipos de daño de carrocería aplica) y se oculta
// "¿Dónde?", que no tiene sentido para un documento. Pedido del dueño de
// producto: reportar un problema con el SOAT mostraba opciones de
// rayón/abolladura, que confundían.
export default async function NovedadPage({
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
  const item = await getChecklistItemById(itemId);
  if (!item) {
    notFound();
  }

  const esDocumento = item.category.nombre === CATEGORIA_SIN_PANTALLA_PROPIA;
  const tiposDisponibles = getTiposNovedadParaItem(item);
  // Esta pantalla la comparten los ítems BINARIO (Falla) y TRIESTADO de
  // fluidos — mismo flujo de descripción + tipo + foto, distinto valor final
  // según el ítem. Desde 2026-10-19 (pedido del dueño de producto) "Bajo"
  // reemplaza a "Malo" en los fluidos. Ver RespuestaTriestadoItem.
  const esFluido = item.tipoRespuesta === TipoRespuestaItem.TRIESTADO;
  const valorNovedad = esFluido ? RespuestaChecklist.BAJO : RespuestaChecklist.FALLA;

  // Corrección: si el ítem ya tenía una novedad, el formulario abre con sus
  // datos. En ítems con `pideUbicacion` el "¿Dónde?" vive en `observacion`
  // (ver `responderItem`), pero esos ítems usan el formulario inline, no esta
  // pantalla; acá `observacion` es la descripción.
  const respuestaPrevia = inspection.respuestas.find((r) => r.checklistItemId === itemId);
  const novedadPrevia = respuestaPrevia?.novedad ?? null;
  const tieneFoto = (novedadPrevia?.photos.length ?? 0) > 0;

  // Los documentos se resuelven en la lista; el resto, en su pantalla de ítem.
  const hrefAtras = esDocumento
    ? `/inspecciones/${id}/checklist`
    : `/inspecciones/${id}/checklist/${itemId}`;

  async function guardarNovedad(formData: FormData) {
    "use server";
    const observacion = formData.get("observacion")?.toString() ?? "";
    const tipo = formData.get("tipo")?.toString() as TipoNovedad;
    const ubicacion = esDocumento ? "" : (formData.get("ubicacion")?.toString() ?? "");
    await guardarNovedadConFoto(
      id,
      itemId,
      valorNovedad,
      { observacion, tipo, ubicacion },
      formData,
    );
    redirect(await getNextStepPath(id));
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-8">
      <BotonAtras href={hrefAtras} />
      <div>
        <p className="text-xs uppercase text-gray-400">{item.category.nombre}</p>
        <h1 className="text-xl font-semibold text-[#0B3B60]">
          {item.nombre} — {etiquetaRespuesta(valorNovedad)}
        </h1>
        <p className="mt-1 text-sm text-gray-500">Describí qué encontraste.</p>
      </div>

      <form action={guardarNovedad} className="flex flex-col gap-4">
        <div>
          <p className="mb-1 block text-sm font-medium text-gray-700">Tipo de novedad</p>
          <div className="grid grid-cols-2 gap-2">
            {tiposDisponibles.map((tipo) => (
              <label key={tipo} className="cursor-pointer">
                <input
                  type="radio"
                  name="tipo"
                  value={tipo}
                  required
                  defaultChecked={novedadPrevia?.tipo === tipo}
                  className="peer sr-only"
                />
                <span className="block rounded-md border border-gray-300 px-3 py-3 text-center text-sm font-medium text-gray-700 peer-checked:border-[#2E9BD6] peer-checked:bg-[#2E9BD6]/10 peer-checked:text-[#0B3B60]">
                  {TIPO_NOVEDAD_LABELS[tipo]}
                </span>
              </label>
            ))}
          </div>
        </div>

        <textarea
          name="observacion"
          required
          defaultValue={respuestaPrevia?.observacion ?? ""}
          minLength={3}
          rows={6}
          placeholder={esDocumento ? "Ej: SOAT vencido desde marzo." : "Ej: espejo derecho roto, no refleja."}
          className="w-full rounded-md border border-gray-300 px-3 py-3 text-base focus:border-[#2E9BD6] focus:outline-none"
        />

        {!esDocumento && (
          <div>
            <label htmlFor="ubicacion" className="mb-1 block text-sm font-medium text-gray-700">
              ¿Dónde? (opcional)
            </label>
            <input
              id="ubicacion"
              name="ubicacion"
              defaultValue={novedadPrevia?.ubicacion ?? ""}
              placeholder="Ej: tanque, lado derecho."
              className="w-full rounded-md border border-gray-300 px-3 py-3 text-base focus:border-[#2E9BD6] focus:outline-none"
            />
          </div>
        )}

        {tieneFoto ? (
          <p className="rounded-md border border-green-200 bg-green-50 px-3 py-3 text-sm font-medium text-green-800">
            ✓ Foto adjuntada
          </p>
        ) : (
          <CampoFotoNovedad />
        )}

        <BotonGuardarNovedad />
      </form>
    </main>
  );
}
