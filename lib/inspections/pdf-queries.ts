import "server-only";
import { getInspectionForSupervisor, type InspectionForSupervisorConFotos } from "@/lib/inspections/supervisor-queries";
import { getFirmasInspeccion } from "@/lib/inspections/queries";
import { getSetting, CLAVE_FECHA_VIGENCIA, PLACEHOLDER_FECHA_VIGENCIA } from "@/lib/settings/queries";

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
  const fechaVigencia = await resolverFechaVigencia();

  return { ...inspection, firmas, fechaVigencia };
}

/**
 * Corrección Slice 4 (hallazgo WARNING resiliencia): antes, cualquier error
 * transitorio de la tabla `AppSetting` (problema de conexión puntual,
 * migración corrida pero seed no, etc.) tumbaba la generación completa del
 * PDF de toda inspección, aunque `getSetting` documenta que "siempre
 * devuelve algo mostrable". Se degrada al placeholder en vez de propagar el
 * error, con el mismo criterio de logging que
 * lib/inspections/foto-actions.ts (`console.error` con contexto).
 */
async function resolverFechaVigencia(): Promise<string> {
  try {
    return await getSetting(CLAVE_FECHA_VIGENCIA);
  } catch (err) {
    console.error("Fallo al leer la configuracion de fecha de vigencia (AppSetting); se usa el placeholder.", {
      clave: CLAVE_FECHA_VIGENCIA,
      err,
    });
    return PLACEHOLDER_FECHA_VIGENCIA;
  }
}
