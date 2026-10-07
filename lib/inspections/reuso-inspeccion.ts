// Constantes del reuso de una inspección EN_PROCESO al iniciar (ver
// `iniciarInspeccion`, lib/inspections/actions.ts). Vive fuera de actions.ts
// porque un módulo "use server" solo puede exportar funciones async.

/**
 * Ventana (en horas) durante la cual una inspección EN_PROCESO del trabajador
 * sobre su vehículo se considera "la de hoy" y se reutiliza al volver a
 * iniciar. La inspección preoperacional es un chequeo DIARIO: una que quedó
 * abandonada hace más tiempo ya no representa el estado actual del vehículo,
 * así que se cancela y se abre una nueva con `startedAt` fresco en vez de
 * devolver la vieja.
 */
export const VENTANA_REUSO_INSPECCION_HORAS = 24;

/**
 * `true` si una inspección EN_PROCESO iniciada en `startedAt` todavía cuenta
 * como "la de hoy" (se reutiliza al iniciar); `false` si se considera
 * abandonada. Misma regla que aplica `iniciarInspeccion`, en un solo lugar
 * para que las pantallas del trabajador no prometan algo distinto.
 */
export function esReutilizable(startedAt: Date, ahora: Date = new Date()): boolean {
  return startedAt.getTime() >= ahora.getTime() - VENTANA_REUSO_INSPECCION_HORAS * 60 * 60 * 1000;
}
