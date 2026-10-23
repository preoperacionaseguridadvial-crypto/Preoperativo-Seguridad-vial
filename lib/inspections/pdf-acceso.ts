import type { InspectionStatus, Role } from "@/generated/prisma/client";

/**
 * Regla única de descarga del PDF FO-SVS-23 (la usan el endpoint
 * `app/api/inspecciones/[id]/pdf` y el botón "Ver PDF" de la consulta):
 * - Únicamente SST puede descargar el documento oficial.
 * - No existe si la inspección sigue EN_PROCESO (sin firma ni resultado) ni
 *   si está CANCELADA (se descartó, nunca hubo nada oficial que documentar).
 */
export function puedeDescargarPdf(rol: Role, status: InspectionStatus): boolean {
  return rol === "SST" && status !== "EN_PROCESO" && status !== "CANCELADA";
}
