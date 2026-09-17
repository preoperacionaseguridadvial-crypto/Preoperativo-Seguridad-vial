import "server-only";
import { RespuestaChecklist, TipoRespuestaItem } from "@/generated/prisma/client";

/**
 * Único lugar de verdad de "¿este valor de respuesta crea/mantiene una
 * Novedad?" (A2 del design de soporte-moto-carro). FALLA (binario) y MALO
 * (triestado, ítems de fluidos) sí crean Novedad; BAJO se registra como dato
 * queryable normal (badge de advertencia en la UI, ver ChecklistItemPage)
 * pero NO crea Novedad ni bloquea nada — decisión de negocio confirmada
 * explícitamente antes de implementar este slice (ver Open Questions del
 * design). Usado por `responderItem` (lib/inspections/actions.ts) y, cuando
 * corresponda, por la UI/PDF que necesiten la misma regla.
 */
export function esNovedad(valor: RespuestaChecklist): boolean {
  return valor === RespuestaChecklist.FALLA || valor === RespuestaChecklist.MALO;
}

/**
 * Valores válidos para un ítem según su `tipoRespuesta`. BINARIO conserva el
 * formato oficial FO-SVS-23 de siempre (OK/FALLA, sin N/A); TRIESTADO es
 * exclusivo de los ítems de fluidos (BUENO/BAJO/MALO) — un ítem nunca acepta
 * valores de ambos conjuntos.
 */
export function valoresPermitidos(tipoRespuesta: TipoRespuestaItem): RespuestaChecklist[] {
  return tipoRespuesta === TipoRespuestaItem.TRIESTADO
    ? [RespuestaChecklist.BUENO, RespuestaChecklist.BAJO, RespuestaChecklist.MALO]
    : [RespuestaChecklist.OK, RespuestaChecklist.FALLA];
}
