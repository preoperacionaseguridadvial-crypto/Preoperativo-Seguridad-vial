import "server-only";
import { RespuestaChecklist, TipoRespuestaItem } from "@/generated/prisma/client";

/**
 * Único lugar de verdad de "¿este valor de respuesta crea/mantiene una
 * Novedad?" (A2 del design de soporte-moto-carro). FALLA (binario) y BAJO
 * (triestado, ítems de fluidos) crean Novedad. Desde 2026-10-19 (pedido del
 * dueño de producto) BAJO reemplaza a MALO en el flujo de novedad; MALO se
 * mantiene acá solo para inspecciones históricas. Usado por `responderItem`
 * (lib/inspections/actions.ts) y, cuando corresponda, por la UI/PDF que
 * necesiten la misma regla.
 */
export function esNovedad(valor: RespuestaChecklist): boolean {
  return (
    valor === RespuestaChecklist.FALLA ||
    valor === RespuestaChecklist.BAJO ||
    valor === RespuestaChecklist.MALO
  );
}

/**
 * Valores válidos para un ítem según su `tipoRespuesta`. BINARIO conserva el
 * formato oficial FO-SVS-23 de siempre (OK/FALLA, sin N/A); TRIESTADO es
 * exclusivo de los ítems de fluidos — un ítem nunca acepta valores de ambos
 * conjuntos. Desde 2026-10-19 (pedido del dueño de producto) los fluidos solo
 * admiten BUENO/BAJO: MALO sigue en el enum únicamente para que las
 * inspecciones históricas que lo usaron se sigan leyendo y mostrando.
 */
export function valoresPermitidos(tipoRespuesta: TipoRespuestaItem): RespuestaChecklist[] {
  return tipoRespuesta === TipoRespuestaItem.TRIESTADO
    ? [RespuestaChecklist.BUENO, RespuestaChecklist.BAJO]
    : [RespuestaChecklist.OK, RespuestaChecklist.FALLA];
}

/**
 * Filtra un arreglo de respuestas a las que cuentan como "no conforme"
 * (mismo criterio que `esNovedad`: FALLA, BAJO o MALO). Único lugar de esta regla
 * para consumidores que necesitan la lista completa de respuestas en falla,
 * no solo el booleano — hoy la pantalla de confirmar
 * (app/(worker)/inspecciones/[id]/confirmar/page.tsx), donde el conductor ve
 * el resumen justo antes de firmar. Antes de esta función esa pantalla
 * filtraba `valor === "FALLA"` a mano y se perdía MALO (corrección Slice 2,
 * hallazgo CRITICAL #5) — de ahí que valga la pena tenerlo acá en vez de
 * como copia local de esa pantalla.
 */
export function filtrarNoConformes<T extends { valor: RespuestaChecklist }>(respuestas: T[]): T[] {
  return respuestas.filter((respuesta) => esNovedad(respuesta.valor));
}
