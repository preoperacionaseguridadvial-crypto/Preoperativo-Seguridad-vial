import Link from "next/link";
import type { RespuestaChecklist } from "@/generated/prisma/client";
import { ANILLO_ACTUAL, RespuestaActual } from "@/app/(worker)/inspecciones/_components/RespuestaActual";

/**
 * Control para ítems de fluidos (`tipoRespuesta = TRIESTADO`, fase
 * soporte-moto-carro Slice 2, A2) — equivalente a `RespuestaChecklistItem`
 * pero con Bueno/Bajo en vez de OK/Falla.
 *
 * Desde 2026-10-19 (pedido del dueño de producto) "Bajo" reemplaza a "Malo"
 * en el flujo de novedad: manda a la misma pantalla de novedad que "Falla"
 * usa para ítems binarios (pide descripción + tipo antes de guardar), que
 * resuelve el valor según `item.tipoRespuesta` (ver
 * app/(worker)/inspecciones/[id]/checklist/[itemId]/novedad/page.tsx).
 */
export function RespuestaTriestadoItem({
  idInspeccion,
  itemId,
  marcarBueno,
  valorActual,
}: {
  idInspeccion: string;
  itemId: string;
  marcarBueno: () => Promise<void>;
  /** Respuesta ya guardada (al volver a corregirla): se resalta su botón. */
  valorActual?: RespuestaChecklist;
}) {
  return (
    <div className="flex flex-col gap-3">
      <RespuestaActual valorActual={valorActual} />
      <form action={marcarBueno}>
        <button
          type="submit"
          className={`w-full rounded-[10px] bg-[#16A34A] px-4 py-5 text-lg font-semibold text-white hover:bg-[#15803D]${valorActual === "BUENO" ? ANILLO_ACTUAL : ""}`}
        >
          ✓ Bueno
        </button>
      </form>

      <Link
        href={`/inspecciones/${idInspeccion}/checklist/${itemId}/novedad`}
        className={`block w-full rounded-[10px] bg-[#D97706] px-4 py-5 text-center text-lg font-semibold text-white hover:bg-[#B45309]${valorActual === "BAJO" ? ANILLO_ACTUAL : ""}`}
      >
        ⚠ Bajo
      </Link>
    </div>
  );
}
