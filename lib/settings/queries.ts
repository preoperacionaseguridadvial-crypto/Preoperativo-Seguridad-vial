import "server-only";
import { prisma } from "@/lib/prisma";
import { CLAVE_FECHA_VIGENCIA, PLACEHOLDER_FECHA_VIGENCIA } from "@/lib/settings/constants";

// Almacén genérico de configuración (fase soporte-moto-carro, Slice 4, ADR
// A5) — ver lib/admin/queries.ts para el mismo espíritu de "solo lectura
// acá, mutaciones en *-actions.ts".
//
// CLAVE_FECHA_VIGENCIA/PLACEHOLDER_FECHA_VIGENCIA viven en
// lib/settings/constants.ts (sin "server-only") para que prisma/seed.ts
// pueda importarlas sin arrastrar esa dependencia; se reexportan acá para
// no romper a los consumidores existentes de este módulo.
export { CLAVE_FECHA_VIGENCIA, PLACEHOLDER_FECHA_VIGENCIA };

const VALORES_POR_DEFECTO: Record<string, string> = {
  [CLAVE_FECHA_VIGENCIA]: PLACEHOLDER_FECHA_VIGENCIA,
};

/**
 * Devuelve el valor guardado para `clave`, o su placeholder si la fila
 * todavía no existe. Claves sin placeholder registrado devuelven cadena
 * vacía en vez de `null` — ningún consumidor actual necesita distinguir
 * "no configurado" de "configurado vacío".
 */
export async function getSetting(clave: string): Promise<string> {
  const setting = await prisma.appSetting.findUnique({ where: { clave } });
  if (setting) {
    return setting.valor;
  }
  return VALORES_POR_DEFECTO[clave] ?? "";
}

/**
 * Persiste `valor` para `clave` (upsert: la fila sembrada por el seed ya
 * existe, así que en la práctica esto siempre actualiza). Sin chequeo de
 * rol acá a propósito — esa responsabilidad vive en
 * `lib/settings/actions.ts` (`actualizarConfiguracion`), que es quien llama a
 * este helper: la mutation de Prisma queda separada del `requireRole` que la
 * protege.
 */
export function setSetting(clave: string, valor: string, updatedById: string | null) {
  return prisma.appSetting.upsert({
    where: { clave },
    update: { valor, updatedById },
    create: { clave, valor, updatedById },
  });
}
