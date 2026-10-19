import type { RespuestaChecklist } from "@/generated/prisma/client";
import { ANILLO_ACTUAL, RespuestaActual } from "@/app/(worker)/inspecciones/_components/RespuestaActual";

/**
 * Control para ítems de fluidos (`tipoRespuesta = TRIESTADO`, fase
 * soporte-moto-carro Slice 2, A2) — equivalente a `RespuestaChecklistItem`
 * pero con Bueno/Bajo en vez de OK/Falla.
 *
 * "Bajo" se guarda directo sin pedir observación ni tipo de novedad (no crea
 * Novedad, decisión confirmada — ver lib/inspections/respuesta.ts
 * `esNovedad`). "Malo" se quitó el 2026-10-19 por pedido del dueño de
 * producto: los fluidos solo se marcan Bueno o Bajo (ver `valoresPermitidos`).
 */
export function RespuestaTriestadoItem({
  marcarBueno,
  marcarBajo,
  valorActual,
}: {
  marcarBueno: () => Promise<void>;
  marcarBajo: () => Promise<void>;
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

      <form action={marcarBajo}>
        <button
          type="submit"
          className={`w-full rounded-[10px] bg-[#D97706] px-4 py-5 text-lg font-semibold text-white hover:bg-[#B45309]${valorActual === "BAJO" ? ANILLO_ACTUAL : ""}`}
        >
          ⚠ Bajo
        </button>
      </form>
    </div>
  );
}
