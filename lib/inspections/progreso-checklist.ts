/**
 * Progreso del checklist de una inspección a partir del catálogo con estado
 * (`getChecklistEstadoCompleto`): total de ítems y cuántos ya tienen
 * respuesta. "Revisado" = cualquier respuesta; PENDIENTE es el único estado
 * que no cuenta (mismo criterio que `ProgresoInspeccion`).
 */
export function contarProgresoChecklist(
  catalogo: readonly { items: readonly { estado: string }[] }[],
): { total: number; revisados: number } {
  let total = 0;
  let revisados = 0;
  for (const categoria of catalogo) {
    for (const item of categoria.items) {
      total += 1;
      if (item.estado !== "PENDIENTE") revisados += 1;
    }
  }
  return { total, revisados };
}
