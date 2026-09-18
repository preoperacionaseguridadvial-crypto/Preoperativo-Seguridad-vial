import "server-only";
import { getInspectionForSupervisor, type InspectionForSupervisorConFotos } from "@/lib/inspections/supervisor-queries";
import { getFirmasInspeccion } from "@/lib/inspections/queries";
import { getSetting, CLAVE_FECHA_VIGENCIA } from "@/lib/settings/queries";

/**
 * Todo lo que necesita el PDF FO-SVS-23 de una inspección puntual, en una
 * sola función: reusa `getInspectionForSupervisor` (vehículo, conductor,
 * worker, supervisor, respuestas con checklistItem/categoría, novedades con
 * fotos ya firmadas) y le suma las firmas manuscritas (`getFirmasInspeccion`,
 * también con URL firmada). No duplica lógica de Prisma ni de S3 — ninguna
 * de las dos funciones sabe del PDF, es puro ensamblado.
 *
 * `fechaVigencia` (fase soporte-moto-carro, Slice 4, ADR A5) no es un dato
 * de la inspección puntual — es la configuración global `AppSetting`
 * (`formato.fechaVigencia`, editable desde /admin/configuracion). Se
 * resuelve acá, no en el componente de presentación (`InspeccionPdfDocument`
 * no accede a Prisma), y siempre trae algo mostrable: `getSetting` devuelve
 * el placeholder sembrado por el seed si ningún Administrador la configuró
 * todavía (nunca undefined/null, nunca una fecha inventada).
 */
export type InspeccionParaPdf = InspectionForSupervisorConFotos & {
  firmas: Awaited<ReturnType<typeof getFirmasInspeccion>>;
  fechaVigencia: string;
};

export async function getInspeccionParaPdf(inspectionId: string): Promise<InspeccionParaPdf | null> {
  const inspection = await getInspectionForSupervisor(inspectionId);
  if (!inspection) {
    return null;
  }

  const firmas = await getFirmasInspeccion(inspectionId);
  const fechaVigencia = await getSetting(CLAVE_FECHA_VIGENCIA);

  return { ...inspection, firmas, fechaVigencia };
}
