"use server";

import { requireRole } from "@/lib/auth/requireRole";
import { logAudit } from "@/lib/audit";
import { Role } from "@/generated/prisma/client";
import { setSetting } from "@/lib/settings/queries";

// Server action del panel de Administrador (fase soporte-moto-carro, Slice
// 4, ADR A5) — mismo patrón que lib/admin/vehicle-actions.ts:
// `requireRole` primero, mutación de Prisma, `logAudit` al final.

/**
 * Actualiza una configuración de `AppSetting` (hoy solo
 * `formato.fechaVigencia` la usa desde la UI, ver
 * app/(admin)/admin/configuracion/page.tsx — el almacén es genérico, no hay
 * nada específico de esa clave acá).
 */
export async function actualizarConfiguracion(clave: string, valor: string) {
  const session = await requireRole([Role.ADMINISTRADOR]);

  const valorLimpio = valor.trim();
  if (!valorLimpio) {
    throw new Error("El valor no puede quedar vacío.");
  }

  const setting = await setSetting(clave, valorLimpio, session.user.id);

  await logAudit({
    userId: session.user.id,
    action: "ACTUALIZAR_CONFIGURACION",
    entityType: "AppSetting",
    entityId: clave,
    metadata: { valor: valorLimpio },
  });

  return setting;
}
