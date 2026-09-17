import "server-only";
import { getInspectionForSupervisor, type InspectionForSupervisorConFotos } from "@/lib/inspections/supervisor-queries";
import { getFirmasInspeccion } from "@/lib/inspections/queries";

/**
 * Todo lo que necesita el PDF FO-SVS-23 de una inspección puntual, en una
 * sola función: reusa `getInspectionForSupervisor` (vehículo, conductor,
 * worker, supervisor, respuestas con checklistItem/categoría, novedades con
 * fotos ya firmadas) y le suma las firmas manuscritas (`getFirmasInspeccion`,
 * también con URL firmada). No duplica lógica de Prisma ni de S3 — ninguna
 * de las dos funciones sabe del PDF, es puro ensamblado.
 */
export type InspeccionParaPdf = InspectionForSupervisorConFotos & {
  firmas: Awaited<ReturnType<typeof getFirmasInspeccion>>;
};

export async function getInspeccionParaPdf(inspectionId: string): Promise<InspeccionParaPdf | null> {
  const inspection = await getInspectionForSupervisor(inspectionId);
  if (!inspection) {
    return null;
  }

  const firmas = await getFirmasInspeccion(inspectionId);

  return { ...inspection, firmas };
}
