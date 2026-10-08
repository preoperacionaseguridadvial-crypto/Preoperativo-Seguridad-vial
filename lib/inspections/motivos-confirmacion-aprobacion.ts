import "server-only";
import type { RespuestaChecklist, TipoNovedad } from "@/generated/prisma/client";
import { esNovedad } from "@/lib/inspections/respuesta";
import { TIPO_NOVEDAD_LABELS } from "@/lib/inspections/novedad-tipo";

/**
 * Forma mínima de inspección que necesita `motivosConfirmacionAprobacion`.
 * Es estructural a propósito: la pantalla del supervisor
 * (`getInspeccionDetalleOrNotFound`) y `aprobarInspeccion` la satisfacen cada
 * una con su propia consulta, sin acoplarse a un tipo de Prisma concreto.
 */
export type InspeccionParaConfirmacion = {
  puedeOperar: boolean | null;
  justificacionNoOperar: string | null;
  tomaMedicamentos: boolean | null;
  condicionesAptas: boolean | null;
  consumioAlcohol: boolean | null;
  respuestas: {
    valor: RespuestaChecklist;
    checklistItem: { nombre: string; orden: number; category: { orden: number } };
  }[];
  novedades: {
    inspectionItemResponseId: string | null;
    tipo: TipoNovedad;
    descripcion: string;
  }[];
};

const ETIQUETA_VALOR: Partial<Record<RespuestaChecklist, string>> = {
  FALLA: "Falla",
  MALO: "Malo",
};

/**
 * Lista ordenada de motivos (texto legible) por los que aprobar esta
 * inspección exige confirmación explícita del supervisor. Vacía = nada
 * reportado, se aprueba como siempre. Regla de producto (2026-10-07): FALLA o
 * MALO en el checklist (vía `esNovedad`, única fuente de esa regla) y
 * novedades generales; `puedeOperar === false`; y declaraciones del conductor
 * preocupantes (mismos criterios que `requiereAtencionEstadoConductor`, pero
 * una razón por respuesta). BAJO nunca es motivo. Es dato derivado: el
 * servidor la recalcula al aprobar, jamás confía en lo que mande el cliente.
 */
export function motivosConfirmacionAprobacion(inspection: InspeccionParaConfirmacion): string[] {
  const motivos: string[] = [];

  const enNovedad = inspection.respuestas
    .filter((respuesta) => esNovedad(respuesta.valor))
    .sort(
      (a, b) =>
        a.checklistItem.category.orden - b.checklistItem.category.orden ||
        a.checklistItem.orden - b.checklistItem.orden,
    );
  for (const respuesta of enNovedad) {
    motivos.push(`${respuesta.checklistItem.nombre}: ${ETIQUETA_VALOR[respuesta.valor] ?? respuesta.valor}`);
  }

  // Las novedades ligadas a un ítem ya salen arriba como FALLA/MALO.
  for (const novedad of inspection.novedades) {
    if (novedad.inspectionItemResponseId === null) {
      motivos.push(`Novedad general (${TIPO_NOVEDAD_LABELS[novedad.tipo]}): ${novedad.descripcion}`);
    }
  }

  if (inspection.puedeOperar === false) {
    const justificacion = inspection.justificacionNoOperar?.trim();
    motivos.push(
      justificacion
        ? `El trabajador reportó que no puede operar el vehículo: ${justificacion}`
        : "El trabajador reportó que no puede operar el vehículo",
    );
  }

  if (inspection.tomaMedicamentos === true) {
    motivos.push("El conductor declaró estar bajo efectos de un medicamento, sustancia o condición que afecta su capacidad");
  }
  if (inspection.condicionesAptas === false) {
    motivos.push("El conductor declaró no estar en condiciones físicas y mentales adecuadas");
  }
  if (inspection.consumioAlcohol === true) {
    motivos.push("El conductor declaró haber consumido alcohol u otra sustancia");
  }

  return motivos;
}
