import "server-only";
import { getInspeccionesPendientes } from "@/lib/inspections/supervisor-queries";
import type { RolAprobador } from "@/lib/inspections/cola-aprobacion";
import { getSignedReadUrl } from "@/lib/storage/s3";

export type PendienteConFoto = Awaited<ReturnType<typeof getInspeccionesPendientes>>[number] & {
  fotoVehiculoUrl: string | null;
};

/**
 * Inspecciones pendientes de decisión del aprobador `role` (su cola, ver
 * lib/inspections/cola-aprobacion.ts) con la miniatura del vehículo: la foto
 * LATERAL diaria de la inspección (muestra la moto/carro completo y en su
 * estado de hoy); si falta, la foto de la hoja de vida (Vehicle.fotoS3Key).
 * Firmadas on-demand; si no hay foto o la firma falla, la tarjeta cae al
 * ícono moto/carro.
 */
export async function getPendientesConFoto(role: RolAprobador): Promise<PendienteConFoto[]> {
  return Promise.all(
    (await getInspeccionesPendientes(role)).map(async (inspection) => {
      const s3Key = inspection.fotos[0]?.s3Key ?? inspection.vehicle.fotoS3Key;
      return {
        ...inspection,
        fotoVehiculoUrl: s3Key ? await getSignedReadUrl(s3Key).catch(() => null) : null,
      };
    }),
  );
}
