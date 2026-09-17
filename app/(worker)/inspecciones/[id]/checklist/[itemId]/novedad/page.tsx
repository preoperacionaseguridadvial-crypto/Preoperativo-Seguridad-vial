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
import { responderItem } from "@/lib/inspections/actions";
import { getTiposNovedadParaItem, TIPO_NOVEDAD_LABELS } from "@/lib/inspections/novedad-tipo";

// Pantalla de novedad (sección 11 del brief): textarea obligatoria. La foto
// se toma en el siguiente paso, una vez que la Novedad ya existe en base de
// datos (subirFotoNovedad necesita un novedadId).
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

  await getOwnInspectionOrNotFound(id, session.user.id);
  const item = await getChecklistItemById(itemId);
  if (!item) {
    notFound();
  }

  const esDocumento = item.category.nombre === CATEGORIA_SIN_PANTALLA_PROPIA;
  const tiposDisponibles = getTiposNovedadParaItem(item);
  // Fase soporte-moto-carro (Slice 2, A2): esta pantalla la comparten los
  // ítems BINARIO (Falla) y TRIESTADO de fluidos (Malo) — mismo flujo de
  // descripción + tipo + foto, distinto valor final según el ítem. Ver
  // RespuestaTriestadoItem, que enlaza acá para "✕ Malo".
  const esFluido = item.tipoRespuesta === TipoRespuestaItem.TRIESTADO;
  const valorNovedad = esFluido ? RespuestaChecklist.MALO : RespuestaChecklist.FALLA;

  async function guardarNovedad(formData: FormData) {
    "use server";
    const observacion = formData.get("observacion")?.toString() ?? "";
    const tipo = formData.get("tipo")?.toString() as TipoNovedad;
    const ubicacion = esDocumento ? "" : (formData.get("ubicacion")?.toString() ?? "");
    const { novedad } = await responderItem(id, itemId, valorNovedad, observacion, tipo, ubicacion);
    if (novedad) {
      redirect(`/inspecciones/${id}/novedades/${novedad.id}/foto`);
    }
    redirect(await getNextStepPath(id));
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-8">
      <div>
        <p className="text-xs uppercase text-gray-400">{item.category.nombre}</p>
        <h1 className="text-xl font-semibold text-[#0B3B60]">
          {item.nombre} — {esFluido ? "Malo" : "Falla"}
        </h1>
        <p className="mt-1 text-sm text-gray-500">Describí qué encontraste.</p>
      </div>

      <form action={guardarNovedad} className="flex flex-col gap-4">
        <div>
          <p className="mb-1 block text-sm font-medium text-gray-700">Tipo de novedad</p>
          <div className="grid grid-cols-2 gap-2">
            {tiposDisponibles.map((tipo) => (
              <label key={tipo} className="cursor-pointer">
                <input type="radio" name="tipo" value={tipo} required className="peer sr-only" />
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
              placeholder="Ej: tanque, lado derecho."
              className="w-full rounded-md border border-gray-300 px-3 py-3 text-base focus:border-[#2E9BD6] focus:outline-none"
            />
          </div>
        )}

        <button
          type="submit"
          className="w-full rounded-md bg-[#0B3B60] px-4 py-4 text-base font-semibold text-white hover:bg-[#0B3B60]/90"
        >
          Continuar
        </button>
      </form>
    </main>
  );
}
