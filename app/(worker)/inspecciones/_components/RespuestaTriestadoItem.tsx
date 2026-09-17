import Link from "next/link";

/**
 * Control de 3 estados para ítems de fluidos (`tipoRespuesta = TRIESTADO`,
 * fase soporte-moto-carro Slice 2, A2) — equivalente a
 * `RespuestaChecklistItem` pero con Bueno/Bajo/Malo en vez de OK/Falla.
 *
 * "Bajo" es un botón propio (ámbar), no un caso de "Malo": se guarda directo
 * sin pedir observación ni tipo de novedad (no crea Novedad, decisión
 * confirmada — ver lib/inspections/respuesta.ts `esNovedad`). "Malo" manda
 * a la misma pantalla de novedad que "Falla" usa para ítems binarios (pide
 * descripción + tipo antes de guardar), server component la resuelve según
 * `item.tipoRespuesta` (ver app/(worker)/inspecciones/[id]/checklist/[itemId]/novedad/page.tsx).
 */
export function RespuestaTriestadoItem({
  idInspeccion,
  itemId,
  marcarBueno,
  marcarBajo,
}: {
  idInspeccion: string;
  itemId: string;
  marcarBueno: () => Promise<void>;
  marcarBajo: () => Promise<void>;
}) {
  return (
    <div className="flex flex-col gap-3">
      <form action={marcarBueno}>
        <button
          type="submit"
          className="w-full rounded-[10px] bg-[#16A34A] px-4 py-5 text-lg font-semibold text-white hover:bg-[#15803D]"
        >
          ✓ Bueno
        </button>
      </form>

      <form action={marcarBajo}>
        <button
          type="submit"
          className="w-full rounded-[10px] bg-[#D97706] px-4 py-5 text-lg font-semibold text-white hover:bg-[#B45309]"
        >
          ⚠ Bajo
        </button>
      </form>

      <Link
        href={`/inspecciones/${idInspeccion}/checklist/${itemId}/novedad`}
        className="block w-full rounded-[10px] bg-[#DC2626] px-4 py-5 text-center text-lg font-semibold text-white hover:bg-[#B91C1C]"
      >
        ✕ Malo
      </Link>
    </div>
  );
}
