"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { RespuestaChecklist } from "@/generated/prisma/client";
import { responderItem } from "@/lib/inspections/actions";
import type { EstadoChecklistItem } from "@/lib/inspections/queries";
import { TIPOS_NOVEDAD_DOCUMENTO, TIPO_NOVEDAD_LABELS } from "@/lib/inspections/novedad-tipo";

/**
 * Fila de un documento (categoría "Documentación"): un check en vez de la
 * pantalla de ítem individual — pedido del dueño de producto, los 10
 * documentos se marcan juntos en una sola pantalla. Marcar el check llama
 * a `responderItem` directo (`"use server"` en actions.ts, invocable desde
 * cliente sin pasar por un <form>) y refresca la lista. No hay forma de
 * "destildar": si el documento falta o está vencido, "Reportar problema"
 * despliega un `<details>` inline con el formulario de novedad — no navega
 * a otra pantalla.
 *
 * Una vez resuelto (OK o FALLA), el checkbox y "Reportar problema"
 * desaparecen — reemplazados por un resumen de solo lectura, para que quede
 * claro que ese documento ya quedó cerrado y el trabajador pueda seguir.
 * Esto depende de que `estado` local se resincronice con `estadoInicial`
 * cuando cambia el prop: sin eso, después de "Guardar" en el formulario de
 * novedad, el servidor ya tiene el ítem en FALLA pero `useState(estadoInicial)`
 * no se reinicializa solo en un cambio de props (solo en el montaje) — el
 * checkbox seguía mostrándose como pendiente aunque la novedad ya estuviera
 * guardada. Se ajusta durante el render (comparando contra `estadoPrevio`),
 * no en un `useEffect` — es el patrón que recomienda React para "ajustar
 * estado cuando cambia un prop" sin un render extra en cascada.
 */
export function DocumentoCheckItem({
  inspectionId,
  itemId,
  nombre,
  estadoInicial,
  reportarProblema,
}: {
  inspectionId: string;
  itemId: string;
  nombre: string;
  estadoInicial: EstadoChecklistItem;
  reportarProblema: (formData: FormData) => Promise<void>;
}) {
  const router = useRouter();
  const [estado, setEstado] = useState(estadoInicial);
  const [estadoPrevio, setEstadoPrevio] = useState(estadoInicial);
  const [isPending, startTransition] = useTransition();

  if (estadoInicial !== estadoPrevio) {
    setEstado(estadoInicial);
    setEstadoPrevio(estadoInicial);
  }

  function marcarOk() {
    setEstado("OK");
    startTransition(async () => {
      await responderItem(inspectionId, itemId, "OK" as RespuestaChecklist);
      router.refresh();
    });
  }

  if (estado !== "PENDIENTE") {
    const esOk = estado === "OK";
    return (
      <div className="flex items-center gap-3 px-4 py-3">
        <span className={`text-lg ${esOk ? "text-green-600" : "text-red-600"}`} aria-hidden="true">
          {esOk ? "✓" : "🔴"}
        </span>
        <span className="flex-1">
          <span className="block text-sm font-medium text-[#0B3B60]">{nombre}</span>
          <span className={`block text-xs ${esOk ? "text-gray-500" : "text-red-600"}`}>
            {esOk ? "OK" : "Novedad reportada"}
          </span>
        </span>
      </div>
    );
  }

  return (
    <div className="px-4 py-3">
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          checked={false}
          disabled={isPending}
          onChange={(event) => {
            if (event.target.checked) marcarOk();
          }}
          aria-label={`${nombre}: marcar como presente`}
          className="h-5 w-5 shrink-0 rounded border-gray-300 text-[#2E9BD6] focus:ring-[#2E9BD6]"
        />
        <span className="flex-1">
          <span className="block text-sm font-medium text-[#0B3B60]">{nombre}</span>
          <span className="block text-xs text-gray-500">Pendiente</span>
        </span>
      </div>

      <details className="mt-2">
        <summary className="cursor-pointer text-xs font-medium text-red-600 underline">
          Reportar problema
        </summary>
        <form action={reportarProblema} className="mt-2 flex flex-col gap-2 rounded-md border border-gray-200 p-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Tipo de novedad</label>
            <select name="tipo" required className="w-full rounded-md border border-gray-300 px-2 py-2 text-sm">
              {TIPOS_NOVEDAD_DOCUMENTO.map((tipo) => (
                <option key={tipo} value={tipo}>
                  {TIPO_NOVEDAD_LABELS[tipo]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Describí qué encontraste</label>
            <textarea
              name="observacion"
              required
              minLength={3}
              rows={2}
              className="w-full rounded-md border border-gray-300 px-2 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            className="rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            Guardar
          </button>
        </form>
      </details>
    </div>
  );
}
