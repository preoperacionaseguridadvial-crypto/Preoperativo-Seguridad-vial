// Regla del reuso de una inspección EN_PROCESO al iniciar (ver
// `iniciarInspeccion`, lib/inspections/actions.ts). Vive fuera de actions.ts
// porque un módulo "use server" solo puede exportar funciones async.
import { inicioUltimaVentana } from "@/lib/horarios/ventanas";

/**
 * `true` si una inspección EN_PROCESO iniciada en `startedAt` todavía es la del
 * turno en curso (se reutiliza al iniciar); `false` si quedó abandonada de un
 * turno anterior (se cancela y se abre una nueva). Regla de producto
 * 2026-10-20: la pendiente se retoma solo dentro del mismo turno, es decir, si
 * `startedAt` es posterior al inicio de la última ventana abierta. Fuera de
 * ventana (solo con habilitación de SST) esa es la del turno que acaba de
 * cerrar, justo la que la habilitación permite terminar. Única fuente de la
 * regla: `iniciarInspeccion` y las pantallas del trabajador la comparten.
 */
export function esReutilizable(startedAt: Date, ahora: Date = new Date()): boolean {
  return startedAt.getTime() >= inicioUltimaVentana(ahora).getTime();
}
