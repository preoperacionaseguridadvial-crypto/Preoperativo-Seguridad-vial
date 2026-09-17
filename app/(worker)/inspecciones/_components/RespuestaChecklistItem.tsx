"use client";

import { useState } from "react";
import Link from "next/link";
import type { TipoNovedad } from "@/generated/prisma/client";
import { TIPOS_NOVEDAD_CARROCERIA, TIPO_NOVEDAD_LABELS } from "@/lib/inspections/novedad-tipo";

/**
 * Botones de respuesta de la pantalla de ítem (✓ OK / ✕ FALLA). Para ítems
 * sin `pideUbicacion`, es solo un form + un Link (FALLA manda a la
 * pantalla de novedad existente, que pide su propia descripción).
 *
 * Para el ítem con `pideUbicacion` (hoy: "Rayones"), OK es directo, sin
 * pedir nada — si no hay falla no hay nada que ubicar (feedback del dueño
 * de producto: pedir "¿Dónde?" para marcar OK se leía como si el sistema ya
 * diera por hecho que la moto está rayada). El campo "¿Dónde?" + el
 * selector de tipo (acotado a daños de carrocería) solo aparecen después de
 * tocar FALLA, como un segundo paso inline en vez de navegar a la pantalla
 * de novedad genérica — por eso vive como state de este client component.
 */
export function RespuestaChecklistItem({
  idInspeccion,
  itemId,
  pideUbicacion,
  marcarOk,
  marcarFallaConUbicacion,
}: {
  idInspeccion: string;
  itemId: string;
  pideUbicacion: boolean;
  marcarOk: () => Promise<void>;
  marcarFallaConUbicacion?: (formData: FormData) => Promise<void>;
}) {
  const [mostrarFormularioFalla, setMostrarFormularioFalla] = useState(false);
  const [ubicacion, setUbicacion] = useState("");
  const [tipo, setTipo] = useState<TipoNovedad | "">("");

  if (!pideUbicacion || !marcarFallaConUbicacion) {
    return (
      <div className="flex flex-col gap-3">
        <form action={marcarOk}>
          <button
            type="submit"
            className="w-full rounded-[10px] bg-[#16A34A] px-4 py-5 text-lg font-semibold text-white hover:bg-[#15803D]"
          >
            ✓ OK
          </button>
        </form>

        <Link
          href={`/inspecciones/${idInspeccion}/checklist/${itemId}/novedad`}
          className="block w-full rounded-[10px] bg-[#DC2626] px-4 py-5 text-center text-lg font-semibold text-white hover:bg-[#B91C1C]"
        >
          ✕ FALLA / DAÑO / FALTANTE
        </Link>
      </div>
    );
  }

  if (!mostrarFormularioFalla) {
    return (
      <div className="flex flex-col gap-3">
        <form action={marcarOk}>
          <button
            type="submit"
            className="w-full rounded-[10px] bg-[#16A34A] px-4 py-5 text-lg font-semibold text-white hover:bg-[#15803D]"
          >
            ✓ OK
          </button>
        </form>

        <button
          type="button"
          onClick={() => setMostrarFormularioFalla(true)}
          className="w-full rounded-[10px] bg-[#DC2626] px-4 py-5 text-lg font-semibold text-white hover:bg-[#B91C1C]"
        >
          ✕ FALLA / DAÑO / FALTANTE
        </button>
      </div>
    );
  }

  const ubicacionValida = ubicacion.trim().length >= 2;
  const puedeMarcarFalla = ubicacionValida && tipo !== "";

  return (
    <div className="flex flex-col gap-3">
      <div>
        <label htmlFor="ubicacion" className="mb-1 block text-sm font-medium text-gray-700">
          ¿Dónde?
        </label>
        <input
          id="ubicacion"
          value={ubicacion}
          onChange={(event) => setUbicacion(event.target.value)}
          placeholder="Ej: tanque, lado derecho."
          className="w-full rounded-md border border-[#D9E2EA] px-3 py-3 text-base focus:border-[#005B96] focus:outline-none"
        />
      </div>

      <div>
        <p className="mb-1 block text-sm font-medium text-gray-700">Tipo</p>
        <div className="grid grid-cols-2 gap-2">
          {TIPOS_NOVEDAD_CARROCERIA.map((valorTipo) => (
            <button
              key={valorTipo}
              type="button"
              onClick={() => setTipo(valorTipo)}
              className={`rounded-md border px-3 py-3 text-center text-sm font-medium ${
                tipo === valorTipo
                  ? "border-[#005B96] bg-[#005B96]/10 text-[#17324D]"
                  : "border-[#D9E2EA] text-[#17324D]"
              }`}
            >
              {TIPO_NOVEDAD_LABELS[valorTipo]}
            </button>
          ))}
        </div>
      </div>

      <form action={marcarFallaConUbicacion}>
        <input type="hidden" name="ubicacion" value={ubicacion} />
        <input type="hidden" name="tipo" value={tipo} />
        <button
          type="submit"
          disabled={!puedeMarcarFalla}
          className="w-full rounded-[10px] bg-[#DC2626] px-4 py-5 text-lg font-semibold text-white hover:bg-[#B91C1C] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Confirmar ✕ FALLA / DAÑO / FALTANTE
        </button>
      </form>

      <button
        type="button"
        onClick={() => setMostrarFormularioFalla(false)}
        className="w-full text-center text-sm font-medium text-gray-500 underline"
      >
        Cancelar, la moto está OK
      </button>

      {!ubicacionValida && (
        <p className="text-xs text-gray-500">Completá &quot;¿Dónde?&quot; antes de confirmar.</p>
      )}
      {ubicacionValida && tipo === "" && (
        <p className="text-xs text-gray-500">Elegí el tipo antes de confirmar.</p>
      )}
    </div>
  );
}
